import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifestJson from "../../../public/interlude/manifest.json";
import {
  CAT_IDS,
  extents,
  isCatId,
  lowestHead,
  parseManifest,
  PHONE_CHART,
  phoneNudge,
  phoneStrips,
  placeCat,
  placeLineup,
  placementStyle,
  plateNumber,
  WIDE_CHART,
  WIDE_SLOT_CM,
  type CatImage,
  type LineupManifest,
} from "./lineup";

const PUBLIC = path.resolve(__dirname, "../../../public/interlude");
const manifest = parseManifest(manifestJson);
const lineup = placeLineup(manifest);
const byId = Object.fromEntries(lineup.map((p) => [p.id, p]));

/** A 20 x 30 cm image at 24 px/cm: floor 1 cm above its bottom, head top 1 cm under its top. */
const SAMPLE: CatImage = { w: 480, h: 720, floorY: 696, headTopY: 24, centerX: 240, headWidth: 240 };

function withCat(id: string, patch: Partial<CatImage> | null): unknown {
  const cats: Record<string, unknown> = Object.fromEntries(CAT_IDS.map((c) => [c, { ...SAMPLE }]));
  if (patch === null) delete cats[id];
  else cats[id] = { ...SAMPLE, ...patch };
  return { pxPerCm: 24, cats };
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

  it("keeps every head under the wide chart's numerals", () => {
    const numeralBottom = WIDE_CHART.numeralCm - WIDE_CHART.numeralHeightCm / 2;
    for (const p of lineup) expect(p.headTopCm, p.id).toBeLessThan(numeralBottom);
  });

  it("keeps neighbours apart on a wide screen", () => {
    for (let i = 1; i < lineup.length; i++) {
      const reach = extents(lineup[i - 1]).rightCm + extents(lineup[i]).leftCm;
      expect(reach, `${lineup[i - 1].id} and ${lineup[i].id}`).toBeLessThanOrEqual(WIDE_SLOT_CM);
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
    const wide = placeCat("tom", { ...SAMPLE, w: 800, centerX: 200 }, 24); // reaches 25 cm right
    expect(phoneNudge(wide, 1)).toBe(-PHONE_CHART.maxNudgeCm);
    expect(phoneNudge(wide, 0)).toBe(0);
    const slight = placeCat("kira", { ...SAMPLE, w: 700, centerX: 330 }, 24); // reaches 13.75 cm left
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
  });

  it("has a WebP and an AVIF per cat, the WebP at the manifest's size", () => {
    for (const id of CAT_IDS) {
      const { w, h } = webpSize(readFileSync(path.join(PUBLIC, `${id}.webp`)));
      expect({ w, h }, id).toEqual({ w: m.cats[id].w, h: m.cats[id].h });
      expect(statSync(path.join(PUBLIC, `${id}.avif`)).size, id).toBeGreaterThan(0);
    }
  });

  it("stays within the image budget: 90 KB an AVIF, 360 KB for the four", () => {
    const sizes = CAT_IDS.map((id) => statSync(path.join(PUBLIC, `${id}.avif`)).size);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(90 * 1024);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(360 * 1024);
  });
});
