import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { CAT_IDS } from "./lineup";

/** Every string in a dictionary subtree, with its key path. */
function strings(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${prefix}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => strings(inner, prefix ? `${prefix}.${key}` : key));
  }
  return [];
}

/** Every key path, with array items reduced to their keys. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }
  return typeof value;
}

const dicts = [
  ["en", en.suspects],
  ["es", es.suspects],
] as const;

describe("THE USUAL SUSPECTS copy", () => {
  it("has the same keys and the same number of cats and effects in both languages", () => {
    expect(shape(es.suspects)).toEqual(shape(en.suspects));
  });

  for (const [locale, copy] of dicts) {
    it(`${locale}: lists the four cats in line-up order`, () => {
      expect(copy.cats.map((cat) => cat.id)).toEqual([...CAT_IDS]);
    });

    it(`${locale}: keeps Jesús's line to one subtitle card (64 characters)`, () => {
      expect(Array.from(`${copy.speaker}: ${copy.line}`).length).toBeLessThanOrEqual(64);
    });

    it(`${locale}: never says Madrid, never shows an email, and leaves "live" to Heuristik`, () => {
      for (const [key, text] of strings(copy)) {
        expect(text, key).not.toMatch(/madrid/i);
        expect(text, key).not.toMatch(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);
        expect(text, key).not.toMatch(/\b(live|now|today|en directo|ahora|hoy)\b/i);
      }
    });

    it(`${locale}: puts the line-up in Tenerife or nowhere`, () => {
      const cities = copy.place.match(/·\s*(.+)$/)?.[1];
      if (cities) expect(cities).toBe("Tenerife");
    });

    it(`${locale}: names the record by its title only, and has five effects`, () => {
      expect(copy.effects.items).toHaveLength(5);
      expect(copy.effects.items.some((item) => item.includes("Sweet Child O’ Mine"))).toBe(true);
    });

    it(`${locale}: keeps the eating joke for STATS`, () => {
      expect(copy.effects.items.join(" ")).not.toMatch(/\b(takeaway|food|eat|eating|comida|comer|táper|tupper)\b/i);
    });
  }

  it("gives the cats their aliases, as Jesús calls them", () => {
    expect(es.suspects.cats.map((cat) => cat.alias)).toEqual(["«La Reina»", "«El Gordo»", "alias «Satanás»", "«El Enano»"]);
    expect(en.suspects.cats.map((cat) => cat.alias)).toEqual(["“The Queen”", "“Fats”", "aka “Satan”", "“Shorty”"]);
  });

  it("keeps Odin's plate line as approved, in both languages", () => {
    expect(en.suspects.cats[3].description).toBe("Ginger tabby. Short tail. Day pass from upstairs, halo included.");
    expect(es.suspects.cats[3].description).toMatch(/^Atigrado naranja\. Cola corta\. .*aureola incluida\.$/);
  });

  it("quotes Casablanca as the Spanish dub has it", () => {
    expect(en.suspects.line).toBe("Round up the usual suspects.");
    expect(es.suspects.line).toBe("Arresten a los sospechosos habituales.");
  });
});
