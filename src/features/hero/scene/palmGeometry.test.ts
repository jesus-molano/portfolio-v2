import { describe, expect, it } from "vitest";
import { buildPalm, PALM_SHAPES } from "./palmGeometry";

describe("buildPalm", () => {
  it("is deterministic for the same shape", () => {
    const a = buildPalm(PALM_SHAPES[0]).getAttribute("position").array;
    const b = buildPalm(PALM_SHAPES[0]).getAttribute("position").array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it.each(PALM_SHAPES.map((shape, i) => [i, shape] as const))(
    "variant %i stands on y = 0 at its real height",
    (_, shape) => {
      const geometry = buildPalm(shape);
      const box = geometry.boundingBox!;
      expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(box.min.y).toBeLessThan(0.05);
      // The crown rises above the trunk top, but never by a whole frond.
      expect(box.max.y).toBeGreaterThan(shape.height);
      expect(box.max.y).toBeLessThan(shape.height + shape.frondLength);
    },
  );

  it.each(PALM_SHAPES.map((shape, i) => [i, shape] as const))(
    "variant %i has finite positions, shader attributes in [0, 1] and a sane budget",
    (_, shape) => {
      const geometry = buildPalm(shape);
      const position = geometry.getAttribute("position");
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
      for (const name of ["aSway", "aShade", "aFlutter"]) {
        const attribute = geometry.getAttribute(name);
        expect(attribute.count, name).toBe(position.count);
        const values = Array.from(attribute.array);
        expect(Math.min(...values), name).toBeGreaterThanOrEqual(0);
        expect(Math.max(...values), name).toBeLessThanOrEqual(1);
      }
      const triangles = position.count / 3;
      expect(triangles).toBeGreaterThan(800);
      expect(triangles).toBeLessThan(3000);
    },
  );

  it("keeps the trunk base still and lets the frond tips move most", () => {
    const geometry = buildPalm(PALM_SHAPES[1]);
    const position = geometry.getAttribute("position");
    const sway = geometry.getAttribute("aSway");
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < 0.5) expect(sway.getX(i)).toBeLessThan(0.01);
    }
    expect(Math.max(...Array.from(sway.array))).toBeCloseTo(1, 1);
  });
});
