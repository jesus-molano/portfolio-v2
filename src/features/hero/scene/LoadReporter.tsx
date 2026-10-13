"use client";

import { useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { getSceneLoading, heroFrames, markSceneReady, reportSceneProgress } from "../sceneLoading";
import { downloadsDone, isWarm } from "./warmup";

/** Frames the scene renders after the last asset before it counts as ready. */
const SETTLE_FRAMES = 8;

/**
 * Bridges three.js loading to the DOM loading screen: reports the loaders'
 * progress, then marks the scene ready once nothing is loading, the scene
 * is warm (HeroWarmup: every program compiled, every texture uploaded) and
 * a few frames have rendered (Suspense content mounted).
 */
export function LoadReporter() {
  const loading = useProgress();
  const { progress } = loading;
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const settled = useRef(0);
  const done = downloadsDone(loading);

  useEffect(() => {
    reportSceneProgress(progress);
  }, [progress]);

  useFrame(() => {
    heroFrames.count += 1;
    if (getSceneLoading().ready) return;
    settled.current = done && isWarm(gl) ? settled.current + 1 : 0;
    if (settled.current >= SETTLE_FRAMES) markSceneReady();
    // With frameloop="demand" (reduced motion) keep frames coming until ready.
    else invalidate();
  });

  return null;
}
