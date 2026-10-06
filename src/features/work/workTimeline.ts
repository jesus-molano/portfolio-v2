/**
 * The work stage is a film like the hero's: the page scroll is the picture,
 * and walls hold every beat that must be seen (story.ts in this folder).
 * This module lays the beats out on the film. Each beat gets a share of
 * the stage proportional to its natural seconds, so the scroll runs at one
 * pace from the title to the iris; a card's seconds are its reading time,
 * computed from its text, never hand-placed.
 */
import { FILM, readingSeconds } from "@/features/hero/scroll/film";
import type { Dictionary } from "@/i18n/dictionaries";
import { STOPS, type StopId } from "./stops";

export type BeatKind = "title" | "travel" | "hold" | "card";

/**
 * - title: the title card on night, a held wall.
 * - travel: no wall (fades, cut-ins, the car leaving).
 * - hold: a wall that holds for its seconds once the picture reaches it
 *   (the arrival, the trivision flips, the crane).
 * - card: a subtitle card, held for its reading time.
 */
export type BeatInput =
  | { kind: "title" | "travel" | "hold"; id: string; seconds: number; stop: number }
  | { kind: "card"; id: string; text: string; stop: number };

export type StageBeat = {
  kind: BeatKind;
  id: string;
  /** Index of the stop the beat plays at (0..4); -1 for the title. */
  stop: number;
  seconds: number;
  /** Film positions, 0..1. */
  start: number;
  end: number;
  /** Fraction of a card's window each fade takes (0 for other beats). */
  fade: number;
  /** Index among the cards, or -1. */
  card: number;
  text?: string;
};

export type StageTimeline = {
  beats: StageBeat[];
  /** The card beats, in order. */
  cards: StageBeat[];
  /** Film range of each stop (its first beat's start to its last beat's end). */
  stops: { from: number; to: number }[];
  /** Natural length in seconds. */
  seconds: number;
};

/** Natural seconds of the beats that carry no text (section 6.0 of the spec). */
export const BEAT_SECONDS = {
  title: 1.2,
  fadeIn: 0.6,
  arrive: 1.2,
  open: 0.6,
  leave: 0.6,
  flip: 0.8,
  signal: 0.8,
  crane: 2.0,
  end: 1.0,
} as const;

/** Scroll density, viewport heights per natural second: the hero's own (600vh over about 46 s). */
export const STAGE_DENSITY = 13;

function cardFade(seconds: number): number {
  return Math.min(0.3, FILM.fadeSeconds / seconds);
}

/** Lays the beats out in order, each with a share of the film proportional to its seconds. */
export function buildStageTimeline(inputs: readonly BeatInput[]): StageTimeline {
  const seconds = inputs.map((beat) => (beat.kind === "card" ? readingSeconds(beat.text) : beat.seconds));
  const total = seconds.reduce((sum, s) => sum + s, 0);
  let cursor = 0;
  let cardIndex = 0;
  const beats = inputs.map((input, i): StageBeat => {
    const start = cursor / total;
    cursor += seconds[i];
    const end = i === inputs.length - 1 ? 1 : cursor / total;
    const isCard = input.kind === "card";
    return {
      kind: input.kind,
      id: input.id,
      stop: input.stop,
      seconds: seconds[i],
      start,
      end,
      fade: isCard ? cardFade(seconds[i]) : 0,
      card: isCard ? cardIndex++ : -1,
      text: isCard ? input.text : undefined,
    };
  });
  const stopCount = Math.max(0, ...beats.map((beat) => beat.stop + 1));
  const stops = Array.from({ length: stopCount }, (_, s) => {
    const own = beats.filter((beat) => beat.stop === s);
    return { from: own[0]?.start ?? 0, to: own[own.length - 1]?.end ?? 0 };
  });
  return { beats, cards: beats.filter((beat) => beat.kind === "card"), stops, seconds: total };
}

/** The beat with this id; throws on an unknown id (capture names and deep links). */
export function beatAt(timeline: StageTimeline, id: string): StageBeat {
  const beat = timeline.beats.find((b) => b.id === id);
  if (!beat) throw new Error(`Unknown beat "${id}"`);
  return beat;
}

/** Index of the beat that plays at film position p (the last one at p = 1). */
export function beatIndexAt(timeline: StageTimeline, p: number): number {
  const { beats } = timeline;
  if (p <= 0) return 0;
  for (let i = 0; i < beats.length; i += 1) if (p < beats[i].end) return i;
  return beats.length - 1;
}

/** Position inside a beat, 0..1. */
export function beatT(beat: StageBeat, p: number): number {
  const span = beat.end - beat.start;
  return span > 0 ? Math.min(1, Math.max(0, (p - beat.start) / span)) : 1;
}

/**
 * A film position named for captures and deep links: a beat id, optionally
 * with a position inside it ("heuristik.crane@0.5"), or a plain number.
 */
export function resolveAt(timeline: StageTimeline, at: string | number): number {
  if (typeof at === "number") return Math.min(1, Math.max(0, at));
  const numeric = Number(at);
  if (at.trim() !== "" && Number.isFinite(numeric)) return Math.min(1, Math.max(0, numeric));
  const [id, inside] = at.split("@");
  const beat = beatAt(timeline, id);
  if (inside === undefined) {
    // A card is captured in the middle of its window; anything else at its end.
    return beat.kind === "card" ? (beat.start + beat.end) / 2 : beat.end - 1e-4;
  }
  return beat.start + (beat.end - beat.start) * Math.min(1, Math.max(0, Number(inside)));
}

/** Stage height in viewport heights, the same for both locales: the hero's density over the longer script. */
export function stageHeightVh(timelines: readonly StageTimeline[], density = STAGE_DENSITY): number {
  const seconds = Math.max(...timelines.map((timeline) => timeline.seconds));
  return Math.ceil((density * seconds) / 10) * 10;
}

type WorkDict = Dictionary["work"];

const STOP_KEY: Record<StopId, string> = {
  army: "army",
  pwc: "pwc",
  "cloud-district": "cloud",
  logixs: "logixs",
  heuristik: "heuristik",
};

/** The beats of the work stage (section 6.0 of the spec), from the dictionary. */
export function workBeats(work: WorkDict): BeatInput[] {
  const S = BEAT_SECONDS;
  const beats: BeatInput[] = [
    { kind: "title", id: "title", seconds: S.title, stop: -1 },
    // From the cats to the work: a line over the title card.
    { kind: "card", id: "bridge", text: work.bridge, stop: -1 },
    { kind: "travel", id: "fadeIn", seconds: S.fadeIn, stop: 0 },
  ];
  const cards = (stop: number, key: string, texts: readonly string[], from = 0) =>
    texts.map((text, i): BeatInput => ({ kind: "card", id: `${key}.card${from + i}`, text, stop }));

  STOPS.forEach((def, s) => {
    const key = STOP_KEY[def.id];
    const copy = work.stops[def.id];
    if (def.id === "army") beats.push({ kind: "hold", id: `${key}.arrive`, seconds: S.arrive, stop: s });
    else beats.push({ kind: "travel", id: `${key}.open`, seconds: S.open, stop: s });

    if (def.id === "cloud-district") {
      const board = work.stops["cloud-district"].board;
      beats.push(...cards(s, key, copy.cards.slice(0, 1)));
      beats.push({ kind: "hold", id: `${key}.flip1`, seconds: S.flip, stop: s });
      beats.push({ kind: "hold", id: `${key}.pangea`, seconds: readingSeconds(board.hold), stop: s });
      beats.push({ kind: "hold", id: `${key}.flip2`, seconds: S.flip, stop: s });
      beats.push(...cards(s, key, copy.cards.slice(1), 1));
    } else if (def.id === "heuristik") {
      beats.push({ kind: "hold", id: `${key}.crane`, seconds: S.crane, stop: s });
      beats.push(...cards(s, key, copy.cards));
    } else {
      beats.push(...cards(s, key, copy.cards));
    }

    if (def.id === "logixs") beats.push({ kind: "hold", id: `${key}.signal`, seconds: S.signal, stop: s });
    if (def.id !== "heuristik") beats.push({ kind: "travel", id: `${key}.leave`, seconds: S.leave, stop: s });
  });
  beats.push({ kind: "travel", id: "end", seconds: S.end, stop: STOPS.length - 1 });
  return beats;
}

/** The work stage's timeline for one locale. */
export function workTimeline(work: WorkDict): StageTimeline {
  return buildStageTimeline(workBeats(work));
}
