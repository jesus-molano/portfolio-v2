/**
 * The Cloud District trivision: 24 triangular prisms that turn 120 degrees
 * at a time in a wave from left to right, so each face shows a client. The
 * turn follows the scroll; the hover ripple twists the prisms near the
 * pointer toward the next face.
 */

export const TRIVISION = {
  prisms: 24,
  /** Width of the wave, in prisms. */
  wave: 6,
  /** Largest hover twist, radians (35 degrees). */
  rippleMax: (35 * Math.PI) / 180,
  /** Width of the ripple, in prisms. */
  rippleWidth: 1.6,
} as const;

const STEP = (2 * Math.PI) / 3;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Smoothstep easing, 0..1. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * The turn of prism `i` (radians) while the board flips from `face` to the
 * next one, `u` 0..1 along the flip. Exactly `face × 120°` at u = 0 and
 * `(face + 1) × 120°` at u = 1, with the left prisms leading.
 */
export function prismAngle(i: number, face: number, u: number, n: number = TRIVISION.prisms): number {
  const w = TRIVISION.wave;
  const local = clamp01((clamp01(u) * (n + w) - i) / w);
  return STEP * (face + ease(local));
}

/** The hover twist of prism `i` with the pointer over prism `at` (fractional), `amount` 0..1. */
export function rippleAngle(i: number, at: number, amount: number): number {
  if (!Number.isFinite(at)) return 0;
  const d = (i - at) / TRIVISION.rippleWidth;
  return TRIVISION.rippleMax * clamp01(amount) * Math.exp(-d * d);
}
