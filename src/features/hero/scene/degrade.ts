import type { QualityTier } from "../useQualityTier";
import type { GpuClass } from "./gpuHint";

/**
 * The quality ladder both canvases share: what a GPU that cannot keep up
 * gives up, in order, and only as far as it must. A strong machine stays on
 * level 0 for the whole visit, today's look; a weak one starts lower (its
 * renderer string, gpuHint.ts) and steps down while it drops frames
 * (qualityMonitor.ts), never back up, so the picture never swings between
 * two levels.
 *
 * In order: a cap on the pixels drawn (the canvas draws every pixel through
 * six to eight full-screen half-float passes, and a 4K screen at 150 % sent
 * 8.3 million of them through each), then, decided before she enters only,
 * chromatic aberration off and SMAA at its medium preset (both rebuild the
 * post's passes, so never mid-film: `Structure`), then lighter clouds (the
 * sky's fbm loses an octave and its self-shadow sample), then the depth of
 * field, and last of all fewer pixels than the screen has. Everything after
 * the structure is a uniform or the pixel ratio: no shader compiles.
 */
export type Level = {
  /** Most pixels the canvas draws: its CSS area times the pixel ratio squared. */
  budgetPx: number;
  /** Highest pixel ratio, if the screen has as many. */
  dprCeil: number;
  /** Lowest pixel ratio the budget may take it to: under 1 the picture is drawn below the screen's resolution. */
  dprFloor: number;
  depthOfField: boolean;
  /** The sky's fbm octaves (shaders/sky.ts, under the tier's compiled maximum). */
  cloudOctaves: number;
  /** The cumulus bank's second sample toward the sun. */
  cloudShadow: boolean;
};

export const LEVELS: readonly Level[] = [
  // Today's look: a 1440p screen at 125 % or a MacBook draws every pixel; a 4K one at 150 % is capped.
  { budgetPx: 3.7e6, dprCeil: 1.5, dprFloor: 1, depthOfField: true, cloudOctaves: 5, cloudShadow: true },
  { budgetPx: 2.6e6, dprCeil: 1.5, dprFloor: 1, depthOfField: true, cloudOctaves: 5, cloudShadow: true },
  { budgetPx: 2.6e6, dprCeil: 1.5, dprFloor: 1, depthOfField: true, cloudOctaves: 4, cloudShadow: false },
  { budgetPx: 2.07e6, dprCeil: 1.25, dprFloor: 1, depthOfField: true, cloudOctaves: 4, cloudShadow: false },
  { budgetPx: 2.07e6, dprCeil: 1.25, dprFloor: 1, depthOfField: false, cloudOctaves: 4, cloudShadow: false },
  // The last resort: fewer pixels than the screen's own, the picture a little softer.
  { budgetPx: 1.8e6, dprCeil: 1, dprFloor: 0.85, depthOfField: false, cloudOctaves: 3, cloudShadow: false },
  { budgetPx: 1.4e6, dprCeil: 1, dprFloor: 0.7, depthOfField: false, cloudOctaves: 3, cloudShadow: false },
];

export const LAST_LEVEL = LEVELS.length - 1;

/**
 * The most each tier draws: the low tier has no depth of field and lighter
 * clouds, compiled into its shaders (skyUniforms.ts reads these), so its
 * ladder only ever trims its pixels.
 */
export const TIER_MAX = {
  high: { depthOfField: true, cloudOctaves: 5, cloudShadow: true },
  low: { depthOfField: false, cloudOctaves: 3, cloudShadow: false },
} as const;

/**
 * What the post is built with: changing any of it makes new effects and
 * compiles the passes again, a hitch, so it is decided before she enters
 * (from the level the visit starts on) and frozen from then on.
 */
export type Structure = {
  chromaticAberration: boolean;
  smaa: "high" | "medium";
  /** The night's net for broken pixels (gpuHint.ts `needsNanGuard`). */
  nanGuard: boolean;
};

export type QualityState = {
  /** The GPU's class from its renderer string. */
  gpu: GpuClass;
  /** The level the visit started on. */
  start: number;
  /** The level drawn now. */
  level: number;
  /** A level declined to, waiting for a cut to land under (null: none). */
  pending: number | null;
  /** performance.now() of that decline. */
  declinedAt: number | null;
  /** The 3D drawn on every second refresh of a fast display, before any detail goes. */
  halfRate: boolean;
  structure: Structure;
  /** She has entered: the structure no longer changes. */
  locked: boolean;
};

/** A display this fast (120, 144, 165 Hz) first draws at half its rate before it loses any detail; never one at 100 Hz or less. */
export const HALF_RATE_HZ = 118;

/** A decline lands under the next cut or dip, or after this long anyway. */
export const COMMIT_MS = 1500;

/** Pixel ratios snap down to this step, so a resize does not reallocate every target for a pixel's change. */
export const DPR_STEP = 0.05;

/** Where a GPU of each class starts. */
export function startLevel(gpu: GpuClass): number {
  switch (gpu) {
    case "top":
      return 0;
    case "mid":
      return 2;
    case "low":
      return 4;
    case "software":
      return LAST_LEVEL;
  }
}

/** The post a level is built with: chromatic aberration and SMAA's high preset only on the first two. */
export function structureFor(level: number, nanGuard: boolean): Structure {
  const full = level <= 1;
  return { chromaticAberration: full, smaa: full ? "high" : "medium", nanGuard };
}

function sameStructure(a: Structure, b: Structure): boolean {
  return a.chromaticAberration === b.chromaticAberration && a.smaa === b.smaa && a.nanGuard === b.nanGuard;
}

/** `next`, or `prev` itself when they say the same (the hosts compare it by reference). */
function keepStructure(prev: Structure, next: Structure): Structure {
  return sameStructure(prev, next) ? prev : next;
}

/** Whether a GPU below the top starts at half rate on this display (hz null: not measured yet). */
export function startsAtHalfRate(gpu: GpuClass, hz: number | null): boolean {
  return gpu !== "top" && hz !== null && hz >= HALF_RATE_HZ;
}

/**
 * The visit's first state, from the GPU's class. A development build starts
 * at level 0 with the full post whatever the GPU, so captured frames stay
 * comparable (SwiftShader would start at the bottom).
 */
export function seedQuality(
  gpu: GpuClass,
  { dev, nanGuard, refreshHz }: { dev: boolean; nanGuard: boolean; refreshHz: number | null },
): QualityState {
  const start = dev ? 0 : startLevel(gpu);
  return {
    gpu,
    start,
    level: start,
    pending: null,
    declinedAt: null,
    halfRate: !dev && startsAtHalfRate(gpu, refreshHz),
    structure: structureFor(start, nanGuard),
    locked: false,
  };
}

/**
 * One step down. On a display of 118 Hz or more the first step is half
 * rate, which costs no detail at all; then one level at a time, down to the
 * last and never back up. A level waits (`pending`) for a cut to land under
 * (`shouldCommit`); a second decline before it lands steps from it.
 */
export function declineQuality(q: QualityState, hz: number | null, now: number): QualityState {
  if (hz !== null && hz >= HALF_RATE_HZ && !q.halfRate) return { ...q, halfRate: true };
  const from = q.pending ?? q.level;
  if (from >= LAST_LEVEL) return q;
  return { ...q, pending: from + 1, declinedAt: q.declinedAt ?? now };
}

/** Whether a pending decline lands now: a cut since it, or `COMMIT_MS` gone by. */
export function shouldCommit(declinedAt: number | null, cutAt: number | null, now: number): boolean {
  if (declinedAt === null) return false;
  return (cutAt !== null && cutAt >= declinedAt) || now - declinedAt >= COMMIT_MS;
}

/** The pending level drawn from now on; the structure follows it only until she has entered. */
export function commitQuality(q: QualityState): QualityState {
  if (q.pending === null) return q;
  const level = q.pending;
  return {
    ...q,
    level,
    pending: null,
    declinedAt: null,
    structure: q.locked ? q.structure : keepStructure(q.structure, structureFor(level, q.structure.nanGuard)),
  };
}

/** She has entered: the post keeps its structure for the visit. */
export function lockQuality(q: QualityState): QualityState {
  return q.locked ? q : { ...q, locked: true };
}

/** Development only: any level at once, up or down, with its structure, locked or not. */
export function forceLevel(q: QualityState, level: number): QualityState {
  const next = Math.min(LAST_LEVEL, Math.max(0, Math.round(level)));
  return {
    ...q,
    level: next,
    pending: null,
    declinedAt: null,
    structure: keepStructure(q.structure, structureFor(next, q.structure.nanGuard)),
  };
}

export type Settings = Level;

/** A level's settings on a tier: the low tier never has the depth of field, nor more clouds than it compiled. */
export function settingsFor(tier: QualityTier, level: number): Settings {
  const l = LEVELS[Math.min(LAST_LEVEL, Math.max(0, Math.round(level)))];
  const max = TIER_MAX[tier];
  return {
    budgetPx: l.budgetPx,
    dprCeil: l.dprCeil,
    dprFloor: l.dprFloor,
    depthOfField: l.depthOfField && max.depthOfField,
    cloudOctaves: Math.min(l.cloudOctaves, max.cloudOctaves),
    cloudShadow: l.cloudShadow && max.cloudShadow,
  };
}

/**
 * The canvas's pixel ratio: the screen's own, between the level's floor and
 * ceiling, and no more than keeps the canvas under the level's pixel
 * budget. Under the ceiling it snaps down to `DPR_STEP`, so a window
 * resized by a few pixels keeps its targets; the screen's own ratio is kept
 * exactly, so a canvas drawn at it stays crisp.
 */
export function pixelRatioFor({
  cssWidth,
  cssHeight,
  deviceRatio,
  budgetPx,
  floor,
  ceil,
}: {
  cssWidth: number;
  cssHeight: number;
  deviceRatio: number;
  budgetPx: number;
  floor: number;
  ceil: number;
}): number {
  const device = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const hi = Math.min(Math.max(device, floor), ceil);
  const lo = Math.min(floor, hi);
  const area = Math.max(1, cssWidth) * Math.max(1, cssHeight);
  const fit = Math.sqrt(budgetPx / area);
  if (fit >= hi) return hi;
  const snapped = Math.floor(fit / DPR_STEP + 1e-9) * DPR_STEP;
  return Math.max(lo, Math.round(snapped * 100) / 100);
}

/**
 * How much smaller a grain clump is drawn than its `size`, in the canvas's
 * buffer pixels (FilmGrain.tsx): the pixel ratio drawn now over the one the
 * canvas drew at before the ladder had a pixel budget (the screen's own,
 * between 1 and 1.5). A canvas capped below its screen's ratio (a 4K
 * screen, a slow device's level) has fewer, larger buffer pixels, and grain
 * sized in them came out coarser; scaled, a clump keeps its size on screen.
 */
export function grainScale(drawnRatio: number, deviceRatio: number): number {
  const reference = Math.min(Math.max(deviceRatio > 0 ? deviceRatio : 1, 1), 1.5);
  return drawnRatio > 0 ? drawnRatio / reference : 1;
}

/**
 * The tier the canvas is built for. Once the scene is ready on a fine
 * pointer it no longer changes: the Canvas is keyed by its tier, and a
 * desktop window narrowed under the phone width mid-film built the whole
 * scene again (every model, texture and program) in front of her.
 */
export function settleTier(kept: QualityTier | null, queried: QualityTier, sticky: boolean): QualityTier {
  return sticky && kept !== null ? kept : queried;
}
