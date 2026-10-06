import type Lenis from "lenis";
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
  /**
   * The page scroll (px) where the film ends (p = 1), written by HeroStage
   * when it measures; Infinity with no film. A finger's stroke that starts
   * past it, the walls open, is the browser's own (SmoothScroll).
   */
  heroEnd: Number.POSITIVE_INFINITY,
};

/**
 * Her input: the wheel or a trackpad, a finger, the keyboard, a mouse click
 * on the picture, or the on-screen pedal (a finger or the mouse on it; W
 * and Space press it too, but they speak as the keyboard).
 */
export type InputSource = "wheel" | "touch" | "key" | "click" | "pedal";

/**
 * The visitor's last input, in performance.now() milliseconds, and how hard
 * she pushes forward (`meter`, viewport heights per second, see throttle.ts).
 * A held pedal is input every frame (`at`, `forwardAt`: never her turn
 * while her foot is down), but only its press is an event: `eventAt` and
 * `stepAt` move with discrete input alone (a notch, a swipe, a key, a tap,
 * a press of the pedal), for what answers each event once (the strip's
 * flare, a line asked for at the title). `pedal` is her foot's demand in
 * viewport heights a second (pedal.ts pedalRate), kept off the meter: it
 * drives the strip and the world's pace, never the scolding.
 */
export const scrollInput = {
  at: Number.NEGATIVE_INFINITY,
  forwardAt: Number.NEGATIVE_INFINITY,
  backwardAt: Number.NEGATIVE_INFINITY,
  eventAt: Number.NEGATIVE_INFINITY,
  stepAt: Number.NEGATIVE_INFINITY,
  source: null as InputSource | null,
  meter: { rate: 0, at: 0 } as Meter,
  pedal: 0,
};

export type DriveStep = (deltaMs: number, lenis: Lenis) => void;

/**
 * The pedal's hook into the scroll: HeroStage sets `step`, the career
 * city adds its own (`addDriveStep`), and SmoothScroll calls them on the
 * ticker right before `lenis.raf`, so a held pedal moves the picture, the
 * dash and the car in the same frame, as a wheel notch does. Each stage's
 * step does nothing unless its own pedal is down.
 */
export const scrollDrive = {
  step: null as null | DriveStep,
  steps: new Set<DriveStep>(),
};

/** Adds a stage's pedal step to the scroll's frame; returns its removal. */
export function addDriveStep(step: DriveStep): () => void {
  scrollDrive.steps.add(step);
  return () => {
    scrollDrive.steps.delete(step);
  };
}

/** Written by HeroStage, read by DriveClock (pace, from the crawl to x2) and CameraRig (FOV kick, degrees). */
export const heroFeedback = { pace: 1, fovKick: 0 };

/**
 * Records one input: when, from where, which way, and, going forward, how
 * much it feeds the throttle. `deltaY` is in pixels over a viewport `vh`
 * pixels tall (keys and taps pass their step in pixels too).
 */
export function recordInput(deltaY: number, source: InputSource, nowMs: number, vh = viewportHeight()): void {
  scrollInput.at = nowMs;
  scrollInput.eventAt = nowMs;
  scrollInput.source = source;
  if (deltaY > 0) {
    scrollInput.forwardAt = nowMs;
    scrollInput.stepAt = nowMs;
    feedMeter(scrollInput.meter, deltaY / Math.max(1, vh), nowMs / 1000);
  } else if (deltaY < 0) {
    scrollInput.backwardAt = nowMs;
  }
}

/**
 * One frame of a held pedal: her foot (`rate`, viewport heights a second
 * of demand) is input now, forward, from `source` ("pedal" for the
 * on-screen button, "key" for W or Space), so it is never her turn while
 * it is down. Not an event (eventAt, stepAt) and not on the meter.
 */
export function recordPedal(rate: number, source: InputSource, nowMs: number): void {
  scrollInput.at = nowMs;
  scrollInput.forwardAt = nowMs;
  scrollInput.source = source;
  scrollInput.pedal = Math.max(0, rate);
}

/** Forgets every input: a new visit (tests and remounts). */
export function resetInput(): void {
  scrollInput.at = scrollInput.forwardAt = scrollInput.backwardAt = Number.NEGATIVE_INFINITY;
  scrollInput.eventAt = scrollInput.stepAt = Number.NEGATIVE_INFINITY;
  scrollInput.source = null;
  scrollInput.meter.rate = 0;
  scrollInput.meter.at = 0;
  scrollInput.pedal = 0;
  scrollGate.pressure = 0;
  scrollGate.pushedAt = scrollGate.touchEndAt = Number.NEGATIVE_INFINITY;
  scrollGate.touching = false;
  heroFeedback.pace = 1;
  heroFeedback.fovKick = 0;
}

function viewportHeight(): number {
  return typeof window === "undefined" ? 900 : window.innerHeight;
}
