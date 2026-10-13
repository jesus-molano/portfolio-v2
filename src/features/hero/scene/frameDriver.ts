import { advance, flushGlobalEffects, type RootState } from "@react-three/fiber";
import { isLoadHolding } from "@/features/load/loadHold";
import { addFrameTick } from "@/lib/frameTicker";
import { getSceneLoading } from "../sceneLoading";
import {
  PACING,
  frameIntervalMs,
  paceDivisor,
  rateChanged,
  rateTrusted,
  refreshFromIdle,
  renderThisTick,
  stepRootClock,
  vsyncMs,
  type RootClock,
} from "./framePacing";
import { newMonitor, quietMonitor, stepMonitor, type Monitor } from "./qualityMonitor";
import { canStepDown, commitIfDue, qualityRuntime, reportRefresh, requestDecline } from "./qualityStore";

/**
 * The one frame loop of both canvases. Each runs R3F's `frameloop="never"`
 * for good (PacedRoot.tsx registers it here) and draws in the render phase
 * of the page's frame (lib/frameTicker.ts): after Lenis and the stages'
 * ticks, in the same animation frame, so the picture, the cards and the
 * covers of a frame are always the same frame's. R3F's own loop ran on a
 * requestAnimationFrame of its own, and every change between drawing and
 * resting went through React (a re-render of the canvas, a new
 * `frameloop`), which also started R3F's clock again from zero: the
 * clouds, the water and the palms jumped back at every one.
 *
 * Every frame, each canvas says whether it wants to draw (`wants`: the
 * hero's heroFrameloop, the night on screen and not covered); one that
 * wants draws at the pace (framePacing.ts: every refresh, or every second
 * one at half rate), one that rests draws only the frames asked of it
 * (`requestFrames`, R3F's `invalidate`, which does nothing under "never").
 * Its own clock runs only while it draws (`stepRootClock`). Under reduced
 * motion the hero is not driven: R3F's "demand" draws its still frames.
 *
 * Production only, it watches the frames each canvas draws at its pace
 * (qualityMonitor.ts) against the interval it should keep (the display's
 * refresh, measured here from the frames in which no canvas drew, times the
 * pace) and asks the visit's quality level to step down when it falls
 * behind (qualityStore.ts), once the display's rate is known to hold: read
 * lately, or checked first (framePacing.ts `rateTrusted`, `stepDown`).
 */

type GetState = () => RootState;

export type PacedRootSpec = {
  /** Names the canvas (`hero`, `night`). */
  id: string;
  /** The root's own state (R3F's `get`). */
  get: GetState;
  /** Whether the canvas draws every frame now, read once a frame after the stages' ticks (`now`: the frame's timestamp). */
  wants: (now: number) => boolean;
  /** Frames asked of it while it rests wait while this holds (the hero's: until its warm-up is done). */
  holds?: (state: RootState) => boolean;
  /** It wants to draw again after a rest (the night's car lands on the picture). */
  onWake?: () => void;
};

type Root = PacedRootSpec & {
  /** Frames asked for and not drawn yet. */
  pending: number;
  /** A hidden frame asked for (`warmFrame`). */
  warm: boolean;
  /** It wanted to draw in the last frame. */
  wanted: boolean;
  clock: RootClock;
  /** When it last drew at its pace (null after a rest). */
  pacedAt: number | null;
  /** The pace it last drew at: a change starts the monitor again. */
  divisor: number;
  monitor: Monitor;
  /** qualityRuntime.changedAt as the monitor last saw it. */
  levelAt: number;
  /** What its canvas element carries, written only on change. */
  marks: { canvas: HTMLCanvasElement | null; quality: number; pace: number };
  /** A drawing of it is queued for before the page paints (`redrawSoon`). */
  redrawQueued: boolean;
};

/** Production only: a development build's frame rate says nothing about the device, and its level holds. */
const WATCH = process.env.NODE_ENV === "production";

/** The first frames after the start menu are no measure: the film's first shot is settling in. */
const AFTER_ENTRY_MS = 2000;

/** The first second after a canvas wakes, its level lands or its pace changes is left out: uploads, reallocated targets. */
const AFTER_WAKE_MS = 1000;

/** Frames that may be asked of a canvas ahead, as R3F's `invalidate` allows. */
const MAX_PENDING = 60;

/** Intervals of idle frames kept for the display's rate, and how many new ones before it is read again. */
const IDLE_KEEP = 120;
const IDLE_READ_EVERY = 30;

let roots: readonly Root[] = [];
let stopTicking: (() => void) | null = null;
/** Frames asked of a canvas whose PacedRoot has not registered yet (a layout effect earlier in the same commit). */
const early = new WeakMap<GetState, number>();

const idleDeltas = new Float64Array(IDLE_KEEP);
const idleScratch = new Float64Array(IDLE_KEEP);
let idleCount = 0;
let idleNext = 0;
let idleSinceRead = 0;
let lastStamp = Number.NaN;
/** Whether a canvas drew in the last frame: only the interval after one that did not is a refresh. */
let drewLast = true;
/** When the display's rate was last read from idle frames (null: never). */
let rateReadAt: number | null = null;

/**
 * A check of the display's rate before a step down (`stepDown`), while it
 * runs: its frames so far, and the rate the late frames were judged by.
 */
let check: { frames: number; assumedHz: number | null } | null = null;

/** The pace forced from the console (`window.__vaPace`, development only). */
let forcedDivisor: number | null = null;

/** True while a hidden frame draws (`warmFrame`). */
let warming = false;
/** True while the render phase runs. */
let framing = false;
/** True while a canvas is drawn again between frames (`redrawSoon`). */
let redrawing = false;

function find(get: GetState): Root | undefined {
  for (const root of roots) if (root.get === get) return root;
  return undefined;
}

/** Adds a canvas to the frame; returns its removal (PacedRoot's layout effect). */
export function registerRoot(spec: PacedRootSpec): () => void {
  const root: Root = {
    ...spec,
    pending: early.get(spec.get) ?? 0,
    warm: false,
    wanted: false,
    clock: { lastAt: null },
    pacedAt: null,
    divisor: 1,
    monitor: newMonitor(),
    levelAt: qualityRuntime.changedAt,
    marks: { canvas: null, quality: -1, pace: -1 },
    redrawQueued: false,
  };
  early.delete(spec.get);
  roots = [...roots, root];
  stopTicking ??= addFrameTick("render", renderFrame);
  if (process.env.NODE_ENV !== "production") installDevHook();
  return () => {
    roots = roots.filter((r) => r !== root);
    if (roots.length > 0 || !stopTicking) return;
    stopTicking();
    stopTicking = null;
    lastStamp = Number.NaN;
    drewLast = true;
    check = null;
  };
}

/**
 * Asks a canvas for frames, as R3F's `invalidate` does (one more frame; a
 * count adds up, to 60): a step of the load, a board repainted, a resize.
 * A canvas the driver does not draw (reduced motion: "demand") is asked
 * through R3F itself.
 */
export function requestFrames(get: GetState, frames = 1): void {
  const root = find(get);
  if (root) {
    root.pending = frames > 1 ? Math.min(MAX_PENDING, root.pending + frames) : Math.max(root.pending, 1);
    return;
  }
  const state = get();
  if (state.frameloop !== "never") {
    state.invalidate(frames);
    return;
  }
  const asked = early.get(get) ?? 0;
  early.set(get, frames > 1 ? Math.min(MAX_PENDING, asked + frames) : Math.max(asked, 1));
}

/**
 * A new size or pixel ratio has just cleared a canvas's buffer: a canvas
 * that is drawing is drawn again before the page paints, its clock still
 * (delta 0: the same picture, at the new size), when a quality level
 * landed since its frame began. A level lands in the stages' tick (a cut)
 * or after the canvases drew (`commitIfDue`), and React applies the
 * Canvas's new `dpr` in a microtask right after the frame, once the canvas
 * had drawn at the old size: the cleared buffer, black, reached the screen
 * for a frame, at the very cut that was to hide the change. A window's
 * resize lands in a task of its own, and the next frame draws before the
 * page paints. Queued as a microtask itself, so it draws once the commit
 * that resized the canvas is done (its size and ratio both), never inside
 * the render phase nor from a redraw's own frame. A canvas at rest is out
 * of sight: its next frame is asked for (`requestFrames`).
 */
export function redrawSoon(get: GetState): void {
  if (!(qualityRuntime.changedAt >= lastStamp)) return;
  const root = find(get);
  if (!root || root.redrawQueued || redrawing) return;
  root.redrawQueued = true;
  queueMicrotask(() => {
    root.redrawQueued = false;
    redraw(root);
  });
}

function redraw(root: Root) {
  if (framing || redrawing || !root.wanted || !roots.includes(root)) return;
  const state = root.get();
  if (!state.internal.active) return;
  redrawing = true;
  try {
    advance(state.clock.elapsedTime, false, state);
  } finally {
    redrawing = false;
  }
  // The next frame comes after a canvas drew: its interval measures the GPU, not the display.
  drewLast = true;
}

/**
 * Asks a canvas at rest for one hidden frame: drawn under its cover to
 * compile what the composer draws, its clock still, and no frame of the
 * picture (`isWarmFrame`: the night's ReadyReporter and the stage's
 * `night.frames` leave it out, and so does the monitor). A canvas that
 * draws anyway needs none.
 */
export function warmFrame(get: GetState): void {
  const root = find(get);
  if (root) root.warm = true;
}

/** Whether the frame drawing now is a hidden one (`warmFrame`). */
export function isWarmFrame(): boolean {
  return warming;
}

function wake(root: Root, now: number) {
  root.clock.lastAt = null;
  root.pacedAt = null;
  quietMonitor(root.monitor, now + AFTER_WAKE_MS);
  root.onWake?.();
}

/**
 * One more interval of a frame in which no canvas drew; now and then the
 * display's rate is read again from them, and at once from a few while a
 * check of it runs.
 */
function sampleIdle(delta: number, now: number) {
  idleDeltas[idleNext] = delta;
  idleNext = (idleNext + 1) % IDLE_KEEP;
  if (idleCount < IDLE_KEEP) idleCount += 1;
  idleSinceRead += 1;
  const needed = check ? PACING.checkSamples : IDLE_READ_EVERY;
  if (idleSinceRead < needed) return;
  idleSinceRead = 0;
  const kept = idleCount < IDLE_KEEP ? idleDeltas.subarray(0, idleCount) : idleDeltas;
  const hz = refreshFromIdle(kept, idleScratch, check ? PACING.checkSamples : PACING.samples);
  if (hz === null) return;
  rateReadAt = now;
  const known = qualityRuntime.refreshHz;
  if (known === null || Math.abs(hz - known) > known * PACING.rateChange) reportRefresh(hz);
  if (check) endCheck(now, hz);
}

/**
 * A canvas fell behind: one step down, once the display's rate its frames
 * were judged by is known to hold. A rate read lately (idle frames come
 * behind the start menu, at rest, at half rate) is trusted. Otherwise every
 * frame drew since, and the rate may have changed under them (another
 * display, a panel dropped to 60 Hz on battery, a power mode holding the
 * page at 30 frames a second, all of them late against the old rate): the
 * canvases draw on every second frame for a moment, the frames between
 * read the rate again, and `endCheck` decides.
 */
function stepDown(now: number) {
  // Nothing left to give up (the bottom of the ladder, or nothing below changes her screen): nothing to check.
  if (check || !canStepDown(qualityRuntime.refreshHz)) return;
  if (rateTrusted(rateReadAt, now)) {
    requestDecline(qualityRuntime.refreshHz, now);
    return;
  }
  check = { frames: 0, assumedHz: qualityRuntime.refreshHz };
  // Read from the intervals to come only: the ones kept may be another display's.
  idleCount = 0;
  idleNext = 0;
  idleSinceRead = 0;
}

/**
 * The check is over. A new rate is taken instead of a step (`sampleIdle`
 * has reported it): the frames were late only against the old one, and
 * nothing the ladder gives up would have helped. The same rate, or none
 * read in the check's frames (a canvas that slow), steps down.
 */
function endCheck(now: number, hz: number | null) {
  const assumed = check?.assumedHz ?? null;
  check = null;
  if (hz !== null && rateChanged(assumed, hz)) return;
  requestDecline(qualityRuntime.refreshHz, now);
}

/** Writes the canvas's level and pace on its element, for tools/capture/perf.mjs; only what changed. */
function mark(root: Root, state: RootState, divisor: number) {
  const canvas = state.gl.domElement;
  const marks = root.marks;
  if (marks.canvas !== canvas) {
    marks.canvas = canvas;
    marks.quality = -1;
    marks.pace = -1;
  }
  if (marks.quality !== qualityRuntime.level) {
    marks.quality = qualityRuntime.level;
    canvas.setAttribute("data-quality", String(marks.quality));
  }
  if (marks.pace !== divisor) {
    marks.pace = divisor;
    canvas.setAttribute("data-pace", String(divisor));
  }
}

/** Counts one frame drawn at its pace; a canvas that falls behind steps the visit's level down. */
function watch(root: Root, now: number, intervalMs: number, expectedMs: number, divisor: number) {
  if (!WATCH) return;
  const m = root.monitor;
  if (qualityRuntime.changedAt !== root.levelAt || divisor !== root.divisor) {
    root.levelAt = qualityRuntime.changedAt;
    root.divisor = divisor;
    quietMonitor(m, now + AFTER_WAKE_MS);
  }
  const loading = getSceneLoading();
  const skip =
    !loading.entered ||
    now - loading.enteredAt < AFTER_ENTRY_MS ||
    isLoadHolding() ||
    document.visibilityState !== "visible";
  if (stepMonitor(m, { now, intervalMs, expectedMs, skip })) stepDown(now);
}

/** The render phase of the page's frame: every canvas that wants to, or was asked to, draws. */
function renderFrame(_time: number, _deltaMs: number, stamp: number) {
  framing = true;
  try {
    drawFrame(stamp);
  } finally {
    framing = false;
  }
}

function drawFrame(stamp: number) {
  const delta = stamp - lastStamp;
  if (!drewLast && delta > 0) sampleIdle(delta, stamp);
  lastStamp = stamp;
  // A check that read nothing in its frames gives up and steps down: the canvas is that slow.
  if (check && ++check.frames > PACING.checkFrames) endCheck(stamp, null);

  const hz = qualityRuntime.refreshHz;
  // While the rate is checked the canvases skip every second frame by count, not by the rate it doubts.
  const checking = check !== null && forcedDivisor === null;
  const divisor = forcedDivisor ?? (checking ? PACING.checkDivisor : paceDivisor(hz, qualityRuntime.halfRate));
  const refresh = vsyncMs(hz);
  const list = roots;
  let drew = false;
  let failed = false;
  let failure: unknown;

  for (const root of list) {
    const state = root.get();
    // Not set up yet, or being torn down.
    if (!state.internal.active) continue;
    mark(root, state, divisor);
    const wants = root.wants(stamp);
    if (wants && !root.wanted) wake(root, stamp);
    root.wanted = wants;

    const onPace = checking
      ? (check?.frames ?? 0) % PACING.checkDivisor === 0
      : renderThisTick(stamp, root.pacedAt, divisor, refresh);
    const paced = wants && onPace;
    const asked = !wants && root.pending > 0 && !(root.holds?.(state) ?? false);
    // A canvas that draws anyway compiles what a hidden frame would.
    if (wants) root.warm = false;
    const hidden = !wants && !asked && root.warm;
    if (!paced && !asked && !hidden) {
      // At rest its clock stops: the next frame it draws starts from where this one left the scene.
      if (!wants) root.clock.lastAt = null;
      continue;
    }

    if (!drew) {
      drew = true;
      flushGlobalEffects("before", stamp);
    }
    try {
      if (hidden) {
        root.warm = false;
        warming = true;
        advance(state.clock.elapsedTime, false, state);
      } else {
        root.warm = false;
        // Before it draws: a frame asked for during this one is the next one's.
        if (root.pending > 0) root.pending -= 1;
        const interval = root.pacedAt === null ? Number.NaN : stamp - root.pacedAt;
        // Always with the root's own state: without it, R3F's advance draws every canvas.
        advance(state.clock.elapsedTime + stepRootClock(root.clock, stamp), false, state);
        if (paced) {
          root.pacedAt = stamp;
          watch(root, stamp, interval, frameIntervalMs(hz, divisor), divisor);
        }
      }
    } catch (error) {
      // The other canvas still draws, and the frame still ends; the error is thrown after, as R3F's loop would.
      if (!failed) {
        failed = true;
        failure = error;
      }
    } finally {
      warming = false;
    }
  }

  if (drew) {
    // Once a frame, as R3F's own loop ran them: the dev probes read the pixels after it (DevHandle).
    flushGlobalEffects("after", stamp);
    commitIfDue(stamp);
  }
  drewLast = drew;
  if (failed) throw failure;
}

type PaceSnapshot = { refreshHz: number | null; halfRate: boolean; divisor: number; forced: number | null };
type DevWindow = Window & { __vaPace?: (divisor?: number | null) => PaceSnapshot };

let hookInstalled = false;

/**
 * Development only: `window.__vaPace(2)` draws the canvases on every second
 * refresh whatever the display, `__vaPace(null)` gives the pace back to the
 * quality level; with no argument it only reads it.
 */
function installDevHook() {
  if (hookInstalled || typeof window === "undefined") return;
  hookInstalled = true;
  (window as DevWindow).__vaPace = (divisor?: number | null) => {
    if (divisor === null) forcedDivisor = null;
    else if (typeof divisor === "number" && Number.isFinite(divisor)) forcedDivisor = Math.max(1, Math.round(divisor));
    const hz = qualityRuntime.refreshHz;
    return {
      refreshHz: hz,
      halfRate: qualityRuntime.halfRate,
      divisor: forcedDivisor ?? paceDivisor(hz, qualityRuntime.halfRate),
      forced: forcedDivisor,
    };
  };
}
