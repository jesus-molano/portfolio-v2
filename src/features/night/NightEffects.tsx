"use client";

import { Bloom, ChromaticAberration, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { SMAAPreset, ToneMappingMode } from "postprocessing";
import { memo } from "react";
import type { Structure } from "@/features/hero/scene/degrade";
import { FilmGrain } from "@/features/hero/scene/FilmGrain";
import { gradeUniforms } from "@/features/hero/scene/grade";
import type { QualityTier } from "@/features/hero/useQualityTier";
import { NanGuard } from "./NanGuard";

/**
 * The hero's post on night: bloom on the HDR frame (only neon, lamps and
 * lit windows reach the threshold), neutral tone mapping, a vignette, and
 * the grade with film grain. The night grade lifts the blacks toward the
 * silhouette violet and keeps the highlights neutral: neon is not sunset.
 * No depth of field on either tier; chromatic aberration on high only. The
 * structure is the hero's (degrade.ts, frozen once she has entered): a
 * visit that starts low on the quality ladder has SMAA's medium preset and
 * no chromatic aberration here too, and NanGuard, a pass of its own, runs
 * only where a driver may hand it a broken pixel (gpuHint.ts).
 */
const GRADE = gradeUniforms({ lift: 0.45, warmth: 0, contrast: 0.2, saturation: 1.1, shadowSaturation: 0.85 });
const BLOOM = { threshold: 0.85, smoothing: 0.3, intensity: 0.95, radius: 0.7 } as const;
const GRAIN = { amount: 0.08, size: 1.5 } as const;
const CHROMATIC_OFFSET: [number, number] = [0.0006, 0.0004];

type Props = { tier: QualityTier; structure: Structure };

/** Memoised, like the hero's (Effects.tsx): a re-render of the scene must not reach the composer. */
export const NightEffects = memo(function NightEffects({ tier, structure }: Props) {
  if (tier === "low") {
    return (
      <EffectComposer multisampling={0}>
        {structure.nanGuard ? <NanGuard /> : null}
        <SMAA preset={SMAAPreset.MEDIUM} />
        <Bloom mipmapBlur luminanceThreshold={BLOOM.threshold} luminanceSmoothing={BLOOM.smoothing} intensity={BLOOM.intensity} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette eskil={false} offset={0.3} darkness={0.55} />
        <FilmGrain amount={GRAIN.amount} size={GRAIN.size} {...GRADE} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0}>
      {structure.nanGuard ? <NanGuard /> : null}
      <SMAA preset={structure.smaa === "high" ? SMAAPreset.HIGH : SMAAPreset.MEDIUM} />
      <Bloom
        mipmapBlur
        luminanceThreshold={BLOOM.threshold}
        luminanceSmoothing={BLOOM.smoothing}
        intensity={BLOOM.intensity}
        radius={BLOOM.radius}
      />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      {structure.chromaticAberration ? (
        <ChromaticAberration offset={CHROMATIC_OFFSET} radialModulation modulationOffset={0.35} />
      ) : null}
      <Vignette eskil={false} offset={0.3} darkness={0.55} />
      <FilmGrain amount={GRAIN.amount} size={GRAIN.size} {...GRADE} />
    </EffectComposer>
  );
});
