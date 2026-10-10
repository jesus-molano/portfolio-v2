/**
 * Loading state shared by the 3D scene and the DOM loading screen, without
 * importing three.js into the page bundle. The scene reports progress and
 * readiness from inside the Canvas; the loading screen subscribes with
 * useSyncExternalStore; the hero title starts its intro once the visitor
 * has entered.
 */
export type SceneLoading = {
  /** 0 to 100, from the asset loaders. */
  progress: number;
  /** Every asset loaded and the first frames rendered (or the scene failed). */
  ready: boolean;
  /** The visitor dismissed the loading screen. */
  entered: boolean;
  /** performance.now() when she entered; -Infinity before. */
  enteredAt: number;
  /** How she entered: a key press or a pointer (click or tap). */
  enteredVia: EnteredVia | null;
  /**
   * She has watched the intro's first line (or skipped it, or the intro is
   * a still) and is at rest: a quiet moment for side hints, like the radio's.
   */
  settled: boolean;
  /**
   * Nothing in the hero asks her for anything right now: a line plays, she
   * drives, or the hero is a still or behind her. Side hints show only
   * then, never next to a prompt (HeroStage writes it when it changes).
   */
  quiet: boolean;
  /**
   * The hero is up behind the side hints under the page controls (it runs
   * down past their bottom edge): they belong to it. Past the hero, even
   * with a strip of its night still at the top, they would cover the next
   * section's chapter card.
   */
  onScreen: boolean;
  /**
   * The hero is on stage, by its own film: the film not over yet (p < 1),
   * or the still hero's script still filling most of the screen. At the
   * end of the drive the way on is the line-up, and Skip lands there:
   * side hints keep off it even while the hero's last frame is still
   * behind the page controls. Hints that hang over the page, like the
   * radio's callout, need both this and `onScreen`.
   */
  onStage: boolean;
};

export type EnteredVia = "key" | "pointer";

/**
 * Frames the hero's canvas has drawn (LoadReporter counts every one): the
 * load screen knows the hero is drawn again at the top once a few more
 * have come since it jumped there. A plain counter, never React state.
 */
export const heroFrames = { count: 0 };

const INITIAL: SceneLoading = {
  progress: 0,
  ready: false,
  entered: false,
  enteredAt: Number.NEGATIVE_INFINITY,
  enteredVia: null,
  settled: false,
  quiet: true,
  onScreen: true,
  onStage: true,
};

let state: SceneLoading = INITIAL;
const listeners = new Set<() => void>();

function update(next: Partial<SceneLoading>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function getSceneLoading(): SceneLoading {
  return state;
}

/** Server render and hydration: nothing has loaded yet. */
export function getServerSceneLoading(): SceneLoading {
  return INITIAL;
}

export function subscribeSceneLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Progress only moves forward and stops once the scene is ready. */
export function reportSceneProgress(progress: number) {
  const value = Math.min(100, Math.max(0, Math.round(progress)));
  if (state.ready || value <= state.progress) return;
  update({ progress: value });
}

export function markSceneReady() {
  if (!state.ready) update({ ready: true, progress: 100 });
}

/**
 * The visitor left the loading screen, by key or by pointer. The hero uses
 * the time to ignore the key press that entered and the way in to pick the
 * first hint (scroll, swipe or Space).
 */
export function markEntered(via: EnteredVia = "pointer", now: number = performance.now()) {
  if (!state.entered) update({ entered: true, enteredAt: now, enteredVia: via });
}

/** The hero reached a quiet moment after its first line (see `settled`). Once. */
export function markSettled() {
  if (state.entered && !state.settled) update({ settled: true });
}

/** Whether the hero asks her for nothing right now (see `quiet`). */
export function markQuiet(quiet: boolean) {
  if (state.quiet !== quiet) update({ quiet });
}

/** Whether the hero is up behind the side hints (see `onScreen`). */
export function markOnScreen(onScreen: boolean) {
  if (state.onScreen !== onScreen) update({ onScreen });
}

/** Whether the hero is on stage, by its own film (see `onStage`). */
export function markOnStage(onStage: boolean) {
  if (state.onStage !== onStage) update({ onStage });
}

/** Tests only. */
export function resetSceneLoading() {
  state = INITIAL;
  listeners.forEach((listener) => listener());
}
