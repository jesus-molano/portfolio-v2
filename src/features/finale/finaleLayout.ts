/**
 * Where the finale's live DOM lands on its pre-drawn plates (pure, tested).
 *
 * The plates (public/finale) are drawn by tools/art/finale/build.mjs, which
 * also writes plates.json: the projected marquee board and its rails, the
 * bulb strips and the poster cases, in the plate's own frame units. Every
 * DOM part is placed in those units through container-query widths (cqw),
 * so the page and the plate scale together at any size.
 */
import { createRandom } from "@/features/hero/scene/world";
import plates from "./plates.json";

export type Rect = { x: number; y: number; w: number; h: number };
/** A letter row between two rails: its top and bottom, the letters' baseline and their cap height. */
export type Row = { top: number; bottom: number; base: number; cap: number };
/** A straight line of bulbs: its two ends, the count and the bulb radius. */
export type Strip = { x0: number; x1: number; y: number; n: number; r: number };
export type CaseSlot = { repo: string; frame: Rect; poster: Rect; plate: Rect; pool: Rect };
export type Plate = { width: number; height: number; board: Rect; rows: Row[]; strips: Strip[]; cases: CaseSlot[] };
export type PlateName = "night-wide" | "night-tall" | "dawn-wide" | "dawn-tall";

export const PLATES: Record<PlateName, Plate> = plates;

/**
 * Bebas Neue's advance widths in em, measured in Chromium on the face
 * next/font serves (canvas measureText at 1000 px). A blank tile stands
 * for a space: real marquees leave a full slot between words.
 */
const ADVANCE: Record<string, number> = {
  A: 0.401, B: 0.404, C: 0.383, D: 0.406, E: 0.363, F: 0.344, G: 0.391, H: 0.42, I: 0.192, J: 0.265,
  K: 0.414, L: 0.344, M: 0.538, N: 0.427, O: 0.4, P: 0.386, Q: 0.4, R: 0.403, S: 0.372, T: 0.364,
  U: 0.402, V: 0.382, W: 0.557, X: 0.406, Y: 0.394, Z: 0.362,
  "0": 0.4, "1": 0.4, "2": 0.4, "3": 0.4, "4": 0.4, "5": 0.4, "6": 0.4, "7": 0.4, "8": 0.4, "9": 0.4,
  "·": 0.188, ":": 0.188, "'": 0.188, "!": 0.21, "¡": 0.21, "?": 0.363, "&": 0.417, "-": 0.27, ".": 0.188, ",": 0.188,
};
/** A glyph the table does not know is laid out as wide as an M, so a row can only come out short, never overflow. */
const WIDEST = 0.557;
/** The blank tile between words, in em. */
export const SPACE_ADVANCE = 0.32;
/** Space between two tiles, in em. */
export const TILE_GAP = 0.08;
/** Bebas Neue's cap height, in em. */
export const CAP_HEIGHT = 0.704;

/** Letter kits carry no accents: the letter goes up bare and the accent is a strip of black tape. */
const ACCENTED: Record<string, string> = { Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N" };

export type Tile = {
  /** The letter on the tile ("" for the blank tile between words). */
  glyph: string;
  /** Wears the taped accent. */
  tape: boolean;
  /** Width in em. */
  advance: number;
  /** Each letter hangs a hair crooked: degrees. */
  tilt: number;
  /** And a hair off its rail: em, positive down. */
  drop: number;
};

/**
 * The tiles of one marquee row. The tilt of a tile depends on its row, slot
 * and letter only, so a letter that stays when the row is re-lettered
 * hangs exactly as before.
 */
export function marqueeTiles(text: string, rowSeed: number): Tile[] {
  return Array.from(text.toUpperCase()).map((char, slot) => {
    if (char === " ") return { glyph: "", tape: false, advance: SPACE_ADVANCE, tilt: 0, drop: 0 };
    const glyph = ACCENTED[char] ?? char;
    const random = createRandom(rowSeed * 7919 + slot * 131 + glyph.charCodeAt(0));
    return {
      glyph,
      tape: glyph !== char,
      advance: ADVANCE[glyph] ?? WIDEST,
      // Three decimals: finer is invisible, and every tile ships its numbers in the HTML twice.
      tilt: round((random() - 0.5) * 1.8),
      drop: round((random() - 0.5) * 0.03),
    };
  });
}

/** Width of a row of tiles, in em. */
export function rowWidth(tiles: readonly Tile[]): number {
  if (tiles.length === 0) return 0;
  return tiles.reduce((sum, tile) => sum + tile.advance, 0) + TILE_GAP * (tiles.length - 1);
}

/** The board's free margin on each side, as a share of its width. */
export const BOARD_MARGIN = 0.03;

/**
 * The letter size of each marquee row, in plate units: as tall as the
 * plate's rails ask (`Row.cap`), smaller only if one of the row's texts
 * (its idle text and every text it can be re-lettered to) would not fit
 * the board. `uniform` gives every row the smallest of those sizes, as one
 * letter kit would.
 */
export function fitMarquee(plate: Plate, rows: readonly (readonly string[])[], uniform = false): number[] {
  const room = plate.board.w * (1 - 2 * BOARD_MARGIN);
  const sizes = rows.map((texts, i) => {
    const cap = plate.rows[i]?.cap ?? plate.rows[plate.rows.length - 1].cap;
    const widest = Math.max(...texts.map((text) => rowWidth(marqueeTiles(text, i))));
    return Math.min(cap / CAP_HEIGHT, room / widest);
  });
  if (!uniform) return sizes;
  const smallest = Math.min(...sizes);
  return sizes.map(() => smallest);
}

/** A plate length as a share of the plate's width, in percent (the cqw of a container as wide as the plate). */
export function cq(plate: Plate, units: number): number {
  return Math.round((units / plate.width) * 100 * 1000) / 1000;
}

/** A rectangle as CSS lengths in cqw of a container as wide as the plate. */
export function rectCq(plate: Plate, rect: Rect): { x: number; y: number; w: number; h: number } {
  return { x: cq(plate, rect.x), y: cq(plate, rect.y), w: cq(plate, rect.w), h: cq(plate, rect.h) };
}

export type Bulb = { x: number; y: number; phase: number };

/**
 * The bulbs around a poster case, as percentages of the case's frame,
 * clockwise from the top-left corner: eight along the top and the bottom,
 * eleven down each side (corners shared), 34 in all. `phase` is the bulb's
 * place in a three-step chase, so every third bulb lights together and the
 * light runs round the frame.
 */
export function caseBulbs(across = 8, down = 11, inset = { x: 3.4, y: 2.5 }): Bulb[] {
  const left = inset.x, right = 100 - inset.x, top = inset.y, bottom = 100 - inset.y;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const points: [number, number][] = [];
  for (let k = 0; k < across; k++) points.push([lerp(left, right, k / (across - 1)), top]);
  for (let k = 1; k < down - 1; k++) points.push([right, lerp(top, bottom, k / (down - 1))]);
  for (let k = across - 1; k >= 0; k--) points.push([lerp(left, right, k / (across - 1)), bottom]);
  for (let k = down - 2; k > 0; k--) points.push([left, lerp(top, bottom, k / (down - 1))]);
  return points.map(([x, y], k) => ({ x: round(x), y: round(y), phase: k % 3 }));
}

/**
 * The bulbs of a strip, as percentages of its length, with their place in
 * a four-step chase (one bulb in four lit). `offset` shifts the chase, so
 * the marquee's two strips do not light the same columns together.
 */
export function stripBulbs(count: number, offset = 0): Bulb[] {
  return Array.from({ length: count }, (_, i) => ({
    x: round(count === 1 ? 50 : (i / (count - 1)) * 100),
    y: 50,
    phase: (i + offset) % 4,
  }));
}

/** Where the poster sits in its case, as percentages of the case's frame. */
export function posterInset(slot: CaseSlot): Rect {
  return {
    x: round(((slot.poster.x - slot.frame.x) / slot.frame.w) * 100),
    y: round(((slot.poster.y - slot.frame.y) / slot.frame.h) * 100),
    w: round((slot.poster.w / slot.frame.w) * 100),
    h: round((slot.poster.h / slot.frame.h) * 100),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
