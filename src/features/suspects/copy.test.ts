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
  it("has the same keys and the same number of cats in both languages", () => {
    expect(shape(es.suspects)).toEqual(shape(en.suspects));
  });

  for (const [locale, copy] of dicts) {
    it(`${locale}: lists the four cats in line-up order, each with its refusal`, () => {
      expect(copy.cats.map((cat) => cat.id)).toEqual([...CAT_IDS]);
      expect(Object.keys(copy.refusals)).toEqual([...CAT_IDS]);
      for (const id of CAT_IDS) {
        const refusal = copy.refusals[id];
        // The chip is one line over the head: on a phone it runs from its strip's edge across the other.
        expect(Array.from(`${refusal.status} ${refusal.reason}`).length, id).toBeLessThanOrEqual(40);
        // The button says why the cat cannot be picked, and the live region says it again with its name.
        expect(refusal.why, id).toMatch(/\p{L}/u);
        const name = copy.cats.find((cat) => cat.id === id)!.name;
        expect(refusal.live.startsWith(name), id).toBe(true);
      }
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

    it(`${locale}: files no complaint, stamps no verdict and leaves no line to an officer (the select replaced them)`, () => {
      for (const key of ["complaint", "stamp", "speaker", "line"]) expect(copy).not.toHaveProperty(key);
      for (const [key, text] of strings(copy)) {
        expect(text, key).not.toMatch(/denuncia|complaint|culpable|guilty|agente|officer|armario|wardrobe/i);
      }
    });

    it(`${locale}: gives Jesús no surname and no role: the hero owns those`, () => {
      for (const [key, text] of strings(copy)) {
        expect(text, key).not.toMatch(/Molano|Frontend|Engineer|Developer|Ingenier/i);
      }
    });

    it(`${locale}: states no scale for him: the chart has one true scale for all five`, () => {
      expect(copy.player1).not.toHaveProperty("scale");
      for (const [key, text] of strings(copy)) expect(text, key).not.toMatch(/\b1:\d|escala|\bscale\b/i);
    });
  }

  it("calls it a character select, player one, in the owner's words", () => {
    expect(es.suspects.title).toBe("Elige personaje");
    expect(es.suspects.player).toBe("Jugador 1");
    expect(es.suspects.player1.selected).toBe("Jugador 1 · Seleccionado");
    expect(es.suspects.wayOn).toBe("Historia principal");
    expect(es.suspects.wall).toBe("Elige personaje para continuar");
    expect(en.suspects.title).toBe("Choose your character");
    expect(en.suspects.player).toBe("Player 1");
    expect(en.suspects.player1.selected).toBe("Player 1 · Selected");
    expect(en.suspects.wayOn).toBe("Main story");
    expect(en.suspects.wall).toBe("Choose your character to continue");
    // The way on names the career city's own chapter card.
    expect(es.suspects.wayOn).toBe(es.work.chapter.word);
    expect(en.suspects.wayOn).toBe(en.work.chapter.word);
  });

  it("has Dante say what he just did: he clawed her screen, the culprit's wink", () => {
    expect(es.suspects.refusals.dante).toMatchObject({ status: "Hostil", reason: "Te acaba de arañar la pantalla" });
    expect(en.suspects.refusals.dante).toMatchObject({ status: "Hostile", reason: "He just clawed your screen" });
  });

  it("gives the cats their aliases, as Jesús calls them", () => {
    expect(es.suspects.cats.map((cat) => cat.alias)).toEqual(["«La Reina»", "«El Gordo»", "alias «Satanás»", "«El Enano»"]);
    expect(en.suspects.cats.map((cat) => cat.alias)).toEqual(["“The Queen”", "“Fats”", "aka “Satan”", "“Shorty”"]);
  });

  it("books Odin as one more suspect: a short ginger tabby, with no halo and no pass from upstairs", () => {
    expect(en.suspects.cats[3].description).toMatch(/^A ginger tabby, short in the leg/);
    expect(es.suspects.cats[3].description).toMatch(/^Un atigrado naranja, paticorto y rabicorto/);
    for (const copy of [en.suspects, es.suspects]) {
      expect(copy.cats[3].description).not.toMatch(/upstairs|heaven|above|arriba|cielo/i);
    }
  });

  it("puts a halo nowhere on the page, in either language (the owner's call)", () => {
    for (const dict of [en, es]) {
      for (const [key, text] of strings(dict)) expect(text, key).not.toMatch(/halo|aureola/i);
    }
  });

  it("keeps the slug in the owner's words: flatmates", () => {
    expect(es.suspects.associates).toBe("Compañeros de piso");
    expect(en.suspects.associates).toBe("Flatmates");
  });
});
