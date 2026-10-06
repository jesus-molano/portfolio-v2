import { describe, expect, it } from "vitest";
import { buildPrism } from "./prismGeometry";

describe("buildPrism", () => {
  const geometry = buildPrism(0.75, 7.5);

  it("has three faces of the given width, the first looking at the street (+z)", () => {
    const pos = geometry.getAttribute("position");
    const width = Math.hypot(pos.getX(1) - pos.getX(0), pos.getZ(1) - pos.getZ(0));
    expect(width).toBeCloseTo(0.75, 6);
    const normal = geometry.getAttribute("normal");
    expect(normal.getZ(0)).toBeCloseTo(1, 6);
    expect(geometry.getIndex()?.count).toBe(18);
  });

  it("runs uv.x left to right on the street face", () => {
    const pos = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    expect(uv.getX(0)).toBe(0);
    expect(pos.getX(0)).toBeLessThan(pos.getX(1));
  });
});
