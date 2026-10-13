import { describe, expect, it } from "vitest";
import {
  PACING,
  frameIntervalMs,
  paceDivisor,
  rateChanged,
  rateTrusted,
  refreshFromIdle,
  renderThisTick,
  stepRootClock,
  vsyncMs,
  type RootClock,
} from "./framePacing";

/** `count` intervals of one refresh at `hz`, every `stallEvery`-th one stretched to `stallMs` (a long task). */
function idle(hz: number, count: number, stallEvery = 0, stallMs = 40): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(stallEvery > 0 && i % stallEvery === 0 ? stallMs : 1000 / hz);
  return out;
}

describe("refreshFromIdle", () => {
  it("reads the display's rate from the frames in which no canvas drew", () => {
    expect(refreshFromIdle(idle(60, 60))).toBeCloseTo(60, 3);
    expect(refreshFromIdle(idle(120, 60))).toBeCloseTo(120, 3);
    expect(refreshFromIdle(idle(144, 60))).toBeCloseTo(144, 3);
    expect(refreshFromIdle(idle(165, 60))).toBeCloseTo(165, 3);
    // Chrome's Energy Saver and iOS's Low Power Mode hold the page at 30 frames a second.
    expect(refreshFromIdle(idle(30, 60))).toBeCloseTo(30, 3);
  });

  it("reads the fastest displays too: 240, 300 and 360 Hz", () => {
    expect(refreshFromIdle(idle(240, 60))).toBeCloseTo(240, 3);
    expect(refreshFromIdle(idle(300, 60))).toBeCloseTo(300, 3);
    // 2.8 ms a refresh: under the old 3 ms floor every interval was thrown away, and the rate never read.
    expect(refreshFromIdle(idle(360, 60))).toBeCloseTo(360, 3);
  });

  it("is not fooled by stalls, which only ever lengthen an interval", () => {
    expect(refreshFromIdle(idle(144, 90, 3, 13.9))).toBeCloseTo(144, 3);
    expect(refreshFromIdle(idle(60, 90, 2, 33.3))).toBeCloseTo(60, 3);
  });

  it("leaves out what is no refresh (an interval shorter than any display's, a frame stalled for seconds)", () => {
    const deltas = [...idle(144, 40), 0.2, 0.5, 1, 120, 900, 5000];
    expect(refreshFromIdle(deltas)).toBeCloseTo(144, 3);
  });

  it("waits for enough intervals, a check fewer of them", () => {
    expect(refreshFromIdle(idle(144, PACING.samples - 1))).toBeNull();
    expect(refreshFromIdle([...idle(144, PACING.samples - 1), 300, 300])).toBeNull();
    expect(refreshFromIdle(idle(144, PACING.samples))).toBeCloseTo(144, 3);
    expect(refreshFromIdle(idle(30, PACING.checkSamples - 1), undefined, PACING.checkSamples)).toBeNull();
    expect(refreshFromIdle(idle(30, PACING.checkSamples), undefined, PACING.checkSamples)).toBeCloseTo(30, 3);
  });

  it("sorts in the scratch it is given, without touching the intervals", () => {
    const deltas = idle(120, 60, 4, 25);
    const copy = [...deltas];
    const scratch = new Float64Array(deltas.length);
    expect(refreshFromIdle(deltas, scratch)).toBeCloseTo(120, 3);
    expect(deltas).toEqual(copy);
  });
});

describe("paceDivisor", () => {
  it("draws every refresh unless the canvas went to half rate", () => {
    for (const hz of [60, 120, 144, 165, 240]) expect(paceDivisor(hz, false)).toBe(1);
  });

  it("halves 120 to 165 Hz, and keeps the fastest displays near 60 frames a second", () => {
    expect(paceDivisor(118, true)).toBe(2);
    expect(paceDivisor(119.88, true)).toBe(2);
    expect(paceDivisor(144, true)).toBe(2);
    expect(paceDivisor(165, true)).toBe(2);
    expect(paceDivisor(239.8, true)).toBe(4);
    expect(paceDivisor(240, true)).toBe(4);
    expect(paceDivisor(300, true)).toBe(5);
    expect(paceDivisor(360, true)).toBe(6);
  });

  it("never paces a display of 100 Hz or less, nor one not measured yet", () => {
    for (const hz of [30, 59.94, 60, 75, 90, 100]) expect(paceDivisor(hz, true)).toBe(1);
    expect(paceDivisor(null, true)).toBe(1);
  });
});

describe("the interval a canvas that keeps up draws at", () => {
  it("is one refresh, or the divisor's", () => {
    expect(vsyncMs(null)).toBeCloseTo(1000 / 60, 6);
    expect(vsyncMs(144)).toBeCloseTo(1000 / 144, 6);
    expect(frameIntervalMs(144, 2)).toBeCloseTo(2000 / 144, 6);
    expect(frameIntervalMs(null, 1)).toBeCloseTo(1000 / 60, 6);
  });
});

describe("checking the display's rate before a step down", () => {
  it("trusts a rate read in the last ten seconds, and none never read", () => {
    expect(rateTrusted(null, 1000)).toBe(false);
    expect(rateTrusted(1000, 1000 + PACING.trustMs)).toBe(true);
    expect(rateTrusted(1000, 1001 + PACING.trustMs)).toBe(false);
  });

  it("takes a rate off the one the frames were judged by as a new one (another display, a power mode)", () => {
    expect(rateChanged(144, 60)).toBe(true);
    expect(rateChanged(60, 30)).toBe(true);
    // None measured yet: the frames were judged at 60 Hz.
    expect(rateChanged(null, 30)).toBe(true);
    expect(rateChanged(null, 60)).toBe(false);
    expect(rateChanged(null, 59.94)).toBe(false);
  });

  it("takes the same rate as the same, within a measure's error: then the GPU is behind", () => {
    expect(rateChanged(60, 59.94)).toBe(false);
    expect(rateChanged(144, 143.5)).toBe(false);
    expect(rateChanged(300, 300.4)).toBe(false);
  });
});

describe("renderThisTick", () => {
  const refresh = 1000 / 144;

  it("draws every refresh at full rate", () => {
    let last: number | null = null;
    let drawn = 0;
    for (let i = 0; i < 100; i++) {
      const now = i * refresh;
      if (renderThisTick(now, last, 1, refresh)) {
        drawn++;
        last = now;
      }
    }
    expect(drawn).toBe(100);
  });

  it("draws every second refresh at half rate, evenly", () => {
    let last: number | null = null;
    const at: number[] = [];
    for (let i = 0; i < 100; i++) {
      const now = i * refresh;
      if (renderThisTick(now, last, 2, refresh)) {
        at.push(i);
        last = now;
      }
    }
    expect(at).toHaveLength(50);
    for (let k = 1; k < at.length; k++) expect(at[k] - at[k - 1]).toBe(2);
  });

  it("draws on the first refresh after a rest, and a late one never pushes the next back", () => {
    expect(renderThisTick(5000, null, 2, refresh)).toBe(true);
    // Drawn at 0, the refresh at 2 came late (a dropped frame): drawn at 3, the next at 5.
    expect(renderThisTick(3 * refresh, 0, 2, refresh)).toBe(true);
    expect(renderThisTick(4 * refresh, 3 * refresh, 2, refresh)).toBe(false);
    expect(renderThisTick(5 * refresh + 0.4, 3 * refresh, 2, refresh)).toBe(true);
  });
});

describe("stepRootClock", () => {
  it("runs only while the canvas draws, from where it stopped", () => {
    const clock: RootClock = { lastAt: null };
    expect(stepRootClock(clock, 1000)).toBe(0);
    expect(stepRootClock(clock, 1016)).toBeCloseTo(0.016, 9);
    expect(stepRootClock(clock, 1050)).toBeCloseTo(0.034, 9);
    // At rest, then woken ten seconds later: no jump.
    clock.lastAt = null;
    expect(stepRootClock(clock, 11050)).toBe(0);
    expect(stepRootClock(clock, 11066)).toBeCloseTo(0.016, 9);
  });

  it("never runs backwards", () => {
    const clock: RootClock = { lastAt: 2000 };
    expect(stepRootClock(clock, 1990)).toBe(0);
  });
});
