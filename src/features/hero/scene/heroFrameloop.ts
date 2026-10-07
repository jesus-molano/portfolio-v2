/**
 * When the hero's canvas draws every frame. Behind the start menu nobody
 * sees it (the menu is opaque and the page under it hidden), yet a canvas
 * on `frameloop="always"` drew the whole scene, post-processing and all,
 * for as long as she read the tips: the phone heated before the film began.
 *
 * It runs while the scene loads (the loading screen waits for its first
 * frames), for a short grace once it is ready (late uploads, a texture
 * painted once the fonts are in, land before the menu goes, not in her
 * first frame), and from the moment she enters. Otherwise it renders on
 * demand: nothing, until she enters. Out of view (or under opaque night,
 * `active` false) and under reduced motion it is on demand as before.
 */
export type HeroFrameloopInput = {
  /** Motion allowed (not reduced motion). */
  animate: boolean;
  /** The hero is in view and not under opaque night. */
  active: boolean;
  /** Every asset loaded and the first frames rendered. */
  ready: boolean;
  /** She has left the start menu. */
  entered: boolean;
  /** Milliseconds since the scene became ready (Infinity once the grace is over). */
  sinceReadyMs: number;
};

/** How long the canvas keeps drawing behind the menu once the scene is ready. */
export const READY_GRACE_MS = 3000;

export function heroFrameloop({ animate, active, ready, entered, sinceReadyMs }: HeroFrameloopInput): "always" | "demand" {
  if (!animate || !active) return "demand";
  if (!ready || entered) return "always";
  return sinceReadyMs < READY_GRACE_MS ? "always" : "demand";
}
