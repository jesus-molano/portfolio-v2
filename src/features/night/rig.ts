/**
 * Where the night camera wants to be at a film position: the stop's keys
 * (direction.ts) eased between, fitted to the stop's subject on a portrait
 * screen, and panning with the car while a key tracks it. Pure, so the
 * direction's tests walk the very poses NightRig follows.
 */
import type { StageTimeline } from "@/features/work/workTimeline";
import { DIRECTION } from "./direction";
import { CAR_HALF, carBox, fitPose, type Key, mixPose, type Pose, poseAt, SAFE, type Vec3 } from "./frame";
import type { NightSet } from "./sets/types";

/**
 * How fast the camera eases (1/s), as in the hero's rig: a jump of the car
 * (snapped onto the picture within a stop) and the pointer's parallax glide
 * in, and settle within a fraction of a second. A cut (a new stop, under
 * the dip) takes the camera at once.
 */
export const FOLLOW = 5.5;

/** Lowest eye height a fitted camera may take (m). */
export const MIN_EYE = 0.7;

/** Where a tracking look aims on the car: its cabin, a little ahead of it. */
const CAR_AIM = { lead: 1.2, y: 0.85 } as const;

/** The car at the stop line, as a phone's fit frames it with the board: never the moving car, so no fit breathes as it drives. */
const AT_LINE = carBox(0, CAR_HALF.cabin);

export type StopKeys = { landscape: Key[]; portrait: Key[] };

/** Every stop's keys for both screens (the direction's; a stop it does not direct keeps the board's front). */
export function rigKeys(timeline: StageTimeline, count: number): StopKeys[] {
  return Array.from({ length: count }, (_, i) => {
    const direction = DIRECTION[i];
    const landscape = direction.shots(timeline);
    return { landscape, portrait: direction.portrait ? direction.portrait(timeline) : landscape };
  });
}

/** Where the cabin of a car at `carX` is, for a tracking look. */
export function carAim(carX: number): Vec3 {
  return [carX + CAR_AIM.lead, CAR_AIM.y, 0];
}

/**
 * The pose the rig follows at film position p on a screen of `aspect`:
 * the keyed pose; on a portrait screen fitted to the stop's subject (as
 * much as the key's `fit` asks); its look panned toward the car as much as
 * the key's `track` asks; never under MIN_EYE. `carX` is where the car is
 * drawn (carMotion.ts: it chases the picture, a glide behind it at most),
 * so a tracking look stays on the car itself.
 */
export function rigPose(
  timeline: StageTimeline,
  set: Pick<NightSet, "board" | "subject" | "maxBack">,
  keys: StopKeys,
  p: number,
  aspect: number,
  carX: number,
): Pose {
  const portrait = aspect < 1;
  const key = poseAt(portrait ? keys.portrait : keys.landscape, p);
  let pose: Pose = key;
  if (portrait) {
    const weight = key.fit ?? 1;
    if (weight > 0) {
      const subject = set.subject ? set.subject(key, p, AT_LINE) : [...set.board, ...AT_LINE];
      const fitted = fitPose(key, subject, aspect, SAFE.portrait, set.maxBack, true);
      pose = weight >= 1 ? fitted : mixPose(key, fitted, weight);
    }
  }
  const track = key.track ?? 0;
  if (track > 0) {
    const aim = carAim(carX);
    const look = pose.look;
    pose = {
      ...pose,
      look: [look[0] + (aim[0] - look[0]) * track, look[1] + (aim[1] - look[1]) * track, look[2] + (aim[2] - look[2]) * track],
    };
  }
  const lift = Math.max(0, MIN_EYE - pose.position[1]);
  if (lift > 0) {
    pose = {
      ...pose,
      position: [pose.position[0], pose.position[1] + lift, pose.position[2]],
      look: [pose.look[0], pose.look[1] + lift, pose.look[2]],
    };
  }
  return pose;
}

/** The film time the camera shoots at, and how far it still trails a jump of the car's (natural film, 0..1). */
export type ShotClock = { at: number; offset: number };

export function newShotClock(): ShotClock {
  return { at: Number.NaN, offset: 0 };
}

/**
 * Steps the camera's film time toward `target`, the car's own moment of the
 * drive (carMotion.ts framedAt): the keys describe the car's drive, so the
 * camera shoots exactly the moment the car is drawn at, and the car never
 * leaves a shot that frames it, however far it trails a fling (a phone's
 * frame is a third of a desktop's). The car's moment is already smooth (its
 * pace has bounded acceleration and jerk), so nothing lags it. A jump of
 * the car's (`jumped`) is eased in at FOLLOW, never shown as a jump of the
 * camera; a cut takes it at once.
 */
export function stepShotClock(clock: ShotClock, target: number, delta: number, opts: { cut: boolean; jumped: boolean }): number {
  if (opts.cut || !Number.isFinite(clock.at)) clock.offset = 0;
  else if (opts.jumped) clock.offset = clock.at - target;
  clock.offset *= Math.exp(-Math.min(Math.max(delta, 0), 0.1) * FOLLOW);
  if (Math.abs(clock.offset) < 1e-7) clock.offset = 0;
  clock.at = target + clock.offset;
  return clock.at;
}
