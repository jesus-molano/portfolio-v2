import { describe, expect, it } from "vitest";
import { segmentHitsBox, visibleShare } from "./sightlines";

const wall = { x: 0, y: 0, z: -10, w: 4, h: 4, d: 1 };

describe("segmentHitsBox", () => {
  it("hits a box across the segment", () => {
    expect(segmentHitsBox({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -20 }, wall)).toBe(true);
  });

  it("misses a box beside, above or beyond the segment", () => {
    expect(segmentHitsBox({ x: 5, y: 2, z: 0 }, { x: 5, y: 2, z: -20 }, wall)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 6, z: 0 }, { x: 0, y: 6, z: -20 }, wall)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -5 }, wall)).toBe(false);
  });

  it("does not count the box whose face the target lies on", () => {
    expect(segmentHitsBox({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -9.5 }, wall)).toBe(false);
  });

  it("handles segments parallel to an axis outside the box", () => {
    expect(segmentHitsBox({ x: 3, y: 2, z: -9 }, { x: 3, y: 2, z: -11 }, wall)).toBe(false);
  });
});

describe("visibleShare", () => {
  it("counts the targets no box hides", () => {
    const eye = { x: 0, y: 2, z: 0 };
    const targets = [
      { x: 0, y: 2, z: -20 },
      { x: 0, y: 8, z: -20 },
    ];
    expect(visibleShare(eye, targets, [wall])).toBe(0.5);
    expect(visibleShare(eye, targets, [])).toBe(1);
    expect(visibleShare(eye, [], [wall])).toBe(0);
  });
});
