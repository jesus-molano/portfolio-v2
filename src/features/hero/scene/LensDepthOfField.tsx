"use client";

import { useThree } from "@react-three/fiber";
import { DepthOfFieldEffect, MaskFunction } from "postprocessing";
import { useEffect, useMemo } from "react";
import type { Camera, WebGLRenderer, WebGLRenderTarget } from "three";
import { lens } from "./lens";
import { currentLens, resolveLens } from "./lensBlur";
import { qualityRuntime } from "./qualityStore";

/**
 * Depth of field driven by the shared `lens` (CameraRig writes it per shot):
 * focus distance and range in metres, measured from the camera. With a bokeh
 * scale of 0 it renders its buffers once more, empty, and then skips all of
 * its passes, so a shot without blur costs three texture reads per pixel.
 * A quality level without the depth of field (degrade.ts) reads as scale 0
 * from the frame it lands on: the effect stays in its pass, so turning it
 * off never rebuilds the post nor compiles a shader.
 */
class LensDepthOfFieldEffect extends DepthOfFieldEffect {
  private idle = false;

  constructor(camera: Camera) {
    super(camera, {
      focusDistance: lens.focusDistance,
      focusRange: lens.focusRange,
      bokehScale: 0,
      resolutionScale: 0.5,
    });
    // The far blur carries its coverage in alpha, as in @react-three/postprocessing.
    this.maskFunction = MaskFunction.MULTIPLY_RGB_SET_ALPHA;
  }

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, deltaTime?: number) {
    const state = resolveLens(currentLens());
    // Off (or given up by a slow device's level) means scale 0, also in the shader.
    const scale = state.active && qualityRuntime.depthOfField ? state.bokehScale : 0;
    this.cocMaterial.focusDistance = state.focusDistance;
    this.cocMaterial.focusRange = state.focusRange;
    if (this.bokehScale !== scale) this.bokehScale = scale;
    if (scale > 0) {
      this.idle = false;
      super.update(renderer, inputBuffer, deltaTime);
    } else if (!this.idle) {
      // At scale 0 the masks are empty: one last run leaves blank buffers.
      super.update(renderer, inputBuffer, deltaTime);
      this.idle = true;
    }
  }
}

/** High tier only: the extra passes are too heavy for phones. */
export function LensDepthOfField() {
  const camera = useThree((state) => state.camera);
  const effect = useMemo(() => new LensDepthOfFieldEffect(camera), [camera]);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} />;
}
