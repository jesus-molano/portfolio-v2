import gsap from "gsap";

/**
 * One frame of the page, in order, in one animation frame: SmoothScroll's
 * listener runs first on GSAP's ticker (`lenis.raf`, the pedal's push),
 * then this one, which runs the stages' ticks (`"stage"`: HeroStage and
 * WorkStage read the page and write the picture, the covers and the DOM)
 * and then the canvases (`"render"`: the frame driver,
 * `hero/scene/frameDriver.ts`). The canvases used to run R3F's own
 * requestAnimationFrame loop beside GSAP's, in whichever order the browser
 * called the two: a canvas could draw the last frame's picture under this
 * frame's cards, and a flip of a cover reached the canvas only once React
 * had rendered it, a frame or more later.
 */
export type FramePhase = "stage" | "render";

/**
 * A tick: GSAP's time (seconds) and delta (ms), as its ticker gives them,
 * and the animation frame's own timestamp (performance.now()'s clock, the
 * same for every tick of the frame), which steps by whole refreshes.
 */
export type FrameTick = (time: number, deltaMs: number, stamp: number) => void;

type TickerCallback = (time: number, deltaMs: number, frame: number, stamp: number) => void;

/** What the frame needs of GSAP's ticker (a fake in the tests). */
export type Ticker = {
  add(callback: TickerCallback): unknown;
  remove(callback: TickerCallback): void;
};

/**
 * The animation frame's timestamp from what GSAP's ticker passes on: the
 * browser's own in an animation frame, 2 as the ticker wakes and `true` on
 * a manual tick, neither of them a time, so the page's clock then.
 */
export function frameStamp(raw: unknown, now: () => number = () => performance.now()): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 2 ? raw : now();
}

/** One listener on `ticker` while any tick is added, running every stage tick, then every render tick. */
export function createFrameTicker(ticker: Ticker) {
  const phases: Record<FramePhase, Set<FrameTick>> = { stage: new Set(), render: new Set() };
  let attached = false;

  const run: TickerCallback = (time, deltaMs, _frame, raw) => {
    const stamp = frameStamp(raw);
    // A tick removed while the frame runs (a stage torn down by another's tick) is not called again.
    for (const tick of phases.stage) tick(time, deltaMs, stamp);
    for (const tick of phases.render) tick(time, deltaMs, stamp);
  };

  const sync = () => {
    const wanted = phases.stage.size + phases.render.size > 0;
    if (wanted === attached) return;
    attached = wanted;
    if (wanted) ticker.add(run);
    else ticker.remove(run);
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

const shared = createFrameTicker(gsap.ticker);

/** Adds a tick to the page's frame (stages first, then the canvases); returns its removal. */
export const addFrameTick = shared.addFrameTick;
