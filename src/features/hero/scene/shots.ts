import { Vector3 } from "three";
import { CAR_POSITION } from "./drive";

/**
 * The hero is a four-shot sequence cut on scroll, like a mission intro.
 * Offsets are relative to the car (front is -z, driver side is -x).
 * `look` is where the camera aims.
 *
 * Framing rules that keep the edit clean:
 * - no camera sits in a lane with traffic (traffic uses the outer lanes);
 * - no camera is closer than ~8 m to the palm rows, so no dark trunk
 *   strobes across the lens.
 */
export type Shot = {
  id: "rear" | "tracking" | "low" | "crane";
  from: { position: Vector3; look: Vector3; fov: number };
  to: { position: Vector3; look: Vector3; fov: number };
};

export const SHOTS: Shot[] = [
  {
    // Chase cam, high three-quarter from behind on the driver side, so no
    // seat stands between the lens and the driver.
    id: "rear",
    from: { position: new Vector3(-1.9, 2.2, 10.2), look: new Vector3(0.7, 0.9, -14), fov: 48 },
    to: { position: new Vector3(-1.3, 2.6, 8.4), look: new Vector3(0.5, 1.0, -18), fov: 46 },
  },
  {
    // Side tracking on the driver side, from the empty inner lane.
    id: "tracking",
    from: { position: new Vector3(-5.2, 1.25, 2.6), look: new Vector3(0, 0.95, -0.2), fov: 50 },
    to: { position: new Vector3(-4.7, 1.55, -1.8), look: new Vector3(0, 1.0, -1.4), fov: 48 },
  },
  {
    // Low angle by the rear wheel, along the flank toward the driver and the sky.
    id: "low",
    from: { position: new Vector3(-1.9, 0.42, 3.1), look: new Vector3(0.1, 1.5, -5), fov: 64 },
    to: { position: new Vector3(-1.6, 0.6, 2.4), look: new Vector3(0.4, 2.3, -8), fov: 60 },
  },
  {
    // Crane: rises over the car and reveals the island and the city.
    id: "crane",
    from: { position: new Vector3(-2.6, 2.4, 7.2), look: new Vector3(0, 1.0, -10), fov: 50 },
    to: { position: new Vector3(-1.0, 24, 34), look: new Vector3(0, 3, -70), fov: 44 },
  },
];

export const SHOT_COUNT = SHOTS.length;

export function shotIndexAt(progress: number): number {
  return Math.min(SHOT_COUNT - 1, Math.max(0, Math.floor(progress * SHOT_COUNT)));
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export type CameraPose = { position: Vector3; look: Vector3; fov: number; shot: number };

/** Evaluates the camera pose for a scroll progress in [0, 1]. */
export function evaluateCamera(progress: number, out: CameraPose): CameraPose {
  const index = shotIndexAt(progress);
  const local = Math.min(1, Math.max(0, progress * SHOT_COUNT - index));
  const t = easeInOutSine(local);
  const shot = SHOTS[index];
  out.position.lerpVectors(shot.from.position, shot.to.position, t);
  out.look.lerpVectors(shot.from.look, shot.to.look, t);
  out.position.x += CAR_POSITION.x;
  out.look.x += CAR_POSITION.x;
  out.fov = shot.from.fov + (shot.to.fov - shot.from.fov) * t;
  out.shot = index;
  return out;
}
