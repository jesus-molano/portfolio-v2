/**
 * The pedal: hold to drive. A second way to drive the same scroll, never a
 * replacement for it: a press plays the next line exactly as Space or a tap
 * on the picture does, holding keeps driving after it, and letting go stops
 * the picture. Its push goes into the same Lenis scroll, through the same
 * gate and walls (the picture is still min(scroll, frontier)), so no card
 * can be passed early. At an unread line a held pedal knocks once when it
 * arrives (the card's bounce) and then rests on the pit limiter: resting
 * is not pushing, so it never brings up the "let the man finish" note or
 * the Skip offer. Its six ribs are the dash's shift lights in miniature.
 *
 * The on-screen button (Pedal.tsx), W and Space press it (HeroStage).
 * Pure functions on a small mutable state, so a frame allocates nothing.
 */
import { PROMPT } from "./transport";

export const PEDAL = {
  /** Her foot on the press frame: 2.4 of 6 ribs, 6 of 15 lights. */
  bite: 0.4,
  /** Spool-up toward full while held, s (95% by about 1 s). */
  rise: 0.35,
  /** The plate springing back once she lets go, s (what it shows only; the push stops at once). */
  spring: 0.08,
  /** Viewport heights a second floored: 1.6 times the film's own travel pace; the bite gives 0.32. */
  vFull: 0.8,
  /** Viewport heights a second of demand floored, for the strip and the world's pace (paceFor about x1.95). */
  demand: 1.6,
  /** A press shorter than this (ms) is a tap. */
  tapMs: 220,
  /**
   * A press of a finger or the mouse this soon (ms) after a hold's release continues that hold: a
   * rolling thumb, a tremor. A key is never a slip: pressed again, it is a new press.
   */
  regripMs: 150,
  /** Once its autorepeat has started, a held key silent this long (ms) lost its keyup. */
  lostKeyMs: 600,
  /** The push off the wall this long (s) before meeting it again knocks again: no knock flicker on a creeping wall. */
  unstick: 0.3,
  /** Lenis' lerp for the pedal's push: tight, so letting go stops the picture within 0.2 s. */
  lerp: 0.3,
  /**
   * Held by a key or the mouse, a push suspended by going back (S, the wheel) drives again once she
   * has stopped going back this long (s): holding W while tapping S is how a game is driven.
   */
  resume: 0.3,
  /**
   * Held at the very end of the drive (s): the push rests there, the way on comes up (STORY.endIdle)
   * and is read, then the pedal still held goes on into the next section, as a new press would.
   */
  endHold: 2,
} as const;

/** What pressed it: a finger or a mouse on the button, a key (W, Space), a gamepad. */
export type PedalVia = "touch" | "mouse" | "key" | "pad";

export type Pedal = {
  down: boolean;
  via: PedalVia | null;
  /** Her foot, 0..1: drives the push. 0 when up. */
  level: number;
  /** What the plate and the ribs show, 0..1: her foot while down, springing back once up. */
  shown: number;
  /** Seconds this press has lasted. */
  heldFor: number;
  /** performance.now() of this press (a regrip keeps the hold's), and of the last release. */
  downAt: number;
  upAt: number;
  /** The last release ended a hold (not a tap): a quick press continues it. */
  wasHold: boolean;
  /** The push rests on a wall (it knocked on arrival), and which one (story.frontierIndex; -1: none known). */
  contact: boolean;
  wall: number;
  /** Seconds the push has been off the wall since its last contact. */
  free: number;
  /** A backward input since the press: the push waits for the next press. */
  suspended: boolean;
};

export function newPedal(): Pedal {
  return {
    down: false,
    via: null,
    level: 0,
    shown: 0,
    heldFor: 0,
    downAt: Number.NEGATIVE_INFINITY,
    upAt: Number.NEGATIVE_INFINITY,
    wasHold: false,
    contact: false,
    wall: -1,
    free: 0,
    suspended: false,
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * Presses the pedal at `nowMs`. "step": a new press, HeroStage plays the
 * next line; "regrip": a finger or the mouse back on it within
 * PEDAL.regripMs of a hold's release continues that hold (no line step, no
 * knock); a key pressed again is always a new press, so a press never does
 * less than a tap; null: it was already down (a second source changes
 * nothing).
 */
export function pressPedal(p: Pedal, via: PedalVia, nowMs: number): "step" | "regrip" | null {
  if (p.down) return null;
  const regrip = via !== "key" && p.wasHold && nowMs - p.upAt < PEDAL.regripMs;
  p.down = true;
  p.via = via;
  p.suspended = false;
  if (regrip) {
    // Her foot was still on its way up: it goes back down from there.
    p.level = Math.max(p.shown, PEDAL.bite);
    p.shown = p.level;
    return "regrip";
  }
  p.downAt = nowMs;
  p.heldFor = 0;
  p.contact = false;
  p.wall = -1;
  p.free = 0;
  p.level = Math.max(p.level, PEDAL.bite);
  p.shown = Math.max(p.shown, p.level);
  return "step";
}

/** Lets go at `nowMs`: "tap" under PEDAL.tapMs, "hold" otherwise; null when it was not down. */
export function releasePedal(p: Pedal, nowMs: number): "tap" | "hold" | null {
  if (!p.down) return null;
  const kind = nowMs - p.downAt < PEDAL.tapMs ? "tap" : "hold";
  p.down = false;
  p.via = null;
  p.level = 0;
  p.suspended = false;
  p.upAt = nowMs;
  p.wasHold = kind === "hold";
  return kind;
}

/**
 * One frame of `dt` seconds. Down, her foot eases toward full (or toward a
 * pad trigger's own analog value) with PEDAL.rise and the plate shows it;
 * up, the foot is off (0) and the plate springs back with PEDAL.spring.
 * Returns her foot.
 */
export function stepPedal(p: Pedal, dt: number, analog = 1): number {
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
  if (!p.down) {
    p.shown *= Math.exp(-step / PEDAL.spring);
    if (p.shown < 0.005) p.shown = 0;
    return 0;
  }
  p.heldFor += step;
  const goal = clamp01(analog);
  p.level += (goal - p.level) * (1 - Math.exp(-step / PEDAL.rise));
  p.shown = p.level;
  return p.level;
}

/** How fast the pedal pushes the scroll at a level, viewport heights a second. */
export function pedalSpeed(level: number): number {
  return PEDAL.vFull * clamp01(level);
}

/** Her demand at a level, viewport heights a second, for the strip and the world's pace (throttle.ts paceFor). */
export function pedalRate(level: number): number {
  return PEDAL.demand * clamp01(level);
}

/**
 * Where this frame's push takes the scroll, trimmed at the wall as the
 * gate trims a wheel notch: `target` is Lenis' target (px), `push` the
 * pixels the pedal asks for, `max` the wall, `dt` the frame (s), `wall`
 * which wall it is (the story's frontier index). Never backwards. `knock`
 * is true on the frame the push meets a wall: once on arrival at each
 * line's wall, never while it rests there, and on the same wall again only
 * once the push has been off it for PEDAL.unstick, so a wall that creeps
 * at about her speed never flickers.
 */
export function pedalPush(
  p: Pedal,
  input: { target: number; push: number; max: number; dt: number; wall?: number },
): { dest: number; knock: boolean } {
  const want = input.target + Math.max(0, input.push);
  const dest = Math.max(input.target, Math.min(want, input.max));
  const atWall = want - dest > 0.5;
  const wall = input.wall ?? -1;
  let knock = false;
  if (atWall) {
    knock = !p.contact || (wall >= 0 && wall !== p.wall);
    p.contact = true;
    p.wall = wall;
    p.free = 0;
  } else if (p.contact) {
    p.free += Math.max(0, input.dt);
    if (p.free >= PEDAL.unstick) p.contact = false;
  }
  return { dest, knock };
}

/**
 * Going back while it is down: a backward input this frame (`back`: a
 * swipe down, the wheel up, S) suspends the push, so going back never
 * fights her foot. Under a finger it stays suspended until her next press
 * (the swipe was a second finger's: she went back to read). Held by a key
 * or the mouse it drives again once she has stopped going back for
 * PEDAL.resume (`sinceBack`, seconds since her last backward input or the
 * picture last moving back): W held through a tap of S. Returns whether
 * the push is suspended; while it is, her foot is not input (HeroStage).
 */
export function suspendPedal(p: Pedal, input: { back: boolean; sinceBack: number }): boolean {
  if (!p.down) return false;
  if (input.back) p.suspended = true;
  else if (p.suspended && p.via !== "touch" && input.sinceBack >= PEDAL.resume) p.suspended = false;
  return p.suspended;
}

/** Ribs lit for what the plate shows: 0 at rest, 6 floored, at most 4 under the limiter (10 of 15 lights). */
export function pedalRibs(shown: number, limited: boolean): number {
  const ribs = Math.round(clamp01(shown) * 6);
  return Math.min(limited ? 4 : 6, ribs);
}

/** A held key lost its keyup: its autorepeat had started and then went silent for PEDAL.lostKeyMs. */
export function keyLost(input: { repeating: boolean; sinceKeyMs: number }): boolean {
  return input.repeating && input.sinceKeyMs >= PEDAL.lostKeyMs;
}

/**
 * Whether the pedal shows: from the title hint (PROMPT.hintAt) or her
 * first input on, to the end of the hero, over the fade to night; it goes
 * the moment the page leaves the hero (`past`), so it never floats alone
 * over the next section as the stage scrolls away. Never under reduced
 * motion (the still hero has nothing to drive) and never while the radio
 * wheel is open.
 */
export function pedalVisibility(input: {
  started: boolean;
  /** Seconds since she entered the site; negative before. */
  sinceEntered: number;
  p: number;
  reduced: boolean;
  wheelOpen: boolean;
  /** The page has scrolled past the end of the drive, into the next section. */
  past?: boolean;
}): "hidden" | "shown" {
  if (input.reduced || input.wheelOpen || input.past) return "hidden";
  if (!input.started && !(input.sinceEntered >= PROMPT.hintAt)) return "hidden";
  return "shown";
}

/**
 * The plate's attract dip with each tease of the title (transport.TEASES),
 * `t` seconds into it: two dips to the bite, 180 ms down and 220 ms up
 * each, as the car revs. 0 outside.
 */
export function teachDip(t: number): number {
  const down = 0.18;
  const up = 0.22;
  const one = down + up;
  if (!(t >= 0) || t >= 2 * one) return 0;
  const u = t % one;
  if (u < down) return PEDAL.bite * Math.sin((u / down) * (Math.PI / 2));
  return PEDAL.bite * Math.cos(((u - down) / up) * (Math.PI / 2));
}
