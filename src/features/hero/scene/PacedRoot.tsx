"use client";

import { useStore, useThree, type RootState } from "@react-three/fiber";
import { useEffect, useLayoutEffect } from "react";
import { redrawSoon, registerRoot, requestFrames } from "./frameDriver";

type Props = {
  /** Names the canvas (`hero`, `night`). */
  id: string;
  /** Whether it draws every frame now (frameDriver.ts). A function of the module, never one written in a render. */
  wants: (now: number) => boolean;
  /** Frames asked of it at rest wait while this holds. */
  holds?: (state: RootState) => boolean;
  /** It wants to draw again after a rest. */
  onWake?: () => void;
};

/**
 * Hands its canvas to the frame driver (frameDriver.ts), which draws it in
 * the page's frame; the Canvas runs `frameloop="never"` for as long as this
 * is mounted. The first child of the hero's canvas, so its layout effect
 * registers the canvas before any other part asks it for a frame (those
 * asked earlier are kept anyway). A canvas built again (a lost context, a
 * new tier) mounts a new one and registers again.
 */
export function PacedRoot({ id, wants, holds, onWake }: Props) {
  const get = useThree((state) => state.get);
  const store = useStore();

  useLayoutEffect(() => registerRoot({ id, get, wants, holds, onWake }), [id, get, wants, holds, onWake]);

  // A new size or pixel ratio (a resize, a quality level landing) clears the canvas's buffer: one that is
  // drawing is drawn again before the page paints (a level lands after the frame has drawn, and the
  // cleared buffer showed black for a frame), and one at rest draws once more. R3F asks for that frame on
  // any change of its store, but not under "never". Its own subscription, made with the store, has
  // resized the renderer by now.
  useEffect(() => {
    let { width, height } = store.getState().size;
    let dpr = store.getState().viewport.dpr;
    return store.subscribe((state) => {
      if (state.size.width === width && state.size.height === height && state.viewport.dpr === dpr) return;
      width = state.size.width;
      height = state.size.height;
      dpr = state.viewport.dpr;
      requestFrames(get);
      redrawSoon(get);
    });
  }, [store, get]);

  return null;
}
