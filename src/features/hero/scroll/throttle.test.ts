import { describe, expect, it } from "vitest";
import {
  clampPace,
  easePace,
  feedMeter,
  fovKick,
  type Meter,
  meterRate,
  paceFor,
  paceTarget,
  THROTTLE,
  WAIT,
  waitPace,
} from "./throttle";

const FRAME = 1 / 60;

/** Pace over time for wheel notches of `px` at `perSecond`, on a viewport `vh` tall. */
function paceCurve(perSecond: number, seconds: number, px = 100, vh = 900): number[] {
  const meter: Meter = { rate: 0, at: 0 };
  let pace = 1;
  let next = 0;
  const out: number[] = [];
  for (let t = 0; t < seconds; t += FRAME) {
    while (perSecond > 0 && next <= t + 1e-9) {
      feedMeter(meter, px / vh, next);
      next += 1 / perSecond;
    }
    pace = easePace(pace, paceFor(meterRate(meter, t + FRAME)), FRAME);
    out.push(pace);
  }
  return out;
}

describe("paceFor", () => {
  it("cruises at x1 at rest and never passes x2", () => {
    expect(paceFor(0)).toBe(1);
    expect(paceFor(-3)).toBe(1);
    let previous = 1;
    for (let rate = 0; rate <= 50; rate += 0.25) {
      const pace = paceFor(rate);
      expect(pace).toBeGreaterThanOrEqual(previous);
      expect(pace).toBeLessThanOrEqual(1 + THROTTLE.gain);
      previous = pace;
    }
  });
});

describe("the throttle", () => {
  it("surges on a single notch from rest", () => {
    const curve = paceCurve(0, 0.2);
    const meter: Meter = { rate: 0, at: 0 };
    feedMeter(meter, 100 / 900, 0);
    let pace = 1;
    for (let t = FRAME; t <= 0.1 + 1e-9; t += FRAME) pace = easePace(pace, paceFor(meterRate(meter, t)), FRAME);
    expect(curve.every((p) => p === 1)).toBe(true);
    expect(pace).toBeGreaterThanOrEqual(1.25);
  });

  it("reads FF only from about five notches a second", () => {
    expect(Math.max(...paceCurve(3, 6))).toBeLessThan(THROTTLE.ff);
    const frantic = paceCurve(15, 2);
    expect(frantic.findIndex((p) => p >= THROTTLE.ff) * FRAME).toBeLessThanOrEqual(0.4);
  });

  it("falls more slowly than it rises", () => {
    let pace = 1;
    let rise = 0;
    while (pace < 1.5) {
      pace = easePace(pace, 2, FRAME);
      rise += FRAME;
    }
    let fall = 0;
    pace = 2;
    while (pace > 1.5) {
      pace = easePace(pace, 1, FRAME);
      fall += FRAME;
    }
    expect(fall).toBeGreaterThan(rise * 2);
  });

  it("halves the meter in tau * ln 2 and ignores backward input", () => {
    const meter: Meter = { rate: 0, at: 0 };
    feedMeter(meter, 1, 0);
    const start = meterRate(meter, 0);
    expect(meterRate(meter, THROTTLE.tau * Math.LN2)).toBeCloseTo(start / 2, 10);
    feedMeter(meter, -5, 0);
    expect(meterRate(meter, 0)).toBeCloseTo(start, 10);
  });

  it("never eases below the deep crawl or above x2", () => {
    expect(easePace(1, 0.1, 10)).toBe(THROTTLE.deepCrawl);
    expect(easePace(2, 5, 1)).toBe(2);
    expect(clampPace(0)).toBe(THROTTLE.deepCrawl);
    expect(clampPace(9)).toBe(1 + THROTTLE.gain);
  });
});

describe("waiting for her", () => {
  it("heads for the wait's brake while she waits, for the meter otherwise", () => {
    expect(paceTarget(0, 0)).toBe(1);
    expect(paceTarget(3, 30)).toBeCloseTo(THROTTLE.deepCrawl, 10);
    expect(paceTarget(0, null)).toBe(1);
    expect(paceTarget(3, null)).toBe(paceFor(3));
  });

  it("brakes only once the wait has lasted a moment, to the crawl, then lower after a long wait", () => {
    expect(waitPace(0)).toBe(1);
    expect(waitPace(WAIT.delay)).toBe(1);
    expect(waitPace(WAIT.delay + WAIT.ramp)).toBeCloseTo(THROTTLE.crawl, 10);
    expect(waitPace(WAIT.deepAfter)).toBeCloseTo(THROTTLE.crawl, 10);
    expect(waitPace(WAIT.deepAfter + WAIT.deepRamp)).toBeCloseTo(THROTTLE.deepCrawl, 10);
    expect(waitPace(600)).toBeCloseTo(THROTTLE.deepCrawl, 10);
    let previous = 1;
    for (let t = 0; t <= 10; t += 0.05) {
      expect(waitPace(t)).toBeLessThanOrEqual(previous + 1e-12);
      previous = waitPace(t);
    }
    // About 0.15 of the cruise after a long wait: 10 km/h.
    expect(THROTTLE.deepCrawl).toBeGreaterThanOrEqual(0.12);
    expect(THROTTLE.deepCrawl).toBeLessThan(THROTTLE.crawl);
  });

  it("slows the car to a crawl gently, and gets it going on her next notch", () => {
    let pace = 1;
    let t = 0;
    while (pace > THROTTLE.crawl + 0.05 && t < 6) {
      pace = easePace(pace, paceTarget(0, t), FRAME, 0, true);
      t += FRAME;
    }
    // A brake, not a stop: under three seconds to the crawl, and never below the deep crawl.
    expect(t).toBeGreaterThan(1.5);
    expect(t).toBeLessThan(3);
    expect(pace).toBeGreaterThanOrEqual(THROTTLE.deepCrawl);
    // One notch from the crawl: the car pulls away at once, like a car, not
    // a jump; it doubles within 0.1 s and is back at the cruise within a second.
    const meter: Meter = { rate: 0, at: 0 };
    feedMeter(meter, 100 / 900, 0);
    const from = pace;
    let s = 0;
    const until = (end: number) => {
      for (; s < end - 1e-9; s += FRAME) {
        const rate = meterRate(meter, s + FRAME);
        pace = easePace(pace, paceTarget(rate, null), FRAME, rate, true);
      }
    };
    until(0.1);
    expect(pace).toBeGreaterThan(1.5 * from);
    expect(pace).toBeLessThan(0.75);
    until(1);
    expect(pace).toBeGreaterThan(0.95);
  });

  it("surges from the crawl at once under a hard push", () => {
    const meter: Meter = { rate: 0, at: 0 };
    let pace: number = THROTTLE.crawl;
    for (let s = 0; s < 0.2 - 1e-9; s += FRAME) {
      feedMeter(meter, 100 / 900, s);
      const rate = meterRate(meter, s + FRAME);
      pace = easePace(pace, paceTarget(rate, null), FRAME, rate, true);
    }
    expect(pace).toBeGreaterThan(1);
  });

  it("coasts while waiting: under a quarter of the cruise", () => {
    expect(THROTTLE.crawl).toBeGreaterThanOrEqual(0.15);
    expect(THROTTLE.crawl).toBeLessThanOrEqual(0.25);
  });
});

describe("fovKick", () => {
  it("widens the lens only near full throttle", () => {
    expect(fovKick(1)).toBe(0);
    expect(fovKick(1.2)).toBe(0);
    expect(fovKick(2)).toBeCloseTo(THROTTLE.fovMax, 10);
    expect(fovKick(1.6)).toBeGreaterThan(0);
    expect(fovKick(1.6)).toBeLessThan(THROTTLE.fovMax);
  });
});
