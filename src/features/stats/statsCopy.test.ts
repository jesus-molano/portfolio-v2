import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Dictionary } from "@/i18n/dictionaries";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { Stats } from "./Stats";
import { PLACES, SIDE_BLIPS } from "./statsLayout";

/** Every string under a value, with its path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

describe("STATS copy", () => {
  it("has the same keys, lists and value types in English and Spanish", () => {
    expect(shape(es.stats)).toEqual(shape(en.stats));
  });

  it("keeps the parody place names the same in both languages, like street signs", () => {
    expect(es.stats.map.places).toEqual(en.stats.map.places);
    expect(es.stats.map.inset.city).toBe(en.stats.map.inset.city);
  });

  it("names every place the map or the legend uses", () => {
    const names = Object.keys(en.stats.map.places);
    for (const place of PLACES) expect(names).toContain(place.id);
    for (const blip of SIDE_BLIPS) expect(names).toContain(blip.place);
  });

  it("has a caption for every side activity, short enough for the map", () => {
    for (const dict of [en, es]) {
      for (const blip of SIDE_BLIPS) {
        const caption = blip.id === "booth" ? dict.stats.map.booth.caption : dict.stats.map.blips[blip.id];
        expect(caption, blip.id).toBeTruthy();
        expect(Array.from(caption).length, blip.id).toBeLessThanOrEqual(42);
      }
    }
  });

  it("says LIVE in English in both files, and nowhere outside the missions", () => {
    for (const dict of [en, es]) {
      expect(dict.stats.missions.live).toBe("LIVE");
      for (const [path, text] of strings(dict.stats)) {
        if (path.startsWith("missions.")) continue;
        expect(/\blive\b|en directo/i.test(text), path).toBe(false);
      }
    }
  });

  it("gives the F1 nod by the number 33, never by a current car number", () => {
    for (const dict of [en, es]) {
      expect(dict.stats.map.blips.pit).toMatch(/\b33\b/);
      expect(dict.stats.map.blips.pit).not.toMatch(/\b[13]\b/);
    }
  });

  it("never places him in Madrid, never says he works remotely and never shows an email", () => {
    for (const dict of [en, es]) {
      for (const [path, text] of strings(dict.stats)) {
        expect(/madrid|remot|teletrabajo|home office|@/i.test(text), `${path}: ${text}`).toBe(false);
      }
    }
  });

  it("never counts the cats in a record, and draws no halo anywhere", () => {
    for (const dict of [en, es]) {
      // The line-up shows the four of them; a count here only raised the question of the fourth.
      for (const record of dict.stats.records.items) {
        const text = `${record.value} ${record.spoken} ${record.caption}`;
        expect(text, record.id).not.toMatch(/\d\s*\+\s*\d|\bcats?\b|\bgat[oa]s?\b|odin/i);
      }
      // Dante's record is his wanted level: five stars, said in words to a screen reader.
      const wanted = dict.stats.records.items.find((record) => record.id === "wanted");
      expect(wanted?.value).toBe("★★★★★");
      expect(wanted?.caption).toMatch(/Dante/);
      for (const [path, text] of strings(dict.stats)) {
        expect(/halo|aureola|from above|desde arriba|keeping watch|vigilando/i.test(text), `${path}: ${text}`).toBe(false);
      }
      const html = renderToStaticMarkup(createElement(Stats, { dict: dict.stats as Dictionary["stats"] }));
      expect(html).not.toMatch(/halo|<svg[^>]*viewBox="0 0 40 12"/i);
    }
  });

  it("says each record's value in words for screen readers, and tells the sofa once", () => {
    for (const dict of [en, es]) {
      for (const record of dict.stats.records.items) expect(record.spoken, record.id).toMatch(/\p{L}/u);
      const sofa = strings(dict.stats).filter(([, text]) => /sofa|sofá/i.test(text));
      expect(sofa.map(([path]) => path)).toEqual(["bars.items[0].caption"]);
    }
  });

  it("shows Heuristik by its role only", () => {
    for (const dict of [en, es]) {
      expect(dict.stats.missions.items.heuristik).toEqual({ name: "Heuristik", role: "Frontend Engineer" });
    }
  });

  it("puts one bar past 100 % (appetite) and keeps the others within 0 to 100", () => {
    for (const dict of [en, es]) {
      const over = dict.stats.bars.items.filter((bar) => bar.value > 100).map((bar) => bar.id);
      expect(over).toEqual(["appetite"]);
      for (const bar of dict.stats.bars.items) expect(bar.value).toBeGreaterThanOrEqual(0);
    }
  });
});
