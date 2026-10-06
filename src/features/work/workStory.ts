/**
 * The work stage's walls: the hero's scroll model (hero/scroll/story.ts) on
 * the stage's own beats. The picture is `min(scroll, frontier)`; the wall
 * of the first unfinished beat creeps through that beat at its own pace.
 * A card holds until it has been on screen, fully opaque, for its reading
 * time; a hold (the title, the arrival, the flips, the crane) holds for its
 * seconds once the picture has reached it. Nothing plays without input.
 *
 * Pure functions on a small mutable state, stepped by WorkStage.
 */
import { activeWindow, STORY } from "@/features/hero/scroll/story";
import type { StageTimeline } from "./workTimeline";

export type Wall = { kind: "hold" | "card"; card: number; beat: number; from: number; to: number; hold: number };

export type StageStory = { clock: number[]; seen: number[]; creep: number[]; done: boolean[]; opacity: number[] };

export type StageContext = {
  /** Backward input in the last STORY.rewindHide seconds: cards hide. */
  rewinding: boolean;
  /** The tab is visible and the night is ready: clocks run. */
  running: boolean;
};

/** A hold wall starts counting once the picture is this close to its start (film progress). */
const HOLD_REACH = 0.0005;

/** Card windows (where a card is fully up), per timeline, so a frame allocates nothing. */
const windowsOf = new WeakMap<StageTimeline, { from: number; to: number }[]>();

function cardWindows(timeline: StageTimeline): { from: number; to: number }[] {
  let windows = windowsOf.get(timeline);
  if (!windows) {
    windows = timeline.cards.map((beat) => activeWindow({ ...beat, line: beat.card }));
    windowsOf.set(timeline, windows);
  }
  return windows;
}

/** The card whose active window contains `p`, or -1. */
export function activeCardAt(p: number, timeline: StageTimeline): number {
  const windows = cardWindows(timeline);
  for (let i = 0; i < windows.length; i += 1) if (p >= windows[i].from && p < windows[i].to) return i;
  return -1;
}

/** One wall per title, hold and card beat, in film order. */
export function stageWalls(timeline: StageTimeline): Wall[] {
  const windows = cardWindows(timeline);
  const walls: Wall[] = [];
  timeline.beats.forEach((beat, i) => {
    if (beat.kind === "travel") return;
    if (beat.kind === "card") {
      const w = windows[beat.card];
      walls.push({
        kind: "card",
        card: beat.card,
        beat: i,
        from: w.from + STORY.wallInset,
        to: w.to - STORY.wallMargin,
        hold: beat.seconds,
      });
      return;
    }
    // The title wall starts at the very top, so the stage's first frame is held.
    const span = beat.end - beat.start;
    walls.push({
      kind: "hold",
      card: -1,
      beat: i,
      from: beat.kind === "title" ? Math.min(0.002, span / 4) : beat.start + Math.min(STORY.wallInset, span / 4),
      to: beat.end - Math.min(STORY.wallMargin, span / 4),
      hold: beat.seconds,
    });
  });
  return walls;
}

export function newStageStory(walls: readonly Wall[], cards: number): StageStory {
  return {
    clock: walls.map(() => 0),
    seen: walls.map(() => 0),
    creep: walls.map(() => 0),
    done: walls.map(() => false),
    opacity: Array.from({ length: cards }, () => 0),
  };
}

/** Index of the first unfinished wall, or -1 when every beat is done. */
export function stageFrontierIndex(story: StageStory): number {
  return story.done.indexOf(false);
}

/** Furthest film position the picture may reach now; +Infinity when every beat is done. */
export function stageFrontier(walls: readonly Wall[], story: StageStory): number {
  const k = stageFrontierIndex(story);
  if (k < 0) return Number.POSITIVE_INFINITY;
  const wall = walls[k];
  return wall.from + (wall.to - wall.from) * story.creep[k];
}

/** Seconds a card wall must be seen fully opaque: its reading time less the fade-in. */
function readHold(wall: Wall): number {
  return wall.hold - STORY.cardFadeIn;
}

/**
 * Advances one frame: fades the cards on time, runs the frontier beat's
 * clock, creeps its wall and marks it done. `p` is the picture. Returns the
 * active card (-1 while rewinding or between cards).
 */
export function stepStageStory(
  walls: readonly Wall[],
  story: StageStory,
  timeline: StageTimeline,
  p: number,
  dt: number,
  ctx: StageContext,
): number {
  const step = Math.min(STORY.maxStep, Math.max(0, dt));
  const active = ctx.rewinding ? -1 : activeCardAt(p, timeline);
  const k = stageFrontierIndex(story);
  const wall = k >= 0 ? walls[k] : undefined;
  const shown = wall?.kind === "card" ? story.opacity[wall.card] : 0;
  for (let i = 0; i < story.opacity.length; i += 1) {
    const want = i === active ? 1 : 0;
    const now = story.opacity[i];
    if (now === want) continue;
    const rate = step / (want > now ? STORY.cardFadeIn : STORY.cardFadeOut);
    story.opacity[i] = want > now ? Math.min(want, now + rate) : Math.max(want, now - rate);
  }
  if (!wall || !ctx.running) return active;
  if (wall.kind === "hold") {
    if (p >= wall.from - HOLD_REACH) story.clock[k] += step;
    story.creep[k] = Math.max(story.creep[k], Math.min(1, story.clock[k] / wall.hold));
  } else if (active === wall.card) {
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

/** How much of a card's reading time has run, 0..1; 1 once its beat is done. */
export function stageReadFill(walls: readonly Wall[], story: StageStory, card: number): number {
  const k = walls.findIndex((wall) => wall.kind === "card" && wall.card === card);
  if (k < 0) return 0;
  if (story.done[k]) return 1;
  return Math.min(1, story.seen[k] / readHold(walls[k]));
}

/** Marks every beat done: Skip, Esc, End, focus or a jump past the stage. */
export function openAllWalls(story: StageStory): void {
  story.done.fill(true);
  story.creep.fill(1);
}

/** Marks done every wall that starts at or before `p` (navigation: anchors, find in page, the scrollbar). */
export function openWallsUpTo(walls: readonly Wall[], story: StageStory, p: number): void {
  walls.forEach((wall, k) => {
    if (wall.from <= p) {
      story.done[k] = true;
      story.creep[k] = 1;
    }
  });
}

/**
 * The film position of the next or previous card (Space, PageDown,
 * Shift+Space, PageUp, a tap). Forward never passes the frontier; null
 * when the frontier leaves no room: the press knocks on an unread card.
 */
export function stageLineStep(dir: 1 | -1, p: number, timeline: StageTimeline, frontierP: number): number | null {
  const starts = cardWindows(timeline).map((w) => w.from);
  if (dir > 0) {
    const next = starts.find((from) => from > p + 0.001);
    const target = Math.min(next === undefined ? 1 : next + STORY.wallInset, frontierP);
    return target <= p + 0.0005 ? null : target;
  }
  let previous: number | undefined;
  for (const from of starts) if (from < p - 0.006) previous = from;
  return previous === undefined ? 0 : previous + STORY.wallInset;
}
