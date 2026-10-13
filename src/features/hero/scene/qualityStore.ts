import {
  LEVELS,
  commitQuality,
  declineQuality,
  forceLevel,
  lockQuality,
  seedQuality,
  shouldCommit,
  startsAtHalfRate,
  type QualityState,
  type Screen,
} from "./degrade";
import { classifyRenderer, needsNanGuard, rendererString } from "./gpuHint";

/**
 * The visit's one quality level (degrade.ts), shared by the hero's canvas
 * and the night's: a level the hero stepped down to holds in the city, and
 * the other way round (each canvas had a monitor and a step of its own, and
 * the night forgot its own at every remount). No three.js here: the stages
 * mark their cuts from the page bundle.
 *
 * The hosts read it through `useSyncExternalStore` (the pixel ratio and the
 * post's structure); the frames and the post's own updates read the
 * mutable mirror, `qualityRuntime`, which allocates nothing.
 */

/** A development build stays on level 0 with the full post (degrade.ts `seedQuality`); tests set it. */
let dev = process.env.NODE_ENV !== "production";

/** Before any renderer: the top of the ladder, as on the server. */
const INITIAL: QualityState = seedQuality("top", { dev: false, nanGuard: false, refreshHz: null });

let state: QualityState = INITIAL;
let seeded = false;
/** performance.now() of the last cut or dip (markCut), or null. */
let cutAt: number | null = null;
const listeners = new Set<() => void>();
/** The screens the canvases fill now (useCanvasDpr): a step down skips the levels that change nothing on them. */
const screens = new Set<Screen>();

/** What the frames read, kept in step with the state. */
export const qualityRuntime = {
  level: INITIAL.level,
  depthOfField: LEVELS[INITIAL.level].depthOfField,
  cloudOctaves: LEVELS[INITIAL.level].cloudOctaves,
  cloudShadow: LEVELS[INITIAL.level].cloudShadow,
  halfRate: INITIAL.halfRate,
  /** The display's refresh rate once measured (reportRefresh), in Hz; null until then. */
  refreshHz: null as number | null,
  /** performance.now() of the last change of level: the monitors leave the next second out. */
  changedAt: Number.NEGATIVE_INFINITY,
};

function mirror() {
  const level = LEVELS[state.level];
  qualityRuntime.level = state.level;
  qualityRuntime.depthOfField = level.depthOfField;
  qualityRuntime.cloudOctaves = level.cloudOctaves;
  qualityRuntime.cloudShadow = level.cloudShadow;
  qualityRuntime.halfRate = state.halfRate;
}

function set(next: QualityState) {
  if (next === state) return;
  const levelChanged = next.level !== state.level;
  state = next;
  mirror();
  if (levelChanged && typeof performance !== "undefined") qualityRuntime.changedAt = performance.now();
  listeners.forEach((listener) => listener());
}

export function getQuality(): QualityState {
  return state;
}

/** Server render and hydration: the top of the ladder. */
export function getServerQuality(): QualityState {
  return INITIAL;
}

export function subscribeQuality(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type RendererLike = { getContext(): WebGLRenderingContext | WebGL2RenderingContext };

/**
 * Seeds the visit from the first renderer created (the hero's, or the
 * night's if the hero has none): where its GPU starts on the ladder and
 * whether the night keeps its NaN guard. Once per visit; a canvas built
 * again (a lost context, a new tier) keeps the level reached.
 */
export function seedFromRenderer(renderer: RendererLike, refreshHz: number | null = qualityRuntime.refreshHz) {
  if (seeded) return;
  seeded = true;
  let name: string | null = null;
  try {
    name = rendererString(renderer.getContext());
  } catch {
    name = null;
  }
  const platform = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const seed = seedQuality(classifyRenderer(name), { dev, nanGuard: needsNanGuard(name, platform), refreshHz });
  set({ ...seed, locked: state.locked });
  if (dev) installDevHook();
}

/**
 * The display's refresh rate, once something has measured it. A GPU below
 * the top on a display of 118 Hz or more goes to half rate then, as it
 * would have from the start had the rate been known.
 */
export function reportRefresh(hz: number | null) {
  qualityRuntime.refreshHz = hz;
  if (!dev && seeded && !state.halfRate && startsAtHalfRate(state.gpu, hz)) set({ ...state, halfRate: true });
}

/**
 * A monitor saw the canvas fall behind: one step down (half rate first on a
 * fast display), to the next level that changes something on the screens
 * the canvases fill (degrade.ts `nextLevel`), or none.
 */
export function requestDecline(hz: number | null, now: number) {
  set(declineQuality(state, hz, now, [...screens]));
}

/** Whether a step down would change anything now: half rate, or a level that draws a screen differently. */
export function canStepDown(hz: number | null): boolean {
  return declineQuality(state, hz, 0, [...screens]) !== state;
}

/** A canvas fills this screen (its tier and window, useCanvasDpr) until the returned removal. */
export function registerScreen(screen: Screen): () => void {
  screens.add(screen);
  return () => {
    screens.delete(screen);
  };
}

/**
 * A cut (the hero's shot change) or a dip to night (the city's): a level
 * waiting to land lands now, its new pixel ratio reallocating every target
 * where nobody sees the frame it costs.
 */
export function markCut(now: number) {
  cutAt = now;
  commitIfDue(now);
}

/** Lands a pending level under a cut since it, or `COMMIT_MS` after it anyway. Called every drawn frame. */
export function commitIfDue(now: number) {
  if (state.pending === null || !shouldCommit(state.declinedAt, cutAt, now)) return;
  set(commitQuality(state));
}

/** She has entered: the post's structure holds for the visit (sceneLoading's markEntered). */
export function lockStructure() {
  set(lockQuality(state));
}

type QualitySnapshot = Pick<QualityState, "gpu" | "start" | "level" | "halfRate" | "locked"> & {
  structure: QualityState["structure"];
};
type DevWindow = Window & { __vaQuality?: (level?: number) => QualitySnapshot };

/** Development only: `window.__vaQuality(level)` forces a level both ways, with its structure; with no level it reads the state. */
function installDevHook() {
  if (typeof window === "undefined") return;
  (window as DevWindow).__vaQuality = (level?: number) => {
    if (typeof level === "number" && Number.isFinite(level)) set(forceLevel(state, level));
    return {
      gpu: state.gpu,
      start: state.start,
      level: state.level,
      halfRate: state.halfRate,
      locked: state.locked,
      structure: { ...state.structure },
    };
  };
}

/** Tests only: back to before any renderer, as a production build (`dev: false`) or a development one. */
export function resetQuality({ dev: asDev = false }: { dev?: boolean } = {}) {
  dev = asDev;
  state = INITIAL;
  seeded = false;
  cutAt = null;
  screens.clear();
  qualityRuntime.refreshHz = null;
  qualityRuntime.changedAt = Number.NEGATIVE_INFINITY;
  mirror();
  listeners.forEach((listener) => listener());
}
