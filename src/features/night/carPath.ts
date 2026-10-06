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
  /**
   * How hard the designed drive brakes (-1) or pulls away (+1) here, from
   * the path itself, never from how the scroll moved: what the springs
   * show (carMotion.ts). 0 while cruising, at the line and up the road.
   */
  lean: number;
};

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Samples per profile table: a linear read between them is smooth to well under a millimetre. */
const TABLE = 512;

/**
 * A pedal profile on 0..1: the share `shape(s)` of full braking or full
 * throttle at s, integrated once for the speed and once for the distance.
 * Read back by linear interpolation; built once at load, deterministic.
 */
function profile(shape: (s: number) => number) {
  const speed = new Float64Array(TABLE + 1);
  const dist = new Float64Array(TABLE + 1);
  const h = 1 / TABLE;
  for (let i = 1; i <= TABLE; i += 1) speed[i] = speed[i - 1] + ((shape((i - 1) * h) + shape(i * h)) / 2) * h;
  for (let i = 1; i <= TABLE; i += 1) dist[i] = dist[i - 1] + ((speed[i - 1] + speed[i]) / 2) * h;
  const at = (s: number) => {
    const f = Math.min(1, Math.max(0, s)) * TABLE;
    const i = Math.min(TABLE - 1, Math.floor(f));
    return { i, k: f - i };
  };
  // The speed read linearly; the distance by cubic Hermite on it, so the speed it implies never jumps between samples.
  const speedAt = (s: number) => {
    const { i, k } = at(s);
    return speed[i] + (speed[i + 1] - speed[i]) * k;
  };
  const distAt = (s: number) => {
    const { i, k } = at(s);
    const k2 = k * k;
    const k3 = k2 * k;
    return (
      (2 * k3 - 3 * k2 + 1) * dist[i] + (k3 - 2 * k2 + k) * h * speed[i] + (-2 * k3 + 3 * k2) * dist[i + 1] + (k3 - k2) * h * speed[i + 1]
    );
  };
  return { shape, speed: speedAt, dist: distAt, total: speed[TABLE] };
}

function smoothstep(a: number, b: number, t: number): number {
  const c = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return c * c * (3 - 2 * c);
}

/**
 * How a driver brakes to a line: the pedal goes down over the first 30% of
 * the braking (no lurch as it starts), holds, and comes off over the last
 * 15%, so the car stops without a jolt and the body settles once.
 */
const BRAKE = profile((s) => smoothstep(0, 0.3, s) * (1 - smoothstep(0.85, 1, s)));

/** How it pulls away: the throttle opens over the first 30% of the leave, then holds (the dip has covered it by the end). */
const LAUNCH = profile((s) => smoothstep(0, 0.3, s));

/** The braking's speed (1 to 0) and the share of its distance covered, for s in 0..1. */
function braking(s: number) {
  const done = BRAKE.speed(s) / BRAKE.total;
  // The distance at constant speed would be s; the brake takes away the integral of what it has shed.
  return { speed: 1 - done, dist: s - BRAKE.dist(s) / BRAKE.total };
}

/** Share of a braking's distance it would cover at its entry speed: what the brake gives back. */
const BRAKE_SPAN = braking(1).dist;

/**
 * x of an arrival at u (0..1): cruises at a constant speed, then brakes
 * smoothly to stand still on the stop line, so the speed never jumps and
 * neither does the deceleration.
 */
export function arriveX(distance: number, brake: number, u: number): number {
  const t = clamp01(u);
  const b = Math.min(1, Math.max(1e-3, brake));
  const speed = distance / (1 - b + b * BRAKE_SPAN);
  const cruise = 1 - b;
  if (t < cruise) return -distance + speed * t;
  const s = (t - cruise) / b;
  // + 0: the stop line is 0, never -0.
  return Math.min(0, -distance + speed * cruise + speed * b * braking(s).dist) + 0;
}

/** The arrival's lean at u: 0 cruising, down to -1 under full braking, back to 0 at the line. */
export function arriveLean(brake: number, u: number): number {
  const t = clamp01(u);
  const b = Math.min(1, Math.max(1e-3, brake));
  const cruise = 1 - b;
  if (t <= cruise || t >= 1) return 0;
  return -BRAKE.shape((t - cruise) / b);
}

/** x of a leave at u (0..1): pulls away from rest, the throttle opening smoothly. */
export function leaveX(distance: number, u: number): number {
  const t = clamp01(u);
  return (distance * LAUNCH.dist(t)) / LAUNCH.dist(1);
}

/** The leave's lean at u: 0 at rest, up to +1 at full throttle. */
export function leaveLean(u: number): number {
  const t = clamp01(u);
  return t <= 0 ? 0 : LAUNCH.shape(t);
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
export function carAt(timeline: StageTimeline, p: number, out: CarState = { x: 0, brake: 1, stop: 0, lean: 0 }): CarState {
  const stop = stopAt(timeline, p);
  out.stop = stop;
  out.x = 0;
  out.brake = 1;
  out.lean = 0;
  for (const leg of carLegs(timeline)) {
    if (leg.stop !== stop) continue;
    const u = (p - leg.from) / Math.max(1e-9, leg.to - leg.from);
    if (leg.kind === "arrive") {
      if (u >= 1) continue;
      out.x = arriveX(leg.distance, leg.brake, u);
      out.lean = arriveLean(leg.brake, u);
      // The brake lights come on as it starts to brake, and stay on at the line.
      out.brake = clamp01(((clamp01(u) - (1 - leg.brake)) / Math.max(1e-6, leg.brake)) * 5);
      return out;
    }
    if (u <= 0) return out;
    out.x = leaveX(leg.distance, u);
    out.lean = leaveLean(u);
    // Off the brake as it pulls away.
    out.brake = clamp01(1 - u * 8);
    return out;
  }
  return out;
}
