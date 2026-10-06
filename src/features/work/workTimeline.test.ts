import { describe, expect, it } from "vitest";
import { readingSeconds } from "@/features/hero/scroll/film";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  beatAt,
  beatIndexAt,
  beatT,
  buildStageTimeline,
  resolveAt,
  stageHeightVh,
  workBeats,
  workTimeline,
} from "./workTimeline";

describe("buildStageTimeline", () => {
  const timeline = buildStageTimeline([
    { kind: "title", id: "title", seconds: 1, stop: -1 },
    { kind: "card", id: "a", text: "A line that takes a while to read.", stop: 0 },
    { kind: "travel", id: "go", seconds: 1, stop: 0 },
    { kind: "hold", id: "wait", seconds: 2, stop: 1 },
  ]);

  it("gives every beat a share proportional to its seconds", () => {
    const total = timeline.seconds;
    for (const beat of timeline.beats) {
      expect(beat.end - beat.start).toBeCloseTo(beat.seconds / total, 9);
    }
    expect(timeline.beats[0].start).toBe(0);
    expect(timeline.beats.at(-1)?.end).toBe(1);
  });

  it("times cards by their reading time and fades them like the hero", () => {
    const card = beatAt(timeline, "a");
    expect(card.seconds).toBeCloseTo(readingSeconds("A line that takes a while to read."), 9);
    expect(card.fade).toBeGreaterThan(0);
    expect(card.card).toBe(0);
    expect(timeline.cards).toHaveLength(1);
  });

  it("finds the beat at a film position and the position inside it", () => {
    const i = beatIndexAt(timeline, 0.5);
    const beat = timeline.beats[i];
    expect(beat.start).toBeLessThanOrEqual(0.5);
    expect(beat.end).toBeGreaterThan(0.5);
    expect(beatT(beat, beat.start)).toBe(0);
    expect(beatT(beat, beat.end)).toBe(1);
    expect(beatIndexAt(timeline, 1)).toBe(timeline.beats.length - 1);
  });

  it("gives every stop the range of its beats", () => {
    expect(timeline.stops).toHaveLength(2);
    expect(timeline.stops[0].from).toBeCloseTo(beatAt(timeline, "a").start, 9);
    expect(timeline.stops[1].to).toBe(1);
  });

  it("resolves capture names", () => {
    const wait = beatAt(timeline, "wait");
    expect(resolveAt(timeline, "wait@0.5")).toBeCloseTo((wait.start + wait.end) / 2, 9);
    expect(resolveAt(timeline, 0.3)).toBe(0.3);
    expect(resolveAt(timeline, "0.25")).toBe(0.25);
    expect(() => resolveAt(timeline, "nope")).toThrow();
  });
});

describe("the work stage", () => {
  const timelines = [workTimeline(en.work), workTimeline(es.work)];

  it("has the same beats in the same order in both languages", () => {
    expect(workBeats(es.work).map((b) => b.id)).toEqual(workBeats(en.work).map((b) => b.id));
  });

  it("plays the bridge from the cats, five stops, ten cards and ends on the iris", () => {
    for (const timeline of timelines) {
      expect(timeline.stops).toHaveLength(5);
      expect(timeline.cards).toHaveLength(11);
      expect(timeline.beats[0].id).toBe("title");
      expect(timeline.beats[1].id).toBe("bridge");
      expect(timeline.beats.at(-1)?.id).toBe("end");
    }
  });

  // A little longer than the hero: the drives between the stops are held at a drive's pace, the
  // camera reads PwC's blade down to its marquee, and the crane climbs the landmark at a crane's pace.
  it("runs about as long as the hero, at the hero's scroll density", () => {
    const seconds = Math.max(...timelines.map((t) => t.seconds));
    expect(seconds).toBeGreaterThan(38);
    expect(seconds).toBeLessThan(76);
    const vh = stageHeightVh(timelines);
    expect(vh % 10).toBe(0);
    expect(vh).toBeGreaterThanOrEqual(13 * seconds);
  });

  it("holds every drive between two stops, so no fling passes a stop in one frame", () => {
    for (const timeline of timelines) {
      for (const beat of timeline.beats) {
        if (beat.id.endsWith(".open") || beat.id.endsWith(".leave") || beat.id.endsWith(".arrive")) {
          expect(beat.kind, beat.id).toBe("hold");
          expect(beat.seconds, beat.id).toBeGreaterThanOrEqual(1.4);
        }
      }
      expect(timeline.beats.some((beat) => beat.kind === "travel")).toBe(false);
    }
  });

  it("holds the crane before Heuristik's first card", () => {
    for (const timeline of timelines) {
      const crane = beatAt(timeline, "heuristik.crane");
      expect(crane.kind).toBe("hold");
      expect(beatAt(timeline, "heuristik.card0").start).toBeCloseTo(crane.end, 9);
    }
  });
});
