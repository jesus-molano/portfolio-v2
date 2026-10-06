import { describe, expect, it } from "vitest";
import { ARMY_GIRDER, ARMY_HOLE, ARMY_POSTER, armySappers } from "./army";

const deg = (r: number) => (r * 180) / Math.PI;

describe("the army poster's girder", () => {
  it("runs nearly flat, a launching nose a few degrees up, not into the sky", () => {
    expect(deg(ARMY_GIRDER.pitch)).toBeGreaterThanOrEqual(3);
    expect(deg(ARMY_GIRDER.pitch)).toBeLessThanOrEqual(6);
  });

  it("ends a whole number of Bailey bays at the tear, a panel half as deep as it is long", () => {
    const span = Math.hypot(ARMY_HOLE.x - ARMY_GIRDER.tail.x, ARMY_HOLE.y - ARMY_GIRDER.tail.y);
    expect(ARMY_GIRDER.bay * ARMY_GIRDER.bays).toBeCloseTo(span, 6);
    expect(ARMY_GIRDER.depth).toBeCloseTo(ARMY_GIRDER.bay / 2, 6);
  });

  it("tears out on the right of the picture, clear of the edges and the slogan", () => {
    expect(ARMY_HOLE.x + ARMY_HOLE.r * 1.3).toBeLessThan(ARMY_POSTER.w);
    expect(ARMY_HOLE.y - ARMY_HOLE.r).toBeGreaterThan(300);
  });
});

describe("the sappers", () => {
  const { pusher, pointer } = armySappers();
  const toAxis = (p: { x: number; y: number }) => {
    // Signed distance from the girder's axis, positive below it.
    const dx = ARMY_HOLE.x - ARMY_GIRDER.tail.x;
    const dy = ARMY_HOLE.y - ARMY_GIRDER.tail.y;
    const l = Math.hypot(dx, dy);
    return ((p.x - ARMY_GIRDER.tail.x) * -dy + (p.y - ARMY_GIRDER.tail.y) * dx) / l;
  };

  it("puts the pusher's hands on the girder's tail and his body behind it", () => {
    for (const hand of [pusher.near.wrist, pusher.far.wrist]) {
      expect(Math.abs(toAxis(hand))).toBeLessThanOrEqual(ARMY_GIRDER.depth / 2 + 2);
      expect(Math.abs(hand.x - ARMY_GIRDER.tail.x)).toBeLessThan(ARMY_GIRDER.bay / 2);
    }
    expect(pusher.hip.x).toBeLessThan(ARMY_GIRDER.tail.x);
    expect(pusher.near.hand.kind).toBe("push");
  });

  it("has the pointer's one hand on the top chord and the other pointing toward the far bank", () => {
    expect(toAxis(pointer.far.wrist)).toBeCloseTo(-ARMY_GIRDER.depth / 2 - 4, 0);
    expect(pointer.near.hand.kind).toBe("point");
    expect(pointer.near.wrist.x).toBeGreaterThan(pointer.near.shoulder.x);
    expect(pointer.near.wrist.y).toBeLessThan(pointer.near.shoulder.y);
  });
});
