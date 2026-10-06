/**
 * The STATS map: where everything sits on Tenerife, and how the map art
 * (tools/art/stats/map.mjs, public/stats/*.svg) and the DOM over it share
 * one projection.
 *
 * Pure on purpose: map.mjs imports this file with Node's type stripping,
 * so at runtime it imports only the career's facts (career.ts, as
 * dependency-free), by the file's full name, as Node resolves it.
 *
 * Coordinates are real ([longitude, latitude], WGS 84): the towns stand
 * where the real ones do, under their parody names. The home glyph (HQ) is
 * the exception that proves it: it sits in the Teide's caldera, a national
 * park where nobody lives, so it never points at a real home.
 */

import { CAREER, isLive, type JobId } from "../career/career.ts";

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
 * `square` with keyed pins and a legend below that. The island keeps sea around it for the captions
 * (north and west) and the Gran Canaria box (south-east, where Gran Canaria
 * really is).
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
  { id: "santaCruz", kind: "town", town: [-16.252, 28.466], label: [-16.068, 28.422] },
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
  { id: "teresitas", kind: "town", town: [-16.188, 28.508], label: [-16.134, 28.452], minor: true },
  { id: "esperanza", kind: "town", town: [-16.372, 28.452], label: [-16.384, 28.398], minor: true },
  { id: "anaga", kind: "region", label: [-16.25, 28.6], minor: true },
  { id: "teide", kind: "summit", label: [-16.6425, 28.302] },
  { id: "canadas", kind: "region", label: [-16.558, 28.273], minor: true },
  { id: "sea", kind: "sea", label: [-16.83, 28.56] },
];

/** The real summit of the Teide (3,715 m), marked with a peak glyph. */
export const TEIDE: LonLat = [-16.6425, 28.2723];

// ---------------------------------------------------------------------------
// Blips

export type IconId =
  | "pit"
  | "box"
  | "pizza"
  | "arena"
  | "carWash"
  | "law"
  | "betting"
  | "booth"
  | "you"
  | "hq";

/**
 * Where a caption sits around its marker on the wide map: beside it
 * (centred on that side), or off a corner.
 */
export type CaptionSide = "left" | "right" | "top" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export type SideId = "pit" | "box" | "pizza" | "arena" | "carWash" | "law" | "betting" | "booth";

export type SideBlip = {
  id: SideId;
  /** The key on a phone, where the map shows letters and the legend the captions. */
  key: string;
  icon: IconId;
  at: LonLat;
  /** The town it stands in, named in the phone legend. */
  place: PlaceId;
  side: CaptionSide;
};

/**
 * The side activities: the favourites as places a fan recognises (the nods
 * are in AGENTS.md, never on screen). At most eight (tested).
 */
export const SIDE_BLIPS: readonly SideBlip[] = [
  // The motor circuit Tenerife has planned at Atogo for decades.
  { id: "pit", key: "A", icon: "pit", at: [-16.565, 28.122], place: "medano", side: "right" },
  // Masca, the pirates' hideout in the Teno ravines: a place to hide in a box.
  { id: "box", key: "B", icon: "box", at: [-16.842, 28.306], place: "masca", side: "bottom" },
  // Puerto de la Cruz, all pizzerias and flip-flops.
  { id: "pizza", key: "C", icon: "pizza", at: [-16.545, 28.405], place: "puerto", side: "topRight" },
  // Las Teresitas: Sahara sand, and "arena" is sand in Spanish.
  { id: "arena", key: "D", icon: "arena", at: [-16.175, 28.525], place: "teresitas", side: "right" },
  // The edge of the Malpaís de Güímar, a lava desert.
  { id: "carWash", key: "E", icon: "carWash", at: [-16.39, 28.29], place: "guimar", side: "topRight" },
  // A strip mall on the tourist coast.
  { id: "law", key: "F", icon: "law", at: [-16.722, 28.09], place: "americas", side: "left" },
  // An old harbour town.
  { id: "betting", key: "G", icon: "betting", at: [-16.762, 28.368], place: "garachico", side: "top" },
  // Next to the player: the way on to the projects.
  { id: "booth", key: "H", icon: "booth", at: [-16.525, 28.072], place: "medano", side: "bottomRight" },
];

/** The player arrow at the south airport: everyone wakes up on arrival. */
export const PLAYER = { at: [-16.6, 28.045] as LonLat, heading: -38, side: "bottomLeft" as CaptionSide };

/** Home base, in the caldera: a villain's lair, not an address. */
export const HQ = { at: [-16.585, 28.236] as LonLat, side: "bottom" as CaptionSide };

export type MissionId = JobId;

export type Mission = {
  id: MissionId;
  number: 1 | 2 | 3 | 4 | 5;
  /** The stop in the career city (#work-…). */
  anchor: `work-${MissionId}`;
  years: readonly [number, number | null];
  /**
   * Where the mission was: a place on the map, or `home` for the jobs done
   * from home base, which stack beside the HQ glyph instead of pointing at
   * any place.
   */
  at: LonLat | "home";
  /** In the Gran Canaria box. */
  inset: boolean;
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
export const CAREER_CITY_ON_PAGE = false;

/**
 * Where each mission sits on the map. The army in Las Palmas (in the box),
 * then four jobs, every one of them done from home base, so no job points
 * at an office.
 */
const MISSION_PLACES: Record<MissionId, Pick<Mission, "at" | "inset">> = {
  army: { at: [-15.43, 28.11], inset: true },
  pwc: { at: "home", inset: false },
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
  live: isLive(job),
}));

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
 * Everything on the MAP tab's screen above and below the map, in CSS px
 * (Stats.module.css): the screen's top padding (64, .screen), the menu
 * bar (46), the gap (24), the map's title (23), its source line (27), the
 * gap (24), the button prompts (24) and the bottom padding (24). The map
 * is never taller than the rest of the screen, so from 1280 px, where the
 * missions stand beside it, the whole tab fits on one. Below that the
 * missions run above the map and the tab scrolls on.
 */
export const MAP_CHROME_PX = 256;

/**
 * The button prompts' row (24) and the screen's bottom padding (24) in CSS
 * px (Stats.module.css .foot, .screen): the prompts' top stands this far
 * over STATS's bottom edge. The MAP tab's last line, the map's source line,
 * ends a row gap (24) higher; beside the map (from 1280 px) the main
 * missions end with the map's frame, a source line (27) higher still.
 * THE LATE SHOW's word rises over that edge between the prompts, never
 * above their row.
 */
export const FOOT_PX = 48;

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
 * STATS's menu bar on a phone (Stats.module.css, under 700 px): the title
 * (the pause bars, their gap and the word) on its own row and, under it,
 * the tabs and the clock, at least `gap` apart; under `clockUpBelow` px the
 * clock goes up beside the title instead (in Spanish ESTADÍSTICAS ran into
 * it at 360 px). Widths as Chromium measures them: the tabs and the clock
 * are JetBrains Mono, 7 px a character at 12 px plus the letter spacing
 * after each one, a tab adds its padding and border (34); the title is
 * Unbounded ExtraBold, under 0.9 em a capital with its tracking.
 */
export const PHONE_MENU = {
  pad: 16,
  gap: 24,
  clockUpBelow: 390,
  monoEm: 7 / 12,
  tab: { fontPx: 12, tracking: 0.22, inset: 34, gap: 8 },
  clock: { fontPx: 12, tracking: 0.24 },
  title: { fontPx: 22, em: 0.9, bars: 38 },
} as const;

/** A line of JetBrains Mono, in CSS px: `tracking` in ems after every character. */
export function monoWidth(text: string, fontPx: number, tracking: number): number {
  return Array.from(text).length * fontPx * (PHONE_MENU.monoEm + tracking);
}

/**
 * The phone menu's rows at a viewport width: what each row needs (the
 * title's, then the tabs'; the clock in whichever it shares) and the room
 * the screen's paddings leave them.
 */
export function phoneMenuRows(
  viewport: number,
  menu: { title: string; tabs: readonly string[]; clock: string },
): { room: number; rows: number[] } {
  const { pad, gap, clockUpBelow, tab, clock, title } = PHONE_MENU;
  const who = title.bars + Array.from(menu.title).length * title.fontPx * title.em;
  const tabs =
    menu.tabs.reduce((sum, name) => sum + monoWidth(name, tab.fontPx, tab.tracking) + tab.inset, 0) +
    tab.gap * (menu.tabs.length - 1);
  const time = gap + monoWidth(menu.clock, clock.fontPx, clock.tracking);
  const up = viewport < clockUpBelow;
  return { room: viewport - 2 * pad, rows: [who + (up ? time : 0), tabs + (up ? 0 : time)] };
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
/** Captions wrap at this many ems; the booth's call to action gets more room. */
export const CAPTION_MAX_EM = 11;
export const BOOTH_MAX_EM = 16;

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
): Box {
  const k = mapWidth / frame.width;
  const [x, y] = [at[0] * k, at[1] * k];
  const font = captionFontPx(mapWidth);
  // Each string starts a new line (the booth's call to action is a block of its own).
  const maxWidth = maxEm * font;
  const widths = lines.flatMap((line) => wrap(line, font, maxWidth));
  // A caption that wraps takes the full max-width (CSS max-content, capped).
  const wraps = lines.some((line) => textWidth(line, font) > maxWidth);
  const width = (wraps ? maxWidth : Math.max(...widths)) + 14;
  const height = widths.length * font * CAPTION_LINE_HEIGHT + 6;
  const g = CAPTION_GAP_PX;
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
  blips: Record<Exclude<SideId, "booth">, string>;
  booth: { caption: string; action: string };
  you: string;
  hq: string;
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

/** Every caption, marker, mission, label and note on the wide map at a width, in CSS px. */
/** What the map places: the defaults below, or a candidate while tuning. */
export type MapLayout = {
  side: readonly SideBlip[];
  places: readonly Place[];
  player: { at: LonLat; side: CaptionSide };
  hq: { at: LonLat; side: CaptionSide };
  missions: readonly Mission[];
};

export const MAP_LAYOUT: MapLayout = { side: SIDE_BLIPS, places: PLACES, player: PLAYER, hq: HQ, missions: MISSIONS };

/** Labels marked `minor` show only on a map at least this wide (a container query in the CSS). */
export const MINOR_LABELS_FROM = 820;

export function wideMapItems(texts: MapTexts, mapWidth: number, layout: MapLayout = MAP_LAYOUT): MapItem[] {
  const frame = FRAMES.wide;
  const k = mapWidth / frame.width;
  const items: MapItem[] = [];

  const caption = (id: string, at: MapPoint, side: CaptionSide, lines: string[], maxEm = CAPTION_MAX_EM) => {
    items.push({ id: `${id}:caption`, kind: "caption", box: captionBox(at, frame, mapWidth, lines, side, maxEm) });
    items.push({ id: `${id}:marker`, kind: "marker", box: markerBox(at, frame, mapWidth) });
  };

  for (const blip of layout.side) {
    const at = project(frame, blip.at);
    if (blip.id === "booth") caption(blip.id, at, blip.side, [texts.booth.caption, `${texts.booth.action} ▼`], BOOTH_MAX_EM);
    else caption(blip.id, at, blip.side, [texts.blips[blip.id]]);
  }
  caption("you", project(frame, layout.player.at), layout.player.side, [texts.you]);
  caption("hq", project(frame, layout.hq.at), layout.hq.side, [texts.hq]);

  for (const mission of layout.missions) {
    if (mission.at === "home") continue;
    const at = blipPoint(frame, mission.at, mission.inset);
    const box = markerBox(at, frame, mapWidth, 24);
    // The tick badge at its top right.
    items.push({ id: `mission${mission.number}`, kind: "mission", box: { ...box, right: box.right + 8, top: box.top - 7 } });
  }
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
