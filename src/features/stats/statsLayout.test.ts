import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import canaries from "../../../tools/art/stats/canaries.json";
import { cardWidth, chapterLayout, inkRise, ribbonCaps, STRADDLE } from "@/components/ChapterCard/chapterLayout";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  FOOT_PX,
  FRAMES,
  HQ,
  MAP_CHROME_PX,
  MAP_MIN,
  MISSIONS,
  PHONE_MENU,
  PLACES,
  PLAYER,
  SIDE_BLIPS,
  SIDE_BY_SIDE_FROM,
  TEIDE,
  WIDE_FROM,
  blipPoint,
  captionBox,
  collisions,
  mapWidthAt,
  monoWidth,
  overlaps,
  phoneMenuRows,
  project,
  projectInset,
  toPercent,
  wideMapItems,
  wrap,
  type LonLat,
  type MapTexts,
} from "./statsLayout";

type Ring = { hole: boolean; points: [number, number][] };
type Island = { coastLevel: number; levels: Record<string, Ring[]> };
const islands = canaries.islands as unknown as Record<"tenerife" | "granCanaria", Island>;

function coastOf(island: Island): [number, number][] {
  return island.levels[String(island.coastLevel)][0].points;
}

function inside([x, y]: LonLat, ring: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Kilometres between two points (equirectangular, fine at island scale). */
function km([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const k = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot((lon1 - lon2) * k, lat1 - lat2) * 111.32;
}

function textsOf(dict: typeof en): MapTexts {
  const { map, missions } = dict.stats;
  return {
    places: map.places as MapTexts["places"],
    blips: map.blips,
    booth: map.booth,
    you: map.you,
    hq: map.hq,
    live: missions.live,
    inset: map.inset,
    north: map.north,
    scale: map.scale,
  };
}

/** Common screens from 1000 px wide up, short ones included. */
const SCREENS: [number, number][] = [
  [1024, 768],
  [1280, 720],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1600, 900],
  [1920, 1080],
];

/** Map widths the wide layout really takes: the common screens, and steps between them. */
const WIDTHS = [...new Set([MAP_MIN, 768, 794, 841, 909, 980, ...SCREENS.map(([w, h]) => mapWidthAt(w, h))])];

describe("the map's geography", () => {
  const tenerife = coastOf(islands.tenerife);
  const granCanaria = coastOf(islands.granCanaria);

  it("puts every blip, the player and home base on Tenerife's land", () => {
    for (const blip of SIDE_BLIPS) expect(inside(blip.at, tenerife), blip.id).toBe(true);
    expect(inside(PLAYER.at, tenerife)).toBe(true);
    expect(inside(HQ.at, tenerife)).toBe(true);
  });

  it("puts the army in Gran Canaria and every job since at home base: no office on the map", () => {
    const [army, ...jobs] = MISSIONS;
    expect(army.inset).toBe(true);
    expect(inside(army.at as LonLat, granCanaria)).toBe(true);
    expect(jobs.map((mission) => mission.id)).toEqual(["pwc", "cloud-district", "logixs", "heuristik"]);
    for (const mission of jobs) expect(mission.at, mission.id).toBe("home");
  });

  it("keeps home base away from every town: it never points at a real home", () => {
    for (const place of PLACES) {
      if (place.town && !place.inset) expect(km(HQ.at, place.town), place.id).toBeGreaterThan(8);
    }
    // In the Teide's caldera, a national park.
    expect(km(HQ.at, TEIDE)).toBeLessThan(8);
  });

  it("puts the summit sample within a kilometre of the real Teide", () => {
    const peak = canaries.islands.tenerife.peakSample.lonLat as unknown as LonLat;
    expect(km(peak, TEIDE)).toBeLessThan(1);
  });
});

describe("projection and frames", () => {
  it("keeps every point inside both crops (the names only on the wide one, where they show)", () => {
    for (const [id, frame] of Object.entries(FRAMES)) {
      const points = [
        ...SIDE_BLIPS.map((b) => project(frame, b.at)),
        project(frame, PLAYER.at),
        project(frame, HQ.at),
        ...MISSIONS.filter((m) => m.at !== "home").map((m) => blipPoint(frame, m.at as LonLat, m.inset)),
        ...(id === "wide" ? PLACES.filter((p) => p.label).map((p) => project(frame, p.label!)) : []),
      ];
      for (const point of points) {
        const { left, top } = toPercent(frame, point);
        expect(left).toBeGreaterThan(0);
        expect(left).toBeLessThan(100);
        expect(top).toBeGreaterThan(0);
        expect(top).toBeLessThan(100);
      }
    }
  });

  it("draws Gran Canaria inside its box, clear of Tenerife", () => {
    for (const frame of Object.values(FRAMES)) {
      const { inset } = frame;
      for (const p of coastOf(islands.granCanaria)) {
        const [x, y] = projectInset(frame, p);
        expect(x).toBeGreaterThan(inset.x);
        expect(x).toBeLessThan(inset.x + inset.width);
        expect(y).toBeGreaterThan(inset.y);
        expect(y).toBeLessThan(inset.y + inset.height);
      }
      for (const p of coastOf(islands.tenerife)) {
        const [x, y] = project(frame, p);
        const inBox = x > inset.x && x < inset.x + inset.width && y > inset.y && y < inset.y + inset.height;
        expect(inBox).toBe(false);
      }
    }
  });

  it("maps a point to percentages of the frame", () => {
    expect(toPercent(FRAMES.wide, [800, 550])).toEqual({ left: 50, top: 50 });
    expect(toPercent(FRAMES.square, [0, 1100])).toEqual({ left: 0, top: 100 });
  });
});

describe("the page geometry", () => {
  it("gives the map its column beside the main missions from 1280 px, the whole width below", () => {
    // 1440 less the paddings (2 x 48), the gap (32) and the missions (28% of 1440).
    expect(mapWidthAt(1440, 900)).toBeCloseTo(908.8, 5);
    expect(mapWidthAt(SIDE_BY_SIDE_FROM - 1, 2000)).toBe(SIDE_BY_SIDE_FROM - 1 - 64);
    expect(mapWidthAt(1024, 768)).toBeCloseTo(((768 - MAP_CHROME_PX) * 16) / 11, 5);
  });

  it("never shrinks the wide map below its minimum, however short the screen", () => {
    expect(mapWidthAt(1100, 500)).toBe(MAP_MIN);
  });

  it("keeps THE LATE SHOW's word under the prompts row where it straddles the cut, clear of the MAP tab's last line", () => {
    for (const [lang, dict] of [
      ["en", en],
      ["es", es],
    ] as const) {
      const { word, ribbon } = dict.projects.chapter;
      const layout = chapterLayout(word, ribbonCaps(ribbon, lang));
      for (const viewport of [WIDE_FROM, 1024, SIDE_BY_SIDE_FROM, 1366, 1440, 1536, 1920, 2560]) {
        // The widest card: a screen tall enough not to cap it.
        const rise = inkRise(layout, STRADDLE.projects) * cardWidth(viewport);
        // The word does straddle: its top shows over the edge.
        expect(rise, `${lang} ${viewport}`).toBeGreaterThan(16);
        // 8 px under the prompts' top, so 32 px under the map's source line, which ends a row gap over them
        // (and 59 px under the main missions beside the map, which end with the map's frame, a source line higher).
        expect(rise, `${lang} ${viewport}`).toBeLessThanOrEqual(FOOT_PX - 8);
      }
    }
  });

  it("lets STATS's prompts keep their clicks under THE LATE SHOW's box where it straddles, its text still selectable", () => {
    // The ink stays under their row (above), but from 1000 px, where the card straddles the cut, its box can reach
    // their 44 px targets (in Spanish up to about 1125 px, wider with a larger text size), and the cinema paints on top.
    const css = readFileSync(path.join(process.cwd(), "src/features/finale/Projects.module.css"), "utf8");
    expect(css).toMatch(/@media \(max-width: 999\.98px\) \{\s*\.projects \{\s*--chapter-straddle: 0;/);
    expect(css).toMatch(
      /@media \(min-width: 1000px\) \{\s*\.chapter \{\s*pointer-events: none;\s*\}\s*\.chapter text \{\s*pointer-events: auto;/,
    );
  });
});

describe("the menu bar on a phone", () => {
  const menuOf = (dict: typeof en) => ({ title: dict.stats.title, tabs: dict.stats.tabs, clock: dict.stats.clock });

  it("measures the mono words as Chromium does", () => {
    // Measured at 360 px: ESTADÍSTICAS's tab 149.69 px, MAP's 62.92, the clock 88.92; PAUSED 117.28 (the model errs wide).
    expect(monoWidth("ESTADÍSTICAS", 12, 0.22) + PHONE_MENU.tab.inset).toBeCloseTo(149.69, 1);
    expect(monoWidth("MAP", 12, 0.22) + PHONE_MENU.tab.inset).toBeCloseTo(62.92, 1);
    expect(monoWidth("DOM 23:47", 12, 0.24)).toBeCloseTo(88.92, 1);
    expect(Array.from("PAUSED").length * PHONE_MENU.title.fontPx * PHONE_MENU.title.em).toBeGreaterThan(117.28);
  });

  it("fits every row from 360 to 699 px in both languages: the clock beside the title under 390 px", () => {
    for (const dict of [en, es]) {
      for (let viewport = 360; viewport < 700; viewport += 1) {
        const { room, rows } = phoneMenuRows(viewport, menuOf(dict));
        for (const row of rows) expect(row, `${dict.stats.title} at ${viewport} px`).toBeLessThanOrEqual(room);
      }
    }
  });

  it("needs the clock up there: in Spanish at 360 px the tabs, the gap and the clock overrun the row", () => {
    const { pad, gap, tab, clock } = PHONE_MENU;
    const tabs = es.stats.tabs.reduce<number>((sum, name) => sum + monoWidth(name, tab.fontPx, tab.tracking) + tab.inset, tab.gap);
    expect(tabs + gap + monoWidth(es.stats.clock, clock.fontPx, clock.tracking)).toBeGreaterThan(360 - 2 * pad);
  });

  it("moves the clock at the stylesheet's breakpoint", () => {
    const css = readFileSync(path.join(process.cwd(), "src/features/stats/Stats.module.css"), "utf8");
    expect(css).toMatch(
      new RegExp(`@media \\(max-width: ${PHONE_MENU.clockUpBelow - 1}\\.98px\\) \\{[^@]*\\.clock \\{\\s*grid-row: 1;`),
    );
  });
});

describe("text measurement", () => {
  it("wraps greedily at the width", () => {
    expect(wrap("aa bb", 10, 1000, 0.5)).toEqual([25]);
    expect(wrap("aa bb", 10, 20, 0.5)).toEqual([10, 10]);
    expect(wrap("one", 10, 5, 0.5)).toEqual([15]);
  });

  it("detects overlapping boxes, with a margin", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(overlaps(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(overlaps(a, { left: 11, top: 0, right: 20, bottom: 10 }, 2)).toBe(true);
    expect(overlaps(a, { left: 5, top: 5, right: 6, bottom: 6 })).toBe(true);
  });

  it("places a caption on the side it is asked for", () => {
    const at = [800, 550] as const;
    const right = captionBox(at, FRAMES.wide, 800, ["Hi"], "right");
    const left = captionBox(at, FRAMES.wide, 800, ["Hi"], "left");
    const top = captionBox(at, FRAMES.wide, 800, ["Hi"], "top");
    const bottomLeft = captionBox(at, FRAMES.wide, 800, ["Hi"], "bottomLeft");
    expect(right.left).toBeGreaterThan(400);
    expect(left.right).toBeLessThan(400);
    expect(top.bottom).toBeLessThan(275);
    expect(bottomLeft.right).toBeLessThan(400);
    expect(bottomLeft.top).toBeGreaterThan(275);
  });
});

describe("the wide map's words", () => {
  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    for (const width of WIDTHS) {
      it(`${locale} at ${Math.round(width)} px: no caption, label or marker overlaps another, and all stay on the map`, () => {
        const items = wideMapItems(textsOf(dict), width);
        expect(collisions(items)).toEqual([]);
        const height = (width * FRAMES.wide.height) / FRAMES.wide.width;
        const outside = items.filter((i) => i.box.left < 0 || i.box.top < 0 || i.box.right > width || i.box.bottom > height);
        expect(outside.map((i) => i.id)).toEqual([]);
      });
    }
  }

  it("shows every caption: one per side blip, the player and home base", () => {
    const ids = wideMapItems(textsOf(en), 909)
      .filter((i) => i.kind === "caption")
      .map((i) => i.id.split(":")[0]);
    expect(ids.sort()).toEqual([...SIDE_BLIPS.map((b) => b.id), "you", "hq"].sort());
  });
});

describe("blips and missions", () => {
  it("has at most eight side activities, keyed A to H", () => {
    expect(SIDE_BLIPS.length).toBeLessThanOrEqual(8);
    expect(SIDE_BLIPS.map((b) => b.key).join("")).toBe("ABCDEFGH".slice(0, SIDE_BLIPS.length));
  });

  it("makes the booth the last side activity: the way on", () => {
    expect(SIDE_BLIPS.at(-1)!.id).toBe("booth");
  });

  it("numbers the missions in order, ticks four and keeps only the last live", () => {
    expect(MISSIONS.map((m) => m.number)).toEqual([1, 2, 3, 4, 5]);
    expect(MISSIONS.filter((m) => m.live).map((m) => m.id)).toEqual(["heuristik"]);
    expect(MISSIONS.at(-1)!.years[1]).toBeNull();
    for (const m of MISSIONS) expect(m.anchor).toBe(`work-${m.id}`);
    for (let i = 1; i < MISSIONS.length; i++) expect(MISSIONS[i].years[0]).toBeGreaterThanOrEqual(MISSIONS[i - 1].years[0]);
  });
});
