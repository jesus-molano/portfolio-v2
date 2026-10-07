import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifestJson from "../../../public/interlude/manifest.json";
import {
  boardStyle,
  CAT_IDS,
  CHART,
  chartMarks,
  extents,
  FIGURE_IDS,
  isCatId,
  OPTIONAL_FIGURE_IDS,
  lowestHead,
  parseManifest,
  PHONE_CHART,
  phoneNudge,
  phoneStrips,
  placeCat,
  placeLineup,
  placementStyle,
  placePlayer,
  placeSwap,
  plateNumber,
  PLAYER_ONE,
  phoneCm,
  WIDE,
  wideCentres,
  wideCm,
  type CatImage,
  type LineupManifest,
} from "./lineup";

const PUBLIC = path.resolve(__dirname, "../../../public/interlude");
const manifest = parseManifest(manifestJson);
const lineup = placeLineup(manifest);
const byId = Object.fromEntries(lineup.map((p) => [p.id, p]));
const player = placePlayer(manifest);

/** A 20 x 30 cm image at 24 px/cm: floor 1 cm above its bottom, head top 1 cm under its top. */
const SAMPLE: CatImage = { w: 480, h: 720, floorY: 696, headTopY: 24, centerX: 240, headWidth: 240 };

/** A manifest as the renders write it: the states under `states`, naming their cat, and Jesús at the top level. */
function withCat(id: string, patch: Partial<CatImage> | null): unknown {
  const cats: Record<string, unknown> = Object.fromEntries(CAT_IDS.map((c) => [c, { ...SAMPLE }]));
  const states: Record<string, unknown> = { "kira-back": { ...SAMPLE, cat: "kira" }, "tom-asleep": { ...SAMPLE, cat: "tom" } };
  const root: Record<string, unknown> = { pxPerCm: 24, cats, states, jesus: { ...SAMPLE } };
  const map = id === "jesus" ? root : id in states ? states : cats;
  if (patch === null) delete map[id];
  else map[id] = { ...(map[id] as object), ...patch };
  return root;
}

/** Width and height from a WebP header (VP8X, VP8L or VP8). */
function webpSize(buffer: Buffer): { w: number; h: number } {
  expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
  expect(buffer.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { w: buffer.readUIntLE(24, 3) + 1, h: buffer.readUIntLE(27, 3) + 1 };
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { w: buffer.readUInt16LE(26) & 0x3fff, h: buffer.readUInt16LE(28) & 0x3fff };
}

describe("parseManifest", () => {
  it("accepts the manifest in public/interlude", () => {
    expect(manifest.pxPerCm).toBeGreaterThan(0);
    expect(Object.keys(manifest.cats).sort()).toEqual([...CAT_IDS].sort());
    // The three the select needs, and Dante's swipe, which the renders made too.
    expect(Object.keys(manifest.figures).sort()).toEqual([...FIGURE_IDS, ...OPTIONAL_FIGURE_IDS].sort());
  });

  it("finds the renders where the renders put them: `states`, top-level `jesus`, `figures` or one `cats` map", () => {
    expect(parseManifest(withCat("kira", {})).figures["kira-back"]).toEqual(SAMPLE);
    expect(parseManifest(withCat("kira", {})).figures.jesus).toEqual(SAMPLE);
    const flat = { pxPerCm: 24, cats: { ...Object.fromEntries([...CAT_IDS, ...FIGURE_IDS].map((id) => [id, SAMPLE])) } };
    expect(parseManifest(flat).figures.jesus).toEqual(SAMPLE);
    const figures = { pxPerCm: 24, cats: flat.cats, figures: { "tom-asleep": { ...SAMPLE, w: 500 } } };
    expect(parseManifest(figures).figures["tom-asleep"].w).toBe(500);
  });

  it("reads Dante's swipe when it was rendered, and does without it", () => {
    expect(parseManifest(withCat("kira", {})).figures["dante-swipe"]).toBeUndefined();
    const value = withCat("kira", {}) as { states: Record<string, unknown> };
    value.states["dante-swipe"] = { ...SAMPLE, cat: "dante" };
    expect(parseManifest(value).figures["dante-swipe"]).toEqual(SAMPLE);
    expect(placeSwap(parseManifest(value), "dante-swipe")?.headTopCm).toBe(28);
    expect(placeSwap(parseManifest(withCat("kira", {})), "dante-swipe")).toBeNull();
  });

  it("lets only Jesús carry a scale of his own, stated either way, with his real height", () => {
    expect(parseManifest(withCat("jesus", { pxPerCm: 8 } as Partial<CatImage>)).figures.jesus.pxPerCm).toBe(8);
    // Rendered at 1:3 with the cats' camera: an image pixel is 3 / 24 cm.
    expect(parseManifest(withCat("jesus", { scale: 3, heightCm: 125 } as Partial<CatImage>)).figures.jesus).toEqual({
      ...SAMPLE,
      pxPerCm: 8,
      heightCm: 125,
    });
    // At 1:1 it is the cats' own scale.
    expect(parseManifest(withCat("jesus", { scale: 1 } as Partial<CatImage>)).figures.jesus).toEqual(SAMPLE);
    expect(() => parseManifest(withCat("kira-back", { pxPerCm: 8 } as Partial<CatImage>))).toThrow(/kira-back must share/);
    expect(() => parseManifest(withCat("tom-asleep", { scale: 2 } as Partial<CatImage>))).toThrow(/tom-asleep must share/);
    expect(() => parseManifest(withCat("jesus", { pxPerCm: 0 } as Partial<CatImage>))).toThrow(/jesus\.pxPerCm/);
    expect(() => parseManifest(withCat("jesus", { scale: -3 } as Partial<CatImage>))).toThrow(/jesus\.scale/);
  });

  it("keeps the contract's fields and the old halo flag, nothing else", () => {
    const parsed = parseManifest(withCat("odin", { haloInImage: true, extra: 1 } as Partial<CatImage>));
    expect(parsed.cats.odin).toEqual({ ...SAMPLE, haloInImage: true });
    expect(parsed.cats.kira).toEqual(SAMPLE);
  });

  it.each([
    ["not an object", null, /not an object/],
    ["a bad scale", { pxPerCm: 0, cats: {} }, /pxPerCm/],
    ["a missing cat", withCat("dante", null), /dante is missing/],
    ["a missing figure", withCat("tom-asleep", null), /tom-asleep is missing/],
    ["a missing field", withCat("tom", { w: undefined }), /tom\.w/],
    ["a negative value", withCat("kira", { centerX: -1 }), /kira\.centerX/],
    ["a floor below the image", withCat("kira", { floorY: 721 }), /floorY is below/],
    ["a head under the floor", withCat("odin", { headTopY: 696 }), /headTopY must be above/],
    ["a centre outside the image", withCat("tom", { centerX: 481 }), /centerX is outside/],
    ["a head wider than the image", withCat("tom", { headWidth: 481 }), /headWidth/],
    ["a halo flag that is not a boolean", withCat("odin", { haloInImage: "yes" as unknown as boolean }), /haloInImage/],
  ])("rejects %s", (_, value, message) => {
    expect(() => parseManifest(value)).toThrow(message);
  });
});

describe("placeCat", () => {
  it("turns image pixels into chart centimetres at the manifest's one scale", () => {
    const p = placeCat("kira", SAMPLE, 24);
    expect(p.widthCm).toBe(20);
    expect(p.heightCm).toBe(30);
    expect(p.leftCm).toBe(-10);
    expect(p.bottomCm).toBe(-1);
    expect(p.headTopCm).toBe(28);
    expect(p.headWidthCm).toBe(10);
  });

  it("puts the image's floor contact on the floor line and its centre on the slot", () => {
    const p = placeCat("tom", { ...SAMPLE, centerX: 300, floorY: 720 }, 24);
    expect(p.bottomCm).toBe(-0);
    expect(p.leftCm).toBe(-12.5);
    expect(extents(p)).toEqual({ leftCm: 12.5, rightCm: 7.5 });
  });

  it("places Odin like any other suspect: no halo, nothing over his head", () => {
    const odin = placeCat("odin", SAMPLE, 24);
    expect({ ...odin, id: "kira" }).toEqual(placeCat("kira", SAMPLE, 24));
    expect(Object.keys(odin).some((key) => /halo/i.test(key))).toBe(false);
  });
});

describe("the line-up", () => {
  it("lines the cats up in the slot order", () => {
    expect(lineup.map((p) => p.id)).toEqual([...CAT_IDS]);
  });

  it("puts Dante's head the lowest on the chart, by a clear margin", () => {
    expect(lowestHead(lineup)).toBe("dante");
    const others = lineup.filter((p) => p.id !== "dante").map((p) => p.headTopCm);
    expect(Math.min(...others) - byId.dante.headTopCm).toBeGreaterThanOrEqual(5);
  });

  it("stands the cats in their real size order: Tom, then Kira, then Odin, then Dante", () => {
    const tallestFirst = [...lineup].sort((a, b) => b.headTopCm - a.headTopCm).map((p) => p.id);
    expect(tallestFirst).toEqual(["tom", "kira", "odin", "dante"]);
    // Tom is the biggest, but only just: never a head taller than Kira.
    expect(byId.tom.headTopCm - byId.kira.headTopCm).toBeLessThan(3);
  });

});

/** The screens the line-up is checked on: wide ones (the wall) and phones (the strips). */
const WIDE_SCREENS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1100, height: 800 },
] as const;
const PHONES = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
] as const;

describe("one true scale on a wide screen", () => {
  const him = { headCm: player.headTopCm, reachCm: player.reachCm };

  it.each(WIDE_SCREENS)("keeps neighbours apart at $width x $height, Jesús in the fifth slot included", (screen) => {
    const cm = wideCm(screen, him);
    const centres = wideCentres().map((share) => share * screen.width);
    const row = [...lineup, player];
    for (let i = 1; i < row.length; i++) {
      const reach = (extents(row[i - 1]).rightCm + extents(row[i]).leftCm) * cm;
      expect(reach, `${row[i - 1].id} and ${row[i].id}`).toBeLessThanOrEqual(centres[i] - centres[i - 1]);
    }
    // His reach stays on the screen.
    expect(centres[4] + extents(player).rightCm * cm).toBeLessThanOrEqual(screen.width);
  });

  it.each(WIDE_SCREENS)("keeps every cat's face readable at $width x $height: 44 px across the cheeks at least", (screen) => {
    const cm = wideCm(screen, him);
    for (const p of lineup) expect(p.headWidthCm * cm, p.id).toBeGreaterThanOrEqual(44);
  });

  it("puts him and the cursor over him on one screen with the plates under the floor, at 1440 x 900", () => {
    const cm = wideCm({ width: 1440, height: 900 }, him);
    const stage = cm * player.headTopCm + WIDE.aboveRem * 16;
    expect(stage + (WIDE.belowRem - WIDE.aboveRem) * 16).toBeLessThanOrEqual(900 + 0.5);
    // The chart reaches its 140 cm on the wall, under the top of the screen.
    expect(cm * CHART.topCm).toBeLessThanOrEqual(stage);
  });

  it("centres the five slots across 92% of the width, his column half as wide again", () => {
    const centres = wideCentres();
    expect(centres[0]).toBeCloseTo(0.04 + 0.92 / 5.5 / 2, 9);
    expect(centres[4]).toBeCloseTo(0.96 - (0.92 * 1.5) / 5.5 / 2, 9);
    // His reach is kept inside half his column and the margin beyond it.
    expect(((0.92 * 1.5) / 5.5 / 2 + 0.04) * 100).toBeGreaterThanOrEqual(WIDE.halfColumnVw);
  });
});

describe("one true scale on a phone", () => {
  const him = { headCm: player.headTopCm, reachCm: player.reachCm };

  it.each(PHONES)("keeps every cat's face readable at $width x $height: 44 px across the cheeks at least", (screen) => {
    const cm = phoneCm(screen, him);
    for (const p of lineup) expect(p.headWidthCm * cm, p.id).toBeGreaterThanOrEqual(44);
  });

  it.each(PHONES)("keeps his reach on the screen and the cats inside their strips at $width x $height", (screen) => {
    const cm = phoneCm(screen, him);
    expect(player.reachCm * cm).toBeLessThanOrEqual(screen.width / 2);
    for (const p of lineup) {
      const { leftCm, rightCm } = extents(p);
      expect(Math.max(leftCm, rightCm) * cm, p.id).toBeLessThanOrEqual(screen.width / 4);
    }
  });

  it("stands him on one screen with his plate on a 390 x 844 phone", () => {
    const cm = phoneCm({ width: 390, height: 844 }, him);
    expect(cm * player.headTopCm + PHONE_CHART.belowRem * 16).toBeLessThanOrEqual(844 + 0.5);
  });
});

describe("Jesús on one knee", () => {
  it("is about 1.25 m to the crown, as the brief has him", () => {
    expect(player.realHeadCm).toBeGreaterThan(110);
    expect(player.realHeadCm).toBeLessThan(145);
  });

  it("stands at his real height on the chart, the cats' one scale: no scale of his own", () => {
    expect(manifest.figures.jesus.pxPerCm).toBeUndefined();
    // Read off the chart from his planted trainer, as the page stands him, his
    // crown is a little higher than the model's kneeling height: the sole is
    // half a metre nearer the lens than his head (the README's 125.6 cm).
    expect(player.headTopCm).toBeGreaterThanOrEqual(player.realHeadCm);
    expect(player.headTopCm - player.realHeadCm).toBeLessThan(9);
    // Three times a cat's height and more, as in life.
    for (const p of lineup) expect(player.headTopCm / p.headTopCm, p.id).toBeGreaterThan(2.8);
  });

  it("keeps his head under the chart's top, with room for the cursor over him", () => {
    expect(player.headTopCm + 8).toBeLessThanOrEqual(CHART.topCm);
  });

  it("reaches as far as his image does either side of his slot", () => {
    const { leftCm, rightCm } = extents(player);
    expect(player.reachCm).toBe(Math.max(leftCm, rightCm));
  });
});

describe("the chart", () => {
  it("runs to 140 cm with a number every 10 cm", () => {
    expect(chartMarks()).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140]);
    expect(chartMarks(PHONE_CHART.catTopCm)).toEqual([10, 20, 30, 40]);
  });

  it("hands the board his head and reach and the tallest cat's head", () => {
    expect(boardStyle(lineup, player)).toEqual({
      "--player-head": String(Math.round(player.headTopCm * 1000) / 1000),
      "--player-reach": String(Math.round(player.reachCm * 1000) / 1000),
      "--cats-head": String(Math.round(Math.max(...lineup.map((p) => p.headTopCm)) * 1000) / 1000),
    });
  });
});

describe("the swap-in renders", () => {
  it("stand Kira's back and Tom asleep on their cat's floor and centre", () => {
    for (const [id, cat] of [
      ["kira-back", "kira"],
      ["tom-asleep", "tom"],
    ] as const) {
      const swap = placeSwap(manifest, id)!;
      // Placed by its own floor and centre at the cats' one scale, it is the same cat: about its size.
      expect(Math.abs(swap.headTopCm - byId[cat].headTopCm), id).toBeLessThan(4);
      expect(Math.abs(swap.headWidthCm - byId[cat].headWidthCm), id).toBeLessThan(6);
    }
  });
});

describe("phone strips", () => {
  const phone = phoneStrips(lineup);

  it("share one scale and one chart top, and every cat fits under it", () => {
    expect(new Set(phone.strips.map(() => phone.topCm)).size).toBe(1);
    for (const strip of phone.strips) expect(strip.tallestCm).toBeLessThan(phone.topCm);
  });

  it("hold all four cats once, two by two, with Dante next to Odin", () => {
    expect(phone.strips.flatMap((s) => s.ids).sort()).toEqual([...CAT_IDS].sort());
    expect(phone.strips.every((s) => s.ids.length === 2)).toBe(true);
    expect(phone.strips.find((s) => (s.ids as readonly string[]).includes("dante"))!.ids).toContain("odin");
  });

  it("nudges a cat inward only as far as it reaches past its strip", () => {
    const wide = placeCat("tom", { ...SAMPLE, w: 800, centerX: 100 }, 24); // reaches 29 cm right
    expect(phoneNudge(wide, 1)).toBe(-PHONE_CHART.maxNudgeCm);
    expect(phoneNudge(wide, 0)).toBe(0);
    const slight = placeCat("kira", { ...SAMPLE, w: 1000, centerX: 450 }, 24); // reaches 18.75 cm left
    expect(phoneNudge(slight, 0)).toBeCloseTo(0.75);
    expect(phoneNudge(placeCat("dante", SAMPLE, 24), 1)).toBe(-0);
  });

  it("keeps every cat inside its strip after the nudge", () => {
    for (const strip of PHONE_CHART.strips) {
      strip.forEach((id, column) => {
        const { leftCm, rightCm } = extents(byId[id]);
        const outer = column === 0 ? leftCm - byId[id].phoneNudgeCm : rightCm + byId[id].phoneNudgeCm;
        expect(outer, id).toBeLessThanOrEqual(PHONE_CHART.outerCm + 1e-9);
      });
    }
  });
});

describe("placementStyle", () => {
  it("hands the stylesheet centimetres, rounded, and no halo for anyone", () => {
    const style = placementStyle(placeCat("odin", SAMPLE, 24));
    expect(style).toEqual({
      "--cat-w": "20",
      "--cat-left": "-10",
      "--cat-bottom": "-1",
      "--cat-head": "28",
      "--phone-nudge": "0",
    });
  });
});

describe("helpers", () => {
  it("numbers plates from 01", () => {
    expect([0, 1, 9].map(plateNumber)).toEqual(["01", "02", "10"]);
  });

  it("knows the four cats by id", () => {
    expect(CAT_IDS.every(isCatId)).toBe(true);
    expect(isCatId("garfield")).toBe(false);
  });

  it("finds the lowest head in any line-up and refuses an empty one", () => {
    const low = placeCat("tom", { ...SAMPLE, headTopY: 400 }, 24);
    expect(lowestHead([placeCat("kira", SAMPLE, 24), low])).toBe("tom");
    expect(() => lowestHead([])).toThrow();
  });
});

describe("the renders in public/interlude", () => {
  const m: LineupManifest = manifest;

  it("carries no halo in any render: Odin wears none any more", () => {
    for (const id of CAT_IDS) expect(m.cats[id].haloInImage, id).toBeUndefined();
    for (const id of FIGURE_IDS) expect(m.figures[id].haloInImage, id).toBeUndefined();
    expect(m.figures["dante-swipe"]?.haloInImage).toBeUndefined();
  });

  it("has a WebP and an AVIF per cat and per figure, the WebP at the manifest's size", () => {
    const images = [...CAT_IDS.map((id) => [id, m.cats[id]] as const), ...FIGURE_IDS.map((id) => [id, m.figures[id]] as const)];
    for (const [id, image] of images) {
      const { w, h } = webpSize(readFileSync(path.join(PUBLIC, `${id}.webp`)));
      expect({ w, h }, id).toEqual({ w: image.w, h: image.h });
      expect(statSync(path.join(PUBLIC, `${id}.avif`)).size, id).toBeGreaterThan(0);
    }
  });

  it("keeps the select's renders within budget too: 90 KB an AVIF, 160 KB for him (nine times a cat's pixels)", () => {
    for (const id of [...FIGURE_IDS, ...OPTIONAL_FIGURE_IDS]) {
      expect(statSync(path.join(PUBLIC, `${id}.avif`)).size, id).toBeLessThanOrEqual((id === PLAYER_ONE ? 160 : 90) * 1024);
    }
  });

  it("stays within the image budget: 90 KB an AVIF, 360 KB for the four", () => {
    const sizes = CAT_IDS.map((id) => statSync(path.join(PUBLIC, `${id}.avif`)).size);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(90 * 1024);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(360 * 1024);
  });
});
