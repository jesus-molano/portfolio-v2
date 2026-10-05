import { describe, expect, it } from "vitest";
import { GRADE, gradeLinear, gradeUniforms, type GradeLook, type Rgb } from "./grade";

const NEUTRAL: GradeLook = { lift: 0, warmth: 0, contrast: 0, saturation: 1, shadowSaturation: 1 };
const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("gradeUniforms", () => {
  it("is the identity with a neutral look", () => {
    const uniforms = gradeUniforms(NEUTRAL);
    expect(uniforms.lift).toEqual([0, 0, 0]);
    expect(uniforms.gain).toEqual([1, 1, 1]);
  });

  it("lifts toward violet and gains toward peach without exceeding 1", () => {
    const { lift, gain } = gradeUniforms(GRADE);
    // Violet: blue above red above green.
    expect(lift[2]).toBeGreaterThan(lift[0]);
    expect(lift[0]).toBeGreaterThan(lift[1]);
    // Peach: red kept, blue pulled down most.
    expect(gain[0]).toBeCloseTo(1);
    expect(gain[2]).toBeLessThan(gain[1]);
    for (const channel of gain) expect(channel).toBeLessThanOrEqual(1);
  });
});

describe("gradeLinear", () => {
  it("leaves colours unchanged with a neutral look", () => {
    const uniforms = gradeUniforms(NEUTRAL);
    for (const color of [
      [0, 0, 0],
      [0.18, 0.1, 0.3],
      [1, 1, 1],
    ] as const) {
      const graded = gradeLinear([...color], uniforms);
      graded.forEach((v, i) => expect(v).toBeCloseTo(color[i], 6));
    }
  });

  it("never maps black to pure black: the floor is violet", () => {
    const [r, g, b] = gradeLinear([0, 0, 0]);
    expect(Math.max(r, g, b)).toBeGreaterThan(0.002);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
  });

  it("keeps white below clipping and warm", () => {
    const [r, , b] = gradeLinear([1, 1, 1]);
    expect(r).toBeLessThanOrEqual(1);
    expect(r).toBeGreaterThan(b);
  });

  it("is monotonic in brightness", () => {
    let previous = -1;
    for (let i = 0; i <= 50; i++) {
      const v = i / 50;
      const current = luma(gradeLinear([v, v, v]));
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("adds contrast around mid grey: darks darker, highlights brighter than with lift alone", () => {
    const flat = gradeUniforms({ ...GRADE, contrast: 0 });
    const curved = gradeUniforms(GRADE);
    const dark = 0.02;
    const bright = 0.7;
    expect(luma(gradeLinear([dark, dark, dark], curved))).toBeLessThan(
      luma(gradeLinear([dark, dark, dark], flat)),
    );
    expect(luma(gradeLinear([bright, bright, bright], curved))).toBeGreaterThan(
      luma(gradeLinear([bright, bright, bright], flat)),
    );
  });

  it("calms saturated shadows and enriches midtones", () => {
    const spread = (c: number[]) => Math.max(...c) - Math.min(...c);
    const neutral = gradeUniforms({ ...GRADE, saturation: 1, shadowSaturation: 1 });
    const shadow: Rgb = [0.012, 0.0005, 0.03];
    const mid: Rgb = [0.5, 0.25, 0.45];
    expect(spread(gradeLinear(shadow))).toBeLessThan(spread(gradeLinear(shadow, neutral)));
    expect(spread(gradeLinear(mid))).toBeGreaterThan(spread(gradeLinear(mid, neutral)));
  });

  it("clamps out-of-range input", () => {
    for (const v of gradeLinear([4, -1, 0.5])) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
