import { describe, expect, it } from "vitest";
import { easePace, feedMeter, fovKick, type Meter, meterRate, paceFor, paceTarget, THROTTLE } from "./throttle";

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

  it("never eases below the crawl or above x2", () => {
    expect(easePace(1, 0.1, 10)).toBe(THROTTLE.crawl);
    expect(easePace(2, 5, 1)).toBe(2);
  });
});

describe("waiting for her", () => {
  it("heads for the crawl while she waits, for the meter otherwise", () => {
    expect(paceTarget(0, true)).toBe(THROTTLE.crawl);
    expect(paceTarget(3, true)).toBe(THROTTLE.crawl);
    expect(paceTarget(0, false)).toBe(1);
    expect(paceTarget(3, false)).toBe(paceFor(3));
  });

  it("slows the car to a crawl gently, and surges back on her next notch", () => {
    let pace = 1;
    let t = 0;
    while (pace > THROTTLE.crawl + 0.05 && t < 5) {
      pace = easePace(pace, paceTarget(0, true), FRAME);
      t += FRAME;
    }
    // A brake, not a stop: about a second and a half to the crawl, and never below it.
    expect(t).toBeGreaterThan(1);
    expect(t).toBeLessThan(2.5);
    expect(pace).toBeGreaterThanOrEqual(THROTTLE.crawl);
    // One notch: the car surges at once, three times its crawl within 0.1 s
    // and back above the cruise within 0.2 s.
    const meter: Meter = { rate: 0, at: 0 };
    feedMeter(meter, 100 / 900, 0);
    let s = 0;
    const until = (end: number) => {
      for (; s < end - 1e-9; s += FRAME) pace = easePace(pace, paceTarget(meterRate(meter, s + FRAME), false), FRAME);
    };
    until(0.1);
    expect(pace).toBeGreaterThan(3 * THROTTLE.crawl);
    until(0.2);
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
