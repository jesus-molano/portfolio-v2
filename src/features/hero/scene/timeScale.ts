/**
 * Slow motion for the drive. A plain mutable object, like `drive` and
 * `heroProgress`: the radio wheel sets `target` (0.25 while it is open),
 * DriveClock eases `value` toward it every frame and multiplies it into the
 * drive speed. Nothing else in the scene reads it.
 */
export const timeScale = {
  value: 1,
  target: 1,
};

/** The drive while the radio wheel is open. */
export const SLOW_MOTION = 0.25;

/** About 95% of the way to the target in 0.3 s: quick, but never a jump. */
const RATE = 10;

/**
 * One frame of exponential easing from `value` toward `target` over `dt`
 * seconds, independent of the frame rate.
 */
export function easeTimeScale(value: number, target: number, dt: number, rate = RATE): number {
  if (!(dt > 0)) return value;
  const next = target + (value - target) * Math.exp(-rate * dt);
  return Math.abs(next - target) < 1e-4 ? target : next;
}
