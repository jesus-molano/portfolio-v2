import { describe, expect, it } from "vitest";
import { eligible, type LoaderTip, TIP_MAX_CHARS } from "@/features/loader/tips";
import { visibleStations } from "@/features/music/stations";
import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";

/** Longest each piece of hero UI copy may be, in characters, so it fits its chip on a phone. */
const CAPS: [RegExp, number][] = [
  [/^intro\.hint/, 34],
  [/^intro\.ack$/, 34],
  [/^intro\.model$/, 40],
  [/^intro\.keepGoing/, 30],
  [/^intro\.hold$/, 32],
  [/^intro\.next/, 12],
  [/^intro\.end$/, 16],
  [/^osd\./, 9],
  [/^skipLabel$/, 16],
  [/^skipHurry$/, 12],
];

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, inner]) =>
        Object.entries(flatten(inner, prefix ? `${prefix}.${key}` : key)),
      ),
    );
  }
  return {};
}

describe("hero UI copy", () => {
  const dicts = [
    ["en", en.hero],
    ["es", es.hero],
  ] as const;

  it("has the same intro and transport keys in both languages", () => {
    expect(Object.keys(es.hero.intro).sort()).toEqual(Object.keys(en.hero.intro).sort());
    expect(Object.keys(es.hero.osd).sort()).toEqual(Object.keys(en.hero.osd).sort());
  });

  for (const [locale, hero] of dicts) {
    it(`${locale}: keeps every hint, cue and label short enough for its chip`, () => {
      const copy = flatten({ intro: hero.intro, osd: hero.osd, skipLabel: hero.skipLabel, skipHurry: hero.skipHurry });
      for (const [key, text] of Object.entries(copy)) {
        const cap = CAPS.find(([pattern]) => pattern.test(key))?.[1];
        if (cap === undefined) continue;
        expect(Array.from(text).length, `${locale} hero.${key}`).toBeLessThanOrEqual(cap);
      }
    });

    it(`${locale}: Skip's accessible name contains its visible label`, () => {
      expect(hero.skipLabel.toLowerCase()).toContain(hero.skip.toLowerCase());
    });
  }
});

describe("loading screen copy", () => {
  const locales = [
    ["en", en.loader],
    ["es", es.loader],
  ] as const;
  const tipsOf = (loader: typeof en.loader) => loader.tips as LoaderTip[];
  const stationNames = visibleStations().map((station) => station.name);
  /** Capitals that are not a station's name. */
  const NOT_STATIONS = new Set(["CV"]);
  /** Runs of capitalised words: "BABYLON", "MR. WOLF", "LEAVE THE GUN". */
  const CAPITALS = /\b[A-Z][A-Z.\-]*[A-Z.](?:\s+[A-Z][A-Z.\-]*[A-Z.])*/g;

  it("has the same keys in both languages", () => {
    expect(Object.keys(es.loader).sort()).toEqual(Object.keys(en.loader).sort());
    expect(Object.keys(es.loader.labels).sort()).toEqual(Object.keys(en.loader.labels).sort());
  });

  it("gives every tip the same kind and conditions in both languages", () => {
    const shape = (tips: LoaderTip[]) => tips.map(({ kind, when }) => ({ kind, when }));
    expect(shape(tipsOf(es.loader))).toEqual(shape(tipsOf(en.loader)));
  });

  for (const [locale, loader] of locales) {
    const tips = tipsOf(loader);

    it(`${locale}: has 10 to 14 tips of 120 characters at most, each with a known kind and conditions`, () => {
      expect(tips.length).toBeGreaterThanOrEqual(10);
      expect(tips.length).toBeLessThanOrEqual(14);
      for (const tip of tips) {
        expect(Array.from(tip.text).length, tip.text).toBeLessThanOrEqual(TIP_MAX_CHARS);
        expect(["tip", "trivia"]).toContain(tip.kind);
        for (const condition of tip.when) expect(["pointer", "touch", "motion"]).toContain(condition);
        expect(loader.labels).toHaveProperty(tip.kind);
      }
    });

    it(`${locale}: opens on a tip for every device, and has a tip for everyone under reduced motion`, () => {
      expect(tips[0].kind).toBe("tip");
      expect(tips[0].when).not.toContain("pointer");
      expect(tips[0].when).not.toContain("touch");
      expect(tips.some((tip) => tip.kind === "tip" && tip.when.length === 0)).toBe(true);
    });

    it(`${locale}: has enough tips for every visitor`, () => {
      const count = (touch: boolean, reducedMotion: boolean) =>
        tips.filter((tip) => eligible(tip, { touch, reducedMotion })).length;
      expect(count(false, false)).toBeGreaterThanOrEqual(10);
      expect(count(true, false)).toBeGreaterThanOrEqual(10);
      expect(count(false, true)).toBeGreaterThanOrEqual(8);
      expect(count(true, true)).toBeGreaterThanOrEqual(8);
    });

    it(`${locale}: names every station on air, as written`, () => {
      const named = new Set<string>();
      for (const tip of tips) {
        for (const [match] of tip.text.matchAll(CAPITALS)) {
          // A full stop after a name ends the sentence; the one in "MR. WOLF" is the name's.
          const run = stationNames.includes(match) ? match : match.replace(/\.$/, "");
          if (NOT_STATIONS.has(run)) continue;
          expect(stationNames, `"${run}" in "${tip.text}"`).toContain(run);
          named.add(run);
        }
      }
      expect([...named].sort()).toEqual([...stationNames].sort());
    });

    it(`${locale}: leaves the hero's own lines to the hero`, () => {
      for (const tip of tips) {
        expect(tip.text).not.toMatch(/Tenerife|Canaria|army|ejército|zapador|\bAI\b|\bIA\b|agent|Friday|viernes/i);
      }
    });

    it(`${locale}: keeps the buttons and the slow note short`, () => {
      expect(Array.from(loader.withMusic).length).toBeLessThanOrEqual(22);
      expect(Array.from(loader.withoutMusic).length).toBeLessThanOrEqual(22);
      expect(Array.from(loader.slow).length).toBeLessThanOrEqual(TIP_MAX_CHARS);
    });

    it(`${locale}: never sounds like a video player`, () => {
      const words = /\b(play|pause|rewind|fast.?forward|reproduc\w*|pausa|rebobin\w*)\b/i;
      const copy = [...Object.values(flatten(loader)), ...tips.map((tip) => tip.text)];
      for (const text of copy) expect(text).not.toMatch(words);
    });
  }
});

/** Same keys, same array lengths, at every depth. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }
  return typeof value;
}

describe("finale copy (projects, credits)", () => {
  it("has the same keys and the same number of lines in both languages", () => {
    expect(shape(es.projects)).toEqual(shape(en.projects));
    expect(shape(es.credits)).toEqual(shape(en.credits));
    expect(shape(es.common)).toEqual(shape(en.common));
  });

  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`${locale}: keeps every spoken line within a subtitle card (64 characters)`, () => {
      for (const line of [dict.projects.line, dict.credits.opening, dict.credits.last]) {
        expect(Array.from(line).length, line).toBeLessThanOrEqual(64);
      }
    });

    it(`${locale}: leaves "live" to Heuristik (the LIVE tag is not copy here) and shows no email`, () => {
      const text = JSON.stringify([dict.projects, dict.credits]);
      expect(text).not.toMatch(/\blive\b|en directo/i);
      expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    });

    it(`${locale}: says "now" only as the cinema says it`, () => {
      const text = JSON.stringify([dict.projects, dict.credits]).replace(/NOW SHOWING/g, "");
      expect(text).not.toMatch(/\b(now|today|hoy|ahora)\b/i);
    });
  }
});
