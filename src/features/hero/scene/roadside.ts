import { palette } from "@/design/tokens";
import { ROADSIDE, ROADSIDE_LENGTH, type StreamWindow } from "./drive";
import { PALM_SHAPES } from "./palmGeometry";
import { createRandom, world } from "./world";

/**
 * The causeway's roadside, Rickenbacker / Overseas Highway style: a narrow
 * strip of sand on each side of the road with the palms right along it and
 * the water just beyond, lamps on the rail, lifeguard towers and a pier.
 * Pure layout (world metres), shared by the scene parts and the tests.
 *
 * Streamed coordinates: a prop at `z0` stands at
 * `wrapZ(z0 + drive.distance, window)`, and the ground shaders draw their
 * patterns at `worldZ - drive.distance`. The shoreline is periodic over
 * ROADSIDE_LENGTH in that coordinate, so a prop always stands on the same
 * sand, however far the car has driven.
 */

/**
 * The city island: a narrow beach facing us, from the seawall at `beachTo`
 * to its mean waterline at `waterline`, a seawall with a gap for the road,
 * then the waterfront (Waterfront.tsx) and paved ground under the skyline
 * (which starts at z = -199).
 */
export const CITY = { beachTo: -176, groundTo: -340, width: 720, waterline: -161.5 } as const;
/** Half width of the opening the road needs through the seawall and promenade. */
export const ROAD_GAP = world.road.width / 2 + 1.5;

/** Outer face of the curb: the sand starts here. */
export const CURB_OUTER = world.road.width / 2 + 0.6;
/** Guardrail on the curb line, beam facing the road. */
export const RAIL_X = world.road.width / 2 + 0.9;

/** Street lights: the pole just outside the rail, the arm over the outer lane. */
export const LAMP = {
  x: RAIL_X + 0.7,
  /** Along one side; the two sides alternate, so a lamp every 22 m. */
  spacing: 44,
  poleHeight: 8.2,
  arm: 2.8,
} as const;
/** Centre of a lamp head, |x| and height above the ground. */
export const LAMP_HEAD = { x: LAMP.x - (LAMP.arm - 0.25), y: LAMP.poleHeight - 0.22 } as const;

/**
 * Metres of sand from the curb to the waterline. Each wave is a whole
 * number of cycles over ROADSIDE_LENGTH (periodic in the streamed z); the
 * right strip runs out of phase with the left one. Near the landfall the
 * strips flare out into the city beach; the flare is fixed in world z, like
 * the city.
 */
export const SHORE = {
  mean: 10.6,
  waves: [
    { amplitude: 1.1, cycles: 3, phase: 0.6 },
    { amplitude: 0.5, cycles: 7, phase: 2.2 },
  ],
  sidePhase: [0, 2.4],
  flare: { from: -128, to: ROADSIDE.zFront, extra: 14 },
} as const;

export const SHORE_MIN = SHORE.mean - SHORE.waves.reduce((sum, wave) => sum + wave.amplitude, 0);
export const SHORE_MAX = SHORE.mean + SHORE.waves.reduce((sum, wave) => sum + wave.amplitude, 0);

/** Phase of each wave on one side (+1 right, -1 left), as the sand shader reads it. */
export function shorePhases(side: number): [number, number] {
  const offset = SHORE.sidePhase[side > 0 ? 1 : 0];
  return [SHORE.waves[0].phase + offset, SHORE.waves[1].phase + offset * 1.7];
}

/** Angular frequency of each wave, radians per metre of streamed z. */
export function shoreFrequencies(): [number, number] {
  return [
    (SHORE.waves[0].cycles * 2 * Math.PI) / ROADSIDE_LENGTH,
    (SHORE.waves[1].cycles * 2 * Math.PI) / ROADSIDE_LENGTH,
  ];
}

/** Sand from the curb to the waterline at streamed z `zs`, without the flare. */
export function shoreDistance(zs: number, side: number): number {
  const [f0, f1] = shoreFrequencies();
  const [p0, p1] = shorePhases(side);
  return (
    SHORE.mean +
    SHORE.waves[0].amplitude * Math.sin(f0 * zs + p0) +
    SHORE.waves[1].amplitude * Math.sin(f1 * zs + p1)
  );
}

/** Extra sand near the landfall at world z (0 along the open causeway). */
export function shoreFlare(z: number): number {
  const { from, to, extra } = SHORE.flare;
  // smoothstep(to, from, z), flipped: 1 at the landfall, 0 from `from` on.
  const t = Math.min(1, Math.max(0, (z - to) / (from - to)));
  return extra * (1 - t * t * (3 - 2 * t));
}

/** |x| of the waterline at streamed z `zs` (open causeway, no flare). */
export function shorelineX(zs: number, side: number): number {
  return CURB_OUTER + shoreDistance(zs, side);
}

/**
 * Palm rows: trunks between ROW.minX and ROW.maxX from the road axis. Never
 * nearer: no camera may come within ~8 m of a trunk (shots.test.ts), and in
 * the tracking shot the foot of a nearer palm would sit on his head. Never
 * further: every trunk keeps its feet on sand at the narrowest strip.
 */
export const PALM_ROW = {
  minX: 14,
  maxX: 15.6,
  /** Slots along one side over ROADSIDE_LENGTH; a lower tier uses a subset. */
  slots: 14,
  /** Distinct palms per side; each comes in behind its own static twin. */
  twins: 4,
  /** z between twins in the grove on the city beach. */
  twinSpacing: 3,
} as const;

export type RoadsidePalm = {
  x: number;
  /** Streamed z; for a twin, its fixed world z. */
  z0: number;
  rotation: number;
  scale: number;
  variant: number;
  /** Small lean so the row does not look stamped. */
  lean: number;
  /** The palm wraps in this window; its far edge is where its twin stands. */
  window: StreamWindow;
};

const SLOT = ROADSIDE_LENGTH / PALM_ROW.slots;

/** Streamed z of slot `i` on one side; the right row sits half a slot ahead. */
function slotZ(i: number, side: number): number {
  return ROADSIDE.zFront + (i + (side > 0 ? 0.25 : 0.75)) * SLOT;
}

/**
 * The distinct palms of one side, each with its own window. A palm enters
 * its window at the far edge with full size, exactly where its static twin
 * stands in the grove at the landfall, so nothing grows or pops at the end
 * of the causeway: palms leave the grove one by one.
 */
function appearances(side: number): Omit<RoadsidePalm, "z0">[] {
  const random = createRandom(side > 0 ? 271 : 99);
  return Array.from({ length: PALM_ROW.twins }, (_, k) => {
    const zFront = ROADSIDE.zFront - k * PALM_ROW.twinSpacing;
    return {
      x: side * (PALM_ROW.minX + random() * (PALM_ROW.maxX - PALM_ROW.minX)),
      rotation: random() * Math.PI * 2,
      // The procedural palms are built at real size (8-12.5 m).
      scale: 0.88 + random() * 0.27,
      // Every shape once per side, in a different order on each side.
      variant: (k + (side > 0 ? 2 : 0)) % PALM_SHAPES.length,
      lean: (random() - 0.5) * 0.1,
      window: { zFront, zBack: zFront + ROADSIDE_LENGTH },
    };
  });
}

/** Which slots a row of `perSide` palms uses: spread evenly over the full set. */
export function palmSlots(perSide: number): number[] {
  const n = Math.max(1, Math.min(PALM_ROW.slots, Math.round(perSide)));
  return Array.from({ length: n }, (_, i) => Math.floor((i * PALM_ROW.slots) / n));
}

/**
 * `count` streamed palms (half per side) and the static twins in the grove
 * at the landfall. Deterministic.
 */
export function roadsidePalms(count: number): { streamed: RoadsidePalm[]; twins: RoadsidePalm[] } {
  const streamed: RoadsidePalm[] = [];
  const twins: RoadsidePalm[] = [];
  for (const side of [-1, 1]) {
    const looks = appearances(side);
    const jitter = createRandom(side > 0 ? 5 : 3);
    for (const slot of palmSlots(count / 2)) {
      const look = looks[slot % looks.length];
      streamed.push({ ...look, z0: slotZ(slot, side) + (jitter() - 0.5) * 0.3 * SLOT });
    }
    for (const look of looks) twins.push({ ...look, z0: look.window.zFront });
  }
  return { streamed, twins };
}

/** Streamed z halfway between slots `i` and `i + 1` of a side: clear of every palm. */
export function gapZ(i: number, side: number): number {
  return slotZ(i, side) + SLOT / 2;
}

/** Lifeguard towers, Miami Beach style, in the gaps of the palm rows. */
export const TOWERS = [
  { side: -1, gap: 2, body: "#9fe3d2", trim: "#ff8fb8" },
  { side: 1, gap: 6, body: "#ffb3cf", trim: "#7fd8e8" },
  { side: -1, gap: 9, body: "#ffd99a", trim: "#b08cff" },
  { side: 1, gap: 12, body: "#c7b3ff", trim: palette.sodium },
] as const;
/** The tower's centre from the road axis; it spans x - 3.8 (ramp foot) to x + 1.6 (deck). */
export const TOWER_X = 14.8;
export const TOWER_REACH = { inland: 3.8, seaward: 1.6, halfDepth: 1.4, height: 5.9 } as const;

/**
 * The pier, on the right: the deck starts PIER.onSand metres inland of the
 * waterline and a ramp brings it down to the sand, so it always starts on
 * the beach.
 */
export const PIER = {
  gap: 4,
  length: 60,
  width: 3.6,
  deckY: 1.05,
  rampRun: 3.5,
  slab: 1.2,
  onSand: 2.5,
} as const;

/** Streamed z and deck start x of the pier. */
export function pierPlacement(): { z0: number; x0: number } {
  const z0 = gapZ(PIER.gap, 1);
  return { z0, x0: shorelineX(z0, 1) - PIER.onSand };
}

/** Lamps along the causeway: alternating sides, every LAMP.spacing / 2 metres. */
export function lampPlacements(): Array<{ x: number; z0: number; side: number }> {
  const list: Array<{ x: number; z0: number; side: number }> = [];
  const step = LAMP.spacing / 2;
  for (let i = 0; i * step < ROADSIDE_LENGTH; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    list.push({ x: side * LAMP.x, z0: ROADSIDE.zFront + i * step, side });
  }
  return list;
}

/**
 * Streamed z of one lamp on a side, wrapped into one lamp period: the road
 * shader rebuilds the whole row from it (every LAMP.spacing metres).
 */
export function lampPhase(side: number, distance: number): number {
  const first = ROADSIDE.zFront + (side > 0 ? LAMP.spacing / 2 : 0);
  const period = LAMP.spacing;
  return ((((first + distance - ROADSIDE.zFront) % period) + period) % period) + ROADSIDE.zFront;
}

/**
 * How far a prop that rises out of the ground (towers, pier) has come up,
 * 0 at the far edge of the window, 1 RISE metres closer: it comes over the
 * horizon like a ship instead of growing.
 */
export const RISE = 45;

/** Shortest and longest soft shadow a prop throws, in metres. */
export const SHADOW_THROW = { min: 3, max: 13 } as const;

/**
 * The soft shadow a prop of `height` throws on the ground, away from the
 * sun (`toSun`, a unit vector): its unit direction on the ground, the yaw
 * that turns a flat plane's long axis (local y) onto it, and its length. A
 * low sun throws shadows many times longer than the prop; the length is
 * capped so the shadow stays a soft streak and never reads as a line on
 * the road. An overhead sun throws none.
 */
export function groundShadow(
  toSun: { x: number; y: number; z: number },
  height: number,
): { x: number; z: number; yaw: number; length: number } {
  const planar = Math.hypot(toSun.x, toSun.z);
  if (planar < 1e-6) return { x: 0, z: 0, yaw: 0, length: 0 };
  const x = -toSun.x / planar;
  const z = -toSun.z / planar;
  const rise = toSun.y / planar;
  const full = rise > 1e-6 ? height / rise : Number.POSITIVE_INFINITY;
  const length = Math.min(SHADOW_THROW.max, Math.max(SHADOW_THROW.min, full));
  return { x, z, yaw: Math.atan2(x, z), length };
}
