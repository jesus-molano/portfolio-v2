import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { workTimeline, type StageTimeline } from "@/features/work/workTimeline";
import { CAR_PATH, carAt, carLegs } from "./carPath";
import { type CarMotion, chaseLag, MOTION, newCarMotion, SPRINGS, stepCarMotion } from "./carMotion";

const FPS = 60;
const DT = 1 / FPS;
/** Lenis' smoothing of a wheel's notch, as a time constant (lerp 0.1 a frame at 60 fps). */
const LENIS_TAU = 0.16;

type Frame = { t: number; p: number; x: number; xp: number; pitch: number; stop: number; at: number; pace: number };

/**
 * Drives the car with a modelled scroll: `target(t)` is where her input has
 * sent the page (film position); the picture follows it as Lenis does, and
 * the car follows the picture. Returns every frame.
 */
function drive(
  timeline: StageTimeline,
  from: number,
  seconds: number,
  target: (t: number, p: number) => number,
  opts: { still?: boolean; smooth?: boolean } = {},
): Frame[] {
  const m = newCarMotion();
  let p = from;
  const frames: Frame[] = [];
  for (let i = 0; i <= seconds * FPS; i += 1) {
    const t = i * DT;
    const want = target(t, p);
    p = opts.smooth === false ? want : p + (want - p) * (1 - Math.exp(-DT / LENIS_TAU));
    stepCarMotion(m, timeline, p, DT, { still: opts.still });
    frames.push({ t, p, x: m.car.x, xp: carAt(timeline, p).x, pitch: m.pitch, stop: m.car.stop, at: m.at, pace: m.pace });
  }
  return frames;
}

/** The car stepped at `fps` frames a second through a picture given straight as `picture(t)` (no smoothing). */
function play(timeline: StageTimeline, fps: number, seconds: number, picture: (t: number) => number): Frame[] {
  const m = newCarMotion();
  const frames: Frame[] = [];
  for (let i = 0; i <= seconds * fps; i += 1) {
    const t = i / fps;
    const p = picture(t);
    stepCarMotion(m, timeline, p, 1 / fps);
    frames.push({ t, p, x: m.car.x, xp: carAt(timeline, p).x, pitch: m.pitch, stop: m.car.stop, at: m.at, pace: m.pace });
  }
  return frames;
}

/** The car's speed (m/s) from each frame to the next, inside a stop (NaN across a cut). */
function speeds(frames: Frame[]): number[] {
  return frames.slice(1).map((f, i) => (f.stop === frames[i].stop ? (f.x - frames[i].x) / (f.t - frames[i].t) : Number.NaN));
}

/** One degree of pitch, in radians. */
const DEG = Math.PI / 180;

/** Speeds, accelerations and jerks of the car's x, frame by frame, inside a stop. */
function kinematics(frames: Frame[]) {
  const v: number[] = [];
  const a: number[] = [];
  const j: number[] = [];
  for (let i = 1; i < frames.length; i += 1) {
    if (frames[i].stop !== frames[i - 1].stop) continue;
    v.push((frames[i].x - frames[i - 1].x) / DT);
  }
  for (let i = 1; i < v.length; i += 1) a.push((v[i] - v[i - 1]) / DT);
  for (let i = 1; i < a.length; i += 1) j.push((a[i] - a[i - 1]) / DT);
  const peak = (list: number[]) => Math.max(0, ...list.map(Math.abs));
  return { v, peakAccel: peak(a), peakJerk: peak(j), backward: v.filter((s) => s < -1e-6).length };
}

/** Times the pitch turns back by more than 0.06 degrees: one per dive, squat or settle the drive designs. */
function pitchTurns(frames: Frame[]): number {
  let turns = 0;
  let dir = 0;
  let ext = frames[0]?.pitch ?? 0;
  for (const { pitch } of frames) {
    if (dir >= 0 && pitch < ext - 0.001) {
      if (dir > 0) turns += 1;
      dir = -1;
      ext = pitch;
    } else if (dir <= 0 && pitch > ext + 0.001) {
      if (dir < 0) turns += 1;
      dir = 1;
      ext = pitch;
    } else if ((dir > 0 && pitch > ext) || (dir < 0 && pitch < ext)) ext = pitch;
  }
  return turns;
}

/** The 1:1 car the city had: x read straight from the picture. */
function oneToOne(timeline: StageTimeline, frames: Frame[]): Frame[] {
  return frames.map((f) => ({ ...f, x: carAt(timeline, f.p).x }));
}

/** Notches of `step` natural seconds every `every` seconds, from `from`, `count` of them. */
function notches(timeline: StageTimeline, from: number, step: number, every: number, count: number) {
  return (t: number) => from + (Math.min(count, Math.floor(t / every) + 1) * step) / timeline.seconds;
}

for (const [name, dict] of [
  ["en", en],
  ["es", es],
] as const) {
  const timeline = workTimeline(dict.work);
  const legs = carLegs(timeline);
  const arrival = legs.find((leg) => leg.kind === "arrive" && leg.stop === 1)!;
  const leave = legs.find((leg) => leg.kind === "leave" && leg.stop === 1)!;
  const secondsOf = (leg: { from: number; to: number }) => (leg.to - leg.from) * timeline.seconds;

  describe(`the car at night drives like a car (${name})`, () => {
    it("rolls into a stop on wheel notches at a reading pace without lurching, and stands on the line", () => {
      // A notch is about one natural second of film (13% of a screen); one every 0.7 s.
      const count = Math.ceil(secondsOf(arrival)) + 2;
      const frames = drive(timeline, arrival.from, count * 0.7 + 3, notches(timeline, arrival.from, 0.85, 0.7, count));
      const ours = kinematics(frames);
      const before = kinematics(oneToOne(timeline, frames));
      // Read 1:1 every notch was a lurch; chased, the acceleration and jerk stay a car's.
      expect(before.peakAccel).toBeGreaterThan(ours.peakAccel * 3);
      expect(ours.peakAccel).toBeLessThan(100);
      expect(ours.peakJerk).toBeLessThan(3000);
      expect(ours.backward).toBe(0);
      // It keeps rolling between notches: it never stands still in the middle of the arrival.
      const rolling = frames.filter((f) => f.x > CAR_PATH.arriveFrom + 1 && f.x < -1);
      for (let i = 1; i < rolling.length; i += 1) expect(rolling[i].x).toBeGreaterThan(rolling[i - 1].x);
      // On the line within a second of the picture.
      const pictureAt = frames.findIndex((f) => f.xp === 0);
      const carAtLine = frames.findIndex((f) => f.x === 0);
      expect(pictureAt).toBeGreaterThan(0);
      expect((carAtLine - pictureAt) * DT).toBeLessThan(1);
      expect(frames.at(-1)!.x).toBe(0);
      // Never past the line, never more than a hair past the picture.
      for (const f of frames) {
        expect(f.x).toBeLessThanOrEqual(0);
        expect(f.x).toBeLessThanOrEqual(f.xp + 0.05);
      }
    });

    it("leans only as the drive is designed: one dive to the line and one settle, never a bounce per notch", () => {
      const count = Math.ceil(secondsOf(arrival)) + 2;
      const frames = drive(timeline, arrival.from, count * 0.7 + 3, notches(timeline, arrival.from, 0.85, 0.7, count));
      // The dive (down then up) and the settle (up then down): two turns, however many notches.
      expect(pitchTurns(frames)).toBeLessThanOrEqual(2);
      const lowest = Math.min(...frames.map((f) => f.pitch));
      const highest = Math.max(...frames.map((f) => f.pitch));
      expect(lowest).toBeLessThan(-SPRINGS.dive * 0.5);
      expect(lowest).toBeGreaterThanOrEqual(-SPRINGS.dive - 1e-4);
      expect(highest).toBeLessThanOrEqual(SPRINGS.settle + 1e-4);
      // Nothing while it cruises in: the springs read the path, not the steps of the scroll.
      const cruising = frames.filter((f) => carAt(timeline, f.p).lean === 0 && f.x < CAR_PATH.arriveFrom * 0.5);
      for (const f of cruising) expect(Math.abs(f.pitch)).toBeLessThan(1e-4);
      // And level again once it has settled.
      expect(Math.abs(frames.at(-1)!.pitch)).toBeLessThan(2e-4);
    });

    it("takes a fling through the arrival as one glide, with no more lean than the design", () => {
      // A trackpad's fling: the page thrown the whole arrival in a third of a second.
      const end = arrival.to + 0.2 / timeline.seconds;
      const frames = drive(timeline, arrival.from, 5, (t) => (t < 0.3 ? arrival.from + ((end - arrival.from) * t) / 0.3 : end));
      const ours = kinematics(frames);
      expect(ours.backward).toBe(0);
      expect(ours.peakJerk).toBeLessThan(6000);
      expect(pitchTurns(frames)).toBeLessThanOrEqual(2);
      expect(frames.at(-1)!.x).toBe(0);
    });

    it("pulls away from the line with a squat, under the pedal's steady push", () => {
      // The pedal held: the picture runs at the beat's own pace (the wall's).
      const frames = drive(timeline, leave.from, secondsOf(leave) * 0.55, (t) => leave.from + t / timeline.seconds, { smooth: false });
      const ours = kinematics(frames);
      expect(ours.backward).toBe(0);
      expect(frames.at(-1)!.x).toBeGreaterThan(1);
      const highest = Math.max(...frames.map((f) => f.pitch));
      expect(highest).toBeGreaterThan(SPRINGS.squat * 0.4);
      expect(highest).toBeLessThanOrEqual(SPRINGS.squat + 1e-4);
      expect(Math.min(...frames.map((f) => f.pitch))).toBeGreaterThanOrEqual(-1e-4);
      expect(pitchTurns(frames)).toBe(0);
    });

    it("leans nothing for a thumb resting on the glass, mid-braking", () => {
      const mid = arrival.from + (arrival.to - arrival.from) * 0.75;
      // A thumb's tremble: a pixel or two either way, about 0.01 natural seconds.
      const frames = drive(timeline, mid, 3, (t) => mid + (Math.sin(t * 9) * 0.012) / timeline.seconds, { smooth: false });
      for (const f of frames) expect(Math.abs(f.pitch)).toBeLessThan(1e-4);
    });

    it("leans nothing for a pause, and brings nothing back from it", () => {
      const mid = arrival.from + (arrival.to - arrival.from) * 0.8;
      // Notches into the braking, then she stops to read for three seconds.
      const frames = drive(timeline, arrival.from, 8, (t) => (t < 2 ? arrival.from + ((mid - arrival.from) * Math.min(1, t / 1.6)) : mid));
      const paused = frames.filter((f) => f.t > 6);
      for (const f of paused) expect(Math.abs(f.pitch)).toBeLessThan(2e-3);
      // One dive, eased back as the car came to rest: no rebound from the pause.
      expect(pitchTurns(frames)).toBeLessThanOrEqual(1);
    });

    it("rolls back with the film when she scrolls up, and leans nothing doing it", () => {
      const line = arrival.to + 0.5 / timeline.seconds;
      const frames = drive(timeline, line, 4, (t) => line - (Math.min(t, 1.5) / 1.5) * (line - arrival.from - 0.3 / timeline.seconds));
      for (const f of frames) expect(Math.abs(f.pitch)).toBeLessThan(1e-4);
      expect(frames.at(-1)!.x).toBeLessThan(-20);
      // Backward only, never forward again on the way.
      const k = kinematics(frames);
      expect(k.v.filter((s) => s > 1e-6)).toHaveLength(0);
    });

    it("cuts on action under the dip: the arrival's pace at most, never ahead of the picture", () => {
      const from = leave.from + (leave.to - leave.from) * 0.5;
      const next = timeline.stops[2].from + 0.3 / timeline.seconds;
      const frames = drive(timeline, from, 3, (t) => from + (next - from) * Math.min(1, t / 1.2));
      const cut = frames.findIndex((f) => f.stop === 2);
      expect(cut).toBeGreaterThan(0);
      // In the new stop, a chase's lag behind the picture at most, never ahead of it, and no lean carried over.
      expect(frames[cut].at).toBeLessThanOrEqual(frames[cut].p);
      expect((frames[cut].p - frames[cut].at) * timeline.seconds).toBeLessThanOrEqual(chaseLag(MOTION.cutPace) + 1e-9);
      expect(frames[cut].pace).toBeGreaterThan(0);
      expect(frames[cut].pace).toBeLessThanOrEqual(MOTION.cutPace);
      expect(frames[cut].pitch).toBe(0);
      expect(frames.at(-1)!.x).toBe(frames.at(-1)!.xp);
    });

    it("takes a fling into the next stop at no more than the arrival's own pace, and stops on the picture's mark", () => {
      // A phone's fling from the stop's last line across the leave and the cut, stopping just into the next arrival:
      // the car, chasing the picture through the leave, had built up three times the drive's pace.
      const next = legs.find((leg) => leg.kind === "arrive" && leg.stop === 2)!;
      const from = leave.from - 8 / timeline.seconds;
      const to = next.from + 0.5 / timeline.seconds;
      // Thrown, then slowing as a fling does (Lenis' momentum), to rest 1.2 s on.
      const fling = (t: number) => (1 - Math.exp(-Math.min(t, 1.2) / 0.35)) / (1 - Math.exp(-1.2 / 0.35));
      const frames = play(timeline, 60, 4, (t) => from + (to - from) * fling(t));
      const cut = frames.findIndex((f) => f.stop === 2);
      expect(cut).toBeGreaterThan(0);
      const before = frames.slice(0, cut).map((f) => f.pace);
      expect(Math.max(...before)).toBeGreaterThan(2);
      // The arrival's cruising speed on screen, the picture played at its own pace.
      const cruise = carAt(timeline, next.from + 0.1 / timeline.seconds).x - carAt(timeline, next.from).x;
      const after = frames.slice(cut);
      const v = speeds(after).filter(Number.isFinite);
      // It comes in at the drive's own speed, and chases the fling's tail at little more.
      expect(Math.max(...v.slice(0, 6))).toBeLessThanOrEqual((cruise / 0.1) * 1.05);
      expect(Math.max(...v)).toBeLessThanOrEqual((cruise / 0.1) * 1.25);
      for (const f of after) expect(f.x).toBeLessThanOrEqual(f.xp + 1e-6);
      expect(after.at(-1)!.x).toBe(after.at(-1)!.xp);
    });

    it("eases out of a reversal mid-beat onto its mark: never a dead stop, never parked past the line", () => {
      // She drives on into the leave, flings back to before the line, and as the car rolls back at speed she turns
      // forward again to the line's last line, and stops there.
      const S = timeline.seconds;
      const start = leave.from - 0.5 / S;
      const into = leave.from + (leave.to - leave.from) * 0.9;
      const back = leave.from - 0.6 / S;
      const rest = leave.from - 0.1 / S;
      const t1 = (into - start) * S;
      const frames = play(timeline, 60, t1 + 4, (t) => {
        if (t < t1) return start + t / S;
        if (t < t1 + 0.3) return into + (back - into) * ((t - t1) / 0.3);
        if (t < t1 + 0.5) return back + (rest - back) * ((t - t1 - 0.3) / 0.2);
        return rest;
      });
      const v = speeds(frames);
      // It was rolling back fast when she turned.
      expect(Math.min(...v.filter(Number.isFinite))).toBeLessThan(-5);
      for (let i = 1; i < v.length; i += 1) {
        if (!Number.isFinite(v[i]) || !Number.isFinite(v[i - 1])) continue;
        // Never from a drive to a standstill in one frame, and no step in its speed a car could not make.
        expect(Math.abs(v[i - 1]) > 3 && Math.abs(v[i]) < 0.3).toBe(false);
        expect(Math.abs(v[i] - v[i - 1])).toBeLessThan(4);
      }
      // On its line within 1.5 s of the picture coming to rest there, and never past it from then on.
      for (const f of frames.filter((q) => q.t > t1 + 2)) expect(f.x).toBeLessThanOrEqual(0);
      expect(frames.at(-1)!.x).toBe(0);
      expect(frames.at(-1)!.at).toBe(frames.at(-1)!.p);
    });

    it("leans as hard as it really brakes: a crawl through the braking leans next to nothing, a stop mid-way nothing", () => {
      // The pedal through the cruise, then a slow drip of input through the braking (a third of the beat's pace),
      // then she stops to read mid-way: the car crawls, then stands, off the line.
      const S = timeline.seconds;
      const braking = arrival.from + (arrival.to - arrival.from) * (1 - arrival.brake);
      const crawlTo = braking + (arrival.to - braking) * 0.7;
      const t1 = (braking - arrival.from) * S;
      const t2 = t1 + (crawlTo - braking) * S / 0.3;
      const frames = play(timeline, 60, t2 + 3, (t) => (t < t1 ? arrival.from + t / S : Math.min(crawlTo, braking + (0.3 * (t - t1)) / S)));
      // Crawling (its pace under 0.35 for 0.4 s) the nose dips under a quarter of a degree.
      let since = 0;
      let crawled = 0;
      for (const f of frames) {
        since = f.pace < 0.35 ? since + 1 / 60 : 0;
        if (since > 0.4 && f.x < -0.05) {
          expect(Math.abs(f.pitch)).toBeLessThan(0.25 * DEG);
          crawled += 1;
        }
      }
      expect(crawled).toBeGreaterThan(30);
      // Standing off the line, nothing from the first frames of its rest on.
      const v = speeds(frames);
      let standing = 0;
      for (let i = 1; i < frames.length; i += 1) {
        standing = Math.abs(v[i - 1]) < 0.05 ? standing + 1 / 60 : 0;
        if (standing > 0.1) expect(Math.abs(frames[i].pitch)).toBeLessThan(0.1 * DEG);
      }
      expect(frames.at(-1)!.x).toBeLessThan(-0.5);
    });

    it("meets the line from a jump inside the stop no harder than a quick arrival: never slammed onto it", () => {
      // The picture jumps in one frame from the arrival's start to its stop (a scrollbar's drag, find in page with
      // the walls open), 9.5 natural seconds: not far enough for a snap, so the car drives there. At pace v the
      // designed braking is v^2 times as hard: met at the speed the car had built up, it stopped in two frames.
      const S = timeline.seconds;
      const hold = leave.from - 0.5 / S;
      const target = Math.min(hold, arrival.from + 9.5 / S);
      const frames = play(timeline, 60, 4, (t) => (t < 0.5 ? arrival.from + 1e-4 : target));
      const v = speeds(frames);
      let brake = 0;
      for (let i = 1; i < v.length; i += 1) if (v[i - 1] > 0.5 && frames[i].x < 0) brake = Math.max(brake, (v[i - 1] - v[i]) * 60);
      expect(brake).toBeLessThan(300);
      // It reaches the line, and leans no more than the design does.
      expect(frames.at(-1)!.x).toBe(0);
      expect(Math.min(...frames.map((f) => f.pitch))).toBeGreaterThanOrEqual(-SPRINGS.dive - 1e-4);
    });

    it("settles onto the picture after a phone's fling across the cut, at any frame rate: never parked ahead of it", () => {
      // A phone's fling from the stop's last line through the leave; the dip holds the picture at the stop's edge
      // a moment, then it lands a natural second into the next arrival and creeps on as the fling's tail dies.
      const S = timeline.seconds;
      const next = legs.find((leg) => leg.kind === "arrive" && leg.stop === 2)!;
      const from = leave.from - 4 / S;
      const edge = next.from - 1e-7;
      const land = next.from + 1.06 / S;
      const rest = next.from + 1.12 / S;
      const picture = (t: number) => {
        if (t < 0.35) return from + (edge - from) * (t / 0.35);
        if (t < 0.7) return edge;
        return land + (rest - land) * (1 - Math.exp(-(t - 0.7) / 0.12));
      };
      for (const fps of [60, 10, 6]) {
        const frames = play(timeline, fps, 4, picture);
        const after = frames.filter((f) => f.t > 2);
        expect(after.length).toBeGreaterThan(5);
        for (const f of after) {
          expect(f.stop).toBe(2);
          expect(Math.abs(f.x - f.xp)).toBeLessThan(0.01);
        }
        // Never ahead of the picture on its way in either.
        for (const f of frames.filter((q) => q.stop === 2)) expect(f.x).toBeLessThanOrEqual(f.xp + 0.05);
      }
    });

    it("leans nothing while it stands still, even between notches through the braking", () => {
      // Notches of 0.5 natural seconds every 2.2 s: the car brakes onto each and stands, mid-braking, until the next.
      const frames = drive(timeline, arrival.from, 2.2 * 6 + 2, notches(timeline, arrival.from, 0.5, 2.2, 6));
      const v = speeds(frames);
      let standing = 0;
      let checked = 0;
      for (let i = 1; i < frames.length; i += 1) {
        const f = frames[i];
        standing = Math.abs(v[i - 1]) < 0.05 && f.x < -0.05 ? standing + DT : 0;
        if (standing > 0.4) {
          expect(Math.abs(f.pitch)).toBeLessThan(0.1 * DEG);
          checked += 1;
        }
      }
      // It did stand mid-braking, more than once.
      expect(checked).toBeGreaterThan(60);
    });

    it("holds its mark under the pedal's one-pixel trims at a wall: never backs up", () => {
      // The pedal held into the braking to a wall at 85% of the arrival; every fifth frame the gate trims the
      // scroll back by a pixel (13 screens a natural second: under 0.01 natural seconds).
      const S = timeline.seconds;
      const wall = arrival.from + (arrival.to - arrival.from) * 0.85;
      const pixel = 0.009 / S;
      const frames = play(timeline, 60, 4, (t) => {
        const ahead = Math.min(wall, arrival.from + (arrival.to - arrival.from) * 0.6 + t / S);
        return Math.round(t * 60) % 5 === 4 ? ahead - pixel : ahead;
      });
      const wallX = carAt(timeline, wall).x;
      for (let i = 1; i < frames.length; i += 1) expect(frames[i].x).toBeGreaterThanOrEqual(frames[i - 1].x);
      for (const f of frames) expect(f.x).toBeLessThanOrEqual(wallX + 1e-3);
      expect(frames.at(-1)!.x).toBeCloseTo(wallX, 3);
    });

    it("keeps real time on a slow device: down to 4 frames a second it reaches the line with the picture", () => {
      // The arrival at its own pace (the pedal held through open walls).
      for (const fps of [60, 10, 6, 4]) {
        const frames = play(timeline, fps, secondsOf(arrival) + 3, (t) => Math.min(arrival.to + 0.5 / timeline.seconds, arrival.from + t / timeline.seconds));
        const picture = frames.find((f) => f.xp === 0)!.t;
        const car = frames.find((f) => f.x === 0)!.t;
        expect(car - picture).toBeLessThanOrEqual(0.35);
        // Never more than a short glide behind on the way in, at any frame rate.
        for (const f of frames) expect((f.p - f.at) * timeline.seconds).toBeLessThan(0.5);
      }
    });

    it("stands on the picture under reduced motion, and never leans", () => {
      const count = Math.ceil(secondsOf(arrival)) + 2;
      const frames = drive(timeline, arrival.from, count * 0.7 + 1, notches(timeline, arrival.from, 0.85, 0.7, count), { still: true });
      for (const f of frames) {
        expect(f.x).toBe(f.xp);
        expect(f.pitch).toBe(0);
      }
    });

    it("lands on a jump at once (a deep link, a capture)", () => {
      const m: CarMotion = newCarMotion();
      stepCarMotion(m, timeline, arrival.from, DT);
      const far = timeline.stops[3].from + 1 / timeline.seconds;
      stepCarMotion(m, timeline, far, DT, { snap: true });
      expect(m.car.x).toBe(carAt(timeline, far).x);
      expect(m.car.stop).toBe(3);
      expect(m.pace).toBe(0);
    });
  });
}
