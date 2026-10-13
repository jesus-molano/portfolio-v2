import { HALF_RATE_HZ } from "./degrade";

/**
 * How often the canvases draw (frameDriver.ts): on every refresh, or, at
 * half rate (degrade.ts `halfRate`, a GPU that cannot keep up with a fast
 * display), on every second one of a display of 118 Hz or more, evenly,
 * while the page itself (Lenis, the cards, the dash) keeps the display's
 * own rate. A frame that misses its refresh shows for two, so a GPU just
 * short of 144 frames a second showed them for one refresh and then two,
 * over and over: a judder worse than a steady 72.
 *
 * The display's rate is read from the page's own animation frames, never
 * assumed: the intervals between frames in which no canvas drew (a canvas
 * that keeps the GPU busy stretches the frames themselves, so frames that
 * drew measure the GPU, not the display). Their 20th percentile: stalls
 * (a long task, a collection) only ever lengthen an interval.
 *
 * While a canvas draws every frame no frame is idle, and the rate read
 * before can go stale: the window moved to another display, a laptop on
 * battery dropped its panel to 60 Hz, a power mode (Chrome's Energy Saver,
 * iOS's Low Power Mode) holds the page at 30 frames a second. Every frame
 * then came late against the old rate, and the quality monitor stepped a
 * GPU that kept up down the whole ladder. So a step down at full pace is
 * checked first when the rate was not read lately (`rateTrusted`): the
 * canvases draw on every second frame for a moment, the frames between
 * read the rate again, and a new one (`rateChanged`) is taken instead of a
 * step. A steady cadence alone proves nothing: a GPU that takes 20 ms a
 * frame at 60 Hz shows every frame for two refreshes, as a display at 30
 * Hz would, but its idle frames still come every refresh.
 */
export const PACING = {
  /** Intervals outside this range say nothing of the display (a stalled frame; nothing refreshes faster than about 650 Hz). */
  minMs: 1.5,
  maxMs: 50,
  /** Intervals needed before a rate is trusted. */
  samples: 30,
  /** Where among the sorted intervals the display's own is read. */
  quantile: 0.2,
  /** The rate assumed until one is measured. */
  defaultHz: 60,
  /** A rate this much off the one known is a new one (another display, a power mode). */
  rateChange: 0.02,
  /** A rate read this recently (ms) needs no check before a step down. */
  trustMs: 10_000,
  /** While the rate is checked, the canvases draw on every this-many-th frame, counted (never timed by the rate in doubt). */
  checkDivisor: 2,
  /** Fresh idle intervals the check reads the rate from: a moment at half rate (0.4 s at 60 Hz), not seconds. */
  checkSamples: 12,
  /** Frames after which a check that read nothing gives up and steps down: the canvas is that slow. */
  checkFrames: 60,
} as const;

/**
 * The display's refresh rate in Hz from the intervals (ms) between
 * animation frames in which no canvas drew, or null until there are
 * `minSamples` of them. `scratch`, as long as the intervals, saves the copy
 * it sorts.
 */
export function refreshFromIdle(
  deltasMs: ArrayLike<number>,
  scratch?: Float64Array,
  minSamples: number = PACING.samples,
): number | null {
  const kept = scratch && scratch.length >= deltasMs.length ? scratch : new Float64Array(deltasMs.length);
  let n = 0;
  for (let i = 0; i < deltasMs.length; i += 1) {
    const delta = deltasMs[i];
    if (delta >= PACING.minMs && delta <= PACING.maxMs) {
      kept[n] = delta;
      n += 1;
    }
  }
  if (n < Math.max(1, minSamples)) return null;
  const sorted = kept.subarray(0, n).sort();
  return 1000 / sorted[Math.floor(PACING.quantile * (n - 1))];
}

/** One refresh of the display, in ms (60 Hz's until it is measured). */
export function vsyncMs(hz: number | null): number {
  return 1000 / (hz !== null && hz > 0 ? hz : PACING.defaultHz);
}

/** Whether the rate read at `readAt` (ms, null: never) is recent enough to judge a canvas's frames by at `now`. */
export function rateTrusted(readAt: number | null, now: number): boolean {
  return readAt !== null && now - readAt <= PACING.trustMs;
}

/**
 * Whether a rate measured now is another than the one the canvas's frames
 * were judged by (`assumedHz`: the known rate, or 60 Hz's while none was
 * measured): then they were late only against a rate the display no
 * longer has.
 */
export function rateChanged(assumedHz: number | null, measuredHz: number): boolean {
  const assumed = assumedHz !== null && assumedHz > 0 ? assumedHz : PACING.defaultHz;
  return Math.abs(measuredHz - assumed) > assumed * PACING.rateChange;
}

/**
 * On which refresh the canvases draw: every one, or at half rate on a
 * display of 118 Hz or more the one that keeps them near 60 to 80 frames a
 * second (120, 144 and 165 Hz every second refresh, 240 Hz every fourth,
 * 300 Hz every fifth, 360 Hz every sixth). Never paced on a display of 100
 * Hz or less, nor before its rate is known.
 */
export function paceDivisor(hz: number | null, halfRate: boolean): number {
  if (!halfRate || hz === null || !(hz >= HALF_RATE_HZ)) return 1;
  return Math.max(1, Math.floor((hz + 2) / 60));
}

/** The interval between two frames of a canvas that keeps up at this pace, in ms (the quality monitor's measure). */
export function frameIntervalMs(hz: number | null, divisor: number): number {
  return Math.max(1, divisor) * vsyncMs(hz);
}

/**
 * Whether a canvas that draws every frame draws in this one: always at
 * full rate and after a rest; paced, once `divisor` refreshes have gone by
 * since it last drew, less half a refresh, so a late frame never pushes
 * the next one a whole refresh later.
 */
export function renderThisTick(now: number, lastAt: number | null, divisor: number, refreshMs: number): boolean {
  if (divisor <= 1 || lastAt === null) return true;
  return now - lastAt >= (divisor - 0.5) * refreshMs;
}

/** A canvas's own clock: when it last drew, or null while it rests. */
export type RootClock = { lastAt: number | null };

/**
 * Steps a canvas's clock to `now` (ms) and returns the seconds since it
 * last drew: 0 on its first frame after a rest, so the scene's time (the
 * clouds, the water, the palms) carries on from where it stopped instead of
 * jumping by the whole rest (R3F's own clock started again from zero at
 * every change of the frame loop, and every animation jumped back).
 */
export function stepRootClock(clock: RootClock, now: number): number {
  const last = clock.lastAt;
  clock.lastAt = now;
  return last === null ? 0 : Math.max(0, now - last) / 1000;
}
