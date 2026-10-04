import { Bone, Group, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  BONES,
  captureBindPose,
  DRIVER_SCALE,
  DRIVER_SEAT,
  palmNormal,
  poseDriver,
  type Side,
  solveTwoBone,
  TARGETS,
  WRIST_RANGE,
} from "./driverPose";

/**
 * Synthetic rig with the joint positions and axis conventions measured on the
 * exported MakeHuman driver at its bind pose (an A-pose facing +z): +Y along
 * each bone, the palms toward the thighs with the thumb forward, the hand and
 * finger +Z toward the palm. The feet hang from the calves.
 *
 * The transforms match the scene: the car body is moved and turned, the
 * character sits at DRIVER_SEAT, turned 180 degrees, at DRIVER_SCALE.
 */
function makeRig() {
  const car = new Group();
  car.position.set(2.4, 0.05, -1);
  car.rotation.y = 0.4;
  const character = new Group();
  character.position.set(DRIVER_SEAT.x, DRIVER_SEAT.y, DRIVER_SEAT.z);
  character.rotation.y = Math.PI;
  character.scale.setScalar(DRIVER_SCALE);
  car.add(character);
  const root = new Bone();
  root.name = "Root";
  character.add(root);
  car.updateMatrixWorld(true);
  const bones = new Map<string, Bone>([["Root", root]]);
  const characterQuaternion = character.getWorldQuaternion(new Quaternion());

  /** Frame with +Y along `y` and +Z as close to `z` as possible. */
  const frameOf = (y: Vector3, z: Vector3) => {
    const yAxis = y.clone().normalize();
    const zAxis = z.clone().addScaledVector(yAxis, -z.dot(yAxis)).normalize();
    const xAxis = new Vector3().crossVectors(yAxis, zAxis);
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis));
  };

  /** Adds a bone at a character-space position with a character-space frame. */
  const add = (name: string, parent: Object3D, position: Vector3, frame: Quaternion) => {
    const bone = new Bone();
    bone.name = name;
    parent.add(bone);
    parent.updateWorldMatrix(true, false);
    bone.position.copy(parent.worldToLocal(character.localToWorld(position.clone())));
    const worldFrame = characterQuaternion.clone().multiply(frame);
    bone.quaternion.copy(parent.getWorldQuaternion(new Quaternion()).invert().multiply(worldFrame));
    bone.updateWorldMatrix(false, false);
    bones.set(name, bone);
    return bone;
  };
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  const forward = v(0, 0, 1);

  const pelvisAt = v(0, 0.939, 0.007);
  const spineAt = v(0, 1.025, -0.025);
  const pelvis = add("pelvis", root, pelvisAt, frameOf(spineAt.clone().sub(pelvisAt), forward));
  const spine = add(BONES.spine, pelvis, spineAt, frameOf(v(0, 0.991, 0.134), forward));

  for (const side of ["l", "r"] as const) {
    const s = side === "l" ? 1 : -1;
    const at = (x: number, y: number, z: number) => v(s * x, y, z);
    const shoulder = at(0.191, 1.393, 0.019);
    const elbow = at(0.356, 1.205, 0.019);
    const wrist = at(0.485, 1.083, 0.202);
    const upper = add(BONES.upperArm(side), spine, shoulder, frameOf(elbow.clone().sub(shoulder), forward));
    const lower = add(BONES.lowerArm(side), upper, elbow, frameOf(wrist.clone().sub(elbow), forward));

    const knuckles = {
      index: at(0.515, 1.043, 0.305),
      middle: at(0.533, 1.031, 0.287),
      ring: at(0.538, 1.021, 0.268),
      pinky: at(0.542, 1.011, 0.248),
    };
    const handDir = knuckles.middle.clone().sub(wrist).normalize();
    // Measured palm normal: toward the thigh and down.
    const palm = at(-0.749, -0.663, 0.017);
    const hand = add(BONES.hand(side), lower, wrist, frameOf(handDir, palm));
    for (const [finger, knuckle] of Object.entries(knuckles)) {
      const frame = frameOf(handDir, palm);
      const one = add(BONES.finger(finger, 1, side), hand, knuckle, frame);
      const two = add(BONES.finger(finger, 2, side), one, knuckle.clone().addScaledVector(handDir, 0.04), frame);
      add(BONES.finger(finger, 3, side), two, knuckle.clone().addScaledVector(handDir, 0.065), frame);
    }
    const thumbAt = at(0.487, 1.076, 0.25);
    const thumbDir = at(0.25, -0.3, 0.92).normalize();
    const thumb = add(BONES.finger("thumb", 1, side), hand, thumbAt, frameOf(thumbDir, palm));
    const thumb2 = add(BONES.finger("thumb", 2, side), thumb, thumbAt.clone().addScaledVector(thumbDir, 0.04), frameOf(thumbDir, palm));
    add(BONES.finger("thumb", 3, side), thumb2, thumbAt.clone().addScaledVector(thumbDir, 0.07), frameOf(thumbDir, palm));

    const hip = at(0.111, 0.928, -0.004);
    const knee = at(0.152, 0.511, 0.03);
    const ankle = at(0.193, 0.071, 0.014);
    const thigh = add(BONES.thigh(side), pelvis, hip, frameOf(knee.clone().sub(hip), forward));
    const calf = add(BONES.calf(side), thigh, knee, frameOf(ankle.clone().sub(knee), forward));
    add(BONES.foot(side), calf, ankle, frameOf(v(0, -0.44, 0.9), v(0, 1, 0)));
  }
  car.updateMatrixWorld(true);
  return { car, character, bones };
}

const world = (bone: Bone) => bone.getWorldPosition(new Vector3());
const axis = (bone: Bone, x: number, y: number, z: number) =>
  new Vector3(x, y, z).applyQuaternion(bone.getWorldQuaternion(new Quaternion()));

function posed() {
  const rig = makeRig();
  const rest = captureBindPose(rig.bones);
  poseDriver(rig.character, rig.bones, rest);
  return { ...rig, rest };
}

describe("palmNormal", () => {
  it("points out of the palm on both hands", () => {
    // Anatomical position facing +z, as the rig does: palms forward (+z),
    // thumbs outward. The character's left is +x, so the left index finger
    // is on the +x side of the left hand and the right one on the -x side.
    const wrist = new Vector3(0, 0, 0);
    const middle = new Vector3(0, -0.1, 0);
    const left = palmNormal("l", wrist, new Vector3(0.02, -0.1, 0), middle, new Vector3(-0.03, -0.09, 0));
    const right = palmNormal("r", wrist, new Vector3(-0.02, -0.1, 0), middle, new Vector3(0.03, -0.09, 0));
    expect(left.z).toBeCloseTo(1, 6);
    expect(right.z).toBeCloseTo(1, 6);
  });

  it("matches the palm of the exported rig at its bind pose", () => {
    // Joint positions of the left hand measured on the GLB: the palm faces
    // the thigh (-x) and the ground.
    const palm = palmNormal(
      "l",
      new Vector3(0.485, 1.083, 0.202),
      new Vector3(0.515, 1.043, 0.305),
      new Vector3(0.533, 1.031, 0.287),
      new Vector3(0.542, 1.011, 0.248),
    );
    expect(palm.x).toBeLessThan(-0.6);
    expect(palm.y).toBeLessThan(-0.5);
  });
});

describe("poseDriver", () => {
  it("gives the same pose when it runs twice (StrictMode, remounts)", () => {
    const { character, bones, rest } = posed();
    const first = new Map(
      [...bones].map(([name, bone]) => [
        name,
        { position: world(bone), quaternion: bone.getWorldQuaternion(new Quaternion()) },
      ]),
    );
    poseDriver(character, bones, rest);
    for (const [name, bone] of bones) {
      const before = first.get(name)!;
      expect(world(bone).distanceTo(before.position), name).toBeLessThan(1e-9);
      expect(bone.getWorldQuaternion(new Quaternion()).angleTo(before.quaternion), name).toBeLessThan(1e-6);
    }
  });

  it("puts the wrists and ankles on their car-space targets (all within reach)", () => {
    const { car, bones } = posed();
    const inCar = (name: string) => car.worldToLocal(world(bones.get(name)!));
    expect(inCar(BONES.hand("r")).distanceTo(TARGETS.handR)).toBeLessThan(1e-3);
    expect(inCar(BONES.hand("l")).distanceTo(TARGETS.handL)).toBeLessThan(1e-3);
    expect(inCar(BONES.foot("l")).distanceTo(TARGETS.footL)).toBeLessThan(1e-3);
    expect(inCar(BONES.foot("r")).distanceTo(TARGETS.footR)).toBeLessThan(1e-3);
  });

  it("keeps the shoulders in front of the backrest and the eyes below the windshield top", () => {
    const { car, bones } = posed();
    for (const side of ["l", "r"] as const) {
      const shoulder = car.worldToLocal(world(bones.get(BONES.upperArm(side))!));
      // Backrest front face: z 0.33 at y 0.7 rising to 0.44 at y 1.1.
      const backrest = 0.33 + ((shoulder.y - 0.7) / 0.4) * 0.11;
      expect(shoulder.z).toBeLessThan(backrest);
      expect(shoulder.y).toBeLessThan(1.15);
    }
  });

  it.each(["l", "r"] as const)("adds no sideways bend to the %s wrist", (side: Side) => {
    // Seen in the plane of the palm, the angle between forearm and hand is
    // the bind pose's own deviation; turning the forearm and flexing the
    // wrist must leave it as it was (a real wrist barely bends sideways).
    const sideways = (bones: Map<string, Bone>) => {
      const elbow = world(bones.get(BONES.lowerArm(side))!);
      const wrist = bones.get(BONES.hand(side))!;
      const forearm = world(wrist).sub(elbow).normalize();
      const hand = axis(wrist, 0, 1, 0);
      const palm = axis(wrist, 0, 0, 1);
      const flatForearm = forearm.clone().addScaledVector(palm, -forearm.dot(palm));
      const flatHand = hand.clone().addScaledVector(palm, -hand.dot(palm));
      return { angle: flatForearm.angleTo(flatHand), flexion: forearm.angleTo(hand) };
    };
    const atRest = sideways(makeRig().bones);
    const { angle, flexion } = sideways(posed().bones);
    expect(Math.abs(angle - atRest.angle)).toBeLessThan((0.5 * Math.PI) / 180);
    expect(flexion).toBeLessThanOrEqual(atRest.flexion + WRIST_RANGE + 1e-6);
  });

  it.each([
    ["l", TARGETS.palmL],
    ["r", TARGETS.palmR],
  ] as const)("turns the %s palm toward its target around the forearm", (side, target) => {
    const { car, bones } = posed();
    const elbow = world(bones.get(BONES.lowerArm(side))!);
    const wrist = bones.get(BONES.hand(side))!;
    const forearm = world(wrist).sub(elbow).normalize();
    const palm = axis(wrist, 0, 0, 1);
    const wanted = target.clone().transformDirection(car.matrixWorld);
    // The wrist flexion turns the palm in the plane of the forearm, so the
    // palm and the target agree once both are seen along the forearm.
    const flatPalm = palm.addScaledVector(forearm, -palm.dot(forearm));
    const flatWanted = wanted.addScaledVector(forearm, -wanted.dot(forearm));
    expect(flatPalm.angleTo(flatWanted)).toBeLessThan((3 * Math.PI) / 180);
  });

  it.each(["l", "r"] as const)("closes the %s fingers toward the palm, not sideways", (side: Side) => {
    const { bones } = posed();
    const wrist = bones.get(BONES.hand(side))!;
    const palm = axis(wrist, 0, 0, 1);
    const across = axis(wrist, 1, 0, 0);
    const straight = axis(wrist, 0, 1, 0);
    const knuckle = bones.get(BONES.finger("middle", 1, side))!;
    const tip = bones.get(BONES.finger("middle", 3, side))!;
    const finger = world(tip).sub(world(knuckle)).normalize();
    const bend = finger.clone().sub(straight);
    expect(bend.dot(palm)).toBeGreaterThan(0);
    // The palm normal comes from the knuckle positions, a hair off the
    // wrist's own axes; a sideways curl would give ~1 here.
    expect(Math.abs(bend.dot(across))).toBeLessThan(5e-3);
  });

  it("grips the rim harder with the right hand than the left rests on the door", () => {
    const { bones } = posed();
    const curl = (side: Side) => {
      const straight = axis(bones.get(BONES.hand(side))!, 0, 1, 0);
      const tip = axis(bones.get(BONES.finger("index", 3, side))!, 0, 1, 0);
      return straight.angleTo(tip);
    };
    expect(curl("r")).toBeGreaterThan(2);
    expect(curl("l")).toBeLessThan(0.8);
  });
});

describe("solveTwoBone", () => {
  it("reaches a reachable target and keeps both bone lengths", () => {
    const { bones } = makeRig();
    const upper = bones.get(BONES.upperArm("r"))!;
    const lower = bones.get(BONES.lowerArm("r"))!;
    const wrist = bones.get(BONES.hand("r"))!;
    const a = world(upper).distanceTo(world(lower));
    const b = world(lower).distanceTo(world(wrist));
    const target = world(upper).add(new Vector3(0.1, -0.2, -0.3));
    solveTwoBone(upper, lower, wrist, target, new Vector3(0, -1, 0));
    expect(world(wrist).distanceTo(target)).toBeLessThan(1e-6);
    expect(world(upper).distanceTo(world(lower))).toBeCloseTo(a, 9);
    expect(world(lower).distanceTo(world(wrist))).toBeCloseTo(b, 9);
  });
});
