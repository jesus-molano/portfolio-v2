/**
 * The car at night moves only in the arrival and leave beats, and only with
 * the scroll: its x is a pure function of the picture, so a backward scrub
 * rolls it back like film. Everywhere else it waits at its stop line, the
 * origin of the stop's set, with the brake lights on.
 */

import { beatIndexAt, beatT, type StageTimeline } from "@/features/work/workTimeline";

/** Metres the car rolls in from on the first stop, and out to on every leave. */
export const CAR_PATH = { arriveFrom: -30, leaveTo: 8 } as const;

export type CarBeat = { kind: "arrive" | "leave" | "wait"; t: number };

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** The car's x along the street (+x is the direction of travel), metres. */
export function carX(beat: CarBeat): number {
  const t = clamp01(beat.t);
  if (beat.kind === "arrive") {
    // Brakes into the stop: easeOutQuad, so the speed falls linearly to zero.
    const left = 1 - t;
    // + 0: the stop line is 0, never -0.
    return CAR_PATH.arriveFrom * left * left + 0;
  }
  if (beat.kind === "leave") return CAR_PATH.leaveTo * t * t;
  return 0;
}

/** True while the car stands at its stop line: the brake lights are on. */
export function braking(beat: CarBeat): boolean {
  return beat.kind === "wait" || (beat.kind === "arrive" && beat.t > 0.55);
}

/** Where the car is in its beat: rolling in on the first stop, leaving, or waiting at the line. */
export function carBeat(timeline: StageTimeline, p: number): CarBeat {
  const beat = timeline.beats[beatIndexAt(timeline, p)];
  if (beat.id === "fadeIn" || beat.id === "army.arrive") {
    const from = timeline.beats.find((b) => b.id === "fadeIn")?.start ?? beat.start;
    const to = timeline.beats.find((b) => b.id === "army.arrive")?.end ?? beat.end;
    return { kind: "arrive", t: (p - from) / Math.max(1e-6, to - from) };
  }
  if (beat.id === "title") return { kind: "arrive", t: 0 };
  if (beat.id.endsWith(".leave")) return { kind: "leave", t: beatT(beat, p) };
  return { kind: "wait", t: 0 };
}
