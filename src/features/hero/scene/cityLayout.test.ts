import { describe, expect, it } from "vitest";
import {
  AVENUE,
  BILLBOARD_PLOTS,
  boardSpan,
  buildCity,
  buildFrontage,
  CITY_EYES,
  footprintOf,
  LANDMARK_SITE,
  overlaps,
  sightCap,
} from "./cityLayout";
import { CAR_POSITION } from "./drive";
import { SHOTS } from "./shots";
import { buildWaterfront } from "./waterfrontLayout";
import { world } from "./world";

type Box3 = { x: number; y: number; z: number; w: number; h: number; d: number };

function intersects(a: Box3, b: Box3): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
}

describe("buildCity", () => {
  const city = buildCity(150, 5000, 400);

  it("is deterministic for the same inputs", () => {
    const a = buildCity(40, 500, 60);
    const b = buildCity(40, 500, 60);
    expect(a.blocks).toEqual(b.blocks);
    expect(a.frontage).toEqual(b.frontage);
    expect(a.windows.map((w) => [w.x, w.y, w.z, w.yaw])).toEqual(
      b.windows.map((w) => [w.x, w.y, w.z, w.yaw]),
    );
    expect(a.strips.map((s) => [s.x, s.y, s.z])).toEqual(b.strips.map((s) => [s.x, s.y, s.z]));
  });

  it("keeps the road and its sidewalks clear", () => {
    expect(city.blocks.length).toBeGreaterThanOrEqual(150);
    for (const block of city.blocks) {
      // Cornices may stand a hand's width proud of the building line.
      expect(Math.abs(block.x) - block.w / 2).toBeGreaterThan(AVENUE.halfWidth - 0.3);
      expect(block.h).toBeGreaterThan(0);
    }
  });

  it("keeps the towers inside the skyline band and off the landmark's site", () => {
    const avenueBlocks = city.blocks.filter((block) =>
      city.frontage.some((building) => overlaps(footprintOf(block), footprintOf(building, 0.3))),
    );
    for (const block of city.blocks) {
      if (avenueBlocks.includes(block)) continue;
      expect(block.z).toBeGreaterThanOrEqual(world.skyline.zFar);
      expect(block.z).toBeLessThanOrEqual(world.skyline.zNear);
      expect(overlaps(footprintOf(block), LANDMARK_SITE)).toBe(false);
    }
  });

  it("never cuts through the waterfront hotels", () => {
    const waterfront = buildWaterfront();
    const hotelParts: Box3[] = [
      ...waterfront.solids,
      ...waterfront.glows,
      ...waterfront.cylinders.map((c) => ({ x: c.x, y: c.y, z: c.z, w: c.r * 2, h: c.h, d: c.r * 2 })),
    ];
    for (const block of city.blocks) {
      for (const part of hotelParts) expect(intersects(block, part)).toBe(false);
    }
  });

  it("respects the window and strip budgets", () => {
    const small = buildCity(150, 300, 10);
    expect(small.windows.length).toBeLessThanOrEqual(300);
    expect(small.strips.length).toBeLessThanOrEqual(10);
  });
});

describe("buildFrontage", () => {
  const frontage = buildFrontage();
  const sides = ([-1, 1] as const).map((side) =>
    frontage.filter((b) => b.side === side).sort((a, b) => b.z - a.z),
  );

  it("is deterministic", () => {
    expect(buildFrontage()).toEqual(frontage);
  });

  it("lines both sides of the avenue from the hotel row to the plaza", () => {
    for (const row of sides) {
      expect(row.length).toBeGreaterThanOrEqual(4);
      expect(row[0].z + row[0].d / 2).toBeGreaterThan(AVENUE.zFrom - 4);
      const last = row[row.length - 1];
      expect(last.z - last.d / 2).toBeLessThan(AVENUE.zTo + 10);
      for (const building of row) {
        expect(Math.abs(building.x) - building.w / 2).toBeCloseTo(AVENUE.halfWidth, 6);
        expect(building.z + building.d / 2).toBeLessThanOrEqual(AVENUE.zFrom + 1e-9);
        expect(building.z - building.d / 2).toBeGreaterThanOrEqual(AVENUE.zTo - 1e-9);
      }
    }
  });

  it("separates neighbours with narrow alleys, never a hole", () => {
    for (const row of sides) {
      for (let i = 1; i < row.length; i++) {
        const alley = row[i - 1].z - row[i - 1].d / 2 - (row[i].z + row[i].d / 2);
        expect(alley).toBeGreaterThanOrEqual(1.5);
        expect(alley).toBeLessThan(12);
      }
    }
  });

  it("rises toward the landmark", () => {
    for (const row of sides) {
      const third = Math.max(1, Math.floor(row.length / 3));
      const mean = (list: typeof row) => list.reduce((sum, b) => sum + b.h, 0) / list.length;
      expect(mean(row.slice(-third))).toBeGreaterThan(mean(row.slice(0, third)) + 8);
    }
  });

  it("gives every billboard its own host, deep enough for the whole board", () => {
    BILLBOARD_PLOTS.forEach((plot, index) => {
      const hosts = frontage.filter((b) => b.billboard === index);
      expect(hosts).toHaveLength(1);
      expect(hosts[0].side).toBe(plot.side);
      expect(hosts[0].w).toBeGreaterThan(plot.board.w + 1);
    });
  });
});

describe("footprints", () => {
  it("measures a block's footprint, with a margin", () => {
    expect(footprintOf({ x: 10, y: 0, z: -200, w: 4, h: 9, d: 6 }, 1)).toEqual({
      minX: 7,
      maxX: 13,
      minZ: -204,
      maxZ: -196,
    });
  });

  it("overlaps only when the rectangles share area", () => {
    const a = { minX: 0, maxX: 10, minZ: -10, maxZ: 0 };
    expect(overlaps(a, { minX: 5, maxX: 15, minZ: -5, maxZ: 5 })).toBe(true);
    expect(overlaps(a, { minX: 10, maxX: 20, minZ: -10, maxZ: 0 })).toBe(false);
    expect(overlaps(a, { minX: 0, maxX: 10, minZ: 1, maxZ: 2 })).toBe(false);
  });
});

describe("boardSpan", () => {
  it("starts each board just outside the building line, on its side", () => {
    for (const plot of BILLBOARD_PLOTS) {
      const span = boardSpan(plot);
      expect(span.maxX - span.minX).toBeCloseTo(plot.board.w, 9);
      const inner = plot.side > 0 ? span.minX : -span.maxX;
      expect(inner).toBeGreaterThan(AVENUE.halfWidth);
      expect(inner).toBeLessThan(AVENUE.halfWidth + 1);
    }
  });
});

describe("sightCap", () => {
  it("is unlimited behind the last board, and away from every board", () => {
    expect(sightCap(-40, -13, AVENUE.zTo)).toBe(Number.POSITIVE_INFINITY);
    expect(sightCap(150, 170, -205)).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps a building in front of a board under the board's bottom", () => {
    for (const plot of BILLBOARD_PLOTS) {
      const span = boardSpan(plot);
      const cap = sightCap(span.minX, span.maxX, plot.z + 20);
      expect(cap).toBeLessThan(plot.bottom);
      expect(cap).toBeGreaterThan(10);
    }
  });
});

describe("city eyes and road", () => {
  it("match the rear shot and the end of the crane", () => {
    const rear = SHOTS.find((shot) => shot.id === "rear")!;
    const crane = SHOTS.find((shot) => shot.id === "crane")!;
    expect(CITY_EYES[0].y).toBeCloseTo(rear.from.position.y, 1);
    expect(CITY_EYES[0].z).toBeCloseTo(rear.from.position.z, 1);
    expect(CITY_EYES[1].y).toBeCloseTo(crane.to.position.y, 1);
    expect(CITY_EYES[1].z).toBeCloseTo(crane.to.position.z, 1);
    // Both look down the avenue from near its axis.
    expect(Math.abs(rear.from.position.x + CAR_POSITION.x)).toBeLessThan(3);
    expect(Math.abs(crane.to.position.x + CAR_POSITION.x)).toBeLessThan(3);
  });

  it("ends the road where the plaza starts", () => {
    expect(world.road.zEnd).toBe(AVENUE.zTo);
  });
});
