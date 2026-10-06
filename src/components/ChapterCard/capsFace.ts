/**
 * The banner's capitals (ChapterCard.tsx): Big Shoulders Display Black,
 * the checked-in latin subset in src/app/fonts. Pure and tested.
 */

/**
 * Its advance widths in em, measured once in Chromium on the checked-in
 * face: canvas measureText at 1000 px. A ribbon with a glyph missing here
 * fails the tests.
 */
export const ADVANCE: Readonly<Record<string, number>> = {
  A: 0.478, B: 0.473, C: 0.49, D: 0.495, E: 0.408, F: 0.406, G: 0.493, H: 0.485, I: 0.23, J: 0.453,
  K: 0.497, L: 0.402, M: 0.745, N: 0.543, O: 0.497, P: 0.471, Q: 0.497, R: 0.477, S: 0.474, T: 0.419,
  U: 0.487, V: 0.494, W: 0.8, X: 0.471, Y: 0.465, Z: 0.418,
  Á: 0.478, É: 0.408, Í: 0.23, Ó: 0.497, Ú: 0.487, Ü: 0.487, Ñ: 0.543,
  "¡": 0.25, "!": 0.25, "’": 0.251, " ": 0.22,
  // The career city's ribbon (El trabajo · 2018 — LIVE): the digits, the middle dot and the dashes (no kerning with them).
  "0": 0.507, "1": 0.274, "2": 0.49, "3": 0.504, "4": 0.511, "5": 0.515, "6": 0.499, "7": 0.485, "8": 0.501, "9": 0.499,
  "·": 0.189, "—": 0.902, "–": 0.546,
};

/**
 * Its kerning, in em: the left glyph, then the right one (the same
 * measure: a pair's width less its two glyphs'). Accented capitals kern
 * as their base letter (checked against every pair in Chromium); a pair
 * not listed is 0.
 */
const KERNING: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  A: { C: -0.01, G: -0.01, O: -0.01, Q: -0.01, T: -0.048, V: -0.054, W: -0.039, X: -0.04, Y: -0.067, "’": -0.05 },
  B: { A: -0.015, V: -0.02, W: -0.02, X: -0.03, Y: -0.025 },
  C: { A: -0.007, T: -0.007 },
  D: { A: -0.01, T: -0.01, V: -0.015, W: -0.01, X: -0.023, Y: -0.03, Z: -0.011 },
  F: { A: -0.031, C: -0.005, G: -0.005, J: -0.04, O: -0.005, Q: -0.005, T: 0.015 },
  G: { A: -0.005, X: -0.027 },
  K: { C: -0.02, G: -0.02, O: -0.02, Q: -0.02, "’": -0.02 },
  L: { C: -0.006, G: -0.006, O: -0.006, Q: -0.006, T: -0.075, V: -0.078, W: -0.04, Y: -0.1, "’": -0.075 },
  O: { A: -0.01, T: -0.01, V: -0.015, W: -0.01, X: -0.023, Y: -0.03, Z: -0.011 },
  P: { A: -0.028, J: -0.05, X: -0.05, Y: -0.04, Z: -0.02 },
  Q: { A: -0.01, T: -0.01, V: -0.015, W: -0.01, X: -0.023, Y: -0.03, Z: -0.011 },
  R: { J: -0.015, Y: -0.04 },
  T: { A: -0.048, C: -0.01, G: -0.01, O: -0.01, Q: -0.01, T: 0.01 },
  V: { A: -0.053, C: -0.015, G: -0.015, J: -0.045, O: -0.015, Q: -0.015, Z: -0.01 },
  W: { A: -0.036, C: -0.01, G: -0.01, J: -0.04, O: -0.01, Q: -0.01 },
  X: { A: -0.02, C: -0.023, G: -0.023, J: -0.04, O: -0.023, Q: -0.023, W: -0.01 },
  Y: { A: -0.067, C: -0.03, G: -0.03, J: -0.12, O: -0.03, Q: -0.03 },
  Z: { A: -0.02, C: -0.01, G: -0.01, J: -0.03, O: -0.01, Q: -0.01 },
};

/** Accented capitals, and the letter each kerns as. */
const BASE: Readonly<Record<string, string>> = { Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N" };

/** The face's vertical metrics in em (Chromium, canvas): the cap height and the top of an accented capital. */
export const CAPS_FACE = { cap: 0.813, accent: 0.985 } as const;

/** Whether a capital carries an accent over its cap height. */
export function isAccented(glyph: string): boolean {
  return glyph in BASE;
}

/** The glyphs of a ribbon the width table does not know. */
export function missingCaps(text: string): string[] {
  return [...new Set(Array.from(text).filter((glyph) => !(glyph in ADVANCE)))];
}

/**
 * Where each glyph of a run starts, in em from the run's start, with
 * `tracking` em after every glyph (as Chromium spaces them), and the
 * run's ink length (no tracking after the last glyph).
 */
export function capsRun(text: string, tracking = 0): { starts: number[]; ends: number[]; length: number } {
  const glyphs = Array.from(text);
  const starts: number[] = [];
  const ends: number[] = [];
  let pen = 0;
  glyphs.forEach((glyph, i) => {
    starts.push(pen);
    pen += ADVANCE[glyph] ?? Number.NaN;
    ends.push(pen);
    const next = glyphs[i + 1];
    if (next !== undefined) pen += (KERNING[BASE[glyph] ?? glyph]?.[BASE[next] ?? next] ?? 0) + tracking;
  });
  return { starts, ends, length: pen };
}

/** A run's width in em, kerned, without tracking. */
export function runEm(text: string): number {
  return capsRun(text).length;
}
