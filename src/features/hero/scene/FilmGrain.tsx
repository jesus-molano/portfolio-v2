"use client";

import { wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";
import { filmGrainFragmentShader } from "../shaders/filmGrain";

type Options = {
  /** Largest change of brightness, as a fraction (0.06 = ±6% in the midtones). */
  amount?: number;
  /** Clump size in pixels. */
  size?: number;
};

/**
 * Subtle 35 mm film grain. The effect pass advances `time` on every render,
 * so the grain moves with `frameloop="always"` and stays still with
 * `frameloop="demand"` (reduced motion).
 */
class FilmGrainEffect extends Effect {
  constructor({ amount = 0.06, size = 1.6 }: Options = {}) {
    super("FilmGrainEffect", filmGrainFragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["uAmount", new Uniform(amount)],
        ["uSize", new Uniform(size)],
      ]),
    });
  }
}

export const FilmGrain = wrapEffect(FilmGrainEffect);
