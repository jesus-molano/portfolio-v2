import { type Bone, type Object3D, Quaternion, Vector3 } from "three";

/**
 * Seated driving pose for the Quaternius rig, solved once at load time with
 * two-bone IK. Pure three.js math (no React), so it is unit tested.
 */

/**
 * Pose targets in car space, measured with raycasts against the convertible.
 * Backrest front face (after the seat slide): z 0.33 at y 0.7 rising to z 0.44
 * at y 1.1 (~16 deg). Steering wheel in its original place on the dashboard:
 * rim top (-0.28, 1.04, -0.21), right (-0.13, 0.84, -0.15), bottom
 * (-0.42, 0.62, -0.14). Arms are human length (0.53 m at this scale) after
 * the Blender stretch.
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
  /** Bends the elbow out and a little up, so the upper arm lies on the sill, not through it. */
  poleL: new Vector3(-1, 0.15, 0.4),
  /** The left palm faces down onto the sill, tipped a little outward. */
  palmL: new Vector3(-0.2, -1, 0),
  /** Feet toward the pedals. */
  footL: new Vector3(-0.5, 0.27, -0.5),
  footR: new Vector3(-0.34, 0.27, -0.5),
  poleKnee: new Vector3(0, 1, -0.3),
  /** Upper back follows the backrest: hips_z + 0.035 + (h - 0.2) * 0.35 matches it. */
  lean: new Vector3(0, 1, 0.35),
};

/**
 * Finger flexion in radians at the knuckle (joint 2) and the middle joint
 * (joint 3); joint 1 is the metacarpal and only cups a little.
 *
 * Measured at the bind pose (palms down, thumb on the palm side): each
 * finger bone has +Y along the finger, +X along the knuckle line and +Z
 * out of the back of the hand. So fingers close about local X with a
 * NEGATIVE angle on both hands; local Z is the palm normal, and turning
 * about it only spreads the fingers sideways.
 */
export const FLEX = { R: 1.15, L: 0.22 } as const;
const THUMB_FLEX = { R: 0.6, L: 0.25 } as const;

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

/** Moves a free (IK control) bone, like the rig's feet, to a world position. */
function placeBone(bone: Bone, world: Vector3) {
  if (!bone.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  bone.position.copy(bone.parent.worldToLocal(world.clone()));
  bone.updateWorldMatrix(false, true);
}

/** Bind pose of one bone: rotation and position (the IK feet move). */
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
  // the bind pose: there both palms face the ground (verified with the
  // thumb, which sits on the palm side of the knuckle line).
  const palmLocal = (wrist: Bone) =>
    new Vector3(0, -1, 0).applyQuaternion(wrist.getWorldQuaternion(new Quaternion()).invert());
  const hands = (["L", "R"] as const).flatMap((side) => {
    const forearm = get(`LowerArm${side}`);
    const wrist = get(`Wrist${side}`);
    return forearm && wrist ? [{ side, forearm, wrist, palm: palmLocal(wrist) }] : [];
  });

  const torso = get("Torso");
  if (torso) {
    torso.updateWorldMatrix(true, false);
    const origin = torso.getWorldPosition(new Vector3());
    aimBone(torso, origin.add(dirToWorld(TARGETS.lean)));
  }

  const arms: Array<[string, string, string, Vector3, Vector3]> = [
    ["UpperArmR", "LowerArmR", "WristR", TARGETS.handR, TARGETS.poleR],
    ["UpperArmL", "LowerArmL", "WristL", TARGETS.handL, TARGETS.poleL],
  ];
  for (const [upper, lower, end, hand, pole] of arms) {
    const u = get(upper);
    const l = get(lower);
    const e = get(end);
    if (u && l && e) solveTwoBone(u, l, e, toWorld(hand), dirToWorld(pole));
  }

  // Hands in line with the forearms: the right palm on the rim, the left palm
  // down on the sill.
  for (const { side, forearm, wrist, palm } of hands) {
    const target = side === "R" ? TARGETS.palmR : TARGETS.palmL;
    const bend: WristBend = side === "R" ? { flex: WRIST_FLEX_R } : { pitch: HAND_PITCH_L };
    placeHand(forearm, wrist, palm, dirToWorld(target), bend);
  }

  // Fingers: the right hand grips the rim, the left rests loosely on the door.
  for (const side of ["R", "L"] as const) {
    for (const finger of ["Index", "Middle", "Ring", "Pinky"]) {
      for (const joint of [1, 2, 3]) {
        const amount = joint === 1 ? 0.15 : 1;
        get(`${finger}${joint}${side}`)?.rotateX(-FLEX[side] * amount);
      }
    }
    // Thumb2 measured at the bind pose: +Z also points out of the back of the
    // hand (0.98 up), so -X closes the thumb toward the palm as well.
    get(`Thumb2${side}`)?.rotateX(-THUMB_FLEX[side]);
  }

  // The rig's feet are free IK bones under Root: solve the leg, then move the
  // foot bone to the ankle so the foot mesh follows instead of hanging below.
  const legs: Array<[string, string, string, Vector3]> = [
    ["UpperLegL", "LowerLegL", "FootL", TARGETS.footL],
    ["UpperLegR", "LowerLegR", "FootR", TARGETS.footR],
  ];
  for (const [upper, lower, end, foot] of legs) {
    const u = get(upper);
    const l = get(lower);
    const e = get(end);
    if (!u || !l || !e) continue;
    const ankle = solveTwoBone(u, l, e, toWorld(foot), dirToWorld(TARGETS.poleKnee));
    placeBone(e, ankle);
  }
}
