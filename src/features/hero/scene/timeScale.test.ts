import { describe, expect, it } from "vitest";
import { easeTimeScale } from "./timeScale";

describe("easeTimeScale", () => {
  it("moves toward the target without overshooting", () => {
    const next = easeTimeScale(1, 0.25, 1 / 60);
    expect(next).toBeLessThan(1);
    expect(next).toBeGreaterThan(0.25);
  });

  it("does not depend on the frame rate", () => {
    let at30 = 1;
    for (let i = 0; i < 30; i++) at30 = easeTimeScale(at30, 0.25, 1 / 30);
    let at120 = 1;
    for (let i = 0; i < 120; i++) at120 = easeTimeScale(at120, 0.25, 1 / 120);
    expect(at30).toBeCloseTo(at120, 6);
  });

  it("is close to the target within a third of a second and lands on it", () => {
    let value = 1;
    for (let i = 0; i < 20; i++) value = easeTimeScale(value, 0.25, 1 / 60);
    expect(Math.abs(value - 0.25)).toBeLessThan(0.05 * 0.75);
    for (let i = 0; i < 120; i++) value = easeTimeScale(value, 0.25, 1 / 60);
    expect(value).toBe(0.25);
  });

  it("holds still for a zero or invalid frame time", () => {
    expect(easeTimeScale(0.6, 1, 0)).toBe(0.6);
    expect(easeTimeScale(0.6, 1, Number.NaN)).toBe(0.6);
  });
});
