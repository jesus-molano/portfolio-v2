/**
 * The chapter word's face (ChapterCard.tsx): Chapter Script, our subset of
 * Mr Dafoe (src/app/fonts). Pure and tested: everything comes from
 * scriptMetrics.json, which tools/chapter/fonts.py reads out of the very
 * woff2 the page loads, so a word is laid out here exactly as the browser
 * sets it (the face has no ligatures or contextual forms, only kerning).
 */
import metrics from "./scriptMetrics.json";

/** A character with ink: its advance, its box, its first column and the lowest point of its ink in each column. */
type InkGlyph = readonly [advance: number, xMin: number, yMin: number, xMax: number, yMax: number, first: number, lows: readonly (number | null)[]];
/** A character: an inked one, or a space (its advance alone). */
type Glyph = readonly [advance: number] | InkGlyph;

const inked = (glyph: Glyph): glyph is InkGlyph => glyph.length > 1;

const GLYPHS = metrics.glyphs as unknown as Readonly<Record<string, Glyph>>;
const KERN = metrics.kern as Readonly<Record<string, number>>;
const UPM = metrics.unitsPerEm;
/** The width of an ink column, in font units. */
const COLUMN = metrics.column;

/** The face's ascender and descender, in em (the box the browser gives a line of it). */
export const SCRIPT_FACE = { ascender: metrics.ascender / UPM, descender: -metrics.descender / UPM } as const;

/** The checked-in woff2 the metrics were read from, and its SHA-256. */
export const SCRIPT_FILE = { path: metrics.font, sha256: metrics.sha256 } as const;

/** The characters of a word the face does not have. */
export function missingScript(word: string): string[] {
  return [...new Set(Array.from(word).filter((char) => !(char in GLYPHS)))];
}

export type ScriptRun = {
  /** Where each character's pen starts, in em. */
  pens: number[];
  /** The pen's travel over the whole word, word spacing included: the browser's advance width. */
  advance: number;
  /** The ink's extent, in em from the pen's start (left may be negative: a swash reaches back). */
  left: number;
  right: number;
  /** How far the ink rises over the baseline and falls under it, in em. */
  ascent: number;
  descent: number;
};

/** A word's run: kerned, with `wordSpace` em added to every space (CSS word-spacing). */
export function scriptRun(word: string, wordSpace = 0): ScriptRun {
  const missing = missingScript(word);
  if (missing.length > 0) throw new Error(`scriptRun: Chapter Script has no ${missing.join(" ")} for "${word}"`);
  const chars = Array.from(word);
  const pens: number[] = [];
  let pen = 0;
  let left = Infinity;
  let right = -Infinity;
  let ascent = 0;
  let descent = 0;
  chars.forEach((char, i) => {
    const glyph = GLYPHS[char];
    pens.push(pen);
    if (inked(glyph)) {
      const [, xMin, yMin, xMax, yMax] = glyph;
      left = Math.min(left, pen + xMin / UPM);
      right = Math.max(right, pen + xMax / UPM);
      ascent = Math.max(ascent, yMax / UPM);
      descent = Math.max(descent, -yMin / UPM);
    }
    pen += glyph[0] / UPM + (char === " " ? wordSpace : 0);
    const next = chars[i + 1];
    if (next !== undefined) pen += (KERN[char + next] ?? 0) / UPM;
  });
  return { pens, advance: pen, left, right, ascent, descent };
}

/** One character's ink box, in em from the pen's start of the word (y up from the baseline). */
export type ScriptBox = { left: number; right: number; ascent: number; descent: number };

/** The ink box of every inked character of a word, kerned, with `wordSpace` em added to every space. */
export function scriptBoxes(word: string, wordSpace = 0): ScriptBox[] {
  const { pens } = scriptRun(word, wordSpace);
  return Array.from(word).flatMap((char, i) => {
    const glyph = GLYPHS[char];
    if (!inked(glyph)) return [];
    const [, xMin, yMin, xMax, yMax] = glyph;
    return [{ left: pens[i] + xMin / UPM, right: pens[i] + xMax / UPM, ascent: yMax / UPM, descent: -yMin / UPM }];
  });
}

/**
 * The lowest point of the word's ink under each whole unit of x, set at
 * `size` with its pen starting at `x` and its baseline at y 0, in the
 * card's units (y down): `depth[i]` is for x = `from` + i, and -Infinity
 * where the column has no ink. `limit` cuts each column's depth (in em
 * under the baseline): the word's body without its descenders and swashes.
 * Conservative: a column of the face's table marks every unit it touches.
 */
export function scriptDepth(
  word: string,
  { size, x, wordSpace = 0, from, to, limit = Infinity }: { size: number; x: number; wordSpace?: number; from: number; to: number; limit?: number },
): Float64Array {
  const depth = new Float64Array(to - from + 1).fill(-Infinity);
  const { pens } = scriptRun(word, wordSpace);
  const scale = size / UPM;
  const cap = limit * size;
  Array.from(word).forEach((char, i) => {
    const glyph = GLYPHS[char];
    if (!inked(glyph)) return;
    const [, , , , , first, lows] = glyph;
    const origin = x + pens[i] * size;
    lows.forEach((low, j) => {
      if (low === null) return;
      const y = Math.min(-low * scale, cap);
      const x0 = Math.floor(origin + (first + j) * COLUMN * scale) - from;
      const x1 = Math.ceil(origin + (first + j + 1) * COLUMN * scale) - from;
      for (let k = Math.max(0, x0); k <= Math.min(depth.length - 1, x1); k++) {
        if (y > depth[k]) depth[k] = y;
      }
    });
  });
  return depth;
}
