"use client";

import { useMemo } from "react";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";

/**
 * The night's frame, cleaned before the bloom: a pixel that is not a number
 * or infinite turns black, and every channel is held under half float's
 * ceiling. One such pixel, which only some drivers produce (Mesa on a Linux
 * desktop, in Brave and Firefox alike), went down the bloom's mipmap blur
 * and blacked out the whole picture a second into the city; the hero's
 * shaders are guarded by hand (AGENTS.md, shader safety), and this is the
 * night's net. A convolution effect, so the composer gives it a pass of its
 * own (the bloom then reads what it wrote).
 */
const FRAGMENT = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 c = inputColor;
  bool bad = any(isnan(c)) || any(isinf(c)) || any(notEqual(c, c));
  outputColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : clamp(c, vec4(0.0), vec4(60000.0));
}
`;

class NanGuardEffect extends Effect {
  constructor() {
    super("NanGuardEffect", FRAGMENT, { attributes: EffectAttribute.CONVOLUTION, blendFunction: BlendFunction.SET });
  }
}

export function NanGuard() {
  const effect = useMemo(() => new NanGuardEffect(), []);
  return <primitive object={effect} dispose={null} />;
}
