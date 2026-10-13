"use client";

import { useEffect, useSyncExternalStore } from "react";
import { breakpoints } from "@/design/tokens";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getSceneLoading, subscribeSceneLoading } from "./sceneLoading";
import { settleTier } from "./scene/degrade";

export type QualityTier = "high" | "low";

const LOW_TIER_QUERY = `(max-width: ${breakpoints.mobile - 1}px), (pointer: coarse)`;
const FINE_POINTER_QUERY = "(pointer: fine)";

/** The tier both canvases keep once the scene is ready on a fine pointer (degrade.ts `settleTier`). */
let settled: QualityTier | null = null;

function settle(tier: QualityTier) {
  settled ??= tier;
}

/**
 * Picks the scene's content without network calls or GPU benchmarks:
 * small viewports and touch devices get the light scene (no reflections,
 * lighter post-processing, fewer instances). Everything else gets the full
 * one. What a frame costs is the quality level's business (qualityStore.ts);
 * the tier is what the scene holds, and the Canvas is keyed by it, so once
 * the scene is ready on a fine pointer it no longer changes: a desktop
 * window narrowed under the phone width mid-film built the whole scene
 * again in front of her.
 */
export function useQualityTier(): QualityTier {
  const low = useMediaQuery(LOW_TIER_QUERY, false);
  const fine = useMediaQuery(FINE_POINTER_QUERY, false);
  const ready = useSyncExternalStore(subscribeSceneLoading, () => getSceneLoading().ready, () => false);
  const sticky = ready && fine;
  const tier = settleTier(settled, low ? "low" : "high", sticky);
  useEffect(() => {
    if (sticky) settle(tier);
  }, [sticky, tier]);
  return tier;
}
