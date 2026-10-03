"use client";

import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { QualityTier } from "../useQualityTier";

type Props = { tier: QualityTier };

/** Bloom is the heart of the look, so both tiers keep it; the rest is desktop only. */
export function Effects({ tier }: Props) {
  if (tier === "low") {
    return (
      <EffectComposer multisampling={0} resolutionScale={0.6}>
        <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.3} intensity={1.0} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        luminanceThreshold={0.65}
        luminanceSmoothing={0.25}
        intensity={1.35}
        radius={0.75}
      />
      <Vignette eskil={false} offset={0.22} darkness={0.85} />
      <Noise blendFunction={BlendFunction.SCREEN} opacity={0.012} />
    </EffectComposer>
  );
}
