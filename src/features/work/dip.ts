/**
 * The cut between two stops is a dip to night, never a hard cut: the
 * picture fades to the night over the end of a stop's leave (the car
 * pulling away out of the shot) and up again over the start of the next
 * stop's arrival (the car rolling in). The set, the lights and the camera
 * change at the bottom of the dip, where nothing shows, so no frame ever
 * pops; and the car's motion carries across it, a cut on action.
 */
import type { StageTimeline } from "./workTimeline";

/** Shares of the leave and the arrival the dip takes. */
export const DIP = { out: 0.42, in: 0.3 } as const;

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

type Cut = { at: number; out: number; in: number };

const cutsOf = new WeakMap<StageTimeline, Cut[]>();

/** Where each cut between two stops sits on the film, and how long its fades are. */
export function stageCuts(timeline: StageTimeline): Cut[] {
  const cached = cutsOf.get(timeline);
  if (cached) return cached;
  const cuts: Cut[] = [];
  for (let s = 1; s < timeline.stops.length; s += 1) {
    const at = timeline.stops[s].from;
    const before = timeline.beats.filter((b) => b.stop === s - 1).at(-1);
    const after = timeline.beats.find((b) => b.stop === s);
    if (!before || !after) continue;
    cuts.push({ at, out: (before.end - before.start) * DIP.out, in: (after.end - after.start) * DIP.in });
  }
  cutsOf.set(timeline, cuts);
  return cuts;
}

/** How far the picture has dipped to night at film position p: 0 (none) to 1 (night, at a cut). */
export function dipAt(timeline: StageTimeline, p: number): number {
  for (const cut of stageCuts(timeline)) {
    if (p < cut.at - cut.out || p > cut.at + cut.in) continue;
    return p < cut.at ? smooth((p - (cut.at - cut.out)) / cut.out) : 1 - smooth((p - cut.at) / cut.in);
  }
  return 0;
}

/**
 * The fastest the dip may play on screen (s): a whole fade from picture to
 * night, and from night back to picture. With the walls open (a second
 * pass) a cut's fades are some 150 px of scroll, one flick, so read
 * straight off the film the set changed in a blink.
 */
export const DIP_MIN = { out: 0.3, in: 0.35 } as const;

/**
 * What the scene shows: its stop and its picture, and the dip drawn over
 * it. They follow the film, except across a cut: the scene keeps the old
 * stop (its picture held at that stop's edge) until the dip on screen has
 * reached night, so the set never changes in sight, and the dip never
 * plays faster than DIP_MIN either way.
 */
export type DipView = { stop: number; p: number; dip: number };

export function newDipView(): DipView {
  return { stop: -1, p: 0, dip: 0 };
}

/** Night enough on screen to change the set under it. */
const CUT_AT = 0.985;

/**
 * Steps the view to film position `p` (whose stop is `stop`) over `dt`
 * seconds; `dt` 0 (a jump, a capture, the first frame) lands at once.
 */
export function stepDipView(view: DipView, timeline: StageTimeline, p: number, stop: number, dt: number): DipView {
  if (view.stop < 0 || dt <= 0) {
    view.stop = stop;
    view.p = p;
    view.dip = dipAt(timeline, p);
    return view;
  }
  const crossing = stop !== view.stop;
  const target = crossing ? 1 : dipAt(timeline, p);
  const step = target > view.dip ? Math.min(target - view.dip, dt / DIP_MIN.out) : Math.max(target - view.dip, -dt / DIP_MIN.in);
  view.dip = Math.min(1, Math.max(0, view.dip + step));
  if (crossing && view.dip >= CUT_AT) view.stop = stop;
  if (view.stop === stop) {
    view.p = p;
  } else {
    // Held at the edge of the stop still on screen, the way the film left it.
    const range = timeline.stops[view.stop];
    const from = view.stop === 0 ? 0 : range.from;
    view.p = Math.min(range.to - 1e-6, Math.max(from, p));
  }
  return view;
}
