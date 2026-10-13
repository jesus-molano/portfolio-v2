"use client";

import { useThree } from "@react-three/fiber";
import { useCallback } from "react";
import { requestFrames } from "./frameDriver";

/**
 * How a part of the hero's scene asks for a frame while its canvas is not
 * drawing every one (heroFrameloop.ts: behind the start menu while the
 * scene loads, under reduced motion, out of view): a step of the load, the
 * warm-up done, a board's copy painted once its font is in, the aviators
 * put on. One hook for every one of them: the frame driver's
 * `requestFrames` (frameDriver.ts; R3F's own `invalidate` does nothing
 * under `frameloop="never"`), which keeps a frame asked before the warm-up
 * is done until it is, and asks R3F itself under reduced motion, where the
 * canvas draws on demand.
 */
export function useSceneInvalidate(): (frames?: number) => void {
  const get = useThree((state) => state.get);
  return useCallback((frames?: number) => requestFrames(get, frames), [get]);
}
