import type { QualityTier } from "../useQualityTier";

/** Device pixel ratio range of the canvas at full quality. */
export const FULL_DPR: [number, number] = [1, 1.5];

/**
 * What a slow device gives up, in order, when the frame rate drops: the
 * depth of field first (high tier only), then the extra pixels. It never
 * steps back up, so the frame rate does not oscillate between two levels.
 */
const STEPS: Record<QualityTier, ReadonlyArray<"depthOfField" | "dpr">> = {
  high: ["depthOfField", "dpr"],
  low: ["dpr"],
};

/** The level after one more decline, clamped at the last step. */
export function declineLevel(tier: QualityTier, level: number): number {
  return Math.min(STEPS[tier].length, Math.max(0, level) + 1);
}

/** The settings for a tier after `level` declines (0 = full quality). */
export function degradedSettings(
  tier: QualityTier,
  level: number,
): { depthOfField: boolean; dpr: number | [number, number] } {
  const dropped = new Set(STEPS[tier].slice(0, Math.max(0, level)));
  return {
    depthOfField: tier === "high" && !dropped.has("depthOfField"),
    dpr: dropped.has("dpr") ? 1 : FULL_DPR,
  };
}
