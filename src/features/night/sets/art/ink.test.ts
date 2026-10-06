import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { inkOrigin, roleLine } from "./ink";

describe("ink centring", () => {
  it("puts the ink box's centre on the origin, whatever the side bearings", () => {
    // A glyph run whose ink starts 6 px right of the pen and ends 120 px right of it.
    const m = { actualBoundingBoxLeft: -6, actualBoundingBoxRight: 120, actualBoundingBoxAscent: 70, actualBoundingBoxDescent: 2 };
    const { x, y, squeeze } = inkOrigin(m, 1000);
    expect(squeeze).toBe(1);
    // Ink spans x + 6 .. x + 120 and y - 70 .. y + 2: both centred on 0.
    expect(x + 6 + (x + 120)).toBeCloseTo(0);
    expect(y - 70 + (y + 2)).toBeCloseTo(0);
  });

  it("squeezes a line that is wider than its room, never stretches one", () => {
    const m = { actualBoundingBoxLeft: 0, actualBoundingBoxRight: 400, actualBoundingBoxAscent: 50, actualBoundingBoxDescent: 0 };
    expect(inkOrigin(m, 200).squeeze).toBeCloseTo(0.5);
    expect(inkOrigin(m, 800).squeeze).toBe(1);
  });
});

describe("the Heuristik role line", () => {
  it("drops the ticker's loop separators at the ends in both languages", () => {
    for (const dictionary of [en, es]) {
      const line = roleLine(dictionary.work.stops.heuristik.board.ticker);
      expect(line.startsWith("◆")).toBe(false);
      expect(line.endsWith("◆")).toBe(false);
      expect(line).toContain("FRONTEND ENGINEER ◆ ");
      expect(line).not.toMatch(/\s{2}/);
    }
  });
});
