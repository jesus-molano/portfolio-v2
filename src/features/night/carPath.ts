/**
 * The car at night drives with the scroll: its x along the street is one
 * continuous function of the picture inside every stop, so a backward
 * scrub rolls it back like film and no frame ever shows it jump. At every
 * stop it rolls in (cruising, then braking to the stop line, the origin of
 * the stop's set), waits there with the brake lights on, and pulls away in
 * the stop's leave beat. The only discontinuity is between two stops, at
 * the cut, which the picture's dip to night hides (work/dip.ts).
 *
 * On the first stop the car rolls in under the bridge line, while the night
 * fades in over the chapter card, and brakes in `army.arrive`; on the others
 * the whole `<stop>.open` beat is its arrival.
 */

import type { StageTimeline } from "@/features/work/workTimeline";

/** Headlight colour: warm halogen, the same in the lamps' glow, their beams and their fans on the road. */
export const HEADLIGHT = "#ffd9a8";

export const CAR_PATH = {
  /** Metres the car rolls in from on the first stop (it has the bridge line's time). */
  firstFrom: -48,
  /** Metres it rolls in from at every other stop. */
  arriveFrom: -34,
  /** Share of an arrival spent braking (the rest cruises in). */
  brake: 0.6,
  /** Metres it has pulled away by the end of a leave (the dip has covered it by then). */
  leaveTo: 18,
} as const;

/** One stretch of driving on the film: an arrival brakes to x = 0, a leave pulls away from it. */
export type Leg = {
  kind: "arrive" | "leave";
  stop: number;
  /** Film positions where the leg starts and ends. */
  from: number;
  to: number;
  /** Metres covered. */
  distance: number;
  /** Share of an arrival spent braking. */
  brake: number;
};

export type CarState = {
  /** x along the street (+x is the direction of travel), metres. */
  x: number;
  /** Brake lights, 0..1. */
  brake: number;
  /** The stop whose set the car is in. */
  stop: number;
};

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * x of an arrival at u (0..1): cruises at a constant speed, then brakes at a
 * constant rate to stand still on the stop line, so the speed never jumps.
 */
export function arriveX(distance: number, brake: number, u: number): number {
  const t = clamp01(u);
  const b = Math.min(1, Math.max(1e-3, brake));
  const speed = distance / (1 - b / 2);
  const cruise = 1 - b;
  if (t < cruise) return -distance + speed * t;
  const s = (t - cruise) / b;
  const left = 1 - s;
  // + 0: the stop line is 0, never -0.
  return -(speed * b * 0.5) * left * left + 0;
}

/** x of a leave at u (0..1): pulls away from rest at a constant acceleration. */
export function leaveX(distance: number, u: number): number {
  const t = clamp01(u);
  return distance * t * t;
}

const legsOf = new WeakMap<StageTimeline, Leg[]>();

/** Every leg of the drive, in film order (cached per timeline). */
export function carLegs(timeline: StageTimeline): Leg[] {
  const cached = legsOf.get(timeline);
  if (cached) return cached;
  const legs: Leg[] = [];
  const bridge = timeline.beats.find((b) => b.id === "bridge");
  for (let s = 0; s < timeline.stops.length; s += 1) {
    const own = timeline.beats.filter((b) => b.stop === s);
    if (own.length === 0) continue;
    if (s === 0) {
      // Rolls in under the bridge line (the night fading in), brakes in the arrival.
      const arrive = own.find((b) => b.id.endsWith(".arrive")) ?? own[0];
      const from = bridge?.start ?? arrive.start;
      legs.push({
        kind: "arrive",
        stop: s,
        from,
        to: arrive.end,
        distance: -CAR_PATH.firstFrom,
        brake: Math.min(1, (arrive.end - arrive.start) / Math.max(1e-6, arrive.end - from)),
      });
    } else {
      const open = own.find((b) => b.id.endsWith(".open")) ?? own[0];
      legs.push({ kind: "arrive", stop: s, from: open.start, to: open.end, distance: -CAR_PATH.arriveFrom, brake: CAR_PATH.brake });
    }
    const leave = own.find((b) => b.id.endsWith(".leave"));
    if (leave) legs.push({ kind: "leave", stop: s, from: leave.start, to: leave.end, distance: CAR_PATH.leaveTo, brake: 0 });
  }
  legsOf.set(timeline, legs);
  return legs;
}

/** The stop on screen at film position p (the title and the bridge belong to the first). */
export function stopAt(timeline: StageTimeline, p: number): number {
  const { stops } = timeline;
  for (let s = stops.length - 1; s > 0; s -= 1) if (p >= stops[s].from) return s;
  return 0;
}

/** Where the car is at film position p, and how hard it brakes. Writes into `out` (no allocation per frame). */
export function carAt(timeline: StageTimeline, p: number, out: CarState = { x: 0, brake: 1, stop: 0 }): CarState {
  const stop = stopAt(timeline, p);
  out.stop = stop;
  out.x = 0;
  out.brake = 1;
  for (const leg of carLegs(timeline)) {
    if (leg.stop !== stop) continue;
    const u = (p - leg.from) / Math.max(1e-9, leg.to - leg.from);
    if (leg.kind === "arrive") {
      if (u >= 1) continue;
      out.x = arriveX(leg.distance, leg.brake, u);
      // The brake lights come on as it starts to brake, and stay on at the line.
      out.brake = clamp01(((clamp01(u) - (1 - leg.brake)) / Math.max(1e-6, leg.brake)) * 5);
      return out;
    }
    if (u <= 0) return out;
    out.x = leaveX(leg.distance, u);
    // Off the brake as it pulls away.
    out.brake = clamp01(1 - u * 8);
    return out;
  }
  return out;
}
