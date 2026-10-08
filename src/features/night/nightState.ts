/**
 * Shared state between the work stage (DOM, GSAP ticker) and the night
 * scene (R3F frame loop). Plain mutable objects: nothing here goes through
 * React state on a frame.
 * - The stage writes the picture (`p`), the beat it plays and how armed
 *   the active board is.
 * - The scene steps the car toward the picture (`car`, carMotion.ts) once
 *   a frame, before the camera, which pans with it.
 * - The scene writes back where the active board and the LIVE tally land
 *   on screen, so the stage can draw the hotspot, the reticle and the iris.
 */
import { type CarMotion, newCarMotion } from "./carMotion";

export type NdcQuad = [[number, number], [number, number], [number, number], [number, number]];

export const night = {
  /** The picture, 0..1 along the work stage. */
  p: 0,
  /** Index of the stop on screen (0..4). */
  stop: 0,
  /** The car, chasing the picture like a car driven smoothly (carMotion.ts): its x, lights, stop and springs. */
  car: newCarMotion() as CarMotion,
  /** A jump the camera must not glide through (a capture's or a deep link's): NightRig cuts to its pose once. */
  snap: false,
  /** The frame loop woke (the stage back on screen, NightScene): the car lands on the picture once (CarDrive). */
  woke: false,
  /** Every stop warmed up (compiled, uploaded) and nothing loading (Warmup): the opening cover may rest the canvas. */
  warm: false,
  /**
   * Frames the canvas has drawn (ReadyReporter counts them): woken under the opening cover, the canvas still
   * shows the picture it slept on until it draws again, so the stage holds the cover up until then.
   */
  frames: 0,
  /** The board's armed level: `armTarget` is 0 or 1, `armed` eases toward it. */
  armTarget: 0,
  armed: 0,
  /** Pointer across the active board, 0..1 from its left edge (NaN when away): hotspot.ts `quadUv`. */
  pointerU: Number.NaN,
  /** Pointer down the active board, 0..1 from its top edge (NaN when away). */
  pointerV: Number.NaN,
  /** Where the tap that armed the active board landed on it (u, v as above; NaN when none or disarmed). */
  tapU: Number.NaN,
  tapV: Number.NaN,
  /** The active board's corners in NDC (y up), its facing (cosine) and whether it is on screen. */
  quad: [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ] as NdcQuad,
  facing: 0,
  quadOnScreen: false,
  /** Where the LIVE tally lands on screen (NDC) and whether it is lit. */
  tally: [0, 0.5] as [number, number],
  live: false,
};

type Readiness = "waiting" | "ready" | "failed";

let readiness: Readiness = "waiting";
const listeners = new Set<() => void>();

/** The night scene has rendered its first settled frames, or it failed (no WebGL). */
export function getNightReadiness(): Readiness {
  return readiness;
}

export function setNightReadiness(next: Readiness): void {
  if (readiness === next) return;
  readiness = next;
  for (const listener of listeners) listener();
}

export function subscribeNightReadiness(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let covered = false;
const coverListeners = new Set<() => void>();

/**
 * The scene is under the stage's opaque night (nightCover.ts): WorkStage
 * writes it, NightCanvas reads it (useSyncExternalStore, so only a flip
 * re-renders) and the frame loop stops until it lifts.
 */
export function getNightCovered(): boolean {
  return covered;
}

export function setNightCovered(next: boolean): void {
  if (covered === next) return;
  covered = next;
  for (const listener of coverListeners) listener();
}

export function subscribeNightCovered(listener: () => void): () => void {
  coverListeners.add(listener);
  return () => coverListeners.delete(listener);
}
