/**
 * The driving vocabulary of the hero: what the dashboard readout says
 * (YOU DRIVE, WAITING, FLAT OUT, REVERSE) and its speedometer, which one
 * prompt tells her what to do next, the attract tease and the Skip
 * prompt's patience, plus the rules that decide which key, tap or Skip
 * activation counts. No tape-deck words: the hero must never read as a
 * video playing on its own. Pure functions; HeroStage applies them.
 */
import { STORY } from "./story";
import { THROTTLE } from "./throttle";

export type TransportMode = "hidden" | "reverse" | "waiting" | "floored" | "drive";

export const TRANSPORT = {
  /** Going back this recently (s) reads REVERSE. */
  reverseWindow: 0.25,
  /**
   * Idle this long (s) with a still picture reads WAITING, and the car
   * starts to slow down to its crawl (driveWaits). Long enough that a calm
   * scroller, a notch a second, never sees it blink between her notches.
   */
  waitIdle: THROTTLE.crawlIdle,
  /** Picture speed (progress per second) under which the picture counts as still. */
  stillSpeed: 0.002,
} as const;

export type TransportInput = {
  /** The visitor has given forward input since entering. */
  started: boolean;
  /** Film position of the picture. */
  p: number;
  /** Seconds since any input, and since backward input. */
  sinceInput: number;
  sinceBackward: number;
  /** |dp/dt| of the picture, progress per second. */
  pictureSpeed: number;
  /** World pace (throttle.ts). */
  pace: number;
};

/** What the readout says. The first rule that matches wins. */
export function transportMode(input: TransportInput): TransportMode {
  if (!input.started || input.p >= STORY.fadeFrom) return "hidden";
  if (input.sinceBackward < TRANSPORT.reverseWindow) return "reverse";
  if (input.sinceInput >= TRANSPORT.waitIdle && input.pictureSpeed < TRANSPORT.stillSpeed) return "waiting";
  if (input.pace >= THROTTLE.ff) return "floored";
  return "drive";
}

/**
 * Whether the car waits for her, slowing to its crawl (throttle.ts): on
 * the title from the moment the hint asks her to take the wheel, except
 * while the attract tease revs it; then whenever the readout says WAITING
 * (she has stopped, and the picture with her). A film that plays on its
 * own would keep its speed; this one waits for its driver.
 */
export function driveWaits(input: { mode: TransportMode; started: boolean; sinceEntered: number; teasing: boolean }): boolean {
  if (input.started) return input.mode === "waiting";
  return input.sinceEntered >= PROMPT.hintAt && !input.teasing;
}

/** The speedometer, km/h: the cruise (18 m/s) reads 65, the pace scales it. */
export function speedKmh(pace: number, metresPerSecond = 18): number {
  return Math.max(0, Math.round(metresPerSecond * 3.6 * pace));
}

export type Prompt = "hint" | "ack" | "between" | "end";

export const PROMPT = {
  /** Seconds after entering: the title hint pops in, Skip shows and the car starts to wait for her. */
  hintAt: 1.2,
  /**
   * The title hint stays up through the title's hold and fades over the
   * next `hintOut` of film progress, as the drive moves on.
   */
  hintFrom: STORY.titleWallTo,
  hintOut: 0.05,
  /** After her first input the hint says "you have the wheel" this long (s)... */
  ackHold: 2,
  /** ...then fades out over this long. */
  ackFade: 0.4,
} as const;

export type PromptInput = {
  /** She has given forward input since entering. */
  started: boolean;
  /** Seconds since that first input. */
  sinceStart: number;
  /** Film position of the picture. */
  p: number;
  /** A card is up: it carries its own marker. */
  card: boolean;
  /** Going back: nothing asks her for more. */
  rewinding: boolean;
  /** Seconds since her last input. */
  idle: number;
};

/**
 * The one prompt that says what to do next, or null when the picture
 * already says it (a card and its marker) or she is busy scrolling. Every
 * resting position of the film gets one (tested): the title hint before
 * she starts, "you have the wheel" right after, the between-card cue
 * wherever no card is up, and the way into the city from the fade.
 */
export function promptFor(input: PromptInput): Prompt | null {
  if (input.p >= STORY.endFrom) return input.idle >= STORY.endIdle ? "end" : null;
  if (!input.started) return "hint";
  if (input.sinceStart < PROMPT.ackHold + PROMPT.ackFade && input.p < PROMPT.hintFrom + PROMPT.hintOut) return "ack";
  if (input.card || input.rewinding) return null;
  return input.idle >= STORY.cueIdle ? "between" : null;
}

/** Opacity of the hint in the letterbox bar: it fades as the drive moves, and after the "you have the wheel" beat. */
export function hintOpacity(input: PromptInput): number {
  const prompt = promptFor(input);
  if (prompt !== "hint" && prompt !== "ack") return 0;
  const moved = 1 - Math.min(1, Math.max(0, (input.p - PROMPT.hintFrom) / PROMPT.hintOut));
  if (prompt === "hint") return moved;
  const left = Math.min(1, Math.max(0, (PROMPT.ackHold + PROMPT.ackFade - input.sinceStart) / PROMPT.ackFade));
  return Math.min(moved, left);
}

/** The first this many read cards label their marker with the input's word (SCROLL, SWIPE UP, SPACE). */
export const CUE_LABELS = 3;

/** Attract tease, 0..1: ease-out up over 0.28 s, ease-in-out down over 0.5 s. */
export function teaseOffset(t: number): number {
  const up = 0.28;
  const down = 0.5;
  if (!(t >= 0) || t > up + down) return 0;
  if (t <= up) {
    const u = t / up;
    return 1 - (1 - u) * (1 - u) * (1 - u);
  }
  const u = (t - up) / down;
  const inOut = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  return 1 - inOut;
}

/**
 * The Skip prompt's patience. `fightLevel` integrates seconds of pushing
 * against a wall at FF pace over a 6 s window; at `expandAt` Skip offers
 * itself for `show` seconds, at most `maxShows` times a visit and
 * `cooldown` seconds apart. A native jump of `jumpVh` viewports offers it at once.
 */
export const FIGHT = { window: 6, expandAt: 2.5, show: 6, cooldown: 25, maxShows: 2, jumpVh: 1 } as const;

export function fightLevel(level: number, pushing: boolean, dt: number): number {
  const step = Math.max(0, dt);
  return level * Math.exp(-step / FIGHT.window) + (pushing ? step : 0);
}

/**
 * The "let the man finish" note, above an unread card the first `maxShows`
 * times a visit she pushes into it: as soon as the input held there,
 * decaying with `tau` seconds, reaches `share` of the viewport height (most
 * of one wheel notch, a short swipe), so her first push is answered at once.
 */
export const HOLD_NOTE = { share: 0.06, tau: 0.4, maxShows: 3 } as const;

/** Attract teases on the idle title screen, seconds after entering. */
export const TEASES = [6, 14, 22] as const;

/** Reminders on a read card, seconds of idle. */
export const REMINDERS = [10, 25] as const;

export type KeyAction = "next" | "prev" | "down" | "up" | "home" | "skip";
export type TargetKind = "text" | "button" | "link" | "other";

export type KeyInput = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  /** What has focus: a text field, a button, a link or anything else. */
  targetKind: TargetKind;
};

/**
 * What a key does in the pinned hero. Modifiers and text fields keep their
 * own keys; Space never takes over a focused button or link.
 */
export function keyAction(input: KeyInput): KeyAction | null {
  if (input.ctrlKey || input.altKey || input.metaKey) return null;
  if (input.targetKind === "text") return null;
  switch (input.key) {
    case " ":
    case "Spacebar":
      if (input.targetKind === "button" || input.targetKind === "link") return null;
      return input.shiftKey ? "prev" : "next";
    case "PageDown":
      return "next";
    case "PageUp":
      return "prev";
    // W and S too: in games W drives forward and S backs up.
    case "ArrowDown":
    case "w":
    case "W":
      return "down";
    case "ArrowUp":
    case "s":
    case "S":
      return "up";
    case "Home":
      return "home";
    case "End":
    case "Escape":
      return "skip";
    default:
      return null;
  }
}

export const TAP = {
  /** A tap moves less than this (px)... */
  slop: 10,
  /** ...lasts less than this (ms)... */
  maxMs: 400,
  /** ...and comes this long after the last scroll input (ms). */
  afterScrollMs: 300,
} as const;

/** A press on the picture that counts as a tap (plays the next line). */
export function isPictureTap(input: {
  dx: number;
  dy: number;
  /** Duration of the press, ms. */
  ms: number;
  /** Since the last scroll input, ms. */
  sinceScroll: number;
  button: number;
}): boolean {
  return (
    input.button === 0 &&
    Math.hypot(input.dx, input.dy) < TAP.slop &&
    input.ms < TAP.maxMs &&
    input.sinceScroll >= TAP.afterScrollMs
  );
}

export const SKIP_GUARD = {
  /** A touch on Skip this soon after a scrolling touchend is a stray (ms). */
  afterTouchEnd: 300,
  /** ...or this soon after Skip appeared (ms). */
  afterShown: 600,
  /** ...or a press that moved this far (px) or lasted this long (ms). */
  slop: 10,
  holdMs: 600,
} as const;

/** Whether an activation of Skip counts. Mouse and keyboard always do. */
export function skipTapAllowed(input: {
  pointerType: string;
  /** Since the last touchend that scrolled, ms. */
  sinceTouchEnd: number;
  /** Since Skip became visible, ms. */
  sinceShown: number;
  /** How far the pointer moved, px. */
  moved: number;
  /** How long the press lasted, ms. */
  ms: number;
}): boolean {
  if (input.pointerType !== "touch") return true;
  return (
    input.sinceTouchEnd >= SKIP_GUARD.afterTouchEnd &&
    input.sinceShown >= SKIP_GUARD.afterShown &&
    input.moved < SKIP_GUARD.slop &&
    input.ms < SKIP_GUARD.holdMs
  );
}
