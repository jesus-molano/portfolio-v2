"use client";

import { useThree } from "@react-three/fiber";
import { DepthOfFieldEffect, MaskFunction } from "postprocessing";
import { useEffect, useMemo } from "react";
import type { Camera, WebGLRenderer, WebGLRenderTarget } from "three";
import { lens } from "./lens";
import { currentLens, resolveLens } from "./lensBlur";

/**
 * Depth of field driven by the shared `lens` (CameraRig writes it per shot):
 * focus distance and range in metres, measured from the camera. With a bokeh
 * scale of 0 it renders its buffers once more, empty, and then skips all of
 * its passes, so a shot without blur costs three texture reads per pixel.
 */
class LensDepthOfFieldEffect extends DepthOfFieldEffect {
  private idle = false;
  /** Cleared when the device is too slow; the effect stays in its pass. */
  allowed = true;

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
    // Off (or given up by a slow device) means scale 0, also in the shader.
    const scale = state.active && this.allowed ? state.bokehScale : 0;
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

/**
 * High tier only: the extra passes are too heavy for phones. `enabled` turns
 * the blur off without rebuilding the effect pass (no shader recompile).
 */
export function LensDepthOfField({ enabled }: { enabled: boolean }) {
  const camera = useThree((state) => state.camera);
  const effect = useMemo(() => new LensDepthOfFieldEffect(camera), [camera]);
  useEffect(() => () => effect.dispose(), [effect]);
  // R3F sets `allowed` on the effect, like any other prop of a primitive.
  return <primitive object={effect} allowed={enabled} />;
}
