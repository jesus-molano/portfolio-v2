import { describe, expect, it } from "vitest";
import { lens } from "./lens";
import { currentLens, resolveLens } from "./lensBlur";

describe("resolveLens", () => {
  it("is off with the default lens", () => {
    expect(resolveLens(lens).active).toBe(false);
  });

  it("turns on with a bokeh scale and keeps the focus", () => {
    const resolved = resolveLens({ focusDistance: 6, focusRange: 2.5, bokehScale: 3 });
    expect(resolved).toEqual({ focusDistance: 6, focusRange: 2.5, bokehScale: 3, active: true });
  });

  it("never passes a zero focus range (undefined smoothstep)", () => {
    expect(resolveLens({ focusDistance: 6, focusRange: 0, bokehScale: 2 }).focusRange).toBeGreaterThan(0);
  });

  it("treats negative or broken values as off", () => {
    expect(resolveLens({ focusDistance: 6, focusRange: 2, bokehScale: -1 })).toMatchObject({
      bokehScale: 0,
      active: false,
    });
    const broken = resolveLens({ focusDistance: Number.NaN, focusRange: Number.NaN, bokehScale: Number.NaN });
    expect(broken.active).toBe(false);
    expect(Number.isFinite(broken.focusDistance)).toBe(true);
    expect(Number.isFinite(broken.focusRange)).toBe(true);
  });
});

describe("currentLens", () => {
  it("returns the shared lens when no override is set", () => {
    expect(currentLens()).toBe(lens);
  });
});
