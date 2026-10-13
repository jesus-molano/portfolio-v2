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
import { memo } from "react";
import type { QualityTier } from "../useQualityTier";
import type { Structure } from "./degrade";
import { FilmGrain } from "./FilmGrain";
import { gradeUniforms } from "./grade";
import { LensDepthOfField } from "./LensDepthOfField";

type Props = {
  tier: QualityTier;
  /**
   * The post's structure (degrade.ts), frozen once she has entered: a
   * change makes new effects and compiles the passes again. What changes
   * mid-film (the depth of field, the pixels) never goes through here.
   */
  structure: Structure;
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

/** A hair of colour fringing toward the corners (high tier, full structure). */
const CHROMATIC_OFFSET: [number, number] = [0.0007, 0.0004];

/** The day's grade (grade.ts): the same values for the life of the page. */
const GRADE = gradeUniforms();

/**
 * Pass layout (effects merge into one shader until a convolution effect):
 *   1. SMAA, [depth of field], bloom, tone mapping: SMAA reads the scene
 *      buffer, so it leads its pass; the frame is still HDR here.
 *   2. [chromatic aberration], vignette, grade and grain (display values).
 * On the low tier everything is one pass plus SMAA's two small ones: the
 * vignette and the grade cost a few instructions there, not a pass. A
 * visit that starts low on the quality ladder builds the high tier with
 * SMAA's medium preset and no chromatic aberration.
 *
 * Memoised: a re-render hands the composer a new list of effects, and
 * nothing in it changes unless the tier or the structure does.
 */
export const Effects = memo(function Effects({ tier, structure }: Props) {
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
        <FilmGrain amount={GRAIN.amount} size={GRAIN.size} {...GRADE} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <SMAA preset={structure.smaa === "high" ? SMAAPreset.HIGH : SMAAPreset.MEDIUM} />
      <LensDepthOfField />
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
      <Vignette eskil={false} offset={VIGNETTE.offset} darkness={VIGNETTE.darkness} />
      <FilmGrain amount={GRAIN.amount} size={GRAIN.size} {...GRADE} />
    </EffectComposer>
  );
});
