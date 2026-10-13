"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { stableScreen } from "@/lib/screen";
import type { QualityTier } from "../useQualityTier";
import { ratioOn, type Screen } from "./degrade";
import { getQuality, getServerQuality, registerScreen, subscribeQuality } from "./qualityStore";

/** The window as the canvases fill it: its width, the stable large screen's height and the screen's pixel ratio. */
type Viewport = { width: number; height: number; ratio: number };

const SERVER_VIEWPORT: Viewport = { width: 1440, height: 900, ratio: 1 };

/** A resize is read once it has settled: a window dragged wider reallocated every target at each step. */
const RESIZE_SETTLE_MS = 250;

let viewport: Viewport | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function readViewport(): Viewport {
  return { width: window.innerWidth, height: stableScreen().large, ratio: window.devicePixelRatio || 1 };
}

function getViewport(): Viewport {
  viewport ??= readViewport();
  return viewport;
}

function onResize() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const next = readViewport();
    const prev = getViewport();
    if (next.width === prev.width && next.height === prev.height && next.ratio === prev.ratio) return;
    viewport = next;
    listeners.forEach((listener) => listener());
  }, RESIZE_SETTLE_MS);
}

function subscribeViewport(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("resize", onResize);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("resize", onResize);
    clearTimeout(timer);
  };
}

const getServerLevel = () => getServerQuality().level;
const getLevel = () => getQuality().level;
const getServerViewport = () => SERVER_VIEWPORT;

/**
 * The pixel ratio a canvas draws at: the visit's quality level (its pixel
 * budget, floor and ceiling, degrade.ts) over the window it fills. The host
 * owns it, since R3F applies its Canvas's `dpr` prop again at every render
 * of the host; a bar-only resize on a phone changes nothing here
 * (lib/screen.ts), so the targets are never reallocated for it. The screen
 * is handed to the quality store too, so a step down skips the levels that
 * would draw this canvas the same (degrade.ts `nextLevel`).
 */
export function useCanvasDpr(tier: QualityTier): number {
  const level = useSyncExternalStore(subscribeQuality, getLevel, getServerLevel);
  const view = useSyncExternalStore(subscribeViewport, getViewport, getServerViewport);
  const screen = useMemo<Screen>(
    () => ({ tier, cssWidth: view.width, cssHeight: view.height, deviceRatio: view.ratio }),
    [tier, view],
  );
  useEffect(() => registerScreen(screen), [screen]);
  return ratioOn(screen, level);
}
