/**
 * THE USUAL SUSPECTS: where each cat stands on the line-up wall.
 *
 * The cats arrive as transparent images, all at one scale, with a manifest
 * (`public/interlude/manifest.json`, the contract with the cats package):
 * `pxPerCm` and, per cat, in image pixels, the image size `w` x `h`, the row
 * where the cat meets the floor (`floorY`), the highest row of the head,
 * ear tips included (`headTopY`), the column of the slot centre
 * (`centerX`) and the width of the head across the cheeks (`headWidth`).
 *
 * Everything here works in centimetres on the height chart. The page turns
 * centimetres into pixels with one CSS length, `--cm`, so every cat keeps
 * its real size next to the others and next to the chart, on every screen.
 */

export const CAT_IDS = ["kira", "tom", "dante", "odin"] as const;
export type CatId = (typeof CAT_IDS)[number];

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

export type LineupManifest = {
  pxPerCm: number;
  cats: Record<CatId, CatImage>;
};

/** The chart on a wide screen: one wall, the slot numerals high on it. */
export const WIDE_CHART = { topCm: 50, numeralCm: 46, numeralHeightCm: 9 } as const;

/**
 * The chart on a phone: two strips at one scale, so heights still compare
 * across them. Dante sits next to Odin, so the smallest stands next to one
 * of the tall ones.
 */
export const PHONE_CHART = {
  topCm: 40,
  strips: [
    ["kira", "tom"],
    ["dante", "odin"],
  ],
  /**
   * Room from a slot centre to the outer edge of its strip, in chart
   * centimetres (a 360-430 px phone at 1.84vw a centimetre). A cat wider
   * than that is nudged inward, up to `maxNudgeCm`, so it never runs off
   * the screen.
   */
  outerCm: 13,
  maxNudgeCm: 4,
} as const satisfies { topCm: number; strips: readonly (readonly CatId[])[]; outerCm: number; maxNudgeCm: number };

/** Centre to centre between neighbouring slots on a wide screen: 16% of the width at 0.62vw a centimetre. */
export const WIDE_SLOT_CM = 16 / 0.62;

export type Placement = {
  id: CatId;
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

function fail(message: string): never {
  throw new Error(`public/interlude/manifest.json: ${message}`);
}

/** Checks the manifest against the contract and says what is wrong with it. */
export function parseManifest(value: unknown): LineupManifest {
  if (!value || typeof value !== "object") fail("not an object");
  const { pxPerCm, cats } = value as { pxPerCm?: unknown; cats?: unknown };
  if (typeof pxPerCm !== "number" || !Number.isFinite(pxPerCm) || pxPerCm <= 0) fail("pxPerCm must be a positive number");
  if (!cats || typeof cats !== "object") fail("cats is missing");

  const out = {} as Record<CatId, CatImage>;
  for (const id of CAT_IDS) {
    const entry = (cats as Record<string, unknown>)[id];
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
    out[id] = {
      w: cat.w,
      h: cat.h,
      floorY: cat.floorY,
      headTopY: cat.headTopY,
      centerX: cat.centerX,
      headWidth: cat.headWidth,
      ...(image.haloInImage === true ? { haloInImage: true } : {}),
    };
  }
  return { pxPerCm, cats: out };
}

/** One cat on the chart: its image's box and its head, in centimetres. */
export function placeCat(id: CatId, image: CatImage, pxPerCm: number): Placement {
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

/** The cat whose head is the lowest on the chart. */
export function lowestHead(placements: readonly Placement[]): CatId {
  if (placements.length === 0) throw new Error("lowestHead: no cats");
  return placements.reduce((low, p) => (p.headTopCm < low.headTopCm ? p : low)).id;
}

/** The phone's strips: which cats share one, and the one chart top they all share. */
export function phoneStrips(placements: readonly Placement[]) {
  const byId = new Map(placements.map((p) => [p.id, p]));
  return {
    topCm: PHONE_CHART.topCm,
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

/** "01", "02", ... for the plates. */
export function plateNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}
