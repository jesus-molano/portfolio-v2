import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { dipAt } from "@/features/work/dip";
import { type StageTimeline, workTimeline } from "@/features/work/workTimeline";
import { carAt } from "./carPath";
import { CAPTION_SPAN, DIRECTION } from "./direction";
import { type Pose, projectPose, type Vec3 } from "./frame";
import { rigKeys, rigPose } from "./rig";
import { MAST_TOP, NAME_SIGN_CORNERS } from "./sets/HeuristikSet";
import { LOGIXS_FRAMING } from "./sets/LogixsSet";
import { PWC_FRAMING } from "./sets/PwcSet";
import { SETS } from "./sets/registry";

const ARMY = 0;
const PWC = 1;
const LOGIXS = 3;
const HEURISTIK = 4;

/** A desktop, a phone and a small phone. */
const SCREENS = [
  ["desktop", 1440 / 900],
  ["phone", 390 / 844],
  ["small phone", 360 / 740],
] as const;

/**
 * Where the subtitles, the cue and the chip start (a share of the height
 * from the top): the car must stop above them. A phone's card sits higher,
 * over the pedal.
 */
const FOOT = { desktop: 0.8, phone: 0.72 } as const;
/** The route and the stop's super along the top of a desktop frame. */
const HEAD = 0.12;

function forward(pose: Pose): number[] {
  return pose.look.map((v, k) => v - pose.position[k]);
}

/** Every point in front of the camera and inside the frame (shares of width and height, y down). */
function inFrame(pose: Pose, points: readonly Vec3[], aspect: number, margin = 0): boolean {
  const f = forward(pose);
  const ahead = points.every((p) => f[0] * (p[0] - pose.position[0]) + f[1] * (p[1] - pose.position[1]) + f[2] * (p[2] - pose.position[2]) > 0);
  return ahead && projectPose(pose, points, aspect).every(([x, y]) => x >= margin && x <= 1 - margin && y >= margin && y <= 1 - margin);
}

function turn(a: Pose, b: Pose): number {
  const fa = forward(a);
  const fb = forward(b);
  const c = (fa[0] * fb[0] + fa[1] * fb[1] + fa[2] * fb[2]) / (Math.hypot(...fa) * Math.hypot(...fb));
  return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI + Math.abs(a.fov - b.fov);
}

function moved(a: Pose, b: Pose): number {
  return Math.hypot(...a.position.map((v, k) => v - b.position[k]));
}

function beat(timeline: StageTimeline, id: string) {
  const found = timeline.beats.find((b) => b.id === id);
  if (!found) throw new Error(id);
  return found;
}

function carPoint(timeline: StageTimeline, p: number): Vec3 {
  return [carAt(timeline, p).x, 0.7, 0];
}

describe("the camera's direction", () => {
  for (const [name, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    const timeline = workTimeline(dict.work);
    const keys = rigKeys(timeline, SETS.length);
    const poseAt = (stop: number, p: number, aspect: number) => rigPose(timeline, SETS[stop], keys[stop], p, aspect, carAt(timeline, p).x);

    it(`keys every stop in film order, inside the stop (${name})`, () => {
      DIRECTION.forEach((direction, stop) => {
        for (const list of [direction.shots(timeline), direction.portrait?.(timeline) ?? []]) {
          for (let i = 1; i < list.length; i += 1) expect(list[i].p).toBeGreaterThanOrEqual(list[i - 1].p);
          for (const key of list) {
            // The first stop's keys may start on the title and the bridge, which play over its set.
            if (stop > 0) expect(key.p).toBeGreaterThanOrEqual(timeline.stops[stop].from - 1e-9);
            expect(key.p).toBeLessThanOrEqual(timeline.stops[stop].to + 1e-9);
          }
        }
      });
    });

    for (const [screen, aspect] of SCREENS) {
      const foot = screen === "desktop" ? FOOT.desktop : FOOT.phone;

      it(`never whips: every step of the film is a glide, outside the dips (${name}, ${screen})`, () => {
        SETS.forEach((_, stop) => {
          const from = stop === 0 ? 0 : timeline.stops[stop].from;
          const to = timeline.stops[stop].to;
          const steps = 2000;
          let last = poseAt(stop, from, aspect);
          for (let i = 1; i <= steps; i += 1) {
            const p = from + ((to - from) * i) / steps;
            const now = poseAt(stop, p, aspect);
            if (dipAt(timeline, p) < 0.5) {
              expect(moved(now, last), `stop ${stop} at ${p.toFixed(4)}`).toBeLessThan(0.5);
              expect(turn(now, last), `stop ${stop} at ${p.toFixed(4)}`).toBeLessThan(2);
            }
            last = now;
          }
        });
      });

      it(`holds the board through every line: a slow push at most (${name}, ${screen})`, () => {
        for (const card of timeline.cards) {
          if (card.stop < 0) continue;
          let travel = 0;
          let turned = 0;
          let last = poseAt(card.stop, card.start, aspect);
          for (let i = 1; i <= 100; i += 1) {
            const now = poseAt(card.stop, card.start + ((card.end - card.start) * i) / 100, aspect);
            travel += moved(now, last);
            turned += turn(now, last);
            last = now;
          }
          expect(travel, card.id).toBeLessThanOrEqual(3);
          expect(turned, card.id).toBeLessThanOrEqual(5);
        }
      });

      it(`picks the car up as it arrives: on screen for most of every arrival (${name}, ${screen})`, () => {
        SETS.forEach((_, stop) => {
          const arrival = timeline.beats.find((b) => b.stop === stop && (b.id.endsWith(".open") || b.id.endsWith(".arrive")))!;
          // The first stop's car rolls in under the bridge line, as the night fades up: from its middle on.
          const bridge = beat(timeline, "bridge");
          const start = stop === ARMY ? (bridge.start + bridge.end) / 2 : arrival.start;
          let seen = 0;
          let total = 0;
          for (let i = 0; i <= 60; i += 1) {
            const p = start + ((arrival.end - start) * i) / 60;
            if (dipAt(timeline, p) >= 0.5) continue;
            total += 1;
            if (inFrame(poseAt(stop, p, aspect), [carPoint(timeline, p)], aspect, 0.02)) seen += 1;
          }
          expect(seen / total, `stop ${stop}`).toBeGreaterThanOrEqual(0.6);
        });
      });

      it(`stops the car clear of the subtitles while he speaks (${name}, ${screen})`, () => {
        for (const card of timeline.cards) {
          if (card.stop < 0 || card.stop === HEURISTIK) continue;
          const p = (card.start + card.end) / 2;
          const [[x, y]] = projectPose(poseAt(card.stop, p, aspect), [carPoint(timeline, p)], aspect);
          expect(x, card.id).toBeGreaterThan(0.04);
          expect(x, card.id).toBeLessThan(0.96);
          expect(y, card.id).toBeLessThan(foot);
        }
      });

      it(`keeps every board whole while its lines play (${name}, ${screen})`, () => {
        for (const card of timeline.cards) {
          if (card.stop < 0 || card.stop === PWC || card.stop === LOGIXS) continue;
          const p = (card.start + card.end) / 2;
          expect(inFrame(poseAt(card.stop, p, aspect), SETS[card.stop].board, aspect), card.id).toBe(true);
        }
      });

      it(`never reads WC at PwC: the blade shows P, W and C, or not two of them alone (${name}, ${screen})`, () => {
        const { from, to } = timeline.stops[PWC];
        for (let i = 0; i <= 600; i += 1) {
          const p = from + ((to - from) * i) / 600;
          if (dipAt(timeline, p) >= 0.5) continue;
          const pose = poseAt(PWC, p, aspect);
          const [P, W, C] = PWC_FRAMING.letters.map((letter) => inFrame(pose, letter, aspect));
          expect(W && C && !P, `at ${p.toFixed(4)}`).toBe(false);
        }
        // Arrived, the whole hotel: the three letters, the years over the lobby and the car under the blade.
        const open = beat(timeline, "pwc.open").end;
        const hotel = poseAt(PWC, open, aspect);
        for (const letter of PWC_FRAMING.letters) expect(inFrame(hotel, letter, aspect, 0.02)).toBe(true);
        expect(inFrame(hotel, PWC_FRAMING.checkIn, aspect, 0.02)).toBe(true);
        expect(inFrame(hotel, [carPoint(timeline, open)], aspect, 0.04)).toBe(true);
        if (screen === "desktop") {
          const top = Math.min(...projectPose(hotel, PWC_FRAMING.letters[0], aspect).map(([, y]) => y));
          expect(top).toBeGreaterThan(HEAD);
        }
      });

      it(`reads the readerboard at PwC: a quarter of the frame wide, the car under it (${name}, ${screen})`, () => {
        for (const id of ["pwc.card0", "pwc.card1"]) {
          const card = beat(timeline, id);
          const p = (card.start + card.end) / 2;
          const pose = poseAt(PWC, p, aspect);
          expect(inFrame(pose, PWC_FRAMING.reader, aspect, 0.02), id).toBe(true);
          const xs = projectPose(pose, PWC_FRAMING.reader, aspect).map(([x]) => x);
          expect(Math.max(...xs) - Math.min(...xs), id).toBeGreaterThan(0.25);
        }
      });

      if (aspect < 1) {
        it(`leaves PwC's C whole on a portrait screen: the captions stand right of it (${name}, ${screen})`, () => {
          // The C stands over the readerboard, left of the car, in the top left of the reading shots.
          expect(DIRECTION[PWC].phoneCaptions).toBe("right");
          // The captions' left edge: their share of the width and their 1.25rem margin (20 px of a 360 px phone).
          const edge = 1 - CAPTION_SPAN - 20 / 360;
          for (const [id, t] of [
            ["pwc.marquee", 1],
            ["pwc.card0", 0.5],
            ["pwc.card1", 0.5],
            ["pwc.leave", 0.12],
          ] as const) {
            const b = beat(timeline, id);
            const pose = poseAt(PWC, b.start + (b.end - b.start) * t, aspect);
            const c = projectPose(pose, PWC_FRAMING.letters[2], aspect);
            expect(Math.max(...c.map(([x]) => x)), id).toBeLessThan(edge);
            // Whole in the frame, under the route.
            expect(Math.min(...c.map(([x]) => x)), id).toBeGreaterThan(0.02);
            expect(Math.min(...c.map(([, y]) => y)), id).toBeGreaterThan(0.06);
          }
        });
      }

      it(`frames Logixs' type whole: the snipe, the ban and each line's bill (${name}, ${screen})`, () => {
        for (const [id, bill] of [
          ["logixs.card0", LOGIXS_FRAMING.bytetravel],
          ["logixs.card1", LOGIXS_FRAMING.gig],
        ] as const) {
          const card = beat(timeline, id);
          for (const t of [0.15, 0.5, 0.85]) {
            const pose = poseAt(LOGIXS, card.start + (card.end - card.start) * t, aspect);
            expect(inFrame(pose, LOGIXS_FRAMING.snipe, aspect, 0.03), `${id} snipe`).toBe(true);
            expect(inFrame(pose, LOGIXS_FRAMING.ban, aspect, 0.03), `${id} ban`).toBe(true);
            expect(inFrame(pose, bill, aspect, 0.03), `${id} bill`).toBe(true);
            const xs = projectPose(pose, bill, aspect).map(([x]) => x);
            // Wide enough to read its headline.
            expect(Math.max(...xs) - Math.min(...xs), `${id} bill width`).toBeGreaterThan(0.12);
          }
        }
      });

      it(`names Heuristik over the lobby, clear of the cues and the chip (${name}, ${screen})`, () => {
        const open = beat(timeline, "heuristik.open");
        const crane = beat(timeline, "heuristik.crane");
        for (const p of [open.end, crane.start + (crane.end - crane.start) * 0.05]) {
          const pose = poseAt(HEURISTIK, p, aspect);
          expect(inFrame(pose, NAME_SIGN_CORNERS, aspect, 0.04)).toBe(true);
          const ys = projectPose(pose, NAME_SIGN_CORNERS, aspect).map(([, y]) => y);
          expect(Math.max(...ys)).toBeLessThan(foot);
        }
      });

      it(`keeps the lit mast's top under the route on the crown shots (${name}, ${screen})`, () => {
        for (const id of ["heuristik.card0", "heuristik.card1"]) {
          const card = beat(timeline, id);
          const pose = poseAt(HEURISTIK, (card.start + card.end) / 2, aspect);
          const [[, y]] = projectPose(pose, [[8, MAST_TOP, -42]], aspect);
          expect(y, id).toBeGreaterThan(screen === "desktop" ? HEAD : 0.2);
        }
      });
    }

    it(`climbs the tower at a crane's pace (${name})`, () => {
      const crane = beat(timeline, "heuristik.crane");
      for (const [, aspect] of SCREENS) {
        let last = poseAt(HEURISTIK, crane.start, aspect);
        const steps = 400;
        const dt = ((crane.end - crane.start) * timeline.seconds) / steps;
        for (let i = 1; i <= steps; i += 1) {
          const now = poseAt(HEURISTIK, crane.start + ((crane.end - crane.start) * i) / steps, aspect);
          // Metres a natural second: never a facade streaming past.
          expect(moved(now, last) / dt).toBeLessThan(20);
          last = now;
        }
      }
    });
  }
});
