import { type Bone, type Object3D, Quaternion, Vector3 } from "three";

/**
 * Seated driving pose for the MakeHuman "game_engine" rig (Unreal-style bone
 * names), solved once at load time with two-bone IK. Pure three.js math (no
 * React), so it is unit tested.
 *
 * Measured on the exported GLB at its bind pose (an A-pose, facing +z):
 * every bone has +Y along the bone; the palms face the thighs with the thumb
 * forward. The solver does not rely on any other local axis: the palm normal
 * comes from the knuckles and fingers bend about a world axis.
 */

export type Side = "l" | "r";

/**
 * Character root relative to the car origin (driver side is -x, front is -z);
 * the character is turned 180 degrees to face -z. At full size (1.74 m) the
 * hip joints land at y 0.58: the seat cushion top is at 0.55, so the seat
 * hides the buttocks, and the eyes stay at ~1.27 m, below the windshield top
 * (1.35 m). The pelvis sits at z 0.215, where the old driver's hips were.
 */
export const DRIVER_SEAT = { x: -0.42, y: -0.359, z: 0.222 } as const;
export const DRIVER_SCALE = 1;

/** Bone names of the rig. */
export const BONES = {
  spine: "spine_01",
  head: "head",
  upperArm: (side: Side) => `upperarm_${side}`,
  lowerArm: (side: Side) => `lowerarm_${side}`,
  hand: (side: Side) => `hand_${side}`,
  finger: (finger: string, joint: 1 | 2 | 3, side: Side) => `${finger}_0${joint}_${side}`,
  thigh: (side: Side) => `thigh_${side}`,
  calf: (side: Side) => `calf_${side}`,
  foot: (side: Side) => `foot_${side}`,
} as const;

/**
 * Pose targets in car space, measured with raycasts against the convertible.
 * Backrest front face (after the seat slide): z 0.33 at y 0.7 rising to z 0.44
 * at y 1.1 (~16 deg). Steering wheel in its original place on the dashboard:
 * rim top (-0.28, 1.04, -0.21), right (-0.13, 0.84, -0.15), bottom
 * (-0.42, 0.62, -0.14). Each arm is about 0.5 m from shoulder to wrist.
 */
export const TARGETS = {
  /** Right hand between twelve and two o'clock on the rim, arm long. */
  handR: new Vector3(-0.2, 0.97, -0.18),
  poleR: new Vector3(0.6, -1, 0.5),
  /** The right palm faces the rim: toward the wheel centre and a little forward. */
  palmR: new Vector3(-0.45, -0.8, -0.4),
  /**
   * Left forearm lies along the door top; elbow out over the door. The wrist
   * sits on the outer half of the sill (x -0.74..-0.66, y 0.95-0.97), far
   * enough back that the fingertips stop before the windshield frame
   * (which meets the sill at z -0.1 on its inner side).
   */
  handL: new Vector3(-0.7, 0.997, 0.1),
  /**
   * Bends the elbow out and only slightly up: high enough that the upper arm
   * lies on the sill, not through it, low enough that the elbow does not
   * poke up above the door.
   */
  poleL: new Vector3(-1, 0.04, 0.4),
  /** The left palm faces down onto the sill, tipped a little outward. */
  palmL: new Vector3(-0.2, -1, 0),
  /** Feet toward the pedals. */
  footL: new Vector3(-0.5, 0.27, -0.5),
  footR: new Vector3(-0.34, 0.27, -0.5),
  poleKnee: new Vector3(0, 1, -0.3),
  /**
   * The lower spine leans back about 7 degrees. The MakeHuman torso is long:
   * this puts the shoulder joints at z ~0.30 and the shoulder blades on the
   * backrest, and keeps the rim within reach of the right hand.
   */
  lean: new Vector3(0, 1, 0.13),
};

/**
 * Finger flexion in radians at each joint: 01 is the knuckle, 02 the middle
 * joint, 03 the tip. The right hand grips the rim; the left rests loosely on
 * the door.
 */
export const FLEX = { r: [1.0, 1.1, 0.75], l: [0.18, 0.22, 0.15] } as const;
const THUMB_FLEX = { r: 0.55, l: 0.2 } as const;
const FINGERS = ["index", "middle", "ring", "pinky"] as const;

/**
 * Pitch of the left hand on the sill, in radians: almost level, fingertips a
 * touch lower. The wrist only flexes or extends to reach it (clamped to a
 * natural range); it never bends sideways, which a real wrist cannot do.
 */
const HAND_PITCH_L = -0.06;
/** The right wrist bends slightly toward the palm, as it does on a rim. */
const WRIST_FLEX_R = 0.2;
/** Largest flexion or extension the solver applies, in radians. */
export const WRIST_RANGE = 0.6;

const Y = new Vector3(0, 1, 0);

/** Rotates a bone so its +Y axis (the bone direction) points at a world target. */
function aimBone(bone: Bone, target: Vector3) {
  bone.updateWorldMatrix(true, false);
  const origin = bone.getWorldPosition(new Vector3());
  const desired = target.clone().sub(origin).normalize();
  const world = bone.getWorldQuaternion(new Quaternion());
  const current = Y.clone().applyQuaternion(world);
  world.premultiply(new Quaternion().setFromUnitVectors(current, desired));
  const parent = bone.parent ? bone.parent.getWorldQuaternion(new Quaternion()) : new Quaternion();
  bone.quaternion.copy(parent.invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}

/** Rotates a bone by `angle` radians about a world-space axis. */
function rotateWorld(bone: Bone, axis: Vector3, angle: number) {
  if (!bone.parent || angle === 0) return;
  bone.updateWorldMatrix(true, false);
  const world = bone.getWorldQuaternion(new Quaternion());
  world.premultiply(new Quaternion().setFromAxisAngle(axis, angle));
  const parent = bone.parent.getWorldQuaternion(new Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(world));
  bone.updateWorldMatrix(false, true);
}

/**
 * Palm normal of a hand in world space, from the knuckle positions: the hand
 * direction (wrist to middle knuckle) crossed with the knuckle line (pinky to
 * index on the left hand, index to pinky on the right) points out of the
 * palm on both hands, whatever the bind pose or the bone roll.
 */
export function palmNormal(side: Side, wrist: Vector3, index: Vector3, middle: Vector3, pinky: Vector3) {
  const hand = middle.clone().sub(wrist);
  const knuckles = side === "l" ? index.clone().sub(pinky) : pinky.clone().sub(index);
  return hand.cross(knuckles).normalize();
}

/** How the wrist bends after the palm is turned: to a hand pitch, or by a fixed flexion. */
export type WristBend = { pitch: number } | { flex: number };

/**
 * Hand that stays in line with the forearm, as a real wrist does: first the
 * forearm turns about its own axis until the palm faces `palmTarget`
 * (pronation or supination), then the wrist flexes toward the palm (or
 * extends away from it), never sideways. `palmLocal` is the palm normal in
 * the wrist's local frame.
 */
export function placeHand(
  forearm: Bone,
  wrist: Bone,
  palmLocal: Vector3,
  palmTarget: Vector3,
  bend: WristBend,
) {
  forearm.updateWorldMatrix(true, true);
  const axis = Y.clone().applyQuaternion(forearm.getWorldQuaternion(new Quaternion())).normalize();
  const palm = palmLocal.clone().applyQuaternion(wrist.getWorldQuaternion(new Quaternion()));
  // Signed angle between the current and the wanted palm, about the forearm.
  // A palm parallel to the axis projects to zero and gives no roll (atan2(0, 0) is 0 in JS).
  const from = palm.addScaledVector(axis, -palm.dot(axis)).normalize();
  const to = palmTarget.clone().addScaledVector(axis, -palmTarget.dot(axis)).normalize();
  const roll = Math.atan2(axis.dot(new Vector3().crossVectors(from, to)), from.dot(to));
  rotateWorld(forearm, axis, roll);

  // Rotating the hand axis about (hand x palm) by a positive angle bends it
  // toward the palm. For a pitch target with the palm facing down, a flexion
  // of f radians lowers the hand by about f; two passes absorb the palm's tilt.
  let flex = 0;
  for (let pass = 0; pass < 2; pass++) {
    const hand = Y.clone().applyQuaternion(wrist.getWorldQuaternion(new Quaternion())).normalize();
    const palmNow = palmLocal.clone().applyQuaternion(wrist.getWorldQuaternion(new Quaternion()));
    const wanted =
      "pitch" in bend
        ? Math.asin(Math.min(1, Math.max(-1, hand.y))) - bend.pitch
        : pass === 0
          ? bend.flex
          : 0;
    const step = Math.min(WRIST_RANGE - flex, Math.max(-WRIST_RANGE - flex, wanted));
    const bendAxis = new Vector3().crossVectors(hand, palmNow);
    // A palm parallel to the hand has no bend axis; a zero axis would give a
    // non-unit quaternion and squash the hand.
    if (bendAxis.lengthSq() < 1e-12) break;
    rotateWorld(wrist, bendAxis.normalize(), step);
    flex += step;
  }
}

/**
 * Closes a finger toward the palm: each joint turns by its angle about one
 * axis across the finger (the knuckle bone's direction crossed with the palm
 * normal), so the finger never spreads sideways whatever the bone roll. The
 * axis is fixed for the whole finger: measured joint by joint, it would flip
 * once the finger passes 90 degrees and the tip would bend back.
 */
export function curlFinger(joints: Bone[], palm: Vector3, angles: readonly number[]) {
  const [knuckle] = joints;
  if (!knuckle) return;
  knuckle.updateWorldMatrix(true, false);
  const along = Y.clone().applyQuaternion(knuckle.getWorldQuaternion(new Quaternion()));
  const across = new Vector3().crossVectors(along, palm);
  if (across.lengthSq() < 1e-12) return;
  across.normalize();
  joints.forEach((joint, i) => rotateWorld(joint, across, angles[i] ?? 0));
}

/** Analytic two-bone IK: upper and lower bone reach `target`, bending toward `pole`. */
export function solveTwoBone(upper: Bone, lower: Bone, end: Object3D, target: Vector3, pole: Vector3) {
  upper.updateWorldMatrix(true, true);
  const start = upper.getWorldPosition(new Vector3());
  const mid = lower.getWorldPosition(new Vector3());
  const tip = end.getWorldPosition(new Vector3());
  const a = start.distanceTo(mid);
  const b = mid.distanceTo(tip);
  const toTarget = target.clone().sub(start);
  const d = Math.min(Math.max(toTarget.length(), 0.01), (a + b) * 0.995);
  const axis = toTarget.normalize();
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const bend = pole.clone().sub(axis.clone().multiplyScalar(pole.dot(axis))).normalize();
  const elbow = start.clone().add(axis.clone().multiplyScalar(along)).add(bend.multiplyScalar(h));
  const reach = start.clone().add(axis.multiplyScalar(d));
  aimBone(upper, elbow);
  aimBone(lower, reach);
  return reach;
}

/** Bind pose of one bone: rotation and position. */
export type RestBone = { quaternion: Quaternion; position: Vector3 };

/** Copies the current (bind) rotation and position of every bone. */
export function captureBindPose(bones: Map<string, Bone>): Map<string, RestBone> {
  return new Map(
    [...bones].map(([name, bone]) => [
      name,
      { quaternion: bone.quaternion.clone(), position: bone.position.clone() },
    ]),
  );
}

const worldPosition = (bone: Bone) => bone.getWorldPosition(new Vector3());

/**
 * Poses the driver. `root` is the character, its parent the car body (pose
 * targets are in car space). Starts from the bind pose every time, so a
 * second call (StrictMode, a Canvas remount, Fast Refresh) gives the same pose.
 */
export function poseDriver(root: Object3D, bones: Map<string, Bone>, rest: Map<string, RestBone>) {
  for (const [name, bone] of bones) {
    const base = rest.get(name);
    if (!base) continue;
    bone.quaternion.copy(base.quaternion);
    bone.position.copy(base.position);
  }
  const car = root.parent;
  if (!car) return;
  car.updateWorldMatrix(true, true);
  const toWorld = (p: Vector3) => car.localToWorld(p.clone());
  const dirToWorld = (d: Vector3) => d.clone().transformDirection(car.matrixWorld);
  const get = (name: string) => bones.get(name);

  // Palm normal of each hand in its wrist's local frame, measured now, at
  // the bind pose, from the knuckles.
  const hands = (["l", "r"] as const).flatMap((side) => {
    const forearm = get(BONES.lowerArm(side));
    const wrist = get(BONES.hand(side));
    const index = get(BONES.finger("index", 1, side));
    const middle = get(BONES.finger("middle", 1, side));
    const pinky = get(BONES.finger("pinky", 1, side));
    if (!forearm || !wrist || !index || !middle || !pinky) return [];
    const palm = palmNormal(side, worldPosition(wrist), worldPosition(index), worldPosition(middle), worldPosition(pinky));
    const palmLocal = palm.applyQuaternion(wrist.getWorldQuaternion(new Quaternion()).invert());
    return [{ side, forearm, wrist, palmLocal }];
  });

  const spine = get(BONES.spine);
  if (spine) {
    spine.updateWorldMatrix(true, false);
    aimBone(spine, worldPosition(spine).add(dirToWorld(TARGETS.lean)));
  }

  const arms: Array<[Side, Vector3, Vector3]> = [
    ["r", TARGETS.handR, TARGETS.poleR],
    ["l", TARGETS.handL, TARGETS.poleL],
  ];
  for (const [side, hand, pole] of arms) {
    const u = get(BONES.upperArm(side));
    const l = get(BONES.lowerArm(side));
    const e = get(BONES.hand(side));
    if (u && l && e) solveTwoBone(u, l, e, toWorld(hand), dirToWorld(pole));
  }

  // Hands in line with the forearms: the right palm on the rim, the left palm
  // down on the sill. Then the fingers close toward the posed palm.
  for (const { side, forearm, wrist, palmLocal } of hands) {
    const target = side === "r" ? TARGETS.palmR : TARGETS.palmL;
    const bend: WristBend = side === "r" ? { flex: WRIST_FLEX_R } : { pitch: HAND_PITCH_L };
    placeHand(forearm, wrist, palmLocal, dirToWorld(target), bend);

    const palm = palmLocal.clone().applyQuaternion(wrist.getWorldQuaternion(new Quaternion()));
    const chain = (finger: string, joints: Array<1 | 2 | 3>) =>
      joints.flatMap((joint) => get(BONES.finger(finger, joint, side)) ?? []);
    for (const finger of FINGERS) curlFinger(chain(finger, [1, 2, 3]), palm, FLEX[side]);
    curlFinger(chain("thumb", [2]), palm, [THUMB_FLEX[side]]);
  }

  // Legs: the feet hang from the calves, so solving the leg moves them too.
  const legs: Array<[Side, Vector3]> = [
    ["l", TARGETS.footL],
    ["r", TARGETS.footR],
  ];
  for (const [side, foot] of legs) {
    const u = get(BONES.thigh(side));
    const l = get(BONES.calf(side));
    const e = get(BONES.foot(side));
    if (u && l && e) solveTwoBone(u, l, e, toWorld(foot), dirToWorld(TARGETS.poleKnee));
  }
}
