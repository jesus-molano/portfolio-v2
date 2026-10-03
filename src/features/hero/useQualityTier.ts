"use client";

import { breakpoints } from "@/design/tokens";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type QualityTier = "high" | "low";

const LOW_TIER_QUERY = `(max-width: ${breakpoints.mobile - 1}px), (pointer: coarse)`;

/**
 * Picks the scene quality without network calls or GPU benchmarks:
 * small viewports and touch devices get the light scene (no reflections,
 * lighter post-processing, fewer instances). Everything else gets the full one.
 */
export function useQualityTier(): QualityTier {
  const low = useMediaQuery(LOW_TIER_QUERY, false);
  return low ? "low" : "high";
}
