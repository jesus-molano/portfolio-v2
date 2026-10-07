import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { openingAt } from "./opening";
import { workTimeline } from "./workTimeline";

describe("the stage's opening", () => {
  for (const [name, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const timeline = workTimeline(dict.work);

    it(`never draws the chapter card and the chrome at once (${name})`, () => {
      for (let i = 0; i <= 4000; i += 1) {
        const p = i / 4000;
        const at = openingAt(timeline, p);
        if (at.chrome) expect(1 - at.titleOut, `p ${p}`).toBeLessThanOrEqual(0.05);
      }
    });

    it(`brings the chrome up early in the drive's first beat (${name})`, () => {
      const first = timeline.beats[1];
      expect(first.id).toBe("army.arrive");
      expect(openingAt(timeline, first.start + (first.end - first.start) * 0.5).chrome).toBe(true);
      expect(openingAt(timeline, first.start).chrome).toBe(false);
      expect(openingAt(timeline, 1).chrome).toBe(false);
    });

    it(`opens on the chapter card with the night fading up under it, no line to wait on (${name})`, () => {
      const [title, first] = timeline.beats;
      expect(title.kind).toBe("title");
      expect(first.kind).not.toBe("card");
      expect(openingAt(timeline, title.start).sceneIn).toBe(0);
      expect(openingAt(timeline, (title.start + title.end) / 2).sceneIn).toBeCloseTo(0.5, 6);
      // The whole picture is up by the end of the card's own beat, which holds it 1.2 s.
      expect(openingAt(timeline, first.start).sceneIn).toBe(1);
      expect(openingAt(timeline, first.start).titleOut).toBe(0);
    });
  }
});
