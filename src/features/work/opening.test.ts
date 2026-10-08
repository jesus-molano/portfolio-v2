import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { openingAt, TITLE_FADE } from "./opening";
import { stageWalls } from "./workStory";
import { workTimeline } from "./workTimeline";

describe("the stage's opening", () => {
  for (const [name, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const timeline = workTimeline(dict.work);
    const [title, first] = timeline.beats;
    const at = (u: number) => title.start + (title.end - title.start) * u;

    it(`never draws the chapter card and the chrome at once (${name})`, () => {
      for (let i = 0; i <= 4000; i += 1) {
        const p = i / 4000;
        const o = openingAt(timeline, p);
        if (o.chrome) expect(1 - o.titleOut, `p ${p}`).toBeLessThanOrEqual(0.05);
      }
    });

    it(`brings the chrome up as the drive starts, once the card has gone (${name})`, () => {
      expect(first.id).toBe("army.arrive");
      expect(openingAt(timeline, first.start).chrome).toBe(true);
      expect(openingAt(timeline, at(0.9)).chrome).toBe(false);
      expect(openingAt(timeline, 1).chrome).toBe(false);
    });

    it(`opens on the chapter card with the night fading up under it, no line to wait on (${name})`, () => {
      expect(title.kind).toBe("title");
      expect(first.kind).not.toBe("card");
      expect(openingAt(timeline, title.start).sceneIn).toBe(0);
      expect(openingAt(timeline, at(0.5)).sceneIn).toBeCloseTo(0.5, 6);
      expect(openingAt(timeline, first.start).sceneIn).toBe(1);
    });

    it(`lets the card leave with her scroll past its title wall, inside its own beat (${name})`, () => {
      const wall = stageWalls(timeline)[0];
      expect(wall.kind).toBe("title");
      // Fully up while the title wall holds it, gone before the drive's first held beat.
      expect(openingAt(timeline, wall.to).titleOut).toBe(0);
      expect(openingAt(timeline, at(TITLE_FADE.from)).titleOut).toBe(0);
      expect(openingAt(timeline, at(TITLE_FADE.to)).titleOut).toBe(1);
      expect(openingAt(timeline, first.start).titleOut).toBe(1);
    });
  }
});
