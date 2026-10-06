/**
 * How the car at night moves on screen: like a car driven smoothly, never
 * like the scroll. The picture (the film position the page scroll gives,
 * Lenis-smoothed) arrives in steps: a wheel's notch, a swipe, a pause to
 * read. Read 1:1 (carPath.ts at the picture) every notch started and
 * stopped the car, and the springs, fed that speed, dived the nose and
 * squatted it on every one.
 *
 * Here the car chases the picture's place on its path instead, as a driver
 * would a moving mark: its pace (in natural seconds of the film per second,
 * 1 is the beat's own pace) eases toward the speed from which it can still
 * brake to the picture (`sqrt(2 * brake * gap)`), with bounded acceleration,
 * braking and jerk. The braking is planned, not merely chased: closing on a
 * mark it brakes as hard as that curve does (its slope, fed forward), so it
 * comes to rest on the mark instead of rolling past it and creeping back.
 * Repeated notches at a reading pace keep it rolling instead of stopping
 * and starting; when she stops it brakes onto the picture's mark and stands
 * still exactly there. Rolling over a stop line toward a mark beyond it, it
 * meets the line at little more than the beat's own pace: the designed
 * braking played at pace v is v^2 times as hard, and a fling or a jump
 * inside a stop slammed the car onto the line in a frame or two.
 *
 * Which way it goes is hers, its momentum its own. It starts backing up
 * only once the film has run back by more than a few pixels (a wall's
 * one-pixel trim under the pedal is not her turning back), and a car
 * already backing up when she turns forward again eases out of it onto its
 * mark: it never stops dead, and never parks ahead of the mark.
 *
 * It keeps real time on a slow device: a long frame is integrated in short
 * steps. A cut to the next stop (under the dip) is a cut on action: the car
 * comes in at the pace the picture and it shared, never more than the
 * beat's own, as far behind the picture as a car chasing it at that pace
 * runs, so a fling never carries its speed into the next shot. It plans on
 * a picture standing still until the new stop shows the picture's own pace
 * (the cut's jump, or the old stop's fling, is not it): planned on a mark
 * running away, it rolled past the picture where a fling ended and parked
 * there, metres ahead, for the whole pause. A jump (a capture, a deep
 * link, the frame loop waking) puts it on the picture.
 *
 * The camera frames the car's own moment of the drive (`framedAt`): the
 * keys describe the car's drive, so camera and car keep the shot together
 * however far the car trails a fling, on a phone's narrow frame too.
 *
 * The springs never read that motion. The body leans from the designed
 * drive (carPath's `lean`): a gentle dive where an arrival brakes to the
 * line, a gentle squat where a leave pulls away, and one settle once the
 * car stops on the line. It shows only while the car really drives forward
 * at a pace (a slow mean of its own pace, so the steps of her input never
 * reach it), and as hard as the car really brakes or pulls there: the
 * designed path met at pace v brakes v^2 times as hard, so the lean grows
 * with the pace like that and is full from the beat's own pace on. A crawl
 * leans next to nothing and a car standing still nothing at all; a pause, a
 * creeping thumb or the film running backwards lean nothing. Under reduced
 * motion the car stands on the picture and the body never leans.
 *
 * Pure and allocation-free per frame: CarNight steps it, the tests drive it
 * with recorded and modelled input.
 */
import type { StageTimeline } from "@/features/work/workTimeline";
import { carAt, carLegs, type CarState, stopAt } from "./carPath";

export const MOTION = {
  /** Planned braking onto the picture's mark (natural seconds per second, per second). */
  brake: 4,
  /** Most the pace may rise per second; more only while far behind (a fling, the pedal through open walls). */
  accel: 3,
  /** Most the pace may fall per second: headroom over `brake`, so the plan is always met. */
  decel: 6,
  /** Seconds the acceleration takes to answer the plan: the bound on the jerk. */
  respond: 0.06,
  /** How much harder it may brake while it still runs the way the film no longer goes (she turned). */
  turnBrake: 2,
  /** Below this pace (natural seconds per second) a car reaching the mark simply stands on it. */
  land: 0.1,
  /** A gap (natural seconds) past which the car may pick up and brake harder, in proportion: a fling, the pedal through open walls. */
  reach: 1.5,
  /** A gap (natural seconds) past which the car is snapped onto the picture: a jump, not a drive (a stop is some 13). */
  snapGap: 10,
  /**
   * The fastest pace at which it rolls over a stop line toward a mark beyond it: the designed braking, met at
   * pace v, is v^2 times as hard, so this bounds the stop's deceleration (about 2.5 times the design's) while
   * the car still keeps up with a fast push.
   */
  linePace: 1.6,
  /**
   * Film (natural seconds) she must take back before the car reads it as the film running backward. A pixel
   * of scroll is about 0.009 (13 screens a natural second): the gate's trim at a wall under the pedal is a
   * pixel or two, never her turning back.
   */
  backSlop: 0.04,
  /** The longest step (s) the car integrates at once: a slow device's long frame is cut into steps this long. */
  substep: 1 / 60,
  /** The longest frame (s) it integrates; CarNight snaps after a longer pause (the loop waking). */
  maxFrame: 0.25,
  /** Seconds the picture's own pace is smoothed over (what a cut on action carries, and how fast the mark runs). */
  pictureTau: 0.1,
  /** Most pace a cut carries into the next stop: the beat's own. */
  cutPace: 1,
  /** Seconds the mean of the pace the springs read takes to rise, and to fall: a pause of a breath changes nothing. */
  paceRise: 0.3,
  paceFall: 1.2,
  /** That mean's pace below which the body leans nothing, and above which it leans fully. */
  leanFrom: 0.3,
  leanFull: 0.8,
  /**
   * Its own pace below which the body leans nothing (a crawl), and from which the design shows in full (the beat's
   * own): in between it follows about the square of the pace, as the braking the car really does.
   */
  standFrom: 0.25,
  standFull: 1,
} as const;

/** The body on its springs (radians, nose up positive; the angular frequency of its damping, 1/s). */
export const SPRINGS = {
  /** Nose down under full braking. */
  dive: 0.02,
  /** Nose up under full throttle. */
  squat: 0.012,
  /** The settle once it stops on the line: nose up, then level, over `settleFor` seconds. */
  settle: 0.012,
  settleFor: 0.6,
  /** Critically damped: the body follows its lean without ever bouncing on its own. */
  omega: 7,
} as const;

export type CarMotion = {
  /** The car's film position, chasing the picture. NaN before the first step. */
  at: number;
  /** Its pace, natural seconds of the film per second (negative rolling back). */
  pace: number;
  /** The pace's rate of change. */
  accel: number;
  /** The slow mean of the forward pace the springs read. */
  meanPace: number;
  /** The body's pitch (rad, nose up positive) and its rate. */
  pitch: number;
  pitchRate: number;
  /** The picture last frame, and whether the film runs backward (she scrolls up): only then does the car start to reverse. */
  lastP: number;
  rewinding: boolean;
  /** Film (natural seconds) taken back since the picture last moved forward. */
  backBy: number;
  /** The picture's own pace, smoothed (natural seconds per second). */
  picturePace: number;
  /** Whether this step put the car on the picture at once (a jump, the first frame, reduced motion): the camera eases a jump in. */
  jumped: boolean;
  /** Seconds since it stopped on a line (Infinity when no settle plays), and that settle's size. */
  settleT: number;
  settleSize: number;
  /** What the car shows: its x, brake lights and stop (carPath at `at`), and the designed lean there. */
  car: CarState;
};

export function newCarMotion(): CarMotion {
  return {
    at: Number.NaN,
    pace: 0,
    accel: 0,
    meanPace: 0,
    lastP: Number.NaN,
    rewinding: false,
    backBy: 0,
    picturePace: 0,
    jumped: false,
    pitch: 0,
    pitchRate: 0,
    settleT: Number.POSITIVE_INFINITY,
    settleSize: 0,
    car: { x: 0, brake: 1, stop: 0, lean: 0 },
  };
}

export type CarStep = {
  /** Put the car on the picture now: a capture's or a deep link's jump. */
  snap?: boolean;
  /** Reduced motion: the car stands on the picture and never leans. */
  still?: boolean;
};

function smoothstep(a: number, b: number, t: number): number {
  const c = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return c * c * (3 - 2 * c);
}

/** How far (natural seconds) a car chasing a mark that runs at `pace` trails it: what the plan settles on. */
export function chaseLag(pace: number): number {
  const v = Math.abs(pace);
  return (v * v) / (2 * MOTION.brake) + v * MOTION.respond;
}

/** The pace whose chase lag is `lag` natural seconds (chaseLag's inverse). */
function paceForLag(lag: number): number {
  const b = MOTION.brake;
  const r = MOTION.respond;
  return Math.max(0, b * (Math.sqrt(r * r + (2 * Math.max(0, lag)) / b) - r));
}

/**
 * The film position the camera frames at a stop: the car's own while it is
 * in that stop (the keys describe the car's drive, and a tracking key aims
 * at the car as drawn), else the picture.
 */
export function framedAt(m: CarMotion, stop: number, p: number): number {
  return m.car.stop === stop && Number.isFinite(m.at) ? m.at : p;
}

/**
 * Steps the car `dt` seconds toward the picture `p` (film position, 0..1).
 * Writes into `m` and returns it.
 */
export function stepCarMotion(m: CarMotion, timeline: StageTimeline, p: number, dt: number, opts: CarStep = {}): CarMotion {
  const seconds = Math.max(1e-6, timeline.seconds);
  const frame = Math.min(Math.max(dt, 0), MOTION.maxFrame);
  const lastStop = m.car.stop;

  // Which way the film runs: backward only past a few pixels' slop, forward at once.
  if (Number.isFinite(m.lastP)) {
    const moved = (p - m.lastP) * seconds;
    if (moved > 1e-5) {
      m.backBy = 0;
      m.rewinding = false;
    } else if (moved < -1e-5) {
      m.backBy -= moved;
      if (m.backBy > MOTION.backSlop) m.rewinding = true;
    }
    // Within a stop only: the cut's jump from the edge the dip held the picture at into the next stop is no pace.
    if (frame > 0 && stopAt(timeline, m.lastP) === stopAt(timeline, p)) {
      m.picturePace += (moved / frame - m.picturePace) * (1 - Math.exp(-frame / MOTION.pictureTau));
    }
  }
  m.lastP = p;

  const stop = stopAt(timeline, p);
  const { stops } = timeline;
  const lo = stop === 0 ? 0 : stops[stop].from;
  const hi = stop + 1 < stops.length ? stops[stop + 1].from - 1e-9 : 1;
  const gap = (p - m.at) * seconds;
  m.jumped = !Number.isFinite(m.at) || Boolean(opts.snap || opts.still) || Math.abs(gap) > MOTION.snapGap;

  if (m.jumped) {
    // On the picture at once, at rest: the first frame, a jump, reduced motion.
    m.at = p;
    m.pace = 0;
    m.accel = 0;
    m.meanPace = 0;
    m.picturePace = 0;
  } else if (stopAt(timeline, m.at) !== stop) {
    // A cut on action, under the dip: the car comes in at the pace it and the picture shared (the beat's own at
    // most, and no more than the room behind the picture allows), as far behind the picture as a car chasing it
    // at that pace runs. What a fling built up chasing the picture through the leave never crosses the cut.
    const dir = gap >= 0 ? 1 : -1;
    const room = (dir > 0 ? p - lo : hi - p) * seconds;
    const pace = Math.min(Math.max(0, dir * m.pace), Math.max(0, dir * m.picturePace), MOTION.cutPace, paceForLag(room));
    m.at = Math.min(hi, Math.max(lo, p - (dir * chaseLag(pace)) / seconds));
    m.pace = dir * pace;
    m.accel = 0;
    m.meanPace = Math.min(m.meanPace, pace);
    // The new stop has not shown the picture's own pace yet: planned on a still picture, the car comes to rest on
    // it, never past it, and picks up again as the picture shows it moving on.
    m.picturePace = 0;
  }

  carAt(timeline, m.at, m.car);
  if (m.car.stop !== lastStop || opts.still) {
    m.pitch = 0;
    m.pitchRate = 0;
    m.settleT = Number.POSITIVE_INFINITY;
  }
  if (opts.still) return m;

  // A long frame in short steps, so the car keeps real time on a slow device.
  const steps = Math.max(1, Math.ceil(frame / MOTION.substep - 1e-9));
  const h = frame / steps;
  for (let i = 0; i < steps; i += 1) {
    chase(m, p, h, seconds, lo, hi, lineAhead(timeline, m.at, p));
    const lastX = m.car.x;
    carAt(timeline, m.at, m.car);
    springs(m, h, lastX);
  }
  return m;
}

/** The stop line (film position) between a car at `at` on its arrival and a mark `p` beyond it, or NaN. */
function lineAhead(timeline: StageTimeline, at: number, p: number): number {
  for (const leg of carLegs(timeline)) {
    if (leg.kind === "arrive" && at >= leg.from - 1e-9 && at < leg.to && p > leg.to) return leg.to;
  }
  return Number.NaN;
}

/** One step of the car toward the mark p, kept inside the stop on screen ([lo, hi]), over the stop line `line` if any. */
function chase(m: CarMotion, p: number, h: number, seconds: number, lo: number, hi: number, line: number): void {
  const gap = (p - m.at) * seconds;
  const backing = m.pace < 0;
  let need: number;
  if (gap >= 0 || m.rewinding || backing) {
    // Toward the mark: the pace from which a braking of MOTION.brake stops exactly on it, planned from where
    // the car will be once its acceleration has answered, and planned on how fast car and mark close: a mark
    // coming back toward the car (she turned) is met moving its way, not overrun at speed. A mark running away
    // is chased at the plan's own pace (never the mark's, or the car would overrun it wherever she stops).
    // Closing on it, the curve's own braking is fed forward (its slope along the car's way), so the car brakes
    // as the plan does instead of trailing it and rolling past the mark. A car backing up when she turns
    // forward again eases out of it onto its mark.
    const s = gap >= 0 ? 1 : -1;
    const v = s * m.pace;
    const toward = -s * m.picturePace;
    const closing = v + Math.max(0, toward);
    const ahead = Math.abs(gap) - Math.max(0, closing) * MOTION.respond;
    let want = Math.sqrt(2 * MOTION.brake * Math.max(0, ahead));
    // Toward a mark beyond its stop line, it plans to meet the line at MOTION.linePace at most.
    if (s > 0 && Number.isFinite(line)) {
      want = Math.min(want, Math.sqrt(MOTION.linePace * MOTION.linePace + 2 * MOTION.brake * Math.max(0, (line - m.at) * seconds)));
    }
    const rate = v + toward;
    const slope = rate > 0 ? (-MOTION.brake * rate) / Math.max(want, MOTION.brake * MOTION.respond) : 0;
    need = s * (slope + (want - closing) / (4 * MOTION.respond));
  } else {
    // Rolled a hair past a mark, driving forward, the film not running back: it only brakes to rest.
    need = -m.pace / (4 * MOTION.respond);
  }
  // Far behind (a fling through open walls), it may pick up and brake harder, so it never trails by more than a glide.
  const reach = Math.max(1, Math.abs(gap) / MOTION.reach);
  const up = MOTION.accel * reach;
  // Against her turn (the car still running the way the film has stopped going), it brakes harder still.
  const against = m.pace * m.picturePace < 0 ? MOTION.turnBrake : 1;
  const down = MOTION.decel * reach * against;
  const forward = m.pace >= 0;
  need = Math.min(forward ? up : down, Math.max(forward ? -down : -up, need));
  // Reached over MOTION.respond: the bound on the jerk.
  m.accel += (need - m.accel) * Math.min(1, h / MOTION.respond);
  m.pace += m.accel * h;
  const next = m.at + (m.pace * h) / seconds;
  const crossed = h > 0 && (m.at - p) * (next - p) <= 0;
  if (crossed && Math.abs(m.pace) < MOTION.land) {
    // Reaching the mark slowly, it lands on it and stands.
    m.at = p;
    m.pace = 0;
    m.accel = 0;
  } else if (gap < 0 && !m.rewinding && !backing && m.pace <= 0) {
    // Past the mark and braked to rest: it stands there until the picture comes on.
    m.pace = 0;
    m.accel = 0;
  } else m.at = Math.min(hi, Math.max(lo, next));
}

/** The springs: the designed lean, as much as the car drives forward at a pace and still moves. */
function springs(m: CarMotion, h: number, lastX: number): void {
  const forwardPace = Math.max(0, m.pace);
  m.meanPace += (forwardPace - m.meanPace) * (1 - Math.exp(-h / (forwardPace > m.meanPace ? MOTION.paceRise : MOTION.paceFall)));
  // A slow mean, so a pause of a breath leaves the body as it was; nothing while the film runs back.
  const drive = m.rewinding || m.pace < 0 ? 0 : smoothstep(MOTION.leanFrom, MOTION.leanFull, m.meanPace);
  // As hard as the car really brakes or pulls: about the square of its pace up to the beat's own, so a crawl leans
  // next to nothing and a car standing still nothing, whatever its mean.
  const moving = drive * smoothstep(MOTION.standFrom, MOTION.standFull, forwardPace);
  // Stopped on the line, having rolled into it at a pace: the body settles once (a car that crept the last
  // millimetres onto it has nothing to settle).
  if (lastX < 0 && m.car.x === 0 && moving > 0) {
    m.settleT = 0;
    m.settleSize = SPRINGS.settle * moving;
  }
  const lean = m.car.lean * moving;
  const target = (lean < 0 ? lean * SPRINGS.dive : lean * SPRINGS.squat) + settleLift(m);
  const w = SPRINGS.omega;
  m.pitchRate += (w * w * (target - m.pitch) - 2 * w * m.pitchRate) * h;
  m.pitch += m.pitchRate * h;
  m.settleT += h;
}

/** The settle's nose-up, which the springs follow: one swell, from level to level. */
export function settleLift(m: CarMotion): number {
  if (!(m.settleT < SPRINGS.settleFor)) return 0;
  const s = Math.sin((Math.PI * m.settleT) / SPRINGS.settleFor);
  return m.settleSize * s * s;
}
