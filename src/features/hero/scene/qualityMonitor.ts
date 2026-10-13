/**
 * Whether the canvas keeps up, from the intervals between the frames it
 * draws: one-second windows, a window bad when more than a fifth of its
 * frames came late (over 1.25 times the interval expected), and two bad
 * windows in a row a decline (degrade.ts), at most one every two seconds.
 *
 * It replaces drei's PerformanceMonitor, which averaged the frame rate over
 * its samples and took its bounds from the fastest rate it had seen: at 60
 * Hz it stepped down only below about 40 frames a second, above 100 Hz it
 * barely ever did, and uneven frames (a vsync missed every few frames, the
 * judder she sees) averaged out. Counting late frames sees the judder.
 *
 * A frame over 250 ms is a hitch (a texture upload, a collection, a wake),
 * not a level: it is left out, and the monitor waits a second. Only the
 * first of a run, though: a canvas whose every frame takes longer (a
 * masked renderer judged top, on a weak GPU and a large screen) never
 * stepped down, each slow frame quieting the monitor for the next, so from
 * the second in a row on each one counts as a late frame. The samples the
 * caller marks as skipped (a wake, a load hold, a hidden tab) are left out
 * too, and so is every sample while the monitor is quiet (`quietUntil`). A
 * skipped sample also starts the window again: what came before it says
 * nothing about what comes after.
 */
export const MONITOR = {
  windowMs: 1000,
  lateFactor: 1.25,
  lateShare: 0.2,
  badWindows: 2,
  minGapMs: 2000,
  hitchMs: 250,
  /** How long a hitch quiets the monitor. */
  hitchQuietMs: 1000,
} as const;

export type Monitor = {
  /** Samples before this performance.now() are left out. */
  quietUntil: number;
  /** Start of the window being counted (NaN: none yet). */
  windowStart: number;
  samples: number;
  late: number;
  /** Bad windows in a row. */
  badRun: number;
  lastDeclineAt: number;
  /** Intervals in a row over a hitch's length (or none at all), this one included. */
  longRun: number;
};

export function newMonitor(quietUntil = Number.NEGATIVE_INFINITY): Monitor {
  return {
    quietUntil,
    windowStart: Number.NaN,
    samples: 0,
    late: 0,
    badRun: 0,
    lastDeclineAt: Number.NEGATIVE_INFINITY,
    longRun: 0,
  };
}

function restart(m: Monitor) {
  m.windowStart = Number.NaN;
  m.samples = 0;
  m.late = 0;
  m.badRun = 0;
}

/** Leaves out every sample until `until` (the first second after a wake or a new level), and starts again after it. */
export function quietMonitor(m: Monitor, until: number) {
  if (until > m.quietUntil) m.quietUntil = until;
  restart(m);
}

export type MonitorSample = {
  /** performance.now() of this frame. */
  now: number;
  /** Since the frame before, in ms (NaN: the first frame after a rest). */
  intervalMs: number;
  /** The interval a frame takes when the canvas keeps up (the display's, or twice it at half rate). */
  expectedMs: number;
  /** Nothing to learn from this frame (a wake, a load hold, a hidden tab). */
  skip: boolean;
};

/** Counts one frame; true when the canvas should step down now. Allocates nothing. */
export function stepMonitor(m: Monitor, { now, intervalMs, expectedMs, skip }: MonitorSample): boolean {
  // The first long one of a run is a hitch, or the gap of a rest (a canvas out of view, a hidden tab).
  const long = !(intervalMs <= MONITOR.hitchMs);
  m.longRun = long ? m.longRun + 1 : 0;
  if (m.longRun === 1) quietMonitor(m, now + MONITOR.hitchQuietMs);
  if (skip || now < m.quietUntil || !Number.isFinite(intervalMs) || !(expectedMs > 0)) {
    restart(m);
    return false;
  }
  if (intervalMs <= 0) return false;
  // A frame of a slow run is one late frame, however long: it spans no more of the window than a hitch.
  if (Number.isNaN(m.windowStart)) m.windowStart = now - Math.min(intervalMs, MONITOR.hitchMs);
  m.samples += 1;
  if (long || intervalMs > expectedMs * MONITOR.lateFactor) m.late += 1;
  if (now - m.windowStart < MONITOR.windowMs) return false;

  const bad = m.late > m.samples * MONITOR.lateShare;
  m.badRun = bad ? m.badRun + 1 : 0;
  m.windowStart = now;
  m.samples = 0;
  m.late = 0;
  if (m.badRun < MONITOR.badWindows || now - m.lastDeclineAt < MONITOR.minGapMs) return false;
  m.badRun = 0;
  m.lastDeclineAt = now;
  return true;
}
