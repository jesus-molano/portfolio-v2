"use client";

import { Bloom, ChromaticAberration, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { SMAAPreset, ToneMappingMode } from "postprocessing";
import { FilmGrain } from "@/features/hero/scene/FilmGrain";
import { gradeUniforms } from "@/features/hero/scene/grade";
import type { QualityTier } from "@/features/hero/useQualityTier";

/**
 * The hero's post on night: bloom on the HDR frame (only neon, lamps and
 * lit windows reach the threshold), neutral tone mapping, a vignette, and
 * the grade with film grain. The night grade lifts the blacks toward the
 * silhouette violet and keeps the highlights neutral: neon is not sunset.
 * No depth of field on either tier; chromatic aberration on high only.
 */
const GRADE = gradeUniforms({ lift: 0.45, warmth: 0, contrast: 0.2, saturation: 1.1, shadowSaturation: 0.85 });
const BLOOM = { threshold: 0.85, smoothing: 0.3, intensity: 0.95, radius: 0.7 } as const;
const GRAIN = { amount: 0.08, size: 1.5 } as const;

export function NightEffects({ tier }: { tier: QualityTier }) {
  if (tier === "low") {
    return (
      <EffectComposer multisampling={0}>
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
      <SMAA preset={SMAAPreset.HIGH} />
      <Bloom
        mipmapBlur
        luminanceThreshold={BLOOM.threshold}
        luminanceSmoothing={BLOOM.smoothing}
        intensity={BLOOM.intensity}
        radius={BLOOM.radius}
      />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <ChromaticAberration offset={[0.0006, 0.0004]} radialModulation modulationOffset={0.35} />
      <Vignette eskil={false} offset={0.3} darkness={0.55} />
      <FilmGrain amount={GRAIN.amount} size={GRAIN.size} {...GRADE} />
    </EffectComposer>
  );
}
