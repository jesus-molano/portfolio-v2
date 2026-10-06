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

    it(`brings the chrome up during the bridge line, and the night over all of it (${name})`, () => {
      const bridge = timeline.beats[1];
      expect(openingAt(timeline, bridge.start + (bridge.end - bridge.start) * 0.5).chrome).toBe(true);
      expect(openingAt(timeline, bridge.start + (bridge.end - bridge.start) * 0.5).sceneIn).toBeCloseTo(0.5, 6);
      expect(openingAt(timeline, bridge.start).chrome).toBe(false);
      expect(openingAt(timeline, 1).chrome).toBe(false);
    });
  }
});
