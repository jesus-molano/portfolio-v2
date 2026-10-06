/**
 * The chapter cards' geometry (ChapterCard.tsx), pure and tested: a
 * sign-painter's card, one per static section.
 *
 * The word is set in Chapter Script (our subset of Mr Dafoe) with an ink
 * keyline, a magenta split shade and a dusk-to-ink block shade. Under it
 * hangs a classic scroll banner: one flat band of even height on a gentle
 * circular arch, its two ends folded back behind it into tails that drop a
 * little and end in a swallow-tail notch, the ribbon's capitals (Big
 * Shoulders Display Black) set on the arch. The banner casts the same
 * shades as the word, and the whole card leans 5 degrees up to the right.
 *
 * Everything is in a viewBox 1000 units wide, laid out here from the faces'
 * checked-in metrics (scriptFace.ts, capsFace.ts), so the server sends the
 * finished drawing and its box never waits for a font.
 *
 * The banner hangs as close under the word as it can: its top edge clears
 * the word's body (the ink down to BODY em under the baseline) and its
 * shade by GAP, and descenders and swashes deeper than that may cross the
 * band in front of it, their shade cast on it, as on a painted sign, but
 * never down onto a capital: every capital's top clears the word's whole
 * ink and shade by CAPS_GAP.
 */
import { chapterSpan } from "@/design/tokens";
import { CAPS_FACE, capsRun, isAccented, missingCaps } from "./capsFace";
import { scriptBoxes, scriptDepth, scriptRun, SCRIPT_FACE } from "./scriptFace";

/** The card's tunables, in viewBox units unless noted. */
export const CARD = {
  width: 1000,
  /**
   * The longest words' ink width; shorter words stop growing at maxSize, so
   * a short word (Pausa) stands as tall as THE CREW's, never taller, and
   * its card keeps a third of a phone's landscape screen free.
   */
  maxInk: 760,
  maxSize: 240,
  /** Degrees; negative leans the card up to the right. */
  tilt: -5,
  /** Extra space between the words, in em: the script's own space is tight. */
  wordSpace: 0.16,
  /** The ink keyline round the word and every piece of the banner. */
  keyline: 3.2,
  /** The magenta split shade's offset. */
  split: [5, 6] as const,
  /** The block shade: this many one-unit steps down (and 0.7 right) behind the split; the back ones (from `deep`) in ink. */
  block: 12,
  blockStep: [0.7, 1] as const,
  deep: 6,
  /** The ribbon's capitals: their size (a cap height of 11.2 px on a 360 px phone's 328 px card) and tracking in em. */
  caps: 42,
  tracking: 0.15,
  /** The band's height, in caps sizes; the clear band at its ends, in caps sizes. */
  band: 1.92,
  padX: 1.05,
  /** The band's least and greatest length, as shares of the word's ink width. */
  minMain: 0.64,
  maxMain: 0.86,
  /** The tails: how far they drop below the band, the fold's width, their reach past the band's end and the notch, in band heights. */
  drop: 0.46,
  fold: 0.42,
  tail: 1.25,
  notch: 0.34,
  /** How far the band's ends drop below its middle. */
  sag: 20,
  /** The cream pinstripe's inset from the band's edges, in band heights. */
  pin: 0.12,
} as const;

/** Clear air between the word's body (and its shade) and the band's top edge. */
export const GAP = 9;
/** Clear air between the word's lowest ink or shade and any capital's top. */
export const CAPS_GAP = 4;
/** The word's body, in em under the baseline: ink deeper than this is a descender or a swash. */
export const BODY = 0.08;
/** Where a straddled section edge crosses the card: the word's middle, this many em over its baseline, at the card's centre. */
const EDGE_EM = 0.22;
/** Room round the drawing in the viewBox. */
const PAD = 4;

/**
 * How far each straddling card rises over the cut from the section above,
 * as a share of the way to its edge line, the word's middle
 * (--chapter-straddle in the section's stylesheet): PAUSED most of the way
 * over the career city's last frame (its short word is set large, so its
 * middle stands high: 0.8 of the way keeps its rise at most 0.124 of the
 * card's width, which STATS's landing counts); THE LATE SHOW only the top
 * of its word, into the room at STATS's foot, and only from 1000 px (under
 * it, none).
 */
export const STRADDLE = { stats: 0.8, projects: 0.55 } as const;

/** A CSS rem in px, at the browser's default text size. */
const REM_PX = 16;

/**
 * A card's width in CSS px, in a band `band` px wide on a screen `height`
 * px tall (ChapterCard.module.css): the band less 2rem, at most
 * --va-chapter-span (48rem, and 1.5 screen heights on a short screen).
 * Under the browser's zoom the band narrows in CSS px, the rem do not.
 */
export function cardWidth(band: number, height = Infinity, rem = REM_PX): number {
  return Math.min(band - 2 * rem, chapterSpan.rem * rem, chapterSpan.perHeight * height);
}

/**
 * How far a straddling card's word rises over the section's top edge, as
 * a share of the card's width: the card rises `straddle` of the way to its
 * edge line (--chapter-straddle), and its highest ink stands `inkTop` under
 * the drawing's top. Negative: the word stays under the edge.
 */
export function inkRise(layout: Pick<ChapterLayout, "edge" | "inkTop">, straddle: number): number {
  return (layout.edge * straddle - layout.inkTop) / CARD.width;
}

/** The shade's layers, back to front: the block's steps (the back ones deep), then the split. */
export type ShadeLayer = { dx: number; dy: number; tone: "deep" | "block" | "split" };

export function shadeLayers(): ShadeLayer[] {
  const [sx, sy] = CARD.split;
  const layers: ShadeLayer[] = [];
  for (let i = CARD.block; i >= 1; i--) {
    layers.push({ dx: round(sx + i * CARD.blockStep[0]), dy: sy + i * CARD.blockStep[1], tone: i >= CARD.deep ? "deep" : "block" });
  }
  layers.push({ dx: sx, dy: sy, tone: "split" });
  return layers;
}

/** How far the shade reaches right and down from what casts it, keyline included. */
const REACH = {
  x: CARD.split[0] + CARD.block * CARD.blockStep[0] + CARD.keyline / 2,
  y: CARD.split[1] + CARD.block * CARD.blockStep[1] + CARD.keyline / 2,
};

function round(value: number, places = 2): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

/** The ribbon's text as the banner shows it: capitals in the card's own language. */
export function ribbonCaps(ribbon: string, lang: string): string {
  return ribbon.toLocaleUpperCase(lang);
}

/**
 * The heading's accessible name: the word, then the ribbon as written,
 * "La banda. Sospechosos habituales". A word that already ends on its own
 * mark keeps it alone ("¡Y corten! Créditos y contacto").
 */
export function chapterName(word: string, ribbon: string): string {
  return `${/[.!?…]$/.test(word) ? word : `${word}.`} ${ribbon}`;
}

/**
 * The banner's frame: u runs along the band's centre line from its middle
 * (left negative), v across it (down positive). The centre line is an arc
 * of a circle of radius R under the card, crowned, its middle at yMid: every
 * edge is a concentric arc, every end a radial cut.
 */
function frame(cx: number, yMid: number, R: number) {
  const pt = (u: number, v: number): [number, number] => {
    const th = u / R;
    const rr = R - v;
    return [cx + rr * Math.sin(th), yMid + R - rr * Math.cos(th)];
  };
  const xy = (u: number, v: number) => pt(u, v).map((n) => round(n)).join(" ");
  return {
    pt,
    M: (u: number, v: number) => `M ${xy(u, v)}`,
    L: (u: number, v: number) => `L ${xy(u, v)}`,
    /** Along the arc at v, from u0 to u1. */
    A: (u0: number, u1: number, v: number) => `A ${round(R - v)} ${round(R - v)} 0 0 ${u1 > u0 ? 1 : 0} ${xy(u1, v)}`,
  };
}

/**
 * The lowest point of a word's ink with its keyline, and of the shade it
 * casts, at any x (a depth profile from scriptDepth, starting at `from`).
 */
function withShade(depth: Float64Array, from: number, layers: readonly ShadeLayer[]): (x: number) => number {
  const half = CARD.keyline / 2;
  const reach = Math.ceil(half);
  const inked = new Float64Array(depth.length);
  for (let i = 0; i < depth.length; i++) {
    let low = -Infinity;
    for (let k = Math.max(0, i - reach); k <= Math.min(depth.length - 1, i + reach); k++) low = Math.max(low, depth[k]);
    inked[i] = low + half;
  }
  const at = (x: number) => {
    const i = x - from;
    return i >= 0 && i < inked.length ? inked[i] : -Infinity;
  };
  return (x: number) => {
    let low = -Infinity;
    for (const X of [Math.floor(x), Math.ceil(x)]) {
      low = Math.max(low, at(X));
      for (const { dx, dy } of layers) low = Math.max(low, at(Math.floor(X - dx)) + dy, at(Math.ceil(X - dx)) + dy);
    }
    return low;
  };
}

export type ChapterLayout = {
  /** The word as set: its font size, pen start (baseline at y 0), word spacing and the run it is pinned to. */
  word: { text: string; size: number; x: number; wordSpacing: number; textLength: number };
  /** The word's fill runs top to bottom over the face's line box (cream, amber, peach). */
  wordFill: { y1: number; y2: number };
  /** The ribbon's capitals: size, tracking, the run they are pinned to, their baseline arc and where on it their middle sits. */
  ribbon: { text: string; size: number; letterSpacing: number; textLength: number; path: string; startOffset: number };
  /** The banner's pieces as paths: the band, its two tails, the two folds, the pinstripes. */
  banner: { main: string; tails: [string, string]; folds: [string, string]; pins: [string, string] };
  /** The band's fill runs left to right over the banner (orange, peach, pink; deeper on the tails). */
  bannerFill: { x1: number; x2: number };
  /** The band's centre line at the card's middle, and the arch's radius. */
  yMid: number;
  radius: number;
  /** The band's half length and height; the capitals' run and cap height. */
  half: number;
  bandHeight: number;
  capsRun: number;
  capHeight: number;
  /** The word's ink box (untilted), with the baseline at y 0. */
  ink: { left: number; right: number; top: number; bottom: number };
  /** The lean: the angle and the point it turns about (also the entrance's turn). */
  tilt: number;
  pivot: { x: number; y: number };
  /** The viewBox: x from 0 to 1000, y from minY, this tall. */
  minY: number;
  height: number;
  /** The drawing's extent across the viewBox, tilted, shade included. */
  xRange: [number, number];
  /** Where a section's top edge crosses a card that straddles it, from the viewBox's top. */
  edge: number;
  /**
   * The word's highest ink, keyline included, from the viewBox's top: the
   * top corners of its letters' ink boxes, tilted (a bound, never under
   * the real ink).
   */
  inkTop: number;
  /** The clearances the hang achieved: band top under the body, capitals' tops under any ink or shade. */
  clearance: { body: number; caps: number };
};

/** Everything about one card, in viewBox units. `ribbon` is in capitals already (`ribbonCaps`). */
export function chapterLayout(word: string, ribbon: string): ChapterLayout {
  const missing = missingCaps(ribbon);
  if (missing.length > 0) throw new Error(`chapterLayout: no width for ${missing.join(" ")} in "${ribbon}"`);
  const cx = CARD.width / 2;
  const layers = shadeLayers();
  const half = CARD.keyline / 2;

  // The word: its ink fitted to maxInk, capped at maxSize, and centred.
  const run = scriptRun(word, CARD.wordSpace);
  const inkEm = run.right - run.left;
  const size = Math.min(CARD.maxSize, CARD.maxInk / inkEm);
  const inkW = inkEm * size;
  const x = cx - inkW / 2 - run.left * size;
  const ink = { left: cx - inkW / 2, right: cx + inkW / 2, top: -run.ascent * size, bottom: run.descent * size };

  // The capitals and the band round them: long enough for the caps and their clear ends, in proportion to the word.
  const r = CARD.caps;
  const track = r * CARD.tracking;
  const caps = capsRun(ribbon, CARD.tracking);
  const capsW = caps.length * r;
  const capH = CAPS_FACE.cap * r;
  const Hb = r * CARD.band;
  const h = Hb / 2;
  const a = Math.max(
    capsW / 2 + 0.6 * r,
    Math.min((CARD.maxMain * inkW) / 2, Math.max(capsW / 2 + CARD.padX * r, (CARD.minMain * inkW) / 2)),
  );
  const d = Hb * CARD.drop;
  const f = Hb * CARD.fold;
  const n = Hb * CARD.notch;
  const R = (a * a + CARD.sag * CARD.sag) / (2 * CARD.sag);
  const uo = a + Hb * CARD.tail;
  const vTop = (u: number) => (Math.abs(u) <= a ? -h : -h + d);
  const vBottom = (u: number) => (Math.abs(u) >= a - f ? h + d : h);

  // The word's ink and shade, column by column: all of it, and its body alone.
  const from = -60;
  const to = CARD.width + 60;
  const set = { size, x, wordSpace: CARD.wordSpace, from, to };
  const whole = withShade(scriptDepth(word, set), from, layers);
  const body = withShade(scriptDepth(word, { ...set, limit: BODY }), from, layers);

  // The capitals sit on an arc capH/2 under the centre line, their run centred; each one's top, as centre-line spans.
  const rb = R - capH / 2;
  const capTops = Array.from(ribbon).flatMap((glyph, i) => {
    if (glyph === " ") return [];
    const s0 = -capsW / 2 + caps.starts[i] * r - 2;
    const s1 = -capsW / 2 + caps.ends[i] * r + 2;
    const top = (isAccented(glyph) ? CAPS_FACE.accent : CAPS_FACE.cap) * r;
    return [{ u0: (s0 / rb) * R, u1: (s1 / rb) * R, v: capH / 2 - top }];
  });
  const capPoints = capTops.flatMap(({ u0, u1, v }) => {
    const steps = Math.max(1, Math.ceil(u1 - u0));
    return Array.from({ length: steps + 1 }, (_, k) => ({ u: u0 + ((u1 - u0) * k) / steps, v }));
  });
  const topPoints = Array.from({ length: Math.floor(2 * uo) + 1 }, (_, k) => ({ u: -uo + k, v: vTop(-uo + k) }));

  // Hang the band: its top edge (the tails' too) clears the body; every capital's top clears it all.
  const rel = frame(cx, 0, R);
  let yMid = -Infinity;
  for (const { u, v } of topPoints) {
    const [X, Y] = rel.pt(u, v);
    yMid = Math.max(yMid, body(X) + GAP + half - Y);
  }
  for (const { u, v } of capPoints) {
    const [X, Y] = rel.pt(u, v);
    yMid = Math.max(yMid, whole(X) + CAPS_GAP - Y);
  }
  yMid = round(yMid);
  const F = frame(cx, yMid, R);
  const clearance = {
    body: round(Math.min(...topPoints.map(({ u, v }) => F.pt(u, v)).map(([X, Y]) => Y - half - body(X)))),
    caps: round(Math.min(...capPoints.map(({ u, v }) => F.pt(u, v)).map(([X, Y]) => Y - whole(X)))),
  };

  // The pieces.
  const main = `${F.M(-a, -h)} ${F.A(-a, a, -h)} ${F.L(a, h)} ${F.A(a, -a, h)} Z`;
  const tail = (s: 1 | -1) => {
    const ui = s * (a - f);
    const ue = s * uo;
    return `${F.M(ui, -h + d)} ${F.A(ui, ue, -h + d)} ${F.L(s * (uo - n), d)} ${F.L(ue, h + d)} ${F.A(ue, ui, h + d)} Z`;
  };
  const fold = (s: 1 | -1) => `${F.M(s * a, h)} ${F.L(s * (a - f), h + d)} ${F.L(s * (a - f), h)} ${F.A(s * (a - f), s * a, h)} Z`;
  const pi = Hb * CARD.pin;
  const pin = (v: number) => `${F.M(-a + pi * 1.2, v)} ${F.A(-a + pi * 1.2, a - pi * 1.2, v)}`;
  // The capitals' baseline: the band's whole length, on the arc capH/2 under the centre line.
  const baseline = `${F.M(-a, capH / 2)} ${F.A(-a, a, capH / 2)}`;
  const baselineLength = (2 * a * rb) / R;

  // The banner's outline, then the whole drawing's with its keyline and shade, to frame the tilted card.
  const band: [number, number][] = [];
  for (let u = -uo; u < uo; u += 4) band.push(F.pt(u, vTop(u)), F.pt(u, vBottom(u)));
  for (const u of [-uo, uo]) band.push(F.pt(u, -h + d), F.pt(u, h + d));
  const drawing: [number, number][] = band.flatMap(([px, py]): [number, number][] => [
    [px - half, py - half],
    [px + REACH.x, py + REACH.y],
  ]);
  drawing.push([ink.left - half, ink.top - half], [ink.right + half, ink.top - half], [ink.left - half, ink.bottom + half], [ink.right + REACH.x, ink.bottom + REACH.y]);
  const ys = drawing.map((p) => p[1]);
  const pivot = { x: cx, y: round((Math.min(...ys) + Math.max(...ys)) / 2) };
  const turn = (CARD.tilt * Math.PI) / 180;
  const rotate = ([px, py]: [number, number]): [number, number] => [
    pivot.x + (px - pivot.x) * Math.cos(turn) - (py - pivot.y) * Math.sin(turn),
    pivot.y + (px - pivot.x) * Math.sin(turn) + (py - pivot.y) * Math.cos(turn),
  ];
  const turned = drawing.map(rotate);
  const minY = Math.floor(Math.min(...turned.map((p) => p[1])) - PAD);
  const height = Math.ceil(Math.max(...turned.map((p) => p[1])) + PAD - minY);
  const bandXs = band.map((p) => p[0]);
  const letterTops = scriptBoxes(word, CARD.wordSpace).flatMap(({ left, right, ascent }): [number, number][] => [
    [x + left * size - half, -ascent * size - half],
    [x + right * size + half, -ascent * size - half],
  ]);

  return {
    word: { text: word, size: round(size), x: round(x), wordSpacing: round(size * CARD.wordSpace), textLength: round(run.advance * size) },
    wordFill: { y1: round(-SCRIPT_FACE.ascender * size), y2: round(SCRIPT_FACE.descender * size) },
    ribbon: {
      text: ribbon,
      size: r,
      letterSpacing: round(track),
      // Chromium spaces after the last letter too: the pinned run counts it, and the middle moves half of it right.
      textLength: round(capsW + track),
      path: baseline,
      startOffset: round(baselineLength / 2 + track / 2),
    },
    banner: { main, tails: [tail(-1), tail(1)], folds: [fold(-1), fold(1)], pins: [pin(-h + pi), pin(h - pi)] },
    bannerFill: { x1: round(Math.min(...bandXs)), x2: round(Math.max(...bandXs)) },
    yMid,
    radius: round(R),
    half: round(a),
    bandHeight: round(Hb),
    capsRun: round(capsW),
    capHeight: round(capH),
    ink: { left: round(ink.left), right: round(ink.right), top: round(ink.top), bottom: round(ink.bottom) },
    tilt: CARD.tilt,
    pivot,
    minY,
    height,
    xRange: [round(Math.min(...turned.map((p) => p[0]))), round(Math.max(...turned.map((p) => p[0])))],
    edge: round(rotate([cx, -size * EDGE_EM])[1] - minY),
    inkTop: round(Math.min(...letterTops.map((p) => rotate(p)[1])) - minY),
    clearance,
  };
}
