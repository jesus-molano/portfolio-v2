import { describe, expect, it } from "vitest";
import { MONITOR, newMonitor, quietMonitor, stepMonitor, type Monitor } from "./qualityMonitor";

const VSYNC = 1000 / 60;

/**
 * Feeds `seconds` of frames from `from`: every `every`-th frame comes
 * `lateMs` late instead of on time. Returns the times it declined and
 * where it got to.
 */
function run(
  m: Monitor,
  { from = 0, seconds, every = 0, lateMs = VSYNC * 2, expectedMs = VSYNC, skip = () => false }: {
    from?: number;
    seconds: number;
    every?: number;
    lateMs?: number;
    expectedMs?: number;
    skip?: (now: number) => boolean;
  },
): { declines: number[]; end: number } {
  const declines: number[] = [];
  let now = from;
  let frame = 0;
  while (now - from < seconds * 1000) {
    frame += 1;
    const intervalMs = every > 0 && frame % every === 0 ? lateMs : expectedMs;
    now += intervalMs;
    if (stepMonitor(m, { now, intervalMs, expectedMs, skip: skip(now) })) declines.push(now);
  }
  return { declines, end: now };
}

describe("stepMonitor", () => {
  it("never declines a canvas that keeps up, for a minute", () => {
    expect(run(newMonitor(), { seconds: 60 }).declines).toEqual([]);
  });

  it("forgives a late frame now and then: a tenth of them never adds up to a bad window", () => {
    expect(run(newMonitor(), { seconds: 60, every: 10 }).declines).toEqual([]);
  });

  it("declines once two windows in a row have a quarter of their frames late", () => {
    const { declines } = run(newMonitor(), { seconds: 2.5, every: 4 });
    expect(declines).toHaveLength(1);
    expect(declines[0]).toBeGreaterThanOrEqual(2 * MONITOR.windowMs);
  });

  it("leaves two seconds between two declines, however bad the frames", () => {
    const { declines } = run(newMonitor(), { seconds: 10, every: 2 });
    expect(declines.length).toBeGreaterThan(1);
    for (let i = 1; i < declines.length; i++) {
      expect(declines[i] - declines[i - 1]).toBeGreaterThanOrEqual(MONITOR.minGapMs);
    }
  });

  it("measures against the interval expected: at half rate two refreshes a frame are on time", () => {
    const m = newMonitor();
    expect(run(m, { seconds: 10, expectedMs: VSYNC * 2 }).declines).toEqual([]);
    // The same frames against a full-rate display: every one of them late.
    expect(run(newMonitor(), { seconds: 3, expectedMs: VSYNC * 2, every: 1, lateMs: VSYNC * 2 }).declines).toEqual([]);
    const late = newMonitor();
    let declined = false;
    let now = 0;
    for (let i = 0; i < 200; i++) {
      now += VSYNC * 2;
      declined ||= stepMonitor(late, { now, intervalMs: VSYNC * 2, expectedMs: VSYNC, skip: false });
    }
    expect(declined).toBe(true);
  });

  it("leaves hitches out: a frame over 250 ms is no level", () => {
    const m = newMonitor();
    let now = 0;
    let declined = false;
    for (let i = 0; i < 20; i++) {
      // A hitch of 300 ms every half second, frames on time between them.
      for (let k = 0; k < 30; k++) {
        now += VSYNC;
        declined ||= stepMonitor(m, { now, intervalMs: VSYNC, expectedMs: VSYNC, skip: false });
      }
      now += MONITOR.hitchMs + 50;
      declined ||= stepMonitor(m, { now, intervalMs: MONITOR.hitchMs + 50, expectedMs: VSYNC, skip: false });
    }
    expect(declined).toBe(false);
  });

  it("learns nothing from skipped frames, and starts its window again after them", () => {
    // Bad frames, but every other second skipped: never two bad windows in a row.
    const skip = (now: number) => Math.floor(now / 1000) % 2 === 1;
    expect(run(newMonitor(), { seconds: 20, every: 2, skip }).declines).toEqual([]);
    // All skipped: nothing.
    expect(run(newMonitor(), { seconds: 20, every: 2, skip: () => true }).declines).toEqual([]);
  });

  it("stays quiet until it is told, then counts from there", () => {
    const m = newMonitor(5000);
    const quiet = run(m, { seconds: 5, every: 2 });
    expect(quiet.declines).toEqual([]);
    const after = run(m, { from: quiet.end, seconds: 2.5, every: 2 });
    expect(after.declines).toHaveLength(1);
    // Two whole windows after the quiet ends (the first starts with the frame that ended it).
    expect(after.declines[0]).toBeGreaterThanOrEqual(5000 + 2 * MONITOR.windowMs - VSYNC * 2);
  });

  it("forgets a bad window once quieted (a wake, a new level)", () => {
    const m = newMonitor();
    const first = run(m, { seconds: 1.1, every: 2 });
    expect(m.badRun).toBe(1);
    quietMonitor(m, first.end + 1000);
    expect(m.badRun).toBe(0);
    const second = run(m, { from: first.end, seconds: 1.05, every: 2 });
    expect(second.declines).toEqual([]);
  });
});
