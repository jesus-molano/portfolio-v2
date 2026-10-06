import { describe, expect, it } from "vitest";
import { prismAngle, rippleAngle, TRIVISION } from "./trivision";

const STEP = (2 * Math.PI) / 3;

describe("trivision", () => {
  it("turns exactly 120 degrees between the ends of a flip", () => {
    for (let i = 0; i < TRIVISION.prisms; i += 1) {
      expect(prismAngle(i, 0, 0)).toBeCloseTo(0, 9);
      expect(prismAngle(i, 0, 1)).toBeCloseTo(STEP, 9);
      expect(prismAngle(i, 1, 1)).toBeCloseTo(2 * STEP, 9);
    }
  });

  it("runs the wave from left to right", () => {
    expect(prismAngle(0, 0, 0.3)).toBeGreaterThan(prismAngle(TRIVISION.prisms - 1, 0, 0.3));
  });

  it("never returns NaN and bounds the ripple", () => {
    expect(Number.isNaN(prismAngle(3, 0, Number.NaN))).toBe(false);
    expect(rippleAngle(4, 4, 1)).toBeCloseTo(TRIVISION.rippleMax, 9);
    expect(rippleAngle(4, Number.NaN, 1)).toBe(0);
    expect(rippleAngle(0, 12, 1)).toBeLessThan(0.01);
  });
});
