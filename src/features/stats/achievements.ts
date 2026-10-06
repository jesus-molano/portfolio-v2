import { createRandom } from "@/features/hero/scene/world";

/**
 * The ACHIEVEMENTS tab: his favourites and his goals as a game's
 * achievement tree, drawn as constellations in the island's night sky
 * (Achievements.tsx). Four branches grow from him, the player (P1):
 * SPORT, GAMES, FILM and SERIES; FILM and SERIES both feed one shared
 * star, keeping up with Marvel, which he has given up on. Every star is
 * an achievement, unlocked or locked; the words are in the dictionaries
 * (`stats.achievements.nodes`), the drawing is here.
 *
 * Pure and deterministic: the tests hold the counts (derived, never
 * typed), the edges, the keyboard order and the layout (no label, star
 * or link on another at every width the sky is drawn at).
 */

export type BranchId = "sport" | "games" | "film" | "series";
/** Where a star hangs: one of the four branches, or the crossover FILM and SERIES share. */
export type PlaceId = BranchId | "crossover";
/** SPORT's own constellations, each with its name in the sky. */
export type GroupId = "rope" | "running" | "f1";

export type AchievementId =
  | "ropeBasic"
  | "boxerStep"
  | "doubleUnders"
  | "run2k"
  | "run5k"
  | "run10k"
  | "halfMarathon"
  | "marathon"
  | "f1Dawn"
  | "alonso33"
  | "pig"
  | "metalGear"
  | "devilMayCry"
  | "skyrim"
  | "rdr2"
  | "gta6"
  | "elderScrolls6"
  | "godfather"
  | "usualSuspects"
  | "matrix"
  | "pulpFiction"
  | "odyssey"
  | "imax"
  | "sopranos"
  | "breakingBad"
  | "betterCallSaul"
  | "peakyBlinders"
  | "chernobyl"
  | "onePiece"
  | "marvel";

/**
 * How locked a star is. `max`: locked hardest, three padlocks (eating like
 * a pig); `surrendered`: the white flag (Marvel). Both are locked.
 */
export type Lock = "none" | "locked" | "max" | "surrendered";

/** Which side of its star a title stands on. */
export type LabelSide = "left" | "right";

/** A point in the sky's drawing, in units of a SKY.width × SKY.height plane. */
export type SkyPoint = readonly [x: number, y: number];

export type Achievement = {
  id: AchievementId;
  place: PlaceId;
  group?: GroupId;
  lock: Lock;
  /** The stars it grows from: its branch's hub ("hub"), or other achievements. */
  from: readonly ("hub" | AchievementId)[];
  at: SkyPoint;
  label: LabelSide;
  /** One of his two favourites (The Godfather, The Sopranos): a bigger gold star, tagged, first from its hub. */
  favourite?: true;
};

/** The sky's drawing plane (the SVG's viewBox); the stars sit in it in percentages. */
export const SKY = { width: 1200, height: 640 } as const;

/** Him, the player, where every branch starts. */
export const ROOT: SkyPoint = [600, 608];

/** A branch: its hub (where it leaves the player) and the centre of its name and count, clear of every link. */
export type Branch = { id: PlaceId; hub: SkyPoint | null; caption: SkyPoint | null };

/** The branches in the order the list (and the keyboard) reads them; the crossover has no hub of its own. */
export const BRANCHES: readonly Branch[] = [
  { id: "sport", hub: [302, 584], caption: [341, 612] },
  { id: "games", hub: [565, 555], caption: [490, 560] },
  { id: "film", hub: [830, 563], caption: [783, 592] },
  { id: "series", hub: [956, 604], caption: [1092, 581] },
  { id: "crossover", hub: null, caption: null },
];

/** SPORT's constellations: their names over the top of each, as a star chart names its figures. */
export const GROUPS: readonly { id: GroupId; at: SkyPoint }[] = [
  { id: "rope", at: [130, 287] },
  { id: "running", at: [259, 153] },
  { id: "f1", at: [468, 384] },
];

/**
 * Every achievement, branch by branch, each path from its hub outwards
 * (the list's and the keyboard's order). A branch forks into several
 * paths, as a game's tree does; FILM's and SERIES' meet in Marvel's star.
 * His two favourites come first from their hubs.
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  // SPORT. Jump rope: the basic bounce and the boxer step, never double unders.
  { id: "ropeBasic", place: "sport", group: "rope", lock: "none", from: ["hub"], at: [138, 504], label: "left" },
  { id: "boxerStep", place: "sport", group: "rope", lock: "none", from: ["ropeBasic"], at: [91, 388], label: "right" },
  { id: "doubleUnders", place: "sport", group: "rope", lock: "locked", from: ["boxerStep"], at: [110, 335], label: "right" },
  // Running: 2 km, 5 km in 24 minutes, 10 km in an hour; the half and the full marathon to come.
  { id: "run2k", place: "sport", group: "running", lock: "none", from: ["hub"], at: [261, 477], label: "right" },
  { id: "run5k", place: "sport", group: "running", lock: "none", from: ["run2k"], at: [276, 399], label: "right" },
  { id: "run10k", place: "sport", group: "running", lock: "none", from: ["run5k"], at: [281, 334], label: "right" },
  { id: "halfMarathon", place: "sport", group: "running", lock: "locked", from: ["run10k"], at: [301, 275], label: "right" },
  { id: "marathon", place: "sport", group: "running", lock: "locked", from: ["halfMarathon"], at: [246, 186], label: "right" },
  // Formula 1, watched: up at 4 a.m. for a race and back to sleep, and Alonso's 33rd win, pending since 2013.
  { id: "f1Dawn", place: "sport", group: "f1", lock: "none", from: ["hub"], at: [426, 492], label: "right" },
  { id: "alonso33", place: "sport", group: "f1", lock: "locked", from: ["f1Dawn"], at: [459, 419], label: "right" },
  // Locked harder than anything: a wink at the 118 % appetite bar, never a retelling.
  { id: "pig", place: "sport", lock: "max", from: ["hub"], at: [169, 552], label: "left" },

  // GAMES: Metal Gear Solid 3, then Devil May Cry 3, where it forks: Skyrim toward its sequel, Red Dead toward GTA VI.
  { id: "metalGear", place: "games", lock: "none", from: ["hub"], at: [594, 471], label: "right" },
  { id: "devilMayCry", place: "games", lock: "none", from: ["metalGear"], at: [611, 368], label: "right" },
  { id: "skyrim", place: "games", lock: "none", from: ["devilMayCry"], at: [581, 318], label: "left" },
  { id: "elderScrolls6", place: "games", lock: "locked", from: ["skyrim"], at: [559, 217], label: "left" },
  { id: "rdr2", place: "games", lock: "none", from: ["devilMayCry"], at: [664, 287], label: "right" },
  { id: "gta6", place: "games", lock: "locked", from: ["rdr2"], at: [694, 229], label: "right" },

  // FILM, his favourite first: up to The Matrix, which feeds Marvel and forks to The Odyssey (seen whole) and 70 mm IMAX (not yet).
  { id: "godfather", place: "film", lock: "none", favourite: true, from: ["hub"], at: [890, 460], label: "left" },
  { id: "usualSuspects", place: "film", lock: "none", from: ["godfather"], at: [897, 398], label: "left" },
  { id: "pulpFiction", place: "film", lock: "none", from: ["usualSuspects"], at: [886, 342], label: "left" },
  { id: "matrix", place: "film", lock: "none", from: ["pulpFiction"], at: [921, 264], label: "left" },
  { id: "odyssey", place: "film", lock: "none", from: ["matrix"], at: [831, 155], label: "left" },
  { id: "imax", place: "film", lock: "locked", from: ["odyssey"], at: [857, 75], label: "left" },

  // SERIES, his favourite first: on to Better Call Saul, which feeds Marvel, and to Chernobyl; One Piece is a path of its own.
  { id: "sopranos", place: "series", lock: "none", favourite: true, from: ["hub"], at: [1044, 479], label: "left" },
  { id: "breakingBad", place: "series", lock: "none", from: ["sopranos"], at: [973, 382], label: "right" },
  { id: "betterCallSaul", place: "series", lock: "none", from: ["breakingBad"], at: [974, 253], label: "right" },
  { id: "peakyBlinders", place: "series", lock: "none", from: ["sopranos"], at: [1133, 341], label: "left" },
  { id: "chernobyl", place: "series", lock: "none", from: ["peakyBlinders"], at: [1152, 290], label: "left" },
  { id: "onePiece", place: "series", lock: "locked", from: ["hub"], at: [1054, 532], label: "right" },

  // Both branches feed it, and he surrendered.
  { id: "marvel", place: "crossover", lock: "surrendered", from: ["matrix", "betterCallSaul"], at: [942, 186], label: "right" },
];

export function isUnlocked(achievement: Pick<Achievement, "lock">): boolean {
  return achievement.lock === "none";
}

const BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

export function achievement(id: AchievementId): Achievement {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`No achievement ${id}`);
  return found;
}

export function branchOf(id: PlaceId): Branch {
  const found = BRANCHES.find((branch) => branch.id === id);
  if (!found) throw new Error(`No branch ${id}`);
  return found;
}

/** The achievements on a branch, in the tree's reading order. */
export function onBranch(place: PlaceId): Achievement[] {
  return ACHIEVEMENTS.filter((item) => item.place === place);
}

export type Tally = { unlocked: number; total: number };

/** Unlocked out of all, counted from the data, never typed in. */
export function tally(items: readonly Pick<Achievement, "lock">[] = ACHIEVEMENTS): Tally {
  return { unlocked: items.filter(isUnlocked).length, total: items.length };
}

/**
 * What a branch's count covers: its own stars and every star it feeds
 * outside it, so Marvel, locked, counts in both FILM and SERIES and
 * neither reads as finished.
 */
export function branchItems(place: PlaceId): Achievement[] {
  const own = onBranch(place);
  if (place === "crossover") return own;
  const ids = new Set(own.map((item) => item.id));
  const fed = ACHIEVEMENTS.filter((item) => item.place !== place && item.from.some((from) => from !== "hub" && ids.has(from)));
  return [...own, ...fed];
}

export function branchTally(place: PlaceId): Tally {
  return tally(branchItems(place));
}

/** Fills a counter's {unlocked} and {total}. */
export function formatTally(template: string, { unlocked, total }: Tally): string {
  return template.replace("{unlocked}", String(unlocked)).replace("{total}", String(total));
}

export type EdgeEnd = "root" | `hub:${BranchId}` | AchievementId;

export type Edge = {
  from: EdgeEnd;
  to: EdgeEnd;
  a: SkyPoint;
  b: SkyPoint;
  /** The branch whose colour it takes (the crossover's links take their feeders'). */
  tint: BranchId;
  /** Lit: it leads to an unlocked star. Locked links are drawn dotted and dim. */
  lit: boolean;
  /** Links from the player: 0 for root to hub, 1 for hub to its first stars, and so on. */
  depth: number;
};

/** How many links from the player a star is: a hub is 1 away, its first stars 2, and so on (the shortest way, for the crossover). */
function depthOf(from: "hub" | AchievementId): number {
  if (from === "hub") return 1;
  return 1 + Math.min(...achievement(from).from.map(depthOf));
}

function placeTint(item: Achievement, from: "hub" | AchievementId): BranchId {
  if (item.place !== "crossover") return item.place;
  if (from === "hub") throw new Error("The crossover has no hub");
  return placeTint(achievement(from), "hub");
}

/** Every link in the sky: the player to each hub, each hub to its chains, each star to what it grows from. */
export function edges(): Edge[] {
  const list: Edge[] = [];
  for (const branch of BRANCHES) {
    if (!branch.hub || branch.id === "crossover") continue;
    list.push({ from: "root", to: `hub:${branch.id}`, a: ROOT, b: branch.hub, tint: branch.id, lit: true, depth: 0 });
  }
  for (const item of ACHIEVEMENTS) {
    for (const from of item.from) {
      const source = from === "hub" ? branchOf(item.place).hub : achievement(from).at;
      if (!source) throw new Error(`${item.id} grows from a hub its branch lacks`);
      list.push({
        from: from === "hub" ? (`hub:${item.place}` as EdgeEnd) : from,
        to: item.id,
        a: source,
        b: item.at,
        tint: placeTint(item, from),
        lit: isUnlocked(item),
        depth: depthOf(from),
      });
    }
  }
  return list;
}

/**
 * The arrow keys' neighbours inside a branch: the branch's stars in their
 * list order, the next and the previous one, stopping at the ends.
 */
export function stepInBranch(id: AchievementId, step: 1 | -1): AchievementId {
  const list = onBranch(achievement(id).place);
  const index = list.findIndex((item) => item.id === id);
  return list[Math.min(list.length - 1, Math.max(0, index + step))].id;
}

/** A point as percentages of the sky, for CSS. */
export function percent([x, y]: SkyPoint): { left: number; top: number } {
  return { left: (x / SKY.width) * 100, top: (y / SKY.height) * 100 };
}

// ---------------------------------------------------------------------------
// The drawing's type and boxes (mirrored in Achievements.module.css)

/**
 * The sky's type in units of its plane. Titles are set in cqi (the sky is
 * a size container): clamp(TITLE_MIN_PX, TITLE_CQI cqi, TITLE_MAX_PX), so
 * between the clamps they scale with the drawing and the tests hold for
 * every width; at the narrowest sky the minimum is the widest the type
 * gets in units, which is what the tests check against.
 */
export const TYPE = {
  /** The narrowest sky (the wide layout from 1000 px; the screen's paddings are 48 px each side). */
  minSkyPx: 904,
  titleCqi: 1.04,
  titleMinPx: 11,
  titleMaxPx: 14,
  lineHeight: 1.2,
  /** Space Grotesk at 600, generous: the average advance in ems. */
  advanceEm: 0.6,
  /** A title wraps at this many ems (Achievements.module.css, the label's max-width). */
  maxEm: 8,
  /** A star's radius, and the gap from its edge to its title, in units. */
  starRadius: 9,
  /** The two hard locks (eating like a pig, Marvel) this many times bigger. */
  maxStarScale: 1.6,
  /** His two favourites' gold stars this many times bigger. */
  favouriteStarScale: 1.4,
  gap: 8,
  /** The tag under a title (BLOQUEO MÁXIMO, RENDIDO, FAVORITA): mono caps, in ems of the title. */
  tagEm: 0.72,
  tagAdvanceEm: 0.82,
} as const;

/** The widest a title's em gets, in sky units (at the narrowest sky, the type's minimum). */
export function emUnits(skyPx: number = TYPE.minSkyPx): number {
  const px = Math.min(TYPE.titleMaxPx, Math.max(TYPE.titleMinPx, (skyPx * TYPE.titleCqi) / 100));
  return px * (SKY.width / skyPx);
}

export type Box = { x: number; y: number; width: number; height: number };

/** Greedy word wrap at `maxEm`, by the generous advance; the lines' lengths in ems. */
export function wrapEms(text: string, maxEm = TYPE.maxEm): number[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: number[] = [];
  let current = -1;
  for (const word of words) {
    const width = Array.from(word).length * TYPE.advanceEm;
    const joined = current < 0 ? width : current + TYPE.advanceEm + width;
    if (current >= 0 && joined > maxEm) {
      lines.push(current);
      current = width;
    } else current = joined;
  }
  if (current >= 0) lines.push(current);
  return lines;
}

/** A star's radius in units: the two hard locks and the two favourites are drawn bigger (Achievements.module.css, --star). */
export function starRadius(item: Pick<Achievement, "lock" | "favourite">): number {
  if (item.lock === "max" || item.lock === "surrendered") return TYPE.starRadius * TYPE.maxStarScale;
  if (item.favourite) return TYPE.starRadius * TYPE.favouriteStarScale;
  return TYPE.starRadius;
}

/**
 * The box a star's title (and its tag, for the hard locks and the
 * favourites) takes beside it, in sky units. A title that wraps is taken
 * as wide as the wrap allows: the browser's balanced lines, set in the
 * real face, may fall anywhere up to it.
 */
export function labelBox(item: Achievement, title: string, tag: string | null, skyPx: number = TYPE.minSkyPx): Box {
  const em = emUnits(skyPx);
  const lines = wrapEms(title);
  let width = (lines.length > 1 ? TYPE.maxEm : Math.max(...lines)) * em;
  let height = lines.length * TYPE.lineHeight * em;
  if (tag) {
    width = Math.max(width, Array.from(tag).length * TYPE.tagAdvanceEm * TYPE.tagEm * em);
    height += TYPE.tagEm * 1.5 * em;
  }
  const [x, y] = item.at;
  const near = starRadius(item) + TYPE.gap;
  const left = item.label === "right" ? x + near : x - near - width;
  return { x: left, y: y - height / 2, width, height };
}

/** A star's own box. */
export function starBox(at: SkyPoint, r: number = TYPE.starRadius): Box {
  return { x: at[0] - r, y: at[1] - r, width: 2 * r, height: 2 * r };
}

/** A hub's or a group's name: centred under (hub) or on (group) its point; mono caps, like the menu's. */
export function captionBox(at: SkyPoint, text: string, below: number, skyPx: number = TYPE.minSkyPx): Box {
  const em = emUnits(skyPx) * TYPE.tagEm;
  const width = Array.from(text).length * TYPE.tagAdvanceEm * em;
  const height = 1.3 * em;
  return { x: at[0] - width / 2, y: at[1] + below - height / 2, width, height };
}

/**
 * Where a star's details open (hover, focus, a tap): a card on its
 * title's side, under the title in the sky's upper half and over it in
 * the lower half, so it never covers its own star or title.
 */
export const DETAIL = { widthEm: 17, maxLines: 3, chipEm: 1.6, padEm: 1.5 } as const;

export type DetailAlign = "start" | "end";

/**
 * Which edge of its title the details line up with: the edge by the star
 * (a title on the right starts at its star, one on the left ends there),
 * unless the card would leave the sky that way, then the other.
 */
export function detailAlign(item: Achievement, label: Box, skyPx: number = TYPE.minSkyPx): DetailAlign {
  const width = DETAIL.widthEm * emUnits(skyPx);
  if (item.label === "right") return label.x + width <= SKY.width ? "start" : "end";
  return label.x + label.width - width >= 0 ? "end" : "start";
}

export function detailBox(item: Achievement, label: Box, skyPx: number = TYPE.minSkyPx, align = detailAlign(item, label, skyPx)): Box {
  const em = emUnits(skyPx);
  const width = DETAIL.widthEm * em;
  const height = (DETAIL.chipEm + DETAIL.maxLines * 1.35 + DETAIL.padEm) * em;
  const x = align === "start" ? label.x : label.x + label.width - width;
  const down = item.at[1] < SKY.height / 2;
  const y = down ? label.y + label.height + 4 : label.y - 4 - height;
  return { x, y, width, height };
}

export function overlaps(a: Box, b: Box, margin = 0): boolean {
  return a.x < b.x + b.width + margin && b.x < a.x + a.width + margin && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;
}

/** Whether a segment crosses a box (Liang–Barsky clipping). */
export function segmentHitsBox(a: SkyPoint, b: SkyPoint, box: Box): boolean {
  const [x0, y0] = a;
  const dx = b[0] - x0;
  const dy = b[1] - y0;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, x0 - box.x],
    [dx, box.x + box.width - x0],
    [-dy, y0 - box.y],
    [dy, box.y + box.height - y0],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// The sky behind

export type FieldStar = { x: number; y: number; r: number; o: number };

/**
 * The faint stars behind the constellations: fixed (seeded), kept off the
 * achievements' stars and the player, so a background speck never reads
 * as one more achievement.
 */
export const FIELD: readonly FieldStar[] = (() => {
  const random = createRandom(1987);
  const keepOff = [ROOT, ...ACHIEVEMENTS.map((item) => item.at), ...BRANCHES.flatMap((branch) => (branch.hub ? [branch.hub] : []))];
  const stars: FieldStar[] = [];
  while (stars.length < 110) {
    const x = random() * SKY.width;
    const y = random() * SKY.height;
    const r = 0.6 + random() * 1.1;
    const o = 0.18 + random() * 0.42;
    if (keepOff.some(([px, py]) => Math.hypot(px - x, py - y) < 26)) continue;
    stars.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round(r * 100) / 100, o: Math.round(o * 100) / 100 });
  }
  return stars;
})();
