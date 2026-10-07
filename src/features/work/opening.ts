/**
 * The stage's opening, from the film position: the night fades up to the
 * first stop under the chapter card, over the card's own beat; the card
 * lifts away early in the drive's first beat (the car rolling up to the
 * army's board), and the chrome (the route, the HUD, the stop's super, the
 * chip) comes up only once the card has gone. A line used to open the
 * drive with the night fading up over the whole of it, at its reading
 * pace, a wall with the limiter on: a first pass scrolled and pushed
 * through seconds of a dark screen and read it as the end of the page (the
 * owner took the line out). The card is not pinned: it scrolls up with the
 * page as the drive starts, so faded slowly it slid through the top band
 * over the route and the super, three layers of type in one place.
 */
import type { StageTimeline } from "./workTimeline";

/** Share of the drive's first beat over which the chapter card fades out. */
export const TITLE_FADE = 0.28;

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
  out.sceneIn = clamp01((p - title.start) / Math.max(1e-6, title.end - title.start));
  const t = clamp01((p - title.end) / Math.max(1e-6, first.end - first.start));
  out.titleOut = clamp01(t / TITLE_FADE);
  out.chrome = out.titleOut >= 1 && p < end.start + 0.002;
  return out;
}
