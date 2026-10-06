/**
 * The STATS map: where everything sits on Tenerife, and how the map art
 * (tools/art/stats/map.mjs, public/stats/*.svg) and the DOM over it share
 * one projection.
 *
 * Pure on purpose: map.mjs imports this file with Node's type stripping,
 * so at runtime it imports only the career's facts (career.ts, as
 * dependency-free), by the file's full name, as Node resolves it.
 *
 * The map is career geography only: where he has worked and where he is.
 * The army on site in Las Palmas (the Gran Canaria box), PwC on site at
 * the dock on the north-east coast, and the three jobs since done remote
 * from home base. No hobby on it: his favourites are a tab of their own.
 *
 * Coordinates are real ([longitude, latitude], WGS 84): the towns stand
 * where the real ones do, under their parody names. The home glyph (HQ) is
 * the exception that proves it: it sits in the Teide's caldera, a national
 * park where nobody lives, so it never points at a real home.
 */

import { CAREER, isLive, type JobId, type WorkMode } from "../career/career.ts";

/** [longitude, latitude] in degrees. */
export type LonLat = readonly [number, number];
/** A point in map units (the SVG viewBox), y down. */
export type MapPoint = readonly [number, number];

/** Latitude whose cosine scales longitude (an equirectangular map around Tenerife). */
export const REFERENCE_LAT = 28.3;
const LON_FACTOR = Math.cos((REFERENCE_LAT * Math.PI) / 180);

/** The Gran Canaria box in a corner, with its own scale. */
export type Inset = {
  /** The box, in map units. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Projection inside the box: map units per degree of latitude, and its top-left corner. */
  scale: number;
  lonLeft: number;
  latTop: number;
};

export type MapFrame = {
  width: number;
  height: number;
  /** Map units per degree of latitude. */
  scale: number;
  lonLeft: number;
  latTop: number;
  inset: Inset;
  /** Centre of the compass rose, and the left end of the 10 km scale bar. */
  compass: MapPoint;
  scaleBar: MapPoint;
};

export type FrameId = "wide" | "square";

/**
 * Two crops of the same map: `wide` (16:11) with captions from 1000 px up,
 * `square` below that, its words in a legend under it. The island keeps sea
 * around it for the captions (north and west) and the Gran Canaria box
 * (south-east, where Gran Canaria really is).
 */
export const FRAMES: Record<FrameId, MapFrame> = {
  wide: {
    width: 1600,
    height: 1100,
    scale: 1500,
    lonLeft: -17.05,
    latTop: 28.665,
    inset: { x: 1160, y: 560, width: 410, height: 500, scale: 520, lonLeft: -16.0475, latTop: 28.372 },
    compass: [1520, 140],
    scaleBar: [40, 1040],
  },
  square: {
    width: 1100,
    height: 1100,
    scale: 1470,
    lonLeft: -16.945,
    latTop: 28.64,
    inset: { x: 746, y: 690, width: 334, height: 390, scale: 520, lonLeft: -15.965, latTop: 28.276 },
    compass: [70, 80],
    scaleBar: [30, 1036],
  },
};

export function project(frame: MapFrame, [lon, lat]: LonLat): MapPoint {
  return [(lon - frame.lonLeft) * frame.scale * LON_FACTOR, (frame.latTop - lat) * frame.scale];
}

export function projectInset(frame: MapFrame, [lon, lat]: LonLat): MapPoint {
  const { inset } = frame;
  return [
    inset.x + (lon - inset.lonLeft) * inset.scale * LON_FACTOR,
    inset.y + (inset.latTop - lat) * inset.scale,
  ];
}

/** A map point as percentages of the frame, for absolutely placed DOM. */
export function toPercent(frame: MapFrame, [x, y]: MapPoint): { left: number; top: number } {
  return { left: round2((x / frame.width) * 100), top: round2((y / frame.height) * 100) };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Places: the real towns under their parody names (names in the dictionaries).

export type PlaceId =
  | "santaCruz"
  | "laLaguna"
  | "puerto"
  | "icod"
  | "garachico"
  | "masca"
  | "gigantes"
  | "americas"
  | "cristianos"
  | "medano"
  | "guimar"
  | "teresitas"
  | "esperanza"
  | "anaga"
  | "teide"
  | "canadas"
  | "sea";

export type Place = {
  id: PlaceId;
  /**
   * Where its name is centred on the wide map: beside the town, never on a
   * marker. None: the name shows only in the phone legend.
   */
  label?: LonLat;
  /** The town's light, if it gets a dot of its own. */
  town?: LonLat;
  kind: "town" | "region" | "summit" | "sea";
  /** Inside the Gran Canaria box. */
  inset?: boolean;
  /** Only on a map at least MINOR_LABELS_FROM wide. */
  minor?: boolean;
};

export const PLACES: readonly Place[] = [
  // Off the coast south of the town, below the ferry's line in to the dock (tested clear of the route).
  { id: "santaCruz", kind: "town", town: [-16.252, 28.466], label: [-16.205, 28.366] },
  { id: "laLaguna", kind: "town", town: [-16.316, 28.487], label: [-16.379, 28.504] },
  { id: "puerto", kind: "town", town: [-16.548, 28.413], label: [-16.54, 28.37] },
  { id: "icod", kind: "town", town: [-16.715, 28.366], label: [-16.674, 28.33], minor: true },
  { id: "garachico", kind: "town", town: [-16.764, 28.372], label: [-16.872, 28.368], minor: true },
  { id: "masca", kind: "town", town: [-16.842, 28.306], label: [-16.958, 28.306], minor: true },
  { id: "gigantes", kind: "town", town: [-16.838, 28.245], label: [-16.93, 28.19] },
  { id: "americas", kind: "town", town: [-16.727, 28.074], label: [-16.745, 28.14], minor: true },
  { id: "cristianos", kind: "town", town: [-16.715, 28.052], label: [-16.83, 27.96], minor: true },
  { id: "medano", kind: "town", town: [-16.537, 28.046], minor: true },
  { id: "guimar", kind: "town", town: [-16.41, 28.315], label: [-16.285, 28.29], minor: true },
  // Off the beach, north-east of the dock and above the ferry's line: the name the dock is read by.
  { id: "teresitas", kind: "town", town: [-16.188, 28.508], label: [-16.086, 28.534], minor: true },
  { id: "esperanza", kind: "town", town: [-16.372, 28.452], label: [-16.384, 28.398], minor: true },
  { id: "anaga", kind: "region", label: [-16.25, 28.6], minor: true },
  { id: "teide", kind: "summit", label: [-16.6425, 28.302] },
  { id: "canadas", kind: "region", label: [-16.558, 28.273], minor: true },
  { id: "sea", kind: "sea", label: [-16.83, 28.56] },
];

/** The real summit of the Teide (3,715 m), marked with a peak glyph. */
export const TEIDE: LonLat = [-16.6425, 28.2723];

// ---------------------------------------------------------------------------
// Markers

/** The pictograms (icons.tsx): home base, and the ring of a job done on site. */
export type IconId = "hq" | "site";

/**
 * Where a caption sits around its marker on the wide map: beside it
 * (centred on that side), or off a corner.
 */
export type CaptionSide = "left" | "right" | "top" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

/** The dock's caption stands this far right of its badge's centre, clear of the badge's tick (Stats.module.css .dock). */
const DOCK_GAP_PX = 26;

/** Home base, in the caldera: a villain's lair, not an address. The remote jobs' badges stand beside it. */
export const HQ = { at: [-16.585, 28.236] as LonLat, side: "bottom" as CaptionSide };

/**
 * The dock on Santa Cruz's north-east waterfront, at the level of Las
 * Teresitas (LAS SAHARITAS on the map): where PwC's job was done on site.
 * A point just inland of the 40 m coast ring the map draws, so the badge
 * stands on land (tested).
 */
export const DOCK = { at: [-16.224, 28.497] as LonLat, side: "right" as CaptionSide, gap: DOCK_GAP_PX };

export type MissionId = JobId;

export type Mission = {
  id: MissionId;
  number: 1 | 2 | 3 | 4 | 5;
  /** The stop in the career city (#work-…). */
  anchor: `work-${MissionId}`;
  years: readonly [number, number | null];
  /**
   * Where the mission was: a place on the map for a job done on site, or
   * `home` for the jobs done remote, whose badges stack beside the HQ glyph.
   */
  at: LonLat | "home";
  /** In the Gran Canaria box. */
  inset: boolean;
  /** On site or remote (career.ts), said in words on the missions list. */
  mode: WorkMode;
  /** Still going: the only red blip. */
  live: boolean;
};

/**
 * Whether the career city (#work-army ... #work-heuristik) is on the page.
 * Until it lands, the main missions are plain rows with the same content,
 * so no link points at a section that is not there (the page's anchor test
 * in src/app/[lang]/anchors.test.ts fails on a dead in-page link). The
 * career city turns this on when it adds those sections.
 */
export const CAREER_CITY_ON_PAGE = true;

/**
 * Where each mission sits on the map: the jobs done on site where they
 * were (the army in Las Palmas, in the box; PwC at the dock), the remote
 * ones at home base. Tested against career.ts's modes: a badge on a place
 * is a job done on site.
 */
const MISSION_PLACES: Record<MissionId, Pick<Mission, "at" | "inset">> = {
  army: { at: [-15.43, 28.11], inset: true },
  pwc: { at: DOCK.at, inset: false },
  "cloud-district": { at: "home", inset: false },
  logixs: { at: "home", inset: false },
  heuristik: { at: "home", inset: false },
};

/**
 * The career (src/features/career/career.ts) as main missions: one to
 * five, ticked, the last one LIVE. Numbers, years and anchors come from
 * there; this file adds only where each one sits on the map.
 */
export const MISSIONS: readonly Mission[] = CAREER.map((job) => ({
  id: job.id,
  number: job.number,
  anchor: job.anchor,
  years: job.years,
  ...MISSION_PLACES[job.id],
  mode: job.mode,
  live: isLive(job),
}));

// ---------------------------------------------------------------------------
// The career route (drawn by tools/art/stats/map.mjs, kept clear of the
// names by the tests)

/**
 * The career route on Tenerife: from the dock (where the ferry from Las
 * Palmas comes in, PwC's badge), along the waterfront into Santa Cruz,
 * then up the ridge road to home base.
 */
export const CAREER_ROAD: readonly LonLat[] = [
  DOCK.at, [-16.238, 28.487], [-16.255, 28.472], [-16.3, 28.478], [-16.31, 28.48], [-16.372, 28.45], [-16.43, 28.398],
  [-16.48, 28.345], [-16.51, 28.3], [-16.553, 28.296], [-16.585, 28.262], HQ.at,
];

/** A Catmull-Rom curve through `points`, `samples` points a segment, ending on the last one. */
export function catmullRom(points: readonly MapPoint[], samples = 8): MapPoint[] {
  const out: MapPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (k: 0 | 1) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * The ferry's crossing in a frame, as the map draws it: out of the Gran
 * Canaria box by its right side (clear of its title), across the strait
 * above Santa Cruz's name and below Las Teresitas', and in to the dock
 * from the sea. It never crosses a word or a marker (tested): the dock is
 * read by those names.
 */
export function ferryRoute(frame: MapFrame): MapPoint[] {
  const army = MISSIONS.find((mission) => mission.inset)!;
  const [ax, ay] = projectInset(frame, army.at as LonLat);
  const [dx, dy] = project(frame, DOCK.at);
  return catmullRom(
    [
      [ax, ay],
      [ax + 57, ay - 41],
      [ax + 67, ay - 136],
      [dx + 40, dy + 60],
      [dx, dy],
    ],
    16,
  );
}

/** The road from the dock to home base in a frame. It may touch a place's name, never a caption. */
export function roadRoute(frame: MapFrame): MapPoint[] {
  return catmullRom(
    CAREER_ROAD.map((point) => project(frame, point)),
    10,
  );
}

/** The whole career route in a frame: the ferry, then the road. */
export function careerRoute(frame: MapFrame): MapPoint[] {
  return [...ferryRoute(frame), ...roadRoute(frame).slice(1)];
}

/** The home missions' badges, in a row to the right of the HQ marker (CSS px). */
export const HOME_STACK = { gap: 4, badge: 24, step: 34, liveTag: 40 };

// ---------------------------------------------------------------------------
// Page geometry the DOM follows (Stats.module.css): the tests use it to
// check that no two captions or labels overlap at real viewport sizes.

/** Viewports from this width up show the wide map with captions; below it, the square map and a legend. */
export const WIDE_FROM = 1000;
/**
 * The main missions stand beside the map from this width up, as tall as its
 * frame; below it they run above the map and the map spans the column.
 */
export const SIDE_BY_SIDE_FROM = 1280;
/** The screen's content stops growing at this width (Stats.module.css, .screen). */
export const SCREEN_MAX = 1680;
/** The wide map never gets narrower than this, however short the screen. */
export const MAP_MIN = 740;
/**
 * The screen's bottom padding in CSS px (Stats.module.css .screen): the
 * room at STATS's foot, under the open tab's last line, that THE LATE
 * SHOW's word rises into from 1000 px, never up to that line. On the MAP
 * tab that last line is the map's source line; beside the map (from
 * 1280 px) the main missions end with the map's frame, a source line (27)
 * higher still. Nothing else stands there (the button prompts it once
 * held are gone, the owner's call).
 */
export const FOOT_PX = 72;

/**
 * Everything on the MAP tab's screen above and below the map, in CSS px
 * (Stats.module.css): the screen's top padding (64, .screen), the menu
 * bar (46), the gap (24), the map's title (23), its source line (27) and
 * the room at the foot (FOOT_PX). The map is never taller than the rest of
 * the screen, so from 1280 px, where the missions stand beside it, the
 * whole tab fits on one. Below that the missions run above the map and the
 * tab scrolls on.
 */
export const MAP_CHROME_PX = 64 + 46 + 24 + 23 + 27 + FOOT_PX;

/**
 * The map's rendered width in CSS pixels in a viewport (mirrors the CSS
 * grid): the column's width, but no taller than the viewport allows.
 */
export function mapWidthAt(viewport: number, viewportHeight = Infinity): number {
  const pad = viewport >= SIDE_BY_SIDE_FROM ? 48 : viewport >= 700 ? 32 : 16;
  const content = Math.min(viewport, SCREEN_MAX) - 2 * pad;
  const column =
    viewport >= SIDE_BY_SIDE_FROM ? content - 32 - Math.min(420, Math.max(300, viewport * 0.28)) : content;
  const byHeight = Math.max(MAP_MIN, ((viewportHeight - MAP_CHROME_PX) * 16) / 11);
  return Math.min(column, byHeight);
}

/**
 * STATS's menu bar under 1000 px (Stats.module.css): the pause glyph and
 * the clock on the first row, the tabs on their own row under it; under
 * 560 px the tabs are a grid of two columns of equal cells. Widths as
 * Chromium measures them: the tabs and the clock are JetBrains Mono, 7 px a
 * character at 12 px plus the letter spacing after each one, and a tab adds
 * its padding and border (34).
 */
export const PHONE_MENU = {
  pad: 16,
  gap: 8,
  gridBelow: 560,
  monoEm: 7 / 12,
  tab: { fontPx: 12, tracking: 0.22, inset: 34 },
  clock: { fontPx: 12, tracking: 0.24 },
  pause: 22,
} as const;

/** A line of JetBrains Mono, in CSS px: `tracking` in ems after every character. */
export function monoWidth(text: string, fontPx: number, tracking: number): number {
  return Array.from(text).length * fontPx * (PHONE_MENU.monoEm + tracking);
}

/** A tab's width in the menu bar, in CSS px. */
export function tabWidth(name: string): number {
  const { tab } = PHONE_MENU;
  return monoWidth(name, tab.fontPx, tab.tracking) + tab.inset;
}

/**
 * The menu bar's rows under 1000 px at a viewport width: what each row
 * needs (the pause glyph and the clock; the tabs, in one row or, under
 * `gridBelow`, two equal columns) and the room the screen's paddings
 * leave them.
 */
export function phoneMenuRows(viewport: number, menu: { tabs: readonly string[]; clock: string }): { room: number; rows: number[] } {
  const { pad, gap, gridBelow, clock, pause } = PHONE_MENU;
  const widths = menu.tabs.map(tabWidth);
  const tabs =
    viewport < gridBelow
      ? 2 * Math.max(...widths) + gap
      : widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  const top = pause + 16 + monoWidth(menu.clock, clock.fontPx, clock.tracking);
  const room = viewport - 2 * (viewport < 700 ? pad : 32);
  return { room, rows: [top, tabs] };
}

/** Caption font size on the wide map: 1.6% of the map width, between 12 and 13.5 px. */
export function captionFontPx(mapWidth: number): number {
  return Math.min(13.5, Math.max(12, mapWidth * 0.016));
}

/** Label font size on the wide map (Unbounded caps): 1.15% of the map width, 9 to 10.5 px. */
export function labelFontPx(mapWidth: number): number {
  return Math.min(10.5, Math.max(9, mapWidth * 0.0115));
}

/** Marker diameter on the wide map, CSS px. */
export const MARKER_PX = 26;
/** Gap from a marker's centre to its caption's near edge. */
export const CAPTION_GAP_PX = 17;
/** Offset from a marker's centre to the near corner of a caption off a corner. */
export const CAPTION_CORNER_PX = 11;
/** A caption's line height (Stats.module.css, .caption): its bands meet without covering descenders. */
export const CAPTION_LINE_HEIGHT = 1.4;
/** Captions wrap at this many ems. */
export const CAPTION_MAX_EM = 11;

export type Box = { left: number; top: number; right: number; bottom: number };

/**
 * An estimate of a text's width: Space Grotesk at weight 500 averages about
 * 0.55 em a character; 0.58 keeps the estimate on the safe side.
 */
export function textWidth(text: string, fontPx: number, emPerChar = 0.58): number {
  return Array.from(text).length * fontPx * emPerChar;
}

/** Greedy word wrap at a width: the lines' widths. */
export function wrap(text: string, fontPx: number, maxWidth: number, emPerChar = 0.58): number[] {
  const space = fontPx * emPerChar;
  const lines: number[] = [];
  let line = -space;
  for (const word of text.split(/\s+/)) {
    const w = textWidth(word, fontPx, emPerChar);
    if (line >= 0 && line + space + w > maxWidth) {
      lines.push(line);
      line = w;
    } else line += space + w;
  }
  lines.push(Math.max(0, line));
  return lines;
}

/** The box a caption chip covers beside its marker, in CSS px from the map's top-left. */
export function captionBox(
  at: MapPoint,
  frame: MapFrame,
  mapWidth: number,
  lines: readonly string[],
  side: CaptionSide,
  maxEm = CAPTION_MAX_EM,
  g = CAPTION_GAP_PX,
): Box {
  const k = mapWidth / frame.width;
  const [x, y] = [at[0] * k, at[1] * k];
  const font = captionFontPx(mapWidth);
  // Each string starts a new line.
  const maxWidth = maxEm * font;
  const widths = lines.flatMap((line) => wrap(line, font, maxWidth));
  // A caption that wraps takes the full max-width (CSS max-content, capped).
  const wraps = lines.some((line) => textWidth(line, font) > maxWidth);
  const width = (wraps ? maxWidth : Math.max(...widths)) + 14;
  const height = widths.length * font * CAPTION_LINE_HEIGHT + 6;
  const c = CAPTION_CORNER_PX;
  switch (side) {
    case "right":
      return { left: x + g, right: x + g + width, top: y - height / 2, bottom: y + height / 2 };
    case "left":
      return { left: x - g - width, right: x - g, top: y - height / 2, bottom: y + height / 2 };
    case "top":
      return { left: x - width / 2, right: x + width / 2, top: y - g - height, bottom: y - g };
    case "bottom":
      return { left: x - width / 2, right: x + width / 2, top: y + g, bottom: y + g + height };
    case "topRight":
      return { left: x + c, right: x + c + width, top: y - c - height, bottom: y - c };
    case "topLeft":
      return { left: x - c - width, right: x - c, top: y - c - height, bottom: y - c };
    case "bottomRight":
      return { left: x + c, right: x + c + width, top: y + c, bottom: y + c + height };
    case "bottomLeft":
      return { left: x - c - width, right: x - c, top: y + c, bottom: y + c + height };
  }
}

/**
 * The box a place label covers, centred on its point: town and summit
 * names in Unbounded caps tracked 0.12 em; regions and the sea in italic
 * Space Grotesk tracked 0.3 em. The widths are measured in the browser:
 * Unbounded caps run up to 1.07 em a character with the tracking (W, M and
 * wide caps; small sizes round up), italic Space Grotesk up to 0.9 em.
 */
export function labelBox(at: MapPoint, frame: MapFrame, mapWidth: number, text: string, kind: Place["kind"] = "town"): Box {
  const k = mapWidth / frame.width;
  const [x, y] = [at[0] * k, at[1] * k];
  const quiet = kind === "region" || kind === "sea";
  const font = quiet ? Math.min(12, Math.max(10, mapWidth * 0.013)) : labelFontPx(mapWidth);
  const width = textWidth(text, font, quiet ? 0.62 + 0.3 : 0.96 + 0.12);
  const height = font * 1.2;
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

/** The box a marker covers. */
export function markerBox(at: MapPoint, frame: MapFrame, mapWidth: number, size = MARKER_PX): Box {
  const k = mapWidth / frame.width;
  const [x, y] = [at[0] * k, at[1] * k];
  return { left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 };
}

export function overlaps(a: Box, b: Box, margin = 0): boolean {
  return a.left < b.right + margin && b.left < a.right + margin && a.top < b.bottom + margin && b.top < a.bottom + margin;
}

/** Where a blip's point is drawn in a frame (inset blips go through the box's projection). */
export function blipPoint(frame: MapFrame, at: LonLat, inset = false): MapPoint {
  return inset ? projectInset(frame, at) : project(frame, at);
}

// ---------------------------------------------------------------------------
// Everything drawn over the wide map, as boxes: what the overlap test checks.

/** The words on the map, from the dictionaries (stats.map and stats.missions). */
export type MapTexts = {
  places: Record<PlaceId, string>;
  hq: string;
  dock: string;
  live: string;
  inset: { name: string; city: string };
  north: string;
  scale: string;
};

export type MapItem = {
  id: string;
  kind: "caption" | "marker" | "label" | "mission" | "text";
  box: Box;
};

/** What the map places: the defaults below, or a candidate while tuning. */
export type MapLayout = {
  places: readonly Place[];
  hq: { at: LonLat; side: CaptionSide };
  dock: { at: LonLat; side: CaptionSide; gap: number };
  missions: readonly Mission[];
};

export const MAP_LAYOUT: MapLayout = { places: PLACES, hq: HQ, dock: DOCK, missions: MISSIONS };

/** Labels marked `minor` show only on a map at least this wide (a container query in the CSS). */
export const MINOR_LABELS_FROM = 820;

/** Every caption, marker, mission, label and note on the wide map at a width, in CSS px. */
export function wideMapItems(texts: MapTexts, mapWidth: number, layout: MapLayout = MAP_LAYOUT): MapItem[] {
  const frame = FRAMES.wide;
  const k = mapWidth / frame.width;
  const items: MapItem[] = [];

  const caption = (id: string, at: MapPoint, side: CaptionSide, lines: string[], marker = true, gap = CAPTION_GAP_PX) => {
    items.push({ id: `${id}:caption`, kind: "caption", box: captionBox(at, frame, mapWidth, lines, side, CAPTION_MAX_EM, gap) });
    if (marker) items.push({ id: `${id}:marker`, kind: "marker", box: markerBox(at, frame, mapWidth) });
  };

  caption("hq", project(frame, layout.hq.at), layout.hq.side, [texts.hq]);

  for (const mission of layout.missions) {
    if (mission.at === "home") continue;
    const at = blipPoint(frame, mission.at, mission.inset);
    const box = markerBox(at, frame, mapWidth, 24);
    // The tick badge at its top right.
    const id = mission.id === "pwc" ? "dock" : `mission${mission.number}`;
    items.push({ id: `${id}:badge`, kind: "mission", box: { ...box, right: box.right + 8, top: box.top - 7 } });
  }
  // The dock's name beside PwC's badge (the badge is its marker).
  caption("dock", project(frame, layout.dock.at), layout.dock.side, [texts.dock], false, layout.dock.gap);
  // Home base's missions: a row of badges right of the HQ marker, the last with its LIVE tag.
  const home = layout.missions.filter((m) => m.at === "home");
  if (home.length) {
    const hqBox = markerBox(project(frame, layout.hq.at), frame, mapWidth);
    const left = hqBox.right + HOME_STACK.gap;
    const right =
      left + home.length * HOME_STACK.step + (home.some((m) => m.live) ? HOME_STACK.liveTag : 0);
    const cy = (hqBox.top + hqBox.bottom) / 2;
    items.push({ id: "hq:missions", kind: "mission", box: { left, right, top: cy - HOME_STACK.badge / 2 - 7, bottom: cy + HOME_STACK.badge / 2 } });
  }

  // The summit glyph (map.mjs draws it at the real summit, 18 x 14 map units).
  const [tx, ty] = project(frame, TEIDE);
  items.push({ id: "summit", kind: "marker", box: { left: (tx - 10) * k, right: (tx + 10) * k, top: (ty - 9) * k, bottom: (ty + 7) * k } });

  for (const place of layout.places) {
    if (!place.label || (place.minor && mapWidth < MINOR_LABELS_FROM)) continue;
    const at = place.inset ? projectInset(frame, place.label) : project(frame, place.label);
    items.push({ id: `label:${place.id}`, kind: "label", box: labelBox(at, frame, mapWidth, texts.places[place.id], place.kind) });
  }

  // Gran Canaria's name and its city's, at the top of the box.
  const inset = frame.inset;
  const ix = inset.x * k;
  const iy = inset.y * k;
  const nameFont = labelFontPx(mapWidth);
  const nameWidth = Math.max(
    textWidth(texts.inset.name, nameFont, 0.96 + 0.24),
    textWidth(texts.inset.city, nameFont, 0.96 + 0.12),
  );
  items.push({
    id: "inset:name",
    kind: "text",
    box: { left: ix + 14, right: ix + 14 + nameWidth, top: iy + 12, bottom: iy + 12 + nameFont * 1.2 * 2 + 4 },
  });

  const [nx, ny] = frame.compass;
  items.push({ id: "north", kind: "text", box: { left: nx * k - 6, right: nx * k + 6, top: ny * k - 22 - 12 - 30 * k, bottom: ny * k - 22 - 30 * k + 12 } });
  const [sx, sy] = frame.scaleBar;
  items.push({ id: "scale", kind: "text", box: { left: sx * k, right: sx * k + textWidth(texts.scale, 12, 0.75), top: sy * k + 8, bottom: sy * k + 20 } });
  return items;
}

/** Pairs of items that collide (labels may touch the route and the art, never words or markers). */
export function collisions(items: MapItem[], margin = 2): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      // A blip's marker touches its own caption and badges by design.
      const sameBlip = a.id.split(":")[0] === b.id.split(":")[0];
      if (sameBlip && (a.kind === "marker" || b.kind === "marker") && a.kind !== "label" && b.kind !== "label") continue;
      if (overlaps(a.box, b.box, margin)) out.push([a.id, b.id]);
    }
  }
  return out;
}
