import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { CAPS_FACE, capsRun, missingCaps } from "./capsFace";
import { chapterSpan } from "@/design/tokens";
import {
  BODY,
  CAPS_GAP,
  CARD,
  cardWidth,
  chapterLayout,
  chapterName,
  GAP,
  inkRise,
  ribbonCaps,
  shadeLayers,
  STRADDLE,
} from "./chapterLayout";
import { missingScript, SCRIPT_FILE, scriptBoxes, scriptDepth, scriptRun } from "./scriptFace";

/** Every chapter in the dictionaries, as its card shows it: the career city's too. */
const SECTIONS = ["suspects", "work", "stats", "projects", "credits"] as const;
const CHAPTERS = (
  [
    ["en", en],
    ["es", es],
  ] as const
).flatMap(([lang, dict]) =>
  SECTIONS.map((section) => {
    const { word, ribbon } = dict[section].chapter;
    return { where: `${lang} ${section}: ${word}`, section, word, ribbon: ribbonCaps(ribbon, lang) };
  }),
);

/** The words whose descenders reach down to the banner: it tucks up behind them. */
const DEEP = ["Sesión golfa", "¡Y corten!", "That’s a wrap", "Main story"];

/**
 * The words and ribbons measured in Chromium on the checked-in faces by
 * tools/chapter/measure.mjs, in em: each word's advance with the cards'
 * word spacing (an SVG <text> gets the same run) and its ink box (canvas
 * pads it by up to 0.016 em), and each ribbon's kerned run.
 */
const MEASURED_WORDS: Record<string, { advance: number; left: number; right: number; ascent: number; descent: number }> = {
  "La banda": { advance: 3.435, left: -0.219, right: 3.639, ascent: 0.688, descent: 0.157 },
  "The crew": { advance: 3.028, left: -0.079, right: 3.117, ascent: 0.672, descent: 0.047 },
  Pausa: { advance: 2.11, left: -0.032, right: 2.314, ascent: 0.704, descent: 0.047 },
  Paused: { advance: 2.531, left: -0.032, right: 2.834, ascent: 0.704, descent: 0.047 },
  "Sesión golfa": { advance: 4.44, left: -0.204, right: 4.644, ascent: 0.672, descent: 0.391 },
  "The late show": { advance: 4.77, left: -0.079, right: 4.859, ascent: 0.672, descent: 0.047 },
  "¡Y corten!": { advance: 4.5, left: -0.063, right: 4.717, ascent: 0.704, descent: 0.391 },
  "That’s a wrap": { advance: 4.821, left: -0.079, right: 4.854, ascent: 0.688, descent: 0.344 },
  "Historia principal": { advance: 6.801, left: -0.016, right: 7.082, ascent: 0.704, descent: 0.344 },
  "Main story": { advance: 3.951, left: -0.219, right: 4.06, ascent: 0.688, descent: 0.375 },
};
const MEASURED_RIBBONS: Record<string, number> = {
  "SOSPECHOSOS HABITUALES": 9.795,
  "THE USUAL SUSPECTS": 7.77,
  "FICHA DEL JUGADOR": 7.209,
  "PLAYER PROFILE": 5.745,
  "PROYECTOS PERSONALES": 9.003,
  "SIDE PROJECTS": 5.509,
  "CRÉDITOS Y CONTACTO": 8.143,
  "CREDITS AND CONTACT": 8.22,
  "TRAYECTORIA · 2018 — LIVE": 10.031,
  "CAREER · 2018 — LIVE": 8.008,
};

describe("Chapter Script, the word's face", () => {
  const file = path.join(process.cwd(), SCRIPT_FILE.path);

  it("reads its metrics from the very woff2 the page loads, a small subset", () => {
    expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(SCRIPT_FILE.sha256);
    expect(statSync(file).size).toBeLessThan(16 * 1024);
  });

  it("has every chapter word's letters and the safe Latin set, and nothing else is claimed", () => {
    for (const { where, word } of CHAPTERS) expect(missingScript(word), where).toEqual([]);
    expect(missingScript("ÁÉÍÓÚÜÑáéíóúüñ¡¿«»’“”–—…çàè")).toEqual([]);
    expect(missingScript("ŁĞ")).toEqual(["Ł", "Ğ"]);
    expect(() => scriptRun("Łódź")).toThrow(/Ł/);
  });

  it("runs every word as Chromium sets it, kerning and word spacing included", () => {
    for (const [word, measured] of Object.entries(MEASURED_WORDS)) {
      const run = scriptRun(word, CARD.wordSpace);
      expect(Math.abs(run.advance - measured.advance), word).toBeLessThan(0.002);
      // Chromium's ink box is the outline's, padded a little: never smaller than ours, and close.
      expect(run.left, word).toBeGreaterThanOrEqual(measured.left);
      expect(run.right, word).toBeLessThanOrEqual(measured.right);
      expect(run.descent, word).toBeLessThanOrEqual(measured.descent);
      for (const key of ["left", "right", "ascent", "descent"] as const) {
        expect(Math.abs(run[key] - measured[key]), `${word} ${key}`).toBeLessThan(0.02);
      }
    }
  });

  it("boxes every inked letter, the boxes together making the run's ink box", () => {
    for (const word of Object.keys(MEASURED_WORDS)) {
      const run = scriptRun(word, CARD.wordSpace);
      const boxes = scriptBoxes(word, CARD.wordSpace);
      expect(boxes, word).toHaveLength(Array.from(word).filter((char) => char !== " ").length);
      expect(Math.min(...boxes.map((box) => box.left)), word).toBeCloseTo(run.left, 6);
      expect(Math.max(...boxes.map((box) => box.right)), word).toBeCloseTo(run.right, 6);
      expect(Math.max(...boxes.map((box) => box.ascent)), word).toBeCloseTo(run.ascent, 6);
      expect(Math.max(...boxes.map((box) => box.descent)), word).toBeCloseTo(run.descent, 6);
    }
    // The f of "golfa" stands taller than the a after it.
    const [f, a] = scriptBoxes("golfa").slice(-2);
    expect(f.ascent).toBeGreaterThan(a.ascent + 0.3);
  });

  it("knows how deep the ink goes in every column, and can leave the descenders out", () => {
    const set = { size: 1000, x: 0, wordSpace: CARD.wordSpace, from: -300, to: 5000 };
    for (const word of Object.keys(MEASURED_WORDS)) {
      const depth = scriptDepth(word, set);
      expect(Math.max(...depth), word).toBeCloseTo(scriptRun(word, CARD.wordSpace).descent * 1000, -1);
      expect(Math.max(...scriptDepth(word, { ...set, limit: BODY })), word).toBeLessThanOrEqual(BODY * 1000);
    }
    // The g of "golfa" hangs about 0.37 em; the body of a word without descenders stays near its baseline.
    expect(Math.max(...scriptDepth("g", set))).toBeGreaterThan(360);
    expect(Math.max(...scriptDepth("The crew", set))).toBeLessThan(60);
  });
});

describe("the banner's capitals", () => {
  it("know every ribbon's glyphs and run them as Chromium does", () => {
    for (const { where, ribbon } of CHAPTERS) expect(missingCaps(ribbon), where).toEqual([]);
    for (const [ribbon, measured] of Object.entries(MEASURED_RIBBONS)) {
      expect(Math.abs(capsRun(ribbon).length - measured), ribbon).toBeLessThan(0.004);
    }
    expect(missingCaps("2018 · LIVE")).toEqual([]);
    expect(missingCaps("Nº 1 #")).toEqual(["º", "#"]);
  });

  it("stand at least 11 px tall on a 360 px phone's card (328 px)", () => {
    expect(cardWidth(360, 740)).toBe(328);
    expect((CARD.caps * CAPS_FACE.cap * cardWidth(360, 740)) / CARD.width).toBeGreaterThanOrEqual(11);
  });
});

describe("the card's width", () => {
  const span = chapterSpan.rem * 16;

  it("is its band less 2rem, at most the span, in rem", () => {
    expect(cardWidth(390, 844)).toBe(358);
    expect(cardWidth(768, 1024)).toBe(736);
    expect(cardWidth(1440, 900)).toBe(span);
    expect(cardWidth(2560, 1440)).toBe(span);
    // A larger text size makes every card larger.
    expect(cardWidth(1440, 900, 20)).toBe(chapterSpan.rem * 20);
  });

  it("grows with the browser's zoom like any heading, until the window stops it", () => {
    // Zoomed in, the window is fewer CSS px wide and tall, and every CSS px is that many device pixels.
    const physical = ([width, height]: number[], zoom: number) => cardWidth(width / zoom, height / zoom) * zoom;
    for (const window of [
      [1280, 800],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      expect(physical(window, 1), `${window}`).toBe(span);
      expect(physical(window, 1.5) / span, `${window} at 150%`).toBeCloseTo(1.5, 2);
      // At 200% the window stops it short of double (1.76 at 1440 x 900); on a large one it doubles.
      expect(physical(window, 2) / span, `${window} at 200%`).toBeGreaterThanOrEqual(1.5);
    }
    expect(physical([1920, 1080], 2)).toBe(2 * span);
  });

  it("never fills a short screen: on a phone on its side the tallest card keeps a third of it", () => {
    const tallest = Math.max(...CHAPTERS.map(({ word, ribbon }) => chapterLayout(word, ribbon).height)) / CARD.width;
    for (const [width, height] of [
      [844, 390],
      [740, 360],
      [932, 430],
    ]) {
      expect(cardWidth(width, height) * tallest, `${width} x ${height}`).toBeLessThan(height * (2 / 3));
    }
  });
});

describe("chapterLayout", () => {
  const layouts = CHAPTERS.map((chapter) => ({ ...chapter, layout: chapterLayout(chapter.word, chapter.ribbon) }));

  it("fits each word to the same ink width, the short ones capped at the same size, so no chapter shouts louder than another", () => {
    for (const { where, layout } of layouts) {
      const width = layout.ink.right - layout.ink.left;
      expect(width, where).toBeLessThanOrEqual(CARD.maxInk + 0.1);
      expect(layout.word.size, where).toBeLessThanOrEqual(CARD.maxSize);
      // A word too short to fill the width stops at the cap (Pausa, Paused); every other fills it.
      if (layout.word.size < CARD.maxSize - 0.01) expect(width, where).toBeGreaterThan(CARD.maxInk * 0.95);
      else expect(width, where).toBeGreaterThan(CARD.maxInk * 0.7);
      // The ink is centred.
      expect((layout.ink.left + layout.ink.right) / 2, where).toBeCloseTo(CARD.width / 2, 1);
    }
  });

  it("pins the word to the run Chromium gives it, and the ribbon to its kerned, tracked run", () => {
    for (const { where, word, ribbon, layout } of layouts) {
      const measured = MEASURED_WORDS[word];
      expect(Math.abs(layout.word.textLength - measured.advance * layout.word.size), where).toBeLessThan(0.002 * layout.word.size + 0.01);
      const track = CARD.caps * CARD.tracking;
      expect(layout.ribbon.textLength, where).toBeCloseTo(capsRun(ribbon, CARD.tracking).length * CARD.caps + track, 1);
      expect(layout.ribbon.letterSpacing).toBeCloseTo(track, 2);
    }
  });

  it("makes the band long enough for its capitals and their clear ends", () => {
    for (const { where, layout } of layouts) {
      expect(layout.half - layout.capsRun / 2, where).toBeGreaterThanOrEqual(0.6 * CARD.caps - 0.01);
      expect(layout.bandHeight).toBeCloseTo(CARD.caps * CARD.band, 2);
    }
  });

  it("hangs the banner as close as it can: under the word's body, and never with a capital under any ink or shade", () => {
    for (const { where, layout } of layouts) {
      expect(layout.clearance.body, where).toBeGreaterThanOrEqual(GAP - 0.02);
      expect(layout.clearance.caps, where).toBeGreaterThanOrEqual(CAPS_GAP - 0.02);
      // One of the two holds it up: it hangs no lower than it must.
      expect(Math.min(layout.clearance.body - GAP, layout.clearance.caps - CAPS_GAP), where).toBeLessThan(0.05);
    }
  });

  it("tucks the banner up behind deep descenders, as a painted sign does, instead of hanging under them", () => {
    for (const { where, word, layout } of layouts) {
      const bandTop = layout.yMid - layout.bandHeight / 2;
      if (DEEP.includes(word)) {
        // The descenders cross the band's top edge.
        expect(bandTop, where).toBeLessThan(layout.ink.bottom);
        // And the band sits no lower than under a word with no descenders, by more than a capital's height.
        expect(layout.yMid, where).toBeLessThan(Math.max(...layouts.map((l) => (DEEP.includes(l.word) ? 0 : l.layout.yMid))) + CARD.caps);
      } else {
        expect(bandTop, where).toBeGreaterThan(layout.ink.bottom);
      }
    }
  });

  it("keeps the leaning drawing inside the viewBox across, so a card never scrolls the page sideways", () => {
    for (const { where, layout } of layouts) {
      expect(layout.xRange[0], where).toBeGreaterThanOrEqual(0);
      expect(layout.xRange[1], where).toBeLessThanOrEqual(CARD.width);
    }
  });

  it("is 0.36 to 0.45 of its width tall, and a straddle rises at most 0.124 of it over the cut", () => {
    for (const { where, section, layout } of layouts) {
      expect(layout.height / 1000, where).toBeGreaterThanOrEqual(0.36);
      expect(layout.height / 1000, where).toBeLessThanOrEqual(0.45);
      expect(layout.edge, where).toBeGreaterThan(0);
      expect(layout.edge, where).toBeLessThan(layout.height);
      // The most a straddle rises over the section before it (STATS's and Projects' scroll-margins count it; the room
      // at STATS's foot that THE LATE SHOW's word rises into is tested in statsLayout.test.ts).
      if (section === "stats") expect((layout.edge * STRADDLE.stats) / 1000, where).toBeLessThanOrEqual(0.124);
      if (section === "projects") expect(layout.edge / 1000, where).toBeLessThanOrEqual(0.124);
    }
  });

  it("finds the word's highest ink under the lean, inside the drawing and over its edge line", () => {
    for (const { where, layout } of layouts) {
      expect(layout.inkTop, where).toBeGreaterThanOrEqual(0);
      expect(layout.inkTop, where).toBeLessThan(layout.edge);
      // Straddling all the way, the word's top half shows over the edge: about a fifth of its size or more.
      expect(inkRise(layout, 1) * CARD.width, where).toBeGreaterThan(layout.word.size * 0.2);
    }
  });

  it("straddles as the sections' stylesheets say", () => {
    const css = (file: string) => readFileSync(path.join(process.cwd(), "src/features", file), "utf8");
    expect(css("stats/Stats.module.css")).toContain(`--chapter-straddle: ${STRADDLE.stats};`);
    expect(css("finale/Projects.module.css")).toContain(`--chapter-straddle: ${STRADDLE.projects};`);
  });

  it("casts one shade, the block's steps back to front then the split", () => {
    const layers = shadeLayers();
    expect(layers).toHaveLength(CARD.block + 1);
    expect(layers.at(-1)).toEqual({ dx: CARD.split[0], dy: CARD.split[1], tone: "split" });
    expect(layers[0].dy).toBeGreaterThan(layers[1].dy);
    expect(layers.filter((layer) => layer.tone === "deep").length).toBe(CARD.block - CARD.deep + 1);
  });

  it("is deterministic", () => {
    for (const { word, ribbon } of CHAPTERS) expect(chapterLayout(word, ribbon)).toEqual(chapterLayout(word, ribbon));
  });

  it("refuses a ribbon with a capital it cannot measure", () => {
    expect(() => chapterLayout("Historia principal", "TRAYECTORIA #1")).toThrow(/#/);
  });
});

describe("a chapter's words", () => {
  it("set the ribbon in capitals in the card's own language", () => {
    expect(ribbonCaps("Créditos y contacto", "es")).toBe("CRÉDITOS Y CONTACTO");
    expect(ribbonCaps("Player profile", "en")).toBe("PLAYER PROFILE");
  });

  it("name the heading as a sentence, then the ribbon, with one mark after the word", () => {
    expect(chapterName("La banda", "Sospechosos habituales")).toBe("La banda. Sospechosos habituales");
    expect(chapterName("¡Y corten!", "Créditos y contacto")).toBe("¡Y corten! Créditos y contacto");
  });
});
