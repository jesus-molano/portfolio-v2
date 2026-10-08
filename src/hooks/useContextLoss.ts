"use client";

import { useCallback, useEffect, useState } from "react";
import type { WebGLRenderer } from "three";
import { afterContextLoss, CONTEXT_LOSS } from "@/lib/contextLoss";

/**
 * Watches a scene's canvas for a lost WebGL context (lib/contextLoss.ts):
 * `generation` keys a fresh canvas, `mounted` is false while the dead one
 * is off the page and for good once it gives up (`onFallback`). Pass
 * `onCreated` to the R3F Canvas. R3F loses its own context on purpose as
 * it unmounts; that canvas has left the page by then and is ignored.
 */
export function useContextLoss(onFallback?: () => void) {
  const [state, setState] = useState({ generation: 0, mounted: true, losses: 0 });

  const onCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    const canvas = gl.domElement;
    const lost = () => {
      // Looked at a task later: an unmount has removed the canvas by then, a real loss has not.
      setTimeout(() => {
        if (!canvas.isConnected) return;
        canvas.removeEventListener("webglcontextlost", lost);
        setState((s) => (s.mounted ? { ...s, mounted: false, losses: s.losses + 1 } : s));
      }, 0);
    };
    canvas.addEventListener("webglcontextlost", lost);
  }, []);

  const fallback = !state.mounted && afterContextLoss(state.losses) === "fallback";
  useEffect(() => {
    if (state.mounted) return;
    if (fallback) {
      onFallback?.();
      return;
    }
    const timer = setTimeout(() => setState((s) => ({ ...s, generation: s.generation + 1, mounted: true })), CONTEXT_LOSS.delayMs);
    return () => clearTimeout(timer);
  }, [state.mounted, fallback, onFallback]);

  return { generation: state.generation, mounted: state.mounted, onCreated };
}
