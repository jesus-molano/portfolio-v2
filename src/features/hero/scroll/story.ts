/**
 * The hero is a film the visitor scrubs. The page scroll is the picture:
 * camera, cuts, title, bars, cards and fade follow it 1:1 and stop when it
 * stops. The story paces it with walls, one per beat (the title, every
 * subtitle card and the crane reveal). The wall of the first unfinished
 * beat creeps through that beat at the beat's own reading pace, and the
 * picture is `min(scroll, frontier)`: nothing plays without input, the
 * camera never stops dead while she scrolls, and no card can be passed
 * before it has been on screen for its reading time.
 *
 * Pure functions on a small mutable state; HeroStage steps them on the GSAP
 * ticker and SmoothScroll trims the page scroll to the frontier.
 */
import { CUT_BAND, SHOT_COUNT } from "../scene/shots";
import { type Beat, buildTimeline, type FilmTimeline, type ShotTiming } from "./film";

export const STORY = {
  /** Film progress where the title has gone and the subtitles may start. */
  titleOut: 0.1,
  /** The letterbox bars have slid out. */
  barsOut: 0.16,
  /** The last subtitle has gone; from here the stage fades to night. */
  fadeFrom: 0.93,
  /** The title wall: early input moves the frame a little, the name holds. */
  titleWallFrom: 0.012,
  titleWallTo: 0.03,
  /** Seconds the fully formed name holds before the drive may start. */
  titleHold: 1.2,
  /** The crane shot starts here; its reveal holds for craneHold seconds. */
  craneFrom: 0.8,
  craneHold: 1.5,
  /** A card wall starts this far inside its active window... */
  wallInset: 0.0015,
  /** ...and stops this far before its end. */
  wallMargin: 0.002,
  /** Card fades run on time, not on position (seconds). */
  cardFadeIn: 0.25,
  cardFadeOut: 0.2,
  /** Pixels a card rises while it fades in. */
  cardRise: 6,
  /** A card counts as fully visible from this opacity. */
  fullyVisible: 0.999,
  /**
   * Longest time step a frame may take. A slow device (down to 4 fps) still
   * reads at real time: a card's reading clock only counts frames that
   * showed it fully opaque, so a long frame never credits time unseen. A
   * hidden tab counts nothing (HeroStage drops the first frame back).
   */
  maxStep: 0.25,
  /** Cards hide while there was backward input this recently (seconds). */
  rewindHide: 0.25,
  /**
   * Resting mid-dissolve, between the title wall and titleOut, the title
   * finishes its fade on time over this long (s) instead of hanging over
   * the sky as a ghost (settleTitle).
   */
  titleSettle: 0.6,
  /**
   * The end cue shows from the fade (where the between-card cue stops)
   * after endIdle seconds of idle, so no stretch of the film is silent.
   */
  endFrom: 0.93,
  endIdle: 0.8,
} as const;

/** The shot each script line plays in (see scene/shots.ts). */
export const LINE_SHOTS = [0, 1, 1, 2, 3, 4] as const;

/**
 * The crane is a reveal: it flies for a few seconds before its one line, so
 * the line lands as the city comes into view, and holds after it.
 */
export const SHOT_TIMING: ReadonlyArray<ShotTiming | undefined> = [
  undefined,
  undefined,
  undefined,
  undefined,
  { leadIn: 4.5, tail: 1.5 },
];

/** The hero's film timeline for a script (one array of cards per line). */
export function heroTimeline(lines: readonly (readonly string[])[]): FilmTimeline {
  return buildTimeline(
    lines.map((cards, i) => ({ shot: LINE_SHOTS[i] ?? SHOT_COUNT - 1, cards })),
    {
      shotCount: SHOT_COUNT,
      captionsFrom: STORY.titleOut,
      captionsTo: STORY.fadeFrom,
      shotTiming: SHOT_TIMING,
    },
  );
}

/** A beat's wall: it creeps from `from` to `to` over `hold` seconds. */
export type Wall = { kind: "title" | "card" | "crane"; card: number; from: number; to: number; hold: number };

/**
 * Per-wall clocks and creep, and per-card opacity. Mutated in place.
 * - `clock`: seconds the beat has played (a card: on screen while active);
 *   its wall creeps with it.
 * - `seen`: seconds a card has been on screen fully opaque; it reads its
 *   line, so it decides when the card is done and how full its bar is. A
 *   card that comes back after a rewind fades in again and only counts
 *   again once it is fully up.
 */
export type Story = { clock: number[]; seen: number[]; creep: number[]; done: boolean[]; opacity: number[] };

export type StoryContext = {
  /** Backward input in the last STORY.rewindHide seconds: cards hide. */
  rewinding: boolean;
  /** The tab is visible; clocks stop while it is not. */
  visible: boolean;
  /** The title's letter reveal has completed. */
  introDone: boolean;
  /** Progress of the letter reveal, 0..1. */
  introProgress: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Where a card is fully up on the film: its window minus half of each fade,
 * so a card counts as up from the middle of its old position-based fade-in
 * to the middle of its fade-out.
 */
export function activeWindow(beat: Beat): { from: number; to: number } {
  const w = (beat.end - beat.start) * beat.fade;
  return { from: beat.start + w / 2, to: beat.end - w / 2 };
}

/** Active windows per timeline, so a frame allocates nothing. */
const windowsOf = new WeakMap<FilmTimeline, { from: number; to: number }[]>();

function activeWindows(timeline: FilmTimeline): { from: number; to: number }[] {
  let windows = windowsOf.get(timeline);
  if (!windows) {
    windows = timeline.beats.map(activeWindow);
    windowsOf.set(timeline, windows);
  }
  return windows;
}

/** The card whose active window contains `p`, or -1. */
export function activeCard(p: number, timeline: FilmTimeline): number {
  const windows = activeWindows(timeline);
  for (let i = 0; i < windows.length; i += 1) {
    if (p >= windows[i].from && p < windows[i].to) return i;
  }
  return -1;
}

/**
 * The walls in film order: the title, the cards, and the crane before the
 * last card. The crane wall starts past the cut's band (CUT_BAND), so the
 * picture cuts to the crane at once instead of waiting in the old shot.
 */
export function buildWalls(timeline: FilmTimeline): Wall[] {
  const walls: Wall[] = [
    { kind: "title", card: -1, from: STORY.titleWallFrom, to: STORY.titleWallTo, hold: STORY.titleHold },
  ];
  timeline.beats.forEach((beat, i) => {
    const w = activeWindow(beat);
    if (i === timeline.beats.length - 1 && w.from > STORY.craneFrom) {
      // The crane reveal: the last line's shot flies before its card.
      walls.push({
        kind: "crane",
        card: -1,
        from: STORY.craneFrom + CUT_BAND + STORY.wallInset,
        to: w.from - STORY.wallInset,
        hold: STORY.craneHold,
      });
    }
    walls.push({
      kind: "card",
      card: i,
      from: w.from + STORY.wallInset,
      to: w.to - STORY.wallMargin,
      hold: beat.seconds,
    });
  });
  return walls;
}

export function newStory(walls: readonly Wall[], cards: number): Story {
  return {
    clock: walls.map(() => 0),
    seen: walls.map(() => 0),
    creep: walls.map(() => 0),
    done: walls.map(() => false),
    opacity: Array.from({ length: cards }, () => 0),
  };
}

/** Index of the first unfinished beat's wall, or -1 when every beat is done. */
export function frontierIndex(story: Story): number {
  return story.done.indexOf(false);
}

/** Furthest film progress the picture may reach now; +Infinity when every beat is done. */
export function frontier(walls: readonly Wall[], story: Story): number {
  const k = frontierIndex(story);
  if (k < 0) return Number.POSITIVE_INFINITY;
  const wall = walls[k];
  return wall.from + (wall.to - wall.from) * story.creep[k];
}

/**
 * Advances one frame: fades every card toward its target on time, runs the
 * frontier beat's clock, creeps its wall and marks it done. Returns the
 * active card (-1 while rewinding or between cards).
 *
 * `dt` is the time the previous frame was on screen, so a card's `seen`
 * clock grows by it only if the previous frame showed the card fully
 * opaque. A card is done once it has been seen for its reading time less
 * the fade-in: with the 0.25 s fade-in, that is its full reading time on
 * screen, and never less fully opaque, however often she rewinds.
 */
export function stepStory(
  walls: readonly Wall[],
  story: Story,
  timeline: FilmTimeline,
  p: number,
  dt: number,
  ctx: StoryContext,
): number {
  const step = Math.min(STORY.maxStep, Math.max(0, dt));
  const active = ctx.rewinding ? -1 : activeCard(p, timeline);
  const k = frontierIndex(story);
  const wall = k >= 0 ? walls[k] : undefined;
  // What the previous frame showed of the frontier card.
  const shown = wall?.kind === "card" ? story.opacity[wall.card] : 0;
  for (let i = 0; i < story.opacity.length; i += 1) {
    const want = i === active ? 1 : 0;
    const now = story.opacity[i];
    if (now === want) continue;
    const rate = step / (want > now ? STORY.cardFadeIn : STORY.cardFadeOut);
    story.opacity[i] = want > now ? Math.min(want, now + rate) : Math.max(want, now - rate);
  }

  if (!wall || !ctx.visible) return active;
  if (wall.kind === "title") {
    // Half the title wall follows the letter reveal and half the hold after
    // it, so even the earliest scroll moves the frame a little.
    if (ctx.introDone) story.clock[k] += step;
    const intro = ctx.introDone ? 1 : clamp01(ctx.introProgress);
    story.creep[k] = Math.max(story.creep[k], 0.5 * intro + 0.5 * Math.min(1, story.clock[k] / wall.hold));
  } else if (wall.kind === "crane") {
    if (p >= STORY.craneFrom) story.clock[k] += step;
    story.creep[k] = Math.max(story.creep[k], Math.min(1, story.clock[k] / wall.hold));
  } else if (active === wall.card) {
    // The wall creeps from the card's first fade-in frame, so the camera
    // never stops dead at a new line; the line is read while fully up.
    story.clock[k] += step;
    if (shown >= STORY.fullyVisible) story.seen[k] += step;
    story.creep[k] = Math.max(story.creep[k], Math.min(1, story.clock[k] / wall.hold));
  }
  const finished =
    wall.kind === "card"
      ? story.seen[k] >= readHold(wall) && story.opacity[wall.card] >= STORY.fullyVisible
      : story.clock[k] >= wall.hold;
  if (finished) {
    story.done[k] = true;
    story.creep[k] = 1;
  }
  return active;
}

/**
 * The beat playing at the picture, if any: the frontier beat while it runs
 * where she can see it. An unread card that is up ("card"), the title's
 * name forming and holding ("title"), the crane rising ("crane"). While one
 * plays, the line is hers to wait for; otherwise the film waits for her.
 * `active` is this frame's active card (stepStory).
 */
export function playingBeat(walls: readonly Wall[], story: Story, p: number, active: number): Wall["kind"] | null {
  const k = frontierIndex(story);
  if (k < 0) return null;
  const wall = walls[k];
  if (wall.kind === "card") return active === wall.card ? "card" : null;
  if (wall.kind === "crane") return p >= STORY.craneFrom ? "crane" : null;
  return "title";
}

/**
 * The title's own fade, 0 (it follows the picture) to 1 (gone), for one
 * frame of `dt` seconds. Where she rests between the title wall and
 * `titleOut` the title would hang over the sky half dissolved, like a
 * transition that got stuck: once it is her turn there (`resting`), it
 * finishes fading on time. Going back toward the title (`back`) gives it
 * back to the picture.
 */
export function settleTitle(settle: number, p: number, back: boolean, resting: boolean, dt: number): number {
  const step = Math.max(0, dt) / STORY.titleSettle;
  if (back || p <= STORY.titleWallTo) return Math.max(0, settle - 2 * step);
  if (resting && p < STORY.titleOut) return Math.min(1, settle + step);
  return settle;
}

/** Wall index of a card, or -1. */
export function cardWall(walls: readonly Wall[], card: number): number {
  for (let k = 0; k < walls.length; k += 1) {
    if (walls[k].kind === "card" && walls[k].card === card) return k;
  }
  return -1;
}

/**
 * The card she has reached at film position `p`: the last one whose
 * active window starts at or before it, or -1 on the title. The still
 * hero (reduced motion) uses it to keep her place in the running script.
 */
export function cardAt(p: number, timeline: FilmTimeline): number {
  const windows = activeWindows(timeline);
  let card = -1;
  for (let i = 0; i < windows.length; i += 1) if (windows[i].from <= p) card = i;
  return card;
}

/** Seconds a card wall must be seen fully opaque: its reading time (at least 1.6 s) less the fade-in. */
function readHold(wall: Wall): number {
  return wall.hold - STORY.cardFadeIn;
}

/** How much of a card's reading time has run, 0..1; 1 once its beat is done. */
export function readFill(walls: readonly Wall[], story: Story, card: number): number {
  const k = cardWall(walls, card);
  if (k < 0) return 0;
  if (story.done[k]) return 1;
  return Math.min(1, story.seen[k] / readHold(walls[k]));
}

/** Marks every beat done: Skip, Esc, End, focus leaving the hero. */
export function openAll(story: Story): void {
  story.done.fill(true);
  story.creep.fill(1);
}

/** Marks done every beat whose wall starts at or before `p` (dev jumps). */
export function openUpTo(walls: readonly Wall[], story: Story, p: number): void {
  walls.forEach((wall, k) => {
    if (wall.from <= p) {
      story.done[k] = true;
      story.creep[k] = 1;
    }
  });
}

/**
 * The film position the next or previous line starts at (Space, PageDown,
 * Shift+Space, PageUp, a tap on the picture). Forward never passes the
 * frontier; null when the frontier leaves no room: the press is a knock
 * on an unread card.
 */
export function lineStep(
  dir: 1 | -1,
  p: number,
  timeline: FilmTimeline,
  frontierP: number,
): number | null {
  const starts = timeline.beats.map((beat) => activeWindow(beat).from);
  if (dir > 0) {
    const next = starts.find((from) => from > p + 0.001);
    const target = Math.min(next === undefined ? 1 : next + STORY.wallInset, frontierP);
    return target <= p + 0.0005 ? null : target;
  }
  let previous: number | undefined;
  for (const from of starts) if (from < p - 0.006) previous = from;
  return previous === undefined ? 0 : previous + STORY.wallInset;
}
