import { lens } from "./lens";

export type LensState = { focusDistance: number; focusRange: number; bokehScale: number };

/** Below this bokeh scale the depth of field does no work at all. */
const OFF = 1e-3;

/**
 * Sanitises the lens state for the depth of field: a focus range of zero
 * would make the circle-of-confusion smoothstep undefined, a negative bokeh
 * scale means off. `active` is false when the blur would not show.
 */
export function resolveLens(state: LensState): LensState & { active: boolean } {
  const bokehScale = Number.isFinite(state.bokehScale) ? Math.max(0, state.bokehScale) : 0;
  return {
    focusDistance: Number.isFinite(state.focusDistance) ? Math.max(0, state.focusDistance) : 0,
    focusRange: Number.isFinite(state.focusRange) ? Math.max(0.01, state.focusRange) : 0.01,
    bokehScale,
    active: bokehScale > OFF,
  };
}

/**
 * The lens the depth of field reads this frame. In development,
 * `window.__vaLens = { focusDistance, focusRange, bokehScale }` overrides the
 * camera rig's values for framing work; delete it after use.
 */
export function currentLens(): LensState {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    const debug = (window as unknown as { __vaLens?: Partial<LensState> }).__vaLens;
    if (debug) return { ...lens, ...debug };
  }
  return lens;
}
