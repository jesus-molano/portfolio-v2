"use client";

import { wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector3, type WebGLRenderer } from "three";
import { filmGrainFragmentShader } from "../shaders/filmGrain";
import { grainScale } from "./degrade";
import { gradeUniforms, type Rgb } from "./grade";

type Options = {
  /** Largest change of brightness, as a fraction (0.06 = ±6% in the midtones). */
  amount?: number;
  /** Clump size in the canvas's pixels at its full pixel ratio (degrade.ts `grainScale`). */
  size?: number;
  /** Colour grade (see grade.ts); the default comes from GRADE. */
  lift?: Rgb;
  gain?: Rgb;
  contrast?: number;
  saturation?: number;
  shadowSaturation?: number;
};

/**
 * The last effect of the frame: the colour grade, then subtle 35 mm film
 * grain, in one pass. The effect pass advances `time` on every render, so
 * the grain moves with `frameloop="always"` and stays still with
 * `frameloop="demand"` (reduced motion).
 */
class FilmGrainEffect extends Effect {
  private readonly size: number;

  constructor({ amount = 0.06, size = 1.6, ...grade }: Options = {}) {
    const fallback = gradeUniforms();
    const lift = grade.lift ?? fallback.lift;
    const gain = grade.gain ?? fallback.gain;
    super("FilmGrainEffect", filmGrainFragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uAmount", new Uniform(amount)],
        ["uSize", new Uniform(size)],
        ["uLift", new Uniform(new Vector3(...lift))],
        ["uGain", new Uniform(new Vector3(...gain))],
        ["uContrast", new Uniform(grade.contrast ?? fallback.contrast)],
        ["uSaturation", new Uniform(grade.saturation ?? fallback.saturation)],
        ["uShadowSaturation", new Uniform(grade.shadowSaturation ?? fallback.shadowSaturation)],
      ]),
    });
    this.size = size;
  }

  /** Every frame, before the pass draws: the clump's size for the pixel ratio drawn now (a uniform, no new effect). */
  override update(renderer: WebGLRenderer) {
    const uniform = this.uniforms.get("uSize");
    const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
    if (uniform) uniform.value = this.size * grainScale(renderer.getPixelRatio(), ratio);
  }
}

export const FilmGrain = wrapEffect(FilmGrainEffect);
