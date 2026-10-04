import { palette } from "@/design/tokens";
import { PALM_SHAPES, type StaticPalm } from "./palmGeometry";
import { createRandom, world } from "./world";

/**
 * The city waterfront, Ocean Drive style: behind the seawall a promenade
 * with palms and lamps, then a row of low hotels in four styles, so no two
 * neighbours look alike:
 * - deco: symmetric facade, stepped crest, central fin with a vertical neon
 *   sign, window hoods and pilasters;
 * - streamline: rounded end, wrap-around bands, ribbon windows, a neon line
 *   along the roof;
 * - tower: taller, a setback top floor, a spire and a rooftop sign;
 * - motel: one or two floors, a striped awning on posts, a rooftop billboard.
 * The row hides the bases of the towers behind it. Deterministic (seeded),
 * world metres.
 */
export const WATERFRONT = {
  /** Top of the city ground (Shore.tsx). */
  groundY: 0.3,
  /** Promenade between the seawall and the hotels. */
  promenadeFrom: -179,
  promenadeTo: -184.5,
  /** Front line of the hotels; some sit up to MAX_SETBACK further back. */
  hotelFront: -185,
  /** Half width of the avenue mouth left free for the road. */
  avenueHalf: 22,
  /** The row stops where the haze swallows it anyway. */
  halfWidth: 250,
  floorHeight: 3.2,
} as const;

export const MAX_SETBACK = 1;
const MAX_DEPTH = 7;

/** Largest tower half depth in cityLayout (d = 6..12). */
export const TOWER_MAX_HALF_DEPTH = 6;

/**
 * An axis-aligned box, origin at its bottom centre, with a colour. Glowing
 * boxes carry an intensity: above 1 the bloom picks them up.
 */
export type Box = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  intensity?: number;
};
/** An upright cylinder, origin at its bottom centre. */
export type Cylinder = { x: number; y: number; z: number; r: number; h: number; color: string };
/** A vertical pane facing +z, origin at its centre; `hotel` indexes `hotels`. */
export type Pane = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  color: string;
  lit: boolean;
  hotel: number;
};

export type HotelStyle = "deco" | "streamline" | "tower" | "motel";
/** A hotel's main body (its roof is at y + h) and its style. */
export type Hotel = Box & { style: HotelStyle };

export type WaterfrontLayout = {
  /** Lit by the scene lights: bodies, crests, fins, bands, awnings, poles. */
  solids: Box[];
  /** Rounded ends and their bands. */
  cylinders: Cylinder[];
  /** Self-lit: neon, shopfronts, billboards, lamp heads. */
  glows: Box[];
  windows: Pane[];
  palms: StaticPalm[];
  hotels: Hotel[];
};

const BODY_COLORS = ["#9fe3d2", "#ffb3cf", "#ffd2a8", "#c7b3ff", "#fff1dd", "#8fd8e8", "#ffc8e8", "#b8f0c8"];
const TRIM_COLORS = ["#fff8f0", "#ffe9f3", "#e9fffa", "#fff3d6"];
const NEON_COLORS = ["#ff4fb0", "#4ff0ff", "#9dffb0", "#ffb347", "#ff7ad9"];
const SHOP_COLOR = "#ffc98a";
const GLASS_COLOR = "#5b4a7a";
const LIT_WINDOW = "#ffe2b0";

/** Neon reads as a hot line; shopfronts glow warm without blowing out to white. */
const NEON_INTENSITY = 2.2;
const SIGN_INTENSITY = 1.6;
const SHOP_INTENSITY = 1.05;
const LAMP_INTENSITY = 2;

type Builder = {
  random: () => number;
  solids: Box[];
  cylinders: Cylinder[];
  glows: Box[];
  windows: Pane[];
};

type Plot = {
  index: number;
  /** +1 east of the avenue, -1 west; the outer end points away from it. */
  side: number;
  x: number;
  w: number;
  d: number;
  front: number;
  body: string;
  accent: string;
  trim: string;
  neon: string;
};

const { groundY: G, floorHeight: F } = WATERFRONT;

function shopfront(b: Builder, x: number, w: number, front: number) {
  if (w < 1.5) return;
  b.glows.push({ x, y: G + 0.25, z: front + 0.06, w, h: 2.1, d: 0.08, color: SHOP_COLOR, intensity: SHOP_INTENSITY });
}

/** Punched windows on floors 1..levels-1, skipping an x range (a fin). */
function punchedWindows(
  b: Builder,
  plot: Plot,
  levels: number,
  span: { left: number; right: number },
  skip?: { from: number; to: number },
) {
  const width = span.right - span.left;
  const bays = Math.max(2, Math.floor(width / 2.3));
  for (let f = 1; f < levels; f++) {
    for (let k = 0; k < bays; k++) {
      const x = span.left + (k + 0.5) * (width / bays);
      if (skip && x > skip.from - 0.6 && x < skip.to + 0.6) continue;
      const lit = b.random() < 0.32;
      b.windows.push({
        x,
        y: G + f * F + 1.5,
        z: plot.front + 0.04,
        w: 1.05,
        h: 1.3,
        color: lit ? LIT_WINDOW : GLASS_COLOR,
        lit,
        hotel: plot.index,
      });
    }
  }
}

function deco(b: Builder, plot: Plot): Hotel {
  const levels = 3 + Math.floor(b.random() * 2);
  const h = levels * F + 0.8;
  const { x, w, d, front } = plot;
  const z = front - d / 2;
  const hotel: Hotel = { x, y: G, z, w, h, d, color: plot.body, style: "deco" };
  b.solids.push(hotel);
  // Stepped crest: three narrowing bands centred on the roof.
  let top = G + h;
  for (const [scale, height, color] of [
    [0.86, 0.6, plot.trim],
    [0.55, 0.6, plot.accent],
    [0.25, 0.9, plot.trim],
  ] as const) {
    b.solids.push({ x, y: top, z, w: w * scale, h: height, d: d * 0.9, color });
    top += height;
  }
  // Central fin above the crest, with a vertical neon sign.
  const finW = 2 + b.random() * 0.8;
  const finH = top - G + 2 + b.random() * 4;
  b.solids.push({ x, y: G, z: front + 0.2, w: finW, h: finH, d: 0.8, color: plot.trim });
  b.glows.push({ x, y: G + h * 0.4, z: front + 0.65, w: 0.45, h: finH - h * 0.4 - 0.6, d: 0.12, color: plot.neon, intensity: NEON_INTENSITY });
  // Pilasters at the corners.
  for (const s of [-1, 1]) {
    b.solids.push({ x: x + s * (w / 2 - 0.2), y: G, z: front + 0.08, w: 0.4, h, d: 0.3, color: plot.accent });
  }
  const left = x - w / 2 + 0.5;
  const right = x + w / 2 - 0.5;
  punchedWindows(b, plot, levels, { left, right }, { from: x - finW / 2, to: x + finW / 2 });
  // A hood over every upper window: the deco "eyebrow".
  for (const pane of b.windows.filter((p) => p.hotel === plot.index)) {
    b.solids.push({ x: pane.x, y: pane.y + pane.h / 2 + 0.08, z: front + 0.3, w: pane.w + 0.5, h: 0.14, d: 0.6, color: plot.trim });
  }
  for (const s of [-1, 1]) {
    const span = w / 2 - finW / 2 - 0.8;
    shopfront(b, x + s * (finW / 2 + 0.3 + span / 2), span, front);
  }
  return hotel;
}

function streamline(b: Builder, plot: Plot): Hotel {
  const levels = 2 + Math.floor(b.random() * 2);
  const h = levels * F + 0.6;
  const { side, w, d, front } = plot;
  const r = d / 2;
  const z = front - d / 2;
  // The body stops short of the outer end, where a cylinder rounds it off.
  const bodyW = w - r;
  const bodyX = plot.x - side * (r / 2);
  const endX = plot.x + side * (w / 2 - r);
  const hotel: Hotel = { x: bodyX, y: G, z, w: bodyW, h, d, color: plot.body, style: "streamline" };
  b.solids.push(hotel);
  b.cylinders.push({ x: endX, y: G, z, r, h, color: plot.body });
  // Wrap-around bands at every floor line and at the roof.
  for (let f = 1; f <= levels; f++) {
    const y = G + f * F - 0.15 + (f === levels ? 0.6 : 0);
    b.solids.push({ x: bodyX, y, z, w: bodyW, h: 0.35, d: d + 0.3, color: plot.accent });
    b.cylinders.push({ x: endX, y, z, r: r + 0.15, h: 0.35, color: plot.accent });
  }
  // Ribbon windows, split into lit and dark runs.
  const runs = 3 + Math.floor(b.random() * 2);
  const ribbon = bodyW * 0.8;
  for (let f = 1; f < levels; f++) {
    for (let k = 0; k < runs; k++) {
      const lit = b.random() < 0.35;
      b.windows.push({
        x: bodyX - ribbon / 2 + (k + 0.5) * (ribbon / runs),
        y: G + f * F + 1.35,
        z: front + 0.04,
        w: ribbon / runs - 0.25,
        h: 1.0,
        color: lit ? LIT_WINDOW : GLASS_COLOR,
        lit,
        hotel: plot.index,
      });
    }
  }
  // Neon line along the roof edge.
  b.glows.push({ x: bodyX, y: G + h + 0.45, z: front + 0.2, w: bodyW * 0.9, h: 0.12, d: 0.12, color: plot.neon, intensity: NEON_INTENSITY });
  shopfront(b, bodyX, bodyW * 0.8, front);
  return hotel;
}

function tower(b: Builder, plot: Plot): Hotel {
  const levels = 5 + Math.floor(b.random() * 2);
  const h = (levels - 1) * F + 0.5;
  const { x, w, d, front } = plot;
  const z = front - d / 2;
  const hotel: Hotel = { x, y: G, z, w, h, d, color: plot.body, style: "tower" };
  b.solids.push(hotel);
  // Setback top floor, a crown block and a spire.
  const topW = w * 0.7;
  b.solids.push({ x, y: G + h, z: z - d * 0.05, w: topW, h: F, d: d * 0.8, color: plot.body });
  b.solids.push({ x, y: G + h + F, z: z - d * 0.05, w: w * 0.4, h: 1.2, d: d * 0.5, color: plot.trim });
  b.solids.push({ x, y: G + h + F + 1.2, z: z - d * 0.05, w: 0.35, h: 5 + b.random() * 3, d: 0.35, color: plot.trim });
  // Rooftop sign on the setback terrace.
  b.glows.push({ x, y: G + h + 0.4, z: front - 0.5, w: topW * 0.85, h: 1.3, d: 0.15, color: plot.neon, intensity: SIGN_INTENSITY });
  // Three vertical piers.
  for (const s of [-1, 0, 1]) {
    b.solids.push({ x: x + s * (w / 2 - 0.25) * (s === 0 ? 0 : 1), y: G, z: front + 0.08, w: 0.45, h, d: 0.3, color: plot.accent });
  }
  punchedWindows(b, plot, levels - 1, { left: x - w / 2 + 0.6, right: x + w / 2 - 0.6 }, { from: x - 0.3, to: x + 0.3 });
  shopfront(b, x, w * 0.75, front);
  return hotel;
}

function motel(b: Builder, plot: Plot): Hotel {
  const levels = 1 + Math.floor(b.random() * 2);
  const h = levels * F + 0.6;
  const { x, w, d, front } = plot;
  const z = front - d / 2;
  const hotel: Hotel = { x, y: G, z, w, h, d, color: plot.body, style: "motel" };
  b.solids.push(hotel);
  // Striped awning on posts along the front.
  const stripes = Math.max(4, Math.round(w / 1.4));
  for (let k = 0; k < stripes; k++) {
    b.solids.push({
      x: x - w / 2 + (k + 0.5) * (w / stripes),
      y: G + 2.65,
      z: front + 0.9,
      w: w / stripes,
      h: 0.22,
      d: 1.8,
      color: k % 2 === 0 ? plot.accent : plot.trim,
    });
  }
  for (let px = x - w / 2 + 0.4; px <= x + w / 2 - 0.3; px += 4) {
    b.solids.push({ x: px, y: G, z: front + 1.7, w: 0.14, h: 2.65, d: 0.14, color: plot.trim });
  }
  // Rooftop billboard on two posts.
  const panelW = w * 0.45;
  for (const s of [-1, 1]) {
    b.solids.push({ x: x + s * panelW * 0.35, y: G + h, z: z, w: 0.2, h: 2.4, d: 0.2, color: palette.asphalt });
  }
  b.glows.push({ x, y: G + h + 1.6, z: z + 0.15, w: panelW, h: 1.8, d: 0.15, color: plot.neon, intensity: SIGN_INTENSITY });
  if (levels > 1) punchedWindows(b, plot, levels, { left: x - w / 2 + 0.5, right: x + w / 2 - 0.5 });
  shopfront(b, x, w * 0.85, front);
  return hotel;
}

const BUILD: Record<HotelStyle, (b: Builder, plot: Plot) => Hotel> = { deco, streamline, tower, motel };
const STYLE_WEIGHTS: Array<[HotelStyle, number]> = [
  ["deco", 0.35],
  ["streamline", 0.25],
  ["tower", 0.15],
  ["motel", 0.25],
];
const WIDTH: Record<HotelStyle, [number, number]> = {
  deco: [12, 18],
  streamline: [14, 20],
  tower: [9, 13],
  motel: [14, 21],
};

export function buildWaterfront(seed = 1985): WaterfrontLayout {
  const random = createRandom(seed);
  const b: Builder = { random, solids: [], cylinders: [], glows: [], windows: [] };
  const palms: StaticPalm[] = [];
  const hotels: Hotel[] = [];
  const pick = <T>(list: readonly T[], not?: T) => {
    for (let tries = 0; tries < 4; tries++) {
      const value = list[Math.floor(random() * list.length)];
      if (value !== not) return value;
    }
    return list.find((value) => value !== not) ?? list[0];
  };
  const pickStyle = (not?: HotelStyle): HotelStyle => {
    for (let tries = 0; tries < 4; tries++) {
      let roll = random();
      for (const [style, weight] of STYLE_WEIGHTS) {
        roll -= weight;
        if (roll <= 0) {
          if (style !== not) return style;
          break;
        }
      }
    }
    return not === "deco" ? "motel" : "deco";
  };

  for (const side of [-1, 1]) {
    let edge = WATERFRONT.avenueHalf;
    let previousStyle: HotelStyle | undefined;
    let previousBody: string | undefined;
    for (let n = 0; ; n++) {
      // Towers flank the avenue mouth and frame the sun.
      const style = n === 0 ? "tower" : pickStyle(previousStyle);
      const [minW, maxW] = WIDTH[style];
      const w = minW + random() * (maxW - minW);
      if (edge + w > WATERFRONT.halfWidth) break;
      const body = pick(BODY_COLORS, previousBody);
      const plot: Plot = {
        index: hotels.length,
        side,
        x: side * (edge + w / 2),
        w,
        d: 5.5 + random() * (MAX_DEPTH - 5.5),
        front: WATERFRONT.hotelFront - (random() < 0.3 ? MAX_SETBACK : 0),
        body,
        accent: pick(BODY_COLORS, body),
        trim: pick(TRIM_COLORS),
        neon: pick(NEON_COLORS),
      };
      hotels.push(BUILD[style](b, plot));
      previousStyle = style;
      previousBody = body;
      edge += w + 2 + random() * 4;
    }

    // Promenade palms and lamps, alternating, clear of the avenue mouth.
    const rowZ = (WATERFRONT.promenadeFrom + WATERFRONT.promenadeTo) / 2;
    for (let px = WATERFRONT.avenueHalf - 6; px < WATERFRONT.halfWidth; px += 7) {
      const x = side * (px + (random() - 0.5) * 1.5);
      const isPalm = Math.round(px / 7) % 2 === 0;
      if (isPalm) {
        palms.push({
          x,
          y: G - 0.1,
          z: rowZ + (random() - 0.5) * 1.2,
          rotation: random() * Math.PI * 2,
          scale: 0.6 + random() * 0.25,
          variant: Math.floor(random() * PALM_SHAPES.length),
        });
      } else {
        b.solids.push({ x, y: G, z: rowZ - 1.5, w: 0.16, h: 4.2, d: 0.16, color: palette.asphalt });
        b.glows.push({ x, y: G + 4.2, z: rowZ - 1.5, w: 0.42, h: 0.42, d: 0.42, color: palette.sodium, intensity: LAMP_INTENSITY });
      }
    }
  }

  return { solids: b.solids, cylinders: b.cylinders, glows: b.glows, windows: b.windows, palms, hotels };
}

/** The skyline must start behind the hotel row (towers never cut through it). */
export function towersClearHotels(hotels: Box[]): boolean {
  const deepestBack = Math.min(...hotels.map((h) => h.z - h.d / 2));
  return world.skyline.zNear + TOWER_MAX_HALF_DEPTH < deepestBack;
}
