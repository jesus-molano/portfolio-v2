import { describe, expect, it } from "vitest";
import { decay, ELASTIC, rubberBand, touchStretchMax } from "./elastic";

describe("rubberBand", () => {
  it("starts at 0, grows with the push and never reaches its max", () => {
    expect(rubberBand(0, 8)).toBe(0);
    expect(rubberBand(-10, 8)).toBe(0);
    let previous = 0;
    for (let x = 1; x < 5000; x *= 1.5) {
      const value = rubberBand(x, 8);
      expect(value).toBeGreaterThan(previous);
      expect(value).toBeLessThan(8);
      previous = value;
    }
  });

  it("gives a wheel notch at a wall a visible bounce", () => {
    // One 100 px notch held at a wall, past the dead zone.
    const bounce = rubberBand(100 - ELASTIC.wheelDeadZone, ELASTIC.wheelMax);
    expect(bounce).toBeGreaterThan(5);
    expect(bounce).toBeLessThan(ELASTIC.wheelMax);
  });
});

describe("touchStretchMax", () => {
  it("scales with the viewport up to 48 px", () => {
    expect(touchStretchMax(844)).toBe(48);
    expect(touchStretchMax(667)).toBeCloseTo(40, 0);
  });
});

describe("decay", () => {
  it("halves in tau * ln 2", () => {
    expect(decay(10, ELASTIC.wheelTau * Math.LN2, ELASTIC.wheelTau)).toBeCloseTo(5, 10);
    expect(decay(10, 0, ELASTIC.wheelTau)).toBe(10);
    expect(decay(10, 1, 0)).toBe(0);
  });
});
