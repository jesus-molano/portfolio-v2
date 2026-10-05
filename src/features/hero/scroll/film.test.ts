import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  buildTimeline,
  FILM,
  type FilmLayout,
  type FilmTimeline,
  forwardLimit,
  readingSeconds,
  type ScriptLine,
} from "./film";
import { SHOT_COUNT } from "../scene/shots";

const LAYOUT: FilmLayout = { shotCount: SHOT_COUNT, captionsFrom: 0.1, captionsTo: 0.93 };
/** The shot each script line plays in, as LINE_SHOTS in HeroStage. */
const SHOTS = [0, 1, 1, 2, 3, 4];

function script(lines: string[][]): ScriptLine[] {
  return lines.map((cards, i) => ({ shot: SHOTS[i], cards }));
}

describe("readingSeconds", () => {
  it("never goes below the minimum", () => {
    expect(readingSeconds("…to an AI.")).toBe(FILM.minCardSeconds);
  });

  it("grows with the length of the card", () => {
    expect(readingSeconds("a".repeat(60))).toBeGreaterThan(readingSeconds("a".repeat(30)));
    expect(readingSeconds("a".repeat(68))).toBeCloseTo(FILM.findSeconds + 4, 5);
  });

  it("counts an ellipsis and accented letters as one character", () => {
    expect(readingSeconds("é…".repeat(30))).toBeCloseTo(readingSeconds("ab".repeat(30)), 5);
  });
});

describe("buildTimeline", () => {
  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const lines = script(dict.hero.lines);
    const timeline = buildTimeline(lines, LAYOUT);

    it(`${locale}: has one beat per card, in order, without overlaps`, () => {
      expect(timeline.beats).toHaveLength(dict.hero.lines.flat().length);
      timeline.beats.forEach((beat, i) => {
        expect(beat.end).toBeGreaterThan(beat.start);
        if (i > 0) expect(beat.start).toBeGreaterThan(timeline.beats[i - 1].end);
      });
    });

    it(`${locale}: keeps every card inside its shot and the caption range`, () => {
      timeline.beats.forEach((beat) => {
        const shot = lines[beat.line].shot;
        expect(beat.start).toBeGreaterThanOrEqual(Math.max(shot / LAYOUT.shotCount, LAYOUT.captionsFrom));
        expect(beat.end).toBeLessThanOrEqual(Math.min((shot + 1) / LAYOUT.shotCount, LAYOUT.captionsTo));
      });
    });

    it(`${locale}: gives each card its reading time at the segment speed`, () => {
      timeline.beats.forEach((beat) => {
        const speed = forwardLimit(beat.start, timeline);
        expect((beat.end - beat.start) / speed).toBeGreaterThanOrEqual(beat.seconds - 1e-9);
      });
    });

    it(`${locale}: keeps every card short enough to read at a glance`, () => {
      dict.hero.lines.flat().forEach((card) => expect(Array.from(card).length).toBeLessThanOrEqual(64));
    });
  }

  it("holds a shot before and after its line when the shot asks for it", () => {
    const lines: ScriptLine[] = [{ shot: 3, cards: ["Let's go to work."] }];
    const plain = buildTimeline(lines, LAYOUT);
    const held = buildTimeline(lines, { ...LAYOUT, shotTiming: [, , , { leadIn: 4.5, tail: 1.5 }] });
    const seconds = (t: FilmTimeline) => (t.segments[0].end - t.segments[0].start) / t.segments[0].speed;
    expect(seconds(held)).toBeCloseTo(4.5 + readingSeconds("Let's go to work.") + 1.5, 5);
    expect(seconds(held)).toBeGreaterThan(seconds(plain));
    // The line lands late in the shot, after the hold.
    const segment = held.segments[0];
    expect((held.beats[0].start - segment.start) / segment.speed).toBeCloseTo(4.5, 5);
  });

  it("leaves shots without subtitles at the travel speed", () => {
    const card = "A card long enough to slow the shot below the travel pace.";
    const timeline = buildTimeline([{ shot: 1, cards: [card, card] }], LAYOUT);
    expect(forwardLimit(0.05, timeline)).toBe(FILM.travelSpeed);
    expect(forwardLimit(0.6, timeline)).toBe(FILM.travelSpeed);
    expect(forwardLimit(0.3, timeline)).toBeLessThan(FILM.travelSpeed);
  });
});
