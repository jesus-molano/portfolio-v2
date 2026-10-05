import { describe, expect, it } from "vitest";
import { buildBillboards } from "./billboardLayout";
import { AVENUE, buildCity, footprintOf, LANDMARK_SITE, overlaps } from "./cityLayout";
import { CAR_POSITION } from "./drive";
import { buildLandmark, CROWN_TOP, LANDMARK, PLAZA, SIDEWALK } from "./landmarkLayout";
import { type Box, type Point, visibleShare } from "./sightlines";
import { SHOTS } from "./shots";
import { buildWaterfront } from "./waterfrontLayout";
import { world } from "./world";

describe("buildLandmark", () => {
  const layout = buildLandmark();
  const city = buildCity(150, 5000, 400);

  it("is deterministic", () => {
    expect(buildLandmark()).toEqual(layout);
  });

  it("stands on the avenue axis, just beyond the skyline", () => {
    expect(LANDMARK.x).toBe(0);
    expect(LANDMARK.z).toBeGreaterThanOrEqual(-320);
    expect(LANDMARK.z).toBeLessThanOrEqual(-305);
    expect(LANDMARK.z).toBeLessThan(world.skyline.zFar);
    for (const block of layout.blocks) {
      expect(overlaps(footprintOf(block), LANDMARK_SITE)).toBe(true);
      expect(block.x - block.w / 2).toBeGreaterThanOrEqual(LANDMARK_SITE.minX);
      expect(block.x + block.w / 2).toBeLessThanOrEqual(LANDMARK_SITE.maxX);
      expect(block.z + block.d / 2).toBeLessThanOrEqual(LANDMARK_SITE.maxZ);
    }
  });

  it("steps back as it rises: each tier sits on the one below, narrower", () => {
    const { tiers } = LANDMARK;
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].y).toBe(tiers[i - 1].top);
      expect(tiers[i].w).toBeLessThan(tiers[i - 1].w);
      expect(tiers[i].d).toBeLessThan(tiers[i - 1].d);
    }
  });

  it("is clearly taller than the rest of the city", () => {
    const tip = Math.max(...layout.blocks.map((b) => b.y + b.h));
    expect(tip).toBeGreaterThanOrEqual(95);
    expect(tip).toBeLessThanOrEqual(120);
    const cityTop = Math.max(...city.blocks.map((b) => b.y + b.h));
    expect(CROWN_TOP).toBeGreaterThan(cityTop + 8);
  });

  it("wears neon bands on its crown and lit windows up its shaft", () => {
    const crownNeon = layout.glows.filter((g) => g.y > LANDMARK.tiers[1].top && g.intensity > 1);
    expect(crownNeon.length).toBeGreaterThanOrEqual(5);
    const lit = layout.panes.filter((p) => p.intensity > 1);
    expect(lit.length).toBeGreaterThan(layout.panes.length * 0.25);
    expect(lit.length).toBeLessThan(layout.panes.length * 0.8);
  });

  it("keeps panes, fins and neon off the faces so the depth buffer never mixes them", () => {
    for (const pane of layout.panes) {
      const tier = LANDMARK.tiers.find((t) => pane.y > t.y && pane.y < t.top)!;
      expect(pane.z - (LANDMARK.z + tier.d / 2)).toBeGreaterThanOrEqual(0.1);
      expect(Math.abs(pane.x) + pane.w / 2).toBeLessThan(tier.w / 2);
    }
  });

  it("paves the sidewalks and the plaza without touching the road", () => {
    const paving = layout.ground.filter((g) => g.h < 1);
    expect(paving).toHaveLength(3);
    for (const slab of layout.ground) {
      const onPlaza = slab.z + slab.d / 2 <= PLAZA.zFrom + 1e-9;
      if (!onPlaza) expect(Math.abs(slab.x) - slab.w / 2).toBeGreaterThanOrEqual(SIDEWALK.inner - 1e-9);
      expect(slab.x - slab.w / 2).toBeGreaterThanOrEqual(-PLAZA.halfWidth - 1e-9);
      expect(slab.x + slab.w / 2).toBeLessThanOrEqual(PLAZA.halfWidth + 1e-9);
    }
    // The plaza runs from the end of the avenue to the podium.
    expect(PLAZA.zFrom).toBe(AVENUE.zTo);
    expect(PLAZA.zTo).toBeCloseTo(LANDMARK.z + LANDMARK.tiers[0].d / 2, 6);
  });

  it("is the focal point: nothing in the city hides its crown from the causeway", () => {
    const waterfront = buildWaterfront();
    const boards = buildBillboards(city.frontage);
    const blockers: Box[] = [
      ...city.blocks,
      ...waterfront.solids,
      ...boards.parts.map((p) => ({ ...p, y: p.y - p.h / 2, w: p.w + 1, d: p.d + 1 })),
    ];
    // Front faces of everything above the shaft's top, sampled on a grid.
    const crown: Point[] = [];
    for (const tier of LANDMARK.tiers.filter((t) => t.y >= LANDMARK.tiers[1].top)) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          crown.push({
            x: LANDMARK.x + ((i - 1) * tier.w) / 3,
            y: tier.y + ((j + 0.5) * (tier.top - tier.y)) / 3,
            z: LANDMARK.z + tier.d / 2 + 0.01,
          });
        }
      }
    }
    const rear = SHOTS[0];
    const crane = SHOTS[SHOTS.length - 1];
    for (const key of [rear.from, rear.to, crane.via![crane.via!.length - 1], crane.to]) {
      const eye = { x: key.position.x + CAR_POSITION.x, y: key.position.y, z: key.position.z };
      expect(visibleShare(eye, crown, blockers)).toBe(1);
    }
  });
});
