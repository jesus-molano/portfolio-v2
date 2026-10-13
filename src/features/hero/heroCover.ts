/**
 * Whether the hero's picture can be seen, for its canvas's frame loop
 * (the frame driver reads both flags every frame, HeroScene's `heroWants`;
 * a flip re-renders nothing):
 * - covered: under its fully opaque night (the fade at the end of the
 *   drive). Resting there, or on the strip of the hero left over THE CREW,
 *   the canvas drew a whole frame every frame that nobody could see.
 *   HeroStage writes it from the fade it draws, in the same frame the
 *   canvas reads it.
 * - in view: HeroCanvas's IntersectionObserver writes it (an edge that only
 *   touches the viewport, where Skip leaves the hero, does not count:
 *   lib/onScreen.ts).
 */

/** The fade's opacity from which nothing of the picture shows (under half a level in 8 bits). */
export const COVER_OPACITY = 0.999;

/** Whether a fade of this opacity hides the picture. */
export function isCovered(nightOpacity: number): boolean {
  return nightOpacity >= COVER_OPACITY;
}

let covered = false;
let inView = true;

export function getHeroCovered(): boolean {
  return covered;
}

export function setHeroCovered(next: boolean) {
  covered = next;
}

export function getHeroInView(): boolean {
  return inView;
}

export function setHeroInView(next: boolean) {
  inView = next;
}
