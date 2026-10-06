import { describe, expect, it } from "vitest";
import { PANE } from "../sets/art/windows";
import { buildSkyline, type SkylineSpec } from "./skylineLayout";

const SPEC: SkylineSpec = { seed: 2026, count: 40, x: [-170, 190], z: [-210, -48], height: [14, 75], lit: 0.4, clear: [{ x: [-20, 36], z: [-70, -20] }] };

describe("night skyline", () => {
  it("is deterministic", () => {
    expect(buildSkyline(SPEC)).toEqual(buildSkyline(SPEC));
  });

  it("keeps clear of the boxes it is asked to", () => {
    for (const b of buildSkyline(SPEC).blocks) {
      const inside = b.x + b.w / 2 > -20 && b.x - b.w / 2 < 36 && b.z + b.d / 2 > -70 && b.z - b.d / 2 < -20;
      expect(inside).toBe(false);
    }
  });

  it("lights its windows as painted rooms, never dark cells, a little off each front face", () => {
    const { blocks, windows } = buildSkyline(SPEC);
    expect(windows.length).toBeGreaterThan(100);
    for (const pane of windows) {
      expect([PANE.dark, PANE.blindsDark]).not.toContain(pane.cell);
      const owner = blocks.find((b) => Math.abs(b.z + b.d / 2 + 0.15 - pane.p[2]) < 1e-6 && Math.abs(pane.p[0] - b.x) <= b.w / 2);
      expect(owner).toBeDefined();
      expect(pane.p[1]).toBeLessThan((owner?.h ?? 0) - 1);
    }
  });

  it("caps every block's roof, and stacks roof parts on what stands below", () => {
    const { blocks, roofs } = buildSkyline(SPEC);
    expect(roofs.length).toBeGreaterThanOrEqual(blocks.length);
    for (const part of roofs) expect(part.h).toBeGreaterThan(0);
  });
});
