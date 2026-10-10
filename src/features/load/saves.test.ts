import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  completeLabel,
  currentSave,
  QUICKEST,
  SAVE_IDS,
  saveHref,
  SAVES,
  slotKey,
  slotMove,
  THUMB_WIDTHS,
  thumbSrcSet,
} from "./saves";

describe("the save slots", () => {
  it("are the page's parts in its order, the story further on at each", () => {
    expect(SAVES.map((save) => save.id)).toEqual([...SAVE_IDS]);
    for (let i = 1; i < SAVES.length; i += 1) expect(SAVES[i].complete).toBeGreaterThan(SAVES[i - 1].complete);
    expect(SAVES[0].complete).toBe(0);
    expect(SAVES.at(-1)?.complete).toBeLessThan(100);
  });

  it("tag the quickest look at him and the contact, once each", () => {
    expect(SAVES.filter((save) => save.tag === "quickest").map((save) => save.id)).toEqual([QUICKEST]);
    expect(SAVES.filter((save) => save.tag === "contact").map((save) => save.target)).toEqual(["contact"]);
  });

  it("link to their part's anchor", () => {
    expect(SAVES.map(saveHref)).toEqual(["#main", "#suspects", "#work", "#stats", "#projects", "#contact"]);
  });
});

describe("the arrows in the slots' grid", () => {
  it("step through the page's order left and right, never past either end", () => {
    expect(slotMove(0, "ArrowRight", 2)).toBe(1);
    expect(slotMove(1, "ArrowLeft", 2)).toBe(0);
    expect(slotMove(0, "ArrowLeft", 2)).toBe(0);
    expect(slotMove(5, "ArrowRight", 2)).toBe(5);
  });

  it("go a row up and down in two columns, and a slot at a time in one", () => {
    expect(slotMove(1, "ArrowDown", 2)).toBe(3);
    expect(slotMove(3, "ArrowUp", 2)).toBe(1);
    expect(slotMove(4, "ArrowDown", 2)).toBe(4);
    expect(slotMove(0, "ArrowUp", 2)).toBe(0);
    expect(slotMove(2, "ArrowDown", 1)).toBe(3);
    expect(slotMove(2, "ArrowUp", 1)).toBe(1);
  });

  it("go to the first and the last with Home and End", () => {
    expect(slotMove(3, "Home", 2)).toBe(0);
    expect(slotMove(0, "End", 1)).toBe(5);
  });

  it("are the arrows and Home and End only, never with a modifier", () => {
    const k = (key: string, extra = {}) => slotKey({ key, ctrlKey: false, altKey: false, metaKey: false, ...extra });
    expect(k("ArrowDown")).toBe("ArrowDown");
    expect(k("End")).toBe("End");
    expect(k("Enter")).toBeNull();
    expect(k(" ")).toBeNull();
    expect(k("ArrowDown", { altKey: true })).toBeNull();
  });
});

describe("where she is on the page", () => {
  const tops = [0, 4000, 6000, 30000, 33000, 38000];
  it("is the last part whose top has come up past the middle of the screen", () => {
    expect(currentSave(tops, 0, 900)).toBe(0);
    expect(currentSave(tops, 3600, 900)).toBe(1);
    expect(currentSave(tops, 3500, 900)).toBe(0);
    expect(currentSave(tops, 31000, 900)).toBe(3);
    expect(currentSave(tops, 40000, 900)).toBe(5);
  });

  it("skips a part it could not find", () => {
    expect(currentSave([0, Number.NaN, 6000], 7000, 900)).toBe(2);
  });
});

describe("the slots' pictures", () => {
  it("are on disk at every width, in both formats and, where they carry words, per locale", () => {
    for (const save of SAVES) {
      for (const locale of ["en", "es"]) {
        for (const format of ["avif", "webp"] as const) {
          const set = thumbSrcSet(save.id, locale, format);
          const files = set.split(", ").map((entry) => entry.split(" ")[0]);
          expect(files).toHaveLength(THUMB_WIDTHS.length);
          for (const file of files) expect(existsSync(join(process.cwd(), "public", file)), file).toBe(true);
        }
      }
    }
    expect(thumbSrcSet("projects", "es", "webp")).toContain("/load/projects-es-160.webp 160w");
    expect(thumbSrcSet("stats", "es", "webp")).toBe("/load/stats-160.webp 160w, /load/stats-320.webp 320w");
  });
});

describe("how far into the story a save stands", () => {
  it("reads in each language's own way", () => {
    expect(completeLabel("{n} % completado", 70)).toBe("70 % completado");
    expect(completeLabel("{n}% complete", 0)).toBe("0% complete");
  });
});
