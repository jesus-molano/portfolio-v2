"use client";

import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { QualityTier } from "../useQualityTier";
import { FilmGrain } from "./FilmGrain";

type Props = { tier: QualityTier };

/**
 * The two-octave value noise has a standard deviation of about 0.125, so
 * amount 0.2 gives about ±3.5% brightness in the midtones: visible 35 mm
 * grain that does not muddy the pastel sky.
 */
const GRAIN = { amount: 0.2, size: 1.5 } as const;

/**
 * Bloom and the film grain are the heart of the look, so both tiers keep
 * them (the grain merges into the same effect pass); the rest is desktop only.
 */
export function Effects({ tier }: Props) {
  if (tier === "low") {
    return (
      <EffectComposer multisampling={0} resolutionScale={0.6}>
        <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.3} intensity={0.5} />
        <FilmGrain amount={GRAIN.amount} size={GRAIN.size} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        luminanceThreshold={0.9}
        luminanceSmoothing={0.25}
        intensity={0.55}
        radius={0.75}
      />
      <ChromaticAberration offset={[0.0007, 0.0004]} radialModulation modulationOffset={0.35} />
      <Vignette eskil={false} offset={0.28} darkness={0.62} />
      <FilmGrain amount={GRAIN.amount} size={GRAIN.size} />
    </EffectComposer>
  );
}
