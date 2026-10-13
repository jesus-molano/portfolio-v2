"use client";

import { useThree, type RootState } from "@react-three/fiber";

/**
 * How a part of the hero's scene asks for a frame while its canvas is not
 * drawing every one (heroFrameloop.ts: behind the start menu while the
 * scene loads, under reduced motion, out of view): a step of the load, the
 * warm-up done, a board's copy painted once its font is in, the aviators
 * put on. One hook for every one of them, so how a frame is asked for can
 * change in one place; for now it is R3F's own `invalidate`.
 */
export function useSceneInvalidate(): RootState["invalidate"] {
  return useThree((state) => state.invalidate);
}
