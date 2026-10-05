/**
 * A frame-by-frame model of a visitor scrolling the hero, for the story
 * tests: input sources (wheel, trackpad, touch, keys), Lenis 1.3.26 as the
 * page uses it (lerp 0.09 for wheel and keys, syncTouch with lerp 1 under
 * the finger and |v|^1.7 inertia at lerp 0.08 after it), the gate in
 * SmoothScroll and HeroStage, and the real story functions. Not a test
 * itself; story.test.ts runs it.
 */
import { motion } from "@/design/tokens";
import type { FilmTimeline } from "../film";
import {
  activeWindow,
  buildWalls,
  cardWall,
  frontier,
  frontierIndex,
  heroTimeline,
  lineStep,
  newStory,
  stepStory,
  STORY,
  type Wall,
} from "../story";

export type ScrollEvent =
  | { type: "wheel"; delta: number }
  | { type: "touchmove"; delta: number }
  | { type: "touchend" }
  | { type: "space" }
  | { type: "arrow" };

/** Events a visitor sends during the frame that starts at `time`. */
export type Source = (time: number, dt: number, vh: number) => ScrollEvent[];

const FRAME = 1 / 60;

/** Fires `make` once every `period` seconds, starting at time 0. */
function every(period: number, make: (i: number) => ScrollEvent[]): Source {
  return (time, dt) => {
    const a = Math.floor((time - 1e-9) / period);
    const b = Math.floor((time + dt - 1e-9) / period);
    return time === 0 ? make(0) : a !== b ? make(b) : [];
  };
}

/** A mouse wheel: `perSecond` notches of `px` pixels (Chrome 100, Firefox 50). */
export const wheel = (perSecond: number, px = 100): Source =>
  every(1 / perSecond, () => [{ type: "wheel", delta: px }]);

/** Trackpad swipes every `gap` s: one event a frame, from `peak` px decaying x0.93 (momentum). */
export const trackpad =
  (gap: number, peak = 60): Source =>
  (time, dt) => {
    const n = Math.floor((time % gap) / dt + 1e-6);
    const delta = peak * 0.93 ** n;
    return delta > 0.5 ? [{ type: "wheel", delta }] : [];
  };

/** Touch strokes of `stroke` px over `duration` s, then a lift, every `gap` s. */
export const touch =
  (gap: number, stroke = 400, duration = 0.12): Source =>
  (time, dt) => {
    const phase = time % gap;
    if (phase < duration - 1e-9) return [{ type: "touchmove", delta: (stroke * dt) / duration }];
    if (phase - duration < dt - 1e-9) return [{ type: "touchend" }];
    return [];
  };

/** Space (or a tap on the picture) every `gap` s. */
export const space = (gap: number): Source => every(gap, () => [{ type: "space" }]);

/** ArrowDown at `perSecond` presses (autorepeat is about 30). */
export const arrows = (perSecond: number): Source => every(1 / perSecond, () => [{ type: "arrow" }]);

export type SimOptions = {
  /** Viewport height, px. */
  vh?: number;
  /** Seconds to simulate. */
  maxTime?: number;
  /** Input stops at this time (seconds after entering). */
  stopAt?: number;
  /** Input starts at this time. */
  startAt?: number;
  /** Simulate the tab hidden between these times. */
  hidden?: [number, number];
};

export type SimFrame = { time: number; p: number; frontier: number; active: number; opacity: number[] };

export type SimResult = {
  timeline: FilmTimeline;
  walls: Wall[];
  /** Seconds each card was fully opaque (>= STORY.fullyVisible) and on screen at all, while the tab was visible. */
  fullyOpaque: number[];
  onScreen: number[];
  /** Frames where a card was active while an earlier beat was unfinished. */
  earlyCards: number;
  /** Frames where the frontier moved back. */
  frontierBackwards: number;
  /** Seconds from the first input until the fade (p >= 0.93) and the end. */
  fadeAt: number;
  endAt: number;
  /** Longest stretch with input in the last 0.2 s but a picture slower than 0.001/s. */
  longestDeadStop: number;
  /** Time of the last input event. */
  lastInput: number;
  /** Latest a card became active after the last input, seconds (-Infinity if none). */
  lateActivation: number;
  /**
   * Last time after the last input the picture moved more than 0.5 px in a
   * frame, seconds. Lenis' own landing (one frame that rounds the last pixel
   * onto the target) is not a move.
   */
  lastFastMove: number;
  /** p at the last input's own scroll target and the furthest p after it. */
  targetAtStop: number;
  maxPAfterStop: number;
  frames: SimFrame[];
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** A duration-based Lenis animation (Space, a tap). */
type Glide = { from: number; to: number; t: number; duration: number };

/** Runs a visitor against the hero for `lines` (one array of cards per line). */
export function simulate(lines: string[][], source: Source, options: SimOptions = {}): SimResult {
  const vh = options.vh ?? 900;
  const range = 5 * vh; // a 600vh stage scrolls five viewports
  const maxTime = options.maxTime ?? 150;
  const stopAt = options.stopAt ?? Number.POSITIVE_INFINITY;
  const startAt = options.startAt ?? 0;
  const timeline = heroTimeline(lines);
  const walls = buildWalls(timeline);
  const story = newStory(walls, timeline.beats.length);
  const lambdaWheel = motion.scrollLerp * 60;
  const lambdaTouch = 60; // syncTouch lerp 1 in Lenis' damp()
  const lambdaInertia = motion.touchLerp * 60;

  // Lenis
  let target = 0;
  let anim = 0;
  let lambda = lambdaWheel;
  // Assigned from scrollTo(): a plain annotation would narrow it to null here.
  let glide = null as Glide | null;
  let velocity = 0;
  let lastTouchDelta = 0;
  // Gate and story
  let maxScroll = STORY.titleWallFrom * range;
  let firstInput = Number.NaN;
  let lastInput = Number.NEGATIVE_INFINITY;
  let backwardAt = Number.NEGATIVE_INFINITY;
  let introClock = 0;
  let introScale = 1;
  let prevFrontier = 0;
  let prevP = 0;
  let prevActive = -1;
  let deadRun = 0;
  let targetAtStop = Number.NaN;

  const result: SimResult = {
    timeline,
    walls,
    fullyOpaque: timeline.beats.map(() => 0),
    onScreen: timeline.beats.map(() => 0),
    earlyCards: 0,
    frontierBackwards: 0,
    fadeAt: Number.NaN,
    endAt: Number.NaN,
    longestDeadStop: 0,
    lastInput: Number.NEGATIVE_INFINITY,
    lateActivation: Number.NEGATIVE_INFINITY,
    lastFastMove: Number.NEGATIVE_INFINITY,
    targetAtStop: Number.NaN,
    maxPAfterStop: 0,
    frames: [],
  };

  const scrollTo = (to: number, how: { lerp?: number; duration?: number }) => {
    target = Math.min(range, Math.max(0, to));
    if (how.duration) {
      glide = { from: anim, to: target, t: 0, duration: how.duration };
    } else {
      glide = null;
      lambda = how.lerp ?? lambdaWheel;
    }
  };

  for (let time = 0; time < maxTime; time += FRAME) {
    const dt = FRAME;
    const visible = !options.hidden || time < options.hidden[0] || time >= options.hidden[1];
    const events = time >= startAt && time < stopAt && visible ? source(time - startAt, dt, vh) : [];
    for (const event of events) {
      if (Number.isNaN(firstInput)) firstInput = time;
      lastInput = time;
      const room = maxScroll - Math.max(target, anim);
      if (event.type === "wheel" || event.type === "touchmove") {
        // SmoothScroll.gateInput: trim forward input to the room left.
        const accepted = event.delta > 0 ? Math.max(0, Math.min(event.delta, room)) : event.delta;
        if (event.delta > 0 && accepted < 1) continue;
        if (event.type === "touchmove") lastTouchDelta = accepted;
        scrollTo(target + accepted, { lerp: event.type === "touchmove" ? lambdaTouch : lambdaWheel });
        if (event.delta < 0) backwardAt = time;
      } else if (event.type === "touchend") {
        // Near a wall the inertia is dropped; elsewhere Lenis flings |v|^1.7.
        if (room >= 0.06 * vh && lastTouchDelta !== 0) {
          const inertia = Math.sign(lastTouchDelta) * Math.abs(velocity) ** 1.7;
          scrollTo(target + inertia, { lerp: lambdaInertia });
        }
        lastTouchDelta = 0;
      } else if (event.type === "space") {
        const fr = frontier(walls, story);
        const from = Math.max(anim / range, target / range);
        const goal = lineStep(1, Math.min(from, fr), timeline, fr);
        if (goal !== null) scrollTo(goal * range, { duration: 0.6 });
      } else if (event.type === "arrow") {
        const dest = Math.min(target + 0.12 * vh, maxScroll);
        if (dest > target + 0.5) scrollTo(dest, { lerp: lambdaWheel });
      }
      targetAtStop = target / range;
    }

    // Lenis raf.
    const before = anim;
    let landed = false;
    if (glide) {
      glide.t += dt;
      const u = Math.min(1, glide.t / glide.duration);
      anim = glide.from + (glide.to - glide.from) * easeOutCubic(u);
      if (u >= 1) glide = null;
    } else {
      anim += (target - anim) * (1 - Math.exp(-lambda * dt));
      if (Math.round(anim) === Math.round(target) && anim !== target) {
        anim = target;
        landed = true;
      }
    }
    velocity = anim - before;

    // HeroStage.update: the picture is the scroll, clamped to the frontier.
    const fr = frontier(walls, story);
    const p = Math.min(1, anim / range, fr);
    // Going back, by input or a fling still coasting: cards hide.
    if (p < prevP - 1e-6) backwardAt = Math.max(backwardAt, time);
    if (!Number.isNaN(firstInput) && introScale === 1) introScale = 4;
    introClock += dt * introScale;
    const introDone = introClock >= 2.75;
    const active = stepStory(walls, story, timeline, p, dt, {
      rewinding: time - backwardAt < STORY.rewindHide,
      visible,
      introDone,
      introProgress: Math.min(1, Math.max(0, (introClock - 0.2) / 2.55)),
    });
    // HeroStage.gate: inertia aimed past the wall glides into it.
    const nextFrontier = frontier(walls, story);
    maxScroll = Number.isFinite(nextFrontier) ? nextFrontier * range : Number.POSITIVE_INFINITY;
    if (!glide && target > maxScroll + 1) scrollTo(maxScroll, { lerp: lambdaInertia });

    // Metrics.
    // Only what she can see counts: a hidden tab shows nothing.
    if (visible) {
      story.opacity.forEach((o, i) => {
        if (o >= STORY.fullyVisible) result.fullyOpaque[i] += dt;
        if (o > 0) result.onScreen[i] += dt;
      });
    }
    const k = frontierIndex(story);
    if (active >= 0 && k >= 0 && cardWall(walls, active) > k) result.earlyCards += 1;
    if (Number.isFinite(nextFrontier)) {
      if (nextFrontier < prevFrontier - 1e-12) result.frontierBackwards += 1;
      prevFrontier = nextFrontier;
    }
    const since = Number.isNaN(firstInput) ? Number.NaN : time - firstInput;
    if (p >= STORY.fadeFrom && Number.isNaN(result.fadeAt)) result.fadeAt = since;
    if (p >= 0.999 && Number.isNaN(result.endAt)) result.endAt = since;
    const pushing = time - lastInput < 0.2 && p < STORY.fadeFrom;
    const speed = Math.abs(p - prevP) / dt;
    if (pushing && speed < 0.001) {
      deadRun += dt;
      result.longestDeadStop = Math.max(result.longestDeadStop, deadRun);
    } else {
      deadRun = 0;
    }
    if (time > lastInput && Number.isFinite(stopAt) && time >= stopAt) {
      if (active !== prevActive && active >= 0) {
        result.lateActivation = Math.max(result.lateActivation, time - lastInput);
      }
      if (Math.abs(p - prevP) * range > 0.5 && !landed) result.lastFastMove = time - lastInput;
      result.maxPAfterStop = Math.max(result.maxPAfterStop, p);
    }
    result.frames.push({ time, p, frontier: nextFrontier, active, opacity: [...story.opacity] });
    prevP = p;
    prevActive = active;
  }
  result.lastInput = lastInput;
  result.targetAtStop = targetAtStop;
  return result;
}

/** Start of a card's active window, for assertions. */
export function cardStart(timeline: FilmTimeline, card: number): number {
  return activeWindow(timeline.beats[card]).from;
}
