"use client";

import { useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { getSceneLoading, markSceneReady, reportSceneProgress } from "../sceneLoading";

/** Frames the scene renders after the last asset before it counts as ready. */
const SETTLE_FRAMES = 8;

/**
 * Bridges three.js loading to the DOM loading screen: reports the loaders'
 * progress, then marks the scene ready once nothing is loading and a few
 * frames have rendered (Suspense content mounted, shaders compiled).
 */
export function LoadReporter() {
  const { progress, active, loaded, total } = useProgress();
  const invalidate = useThree((state) => state.invalidate);
  const settled = useRef(0);
  // The models start loading at import (useGLTF.preload), and drei's
  // progress store misses that start: it reads "not active, nothing to
  // load" until the first model arrives. Counting that as done let a slow
  // connection report the scene ready with every model still downloading.
  const done = !active && total > 0 && loaded >= total;

  useEffect(() => {
    reportSceneProgress(progress);
  }, [progress]);

  useFrame(() => {
    if (getSceneLoading().ready) return;
    settled.current = done ? settled.current + 1 : 0;
    if (settled.current >= SETTLE_FRAMES) markSceneReady();
    // With frameloop="demand" (reduced motion) keep frames coming until ready.
    else invalidate();
  });

  return null;
}
