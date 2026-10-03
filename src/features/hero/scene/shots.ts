import { Vector3 } from "three";
import { CAR_POSITION } from "./drive";

/**
 * The hero is a four-shot sequence cut on scroll, like a mission intro.
 * Offsets are relative to the car. `look` is where the camera aims.
 */
export type Shot = {
  id: "rear" | "tracking" | "low" | "crane";
  from: { position: Vector3; look: Vector3; fov: number };
  to: { position: Vector3; look: Vector3; fov: number };
};

export const SHOTS: Shot[] = [
  {
    id: "rear",
    from: { position: new Vector3(2.6, 1.7, 9.5), look: new Vector3(-0.4, 0.9, -12), fov: 50 },
    to: { position: new Vector3(1.9, 2.2, 7.6), look: new Vector3(-0.3, 1.0, -16), fov: 48 },
  },
  {
    id: "tracking",
    from: { position: new Vector3(-6.4, 1.0, 2.6), look: new Vector3(0, 0.9, -0.4), fov: 46 },
    to: { position: new Vector3(-5.6, 1.4, -1.6), look: new Vector3(0, 0.9, -1.4), fov: 44 },
  },
  {
    id: "low",
    from: { position: new Vector3(2.2, 0.34, 2.9), look: new Vector3(0.2, 1.5, -5), fov: 68 },
    to: { position: new Vector3(1.7, 0.55, 2.3), look: new Vector3(-0.3, 2.4, -8), fov: 64 },
  },
  {
    id: "crane",
    from: { position: new Vector3(-2.6, 2.2, 6.8), look: new Vector3(0, 1.0, -10), fov: 50 },
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
