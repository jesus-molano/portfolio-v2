/**
 * The stage's opening, from the film position: the night fades up to the
 * first stop under the chapter card, over the card's own beat, and the card
 * leaves with her scroll inside that same beat, once its title wall has
 * held it (workStory.ts: on its own clock, as the hero's title). The
 * chrome (the route, the HUD, the stop's super, the chip) comes up only
 * once the card has gone and the drive has started. The card is not
 * pinned: it scrolls up with the page. Faded over the drive's first beat,
 * behind the arrival's held wall, it crawled up the screen at the beat's
 * pace while most of her scroll was thrown away, and read as lag; a line
 * that once opened the drive at its reading pace, with the night fading up
 * over it, read as a dark screen at the end of the page (the owner took it
 * out).
 */
import type { StageTimeline } from "./workTimeline";

/** Where in the title beat the chapter card starts and ends fading out (shares of the beat). */
export const TITLE_FADE = { from: 0.15, to: 0.75 } as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export type Opening = {
  /** How far the chapter card has gone, 0 (up) to 1 (gone). */
  titleOut: number;
  /** How far the night has faded up to the first stop, 0 to 1. */
  sceneIn: number;
  /** Whether the route, the HUD, the super and the chip are up. */
  chrome: boolean;
};

/** The opening at film position p (the title beat, then the drive; the end beat closes it). */
export function openingAt(timeline: StageTimeline, p: number, out: Opening = { titleOut: 0, sceneIn: 0, chrome: false }): Opening {
  const title = timeline.beats[0];
  const first = timeline.beats[1];
  const end = timeline.beats[timeline.beats.length - 1];
  const u = (p - title.start) / Math.max(1e-6, title.end - title.start);
  out.sceneIn = clamp01(u);
  out.titleOut = clamp01((u - TITLE_FADE.from) / (TITLE_FADE.to - TITLE_FADE.from));
  out.chrome = out.titleOut >= 1 && p >= first.start && p < end.start + 0.002;
  return out;
}
