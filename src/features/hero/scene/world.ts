import { Vector3 } from "three";

/** Shared world layout so every scene part agrees on where things are. */
export const world = {
  /**
   * Ahead and left of the drive, out of the avenue's slot, about 9 degrees
   * up: low enough for golden hour, high enough that its lower part sinks
   * behind the tower tops while most of the disc clears them in the rear
   * chase and at the end of the crane (sunFraming.test.ts). Lower than
   * that, the skyline hides it from every camera. Everything that lights
   * or mirrors the sun reads this position.
   */
  sun: { position: new Vector3(-50, 55, -330), size: 64 },
  /** Sky dome radius; it follows the camera and stays inside the far plane. */
  sky: { radius: 1200 },
  /** Towers start behind the waterfront hotel row (backs no deeper than z -193). */
  skyline: { zNear: -201, zFar: -297, halfWidth: 260 },
  ground: { size: 1100, center: new Vector3(0, 0, -200) },
  /**
   * The causeway, then the avenue: long enough to run past the back of the
   * roadside stream (drive.ts ROADSIDE) behind the car, and up the street
   * canyon to the plaza at the landmark's foot (AVENUE.zTo in cityLayout.ts).
   */
  road: { width: 16, zStart: 150, zEnd: -282, y: 0.1 },
  /**
   * Aerial perspective in three layers: near props clear, the hotel row
   * (about 200 m) half in the haze, the far towers (300 m and beyond) mostly
   * haze. Starting later than before keeps the skyline's windows readable.
   */
  fog: { near: 60, far: 400 },
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
