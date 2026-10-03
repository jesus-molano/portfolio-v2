import { describe, expect, it } from "vitest";
import { buildCity } from "./cityLayout";
import { world } from "./world";

describe("buildCity", () => {
  it("is deterministic for the same inputs", () => {
    const a = buildCity(40, 500, 60);
    const b = buildCity(40, 500, 60);
    expect(a.blocks).toEqual(b.blocks);
    expect(a.windows.map((w) => [w.x, w.y, w.z, w.yaw])).toEqual(
      b.windows.map((w) => [w.x, w.y, w.z, w.yaw]),
    );
    expect(a.strips.map((s) => [s.x, s.y, s.z])).toEqual(b.strips.map((s) => [s.x, s.y, s.z]));
  });

  it("keeps the avenue clear and stays inside the skyline band", () => {
    const { blocks } = buildCity(150, 5000, 400);
    expect(blocks.length).toBeGreaterThanOrEqual(150);
    for (const block of blocks) {
      expect(Math.abs(block.x) - block.w / 2).toBeGreaterThan(8);
      expect(block.z).toBeGreaterThanOrEqual(world.skyline.zFar);
      expect(block.z).toBeLessThanOrEqual(world.skyline.zNear);
      expect(block.h).toBeGreaterThan(0);
    }
  });

  it("respects the window and strip budgets", () => {
    const city = buildCity(150, 300, 10);
    expect(city.windows.length).toBeLessThanOrEqual(300);
    expect(city.strips.length).toBeLessThanOrEqual(12);
  });
});
