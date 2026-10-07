/**
 * Whether the hero's picture is under its fully opaque night (the fade at
 * the end of the drive): resting there, or on the strip of the hero left
 * over THE CREW, the canvas drew a whole frame every frame that nobody could
 * see. HeroStage writes it from the fade it draws; HeroCanvas reads it with
 * useSyncExternalStore, so only a flip re-renders the canvas.
 */

/** The fade's opacity from which nothing of the picture shows (under half a level in 8 bits). */
export const COVER_OPACITY = 0.999;

/** Whether a fade of this opacity hides the picture. */
export function isCovered(nightOpacity: number): boolean {
  return nightOpacity >= COVER_OPACITY;
}

let covered = false;
const listeners = new Set<() => void>();

export function getHeroCovered(): boolean {
  return covered;
}

export function getServerHeroCovered(): boolean {
  return false;
}

export function setHeroCovered(next: boolean) {
  if (covered === next) return;
  covered = next;
  listeners.forEach((listener) => listener());
}

export function subscribeHeroCovered(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
