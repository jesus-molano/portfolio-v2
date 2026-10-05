"use client";

import { addAfterEffect, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { drive } from "./drive";
import { timeScale } from "./timeScale";

/**
 * Development only: exposes the scene, camera and renderer, and the drive
 * and its time scale, as `window.__vaScene` for inspection from the
 * browser console.
 * `addAfterEffect` runs a callback right after each rendered frame, while the
 * drawing buffer is still valid, so frame probes read real pixels.
 * Renders nothing in production.
 */
export function DevHandle() {
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const raycaster = useThree((state) => state.raycaster);
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const target = window as unknown as { __vaScene?: unknown };
    target.__vaScene = { scene, camera, raycaster, gl, addAfterEffect, drive, timeScale };
    return () => {
      delete target.__vaScene;
    };
  }, [scene, camera, raycaster, gl]);
  return null;
}
