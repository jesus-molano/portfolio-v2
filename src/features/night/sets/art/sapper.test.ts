import { describe, expect, it } from "vitest";
import { PROPORTION, reach, rigSapper } from "./sapper";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("reach", () => {
  it("keeps both bones at their lengths and lands on a target in reach", () => {
    const root = { x: 0, y: 0 };
    const target = { x: 120, y: 60 };
    const { joint, end } = reach(root, target, 100, 80, 1);
    expect(dist(root, joint)).toBeCloseTo(100, 6);
    expect(dist(joint, end)).toBeCloseTo(80, 6);
    expect(dist(end, target)).toBeCloseTo(0, 6);
  });

  it("bends to the side it is asked to", () => {
    const root = { x: 0, y: 0 };
    const target = { x: 0, y: 150 };
    // Straight down; +1 turns the line clockwise on screen (toward -x), -1 toward +x.
    expect(reach(root, target, 100, 80, 1).joint.x).toBeLessThan(0);
    expect(reach(root, target, 100, 80, -1).joint.x).toBeGreaterThan(0);
  });

  it("meets a target out of reach at full stretch along the line to it", () => {
    const { joint, end } = reach({ x: 0, y: 0 }, { x: 500, y: 0 }, 100, 80, 1);
    expect(end.x).toBeCloseTo(180, 3);
    expect(Math.abs(joint.y)).toBeLessThan(1);
  });
});

describe("rigSapper", () => {
  const pose = {
    h: 60,
    hip: { x: 300, y: 600 },
    lean: 0.8,
    look: 0.5,
    ankles: { near: { x: 400, y: 750 }, far: { x: 180, y: 745 } },
    toes: { near: 0, far: 0.5 },
    wrists: { near: { x: 480, y: 470 }, far: { x: 470, y: 450 } },
    facing: 1 as const,
  };
  const rig = rigSapper(pose);

  it("stands on its ankles and grips with its wrists", () => {
    expect(dist(rig.near.ankle, pose.ankles.near)).toBeLessThan(1e-3);
    expect(dist(rig.near.wrist, pose.wrists.near)).toBeLessThan(1e-3);
    expect(dist(rig.near.knee, rig.near.hip)).toBeCloseTo(PROPORTION.thigh * pose.h, 3);
    expect(dist(rig.near.elbow, rig.near.shoulder)).toBeCloseTo(PROPORTION.upper * pose.h, 3);
  });

  it("bends its knees toward where it faces and leans into the push", () => {
    // The front knee sits ahead of the line from hip to ankle.
    const { hip, knee, ankle } = rig.near;
    const cross = (ankle.x - hip.x) * (knee.y - hip.y) - (ankle.y - hip.y) * (knee.x - hip.x);
    expect(cross).toBeLessThan(0);
    expect(rig.neck.x).toBeGreaterThan(rig.hip.x);
    expect(rig.head.y).toBeLessThan(rig.neck.y);
  });

  it("mirrors when it faces left", () => {
    const left = rigSapper({ ...pose, facing: -1 });
    expect(left.neck.x).toBeLessThan(left.hip.x);
    expect(left.hf.x).toBeLessThan(0);
  });
});

describe("rigSapper's twist and hands", () => {
  const pose = {
    h: 60,
    hip: { x: 300, y: 600 },
    lean: 0.8,
    look: 0.5,
    ankles: { near: { x: 400, y: 750 }, far: { x: 180, y: 745 } },
    toes: { near: 0, far: 0.5 },
    wrists: { near: { x: 480, y: 470 }, far: { x: 470, y: 450 } },
    facing: 1 as const,
  };

  it("drops the near shoulder down the spine by the asked head units", () => {
    const straight = rigSapper(pose);
    const dropped = rigSapper({ ...pose, drop: 0.25 });
    const moved = Math.hypot(dropped.near.shoulder.x - straight.near.shoulder.x, dropped.near.shoulder.y - straight.near.shoulder.y);
    expect(moved).toBeCloseTo(0.25 * pose.h, 6);
    expect(dropped.far.shoulder).toEqual(straight.far.shoulder);
  });

  it("grips by default and keeps the hands it is given", () => {
    expect(rigSapper(pose).near.hand.kind).toBe("grip");
    const r = rigSapper({ ...pose, hands: { near: { kind: "point" }, far: { kind: "push" } } });
    expect(r.near.hand.kind).toBe("point");
    expect(r.far.hand.kind).toBe("push");
  });
});
