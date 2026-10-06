import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { chapterVars } from "./ChapterCard";
import { chapterLayout, ribbonCaps } from "./chapterLayout";

/** The sections that open on a card. */
const SECTIONS = ["suspects", "stats", "projects", "credits"] as const;

describe("chapterVars", () => {
  it("gives a section its card's height and edge line as shares of the card's width, for every chapter", () => {
    for (const [lang, dict] of [
      ["en", en],
      ["es", es],
    ] as const) {
      for (const section of SECTIONS) {
        const chapter = dict[section].chapter;
        const where = `${lang} ${section}`;
        const layout = chapterLayout(chapter.word, ribbonCaps(chapter.ribbon, lang));
        const vars = chapterVars(chapter, lang) as Record<string, string>;
        expect(Object.keys(vars).sort(), where).toEqual(["--chapter-edge", "--chapter-h"]);
        expect(Number(vars["--chapter-h"]), where).toBeCloseTo(layout.height / 1000, 4);
        expect(Number(vars["--chapter-edge"]), where).toBeCloseTo(layout.edge / 1000, 4);
        // Bare numbers, so the stylesheets can multiply a length by them.
        for (const value of Object.values(vars)) expect(value, where).toMatch(/^0\.\d{4}$/);
      }
    }
  });

  it("lays the ribbon out in the card's own language's capitals", () => {
    const chapter = { word: "La banda", ribbon: "Sospechosos habituales" };
    const layout = chapterLayout(chapter.word, ribbonCaps(chapter.ribbon, "es"));
    expect(chapterVars(chapter, "es")).toEqual({
      "--chapter-edge": (layout.edge / 1000).toFixed(4),
      "--chapter-h": (layout.height / 1000).toFixed(4),
    });
  });
});
