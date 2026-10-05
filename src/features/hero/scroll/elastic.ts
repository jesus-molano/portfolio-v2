/**
 * Rubber band for input held at a wall: the active card (or the title)
 * gives a little under a push and springs back, like the end of a list on
 * a phone. Wheel pushes bounce it a few pixels past a small dead zone; a
 * finger stretches it further, scaled with the viewport.
 */

export const ELASTIC = {
  /** Largest wheel bounce, px, and the held pixels it ignores. */
  wheelMax: 8,
  wheelDeadZone: 16,
  /** Largest touch stretch: this share of the viewport height, at most touchMax px. */
  touchShare: 0.06,
  touchMax: 48,
  /** Held pixels decay with this time constant after a wheel push (s). */
  wheelTau: 0.15,
  /** ...and after the finger lifts. */
  releaseTau: 0.12,
  /** A knock (Space or a tap on an unread card) pushes this share of the viewport. */
  knock: 0.12,
  /** The socket flash fades with this time constant (s). */
  pushTau: 0.12,
} as const;

/** Displacement for `x` pixels of push: linear at first, never reaching `max`. */
export function rubberBand(x: number, max: number, c = 0.55): number {
  if (max <= 0 || x <= 0) return 0;
  return max * (1 - 1 / ((c * x) / max + 1));
}

/** Largest touch stretch on a viewport `vh` pixels tall. */
export function touchStretchMax(vh: number): number {
  return Math.min(ELASTIC.touchShare * vh, ELASTIC.touchMax);
}

/** Exponential decay of `value` over `dt` seconds with time constant `tau`. */
export function decay(value: number, dt: number, tau: number): number {
  if (tau <= 0) return 0;
  return value * Math.exp(-Math.max(0, dt) / tau);
}
