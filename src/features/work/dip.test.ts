import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { carAt } from "@/features/night/carPath";
import { DIP_MIN, dipAt, newDipView, stageCuts, stepDipView } from "./dip";
import { workTimeline } from "./workTimeline";

describe("the dip to night between two stops", () => {
  for (const [name, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const timeline = workTimeline(dict.work);

    it(`covers every cut fully, and only the cuts (${name})`, () => {
      const cuts = stageCuts(timeline);
      expect(cuts).toHaveLength(4);
      for (const cut of cuts) {
        expect(dipAt(timeline, cut.at)).toBe(1);
        // The stop changes exactly under the night.
        expect(carAt(timeline, cut.at - 1e-7).stop).toBe(carAt(timeline, cut.at + 1e-7).stop - 1);
      }
      for (const beat of timeline.beats) {
        if (beat.kind === "card") {
          for (const t of [0, 0.5, 1]) expect(dipAt(timeline, beat.start + (beat.end - beat.start) * t)).toBe(0);
        }
      }
    });

    it(`fades smoothly, never in one frame (${name})`, () => {
      const samples = 20000;
      let last = dipAt(timeline, 0);
      for (let i = 1; i <= samples; i += 1) {
        const now = dipAt(timeline, i / samples);
        expect(Math.abs(now - last)).toBeLessThan(0.02);
        last = now;
      }
    });

    it(`lets the car leave the shot before the night closes (${name})`, () => {
      for (const cut of stageCuts(timeline)) {
        // Half way into the dip the car is already well on its way.
        expect(carAt(timeline, cut.at - cut.out / 2).x).toBeGreaterThan(5);
        expect(carAt(timeline, cut.at + cut.in).x).toBeLessThan(-10);
      }
    });
  }

  describe("on screen", () => {
    const timeline = workTimeline(es.work);
    const stopOf = (p: number) => {
      for (let s = timeline.stops.length - 1; s > 0; s -= 1) if (p >= timeline.stops[s].from) return s;
      return 0;
    };

    it("never changes the set in sight, however fast the film crosses a cut", () => {
      const cut = stageCuts(timeline)[1];
      const view = stepDipView(newDipView(), timeline, cut.at - cut.out * 2, stopOf(cut.at - cut.out * 2), 0);
      // One flick: the whole cut in two frames.
      let changedAt = -1;
      const frames = [cut.at + cut.in * 0.5, cut.at + cut.in * 2];
      for (let i = 0; i < 40; i += 1) {
        const p = frames[Math.min(i, frames.length - 1)];
        const before = view.stop;
        stepDipView(view, timeline, p, stopOf(p), 1 / 60);
        if (view.stop !== before) {
          changedAt = i;
          expect(view.dip).toBeGreaterThanOrEqual(0.98);
        }
        if (view.stop === before && before !== stopOf(p)) expect(view.p).toBeLessThan(timeline.stops[before].to);
      }
      // It took at least the fade out's minimum to get there.
      expect(changedAt).toBeGreaterThanOrEqual(Math.floor(DIP_MIN.out * 60) - 1);
      expect(view.stop).toBe(stopOf(frames[1]));
    });

    it("fades back up no faster than its minimum, and follows a slow scroll exactly", () => {
      const cut = stageCuts(timeline)[0];
      const view = stepDipView(newDipView(), timeline, cut.at, stopOf(cut.at), 0);
      expect(view.dip).toBe(1);
      const far = cut.at + cut.in * 3;
      stepDipView(view, timeline, far, stopOf(far), 0.1);
      expect(view.dip).toBeCloseTo(1 - 0.1 / DIP_MIN.in, 6);
      // A slow scroll: the film's own dip, frame after frame.
      const slow = stepDipView(newDipView(), timeline, cut.at - cut.out, stopOf(cut.at - cut.out), 0);
      for (let i = 1; i <= 200; i += 1) {
        const p = cut.at - cut.out + (cut.out * i) / 200;
        stepDipView(slow, timeline, p, stopOf(p), 1 / 60);
        expect(slow.dip).toBeCloseTo(dipAt(timeline, p), 1);
      }
    });

    it("lands at once on a jump", () => {
      const p = timeline.stops[3].from + 0.001;
      const view = stepDipView(newDipView(), timeline, 0.1, stopOf(0.1), 0);
      stepDipView(view, timeline, p, stopOf(p), 0);
      expect(view.stop).toBe(3);
      expect(view.p).toBe(p);
    });
  });
});
