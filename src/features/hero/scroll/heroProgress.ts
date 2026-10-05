import { feedMeter, type Meter } from "./throttle";

/**
 * Shared state of the hero film. Plain mutable objects avoid React
 * re-renders on every scroll frame.
 * - `target`: where the scroll is, 0 at the top of the hero, 1 where its
 *   sticky viewport unpins. HeroStage writes it from the Lenis scroll.
 * - `value`: the picture. HeroStage clamps the scroll to the story's
 *   frontier (see story.ts); the camera rig reads it in useFrame.
 */
export const heroProgress = {
  value: 0,
  target: 0,
};

/** Progress used when motion is reduced: a still from the opening shot. */
export const STATIC_PROGRESS = 0.12;

/**
 * The page scroll's wall. HeroStage writes `maxScroll` (px) every frame
 * from the story's frontier; SmoothScroll trims wheel and touch input to
 * it. Input held beyond it is `pressure` (px), which the active card shows
 * as a bounce or a stretch. Infinity when nothing holds the scroll.
 */
export const scrollGate = {
  maxScroll: Number.POSITIVE_INFINITY,
  /** Pixels of forward input held at the wall, decaying (HeroStage). */
  pressure: 0,
  /** performance.now() of the last held input. */
  pushedAt: Number.NEGATIVE_INFINITY,
  /** A finger is on the glass (syncTouch). */
  touching: false,
  /** performance.now() of the last touchend that ended a scrolling stroke. */
  touchEndAt: Number.NEGATIVE_INFINITY,
};

export type InputSource = "wheel" | "touch" | "key";

/**
 * The visitor's last input, in performance.now() milliseconds, and how hard
 * she pushes forward (`meter`, viewport heights per second, see throttle.ts).
 */
export const scrollInput = {
  at: Number.NEGATIVE_INFINITY,
  forwardAt: Number.NEGATIVE_INFINITY,
  backwardAt: Number.NEGATIVE_INFINITY,
  source: null as InputSource | null,
  meter: { rate: 0, at: 0 } as Meter,
};

/** Written by HeroStage, read by DriveClock (pace, from the crawl to x2) and CameraRig (FOV kick, degrees). */
export const heroFeedback = { pace: 1, fovKick: 0 };

/**
 * Records one input: when, from where, which way, and, going forward, how
 * much it feeds the throttle. `deltaY` is in pixels over a viewport `vh`
 * pixels tall (keys and taps pass their step in pixels too).
 */
export function recordInput(deltaY: number, source: InputSource, nowMs: number, vh = viewportHeight()): void {
  scrollInput.at = nowMs;
  scrollInput.source = source;
  if (deltaY > 0) {
    scrollInput.forwardAt = nowMs;
    feedMeter(scrollInput.meter, deltaY / Math.max(1, vh), nowMs / 1000);
  } else if (deltaY < 0) {
    scrollInput.backwardAt = nowMs;
  }
}

/** Forgets every input: a new visit (tests and remounts). */
export function resetInput(): void {
  scrollInput.at = scrollInput.forwardAt = scrollInput.backwardAt = Number.NEGATIVE_INFINITY;
  scrollInput.source = null;
  scrollInput.meter.rate = 0;
  scrollInput.meter.at = 0;
  scrollGate.pressure = 0;
  scrollGate.pushedAt = scrollGate.touchEndAt = Number.NEGATIVE_INFINITY;
  scrollGate.touching = false;
  heroFeedback.pace = 1;
  heroFeedback.fovKick = 0;
}

function viewportHeight(): number {
  return typeof window === "undefined" ? 900 : window.innerHeight;
}
