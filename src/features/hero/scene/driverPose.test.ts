import { Bone, Group, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { captureBindPose, poseDriver, solveTwoBone, TARGETS, WRIST_RANGE } from "./driverPose";

/**
 * Synthetic rig with the axis conventions measured on the Quaternius driver
 * at its bind pose: +Y along each bone, +X along the knuckle line, +Z out of
 * the back of the hand, palms facing the ground. Left arm points to -x and
 * right arm to +x (T-pose); legs point down; the feet are free bones under
 * Root, as in the real rig.
 *
 * The transforms match the scene: the car body is moved and turned, the
 * character sits at a seat offset, turned 180 degrees and scaled 0.92. The
 * rig is described in car space and converted to each bone's local space.
 */
function makeRig() {
  const car = new Group();
  car.position.set(2.4, 0.05, -1);
  car.rotation.y = 0.4;
  const character = new Group();
  character.position.set(-0.42, -0.29, 0.27);
  character.rotation.y = Math.PI;
  character.scale.setScalar(0.92);
  car.add(character);
  const root = new Bone();
  root.name = "Root";
  character.add(root);
  car.updateMatrixWorld(true);
  const bones = new Map<string, Bone>([["Root", root]]);
  const carQuaternion = car.getWorldQuaternion(new Quaternion());

  /** Adds a bone at a car-space position with a car-space frame. */
  const add = (name: string, parent: Object3D, position: Vector3, frame: Quaternion) => {
    const bone = new Bone();
    bone.name = name;
    parent.add(bone);
    parent.updateWorldMatrix(true, false);
    bone.position.copy(parent.worldToLocal(car.localToWorld(position.clone())));
    const worldFrame = carQuaternion.clone().multiply(frame);
    bone.quaternion.copy(parent.getWorldQuaternion(new Quaternion()).invert().multiply(worldFrame));
    bone.updateWorldMatrix(false, false);
    bones.set(name, bone);
    return bone;
  };
  const frameOf = (x: Vector3, y: Vector3, z: Vector3) =>
    new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  const up = new Vector3(0, 1, 0);

  for (const side of ["L", "R"] as const) {
    const s = side === "L" ? -1 : 1;
    // Left: X = -z, Y = -x, Z = up. Right: X = +z, Y = +x, Z = up.
    const frame = frameOf(new Vector3(0, 0, s), new Vector3(s, 0, 0), up);
    const out = new Vector3(s, 0, 0);
    const shoulder = new Vector3(side === "L" ? -0.56 : -0.24, 1.01, 0.3);
    const chain = (name: string, parent: Object3D, at: Vector3) => add(name, parent, at, frame);
    const upper = chain(`UpperArm${side}`, root, shoulder);
    const elbowAt = shoulder.clone().addScaledVector(out, 0.24);
    const lower = chain(`LowerArm${side}`, upper, elbowAt);
    const wristAt = elbowAt.clone().addScaledVector(out, 0.3);
    const wrist = chain(`Wrist${side}`, lower, wristAt);
    for (const finger of ["Index", "Middle", "Ring", "Pinky", "Thumb"]) {
      const one = chain(`${finger}1${side}`, wrist, wristAt.clone().addScaledVector(out, 0.02));
      const two = chain(`${finger}2${side}`, one, wristAt.clone().addScaledVector(out, 0.11));
      chain(`${finger}3${side}`, two, wristAt.clone().addScaledVector(out, 0.15));
    }

    // Leg: thigh and shin point down; the foot sits at the ankle under Root.
    const down = frameOf(new Vector3(-1, 0, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1));
    const hip = new Vector3(side === "L" ? -0.48 : -0.32, 0.55, 0.25);
    const thigh = add(`UpperLeg${side}`, root, hip, down);
    add(`LowerLeg${side}`, thigh, hip.clone().add(new Vector3(0, -0.4, 0)), down);
    add(`Foot${side}`, root, hip.clone().add(new Vector3(0, -0.87, 0)), down);
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

  it("puts the wrists and feet on their car-space targets", () => {
    const { car, bones } = posed();
    const inCar = (name: string) => car.worldToLocal(world(bones.get(name)!));
    expect(inCar("WristR").distanceTo(TARGETS.handR)).toBeLessThan(1e-3);
    expect(inCar("WristL").distanceTo(TARGETS.handL)).toBeLessThan(1e-3);
    expect(inCar("FootL").distanceTo(TARGETS.footL)).toBeLessThan(1e-3);
    expect(inCar("FootR").distanceTo(TARGETS.footR)).toBeLessThan(1e-3);
  });

  it.each(["L", "R"])("keeps the %s hand in line with the forearm", (side) => {
    const { bones } = posed();
    const elbow = world(bones.get(`LowerArm${side}`)!);
    const wrist = bones.get(`Wrist${side}`)!;
    const forearm = world(wrist).sub(elbow).normalize();
    const hand = axis(wrist, 0, 1, 0);
    const palm = axis(wrist, 0, 0, -1);
    expect(forearm.angleTo(hand)).toBeLessThanOrEqual(WRIST_RANGE + 1e-6);
    // No sideways bend: in the plane of the palm the hand follows the forearm.
    const flatForearm = forearm.clone().addScaledVector(palm, -forearm.dot(palm));
    const flatHand = hand.clone().addScaledVector(palm, -hand.dot(palm));
    expect(flatForearm.angleTo(flatHand)).toBeLessThan((3 * Math.PI) / 180);
  });

  it.each([
    ["L", TARGETS.palmL],
    ["R", TARGETS.palmR],
  ] as const)("turns the %s palm toward its target around the forearm", (side, target) => {
    const { car, bones } = posed();
    const elbow = world(bones.get(`LowerArm${side}`)!);
    const wrist = bones.get(`Wrist${side}`)!;
    const forearm = world(wrist).sub(elbow).normalize();
    const palm = axis(wrist, 0, 0, -1);
    const wanted = target.clone().transformDirection(car.matrixWorld);
    // The wrist flexion turns the palm in the plane of the forearm, so the
    // palm and the target agree once both are seen along the forearm.
    const flatPalm = palm.addScaledVector(forearm, -palm.dot(forearm));
    const flatWanted = wanted.addScaledVector(forearm, -wanted.dot(forearm));
    expect(flatPalm.angleTo(flatWanted)).toBeLessThan((3 * Math.PI) / 180);
  });

  it.each(["L", "R"])("closes the %s fingers toward the palm, not sideways", (side) => {
    const { bones } = posed();
    const knuckle = bones.get(`Middle2${side}`)!;
    const palm = axis(bones.get(`Wrist${side}`)!, 0, 0, -1);
    const across = axis(bones.get(`Wrist${side}`)!, 1, 0, 0);
    const straight = axis(knuckle.parent as Bone, 0, 1, 0);
    const finger = world(bones.get(`Middle3${side}`)!).sub(world(knuckle)).normalize();
    const bend = finger.clone().sub(straight);
    expect(bend.dot(palm)).toBeGreaterThan(0);
    expect(Math.abs(bend.dot(across))).toBeLessThan(1e-6);
  });
});

describe("solveTwoBone", () => {
  it("reaches a reachable target and keeps both bone lengths", () => {
    const { bones } = makeRig();
    const upper = bones.get("UpperArmR")!;
    const lower = bones.get("LowerArmR")!;
    const wrist = bones.get("WristR")!;
    const a = world(upper).distanceTo(world(lower));
    const b = world(lower).distanceTo(world(wrist));
    const target = world(upper).add(new Vector3(0.1, -0.2, -0.3));
    solveTwoBone(upper, lower, wrist, target, new Vector3(0, -1, 0));
    expect(world(wrist).distanceTo(target)).toBeLessThan(1e-6);
    expect(world(upper).distanceTo(world(lower))).toBeCloseTo(a, 9);
    expect(world(lower).distanceTo(world(wrist))).toBeCloseTo(b, 9);
  });
});
