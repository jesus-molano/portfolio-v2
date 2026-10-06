import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { CAT_IDS, CULPRIT } from "./lineup";

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
  it("has the same keys and the same number of cats and complaints in both languages", () => {
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

    it(`${locale}: files his complaint about the cats, not a list of his things (those live in STATS)`, () => {
      expect(copy).not.toHaveProperty("effects");
      const complaint = [copy.complaint.title, ...copy.complaint.items, copy.complaint.tally].join(" ");
      expect(complaint).not.toMatch(/aviator|gafas|earring|pendiente|tee\b|camiseta|galax|record|disco|Sweet Child/i);
    });

    it(`${locale}: keeps his eating joke for STATS`, () => {
      expect(copy.complaint.items.join(" ")).not.toMatch(/\b(takeaway|food|eat|eating|comida|comer|táper|tupper)\b/i);
    });
  }

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

  it("files the complaint in the owner's words: three ticked damages, four suspects, one culprit", () => {
    expect(es.suspects.complaint.title).toBe("Denuncia");
    expect(es.suspects.complaint.items).toEqual(["Armarios arañados", "Cables mordidos", "Todos los cuencos relamidos"]);
    expect(es.suspects.complaint.tally).toBe("Sospechosos: 4. Culpable: 1.");
    expect(en.suspects.complaint.title).toBe("Complaint");
    expect(en.suspects.complaint.items).toEqual(["Scratched wardrobes", "Chewed cables", "Every bowl licked clean"]);
    expect(en.suspects.complaint.tally).toBe("Suspects: 4. Culprit: 1.");
    for (const copy of [en.suspects, es.suspects]) expect(copy.complaint.owner).toBe("J. Molano");
  });

  it("names him once in the section, on the complaint: the slug says flatmates, in the owner's words", () => {
    expect(es.suspects.associates).toBe("Compañeros de piso");
    expect(en.suspects.associates).toBe("Flatmates");
    for (const copy of [en.suspects, es.suspects]) {
      const visible = [copy.chapter.word, copy.chapter.ribbon, copy.place, copy.associates, ...copy.cats.map((cat) => cat.description)];
      expect(visible.join(" ")).not.toMatch(/Molano/);
    }
  });

  it("ends on his tip to the officer, in the owner's words: number 3, the culprit's slot", () => {
    expect(es.suspects.line).toBe("Señor agente, yo me fijaría en el número 3.");
    expect(en.suspects.line).toBe("Officer, I'd take a good look at number three.");
    // The number he gives is the culprit's place in the line-up (plates and numerals count from 1).
    const slot = CAT_IDS.indexOf(CULPRIT) + 1;
    expect(es.suspects.line).toContain(`número ${slot}`);
    expect(en.suspects.line).toContain(`number ${["one", "two", "three", "four"][slot - 1]}`);
    // A nudge, not the reveal: he names no cat (the GUILTY stamp on the plate is the reveal).
    for (const copy of [en.suspects, es.suspects]) {
      for (const cat of copy.cats) expect(copy.line).not.toContain(cat.name);
    }
  });
});
