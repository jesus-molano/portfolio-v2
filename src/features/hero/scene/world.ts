import { Vector3 } from "three";

/** Shared world layout so every scene part agrees on where things are. */
export const world = {
  sun: { position: new Vector3(0, 46, -280), size: 120 },
  sky: { position: new Vector3(0, 160, -560), width: 1500, height: 760 },
  skyline: { zNear: -150, zFar: -240, halfWidth: 240 },
  ground: { size: 1000, center: new Vector3(0, 0, -200) },
  fog: { near: 30, far: 250 },
  camera: {
    start: new Vector3(0, 7.5, 70),
    end: new Vector3(0, 2.8, -80),
    lookStart: new Vector3(0, 16, -280),
    lookEnd: new Vector3(0, 10, -280),
    fov: 52,
  },
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
