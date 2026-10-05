/**
 * The world's pace answers the visitor: she has the wheel. Forward input
 * fills a meter (viewport heights per second, decaying); the pace runs from
 * x1 (the cruise, 18 m/s) to x2 with it, rising fast and falling slowly,
 * and a light FOV kick widens the lens near the top. Held input at a wall
 * still shows up here, so pushing is never silent. While the film waits for
 * her (the title before her first input, or once she has stopped) the car
 * eases down to a crawl, about 13 km/h, and surges back on her next input:
 * a film playing on its own would keep its speed.
 *
 * Only the drive distance step scales: `drive.speed` stays 18 and nothing
 * ever stops or runs backwards, so traffic, the roadside and the shaders
 * stay coherent (see DriveClock).
 */

export const THROTTLE = {
  /** Meter decay time constant, seconds. */
  tau: 0.2,
  /** Meter rate (viewport heights per second) that gives 63% of the gain. */
  half: 0.5,
  /** Pace added at full throttle: x1 to x(1 + gain). */
  gain: 1.0,
  /** Pace easing time constants, seconds: up fast, down slowly. */
  rise: 0.15,
  fall: 0.5,
  /**
   * Pace while the film waits for her: the car coasts (3.6 m/s, 13 km/h),
   * a 12 m lane dash taking over three seconds to pass, instead of
   * cruising. At x0.35 (23 km/h) the captures still read as driving.
   */
  crawl: 0.2,
  /** Seconds she has been still (and the picture with her) before the car slows to the crawl. */
  crawlIdle: 1,
  /** From this pace the transport reads FF. */
  ff: 1.6,
  /** Widest FOV kick, degrees. */
  fovMax: 1.8,
  /** Throttle fed by one Space/PageDown press or a tap, and by one arrow press (viewport heights). */
  keyStep: 0.3,
  arrowStep: 0.12,
} as const;

/** Rate in viewport heights per second, as of `at` (seconds). */
export type Meter = { rate: number; at: number };

function decayTo(meter: Meter, nowS: number): number {
  const dt = Math.max(0, nowS - meter.at);
  return meter.rate * Math.exp(-dt / THROTTLE.tau);
}

/** Adds forward input (viewport heights) at `nowS`; backward input is ignored. */
export function feedMeter(meter: Meter, vh: number, nowS: number): void {
  meter.rate = decayTo(meter, nowS) + Math.max(0, vh) / THROTTLE.tau;
  meter.at = nowS;
}

/** The meter's rate at `nowS`, decayed lazily. */
export function meterRate(meter: Meter, nowS: number): number {
  return decayTo(meter, nowS);
}

/** Target pace for a meter rate: 1 at rest, approaching 1 + gain. */
export function paceFor(rate: number): number {
  return 1 + THROTTLE.gain * (1 - Math.exp(-Math.max(0, rate) / THROTTLE.half));
}

/** The pace the world heads for: the crawl while she waits, else the meter's. */
export function paceTarget(rate: number, waiting: boolean): number {
  return waiting ? THROTTLE.crawl : paceFor(rate);
}

/** Eases the pace toward its target: rises with `rise`, falls with `fall`; stays in [crawl, 1 + gain]. */
export function easePace(pace: number, target: number, dt: number): number {
  const tau = target > pace ? THROTTLE.rise : THROTTLE.fall;
  const next = pace + (target - pace) * (1 - Math.exp(-Math.max(0, dt) / tau));
  return Math.min(1 + THROTTLE.gain, Math.max(THROTTLE.crawl, next));
}

/** Degrees added to the vertical FOV at a pace: none at cruise, fovMax at x2. */
export function fovKick(pace: number): number {
  const t = Math.min(1, Math.max(0, (pace - 1.2) / 0.8));
  return THROTTLE.fovMax * t * t * (3 - 2 * t);
}
