/**
 * One frame of the page, in order, in one animation frame of its own:
 * Lenis (`"scroll"`: SmoothScroll's `lenis.raf` and the pedal's push),
 * then the stages' ticks (`"stage"`: HeroStage, the character select and
 * WorkStage read the page and write the picture, the covers and the DOM),
 * then the canvases (`"render"`: the frame driver,
 * `hero/scene/frameDriver.ts`). The canvases used to run R3F's own
 * requestAnimationFrame loop beside the page's, in whichever order the
 * browser called the two: a canvas could draw the last frame's picture
 * under this frame's cards, and a flip of a cover reached the canvas only
 * once React had rendered it, a frame or more later.
 *
 * The frame used to be a tick of GSAP's ticker, which dispatches at most
 * 240 times a second, timed on Date.now's whole milliseconds: on a 300 Hz
 * display it skipped every fifth refresh, near 240 Hz one now and then, so
 * the canvases drew unevenly and their quality monitor took the gaps for a
 * GPU falling behind. GSAP's ticker runs only GSAP's tweens now (the
 * title's reveal), asleep between them.
 */
export type FramePhase = "scroll" | "stage" | "render";

/**
 * A tick: the frame's time in seconds and the ms since the frame before (0
 * on the first after the frames start), both from the animation frame's
 * own timestamp (performance.now()'s clock, the same for every tick of the
 * frame, stepping by whole refreshes), which is the third argument, in ms.
 */
export type FrameTick = (time: number, deltaMs: number, stamp: number) => void;

/** What the frame needs of the browser's animation frames (a fake in the tests). */
export type FrameScheduler = {
  request(callback: (stamp: number) => void): number;
  cancel(handle: number): void;
};

const PHASES: readonly FramePhase[] = ["scroll", "stage", "render"];

/** The browser's own, asked for only once a tick is added: never on the server. */
const animationFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

/** The animation frame's timestamp, or the page's clock when it gives none (a polyfill, a fake). */
export function frameStamp(raw: unknown, now: () => number = () => performance.now()): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : now();
}

/** Runs every scroll tick, then every stage tick, then every render tick, once an animation frame, while any is added. */
export function createFrameTicker(frames: FrameScheduler = animationFrames) {
  const phases: Record<FramePhase, Set<FrameTick>> = { scroll: new Set(), stage: new Set(), render: new Set() };
  let running = false;
  let handle = 0;
  let lastStamp = Number.NaN;

  const run = (raw: number) => {
    // Asked for before any tick runs: one that throws, or takes long, never stops the frames.
    handle = frames.request(run);
    const stamp = frameStamp(raw);
    const deltaMs = stamp > lastStamp ? stamp - lastStamp : 0;
    lastStamp = stamp;
    const time = stamp / 1000;
    // One tick that throws leaves the others their frame (the canvases still draw); its error is thrown after.
    let failed = false;
    let failure: unknown;
    for (const phase of PHASES) {
      // A tick removed while the frame runs (a stage torn down by another's tick) is not called again.
      for (const tick of phases[phase]) {
        try {
          tick(time, deltaMs, stamp);
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
      }
    }
    if (failed) throw failure;
  };

  const sync = () => {
    const wanted = phases.scroll.size + phases.stage.size + phases.render.size > 0;
    if (wanted === running) return;
    running = wanted;
    if (wanted) {
      handle = frames.request(run);
      return;
    }
    frames.cancel(handle);
    lastStamp = Number.NaN;
  };

  /** Adds a tick to a phase of the frame; returns its removal. */
  function addFrameTick(phase: FramePhase, tick: FrameTick): () => void {
    phases[phase].add(tick);
    sync();
    return () => {
      phases[phase].delete(tick);
      sync();
    };
  }

  return { addFrameTick };
}

const shared = createFrameTicker();

/** Adds a tick to the page's frame (Lenis, then the stages, then the canvases); returns its removal. */
export const addFrameTick = shared.addFrameTick;
