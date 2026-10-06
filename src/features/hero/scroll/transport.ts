/**
 * The driving vocabulary of the hero: the transport mode the dash reads
 * (drive, waiting, floored, reverse; dash.ts turns it into YOU DRIVE, her
 * gesture while the car waits, FLAT OUT, REVERSE, and adds LIMITER and
 * ALL CLEAR) and the speedometer, which one prompt tells her what to do
 * next, the attract tease, the "let the man finish" note and the Skip
 * prompt's patience, plus the rules that decide which key, tap, focus or
 * Skip activation counts (W is the pedal's "gas", pedal.ts). No tape-deck
 * words or glyphs: the hero must never read as a video playing on its
 * own, and holding the pedal is driving, never "playing". Pure functions;
 * feedback.ts and HeroStage apply them.
 */
import { STORY } from "./story";
import { THROTTLE, WAIT } from "./throttle";

export type TransportMode = "hidden" | "reverse" | "waiting" | "floored" | "drive";

export const TRANSPORT = {
  /** Going back this recently (s) reads REVERSE. */
  reverseWindow: 0.25,
  /**
   * Idle this long (s) with a still picture, and nothing playing, reads
   * WAITING, and the car starts to brake to its crawl (feedback.ts). Long
   * enough that a calm scroller, a notch a second, never sees it blink
   * between her notches.
   */
  waitIdle: THROTTLE.crawlIdle,
  /**
   * ...and only once all that has held this long (s): a frame where the
   * picture stalls between two moves of her finger, or the moment a read
   * card hands over to the next one, is not her turn.
   */
  turnDwell: 0.3,
  /** Picture speed (progress per second) under which the picture counts as still. */
  stillSpeed: 0.002,
  /** A steady rhythm of input stretches the wait before WAITING to this share of her beat... */
  rhythmSlack: 1.2,
  /** ...up to this many seconds. */
  maxWaitIdle: 5,
  /** Input this close together (s) is one burst: a flick, a notch's momentum, autorepeat. */
  burstGap: 0.3,
  /** A pause longer than this (s) ends her rhythm: she stopped. */
  rhythmMax: 7,
  /**
   * Input this soon (s) after WAITING came up answered it: she waited to
   * be asked, so that pause is no beat of hers, and her rhythm keeps what
   * it was (learning it would make the next ask come later, and the one
   * after later still, up to maxWaitIdle). A calm reader's own beat, a
   * notch every 2.5 s or more, lands later than this into a WAITING she
   * has not learned yet.
   */
  answer: 1,
} as const;

/**
 * Her rhythm: the gap between her bursts of input, smoothed. `gap` is the
 * idle time that just ended with a new input. Bursts (gaps under
 * `burstGap`) do not count; a long stop (over `rhythmMax`) resets it.
 */
export function nextRhythm(rhythm: number, gap: number): number {
  if (!(gap >= TRANSPORT.burstGap)) return rhythm;
  if (gap > TRANSPORT.rhythmMax) return 0;
  return rhythm > 0 ? 0.6 * rhythm + 0.4 * gap : gap;
}

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
  /**
   * A beat at the picture is still playing: an unread card is up, the
   * title's name is forming or holding, the crane is rising. The film is
   * not waiting for her then; she is waiting for the line.
   */
  playing: boolean;
  /** Idle seconds before WAITING; TRANSPORT.waitIdle unless her rhythm asks for longer (waitIdleFor). */
  waitIdle?: number;
  /**
   * Seconds the conditions for WAITING (nothing playing, idle her wait, a
   * still picture) have held (feedback.ts); WAITING needs TRANSPORT.turnDwell.
   * Left out, they count as held long enough.
   */
  turnFor?: number;
  /**
   * She has held the pace at full throttle (feedback.ts: THROTTLE.ff for
   * THROTTLE.ffHold seconds, until it falls under THROTTLE.ffOff). Without
   * it, the pace alone decides, with the same hysteresis.
   */
  flatOut?: boolean;
};

/**
 * Her rhythm once an input ends a pause of `gap` seconds: the pause is a
 * beat of hers (nextRhythm), unless the input answered her turn, coming
 * within TRANSPORT.answer of WAITING (`waitingFor`, seconds the film had
 * waited for her when it came; -1: it was not waiting): she follows the
 * asks, and her rhythm stays as it was, so the next ask comes no later.
 */
export function rhythmAfter(rhythm: number, gap: number, waitingFor: number): number {
  if (waitingFor >= 0 && waitingFor < TRANSPORT.answer) return rhythm;
  return nextRhythm(rhythm, gap);
}

/**
 * How long to let her be still before the transport says WAITING, for a
 * visitor whose input comes every `rhythm` seconds (0: no rhythm yet). A
 * calm reader who scrolls a notch every 2.5 to 5 s is reading, not
 * waiting: the transport gives her a little more than her own beat, up to
 * `maxWaitIdle`.
 */
export function waitIdleFor(rhythm: number): number {
  return Math.min(TRANSPORT.maxWaitIdle, Math.max(TRANSPORT.waitIdle, TRANSPORT.rhythmSlack * rhythm));
}

/**
 * Whether her turn may start this frame: she has started, nothing plays at
 * the picture, she has been idle for her wait and the picture is still.
 * WAITING follows once this has held for TRANSPORT.turnDwell (feedback.ts).
 */
export function turnConditions(input: TransportInput): boolean {
  return (
    input.started &&
    !input.playing &&
    input.sinceInput >= (input.waitIdle ?? TRANSPORT.waitIdle) &&
    input.pictureSpeed < TRANSPORT.stillSpeed
  );
}

/**
 * The transport's mode, given last frame's (`previous`); the dash shows it
 * (dash.ts dashShow: WAITING reads as her gesture). The first rule that
 * matches wins. WAITING means "your turn": she has
 * stopped, the picture with her, nothing is playing, and that has lasted
 * a moment (`turnFor`); once on, it holds until she moves again, even if a
 * glide is still settling. The marker, the cues and the brake all follow
 * it, so the hero never says "your turn" in one place and "drive on" in
 * another. FLAT OUT turns on at THROTTLE.ff and off only under
 * THROTTLE.ffOff, so the dash never flickers at the threshold
 * (feedback.ts also asks for the pace to hold there a moment: one hard
 * swipe is a surge, not flat out).
 */
export function transportMode(input: TransportInput, previous: TransportMode = "hidden"): TransportMode {
  if (!input.started || input.p >= STORY.fadeFrom) return "hidden";
  if (input.sinceBackward < TRANSPORT.reverseWindow) return "reverse";
  if (
    !input.playing &&
    input.sinceInput >= (input.waitIdle ?? TRANSPORT.waitIdle) &&
    (previous === "waiting" ||
      (input.pictureSpeed < TRANSPORT.stillSpeed && (input.turnFor ?? TRANSPORT.turnDwell) >= TRANSPORT.turnDwell))
  ) {
    return "waiting";
  }
  if (input.flatOut ?? input.pace >= (previous === "floored" ? THROTTLE.ffOff : THROTTLE.ff)) return "floored";
  return "drive";
}

/** The speedometer, km/h: the cruise (18 m/s) reads 65, the pace scales it. */
export function speedKmh(pace: number, metresPerSecond = 18): number {
  return Math.max(0, Math.round(metresPerSecond * 3.6 * pace));
}

/**
 * The prompts: the title hint that asks her to take the wheel ("hint",
 * only before her first input), its answer ("ack": "you have the wheel"),
 * the hint that brings her back on the road once she has the wheel and
 * rests on the title ("onward": "keep driving", never "take the wheel"
 * again), the between-card cue and the way into the city.
 */
export type Prompt = "hint" | "ack" | "onward" | "between" | "end";

export const PROMPT = {
  /** Seconds after entering: the title hint pops in, Skip shows and the car starts to wait for her. */
  hintAt: 1.2,
  /**
   * The title hint stays up through the title's hold and fades over the
   * next `hintOut` of film progress, as the drive moves on.
   */
  hintFrom: STORY.titleWallTo,
  hintOut: 0.05,
  /**
   * After her first input the hint says "you have the wheel" while the
   * name forms and holds, and this long (s) after...
   */
  ackHold: 2,
  /** ...then fades out over this long. */
  ackFade: 0.4,
  /**
   * Resting on the title once she has the wheel (she rewound there, or
   * stopped as the name formed): the hint slot says "keep driving",
   * centred in the bottom bar, instead of the between-card cue, which
   * would sit on the bar's edge while the bars are in. Up to here the bars
   * are at most 3/8 out, so the hint still fits the bar.
   */
  titleRest: 0.06,
} as const;

export type PromptInput = {
  /** She has given forward input since entering. */
  started: boolean;
  /**
   * Seconds the answer to her first input has been up on its own: 0 while
   * the title still plays (the name forming and holding), then counting.
   */
  sinceStart: number;
  /** Film position of the picture. */
  p: number;
  /** A card is up: it carries its own marker. */
  card: boolean;
  /** Going back: nothing asks her for more. */
  rewinding: boolean;
  /** Seconds since her last input. */
  idle: number;
  /** Her turn: the transport says WAITING (transportMode). Cues ask for more only then. */
  turn: boolean;
};

/**
 * The one prompt that says what to do next, or null when the picture
 * already says it (a card and its marker) or it is not her turn. Every
 * resting position of the film gets one (tested): the title hint before
 * she starts, "you have the wheel" from her first input until the name
 * has formed and a beat after (HeroStage adds that the name is still
 * arriving while it does), "keep driving" whenever she rests on the title
 * after that, the between-card cue wherever else no card is up once it is
 * her turn, and the way into the city from the fade. Once she has the
 * wheel, nothing asks her to take it again.
 */
export function promptFor(input: PromptInput): Prompt | null {
  if (input.p >= STORY.endFrom) return input.idle >= STORY.endIdle ? "end" : null;
  if (!input.started) return "hint";
  if (input.sinceStart < PROMPT.ackHold + PROMPT.ackFade && input.p < PROMPT.hintFrom + PROMPT.hintOut) return "ack";
  if (input.card || input.rewinding || !input.turn) return null;
  return input.p < PROMPT.titleRest ? "onward" : "between";
}

/**
 * Opacity of the hint in the letterbox bar: before her first input it
 * fades as the drive moves, "you have the wheel" fades after its beat, and
 * "keep driving", resting on the title, shows in full.
 */
export function hintOpacity(input: PromptInput): number {
  const prompt = promptFor(input);
  if (prompt === "onward") return 1;
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
 * Whether she is pushing hard at a wall, for the Skip prompt's patience:
 * her demand (`paceFor` of her input, not the pace, which the pit limiter
 * caps at a card) at full throttle, held at a wall (`wall`, the frontier's
 * index, -1 once every beat is done).
 */
export function pushingHard(input: { demand: number; holding: boolean; wall: number }): boolean {
  return input.demand >= THROTTLE.ff && input.holding && input.wall >= 0;
}

/**
 * The "let the man finish" note, above an unread card, only under
 * sustained pushing: a push episode (input held at a wall with no pause of
 * `gap` seconds) whose pushes span `sustain` seconds and throw at least
 * `held` viewport heights against the wall. A frame counts as a push only
 * when the input held at the wall grew in it by more than `tail` viewports
 * a second (isNotePush): a trackpad fling's momentum tails off under that,
 * and a thumb resting on the glass, holding the card stretched, adds
 * nothing. Two flicks, however long, span well under a second; so does
 * one fling. They are answered by the card's bounce and the car's surge,
 * not by a scolding. A finger lifts between strokes, so on touch the
 * episode bridges a pause of up to `touchGap`: flicks that keep coming
 * (up to about one every 0.8 s) for over a second, or a finger dragging on
 * against the wall, bring the note; one swipe a second, a calm reader's
 * pace, never does. The note goes the moment she stops (`gap` seconds
 * after her last push, `touchGap` on touch) and shows on at most
 * `maxShows` lines a visit. Everything runs on real time, so a slow device
 * neither scolds sooner nor keeps the note up longer.
 */
export const HOLD_NOTE = { sustain: 1.2, held: 1, gap: 0.32, touchGap: 0.7, tail: 0.4, maxShows: 3 } as const;

/**
 * Whether this frame is a push for the note: `held` viewport heights of
 * input held at the wall arrived in it (the pressure grew by that much),
 * over `dt` real seconds, faster than HOLD_NOTE.tail. Nothing new held,
 * as under a resting thumb, is no push.
 */
export function isNotePush(held: number, dt: number): boolean {
  return dt > 0 && held / dt > HOLD_NOTE.tail;
}

export type HoldNote = {
  /** Seconds since the current push episode began (-1: none), and viewport heights it has held. */
  age: number;
  held: number;
  /** Seconds the episode's pushes span so far: from its first to its latest. */
  span: number;
  /** The card the note was last shown on (-1: none yet). */
  card: number;
  shows: number;
  visible: boolean;
};

export function newHoldNote(): HoldNote {
  return { age: -1, held: 0, span: 0, card: -1, shows: 0, visible: false };
}

/**
 * One frame of the note, `dt` real seconds. `sincePush`: seconds since
 * the last push (isNotePush); `held`: viewport heights held this frame;
 * `unreadCard`: the unread card up at the picture, its line playing, or
 * -1; `gap`: the pause that ends an episode (HOLD_NOTE.touchGap when her
 * input is a finger).
 */
export function stepHoldNote(
  note: HoldNote,
  sincePush: number,
  held: number,
  unreadCard: number,
  dt: number,
  gap: number = HOLD_NOTE.gap,
): void {
  const step = Math.max(0, dt);
  if (!(sincePush < gap)) {
    note.age = -1;
    note.held = 0;
    note.span = 0;
  } else {
    // A new episode began with the push `sincePush` seconds ago.
    note.age = note.age < 0 ? sincePush : note.age + step;
    note.held += Math.max(0, held);
    note.span = Math.max(note.span, note.age - sincePush);
  }
  const wants = unreadCard >= 0 && note.age >= 0 && note.span >= HOLD_NOTE.sustain && note.held >= HOLD_NOTE.held;
  if (wants && note.card !== unreadCard && note.shows < HOLD_NOTE.maxShows) {
    note.card = unreadCard;
    note.shows += 1;
  }
  note.visible = wants && note.card === unreadCard;
}

/** Attract teases on the idle title screen, seconds after entering. */
export const TEASES = [6, 14, 22] as const;

/**
 * Reminders while the film waits for her, in seconds of waiting (or, on
 * the fade, of the end cue): the read card lifts and labels its marker
 * again, the cue bobs again. The first comes with the deep crawl
 * (WAIT.deepAfter): a gentle escalation of a long wait.
 */
export const REMINDERS = [WAIT.deepAfter, 14] as const;

/**
 * Focus that lands this soon (ms) after a pointer press or release, with
 * no key pressed since, came from the pointer: the control does not keep
 * Space (see HeroStage targetKind). A Tab after a click is the keyboard's.
 */
export const POINTER_FOCUS_MS = 1000;

/**
 * Whether a focus is the pointer's: it lands right after a press or
 * release with no key since, or it comes back to a control the pointer
 * had focused (`ownedAt`, performance.now() of that focus) with no Tab
 * since. So the radio button, clicked open and handed the focus back when
 * Esc closes its wheel, still does not keep Space; reached with Tab, it
 * does.
 */
export function focusFromPointer(input: {
  /** performance.now() of the focus, of the last pointer press or release, of the last key press and of the last Tab. */
  focusAt: number;
  pointerAt: number;
  keyAt: number;
  tabAt?: number;
  /** When the pointer last focused this same control (undefined: never). */
  ownedAt?: number;
}): boolean {
  if (input.pointerAt > input.keyAt && input.focusAt - input.pointerAt < POINTER_FOCUS_MS) return true;
  return input.ownedAt !== undefined && input.ownedAt > (input.tabAt ?? Number.NEGATIVE_INFINITY);
}

/**
 * "gas" is the pedal (W): down drives, up lets go. Space is "next" (a line,
 * as ever) and HeroStage makes a held Space the pedal too, after its line.
 */
export type KeyAction = "next" | "prev" | "down" | "up" | "gas" | "home" | "skip";
export type TargetKind = "text" | "button" | "link" | "other";

export type KeyInput = {
  key: string;
  /** The physical key (KeyboardEvent.code): W is the pedal wherever the layout puts the letter (Z on AZERTY). */
  code?: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  /** What has focus: a text field, a button, a link or anything else. */
  targetKind: TargetKind;
  /** The focus is on the pedal: Space drives it and Enter is a tap on it (the next line). */
  onPedal?: boolean;
};

/**
 * What a key does in the pinned hero. Modifiers and text fields keep their
 * own keys; Space never takes over a focused button or link (the pedal
 * excepted: Space is its key). W is the pedal, matched by its physical
 * place first, as in games; S backs up. The page's own jumps to its ends
 * (Ctrl+End and Ctrl+Home, Cmd+Down and Cmd+Up on a Mac) act as End and
 * Home: the browser animates them, so the page ran past the wall for a
 * few frames, the next section showing, before the gate pulled it back.
 */
export function keyAction(input: KeyInput): KeyAction | null {
  if (input.targetKind === "text") return null;
  if ((input.ctrlKey || input.metaKey) && !input.altKey) {
    if ((input.ctrlKey && input.key === "End") || (input.metaKey && input.key === "ArrowDown")) return "skip";
    if ((input.ctrlKey && input.key === "Home") || (input.metaKey && input.key === "ArrowUp")) return "home";
  }
  if (input.ctrlKey || input.altKey || input.metaKey) return null;
  if (input.code === "KeyW") return "gas";
  switch (input.key) {
    case " ":
    case "Spacebar":
      if (!input.onPedal && (input.targetKind === "button" || input.targetKind === "link")) return null;
      return input.shiftKey ? "prev" : "next";
    case "Enter":
      return input.onPedal ? "next" : null;
    case "PageDown":
      return "next";
    case "PageUp":
      return "prev";
    case "w":
    case "W":
      return "gas";
    case "ArrowDown":
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

/** How long a skip key stays spent (ms): after a skip, and after an Esc a dialog took. */
export const SKIP_AGAIN = {
  afterSkipMs: 800,
  afterDialogEscMs: 800,
} as const;

/**
 * A key that would skip (Esc, End, Ctrl+End, Cmd+Down) that must not:
 * its own autorepeat, the same press again right after a skip (Esc Esc,
 * End End: the second went on past the line-up, natively or into the
 * next section's own handling), or an Esc right after one a dialog took
 * (she was closing the radio, not skipping the film). The page swallows
 * it (preventDefault) and nothing moves.
 */
export function skipSwallowed(input: {
  action: KeyAction | null;
  key: string;
  repeat: boolean;
  sinceSkipMs: number;
  sinceDialogEscMs: number;
}): boolean {
  if (input.action !== "skip") return false;
  if (input.repeat || input.sinceSkipMs < SKIP_AGAIN.afterSkipMs) return true;
  return input.key === "Escape" && input.sinceDialogEscMs < SKIP_AGAIN.afterDialogEscMs;
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
