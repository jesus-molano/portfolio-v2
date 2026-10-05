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
};

export type EnteredVia = "key" | "pointer";

const INITIAL: SceneLoading = {
  progress: 0,
  ready: false,
  entered: false,
  enteredAt: Number.NEGATIVE_INFINITY,
  enteredVia: null,
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

/** Tests only. */
export function resetSceneLoading() {
  state = INITIAL;
  listeners.forEach((listener) => listener());
}
