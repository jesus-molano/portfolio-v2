import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  BOARD_MARGIN,
  CAP_HEIGHT,
  caseBulbs,
  cq,
  fitMarquee,
  marqueeTiles,
  PLATES,
  posterInset,
  rectCq,
  rowWidth,
  SPACE_ADVANCE,
  stripBulbs,
  TILE_GAP,
  type PlateName,
} from "./finaleLayout";
import { FEATURES } from "./links";

const LOCALES = [
  ["en", en],
  ["es", es],
] as const;

/** Every text each marquee row can show, as Projects.tsx and EndCredits.tsx build them. */
function nightRows(dict: typeof en) {
  const { rows, showing } = dict.projects.marquee;
  const titles = FEATURES.map((feature) => `${showing} ${dict.projects.posters[feature.id].title}`);
  return [[rows[0]], [rows[1], ...titles]];
}

function dawnRows(dict: typeof en) {
  return dict.credits.marquee.rows.map((row) => [row]);
}

describe("marqueeTiles", () => {
  it("hangs accented letters bare, with the accent taped on", () => {
    const tiles = marqueeTiles("JESÚS", 0);
    expect(tiles.map((tile) => tile.glyph).join("")).toBe("JESUS");
    expect(tiles.map((tile) => tile.tape)).toEqual([false, false, false, true, false]);
  });

  it("leaves a blank tile between words", () => {
    const [, blank] = marqueeTiles("A B", 0);
    expect(blank).toMatchObject({ glyph: "", tape: false, advance: SPACE_ADVANCE, tilt: 0, drop: 0 });
  });

  it("upper-cases the text, as letter kits only carry capitals", () => {
    expect(marqueeTiles("Sin botín", 0).map((tile) => tile.glyph || " ").join("")).toBe("SIN BOTIN");
  });

  it("hangs a letter the same way whenever it is in the same slot of the same row", () => {
    const a = marqueeTiles("NOW SHOWING: DOTFILES", 1);
    const b = marqueeTiles("NOW SHOWING: PROJECT ATLAS", 1);
    for (let slot = 0; slot < 13; slot++) expect(b[slot]).toEqual(a[slot]);
    expect(marqueeTiles("NOW", 2)[0].tilt).not.toBe(a[0].tilt);
  });

  it("keeps every letter only a hair crooked", () => {
    for (const tile of marqueeTiles("TONIGHT · FOUR FEATURES", 0)) {
      expect(Math.abs(tile.tilt)).toBeLessThanOrEqual(0.9);
      expect(Math.abs(tile.drop)).toBeLessThanOrEqual(0.015);
    }
  });

  it("ships the hang in three decimals (every tile carries it in the HTML)", () => {
    for (const tile of marqueeTiles("NOW SHOWING: EXPENSES LOG", 1)) {
      expect(Math.round(tile.tilt * 1000) / 1000).toBe(tile.tilt);
      expect(Math.round(tile.drop * 1000) / 1000).toBe(tile.drop);
    }
  });

  it("lays an unknown glyph out wide, so a row can only come out short", () => {
    expect(marqueeTiles("@", 0)[0].advance).toBeGreaterThanOrEqual(marqueeTiles("W", 0)[0].advance);
  });
});

describe("rowWidth", () => {
  it("adds the tiles and the gaps between them", () => {
    const tiles = marqueeTiles("I I", 0);
    expect(rowWidth(tiles)).toBeCloseTo(tiles[0].advance * 2 + SPACE_ADVANCE + 2 * TILE_GAP);
    expect(rowWidth([])).toBe(0);
  });
});

describe("the plates", () => {
  it("are all there, with a board, its rails and the bulb strips", () => {
    for (const name of ["night-wide", "night-tall", "dawn-wide", "dawn-tall"] as PlateName[]) {
      const plate = PLATES[name];
      expect(plate.board.w, name).toBeGreaterThan(0);
      expect(plate.rows, name).toHaveLength(2);
      expect(plate.strips, name).toHaveLength(2);
      // The board lies inside the frame, and each row inside the board.
      expect(plate.board.x).toBeGreaterThanOrEqual(0);
      expect(plate.board.x + plate.board.w).toBeLessThanOrEqual(plate.width);
      for (const row of plate.rows) {
        expect(row.top).toBeGreaterThanOrEqual(plate.board.y - 0.5);
        expect(row.bottom).toBeLessThanOrEqual(plate.board.y + plate.board.h + 0.5);
        expect(row.base).toBeGreaterThan(row.top);
        expect(row.base).toBeLessThan(row.bottom);
      }
    }
  });

  it("night-wide: the four cases line up with the plate's case windows, in the bill's order", () => {
    const plate = PLATES["night-wide"];
    expect(plate.cases.map((slot) => slot.repo)).toEqual(FEATURES.map((feature) => feature.repo));
    const [a, b, c, d] = plate.cases;
    // One size for all four, on one line, two pairs either side of the entrance.
    for (const slot of plate.cases) {
      expect(slot.frame.w).toBeCloseTo(a.frame.w, 1);
      expect(slot.frame.h).toBeCloseTo(a.frame.h, 1);
      expect(slot.frame.y).toBeCloseTo(a.frame.y, 1);
      // Under the marquee, inside the frame.
      expect(slot.frame.y).toBeGreaterThan(plate.board.y + plate.board.h);
      expect(slot.frame.y + slot.frame.h).toBeLessThan(plate.height);
      // The poster inside its case.
      const inset = posterInset(slot);
      expect(inset.x).toBeGreaterThan(0);
      expect(inset.y).toBeGreaterThan(0);
      expect(inset.x + inset.w).toBeLessThan(100);
      expect(inset.y + inset.h).toBeLessThan(100);
    }
    expect(a.frame.x + a.frame.w).toBeLessThan(b.frame.x);
    expect(b.frame.x + b.frame.w).toBeLessThan(plate.width / 2);
    expect(c.frame.x).toBeGreaterThan(plate.width / 2);
    expect(c.frame.x + c.frame.w).toBeLessThan(d.frame.x);
    // Symmetric about the entrance.
    expect(a.frame.x + d.frame.x + d.frame.w).toBeCloseTo(plate.width, 0);
  });

  it("night plates: the box office, a link to the contact, stands under the marquee, between the cases, a finger wide on a phone", () => {
    for (const name of ["night-wide", "night-tall"] as PlateName[]) {
      const plate = PLATES[name];
      const { booth } = plate;
      // Centred on the entrance, under the marquee, inside the frame.
      expect(booth.x + booth.w / 2, name).toBeCloseTo(plate.width / 2, 0);
      expect(booth.y, name).toBeGreaterThan(plate.board.y + plate.board.h);
      expect(booth.y + booth.h, name).toBeLessThanOrEqual(plate.height + 0.5);
      // At least a 44 px target on a 360 px phone (the tall plate fills the width there).
      if (name === "night-tall") {
        expect((booth.w / plate.width) * 360, name).toBeGreaterThanOrEqual(44);
        expect((booth.h / plate.width) * 360, name).toBeGreaterThanOrEqual(44);
      }
    }
    const wide = PLATES["night-wide"];
    expect(wide.cases[1].frame.x + wide.cases[1].frame.w).toBeLessThan(wide.booth.x);
    expect(wide.booth.x + wide.booth.w).toBeLessThan(wide.cases[2].frame.x);
  });

  it("dawn plates keep their cases on the plate (dark, drawn in)", () => {
    expect(PLATES["dawn-wide"].cases).toHaveLength(4);
    expect(PLATES["night-tall"].cases).toHaveLength(0);
  });
});

describe("fitMarquee", () => {
  for (const [locale, dict] of LOCALES) {
    for (const [mood, rows, plates] of [
      ["night", nightRows(dict), ["night-wide", "night-tall"]],
      ["dawn", dawnRows(dict), ["dawn-wide", "dawn-tall"]],
    ] as const) {
      for (const name of plates) {
        it(`${locale}: every ${mood} row fits the board of ${name}, re-lettered or not`, () => {
          const plate = PLATES[name];
          const sizes = fitMarquee(plate, rows, mood === "night");
          rows.forEach((texts, i) => {
            for (const text of texts) {
              const width = rowWidth(marqueeTiles(text, i)) * sizes[i];
              expect(width, text).toBeLessThanOrEqual(plate.board.w * (1 - 2 * BOARD_MARGIN) + 1e-6);
            }
            // Never taller than its rails allow.
            expect(sizes[i] * CAP_HEIGHT).toBeLessThanOrEqual(plate.rows[i].cap + 1e-6);
            // And readable: at least half the rail's letter height.
            expect(sizes[i] * CAP_HEIGHT).toBeGreaterThan(plate.rows[i].cap * 0.5);
          });
        });
      }
    }
  }

  it("gives one letter kit to every row when asked", () => {
    const sizes = fitMarquee(PLATES["night-wide"], [["SHORT"], ["A MUCH, MUCH LONGER ROW OF LETTERS ON THE BOARD"]], true);
    expect(sizes[0]).toBe(sizes[1]);
  });
});

describe("cq and rectCq", () => {
  it("turn plate units into percentages of the plate's width", () => {
    const plate = PLATES["night-wide"];
    expect(cq(plate, plate.width)).toBe(100);
    expect(cq(plate, plate.width / 4)).toBe(25);
    expect(rectCq(plate, { x: 0, y: plate.height, w: plate.width / 2, h: 0 })).toEqual({
      x: 0,
      y: (plate.height / plate.width) * 100,
      w: 50,
      h: 0,
    });
  });
});

describe("caseBulbs", () => {
  const bulbs = caseBulbs();

  it("puts 34 bulbs round the frame, inside it", () => {
    expect(bulbs).toHaveLength(34);
    for (const bulb of bulbs) {
      expect(bulb.x).toBeGreaterThan(0);
      expect(bulb.x).toBeLessThan(100);
      expect(bulb.y).toBeGreaterThan(0);
      expect(bulb.y).toBeLessThan(100);
    }
    expect(new Set(bulbs.map((bulb) => `${bulb.x},${bulb.y}`)).size).toBe(34);
  });

  it("chases in three steps, every third bulb together, clockwise", () => {
    expect(bulbs.map((bulb) => bulb.phase).slice(0, 6)).toEqual([0, 1, 2, 0, 1, 2]);
    // Clockwise: along the top to the right, then down the right side.
    expect(bulbs[1].x).toBeGreaterThan(bulbs[0].x);
    expect(bulbs[8].y).toBeGreaterThan(bulbs[7].y);
  });
});

describe("stripBulbs", () => {
  it("spaces the bulbs evenly from end to end, one in four lit", () => {
    const bulbs = stripBulbs(5);
    expect(bulbs.map((bulb) => bulb.x)).toEqual([0, 25, 50, 75, 100]);
    expect(bulbs.map((bulb) => bulb.phase)).toEqual([0, 1, 2, 3, 0]);
    expect(stripBulbs(3, 2).map((bulb) => bulb.phase)).toEqual([2, 3, 0]);
    expect(stripBulbs(1)[0].x).toBe(50);
  });
});
