import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { chipDomain, STOPS, stopLinks } from "./stops";

describe("stops", () => {
  it("runs in order with an anchor each", () => {
    STOPS.forEach((stop, i) => {
      expect(stop.index).toBe(i + 1);
      expect(stop.anchor).toBe(`work-${stop.id}`);
    });
  });

  it("links every employer but the army, which opens its service record", () => {
    for (const stop of STOPS) {
      if (stop.id === "army") expect(stop.href).toBeNull();
      else expect(stop.href).not.toBeNull();
    }
    for (const url of stopLinks()) expect(url).toMatch(/^https:\/\//);
  });

  it("only the live job has no end year", () => {
    expect(STOPS.filter((stop) => stop.years[1] === null).map((s) => s.id)).toEqual(["heuristik"]);
  });

  it("names the destination at the start of every chip's accessible name", () => {
    for (const dict of [en, es]) {
      for (const stop of STOPS) {
        const copy = dict.work.stops[stop.id];
        if (stop.href) {
          const href = stop.href[dict === en ? "en" : "es"];
          expect(copy.chip.startsWith(chipDomain(href))).toBe(true);
        }
        const visible = copy.chip.replace(/\s*[▸↗]$/, "");
        expect(copy.chipName.startsWith(visible)).toBe(true);
      }
    }
  });
});

describe("work copy", () => {
  const dicts = [
    ["en", en.work],
    ["es", es.work],
  ] as const;

  for (const [locale, work] of dicts) {
    it(`${locale}: keeps every card short enough for one subtitle`, () => {
      for (const stop of Object.values(work.stops)) {
        for (const card of stop.cards) expect(Array.from(card).length, card).toBeLessThanOrEqual(64);
      }
    });

    it(`${locale}: says LIVE in English and keeps Heuristik to its role and dates`, () => {
      expect(work.live).toBe("LIVE");
      const text = JSON.stringify(work.stops.heuristik).toLowerCase();
      for (const word of [" now", "today", " hoy", "ahora", "remote", "remoto", "teletrabajo", "madrid", "tenerife"]) {
        expect(text).not.toContain(word);
      }
    });

    it(`${locale}: never places a civilian job in Madrid or calls it remote`, () => {
      const { stops } = work;
      for (const id of ["pwc", "cloud-district", "logixs", "heuristik"] as const) {
        // The client is Retech, never "Retech Madrid", and no civilian job has a city.
        const text = JSON.stringify(stops[id]).toLowerCase();
        expect(text, id).not.toContain("madrid");
        expect(text, id).not.toMatch(/remot/);
        expect(text, id).not.toMatch(/santa cruz|tenerife|comunidad de/);
      }
      expect(JSON.stringify(work).toLowerCase()).not.toMatch(/remote|remoto|teletrabajo/);
    });

    it(`${locale}: has no email address`, () => {
      expect(JSON.stringify(work)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    });
  }

  it("has the same keys and as many cards per stop in both languages", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value).flatMap(([k, v]) => [`${prefix}${k}`, ...keys(v, `${prefix}${k}.`)])
        : [];
    expect(keys(es.work).sort()).toEqual(keys(en.work).sort());
    for (const id of Object.keys(en.work.stops) as (keyof typeof en.work.stops)[]) {
      expect(es.work.stops[id].cards.length).toBe(en.work.stops[id].cards.length);
    }
  });
});
