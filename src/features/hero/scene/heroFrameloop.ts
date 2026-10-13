/**
 * When the hero's canvas draws every frame. Behind the start menu nobody
 * sees it (the menu is opaque and the page under it hidden), yet a canvas
 * on `frameloop="always"` drew the whole scene, post-processing and all,
 * for as long as she read the tips: the phone heated before the film began.
 *
 * While the scene loads it draws only when asked: LoadReporter asks at each
 * step of the load and for the frames that make the scene ready, the
 * warm-up when it is done, and a part that changes asks for itself (a
 * board's copy painted once its font is in, the aviators put on). Drawn
 * every frame, the load ran the whole post chain at the display's rate,
 * 144 or 165 times a second on a fast monitor, against the models' parsing
 * and the shaders' compiling, and the start menu over it stuttered. Once
 * the scene is ready it draws every frame for a short grace (late uploads
 * land before the menu goes, not in her first frame), and from the moment
 * she enters. Otherwise it renders on demand: nothing, until she enters.
 * Out of view (or under opaque night, `active` false) and under reduced
 * motion it is on demand as before.
 *
 * The frame driver (frameDriver.ts) reads it every frame (HeroScene's
 * `heroWants`): "always" draws at the pace, "demand" only the frames asked
 * for, those asked before the warm-up is done once it is. Under reduced
 * motion the canvas is not driven: R3F's own "demand" draws it.
 */
export type HeroFrameloopInput = {
  /** Motion allowed (not reduced motion). */
  animate: boolean;
  /** The hero is in view and not under opaque night. */
  active: boolean;
  /** Every asset loaded, the scene warm and the first frames rendered. */
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
  if (entered) return "always";
  return ready && sinceReadyMs < READY_GRACE_MS ? "always" : "demand";
}
