"use client";

import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { QualityTier } from "../useQualityTier";

type Props = { tier: QualityTier };

/** Bloom is the heart of the look, so both tiers keep it; the rest is desktop only. */
export function Effects({ tier }: Props) {
  if (tier === "low") {
    return (
      <EffectComposer multisampling={0} resolutionScale={0.6}>
        <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.3} intensity={0.5} />
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
      <Noise blendFunction={BlendFunction.SCREEN} opacity={0.028} />
    </EffectComposer>
  );
}
