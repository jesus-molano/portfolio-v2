"use client";

import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { SMAAPreset, ToneMappingMode } from "postprocessing";
import type { QualityTier } from "../useQualityTier";
import { FilmGrain } from "./FilmGrain";
import { gradeUniforms } from "./grade";
import { LensDepthOfField } from "./LensDepthOfField";

type Props = {
  tier: QualityTier;
  /** False once a slow device has given the depth of field up (degrade.ts). */
  depthOfField: boolean;
};

/**
 * The two-octave value noise has a standard deviation of about 0.125, so
 * amount 0.09 gives about ±1.5% brightness in the midtones: fine 35 mm grain
 * that reads as film on the flat sky, not as digital noise.
 */
const GRAIN = { amount: 0.09, size: 1.5 } as const;

/**
 * Bloom runs on the HDR frame, before the tone mapping, so only the sun, the
 * sky right around it and the lamps bleed (the open sky stays below the
 * threshold); the Khronos neutral curve then rolls the highlights off
 * without shifting the pastel hues.
 */
const BLOOM = { threshold: 0.8, smoothing: 0.35, intensity: 0.7, radius: 0.75 } as const;

/** A slight darkening toward the corners, as on a real lens. */
const VIGNETTE = { offset: 0.3, darkness: 0.5 } as const;

/**
 * Pass layout (effects merge into one shader until a convolution effect):
 *   1. SMAA, [depth of field], bloom, tone mapping: SMAA reads the scene
 *      buffer, so it leads its pass; the frame is still HDR here.
 *   2. [chromatic aberration], vignette, grade and grain (display values).
 * On the low tier everything is one pass plus SMAA's two small ones: the
 * vignette and the grade cost a few instructions there, not a pass.
 */
export function Effects({ tier, depthOfField }: Props) {
  const grade = gradeUniforms();

  if (tier === "low") {
    return (
      <EffectComposer multisampling={0}>
        <SMAA preset={SMAAPreset.MEDIUM} />
        <Bloom
          mipmapBlur
          luminanceThreshold={BLOOM.threshold}
          luminanceSmoothing={BLOOM.smoothing}
          intensity={BLOOM.intensity}
        />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette eskil={false} offset={VIGNETTE.offset} darkness={VIGNETTE.darkness} />
        <FilmGrain amount={GRAIN.amount} size={GRAIN.size} {...grade} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <SMAA preset={SMAAPreset.HIGH} />
      <LensDepthOfField enabled={depthOfField} />
      <Bloom
        mipmapBlur
        luminanceThreshold={BLOOM.threshold}
        luminanceSmoothing={BLOOM.smoothing}
        intensity={BLOOM.intensity}
        radius={BLOOM.radius}
      />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <ChromaticAberration offset={[0.0007, 0.0004]} radialModulation modulationOffset={0.35} />
      <Vignette eskil={false} offset={VIGNETTE.offset} darkness={VIGNETTE.darkness} />
      <FilmGrain amount={GRAIN.amount} size={GRAIN.size} {...grade} />
    </EffectComposer>
  );
}
