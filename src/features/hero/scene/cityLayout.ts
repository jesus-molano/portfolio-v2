import { Color } from "three";
import { palette } from "@/design/tokens";
import { createRandom, world } from "./world";

/** An axis-aligned block, origin at its bottom center. */
export type Block = { x: number; y: number; z: number; w: number; h: number; d: number };

/** A lit window: position, yaw (0 faces +z, ±PI/2 faces ±x) and color. */
export type Window = { x: number; y: number; z: number; yaw: number; color: Color };

/** A neon strip: a thin emissive block. */
export type Strip = Block & { color: Color };

/**
 * A building that lines the avenue, on the west (-1) or the east (+1)
 * side; `billboard` indexes BILLBOARD_PLOTS when one stands on its roof.
 */
export type FrontageBuilding = Block & { side: -1 | 1; billboard?: number };

export type CityLayout = {
  blocks: Block[];
  windows: Window[];
  strips: Strip[];
  /** The bodies of the avenue buildings, each side in order from the waterfront. */
  frontage: FrontageBuilding[];
};

/** An xz rectangle the skyline keeps clear of. */
export type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * The avenue the causeway runs into: a street canyon from behind the
 * waterfront hotels (backs no deeper than z -193) to a plaza at the foot of
 * the landmark. Buildings line it at `halfWidth` from the axis: the road's
 * 8 m, its curb and a 4.4 m sidewalk.
 */
export const AVENUE = {
  halfWidth: 13,
  /** Front of the first avenue building, just behind the hotel row. */
  zFrom: -197,
  /** End of the canyon: the plaza starts here and the road ends on it. */
  zTo: -282,
} as const;

/** Where the city sees the sun from (its light and rims): the middle of the avenue. */
export const CITY_CENTRE = { x: 0, y: 0, z: -250 } as const;

/** Ground kept free of towers for the plaza and the landmark (landmarkLayout.ts). */
export const LANDMARK_SITE: Footprint = { minX: -30, maxX: 30, minZ: -345, maxZ: AVENUE.zTo };

/**
 * Rooftop billboards (Billboards.tsx), in the order of `hero.billboards`.
 * Each stands on its own avenue building, and its bottom is high enough to
 * clear, from the causeway, the hotel towers at the avenue mouth and the
 * boards in front of it on the same side (billboardLayout.test.ts casts
 * the rays): the boards climb the canyon one after another. The west side
 * carries one low board only: higher up on that side the boards would
 * cover the sun.
 */
export const BILLBOARD_PLOTS = [
  { side: -1, z: -205, length: 15, board: { w: 24, h: 12 }, bottom: 20 },
  { side: 1, z: -226, length: 15, board: { w: 26, h: 11 }, bottom: 25.5 },
  { side: 1, z: -250, length: 14, board: { w: 26, h: 8 }, bottom: 41.5 },
  { side: 1, z: -273, length: 14, board: { w: 28, h: 8 }, bottom: 55 },
] as const;

/** Height between a host's body and its board: the cornice, then the posts. */
export const BILLBOARD_POST = 3;

/**
 * Where the city is seen from on its axis: the rear shot and the end of the
 * crane (shots.ts; the city test keeps them in sync). Avenue buildings stay
 * below the line from these eyes to the boards behind them.
 */
export const CITY_EYES = [
  { y: 2.7, z: 12.2 },
  { y: 18, z: 36 },
] as const;

const WINDOW_W = 0.7;
const WINDOW_H = 1.0;
const FLOOR_H = 2.3;
const BAY_W = 1.7;
/**
 * Windows stand this far off their facade: at 300 m the depth buffer
 * resolves about 3 cm, and a thinner gap shimmers.
 */
const WINDOW_PROUD = 0.12;
/** Top of the city ground (Shore.tsx). */
const GROUND_Y = 0.3;
/** Deco cornice on every avenue building. */
export const CORNICE = 0.8;

/** Avenue plots: lengths along the avenue, the alleys between them, depths away from it. */
const PLOT = { length: [8, 14], alley: [1.6, 3.6], depth: [12, 18] } as const;
/** The canyon rises toward the landmark: height at the waterfront end and at the plaza. */
const CANYON = { from: 15, to: 44, jitter: 7, min: 9 } as const;

// Dusk: a few early lights, warm, with the odd pink or cool one.
const WARM = new Color("#ffe6b3");
const CYAN = new Color("#bff4ff");
const PINK = new Color(palette.pink);
const WHITE = new Color("#fff8ea");
const WINDOW_PALETTE = [WARM, WARM, WARM, WHITE, PINK, CYAN];
const STRIP_PALETTE = [PINK, new Color(palette.magenta), new Color("#ffb6e0")];
/** Shopfronts glow warm; blade signs over the sidewalk are neon. */
const SHOP_PALETTE = [new Color(palette.sodium), new Color(palette.sodium), new Color(palette.amber), PINK];
const BLADE_PALETTE = [PINK, new Color(palette.magenta), new Color(palette.cyan), new Color(palette.sodium)];

export function overlaps(a: Footprint, b: Footprint): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function footprintOf(block: Block, margin = 0): Footprint {
  return {
    minX: block.x - block.w / 2 - margin,
    maxX: block.x + block.w / 2 + margin,
    minZ: block.z - block.d / 2 - margin,
    maxZ: block.z + block.d / 2 + margin,
  };
}

/** Gap between the building line and a billboard's inner end. */
const BOARD_INSET = 0.5;

/** Where a billboard spans across the avenue (x), standing on its plot. */
export function boardSpan(plot: (typeof BILLBOARD_PLOTS)[number]): { minX: number; maxX: number } {
  const inner = AVENUE.halfWidth + BOARD_INSET;
  const outer = inner + plot.board.w;
  return plot.side > 0 ? { minX: inner, maxX: outer } : { minX: -outer, maxX: -inner };
}

/**
 * Highest a building spanning `minX`..`maxX` with its front at `zFront`
 * may reach without hiding a billboard behind it from the city eyes: the
 * line from each eye to the board's bottom, where it crosses the building.
 * The eyes sit near the avenue axis; the board's wedge gets 2 m of margin.
 */
export function sightCap(minX: number, maxX: number, zFront: number): number {
  let cap = Number.POSITIVE_INFINITY;
  for (const plot of BILLBOARD_PLOTS) {
    if (plot.z >= zFront) continue;
    const span = boardSpan(plot);
    for (const eye of CITY_EYES) {
      const t = (eye.z - zFront) / (eye.z - plot.z);
      if (maxX < span.minX * t - 2 || minX > span.maxX * t + 2) continue;
      cap = Math.min(cap, eye.y + (plot.bottom - eye.y) * t - 0.5);
    }
  }
  return cap;
}

/**
 * The buildings that line the avenue, both sides, from the waterfront to
 * the plaza. Billboard hosts sit where BILLBOARD_PLOTS says, deep enough
 * for the whole board; random plots fill the rest, separated by alleys,
 * rising toward the landmark.
 */
export function buildFrontage(seed = 1986): FrontageBuilding[] {
  const random = createRandom(seed);
  const range = (span: readonly [number, number]) => span[0] + random() * (span[1] - span[0]);
  const buildings: FrontageBuilding[] = [];

  for (const side of [-1, 1] as const) {
    const hosts = BILLBOARD_PLOTS.map((plot, index) => ({ plot, index }))
      .filter(({ plot }) => plot.side === side)
      .sort((a, b) => b.plot.z - a.plot.z);
    let z: number = AVENUE.zFrom;
    let next = 0;
    while (z > AVENUE.zTo + PLOT.length[0] * 0.6) {
      const host = hosts[next];
      const hostFront = host ? host.plot.z + host.plot.length / 2 : Number.NEGATIVE_INFINITY;
      if (host && z - hostFront < PLOT.length[0] + PLOT.alley[0]) {
        const { plot } = host;
        const depth = plot.board.w + 2;
        buildings.push({
          x: side * (AVENUE.halfWidth + depth / 2),
          y: 0,
          z: plot.z,
          w: depth,
          h: plot.bottom - BILLBOARD_POST,
          d: plot.length,
          side,
          billboard: host.index,
        });
        z = plot.z - plot.length / 2 - range(PLOT.alley);
        next += 1;
        continue;
      }
      // A random plot, up to the next host or the plaza; it takes the
      // whole stretch when what it would leave is too short for a plot.
      const limit = host ? hostFront + PLOT.alley[0] : AVENUE.zTo;
      const room = z - limit;
      let length = Math.min(range(PLOT.length), room);
      if (room - length < PLOT.length[0] + PLOT.alley[1]) length = room;
      const depth = range(PLOT.depth);
      const zFront = z;
      const minX = side > 0 ? AVENUE.halfWidth : -AVENUE.halfWidth - depth;
      const maxX = minX + depth;
      z -= length + range(PLOT.alley);
      if (length < PLOT.length[0] * 0.6) continue;
      const progress = (AVENUE.zFrom - zFront) / (AVENUE.zFrom - AVENUE.zTo);
      const wanted = CANYON.from + (CANYON.to - CANYON.from) * progress + (random() - 0.5) * CANYON.jitter;
      buildings.push({
        x: side * (AVENUE.halfWidth + depth / 2),
        y: 0,
        z: zFront - length / 2,
        w: depth,
        h: Math.max(CANYON.min, Math.min(wanted, sightCap(minX, maxX, zFront) - CORNICE)),
        d: length,
        side,
      });
    }
  }
  return buildings;
}

type Builder = {
  random: () => number;
  blocks: Block[];
  windows: Window[];
  strips: Strip[];
  windowBudget: number;
  stripBudget: number;
};

function pushStrip(b: Builder, strip: Strip) {
  if (b.strips.length < b.stripBudget) b.strips.push(strip);
}

/** Floors that are lit across the building: a share of `rows`. */
function litFloors(b: Builder, rows: number, share: number): Set<number> {
  const lit = new Set<number>();
  for (let r = 0; r < rows; r += 1) if (b.random() < share) lit.add(r);
  return lit;
}

/** Window grid on one face, mostly lit on the lit floors. */
function windowGrid(
  b: Builder,
  face: { yaw: number; cx: number; cz: number; width: number },
  floors: { from: number; rows: number; lit: Set<number> },
) {
  const cols = Math.max(1, Math.floor(face.width / BAY_W));
  for (let r = 0; r < floors.rows; r += 1) {
    const floorLit = floors.lit.has(r);
    for (let c = 0; c < cols; c += 1) {
      const lit = floorLit ? b.random() < 0.75 : b.random() < 0.12;
      if (!lit || b.windows.length >= b.windowBudget) continue;
      const offset = -face.width / 2 + (c + 0.5) * (face.width / cols);
      const y = floors.from + r * FLOOR_H;
      const color = WINDOW_PALETTE[Math.floor(b.random() * WINDOW_PALETTE.length)];
      if (face.yaw === 0) b.windows.push({ x: face.cx + offset, y, z: face.cz, yaw: 0, color });
      else b.windows.push({ x: face.cx, y, z: face.cz + offset, yaw: face.yaw, color });
    }
  }
}

/** Yaw of the face that looks at the avenue from a building on `side`. */
function avenueYaw(side: number): number {
  return side > 0 ? -Math.PI / 2 : Math.PI / 2;
}

/** An avenue building: body, deco cornice, lit shopfronts, a blade sign, windows. */
function frontageBuilding(b: Builder, building: FrontageBuilding, index: number) {
  const { random } = b;
  const { x, z, w, h, d, side } = building;
  const inner = side * AVENUE.halfWidth;
  b.blocks.push({ x, y: 0, z, w, h, d });

  // Cornice, a little proud of the facade on every side.
  const roof = h + CORNICE;
  b.blocks.push({ x, y: h, z, w: w + 0.5, h: CORNICE, d: d + 0.5 });
  // A setback storey away from the avenue, or a rooftop tank, where it
  // hides no billboard.
  const room = sightCap(x - w / 2, x + w / 2, z + d / 2) - roof;
  if (building.billboard === undefined && room > 3.2) {
    if (random() < 0.55) {
      const sw = w * (0.45 + random() * 0.25);
      const sh = Math.min(room, 3 + random() * 6);
      b.blocks.push({ x: x + (side * (w - sw)) / 2, y: roof, z, w: sw, h: sh, d: d * 0.8 });
    } else if (random() < 0.6) {
      b.blocks.push({ x: x + side * w * 0.2, y: roof, z, w: 2.4, h: 3.2, d: 2.4 });
    }
  }

  // Lit ground floor along the sidewalk, one shopfront per bay.
  const shops = Math.max(1, Math.round(d / 6));
  for (let k = 0; k < shops; k += 1) {
    const sz = z + d / 2 - (k + 0.5) * (d / shops);
    const color = SHOP_PALETTE[Math.floor(random() * SHOP_PALETTE.length)];
    pushStrip(b, { x: inner - side * 0.06, y: GROUND_Y + 0.5, z: sz, w: 0.12, h: 3, d: d / shops - 1.2, color });
  }
  // A neon blade sign over the sidewalk on every other building.
  if (index % 2 === 0) {
    const color = BLADE_PALETTE[Math.floor(random() * BLADE_PALETTE.length)];
    const height = Math.min(h - 6.5, 5 + random() * 3);
    if (height > 2.5) {
      pushStrip(b, { x: inner - side * 0.9, y: 5.5, z: z + d / 2 - 1.5, w: 1.4, h: height, d: 0.3, color });
    }
  }

  // Windows on the face toward the causeway and on the avenue face.
  const rows = Math.max(0, Math.floor((h - 6) / FLOOR_H));
  const floors = { from: 5.2, rows, lit: litFloors(b, rows, 0.3) };
  windowGrid(b, { yaw: 0, cx: x, cz: z + d / 2 + WINDOW_PROUD, width: w }, floors);
  windowGrid(b, { yaw: avenueYaw(side), cx: inner - side * WINDOW_PROUD, cz: z, width: d }, floors);
}

/**
 * Deterministic art-deco city: the avenue buildings first, then a skyline
 * of stacked tiers with setbacks, cornices, antennas, neon edge strips and
 * window grids with lit "floors" behind them, clear of the avenue, its
 * buildings and the landmark's plaza. Everything is expressed as instances
 * of three shared geometries.
 */
export function buildCity(
  buildingCount: number,
  windowBudget: number,
  stripBudget: number,
): CityLayout {
  const random = createRandom(2024);
  const { zNear, zFar, halfWidth } = world.skyline;
  const b: Builder = { random, blocks: [], windows: [], strips: [], windowBudget, stripBudget };

  const frontage = buildFrontage();
  frontage.forEach((building, i) => frontageBuilding(b, building, i));

  const reserved: Footprint[] = [
    ...frontage.map((building) => footprintOf(building, 1.5)),
    LANDMARK_SITE,
    { minX: -AVENUE.halfWidth, maxX: AVENUE.halfWidth, minZ: zFar - 20, maxZ: zNear + 20 },
  ];

  for (let i = 0; i < buildingCount; i += 1) {
    let x = 0;
    let z = 0;
    let w = 0;
    let d = 0;
    let side = 1;
    let placed = false;
    for (let attempt = 0; attempt < 16 && !placed; attempt += 1) {
      side = random() < 0.5 ? -1 : 1;
      x = side * (AVENUE.halfWidth + random() * (halfWidth - AVENUE.halfWidth));
      z = zNear + random() * (zFar - zNear);
      w = 6 + random() * 9;
      d = 6 + random() * 6;
      const footprint = footprintOf({ x, y: 0, z, w, h: 1, d });
      placed = !reserved.some((area) => overlaps(footprint, area));
    }
    if (!placed) continue;
    // Never taller than the sightlines to the billboards in front of it allow.
    const cap = sightCap(x - w * 0.56, x + w * 0.56, z + d * 0.56);
    const centerBias = 1 - Math.min(1, Math.abs(x) / halfWidth);
    const baseH = Math.min(cap - 1, 8 + random() * 16 + centerBias * centerBias * random() * 26);
    if (baseH < 6) continue;

    // Tier 1: the body.
    b.blocks.push({ x, y: 0, z, w, h: baseH, d });
    let topY = baseH;
    let topW = w;
    let topD = d;

    // Cornice on the body for the deco look.
    if (random() < 0.45 && topY + 0.9 <= cap) {
      b.blocks.push({ x, y: topY, z, w: w * 1.12, h: 0.9, d: d * 1.12 });
      topY += 0.9;
    }

    // Setback tiers.
    const tiers = random() < 0.65 ? (random() < 0.4 ? 2 : 1) : 0;
    for (let t = 0; t < tiers; t += 1) {
      const tw = topW * (0.55 + random() * 0.25);
      const td = topD * (0.55 + random() * 0.25);
      const th = Math.min(cap - topY, 4 + random() * 10 * (1 - t * 0.4));
      if (th < 2) break;
      b.blocks.push({ x, y: topY, z, w: tw, h: th, d: td });
      topY += th;
      topW = tw;
      topD = td;
    }

    // Antenna or spire.
    if (random() < 0.4) {
      const ah = 3 + random() * 9;
      if (topY + ah <= cap) {
        b.blocks.push({ x, y: topY, z, w: 0.35, h: ah, d: 0.35 });
        if (random() < 0.5) {
          b.blocks.push({ x, y: topY + ah * 0.6, z, w: 1.6, h: 0.2, d: 0.2 });
        }
      }
    }

    // Neon strips on tall bodies: two vertical edges and the top edge.
    if (baseH > 18 && random() < 0.55) {
      const color = STRIP_PALETTE[Math.floor(random() * STRIP_PALETTE.length)];
      const zFront = z + d / 2 + 0.08;
      pushStrip(b, { x: x - w / 2, y: 0.5, z: zFront, w: 0.16, h: baseH - 0.5, d: 0.16, color });
      pushStrip(b, { x: x + w / 2, y: 0.5, z: zFront, w: 0.16, h: baseH - 0.5, d: 0.16, color });
      if (random() < 0.6) {
        pushStrip(b, { x, y: baseH - 0.3, z: zFront, w: w + 0.16, h: 0.16, d: 0.16, color });
      }
    }

    // Window grids on the front face and on the face that looks at the avenue.
    const rows = Math.max(1, Math.floor((baseH - 1.5) / FLOOR_H));
    const floors = { from: 1.6, rows, lit: litFloors(b, rows, 0.22) };
    windowGrid(b, { yaw: 0, cx: x, cz: z + d / 2 + WINDOW_PROUD, width: w }, floors);
    windowGrid(b, { yaw: avenueYaw(side), cx: x - side * (w / 2 + WINDOW_PROUD), cz: z, width: d }, floors);
  }

  return { blocks: b.blocks, windows: b.windows, strips: b.strips, frontage };
}

export const windowSize = { w: WINDOW_W, h: WINDOW_H };
