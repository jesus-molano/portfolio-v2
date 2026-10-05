import { describe, expect, it } from "vitest";
import { ROADSIDE, ROADSIDE_LENGTH, wrapZ } from "./drive";
import {
  CITY,
  CURB_OUTER,
  gapZ,
  groundShadow,
  LAMP,
  lampPhase,
  lampPlacements,
  PALM_ROW,
  PIER,
  palmSlots,
  pierPlacement,
  RAIL_X,
  roadsidePalms,
  SHADOW_THROW,
  SHORE,
  SHORE_MAX,
  SHORE_MIN,
  shoreDistance,
  shoreFlare,
  shorelineX,
  TOWER_REACH,
  TOWER_X,
  TOWERS,
} from "./roadside";

/** Trunk radius plus the sand a palm needs around its foot. */
const PALM_FOOT = 1.2;
/** Clearance in z between a palm and a tower or the pier on the same side. */
const PROP_CLEARANCE = 4;

/** Distance between two streamed z values, the short way round the loop. */
function loopGap(a: number, b: number): number {
  const d = Math.abs(a - b) % ROADSIDE_LENGTH;
  return Math.min(d, ROADSIDE_LENGTH - d);
}

describe("roadside stream window", () => {
  it("holds a whole number of lamp periods and guardrail posts, so no row shows a seam", () => {
    expect(ROADSIDE_LENGTH % LAMP.spacing).toBe(0);
    expect(ROADSIDE_LENGTH % 4).toBe(0);
  });

  it("puts its far edge on the city beach, behind the waterline and in front of the seawall", () => {
    expect(ROADSIDE.zFront).toBeLessThan(CITY.waterline);
    expect(ROADSIDE.zFront).toBeGreaterThan(CITY.beachTo);
  });
});

describe("shoreline", () => {
  it("is periodic over the roadside window, so a streamed prop always stands on the same sand", () => {
    for (const side of [-1, 1]) {
      for (let zs = -200; zs < 200; zs += 13.7) {
        expect(shoreDistance(zs + ROADSIDE_LENGTH, side)).toBeCloseTo(shoreDistance(zs, side), 6);
        expect(shoreDistance(zs - 3 * ROADSIDE_LENGTH, side)).toBeCloseTo(shoreDistance(zs, side), 6);
      }
    }
  });

  it("keeps a narrow strip of sand: about 6 to 12 m from the curb to the water", () => {
    expect(SHORE_MIN).toBeGreaterThanOrEqual(6);
    expect(SHORE_MAX).toBeLessThanOrEqual(12.5);
    for (const side of [-1, 1]) {
      for (let zs = 0; zs < ROADSIDE_LENGTH; zs += 0.5) {
        const d = shoreDistance(zs, side);
        expect(d).toBeGreaterThanOrEqual(SHORE_MIN - 1e-9);
        expect(d).toBeLessThanOrEqual(SHORE_MAX + 1e-9);
      }
    }
  });

  it("runs the two strips out of phase", () => {
    let differs = 0;
    for (let zs = 0; zs < ROADSIDE_LENGTH; zs += 7) {
      if (Math.abs(shoreDistance(zs, -1) - shoreDistance(zs, 1)) > 0.3) differs += 1;
    }
    expect(differs).toBeGreaterThan(10);
  });

  it("flares out into the city beach at the landfall only", () => {
    expect(shoreFlare(SHORE.flare.to)).toBeCloseTo(SHORE.flare.extra);
    expect(shoreFlare(SHORE.flare.to - 20)).toBeCloseTo(SHORE.flare.extra);
    expect(shoreFlare(SHORE.flare.from)).toBe(0);
    expect(shoreFlare(0)).toBe(0);
    let previous = Number.POSITIVE_INFINITY;
    for (let z = SHORE.flare.to; z <= SHORE.flare.from; z += 1) {
      const value = shoreFlare(z);
      expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
  });
});

describe("palm rows", () => {
  const full = roadsidePalms(PALM_ROW.slots * 2);
  const low = roadsidePalms(18);

  it("uses every slot at full count and an even subset below it", () => {
    expect(palmSlots(PALM_ROW.slots)).toEqual(Array.from({ length: PALM_ROW.slots }, (_, i) => i));
    const subset = palmSlots(9);
    expect(subset).toHaveLength(9);
    expect(new Set(subset).size).toBe(9);
    for (const slot of subset) {
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(PALM_ROW.slots);
    }
    expect(full.streamed).toHaveLength(PALM_ROW.slots * 2);
    expect(low.streamed).toHaveLength(18);
  });

  it("is deterministic", () => {
    expect(roadsidePalms(28)).toEqual(roadsidePalms(28));
  });

  it("plants every streamed palm on sand, right along the road", () => {
    for (const palm of [...full.streamed, ...low.streamed]) {
      const side = Math.sign(palm.x);
      const x = Math.abs(palm.x);
      expect(x).toBeGreaterThanOrEqual(PALM_ROW.minX);
      expect(x).toBeLessThanOrEqual(PALM_ROW.maxX);
      expect(x - PALM_FOOT).toBeGreaterThan(RAIL_X);
      expect(x + PALM_FOOT).toBeLessThan(shorelineX(palm.z0, side));
    }
  });

  it("brings every palm in exactly on top of its twin, so none grows or pops", () => {
    for (const palm of full.streamed) {
      const twin = full.twins.find((t) => t.window.zFront === palm.window.zFront && Math.sign(t.x) === Math.sign(palm.x));
      expect(twin).toBeDefined();
      if (!twin) continue;
      expect(twin.z0).toBe(palm.window.zFront);
      expect([twin.x, twin.rotation, twin.scale, twin.variant, twin.lean]).toEqual([
        palm.x,
        palm.rotation,
        palm.scale,
        palm.variant,
        palm.lean,
      ]);
      expect(palm.window.zBack - palm.window.zFront).toBe(ROADSIDE_LENGTH);
      // Entering the window: the streamed palm stands where its twin does.
      const distance = palm.window.zFront - palm.z0;
      expect(wrapZ(palm.z0 + distance, palm.window)).toBeCloseTo(twin.z0, 9);
    }
  });

  it("stands the twins in a grove on the city beach, between the waterline and the seawall", () => {
    expect(full.twins).toHaveLength(PALM_ROW.twins * 2);
    for (const twin of full.twins) {
      expect(twin.z0).toBeLessThan(CITY.waterline - 1);
      expect(twin.z0).toBeGreaterThan(CITY.beachTo + 1);
    }
  });

  it("gives each side every palm shape", () => {
    for (const side of [-1, 1]) {
      const shapes = new Set(full.twins.filter((t) => Math.sign(t.x) === side).map((t) => t.variant));
      expect(shapes.size).toBe(PALM_ROW.twins);
    }
  });
});

describe("lifeguard towers and pier", () => {
  const palms = roadsidePalms(PALM_ROW.slots * 2).streamed;
  const towers = TOWERS.map((tower) => ({ ...tower, z0: gapZ(tower.gap, tower.side) }));

  it("keeps every tower on the sand, its ramp clear of the lamps", () => {
    for (const tower of towers) {
      expect(TOWER_X + TOWER_REACH.seaward + 0.5).toBeLessThan(shorelineX(tower.z0, tower.side));
      expect(TOWER_X - TOWER_REACH.inland).toBeGreaterThan(LAMP.x + 0.4);
    }
  });

  it("starts the pier on the beach and runs it out over the water", () => {
    const { z0, x0 } = pierPlacement();
    const shore = shorelineX(z0, 1);
    expect(x0).toBeLessThan(shore);
    expect(x0 + PIER.length).toBeGreaterThan(shore + 40);
    // The ramp and its landing slab sit on the sand, clear of the lamp poles.
    expect(x0 - PIER.rampRun - PIER.slab).toBeGreaterThan(LAMP.x + 0.4);
    expect(x0 - PIER.rampRun - PIER.slab).toBeGreaterThan(CURB_OUTER);
  });

  it("keeps palms clear of the towers and the pier on the same side", () => {
    const blockers = [
      ...towers.map((tower) => ({ side: tower.side, z0: tower.z0, half: TOWER_REACH.halfDepth })),
      { side: 1, z0: pierPlacement().z0, half: PIER.width / 2 },
    ];
    for (const blocker of blockers) {
      for (const palm of palms) {
        if (Math.sign(palm.x) !== blocker.side) continue;
        expect(loopGap(palm.z0, blocker.z0)).toBeGreaterThan(blocker.half + PROP_CLEARANCE);
      }
    }
  });

  it("never puts two of them in the same gap", () => {
    const gaps = [...TOWERS.map((tower) => `${tower.side}:${tower.gap}`), `1:${PIER.gap}`];
    expect(new Set(gaps).size).toBe(gaps.length);
  });
});

describe("lamps", () => {
  const lamps = lampPlacements();

  it("alternate sides every half period and fill the window", () => {
    expect(lamps).toHaveLength(ROADSIDE_LENGTH / (LAMP.spacing / 2));
    lamps.forEach((lamp, i) => {
      expect(lamp.side).toBe(i % 2 === 0 ? -1 : 1);
      expect(Math.abs(lamp.x)).toBe(LAMP.x);
    });
  });

  it("stand where the road shader's lamp phase puts them, however far the car has driven", () => {
    for (const distance of [0, 17.3, 250, 9876.5]) {
      for (const lamp of lamps) {
        const z = wrapZ(lamp.z0 + distance, ROADSIDE);
        const phase = lampPhase(lamp.side, distance);
        const steps = (z - phase) / LAMP.spacing;
        expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
        expect(phase).toBeGreaterThanOrEqual(ROADSIDE.zFront);
        expect(phase).toBeLessThan(ROADSIDE.zFront + LAMP.spacing);
      }
    }
  });
});

describe("groundShadow", () => {
  it("throws the shadow away from the sun", () => {
    const toSun = { x: -0.15, y: 0.16, z: -0.975 };
    const shadow = groundShadow(toSun, 10);
    expect(shadow.x).toBeGreaterThan(0);
    expect(shadow.z).toBeGreaterThan(0.9);
    expect(Math.hypot(shadow.x, shadow.z)).toBeCloseTo(1);
    expect(Math.sin(shadow.yaw)).toBeCloseTo(shadow.x);
    expect(Math.cos(shadow.yaw)).toBeCloseTo(shadow.z);
  });

  it("caps the length of a low sun's shadow and keeps a short one for a high sun", () => {
    expect(groundShadow({ x: 0, y: 0.02, z: -1 }, 10).length).toBe(SHADOW_THROW.max);
    expect(groundShadow({ x: 0, y: 0.98, z: -0.2 }, 10).length).toBe(SHADOW_THROW.min);
  });

  it("throws no shadow under an overhead sun, and never NaN", () => {
    const shadow = groundShadow({ x: 0, y: 1, z: 0 }, 10);
    expect(shadow.length).toBe(0);
    for (const value of Object.values(shadow)) expect(Number.isFinite(value)).toBe(true);
  });
});
