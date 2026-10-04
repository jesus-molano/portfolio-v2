import { Vector3 } from "three";

/** Shared world layout so every scene part agrees on where things are. */
export const world = {
  /** Centred at the end of the avenue, low: a third of it below the horizon. */
  sun: { position: new Vector3(0, 14, -330), size: 130 },
  /** Sky dome radius; it follows the camera and stays inside the far plane. */
  sky: { radius: 1200 },
  skyline: { zNear: -190, zFar: -290, halfWidth: 260 },
  ground: { size: 1100, center: new Vector3(0, 0, -200) },
  /** The causeway: long enough to reach the skyline from the car. */
  road: { width: 16, zStart: 90, zEnd: -280, y: 0.1 },
  fog: { near: 50, far: 340 },
  camera: { fov: 50 },
} as const;

/** Deterministic pseudo-random generator (mulberry32) for stable layouts. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
