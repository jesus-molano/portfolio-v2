import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { type StageTimeline, workTimeline } from "@/features/work/workTimeline";
import { dipAt } from "@/features/work/dip";
import { framedAt, newCarMotion, stepCarMotion } from "./carMotion";
import { carAt, carLegs } from "./carPath";
import { carBox, type Pose, projectPose } from "./frame";
import { FOLLOW, newShotClock, rigKeys, rigPose, stepShotClock } from "./rig";
import { SETS } from "./sets/registry";

const FPS = 60;
const DT = 1 / FPS;
/** A phone and a small phone, upright. */
const PHONES = [
  ["phone", 390 / 844],
  ["small phone", 360 / 740],
] as const;
/** The stops whose arrival a phone frames tightly around the car: Cloud District, Logixs, Heuristik. */
const STOPS = [
  [2, "cloud"],
  [3, "logixs"],
  [4, "heuristik"],
] as const;

type Shot = { t: number; p: number; dip: number; pose: Pose; car: number; design: boolean; drawn: boolean; old: boolean };

/** Where the car's box lands across the screen: on it at all (any part), and its centre. */
function onScreen(pose: Pose, x: number, aspect: number): boolean {
  const pts = projectPose(pose, carBox(x), aspect);
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return Math.max(...xs) > 0 && Math.min(...xs) < 1 && Math.max(...ys) > 0 && Math.min(...ys) < 1;
}

/**
 * The night scene as it runs: the car steps toward the picture, then the
 * camera (NightRig) shoots the car's moment through its shot clock. Also
 * where the design puts the car at that moment, and where the camera that
 * shot the picture's moment (as it did) would have had the drawn car.
 */
function film(timeline: StageTimeline, stop: number, aspect: number, seconds: number, picture: (t: number) => number): Shot[] {
  const keys = rigKeys(timeline, SETS.length)[stop];
  const m = newCarMotion();
  const clock = newShotClock();
  const shots: Shot[] = [];
  let last = -1;
  for (let i = 0; i <= seconds * FPS; i += 1) {
    const t = i * DT;
    const p = picture(t);
    stepCarMotion(m, timeline, p, DT);
    const at = stepShotClock(clock, framedAt(m, stop, p), DT, { cut: m.car.stop !== last, jumped: m.jumped });
    last = m.car.stop;
    const pose = rigPose(timeline, SETS[stop], keys, at, aspect, m.car.x);
    const designX = carAt(timeline, at).x;
    const design = onScreen(rigPose(timeline, SETS[stop], keys, at, aspect, designX), designX, aspect);
    const old = onScreen(rigPose(timeline, SETS[stop], keys, p, aspect, m.car.x), m.car.x, aspect);
    shots.push({ t, p, dip: dipAt(timeline, p), pose, car: m.car.x, design, drawn: onScreen(pose, m.car.x, aspect), old });
  }
  return shots;
}

/** The biggest move of the camera (its eye and where it looks, metres) and of its lens (degrees) from one frame to the next. */
function steps(shots: Shot[]) {
  let eye = 0;
  let look = 0;
  let lens = 0;
  for (let i = 1; i < shots.length; i += 1) {
    const a = shots[i - 1].pose;
    const b = shots[i].pose;
    eye = Math.max(eye, Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]));
    look = Math.max(look, Math.hypot(b.look[0] - a.look[0], b.look[1] - a.look[1], b.look[2] - a.look[2]));
    lens = Math.max(lens, Math.abs(b.fov - a.fov));
  }
  return { eye, look, lens };
}

for (const [name, dict] of [
  ["en", en],
  ["es", es],
] as const) {
  const timeline = workTimeline(dict.work);
  const S = timeline.seconds;

  describe(`the camera shoots the car's own moment (${name})`, () => {
    for (const [stop, label] of STOPS) {
      const arrival = carLegs(timeline).find((leg) => leg.kind === "arrive" && leg.stop === stop)!;
      const end = arrival.to + 0.3 / S;
      const inputs = [
        // A fling down the whole arrival in a third of a second: the car trails it by most of the street.
        ["a fling", 3, (t: number) => arrival.from + (end - arrival.from) * Math.min(1, t / 0.3)],
        // Swipes: a burst of most of a natural second, then the thumb lifts, again and again.
        [
          "swipes",
          5,
          (t: number) => {
            const n = Math.floor(t / 0.6);
            const into = Math.min(1, (t - n * 0.6) / 0.15);
            return Math.min(end, arrival.from + ((n + into) * 0.9) / S);
          },
        ],
        // Down the arrival and straight back up it, as a zigzagging thumb does.
        ["a zigzag", 3, (t: number) => arrival.from + (end - arrival.from) * (t < 0.4 ? t / 0.4 : Math.max(0.3, 1 - (t - 0.4) / 0.5))],
      ] as const;

      for (const [input, seconds, picture] of inputs) {
        for (const [screen, aspect] of PHONES) {
          it(`keeps the car in the shot at ${label}'s arrival on a ${screen}, through ${input}`, () => {
            const shots = film(timeline, stop, aspect, seconds, picture).filter((s) => s.dip < 0.5);
            // Wherever the shot frames the car, the drawn car is in it.
            const framed = shots.filter((s) => s.design);
            expect(framed.length).toBeGreaterThan(30);
            for (const s of framed) expect(s.drawn).toBe(true);
            // The camera never jumps: it moves as the car's moment does, a car's motion.
            const moved = steps(shots);
            expect(moved.eye).toBeLessThan(1.2);
            expect(moved.look).toBeLessThan(2.5);
            expect(moved.lens).toBeLessThan(1);
          });
        }
      }

      it(`shows why: a camera on the picture's moment loses the trailing car at ${label} on a phone`, () => {
        const [, , picture] = inputs[0];
        const shots = film(timeline, stop, PHONES[0][1], 3, picture).filter((s) => s.dip < 0.5 && s.design);
        expect(shots.filter((s) => !s.old).length).toBeGreaterThan(5);
      });
    }

    it("eases a jump of the car's in, and cuts at once", () => {
      const clock = newShotClock();
      expect(stepShotClock(clock, 0.3, DT, { cut: true, jumped: true })).toBe(0.3);
      // The car snapped 0.1 of the film on: the camera glides there at FOLLOW, never in one frame.
      const first = stepShotClock(clock, 0.4, DT, { cut: false, jumped: true });
      expect(first).toBeCloseTo(0.4 - 0.1 * Math.exp(-DT * FOLLOW), 12);
      let at = first;
      for (let i = 0; i < 3 * FPS; i += 1) {
        const next = stepShotClock(clock, 0.4, DT, { cut: false, jumped: false });
        expect(next).toBeGreaterThanOrEqual(at);
        at = next;
      }
      expect(at).toBeCloseTo(0.4, 6);
      // With nothing to ease in, it shoots the car's moment exactly, and a cut takes it at once.
      expect(stepShotClock(clock, 0.41, DT, { cut: false, jumped: false })).toBeCloseTo(0.41, 6);
      expect(stepShotClock(clock, 0.7, DT, { cut: true, jumped: false })).toBe(0.7);
    });

    it("shoots the car's moment while the car is in the stop on screen, and the picture's otherwise", () => {
      const m = newCarMotion();
      const arrival = carLegs(timeline).find((leg) => leg.kind === "arrive" && leg.stop === 2)!;
      stepCarMotion(m, timeline, arrival.from, DT);
      stepCarMotion(m, timeline, arrival.from + 1 / S, DT);
      expect(framedAt(m, 2, arrival.from + 1 / S)).toBe(m.at);
      expect(m.at).toBeLessThan(arrival.from + 1 / S);
      expect(framedAt(m, 3, 0.9)).toBe(0.9);
    });
  });
}
