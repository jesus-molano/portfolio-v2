import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import { workTimeline } from "@/features/work/workTimeline";
import { braking, CAR_PATH, carBeat, carX } from "./carPath";

describe("carPath", () => {
  it("brakes into the stop: monotonic, easing out, ending on the stop line", () => {
    let last = -Infinity;
    let lastStep = Infinity;
    for (let i = 0; i <= 20; i += 1) {
      const x = carX({ kind: "arrive", t: i / 20 });
      expect(x).toBeGreaterThanOrEqual(last);
      if (i > 0) {
        expect(x - last).toBeLessThanOrEqual(lastStep + 1e-9);
        lastStep = x - last;
      }
      last = x;
    }
    expect(carX({ kind: "arrive", t: 0 })).toBe(CAR_PATH.arriveFrom);
    expect(carX({ kind: "arrive", t: 1 })).toBe(0);
  });

  it("leaves from 0 to 8 m and waits at 0 otherwise", () => {
    expect(carX({ kind: "leave", t: 0 })).toBe(0);
    expect(carX({ kind: "leave", t: 1 })).toBe(CAR_PATH.leaveTo);
    expect(carX({ kind: "wait", t: 0.5 })).toBe(0);
    expect(carX({ kind: "arrive", t: Number.NaN })).toBe(CAR_PATH.arriveFrom);
  });

  it("brakes while waiting", () => {
    expect(braking({ kind: "wait", t: 0 })).toBe(true);
    expect(braking({ kind: "leave", t: 0.2 })).toBe(false);
  });
});

describe("carBeat", () => {
  const timeline = workTimeline(en.work);
  const at = (id: string, t: number) => {
    const beat = timeline.beats.find((b) => b.id === id);
    if (!beat) throw new Error(id);
    return beat.start + (beat.end - beat.start) * t;
  };

  it("rolls in through the fade and the arrival, then waits at every stop", () => {
    expect(carBeat(timeline, 0).kind).toBe("arrive");
    expect(carBeat(timeline, at("army.arrive", 1) - 1e-6).t).toBeGreaterThan(0.99);
    expect(carBeat(timeline, at("army.card0", 0.5)).kind).toBe("wait");
    expect(carBeat(timeline, at("heuristik.card1", 0.5)).kind).toBe("wait");
  });

  it("leaves in every leave beat but the last stop's", () => {
    for (const id of ["army", "pwc", "cloud", "logixs"]) {
      const beat = carBeat(timeline, at(`${id}.leave`, 0.5));
      expect(beat.kind).toBe("leave");
      expect(beat.t).toBeCloseTo(0.5, 6);
    }
    expect(timeline.beats.some((b) => b.id === "heuristik.leave")).toBe(false);
  });
});
