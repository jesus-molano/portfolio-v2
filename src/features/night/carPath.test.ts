import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { workTimeline } from "@/features/work/workTimeline";
import { arriveX, CAR_PATH, carAt, carLegs, leaveX, stopAt } from "./carPath";

describe("the car's legs", () => {
  it("cruises in, then brakes to the stop line without a jump in its speed", () => {
    const steps = 400;
    let last = arriveX(30, 0.6, 0);
    let lastStep = Number.NaN;
    expect(last).toBe(-30);
    for (let i = 1; i <= steps; i += 1) {
      const x = arriveX(30, 0.6, i / steps);
      const step = x - last;
      expect(step).toBeGreaterThanOrEqual(0);
      // Never faster than the step before: the speed is constant, then falls.
      if (Number.isFinite(lastStep)) expect(step).toBeLessThanOrEqual(lastStep + 1e-6);
      // No step is a jump.
      expect(step).toBeLessThan((30 / steps) * 2);
      lastStep = step;
      last = x;
    }
    expect(arriveX(30, 0.6, 1)).toBe(0);
    expect(arriveX(30, 0.6, Number.NaN)).toBe(-30);
  });

  it("pulls away from rest", () => {
    expect(leaveX(18, 0)).toBe(0);
    expect(leaveX(18, 1)).toBe(18);
    expect(leaveX(18, 0.1)).toBeLessThan(leaveX(18, 1) * 0.1);
  });
});

describe("carAt", () => {
  for (const [name, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const timeline = workTimeline(dict.work);
    const at = (id: string, t: number) => {
      const beat = timeline.beats.find((b) => b.id === id);
      if (!beat) throw new Error(id);
      return beat.start + (beat.end - beat.start) * t;
    };

    it(`moves continuously inside every stop, from the first frame (${name})`, () => {
      // Sampled finely: inside a stop the car never moves more than a car at 100 km/h does in a few milliseconds.
      const samples = 20000;
      let last = carAt(timeline, 0);
      const first = { ...last };
      expect(first.x).toBe(CAR_PATH.firstFrom);
      for (let i = 1; i <= samples; i += 1) {
        const now = { ...carAt(timeline, i / samples) };
        if (now.stop === last.stop) expect(Math.abs(now.x - last.x)).toBeLessThan(0.15);
        else {
          // A cut: the last stop's car has pulled away, the next one's is still up the road.
          expect(last.x).toBeGreaterThan(CAR_PATH.leaveTo * 0.9);
          expect(now.x).toBeLessThan(CAR_PATH.arriveFrom * 0.95);
        }
        last = now;
      }
    });

    it(`is up the road and out of the light while the title holds (${name})`, () => {
      expect(carAt(timeline, at("title", 0.5)).x).toBe(CAR_PATH.firstFrom);
      // Rolls in under the bridge line, never stands at the board before it gets there.
      const bridgeMid = carAt(timeline, at("bridge", 0.5)).x;
      expect(bridgeMid).toBeGreaterThan(CAR_PATH.firstFrom);
      expect(bridgeMid).toBeLessThan(-10);
      expect(carAt(timeline, at("army.arrive", 0.5)).x).toBeLessThan(0);
      expect(carAt(timeline, at("army.arrive", 1) - 1e-9).x).toBeGreaterThan(-0.05);
    });

    it(`arrives at, waits at and leaves every stop (${name})`, () => {
      for (const id of ["pwc", "cloud", "logixs", "heuristik"]) {
        const early = carAt(timeline, at(`${id}.open`, 0.02));
        expect(early.x).toBeLessThan(-30);
        expect(early.brake).toBe(0);
        expect(carAt(timeline, at(`${id}.open`, 0.7)).x).toBeLessThan(0);
        const card = carAt(timeline, at(`${id}.card0`, 0.5));
        expect(card.x).toBe(0);
        expect(card.brake).toBe(1);
      }
      for (const id of ["army", "pwc", "cloud", "logixs"]) {
        const going = carAt(timeline, at(`${id}.leave`, 0.5));
        expect(going.x).toBeGreaterThan(0);
        expect(going.brake).toBe(0);
      }
      expect(carLegs(timeline).filter((leg) => leg.kind === "leave")).toHaveLength(4);
      expect(carLegs(timeline).filter((leg) => leg.kind === "arrive")).toHaveLength(5);
    });

    it(`puts the title and the bridge on the first stop (${name})`, () => {
      expect(stopAt(timeline, 0)).toBe(0);
      expect(stopAt(timeline, at("bridge", 0.5))).toBe(0);
      expect(stopAt(timeline, at("pwc.open", 0))).toBe(1);
      expect(stopAt(timeline, 1)).toBe(4);
    });
  }
});
