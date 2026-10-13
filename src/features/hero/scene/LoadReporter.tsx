"use client";

import { useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { getSceneLoading, heroFrames, markSceneReady, reportSceneProgress } from "../sceneLoading";
import { useSceneInvalidate } from "./invalidate";
import { downloadsDone, isWarm } from "./warmup";

/** Frames the scene renders after the last asset before it counts as ready. */
const SETTLE_FRAMES = 8;

type Props = {
  /** Motion allowed: under reduced motion it keeps a frame coming every frame until ready. */
  animate: boolean;
};

/**
 * Bridges three.js loading to the DOM loading screen: reports the loaders'
 * progress, then marks the scene ready once nothing is loading, the scene
 * is warm (HeroWarmup: every program compiled, every texture uploaded) and
 * a few frames have rendered (Suspense content mounted).
 *
 * While the scene loads its canvas draws only when asked (heroFrameloop.ts),
 * so this asks: a frame at each step of the load (the frame driver keeps
 * it until the warm-up is done), one when the warm-up is done (HeroWarmup
 * asks for it), and from the first frame that finds both, the next, until
 * the settle frames are counted. Under reduced motion it asks for every
 * frame until ready, as it always has.
 */
export function LoadReporter({ animate }: Props) {
  const loading = useProgress();
  const { progress } = loading;
  const gl = useThree((state) => state.gl);
  const invalidate = useSceneInvalidate();
  const settled = useRef(0);
  const done = downloadsDone(loading);

  useEffect(() => {
    reportSceneProgress(progress);
  }, [progress]);

  // A step of the load (a model in, the last one done): a frame to see it.
  useEffect(() => {
    if (!getSceneLoading().ready) invalidate();
  }, [progress, done, invalidate]);

  useFrame(() => {
    heroFrames.count += 1;
    if (getSceneLoading().ready) return;
    settled.current = done && isWarm(gl) ? settled.current + 1 : 0;
    if (settled.current >= SETTLE_FRAMES) markSceneReady();
    // Settling, the next frame counts too; under reduced motion every frame comes until ready.
    else if (settled.current > 0 || !animate) invalidate();
  });

  return null;
}
