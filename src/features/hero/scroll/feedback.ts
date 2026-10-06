/**
 * One frame of everything the hero answers the visitor with besides the
 * picture: the transport's mode (the dash shows it, dash.ts), how long the
 * film has waited for her, the world's pace and the "let the man finish"
 * note. Pure, on a small mutable state, so a frame allocates nothing.
 * HeroStage steps it on the GSAP ticker; the scroller model
 * (testing/scrollerModel.ts) steps the same function, so the acceptance
 * tests check what the page does. It runs on real time (HeroStage passes
 * the frame's real length; only the story's reading clocks are capped), so
 * a slow device neither scolds sooner nor keeps a state up longer.
 *
 * At any moment the hero says one of two things, never both:
 * - the line is playing, hold on: the card's bar fills, the car cruises
 *   (or surges while she pushes, up to the pit limiter's 80 km/h while
 *   the line is unread), the dash says LIMITER, and only sustained pushing
 *   brings up the note;
 * - your turn: the line has been read (or none is up), she has stopped
 *   for her wait, the transport says WAITING (the dash asks with her
 *   gesture), the marker or a cue points the way on (they show only with
 *   WAITING) and the car brakes to a crawl, lower still after a long wait.
 */
import { easePace, paceTarget, THROTTLE, WAIT, waitPace } from "./throttle";
import {
  HOLD_NOTE,
  type HoldNote,
  newHoldNote,
  PROMPT,
  rhythmAfter,
  stepHoldNote,
  turnConditions,
  type TransportInput,
  transportMode,
  type TransportMode,
  waitIdleFor,
} from "./transport";

export type Feedback = {
  mode: TransportMode;
  /** Seconds the film has been waiting for her; -1 while it does not wait. */
  waitingFor: number;
  /** World pace (throttle.ts), read by DriveClock. */
  pace: number;
  hold: HoldNote;
  /** Her rhythm: seconds between her bursts of input, smoothed (0: none yet). */
  rhythm: number;
  /** Last frame's seconds since input, to see a new input end a pause. */
  lastIdle: number;
  /** Seconds the pace has stayed at full throttle (THROTTLE.ff and over). */
  hot: number;
  /** Seconds the conditions for her turn have held (transport.turnConditions). */
  turnFor: number;
};

export type FeedbackInput = TransportInput & {
  /** Throttle meter rate, viewport heights per second. */
  meterRate: number;
  /** Seconds since she entered the site; negative before. */
  sinceEntered: number;
  /** The attract tease revs the car on the idle title. */
  teasing: boolean;
  /** Seconds since her last push at a wall (transport.isNotePush; +Infinity: never). */
  sincePush: number;
  /** Viewport heights of input held at a wall this frame. */
  held: number;
  /** Her input is a finger: a push episode bridges the lift between strokes (HOLD_NOTE.touchGap). */
  touch: boolean;
  /** The unread card up at the picture, its line playing, or -1. */
  unreadCard: number;
  /**
   * The pit limiter holds the pace at 80 km/h (throttle.ts LIMITER): an
   * unread card is up, and its predecessor's ALL CLEAR is over (HeroStage).
   */
  limited?: boolean;
};

export function newFeedback(): Feedback {
  return {
    mode: "hidden",
    waitingFor: -1,
    pace: 1,
    hold: newHoldNote(),
    rhythm: 0,
    lastIdle: Number.POSITIVE_INFINITY,
    hot: 0,
    turnFor: 0,
  };
}

/**
 * Whether the film waits for her: on the title once the hint asks her to
 * take the wheel (except while the tease revs the car), then whenever the
 * transport says WAITING.
 */
export function filmWaits(started: boolean, mode: TransportMode, sinceEntered: number, teasing: boolean): boolean {
  if (started) return mode === "waiting";
  return sinceEntered >= PROMPT.hintAt && !teasing;
}

/** A long wait: the car crawls lower and the cues escalate. */
export function deepWait(feedback: Feedback): boolean {
  return feedback.waitingFor >= WAIT.deepAfter;
}

/**
 * Advances one frame of `dt` real seconds. `input.pace`, `input.waitIdle`
 * and `input.turnFor` are filled in here from the feedback's own state, so
 * one input object can be reused every frame.
 */
export function stepFeedback(feedback: Feedback, input: FeedbackInput, dt: number): void {
  const step = Math.max(0, dt);
  // A new input ends a pause: its length is a beat of her rhythm, unless it answered WAITING.
  if (input.sinceInput < feedback.lastIdle) {
    const answered = feedback.mode === "waiting" ? feedback.waitingFor : -1;
    feedback.rhythm = rhythmAfter(feedback.rhythm, feedback.lastIdle, answered);
  }
  feedback.lastIdle = input.sinceInput;
  input.pace = feedback.pace;
  input.waitIdle = waitIdleFor(feedback.rhythm);
  feedback.turnFor = turnConditions(input) ? feedback.turnFor + step : 0;
  input.turnFor = feedback.turnFor;
  feedback.hot = feedback.pace >= THROTTLE.ff ? feedback.hot + step : 0;
  input.flatOut =
    feedback.hot >= THROTTLE.ffHold || (feedback.mode === "floored" && feedback.pace >= THROTTLE.ffOff);
  feedback.mode = transportMode(input, feedback.mode);
  const waits = filmWaits(input.started, feedback.mode, input.sinceEntered, input.teasing);
  feedback.waitingFor = waits ? (feedback.waitingFor < 0 ? 0 : feedback.waitingFor + step) : -1;
  const limited = input.limited === true;
  const target = waits ? waitPace(feedback.waitingFor) : paceTarget(input.meterRate, null, limited);
  // Once she drives, a light push gets the car up from the crawl gently; the tease and hard pushes surge.
  feedback.pace = easePace(feedback.pace, target, step, input.meterRate, input.started && !input.teasing, limited);
  stepHoldNote(feedback.hold, input.sincePush, input.held, input.unreadCard, step, input.touch ? HOLD_NOTE.touchGap : HOLD_NOTE.gap);
}
