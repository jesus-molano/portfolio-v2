/**
 * Camera framing for the night stops. Every stop is a small set in its own
 * frame: the origin is the car's stop point, the street runs along +x (the
 * direction of travel), the board stands at z < 0 and the camera at z > 0.
 *
 * A shot is a list of keys on the film (a beat and a position inside it);
 * the pose between two keys eases with a smoothstep, so a change of framing
 * is a camera move that starts and lands softly; the change of stop happens
 * under a dip to night (work/dip.ts). On a portrait screen a pose is fitted to its board: the
 * camera dollies back along its view axis until the board fits the safe
 * rectangle, and only then widens the lens (never past 70 degrees).
 */
import { MathUtils, PerspectiveCamera, Vector3 } from "three";

export type Vec3 = readonly [number, number, number];

export type Pose = {
  position: Vec3;
  look: Vec3;
  fov: number;
  /**
   * How much the look follows the car as it drives (0 the key's look, 1 the
   * car): an arrival pans with the car and settles on the board, one
   * continuous move however the car brakes (rig.ts).
   */
  track?: number;
  /** On a portrait screen, how much of the fitted pose the shot takes (0 the key as written, 1 fitted; default 1). */
  fit?: number;
};

/**
 * A key on the film: p is the film position (0..1) where the pose is
 * reached. A `pass` key is not stopped at: the move from the key before it
 * to the key after it curves through it (a quadratic through its pose at
 * the move's middle), one ease from end to end.
 */
export type Key = Pose & { p: number; pass?: boolean };

/** The rectangle (fractions of the viewport, y down) a board must sit in. */
export type SafeRect = { x0: number; x1: number; y0: number; y1: number };

export const SAFE = {
  desktop: { x0: 0.06, x1: 0.94, y0: 0.12, y1: 0.78 },
  // Under the route and the stop's super, over the subtitles and the chip.
  portrait: { x0: 0.04, x1: 0.96, y0: 0.25, y1: 0.68 },
} as const satisfies Record<string, SafeRect>;

/** Widest lens a fitted pose may take (vertical field of view, degrees). */
export const MAX_FOV = 70;

/** Vertical FOV of a lens at the reference aspect 1.6 (28 mm = 43.7°, 35 mm = 35.6°, 50 mm = 25.4°). */
export const LENS = { mm28: 43.7, mm35: 35.6, mm40: 31.4, mm50: 25.4 } as const;

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function mix3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Two poses mixed: positions, looks, lenses, tracking and fit, each linearly. */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const track = (a.track ?? 0) + ((b.track ?? 0) - (a.track ?? 0)) * t;
  const fit = (a.fit ?? 1) + ((b.fit ?? 1) - (a.fit ?? 1)) * t;
  return { position: mix3(a.position, b.position, t), look: mix3(a.look, b.look, t), fov: a.fov + (b.fov - a.fov) * t, track, fit };
}

/** A quadratic from a to c through `via` at its middle, at t. */
function curve(a: Pose, via: Pose, c: Pose, t: number): Pose {
  const ac = mixPose(a, c, 0.5);
  // The control point that puts the curve's middle on `via`: 2 via - (a + c) / 2.
  const ctrl = mixPose(ac, via, 2);
  return mixPose(mixPose(a, ctrl, t), mixPose(ctrl, c, t), t);
}

/** The pose at film position p from keys sorted by p (held before the first and after the last). */
export function poseAt(keys: readonly Key[], p: number): Pose {
  if (keys.length === 0) throw new Error("A shot needs at least one key");
  if (p <= keys[0].p) return keys[0];
  for (let i = 1; i < keys.length; i += 1) {
    const b = keys[i];
    const c = keys[i + 1];
    if (b.pass && c) {
      if (p > c.p) continue;
      const a = keys[i - 1];
      return curve(a, b, c, smooth((p - a.p) / Math.max(1e-6, c.p - a.p)));
    }
    if (p <= b.p) {
      const a = keys[i - 1];
      const t = smooth((p - a.p) / Math.max(1e-6, b.p - a.p));
      return mixPose(a, b, t);
    }
  }
  return keys[keys.length - 1];
}

const camera = new PerspectiveCamera();
const v = new Vector3();
const forward = new Vector3();
const right = new Vector3();
const up = new Vector3();

/** Projected bounds of world points, as viewport fractions (x right, y down). */
function bounds(points: readonly Vec3[]): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const point of points) {
    v.set(point[0], point[1], point[2]).project(camera);
    const x = (v.x + 1) / 2;
    const y = (1 - v.y) / 2;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
}

function place(pose: Pose, back: number, fov: number, aspect: number) {
  forward.set(pose.look[0] - pose.position[0], pose.look[1] - pose.position[1], pose.look[2] - pose.position[2]);
  if (forward.lengthSq() < 1e-9) forward.set(0, 0, -1);
  forward.normalize();
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]).addScaledVector(forward, -back);
  camera.up.set(0, 1, 0);
  camera.fov = fov;
  camera.aspect = aspect;
  camera.lookAt(camera.position.x + forward.x, camera.position.y + forward.y, camera.position.z + forward.z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function fits(b: { x0: number; x1: number; y0: number; y1: number }, safe: SafeRect): boolean {
  return b.x1 - b.x0 <= safe.x1 - safe.x0 && b.y1 - b.y0 <= safe.y1 - safe.y0;
}

/**
 * Fits a pose to a subject (the board's corners) on a screen of `aspect`:
 * dolly back until the subject's size fits `safe` (at most `maxBack`
 * metres), then widen the lens if it still does not, then pan and tilt
 * so the subject sits in the middle of `safe`.
 * A subject that already fits stays as the shot was composed, unless
 * `centre` is set: a moving shot is always centred, or the frame it starts
 * centring on would jump by the subject's offset (rig.ts).
 */
export function fitPose(pose: Pose, subject: readonly Vec3[], aspect: number, safe: SafeRect, maxBack: number, centre = false): Pose {
  place(pose, 0, pose.fov, aspect);
  const initial = bounds(subject);
  const inside = initial.x0 >= safe.x0 && initial.x1 <= safe.x1 && initial.y0 >= safe.y0 && initial.y1 <= safe.y1;
  if (inside && !centre) return pose;

  let back = 0;
  let fov = pose.fov;
  if (!fits(initial, safe)) {
    place(pose, maxBack, fov, aspect);
    if (fits(bounds(subject), safe)) {
      let lo = 0;
      let hi = maxBack;
      for (let i = 0; i < 24; i += 1) {
        const mid = (lo + hi) / 2;
        place(pose, mid, fov, aspect);
        if (fits(bounds(subject), safe)) hi = mid;
        else lo = mid;
      }
      back = hi;
    } else {
      back = maxBack;
      let lo = pose.fov;
      let hi = MAX_FOV;
      for (let i = 0; i < 24; i += 1) {
        const mid = (lo + hi) / 2;
        place(pose, back, mid, aspect);
        if (fits(bounds(subject), safe)) hi = mid;
        else lo = mid;
      }
      fov = hi;
    }
  }

  // Centre the subject in the safe rectangle by sliding across the image plane.
  place(pose, back, fov, aspect);
  const b = bounds(subject);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const tx = (safe.x0 + safe.x1) / 2;
  const ty = (safe.y0 + safe.y1) / 2;
  let depth = 0;
  for (const point of subject) {
    v.set(point[0], point[1], point[2]).sub(camera.position);
    depth += v.dot(forward);
  }
  depth /= subject.length;
  const halfH = Math.tan(MathUtils.degToRad(fov) / 2) * depth;
  const halfW = halfH * aspect;
  right.crossVectors(forward, camera.up).normalize();
  up.crossVectors(right, forward).normalize();
  const dx = (cx - tx) * 2 * halfW;
  const dy = -(cy - ty) * 2 * halfH;
  // Pan and tilt toward the subject (the camera stays where it pulled back to),
  // so centring never takes it under the street or into a wall.
  const position = camera.position.clone();
  const look = position
    .clone()
    .addScaledVector(forward, depth)
    .addScaledVector(right, dx)
    .addScaledVector(up, dy);
  return { position: [position.x, position.y, position.z], look: [look.x, look.y, look.z], fov, track: pose.track, fit: pose.fit };
}

/** Where world points land on screen for a pose, as viewport fractions (x right, y down). */
export function projectPose(pose: Pose, points: readonly Vec3[], aspect: number): [number, number][] {
  place(pose, 0, pose.fov, aspect);
  return points.map((point) => {
    v.set(point[0], point[1], point[2]).project(camera);
    return [(v.x + 1) / 2, (1 - v.y) / 2];
  });
}

/** The car's whole length, and its cabin (where he sits) for a phone's tight framing. */
export const CAR_HALF = { body: 2.3, cabin: 1.4 } as const;

/** The car's bounding box (its eight corners) at x along the street, for framing; `half` is half its length. */
export function carBox(x: number, half: number = CAR_HALF.body): Vec3[] {
  const corners: Vec3[] = [];
  for (const dx of [-half, half]) for (const y of [0, 1.35]) for (const z of [-1, 1]) corners.push([x + dx, y, z]);
  return corners;
}
