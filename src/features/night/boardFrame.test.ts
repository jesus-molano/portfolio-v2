import { describe, expect, it } from "vitest";
import { boardCorners, boardNormal, toSet } from "./boardFrame";

describe("boardFrame", () => {
  const frame = { centre: [11, 7, -13] as const, yaw: -Math.PI / 9, w: 16, h: 7 };

  it("keeps the corners on the face, at the board's size", () => {
    const [tl, tr, br, bl] = boardCorners(frame);
    expect(Math.hypot(tr[0] - tl[0], tr[2] - tl[2])).toBeCloseTo(16, 9);
    expect(tl[1] - bl[1]).toBeCloseTo(7, 9);
    expect(br[1]).toBeCloseTo(3.5, 9);
  });

  it("turns the face toward the approaching car (-x) for a negative yaw", () => {
    const n = boardNormal(frame);
    expect(n[0]).toBeLessThan(0);
    expect(n[2]).toBeGreaterThan(0);
    const out = toSet(frame, [0, 0, 1]);
    expect(out[0] - 11).toBeCloseTo(n[0], 9);
    expect(out[2] + 13).toBeCloseTo(n[2], 9);
  });
});
