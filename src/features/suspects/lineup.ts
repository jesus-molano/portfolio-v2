/**
 * THE USUAL SUSPECTS: where each figure stands on the line-up wall, the
 * character select's roster (select.ts): the four cats, then Jesús.
 *
 * The cats arrive as transparent images, all at one scale, with a manifest
 * (`public/interlude/manifest.json`, the contract with the cats package):
 * `pxPerCm` and, per cat, in image pixels, the image size `w` x `h`, the row
 * where the cat meets the floor (`floorY`), the highest row of the head,
 * ear tips included (`headTopY`), the column of the slot centre
 * (`centerX`) and the width of the head across the cheeks (`headWidth`).
 *
 * Everything here works in centimetres on the height chart. The page turns
 * centimetres into pixels with one CSS length, `--cm`, so every figure
 * keeps its real size next to the others and next to the chart, on every
 * screen: one true scale for the cats and for Jesús on one knee.
 */

export const CAT_IDS = ["kira", "tom", "dante", "odin"] as const;
export type CatId = (typeof CAT_IDS)[number];

/** The fifth slot: the one character in the house who lets you pick him. */
export const PLAYER_ONE = "jesus" as const;
export type SlotId = CatId | typeof PLAYER_ONE;
/** The roster in line-up order: the four suspects, then him. */
export const SLOT_IDS: readonly SlotId[] = [...CAT_IDS, PLAYER_ONE];

/**
 * The renders beside the four cats, in the same manifest: Jesús on one
 * knee (`jesus`, at the top level or among the others), Kira from behind
 * and Tom asleep (`states`, each naming its cat; `figures` or `cats` are
 * read too), and, if it is there, Dante's swipe (`dante-swipe`).
 */
export const FIGURE_IDS = ["jesus", "kira-back", "tom-asleep"] as const;
export type FigureId = (typeof FIGURE_IDS)[number];
/** A render the select uses when the manifest has it, and does without otherwise. */
export const OPTIONAL_FIGURE_IDS = ["dante-swipe"] as const;
export type OptionalFigureId = (typeof OPTIONAL_FIGURE_IDS)[number];

/**
 * Who did it: Dante, the smallest, alias Satanás. Four suspects, one
 * culprit, and the twist is the one who looks least capable of it.
 */
export const CULPRIT: CatId = "dante";

export type CatImage = {
  w: number;
  h: number;
  floorY: number;
  headTopY: number;
  centerX: number;
  headWidth: number;
  /**
   * Optional, from when Odin wore a halo: a render that carried one said
   * so here. Nobody wears a halo now (the owner's call), the page draws
   * none, and the tests refuse a manifest that sets this on any cat.
   */
  haloInImage?: boolean;
};

/**
 * A figure's image: the cats' contract, and for Jesús the scale he was
 * rendered at. `pxPerCm` is image pixels per real centimetre when it
 * differs from the manifest's: a render of him at 1:`scale` (an image
 * pixel is `scale` / the manifest's `pxPerCm` real centimetres) or with
 * its own `pxPerCm`. `heightCm` is his real kneeling height from the
 * model, when the render states it. The page draws every figure at the
 * one true scale of the chart.
 */
export type FigureImage = CatImage & { pxPerCm?: number; heightCm?: number };

export type LineupManifest = {
  pxPerCm: number;
  cats: Record<CatId, CatImage>;
  figures: Record<FigureId, FigureImage> & Partial<Record<OptionalFigureId, FigureImage>>;
};

/**
 * One true scale for all five: the chart runs from the floor to `topCm`
 * with a line and a number every `stepCm` (a fainter line every
 * `minorCm`), the cats at their real 27 to 39 cm at its foot and Jesús on
 * one knee at his real height beside them.
 */
export const CHART = { topCm: 140, stepCm: 10, minorCm: 5 } as const;

/** The chart's labelled heights, from the floor up: 10, 20, ... 140. */
export function chartMarks(topCm: number = CHART.topCm, stepCm: number = CHART.stepCm): number[] {
  const marks: number[] = [];
  for (let cm = stepCm; cm <= topCm + 1e-9; cm += stepCm) marks.push(cm);
  return marks;
}

/**
 * The wide screen's line-up (Suspects.module.css mirrors every number):
 * five slots across 92% of the width, his twice as wide as a cat's would
 * need (his column `columns[4]` shares of the five), the header painted
 * on the wall over the cats.
 *
 * `--cm`, the pixels of one chart centimetre, is the largest that keeps
 * his head (and the cursor over it) under the page controls with the
 * plates, their lines and the foot under the floor (`belowRem` rem of the
 * screen's height besides his `headCm`), never wider than his column
 * lets his reach be, never above `maxVw` of the width, and never under
 * `minPx` for the height (a shorter window scrolls instead), where a
 * cat's face is still 44 px across.
 */
export const WIDE = {
  columns: [1, 1, 1, 1, 1.5],
  /** The slots' share of the width, and the margin each side. */
  rowShare: 0.92,
  maxVw: 0.6,
  /**
   * His reach keeps inside this share of the width (vw) either side of his
   * slot: half his column and a little of the margin beyond it (the cat
   * beside him reaches far less than half its own column).
   */
  halfColumnVw: 15,
  belowRem: 22.5,
  /** The wall above his head: the cursor, the flag and the page controls. */
  aboveRem: 8.5,
  minPx: 4,
} as const;

/** One CSS pixel per rem, as the page's root size gives it. */
const REM = 16;

/** The wide screen's centimetre (px) on a `width` x `height` screen, as the stylesheet works it out. */
export function wideCm(screen: { width: number; height: number }, player: { headCm: number; reachCm: number }): number {
  const byWidth = Math.min((screen.width * WIDE.maxVw) / 100, (screen.width * WIDE.halfColumnVw) / 100 / player.reachCm);
  return Math.min(byWidth, Math.max(WIDE.minPx, (screen.height - WIDE.belowRem * REM) / player.headCm));
}

/** Each slot's centre on a wide screen, as a share of the width from the left. */
export function wideCentres(): number[] {
  const total = WIDE.columns.reduce((a, b) => a + b, 0);
  const margin = (1 - WIDE.rowShare) / 2;
  let left = margin;
  return WIDE.columns.map((share) => {
    const width = (WIDE.rowShare * share) / total;
    const centre = left + width / 2;
    left += width;
    return centre;
  });
}

/**
 * The chart on a phone and a portrait screen: two strips of two cats, then
 * Jesús on a strip of his own, all at one true scale. Dante sits next to
 * Odin, so the smallest stands next to one of the tall ones. Each cat's
 * strip shows the chart to `catTopCm`, his to `CHART.topCm`.
 *
 * `--cm` is the largest that keeps his reach inside half the screen and
 * his head (and the cursor over it) on one screen with his plate under it
 * (`belowRem`), between `minPx` and `maxPx`.
 */
export const PHONE_CHART = {
  catTopCm: 40,
  strips: [
    ["kira", "tom"],
    ["dante", "odin"],
  ],
  belowRem: 14,
  /** The screen's side gutter (rem) his reach keeps clear of. */
  gutterRem: 0.75,
  minPx: 4,
  maxPx: 7,
  /**
   * Room from a slot centre to the outer edge of its strip, in chart
   * centimetres (a quarter of a 360-430 px phone at its centimetre). A cat
   * wider than that is nudged inward, up to `maxNudgeCm`, so it never runs
   * off the screen.
   */
  outerCm: 18,
  maxNudgeCm: 4,
} as const satisfies {
  catTopCm: number;
  strips: readonly (readonly CatId[])[];
  belowRem: number;
  gutterRem: number;
  minPx: number;
  maxPx: number;
  outerCm: number;
  maxNudgeCm: number;
};

/** The phone's centimetre (px) on a `width` x `height` screen, as the stylesheet works it out. */
export function phoneCm(screen: { width: number; height: number }, player: { headCm: number; reachCm: number }): number {
  const byWidth = (screen.width / 2 - PHONE_CHART.gutterRem * REM) / player.reachCm;
  const byHeight = (screen.height - PHONE_CHART.belowRem * REM) / player.headCm;
  return Math.max(PHONE_CHART.minPx, Math.min(byWidth, byHeight, PHONE_CHART.maxPx));
}

export type Placement = {
  id: SlotId | FigureId | OptionalFigureId;
  /** The image's own size, for the width and height attributes. */
  w: number;
  h: number;
  /** The image on the chart, in centimetres. */
  widthCm: number;
  heightCm: number;
  /** The image's left edge, from the slot centre (negative: to the left). */
  leftCm: number;
  /** The image's bottom edge, from the floor line (negative: below it). */
  bottomCm: number;
  /** How high the head reaches above the floor, ear tips included. */
  headTopCm: number;
  headWidthCm: number;
  /** On a phone, how far the cat moves toward the middle of its strip (+: right). */
  phoneNudgeCm: number;
};

export function isCatId(value: string): value is CatId {
  return (CAT_IDS as readonly string[]).includes(value);
}

export function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as readonly string[]).includes(value);
}

function fail(message: string): never {
  throw new Error(`public/interlude/manifest.json: ${message}`);
}

/** One image's entry, checked against the contract. */
function parseImage(id: string, entry: unknown, own: { scale: boolean; manifestPx?: number } = { scale: false }): FigureImage {
  if (!entry || typeof entry !== "object") fail(`${id} is missing`);
  const image = entry as Record<string, unknown>;
  const fields = ["w", "h", "floorY", "headTopY", "centerX", "headWidth"] as const;
  for (const field of fields) {
    const v = image[field];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) fail(`${id}.${field} must be a number >= 0`);
  }
  const cat = image as unknown as CatImage;
  if (cat.w <= 0 || cat.h <= 0) fail(`${id} has an empty image`);
  if (cat.floorY > cat.h) fail(`${id}.floorY is below the image`);
  if (cat.headTopY >= cat.floorY) fail(`${id}.headTopY must be above floorY`);
  if (cat.centerX > cat.w) fail(`${id}.centerX is outside the image`);
  if (cat.headWidth <= 0 || cat.headWidth > cat.w) fail(`${id}.headWidth must be inside the image width`);
  if (image.haloInImage !== undefined && typeof image.haloInImage !== "boolean") fail(`${id}.haloInImage must be a boolean`);
  const positive = (field: string) => {
    const v = image[field];
    if (v === undefined) return undefined;
    if (!own.scale) fail(`${id} must share the manifest's pxPerCm`);
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) fail(`${id}.${field} must be a positive number`);
    return v;
  };
  // His render's scale, either way it is stated: pixels per real centimetre, or 1:scale at the manifest's.
  const ownPx = positive("pxPerCm");
  const rendered = positive("scale");
  const heightCm = positive("heightCm");
  const pxPerCm = ownPx ?? (rendered !== undefined && own.manifestPx ? own.manifestPx / rendered : undefined);
  return {
    w: cat.w,
    h: cat.h,
    floorY: cat.floorY,
    headTopY: cat.headTopY,
    centerX: cat.centerX,
    headWidth: cat.headWidth,
    ...(image.haloInImage === true ? { haloInImage: true } : {}),
    ...(pxPerCm !== undefined && pxPerCm !== own.manifestPx ? { pxPerCm } : {}),
    ...(heightCm !== undefined ? { heightCm } : {}),
  };
}

/** A map of entries, if the manifest has it. */
function section(value: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const map = value[key];
  if (map === undefined) return undefined;
  if (!map || typeof map !== "object") fail(`${key} must be an object`);
  return map as Record<string, unknown>;
}

/**
 * Checks the manifest against the contract and says what is wrong with it.
 * The select's renders are found wherever the renders put them: Jesús at
 * the top level (`jesus`) or in a map; Kira's back, Tom asleep and Dante's
 * swipe in `states` (each naming its cat), `figures` or `cats`.
 */
export function parseManifest(value: unknown): LineupManifest {
  if (!value || typeof value !== "object") fail("not an object");
  const root = value as Record<string, unknown>;
  const { pxPerCm } = root;
  if (typeof pxPerCm !== "number" || !Number.isFinite(pxPerCm) || pxPerCm <= 0) fail("pxPerCm must be a positive number");
  const cats = section(root, "cats");
  if (!cats) fail("cats is missing");
  const maps = [section(root, "figures"), section(root, "states"), cats];
  const find = (id: string): unknown => (id === PLAYER_ONE && root.jesus !== undefined ? root.jesus : maps.map((m) => m?.[id]).find((e) => e !== undefined));

  const out = {} as Record<CatId, CatImage>;
  for (const id of CAT_IDS) out[id] = parseImage(id, cats[id], { scale: false });
  const extra = {} as LineupManifest["figures"];
  for (const id of FIGURE_IDS) {
    // Only Jesús is rendered at a scale of his own: the states swap in for the cat on its slot.
    extra[id] = parseImage(id, find(id), id === PLAYER_ONE ? { scale: true, manifestPx: pxPerCm } : { scale: false });
  }
  for (const id of OPTIONAL_FIGURE_IDS) {
    const entry = find(id);
    if (entry !== undefined) extra[id] = parseImage(id, entry, { scale: false });
  }
  return { pxPerCm, cats: out, figures: extra };
}

/** One image on the chart at `pxPerCm` image pixels per chart centimetre: its box and its head, in centimetres. */
export function placeCat(id: SlotId | FigureId | OptionalFigureId, image: CatImage, pxPerCm: number): Placement {
  const cm = (px: number) => px / pxPerCm;
  return {
    id,
    w: image.w,
    h: image.h,
    widthCm: cm(image.w),
    heightCm: cm(image.h),
    leftCm: -cm(image.centerX),
    bottomCm: -cm(image.h - image.floorY),
    headTopCm: cm(image.floorY - image.headTopY),
    headWidthCm: cm(image.headWidth),
    phoneNudgeCm: 0,
  };
}

/** How far the image reaches left and right of its slot centre. */
export function extents(p: Placement): { leftCm: number; rightCm: number } {
  return { leftCm: -p.leftCm, rightCm: p.widthCm + p.leftCm };
}

/**
 * On a phone, the nudge that keeps a cat inside its strip: the left slot's
 * cat moves right if it reaches past the strip's left edge, the right
 * slot's moves left; never more than `maxNudgeCm`.
 */
export function phoneNudge(p: Placement, column: 0 | 1): number {
  const { leftCm, rightCm } = extents(p);
  const over = (column === 0 ? leftCm : rightCm) - PHONE_CHART.outerCm;
  const nudge = Math.min(Math.max(over, 0), PHONE_CHART.maxNudgeCm);
  return column === 0 ? nudge : -nudge;
}

/** The four suspects in line-up order, with their phone nudges. */
export function placeLineup(manifest: LineupManifest): Placement[] {
  return CAT_IDS.map((id) => {
    const p = placeCat(id, manifest.cats[id], manifest.pxPerCm);
    const strip = PHONE_CHART.strips.find((ids) => (ids as readonly CatId[]).includes(id));
    const column = strip ? ((strip as readonly CatId[]).indexOf(id) as 0 | 1) : 0;
    return { ...p, phoneNudgeCm: phoneNudge(p, column) };
  });
}

/**
 * Jesús on the chart, at the one true scale: his image in chart
 * centimetres, his real kneeling height (the render's own figure, or his
 * crown over the floor) and how far he reaches either side of his slot.
 */
export function placePlayer(manifest: LineupManifest): Placement & { realHeadCm: number; reachCm: number } {
  const image = manifest.figures.jesus;
  const p = placeCat(PLAYER_ONE, image, image.pxPerCm ?? manifest.pxPerCm);
  const { leftCm, rightCm } = extents(p);
  return { ...p, realHeadCm: image.heightCm ?? p.headTopCm, reachCm: Math.max(leftCm, rightCm) };
}

/**
 * A swap-in render (Kira from behind, Tom asleep) on its cat's slot: placed
 * by its own floor and centre, so it lines up with the cat it replaces
 * whatever its crop, at the cats' one scale.
 */
export function placeSwap(manifest: LineupManifest, id: "kira-back" | "tom-asleep" | "dante-swipe"): Placement | null {
  const image = manifest.figures[id];
  return image ? placeCat(id, image, manifest.pxPerCm) : null;
}

/** The figure whose head is the lowest on the chart. */
export function lowestHead(placements: readonly Placement[]): Placement["id"] {
  if (placements.length === 0) throw new Error("lowestHead: no cats");
  return placements.reduce((low, p) => (p.headTopCm < low.headTopCm ? p : low)).id;
}

/** The phone's strips of cats: which share one, and the one chart top they all share. */
export function phoneStrips(placements: readonly Placement[]) {
  const byId = new Map(placements.map((p) => [p.id, p]));
  return {
    topCm: PHONE_CHART.catTopCm,
    strips: PHONE_CHART.strips.map((ids) => ({
      ids,
      tallestCm: Math.max(...ids.map((id) => byId.get(id)?.headTopCm ?? 0)),
    })),
  };
}

/** A centimetre value as a short CSS number. */
function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * The CSS custom properties that put one cat on the chart; the stylesheet
 * multiplies each by `--cm`.
 */
export function placementStyle(p: Placement): Record<`--${string}`, string> {
  return {
    "--cat-w": num(p.widthCm),
    "--cat-left": num(p.leftCm),
    "--cat-bottom": num(p.bottomCm),
    "--cat-head": num(p.headTopCm),
    "--phone-nudge": num(p.phoneNudgeCm),
  };
}

/**
 * The board's custom properties: his head and his reach (the stylesheet
 * works `--cm` out of them, as `wideCm` and `phoneCm` do) and the tallest
 * cat's head (the slot numerals stand over it).
 */
export function boardStyle(cats: readonly Placement[], player: { headTopCm: number; reachCm: number }): Record<`--${string}`, string> {
  return {
    "--player-head": num(player.headTopCm),
    "--player-reach": num(player.reachCm),
    "--cats-head": num(Math.max(...cats.map((p) => p.headTopCm))),
  };
}

/** "01", "02", ... for the plates. */
export function plateNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}
