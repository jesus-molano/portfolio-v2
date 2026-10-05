import { Color } from "three";
import { palette } from "@/design/tokens";
import { BILLBOARD_PLOTS, boardSpan, CORNICE, type FrontageBuilding } from "./cityLayout";
import { CAR_POSITION } from "./drive";

/** A board's face: centre, size (m), yaw (the face looks along sin/cos yaw) and tube colour. */
export type Billboard = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  yaw: number;
  color: string;
};

/** A structural box (post, back panel) turned with its board; origin at its centre. */
export type BoardPart = { x: number; y: number; z: number; w: number; h: number; d: number; yaw: number; color: string };

export type BillboardLayout = { boards: Billboard[]; parts: BoardPart[] };

/** Warm or pink tubes, one per board, in order. */
const TUBES = [palette.pink, palette.sodium, palette.magenta, palette.orange];
/** The faces turn toward this point on the causeway, where the camera approaches from. */
const APPROACH = { x: CAR_POSITION.x, z: 20 };
/** Board set back from the host's front edge, so both posts stand on the roof. */
const SETBACK = 2;
/** The frame around the face, and the depth of the back panel. */
const FRAME = 0.35;
const PANEL_DEPTH = 0.5;
/**
 * Gap between the face and the panel behind it. At 300 m the depth buffer
 * resolves about 3 cm; a thinner gap shimmers (z-fighting).
 */
const FACE_GAP = 0.3;

/**
 * Billboards on the avenue rooftops (BILLBOARD_PLOTS), each turned toward
 * the causeway: a dark back panel that frames the face, two posts down to
 * the roof, and the face itself, which shows its text from the atlas.
 */
export function buildBillboards(frontage: FrontageBuilding[]): BillboardLayout {
  const boards: Billboard[] = [];
  const parts: BoardPart[] = [];
  BILLBOARD_PLOTS.forEach((plot, index) => {
    const host = frontage.find((building) => building.billboard === index);
    if (!host) return;
    const { w, h } = plot.board;
    const span = boardSpan(plot);
    const x = (span.minX + span.maxX) / 2;
    const z = host.z + host.d / 2 - SETBACK;
    const yaw = Math.atan2(APPROACH.x - x, APPROACH.z - z);
    const y = plot.bottom + h / 2;
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    boards.push({ x, y, z, w, h, yaw, color: TUBES[index % TUBES.length] });
    const back = PANEL_DEPTH / 2 + FACE_GAP;
    parts.push({
      x: x - forward.x * back,
      y,
      z: z - forward.z * back,
      w: w + FRAME * 2,
      h: h + FRAME * 2,
      d: PANEL_DEPTH,
      yaw,
      color: palette.ink,
    });
    // Posts from the roof up behind the panel to its middle.
    const roof = host.h + CORNICE;
    const postHeight = y - roof;
    for (const s of [-1, 1]) {
      const along = s * w * 0.3;
      parts.push({
        x: x + right.x * along - forward.x * (PANEL_DEPTH + FACE_GAP + 0.3),
        y: roof + postHeight / 2,
        z: z + right.z * along - forward.z * (PANEL_DEPTH + FACE_GAP + 0.3),
        w: 0.5,
        h: postHeight,
        d: 0.5,
        yaw,
        color: palette.asphalt,
      });
    }
  });
  return { boards, parts };
}

/**
 * The boards switch on as the title leaves (HeroStage fades it out by film
 * 0.1), one after another, each with a short stutter before its tubes
 * hold: billboard after billboard. Before that they are unlit glass.
 */
export const NEON_ON = { from: 0.055, step: 0.012, flicker: 0.01, idle: 0.14 } as const;

/** Light level (idle..1) of board `index` at a film progress. */
export function neonLevel(progress: number, index: number): number {
  const t = (progress - NEON_ON.from - index * NEON_ON.step) / NEON_ON.flicker;
  if (t <= 0) return NEON_ON.idle;
  if (t >= 1) return 1;
  const on = (t > 0.15 && t < 0.3) || (t > 0.5 && t < 0.6) || t > 0.8;
  return on ? 1 : NEON_ON.idle;
}

/**
 * Brightest the halo around the letters may be (relative luminance, 0..1).
 * The pale core has to stay clearly brighter than its halo: a light tube
 * such as sodium otherwise blooms into one blur at 250 m.
 */
export const GLOW_LUMINANCE = 0.45;

/** Halo colour of a tube, as a CSS colour: its hue, dimmed to GLOW_LUMINANCE at most. */
export function glowTone(tube: string): string {
  const colour = new Color(tube);
  const luminance = 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
  if (luminance > GLOW_LUMINANCE) colour.multiplyScalar(GLOW_LUMINANCE / luminance);
  return colour.getStyle();
}

/** Approximate advance of a display-font capital, in ems. */
const GLYPH = 0.82;
/** Line height of stacked lines, in ems. */
const LEADING = 1.12;
/** Share of the board the text may fill. */
const FILL = { w: 0.84, h: 0.7 };

/** Spaces where a line may break: never next to a separator such as "·". */
function breakPoints(words: string[]): number[] {
  const points: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const before = words[i - 1];
    const after = words[i];
    if (/^[\p{L}\p{N}]/u.test(after) && /[\p{L}\p{N}]$/u.test(before)) points.push(i);
  }
  return points;
}

/** Font size (ems per board height) a set of lines can take on a board of this aspect. */
function sizeFor(lines: string[], aspect: number): number {
  const longest = Math.max(...lines.map((line) => Array.from(line).length));
  const byWidth = (aspect * FILL.w) / (longest * GLYPH);
  const byHeight = FILL.h / (lines.length === 1 ? 1 : lines.length * LEADING);
  return Math.min(byWidth, byHeight);
}

/**
 * Splits a board's text into one or two lines, whichever lets the letters
 * be larger on a board of `aspect` (width / height). Breaks only between
 * words, never beside a separator ("VUE · NUXT" stays on one line).
 */
export function fitLines(text: string, aspect: number): string[] {
  const words = text.trim().split(/\s+/);
  let best = [words.join(" ")];
  let bestSize = sizeFor(best, aspect);
  for (const point of breakPoints(words)) {
    const lines = [words.slice(0, point).join(" "), words.slice(point).join(" ")];
    const size = sizeFor(lines, aspect);
    if (size > bestSize * 1.05) {
      best = lines;
      bestSize = size;
    }
  }
  return best;
}

/** A board's rectangle in the atlas, in pixels from the top left, and its UVs (v up). */
export type AtlasRect = { x: number; y: number; w: number; h: number; u0: number; v0: number; u1: number; v1: number };

/**
 * Packs one rectangle per board into a texture `width` pixels wide, one
 * row each with the board's aspect, separated by `gutter` pixels so the
 * mipmaps never bleed one board into the next. UVs follow the canvas
 * texture's default flipY: v = 1 is the canvas's top row.
 */
export function packAtlas(sizes: Array<{ w: number; h: number }>, width: number, gutter = 8) {
  const inner = width - gutter * 2;
  let y = gutter;
  const rows = sizes.map((size) => {
    const h = Math.max(1, Math.round((inner * size.h) / size.w));
    const row = { x: gutter, y, w: inner, h };
    y += h + gutter * 2;
    return row;
  });
  const height = y - gutter;
  const rects: AtlasRect[] = rows.map((row) => ({
    ...row,
    u0: row.x / width,
    u1: (row.x + row.w) / width,
    v0: 1 - (row.y + row.h) / height,
    v1: 1 - row.y / height,
  }));
  return { width, height, rects };
}
