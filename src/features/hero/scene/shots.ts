import { Vector3 } from "three";
import { CAR_POSITION } from "./drive";
import { DRIVER_SEAT } from "./driverPose";
import { world } from "./world";

/**
 * The hero is a five-shot sequence cut on scroll, like a mission intro.
 * Every shot is a distinct setup, so each cut changes the angle on the car
 * by well over 30 degrees (no jump cuts):
 *
 * 1. rear chase, high three-quarter from behind on the driver side;
 * 2. close-up of Jesús, front three-quarter from the driver side;
 * 3. side tracking from the empty inner lane;
 * 4. low angle by the rear wheel, toward the driver and the sky;
 * 5. crane from low ahead on the passenger side, rising around the driver
 *    side to high behind the car, on the city across the water and the sun.
 *
 * Keys are relative to the car on x (`CAR_POSITION.x` is added), world
 * space on y and z: the car never moves, its front is -z and the driver
 * side is -x. `look` is where the camera aims.
 *
 * Framing rules that keep the edit clean (checked in shots.test.ts):
 * - no camera below CLEAR_HEIGHT sits in a lane with traffic (traffic
 *   uses the outer lanes, x = ±5.8);
 * - no camera comes within ~8 m of the palm rows (|x| 14-15.6, PALM_ROW
 *   in roadside.ts), so no dark trunk strobes across the lens;
 * - the driver's head stays inside a centre-safe box at every aspect,
 *   clear of the title and the subtitles (see `fitToAspect`).
 */

export type CameraKey = { position: Vector3; look: Vector3; fov: number };

/** An intermediate key at `t` (0..1) through the shot. */
export type CameraVia = CameraKey & { t: number };

/** Centre-safe box in normalised device coordinates (-1..1). */
export type SafeBox = { x: number; yMin: number; yMax: number };

export type ShotLens = {
  /** Bokeh size for the depth of field; 0 keeps the whole frame sharp. */
  bokehScale: number;
  /** Depth around the focus distance that stays sharp, in metres. */
  focusRange: number;
};

export type Shot = {
  id: "rear" | "closeUp" | "tracking" | "low" | "crane";
  from: CameraKey;
  to: CameraKey;
  /** Keys between `from` and `to`, in time order; the path runs through them. */
  via?: CameraVia[];
  lens: ShotLens;
  /**
   * What must stay in frame at any aspect: the driver's head inside `head`,
   * and (when given) the car's whole bounding box inside `car`. After
   * `until` (local time, default 1) the shot may let the subject go.
   */
  frame: {
    head: SafeBox;
    car?: SafeBox;
    until?: number;
    /** Narrowest horizontal angle on a narrow screen; MIN_HORIZONTAL_FOV by default. */
    minHorizontalFov?: number;
  };
};

/** Aspect the shots are composed for (a 16:10 laptop). */
export const REFERENCE_ASPECT = 1.6;
/**
 * The horizontal field of view never drops below this on a narrow screen
 * (a phone in portrait would otherwise see a 23 degree sliver of the
 * scene), unless the shot is a close-up composed tighter than this.
 */
export const MIN_HORIZONTAL_FOV = 50;
/** Widest vertical field of view `fitToAspect` may reach. */
export const MAX_FOV = 100;
/** Below this height a camera keeps out of the traffic lanes. */
export const CLEAR_HEIGHT = 3.5;
/**
 * A camera below CLEAR_HEIGHT stays between the traffic lanes, |x| <= LANE_LIMIT:
 * the lane dividers (traffic runs in the outer lanes, x = ±5.8).
 */
export const LANE_LIMIT = 4;
/** Lowest a camera may go: never under the asphalt. */
export const MIN_CAMERA_HEIGHT = 0.3;

/**
 * Centre of the driver's head in world space. The seat origin is the
 * driver model's origin; the head bone sits 1.6 m above it and the centre
 * of the skull ~0.1 m higher (eyes at ~1.27 m above the road).
 */
export const DRIVER_HEAD = new Vector3(
  CAR_POSITION.x + DRIVER_SEAT.x,
  CAR_POSITION.y + DRIVER_SEAT.y + 1.69,
  CAR_POSITION.z + DRIVER_SEAT.z + 0.1,
);

/** The hero car's bounding box in world space (measured on the model). */
export const CAR_BOX = {
  min: new Vector3(CAR_POSITION.x - 0.97, CAR_POSITION.y, CAR_POSITION.z - 2.31),
  max: new Vector3(CAR_POSITION.x + 0.97, CAR_POSITION.y + 1.38, CAR_POSITION.z + 2.25),
};

function key(position: [number, number, number], look: [number, number, number], fov: number): CameraKey {
  return { position: new Vector3(...position), look: new Vector3(...look), fov };
}

/** World x of the sun, relative to the car (keys are car-relative on x). */
const SUN_X = world.sun.position.x - CAR_POSITION.x;

/** Head box for most shots: centred, clear of the title and the subtitles. */
const HEAD_BOX: SafeBox = { x: 0.7, yMin: -0.55, yMax: 0.75 };

export const SHOTS: Shot[] = [
  {
    // Chase cam, high three-quarter from behind on the driver side, so no
    // seat stands between the lens and the driver. The car sits in the
    // lower third, under the title, with the road and the low sun above it.
    id: "rear",
    from: key([-2.3, 2.7, 12.2], [0.5, 2.85, -16], 44),
    to: key([-1.9, 2.6, 11.4], [0.4, 2.65, -16], 43),
    lens: { bokehScale: 0, focusRange: 6 },
    frame: {
      // Below the title (upper third), above the subtitles.
      head: { x: 0.7, yMin: -0.55, yMax: 0.15 },
      car: { x: 0.85, yMin: -0.76, yMax: 0.2 },
    },
  },
  {
    // Close-up: front three-quarter from the driver side, ahead of the
    // windscreen's corner so no glass stands between the lens and his face.
    // The low sun is behind the camera and lights him warm. The camera sits
    // on the centre line (the empty inner lane at most), never in a traffic
    // lane, a little above his eyes: his head then reads against the
    // guardrail and the sand, below the foot of the palm row, so no trunk
    // grows out of it. Slow push-in.
    id: "closeUp",
    from: key([-2.5, 1.12, -2.3], [-0.2, 1.3, 0.2], 22),
    to: key([-2.15, 1.16, -1.85], [-0.28, 1.32, 0.22], 19),
    lens: { bokehScale: 2, focusRange: 1.2 },
    // A close-up stays a close-up on a phone: the lens may stay this tight.
    frame: { head: HEAD_BOX, minHorizontalFov: 26 },
  },
  {
    // Side tracking on the driver side, from the empty inner lane. The lens
    // is high enough (2.2 m) that his head reads against the far lane and
    // the beach, below the foot of the palm row, so no trunk runs behind
    // it; the look is raised so the palm crowns stay in the frame.
    id: "tracking",
    from: key([-6.35, 2.55, 1.8], [0, 1.6, -0.2], 52),
    to: key([-6.4, 2.5, -0.8], [0, 1.65, 0.4], 50),
    lens: { bokehScale: 2, focusRange: 2.5 },
    // The whole car stays in, wheels above the subtitles.
    frame: { head: HEAD_BOX, car: { x: 1, yMin: -0.74, yMax: 0.9 } },
  },
  {
    // Low angle by the rear wheel, along the flank toward the driver and
    // the sky; the sun rims him from ahead.
    id: "low",
    from: key([-1.9, 0.42, 3.1], [0.5, 1.55, -5], 64),
    to: key([-1.6, 0.6, 2.4], [0.8, 2.3, -8], 60),
    lens: { bokehScale: 3, focusRange: 1.6 },
    frame: { head: HEAD_BOX },
  },
  {
    // Crane: opens low and wide ahead on the passenger side looking back at
    // the car coming at the lens, then booms up as it circles the driver
    // side (the side with room: the palms keep the passenger side narrow)
    // and settles high behind it on the causeway, the city across the
    // water and the sun. Timed to the script: the circle plays under the
    // first two cards; during the last one ("...billboard after billboard",
    // local ~0.42-0.63) it rises behind the car, holds it in the lower third
    // under the city and the sun (0.52), then tilts up to the skyline and
    // lets the car go. The fade to night (film 0.93, local 0.65) plays in
    // under a second, so after 0.67 the camera only drifts. The last aims
    // lean toward the sun so it stays in the frame.
    id: "crane",
    from: key([1.3, 0.6, -6.05], [0, 1.3, 0], 52),
    via: [
      { t: 0.11, ...key([-2.9, 2.2, -7.9], [0.05, 1.8, 0.1], 50) },
      { t: 0.22, ...key([-7.05, 4.2, -4.9], [0.27, 1.75, 0.2], 50) },
      { t: 0.3, ...key([-7.8, 5, 0], [0.57, 2.02, 0], 50) },
      { t: 0.4, ...key([-6.7, 6.4, 7.4], [0.44, 2.1, -0.48], 48) },
      { t: 0.52, ...key([-2, 10.5, 18.9], [0.15, 4.9, -1.6], 46) },
      { t: 0.67, ...key([-1.2, 16.5, 32.6], [SUN_X * 0.1, 15.7, -40], 44.4) },
    ],
    to: key([-1, 18, 36], [SUN_X * 0.4, 15, -260], 44),
    lens: { bokehScale: 0, focusRange: 20 },
    frame: {
      head: { x: 0.8, yMin: -0.72, yMax: 0.2 },
      car: { x: 1, yMin: -0.8, yMax: 0.9 },
      until: 0.52,
    },
  },
];

export const SHOT_COUNT = SHOTS.length;

export function shotIndexAt(progress: number): number {
  return Math.min(SHOT_COUNT - 1, Math.max(0, Math.floor(progress * SHOT_COUNT)));
}

/** How far past a cut (film progress) the picture must go before it cuts (stickyShot). */
export const CUT_BAND = 0.002;

/**
 * Keeps the current shot until the progress is more than `band` past a
 * cut, clamping the progress into that shot, so a finger resting on the
 * glass at a cut never strobes between two shots. A jump of more than one
 * shot cuts at once.
 */
export function stickyShot(progress: number, previous: number, band = CUT_BAND): { shot: number; p: number } {
  const natural = shotIndexAt(progress);
  if (previous < 0 || previous >= SHOT_COUNT || Math.abs(natural - previous) !== 1) {
    return { shot: natural, p: progress };
  }
  if (natural > previous) {
    const cut = (previous + 1) / SHOT_COUNT;
    if (progress > cut + band) return { shot: natural, p: progress };
    return { shot: previous, p: Math.min(progress, cut - 1e-6) };
  }
  const cut = previous / SHOT_COUNT;
  if (progress < cut - band) return { shot: natural, p: progress };
  return { shot: previous, p: Math.max(progress, cut) };
}

/** Local time (0..1) inside the shot at a film progress. */
export function shotLocalTime(progress: number): number {
  const index = shotIndexAt(progress);
  return Math.min(1, Math.max(0, progress * SHOT_COUNT - index));
}

export type CameraPose = CameraKey & { shot: number };

type TimedKey = CameraKey & { t: number };

/** The keys of a shot in time order, `from` at 0 and `to` at 1. */
export function shotKeys(shot: Shot): TimedKey[] {
  return [{ t: 0, ...shot.from }, ...(shot.via ?? []), { t: 1, ...shot.to }];
}

/**
 * Monotone (PCHIP) slope of one coordinate at key `i`, per unit of t: the
 * weighted harmonic mean of the slopes on either side, 0 where the
 * coordinate turns back and at the first and last key (ease in, ease out).
 * The path never overshoots a key, however unevenly the keys are spaced.
 */
function slope(keys: TimedKey[], i: number, field: "position" | "look", axis: "x" | "y" | "z"): number {
  if (i === 0 || i === keys.length - 1) return 0;
  const h0 = keys[i].t - keys[i - 1].t;
  const h1 = keys[i + 1].t - keys[i].t;
  if (h0 <= 0 || h1 <= 0) return 0;
  const d0 = (keys[i][field][axis] - keys[i - 1][field][axis]) / h0;
  const d1 = (keys[i + 1][field][axis] - keys[i][field][axis]) / h1;
  if (d0 * d1 <= 0) return 0;
  return (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
}

const AXES = ["x", "y", "z"] as const;

/**
 * Cubic Hermite interpolation through the keys with monotone slopes:
 * smooth through every key, easing in at the start and out at the end of
 * the shot. With two keys it is a smoothstep between them.
 */
export function interpolateKeys(keys: TimedKey[], t: number, out: CameraKey): CameraKey {
  const clamped = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < keys.length - 2 && clamped > keys[i + 1].t) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.t - a.t;
  const u = span > 0 ? (clamped - a.t) / span : 0;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  for (const field of ["position", "look"] as const) {
    for (const axis of AXES) {
      out[field][axis] =
        h00 * a[field][axis] +
        h10 * span * slope(keys, i, field, axis) +
        h01 * b[field][axis] +
        h11 * span * slope(keys, i + 1, field, axis);
    }
  }
  // The field of view eases between keys without overshoot.
  out.fov = a.fov + (b.fov - a.fov) * (u2 * (3 - 2 * u));
  return out;
}

const DEG = Math.PI / 180;

/** Horizontal field of view (degrees) for a vertical one at an aspect. */
export function horizontalFov(fov: number, aspect: number): number {
  return (2 * Math.atan(Math.tan((fov * DEG) / 2) * aspect)) / DEG;
}

/** Vertical field of view (degrees) that gives a horizontal one at an aspect. */
export function verticalFov(horizontal: number, aspect: number): number {
  return (2 * Math.atan(Math.tan((horizontal * DEG) / 2) / aspect)) / DEG;
}

const UP = new Vector3(0, 1, 0);
const forward = new Vector3();
const right = new Vector3();
const upAxis = new Vector3();
const offset = new Vector3();

/**
 * Projects a world point into normalised device coordinates for a camera at
 * `position` aiming at `look` (three.js lookAt, +y up). Returns false when
 * the point is behind the camera.
 */
export function projectToNdc(
  point: Vector3,
  pose: CameraKey,
  aspect: number,
  out: { x: number; y: number },
): boolean {
  forward.subVectors(pose.look, pose.position);
  if (forward.lengthSq() < 1e-12) return false;
  forward.normalize();
  right.crossVectors(forward, UP);
  // Looking straight up or down: any horizontal axis will do.
  if (right.lengthSq() < 1e-12) right.set(1, 0, 0);
  right.normalize();
  upAxis.crossVectors(right, forward);
  offset.subVectors(point, pose.position);
  const depth = offset.dot(forward);
  if (depth <= 1e-4) return false;
  const tanHalf = Math.tan((pose.fov * DEG) / 2);
  out.x = offset.dot(right) / (depth * tanHalf * aspect);
  out.y = offset.dot(upAxis) / (depth * tanHalf);
  return true;
}

const ndc = { x: 0, y: 0 };
const corner = new Vector3();

function insideBox(point: Vector3, pose: CameraKey, aspect: number, box: SafeBox): boolean {
  if (!projectToNdc(point, pose, aspect, ndc)) return false;
  return Math.abs(ndc.x) <= box.x && ndc.y >= box.yMin && ndc.y <= box.yMax;
}

/** Corner `i` (0..7) of the car's bounding box. */
export function carCorner(i: number, out: Vector3): Vector3 {
  return out.set(
    i & 1 ? CAR_BOX.max.x : CAR_BOX.min.x,
    i & 2 ? CAR_BOX.max.y : CAR_BOX.min.y,
    i & 4 ? CAR_BOX.max.z : CAR_BOX.min.z,
  );
}

/** Whether the shot's subject is inside its safe boxes. */
export function subjectInFrame(pose: CameraKey, aspect: number, frame: Shot["frame"]): boolean {
  if (!insideBox(DRIVER_HEAD, pose, aspect, frame.head)) return false;
  const box = frame.car;
  if (!box) return true;
  for (let i = 0; i < 8; i += 1) {
    if (!insideBox(carCorner(i, corner), pose, aspect, box)) return false;
  }
  return true;
}

const pullDirection = new Vector3();

/**
 * Furthest the camera may pull back along (position - look): it stays
 * above the road, out of the traffic lanes while low, and at most doubles
 * its distance to the aim point.
 */
export function maxPullBack(pose: CameraKey): number {
  pullDirection.subVectors(pose.position, pose.look);
  const distance = pullDirection.length();
  if (distance < 1e-6) return 0;
  pullDirection.divideScalar(distance);
  const { x, y } = pose.position;
  let limit = distance;
  if (pullDirection.y < 0) limit = Math.min(limit, (y - MIN_CAMERA_HEIGHT) / -pullDirection.y);
  if (y < CLEAR_HEIGHT && Math.abs(x) < LANE_LIMIT) {
    if (pullDirection.x < 0) limit = Math.min(limit, (x + LANE_LIMIT) / -pullDirection.x);
    if (pullDirection.x > 0) limit = Math.min(limit, (LANE_LIMIT - x) / pullDirection.x);
  }
  return Math.max(0, limit);
}

const basePosition = new Vector3();
const backward = new Vector3();
const baseLook = new Vector3();

/**
 * Tilts the camera (moves its aim point up or down) until the driver's
 * head sits at `y` in normalised device coordinates. Keeps the subject at
 * the height it was composed at when a narrow screen widens the lens.
 */
export function tiltToHeight(pose: CameraKey, aspect: number, y: number): CameraKey {
  baseLook.copy(pose.look);
  const span = pose.position.distanceTo(pose.look) * 1.5;
  const headY = (dy: number) => {
    pose.look.y = baseLook.y + dy;
    return projectToNdc(DRIVER_HEAD, pose, aspect, ndc) ? ndc.y : Number.NaN;
  };
  // Aiming higher moves the head down the frame.
  const above = headY(-span);
  const below = headY(span);
  if (!(above >= y && below <= y)) {
    pose.look.copy(baseLook);
    return pose;
  }
  let low = -span;
  let high = span;
  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) / 2;
    if (headY(mid) > y) low = mid;
    else high = mid;
  }
  headY((low + high) / 2);
  return pose;
}

/**
 * Adapts a pose composed at REFERENCE_ASPECT to the screen's aspect, in place.
 * 1. On a narrow screen the vertical field of view widens so the horizontal
 *    one never drops below MIN_HORIZONTAL_FOV (or below the shot's own
 *    horizontal angle, for a close-up composed tighter than that), and the
 *    camera tilts so his head stays at the height it was composed at.
 * 2. If the subject still leaves its safe box, the camera pulls back along
 *    its line of sight, as little as needed and only where it may go.
 * 3. If that is not enough, the field of view widens further.
 * At the reference aspect a well-composed shot comes back unchanged.
 * Without a `frame` only step 1 runs.
 */
export function fitToAspect(pose: CameraKey, aspect: number, frame?: Shot["frame"]): CameraKey {
  // Where the head sits in the frame as composed, before the lens changes.
  const composed = frame && projectToNdc(DRIVER_HEAD, pose, REFERENCE_ASPECT, ndc) ? ndc.y : Number.NaN;
  const minimum = frame?.minHorizontalFov ?? MIN_HORIZONTAL_FOV;
  const floor = Math.min(minimum, horizontalFov(pose.fov, REFERENCE_ASPECT));
  const fov = Math.min(MAX_FOV, Math.max(pose.fov, verticalFov(floor, aspect)));
  const widened = fov > pose.fov + 1e-6;
  pose.fov = fov;
  if (!frame) return pose;
  if (widened && Number.isFinite(composed)) {
    const { yMin, yMax } = frame.head;
    tiltToHeight(pose, aspect, Math.min(yMax - 0.05, Math.max(yMin + 0.05, composed)));
  }
  if (subjectInFrame(pose, aspect, frame)) return pose;

  basePosition.copy(pose.position);
  backward.subVectors(pose.position, pose.look).normalize();
  const limit = maxPullBack(pose);
  const pulled = (pull: number) => {
    pose.position.copy(basePosition).addScaledVector(backward, pull);
    return subjectInFrame(pose, aspect, frame);
  };
  if (pulled(limit)) {
    // Smallest pull that frames the subject: it only gets smaller with distance.
    let low = 0;
    let high = limit;
    for (let i = 0; i < 14; i += 1) {
      const mid = (low + high) / 2;
      if (pulled(mid)) high = mid;
      else low = mid;
    }
    pulled(high);
    return pose;
  }

  // Pulled back as far as it may go: a wider lens does the rest.
  const baseFov = pose.fov;
  const wider = (value: number) => {
    pose.fov = value;
    return subjectInFrame(pose, aspect, frame);
  };
  if (!wider(MAX_FOV)) return pose;
  let low = baseFov;
  let high = MAX_FOV;
  for (let i = 0; i < 14; i += 1) {
    const mid = (low + high) / 2;
    if (wider(mid)) high = mid;
    else low = mid;
  }
  pose.fov = high;
  return pose;
}

const KEYS = SHOTS.map(shotKeys);

/** Local time over which a shot past its `until` lets go of the subject. */
export const RELEASE = 0.2;

const raw: CameraKey = { position: new Vector3(), look: new Vector3(), fov: 50 };
const held: CameraKey = { position: new Vector3(), look: new Vector3(), fov: 50 };

/** The shot's keyed pose at a local time, in world space (before any fit). */
function keyedPose(index: number, local: number, out: CameraKey): CameraKey {
  interpolateKeys(KEYS[index], local, out);
  out.position.x += CAR_POSITION.x;
  out.look.x += CAR_POSITION.x;
  return out;
}

/**
 * Evaluates the camera pose for a film progress in [0, 1] on a screen of
 * the given aspect (width / height).
 */
export function evaluateCamera(
  progress: number,
  out: CameraPose,
  aspect: number = REFERENCE_ASPECT,
): CameraPose {
  const index = shotIndexAt(progress);
  const local = shotLocalTime(progress);
  const { frame } = SHOTS[index];
  const until = frame.until ?? 1;
  keyedPose(index, local, out);
  out.shot = index;
  if (local <= until) {
    fitToAspect(out, aspect, frame);
    return out;
  }
  // Past `until` the subject may leave the frame. The correction the fit
  // made at `until` (pull-back, tilt, wider lens) fades out over RELEASE,
  // so letting go never jumps.
  fitToAspect(out, aspect);
  keyedPose(index, until, held);
  fitToAspect(held, aspect, frame);
  keyedPose(index, until, raw);
  fitToAspect(raw, aspect);
  const u = Math.min(1, (local - until) / RELEASE);
  const keep = 1 - u * u * (3 - 2 * u);
  out.position.addScaledVector(held.position.sub(raw.position), keep);
  out.look.addScaledVector(held.look.sub(raw.look), keep);
  out.fov += (held.fov - raw.fov) * keep;
  return out;
}
