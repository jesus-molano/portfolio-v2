/**
 * A frame-by-frame model of a visitor scrolling the hero, for the story
 * and acceptance tests: input sources (wheel, trackpad, touch, keys, and
 * native jumps of the page: the scrollbar, find in page, an anchor),
 * Lenis 1.3.26 as the page uses it (lerp 0.09 for wheel and keys,
 * syncTouch with lerp 1 under the finger and |v|^1.7 inertia at lerp 0.08
 * after it; a native move it may miss, as it drops the scroll event after
 * its own landing), the page itself, the gate in SmoothScroll and
 * HeroStage (gate.ts), the real story functions and the real feedback
 * (readout, pace, the hold note, the marker and the prompts), at 60 frames
 * a second or slower (`fps`), with the story's reading clocks capped per
 * frame as HeroStage caps them. Not a test itself; story.test.ts and
 * acceptance.test.ts run it.
 */
import { motion } from "@/design/tokens";
import type { FilmTimeline } from "../film";
import { type Feedback, type FeedbackInput, newFeedback, stepFeedback } from "../feedback";
import { GATE, gateAction, lenisMissed, liftFling, type PageReading, pageScroll } from "../gate";
import {
  activeWindow,
  buildWalls,
  cardWall,
  frontier,
  frontierIndex,
  heroTimeline,
  lineStep,
  newStory,
  playingBeat,
  readFill,
  settleTitle,
  stepStory,
  STORY,
  type Wall,
} from "../story";
import { feedMeter, type Meter, meterRate, THROTTLE } from "../throttle";
import { isNotePush, type Prompt, promptFor, type TransportMode } from "../transport";

/** HeroStage's queue for a line asked for at the title (Space, a tap): seconds it stays valid. */
const TITLE_QUEUE = 6;

export type ScrollEvent =
  | { type: "wheel"; delta: number }
  | { type: "touchmove"; delta: number }
  | { type: "touchend" }
  | { type: "space" }
  | { type: "arrow" }
  /**
   * A native move of the page to film position `p` (past 1: below the
   * hero), which no input gate sees: the scrollbar, find in page, an
   * anchor, a programmatic scroll. `seen`: Lenis gets its scroll event
   * (false: it drops it, as after its own landing).
   */
  | { type: "jump"; p: number; seen: boolean };

/** Events a visitor sends during the frame that starts at `time`. */
export type Source = (time: number, dt: number, vh: number) => ScrollEvent[];

/** Fires `make` once every `period` seconds, starting at time 0 (every firing a long frame spans). */
function every(period: number, make: (i: number) => ScrollEvent[]): Source {
  return (time, dt) => {
    const a = time === 0 ? -1 : Math.floor((time - 1e-9) / period);
    const b = Math.floor((time + dt - 1e-9) / period);
    const events: ScrollEvent[] = [];
    for (let i = a + 1; i <= b; i += 1) events.push(...make(i));
    return events;
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
    if (phase < duration - 1e-9) return [{ type: "touchmove", delta: (stroke * Math.min(dt, duration - phase)) / duration }];
    if (phase - duration < dt - 1e-9) return [{ type: "touchend" }];
    return [];
  };

/** One touch stroke of `stroke` px over `duration` s whose finger never lifts: the thumb rests on the glass. */
export const strokeAndRest =
  (stroke = 400, duration = 0.12): Source =>
  (time, dt) =>
    time < duration - 1e-9 ? [{ type: "touchmove", delta: (stroke * Math.min(dt, duration - time)) / duration }] : [];

/** A finger dragging on, `perSecond` viewport heights a second, never lifting. */
export const drag =
  (perSecond: number): Source =>
  (_time, dt, vh) => [{ type: "touchmove", delta: perSecond * vh * dt }];

/** Space (or a tap on the picture) every `gap` s. */
export const space = (gap: number): Source => every(gap, () => [{ type: "space" }]);

/** One native jump of the page to film position `p` at `at` seconds (see ScrollEvent). */
export const jump = (at: number, p: number, seen = false): Source =>
  (time, dt) => (time <= at + 1e-9 && at < time + dt - 1e-9 ? [{ type: "jump", p, seen }] : []);

/** ArrowDown at `perSecond` presses (autorepeat is about 30). */
export const arrows = (perSecond: number): Source => every(1 / perSecond, () => [{ type: "arrow" }]);

/** `source`, started at `from` seconds (its own clock starts there) and stopped at `to`. */
export const during =
  (from: number, to: number, source: Source): Source =>
  (time, dt, vh) =>
    time >= from - 1e-9 && time < to - 1e-9 ? source(time - from, dt, vh) : [];

/** Several sources at once (their events in order). */
export const together =
  (...sources: Source[]): Source =>
  (time, dt, vh) =>
    sources.flatMap((source) => source(time, dt, vh));

/**
 * A restless visitor, for fuzzing: from a seeded generator, bursts of
 * wheel notches either way, touch strokes either way, Space and arrow
 * presses, and pauses of up to `maxPause` seconds.
 */
export function restless(random: () => number, maxPause = 5): Source {
  type Burst = { until: number; kind: number; period: number; sign: number; next: number };
  let burst: Burst | null = null;
  let quietUntil = 0;
  return (time) => {
    if (time < quietUntil) return [];
    if (!burst || time >= burst.until) {
      if (burst) {
        burst = null;
        quietUntil = time + random() * maxPause;
        return [];
      }
      burst = {
        until: time + 0.2 + random() * 2.5,
        kind: Math.floor(random() * 4),
        period: 1 / (1 + random() * 14),
        sign: random() < 0.25 ? -1 : 1,
        next: time,
      };
    }
    if (time + 1e-9 < burst.next) return [];
    burst.next = time + burst.period;
    switch (burst.kind) {
      case 0:
        return [{ type: "wheel", delta: burst.sign * 100 }];
      case 1:
        return [{ type: "touchmove", delta: burst.sign * 60 }, ...(random() < 0.3 ? [{ type: "touchend" } as const] : [])];
      case 2:
        return burst.sign > 0 ? [{ type: "space" }] : [{ type: "wheel", delta: -100 }];
      default:
        return [{ type: "arrow" }];
    }
  };
}

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
  /** Frames a second (default 60): a slow device. */
  fps?: number;
};

export type SimFrame = {
  time: number;
  p: number;
  /** Where the page is after the frame (px), and the wall the gate holds it at (Infinity: none). */
  page: number;
  maxScroll: number;
  frontier: number;
  active: number;
  opacity: number[];
  /** The visitor's feedback this frame, as HeroStage draws it. */
  mode: TransportMode;
  pace: number;
  /** Seconds the film has waited for her, -1 while it does not. */
  waitingFor: number;
  holdNote: boolean;
  /** The hold note's push episode: seconds its pushes span and viewport heights held (0 between episodes). */
  holdSpan: number;
  holdHeld: number;
  /** The active card's reading bar (0..1), and its marker asking for more. */
  fill: number;
  ready: boolean;
  prompt: Prompt | null;
  /** She has given forward input: she has the wheel. */
  started: boolean;
  /** The title's beat still plays: the name is forming or holding. */
  naming: boolean;
  /** The beat playing at the picture (story.playingBeat). */
  playing: Wall["kind"] | null;
  /** Seconds since her last input. */
  idle: number;
  /** The picture's opacity of the title (its position-based fade and settleTitle). */
  title: number;
};

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
  /** Latest a card became active after the last input (or the line she asked for), seconds (-Infinity if none). */
  lateActivation: number;
  /**
   * Last time after the last input (or the line she asked for at the
   * title, once it played) the picture moved more than 0.5 px in a
   * frame, seconds. Lenis' own landing (one frame that rounds the last pixel
   * onto the target) is not a move.
   */
  lastFastMove: number;
  /** p at the last input's own scroll target and the furthest p after it. */
  targetAtStop: number;
  maxPAfterStop: number;
  /** Times of every input event (seconds). */
  inputs: number[];
  frames: SimFrame[];
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** A duration-based Lenis animation (Space, a tap). */
type Glide = { from: number; to: number; t: number; duration: number };

/** Runs a visitor against the hero for `lines` (one array of cards per line). */
export function simulate(lines: string[][], source: Source, options: SimOptions = {}): SimResult {
  const vh = options.vh ?? 900;
  const frame = 1 / (options.fps ?? 60);
  const range = 5 * vh; // a 600vh stage scrolls five viewports
  /** The page scrolls on past the hero, into the sections below it. */
  const pageLimit = range + 2 * vh;
  const maxTime = options.maxTime ?? 150;
  const stopAt = options.stopAt ?? Number.POSITIVE_INFINITY;
  const startAt = options.startAt ?? 0;
  const timeline = heroTimeline(lines);
  const walls = buildWalls(timeline);
  const story = newStory(walls, timeline.beats.length);
  const lambdaWheel = motion.scrollLerp * 60;
  const lambdaTouch = 60; // syncTouch lerp 1 in Lenis' damp()
  const lambdaInertia = motion.touchLerp * 60;

  // Lenis, and the page it scrolls (they part when Lenis misses a native move).
  let target = 0;
  let anim = 0;
  let page = 0;
  const reading: PageReading = { page: 0, lenis: 0, gliding: false };
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
  // A line asked for at the title: when, and the input it was.
  let queued = Number.NaN;
  /** When the queued line played: for the metrics, the glide of a line she asked for. */
  let askedAt = Number.NEGATIVE_INFINITY;
  let titleDoneAt = Number.NaN;
  let titleSettle = 0;

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
    inputs: [],
    frames: [],
  };

  // Feedback, as HeroStage feeds it.
  const feedback: Feedback = newFeedback();
  const meter: Meter = { rate: 0, at: 0 };
  let firstForward = Number.NaN;
  let pushedAt = Number.NEGATIVE_INFINITY;
  let notePushAt = Number.NEGATIVE_INFINITY;
  /** A finger is on the glass, and her last input was a finger (HeroStage's touch mode). */
  let touching = false;
  let byTouch = false;
  let heldPx = 0;
  const input: FeedbackInput = {
    started: false,
    p: 0,
    sinceInput: Number.POSITIVE_INFINITY,
    sinceBackward: Number.POSITIVE_INFINITY,
    pictureSpeed: 0,
    pace: 1,
    playing: false,
    meterRate: 0,
    sinceEntered: 0,
    teasing: false,
    sincePush: Number.POSITIVE_INFINITY,
    held: 0,
    touch: false,
    unreadCard: -1,
  };
  const forward = (time: number, viewports: number) => {
    if (Number.isNaN(firstForward)) firstForward = time;
    feedMeter(meter, viewports, time);
  };

  const scrollTo = (to: number, how: { lerp?: number; duration?: number }) => {
    target = Math.min(pageLimit, Math.max(0, to));
    if (how.duration) {
      glide = { from: anim, to: target, t: 0, duration: how.duration };
    } else {
      glide = null;
      lambda = how.lerp ?? lambdaWheel;
    }
  };

  for (let time = 0; time < maxTime; time += frame) {
    const dt = frame;
    // The story's clocks take at most STORY.maxStep a frame; the feedback runs on real time.
    const storyDt = Math.min(dt, STORY.maxStep);
    const visible = !options.hidden || time < options.hidden[0] || time >= options.hidden[1];
    const events = time >= startAt && time < stopAt && visible ? source(time - startAt, dt, vh) : [];
    for (const event of events) {
      if (event.type === "jump") {
        // Not input of hers the hero hears: the page just moves.
        page = Math.min(pageLimit, Math.max(0, event.p * range));
        // Lenis follows a native move it sees, unless it is gliding (its next write takes the page back).
        if (event.seen && !glide && anim === target) anim = target = page;
        continue;
      }
      if (Number.isNaN(firstInput)) firstInput = time;
      lastInput = time;
      result.inputs.push(time);
      byTouch = event.type === "touchmove" || event.type === "touchend";
      // Any other input she gives takes over from a queued line.
      if (event.type !== "space" && event.type !== "touchend") queued = Number.NaN;
      // SmoothScroll measures the room from the page as well as from Lenis' target.
      const room = maxScroll - Math.max(target, page);
      if (event.type === "wheel" || event.type === "touchmove") {
        if (event.type === "touchmove") touching = true;
        if (event.delta > 0) forward(time, event.delta / vh);
        // SmoothScroll.gateInput: trim forward input to the room left; the rest is held.
        const accepted = event.delta > 0 ? Math.max(0, Math.min(event.delta, room)) : event.delta;
        if (event.delta > accepted) {
          pushedAt = time;
          heldPx += event.delta - Math.max(0, accepted);
        }
        if (event.delta > 0 && accepted < 1) continue;
        if (event.type === "touchmove") lastTouchDelta = accepted;
        scrollTo(target + accepted, { lerp: event.type === "touchmove" ? lambdaTouch : lambdaWheel });
        if (event.delta < 0) backwardAt = time;
      } else if (event.type === "touchend") {
        touching = false;
        // Lenis flings |v|^1.7; forward, the gate lets it fly up to the wall and no further (gate.ts).
        const fling = Math.abs(velocity) ** 1.7;
        if (lastTouchDelta < 0) {
          scrollTo(target - fling, { lerp: lambdaInertia });
        } else if (lastTouchDelta > 0) {
          const fly = Number.isFinite(room) ? liftFling(fling, room, vh) : fling;
          if (fly > 0) scrollTo(target + fly, { lerp: lambdaInertia });
          if (fly > 0 && fly < fling) {
            pushedAt = time;
            heldPx += Math.min(fling - fly, GATE.overshootCap);
          }
        }
        lastTouchDelta = 0;
      } else if (event.type === "space") {
        forward(time, THROTTLE.keyStep);
        const fr = frontier(walls, story);
        const from = Math.max(anim / range, target / range);
        const goal = lineStep(1, Math.min(from, fr), timeline, fr);
        // A press on an unread line knocks on it (HeroStage.stepLine).
        if (goal === null || goal < (lineStep(1, Math.min(from, fr), timeline, Number.POSITIVE_INFINITY) ?? 1)) {
          pushedAt = time;
          heldPx += 0.12 * vh;
        }
        if (goal !== null) scrollTo(goal * range, { duration: 0.6 });
        // At the title, the line plays once the name has formed (HeroStage.stepLine).
        queued = frontierIndex(story) === 0 ? time : Number.NaN;
      } else if (event.type === "arrow") {
        forward(time, THROTTLE.arrowStep);
        const want = target + THROTTLE.arrowStep * vh;
        const dest = Math.min(want, maxScroll);
        if (want > dest) {
          pushedAt = time;
          heldPx += want - dest;
        }
        if (dest > target + 0.5) scrollTo(dest, { lerp: lambdaWheel });
      }
      targetAtStop = target / range;
    }
    if (!Number.isNaN(queued) && story.done[0]) {
      if (time - queued < TITLE_QUEUE) {
        const fr = frontier(walls, story);
        const goal = lineStep(1, Math.min(anim / range, fr), timeline, fr);
        if (goal !== null) {
          scrollTo(goal * range, { duration: 0.6 });
          askedAt = time;
          targetAtStop = goal;
        }
      }
      queued = Number.NaN;
    }

    // Lenis raf: while it animates, it writes the page.
    const before = anim;
    const animating = glide !== null || anim !== target;
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
    if (animating) page = anim;

    // HeroStage.update: where the page is (gate.ts), and the picture: the scroll, clamped to the frontier.
    reading.page = page;
    reading.lenis = anim;
    reading.gliding = glide !== null || anim !== target;
    if (lenisMissed(reading)) {
      anim = target = page;
      glide = null;
    }
    const scroll = pageScroll(reading);
    const fr = frontier(walls, story);
    const p = Math.min(1, scroll / range, fr);
    // Going back, by input or a fling still coasting: cards hide.
    if (p < prevP - 1e-6) backwardAt = Math.max(backwardAt, time);
    if (!Number.isNaN(firstInput) && introScale === 1) introScale = 4;
    introClock += storyDt * introScale;
    const introDone = introClock >= 2.75;
    const active = stepStory(walls, story, timeline, p, storyDt, {
      rewinding: time - backwardAt < STORY.rewindHide,
      visible,
      introDone,
      introProgress: Math.min(1, Math.max(0, (introClock - 0.2) / 2.55)),
    });
    // HeroStage.gate (gate.ts): a glide aimed past the wall turns into it; a page past it goes back now.
    const nextFrontier = frontier(walls, story);
    maxScroll = Number.isFinite(nextFrontier) ? nextFrontier * range : Number.POSITIVE_INFINITY;
    const action = gateAction({ scroll, lenisTarget: target, gliding: reading.gliding, max: maxScroll });
    if (action === "into") {
      pushedAt = time;
      heldPx += Math.min(target - maxScroll, GATE.overshootCap);
      scrollTo(maxScroll, { lerp: lambdaInertia });
    } else if (action === "back") {
      pushedAt = time;
      heldPx += Math.min(scroll - maxScroll, GATE.overshootCap);
      anim = target = page = maxScroll;
      glide = null;
    }

    // HeroStage: the readout, the pace, the hold note, the marker and the prompt.
    const idle = time - lastInput;
    const started = !Number.isNaN(firstForward);
    const playing = playingBeat(walls, story, p, active);
    const fill = active >= 0 ? readFill(walls, story, active) : 0;
    const rewinding = time - backwardAt < STORY.rewindHide;
    input.started = started;
    input.p = p;
    input.sinceInput = idle;
    input.sinceBackward = time - backwardAt;
    input.pictureSpeed = Math.abs(p - prevP) / dt;
    input.playing = playing !== null;
    input.meterRate = meterRate(meter, time);
    input.sinceEntered = time;
    // A push counts for the note above HOLD_NOTE.tail (a fling's momentum tails off under it).
    // Only a frame where the held input grew is a push: a thumb resting on the glass is not.
    if (isNotePush(heldPx / vh, dt)) notePushAt = pushedAt;
    input.sincePush = time - notePushAt;
    input.held = heldPx / vh;
    input.touch = touching || byTouch;
    heldPx = 0;
    input.unreadCard = playing === "card" ? active : -1;
    stepFeedback(feedback, input, dt);
    if (story.done[0] && Number.isNaN(titleDoneAt)) titleDoneAt = time;
    const turn = feedback.mode === "waiting";
    const prompt = promptFor({
      started,
      // "You have the wheel" holds while the name forms, then counts.
      sinceStart: started && story.done[0] ? time - Math.max(firstForward, titleDoneAt) : 0,
      p,
      card: active >= 0,
      rewinding,
      idle,
      turn,
    });
    titleSettle = settleTitle(titleSettle, p, p < prevP - 1e-6, turn, dt);

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
    // The glide of her last input, or of the line she asked for at the title.
    const asked = Math.max(lastInput, askedAt);
    if (time > asked && Number.isFinite(stopAt) && time >= stopAt) {
      if (active !== prevActive && active >= 0) {
        result.lateActivation = Math.max(result.lateActivation, time - asked);
      }
      if (Math.abs(p - prevP) * range > 0.5 && !landed) result.lastFastMove = time - asked;
      result.maxPAfterStop = Math.max(result.maxPAfterStop, p);
    }
    result.frames.push({
      time,
      p,
      page,
      maxScroll,
      frontier: nextFrontier,
      active,
      opacity: [...story.opacity],
      mode: feedback.mode,
      pace: feedback.pace,
      waitingFor: feedback.waitingFor,
      holdNote: feedback.hold.visible,
      holdSpan: feedback.hold.span,
      holdHeld: feedback.hold.held,
      fill,
      ready: active >= 0 && fill >= 1 && turn,
      prompt,
      started,
      naming: !story.done[0],
      playing,
      idle,
      title: (1 - Math.min(1, p / STORY.titleOut)) * (1 - titleSettle),
    });
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
