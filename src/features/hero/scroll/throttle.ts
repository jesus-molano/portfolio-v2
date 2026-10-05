/**
 * The world's pace answers the visitor: she has the wheel. Forward input
 * fills a meter (viewport heights per second, decaying); the pace runs from
 * x1 (the cruise, 18 m/s) to x2 with it, rising fast and falling slowly,
 * and a light FOV kick widens the lens near the top. Held input at a wall
 * still shows up here, so pushing is never silent. While the film waits for
 * her (the title before her first input, or once she has stopped where
 * nothing is playing) the car brakes to a crawl, about 13 km/h, and lower
 * still after a long wait, about 10 km/h; her next input gets it going
 * again. A film playing on its own would keep its speed.
 *
 * Two pieces of hysteresis keep a calm reader's car from lurching: the
 * brake only starts once the wait has lasted a moment (WAIT.delay) and
 * eases in, and a light push gets the car back up from the crawl like an
 * accelerating car, not a jump; a hard push still surges at once.
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
   * Rising from below the cruise (the crawl) under a light push: the car
   * accelerates instead of jumping. A hard push (`hardRate` and over) rises
   * with `rise`.
   */
  riseFromCrawl: 0.4,
  hardRate: 1.5,
  /**
   * Pace while the film waits for her: the car coasts (3.6 m/s, 13 km/h),
   * a 12 m lane dash taking over three seconds to pass, instead of
   * cruising. At x0.35 (23 km/h) the captures still read as driving.
   */
  crawl: 0.2,
  /** After a long wait (WAIT.deepAfter) the car crawls lower still: 2.7 m/s, 10 km/h. */
  deepCrawl: 0.15,
  /** Seconds she has been still (and the picture with her) before the film waits for her. */
  crawlIdle: 1,
  /** From this pace, held for `ffHold` seconds, the readout reads FLAT OUT... */
  ff: 1.6,
  ffHold: 0.6,
  /** ...until the pace falls under this one (hysteresis: no flicker at the threshold). */
  ffOff: 1.45,
  /** Widest FOV kick, degrees. */
  fovMax: 1.8,
  /** Throttle fed by one Space/PageDown press or a tap, and by one arrow press (viewport heights). */
  keyStep: 0.3,
  arrowStep: 0.12,
} as const;

/**
 * How the car brakes while the film waits, in seconds of waiting: nothing
 * for `delay`, then down to the crawl over `ramp`; after `deepAfter` it
 * eases on down to the deep crawl over `deepRamp`, and the wait's cues
 * escalate (HeroStage).
 */
export const WAIT = { delay: 0.5, ramp: 1.5, deepAfter: 4, deepRamp: 1.5 } as const;

/** Rate in viewport heights per second, as of `at` (seconds). */
export type Meter = { rate: number; at: number };

function decayTo(meter: Meter, nowS: number): number {
  const dt = Math.max(0, nowS - meter.at);
  return meter.rate * Math.exp(-dt / THROTTLE.tau);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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

/** Target pace after `waitingFor` seconds of waiting: the cruise, braking to the crawl, then the deep crawl. */
export function waitPace(waitingFor: number): number {
  const w = Math.max(0, waitingFor);
  const brake = smoothstep(WAIT.delay, WAIT.delay + WAIT.ramp, w);
  const deep = smoothstep(WAIT.deepAfter, WAIT.deepAfter + WAIT.deepRamp, w);
  return 1 - (1 - THROTTLE.crawl) * brake - (THROTTLE.crawl - THROTTLE.deepCrawl) * deep;
}

/**
 * The pace the world heads for: braking toward the crawl while the film
 * waits for her (`waitingFor` seconds, or null when it does not), the
 * meter's otherwise.
 */
export function paceTarget(rate: number, waitingFor: number | null): number {
  return waitingFor === null ? paceFor(rate) : waitPace(waitingFor);
}

/**
 * Eases the pace toward its target: falls with `fall`; rises with `rise`,
 * or, from below the cruise, with `riseFromCrawl` for a light push
 * (`rate` under `hardRate`) when `gentle`. Stays in [deepCrawl, 1 + gain].
 */
export function easePace(pace: number, target: number, dt: number, rate = Number.POSITIVE_INFINITY, gentle = false): number {
  let tau: number = THROTTLE.fall;
  if (target > pace) {
    const hard = smoothstep(0.3, THROTTLE.hardRate, rate);
    tau = gentle && pace < 1 ? THROTTLE.riseFromCrawl + (THROTTLE.rise - THROTTLE.riseFromCrawl) * hard : THROTTLE.rise;
  }
  const next = pace + (target - pace) * (1 - Math.exp(-Math.max(0, dt) / tau));
  return clampPace(next);
}

/** The pace DriveClock may use: never below the deep crawl, never above x2. */
export function clampPace(pace: number): number {
  return Math.min(1 + THROTTLE.gain, Math.max(THROTTLE.deepCrawl, pace));
}

/** Degrees added to the vertical FOV at a pace: none at cruise, fovMax at x2. */
export function fovKick(pace: number): number {
  const t = Math.min(1, Math.max(0, (pace - 1.2) / 0.8));
  return THROTTLE.fovMax * t * t * (3 - 2 * t);
}
