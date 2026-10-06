/**
 * The dash: an F1 steering-wheel display for the hero (HeroStage draws
 * it, Hero.module.css styles it). Fifteen shift lights are her throttle,
 * the big italic number is the car's speed, one word says what the car
 * does, and while an unread line holds the film the pit limiter engages:
 * the dash turns cyan, an 80 sign comes up whose ring fills with the
 * card's reading bar, the last five lights lock behind a gate, and the car
 * holds 80 km/h (throttle.ts LIMITER). When the line has been read the
 * limiter drops (ALL CLEAR) and the car surges out of the pit lane.
 *
 * Pure functions, so the frame stays cheap and the rules are tested; the
 * tick writes attributes and custom properties only.
 */
import { STORY } from "./story";
import { paceFor, THROTTLE } from "./throttle";
import { PROMPT, type TransportMode } from "./transport";

export const DASH = {
  /** Shift lights, in three groups of five: sodium, orange, magenta. */
  leds: 15,
  /** Her throttle's reach under the limiter; lights 11 to 15 are locked. */
  limiterLeds: 10,
  /** The strip follows her throttle up fast and down slowly, seconds. */
  revRise: 0.05,
  revFall: 0.3,
  /** Seconds ALL CLEAR stays up once a line has been read. */
  clearHold: 0.8,
  /** Seconds the warm release sweep needs (the last light's start plus its 240 ms). */
  releaseSweep: 0.45,
  /** Seconds the ignition self-test runs the first time the dash shows. */
  boot: 0.7,
  /** Decay of the strip's flare after an input of hers, seconds. */
  kickTau: 0.12,
  /** How far the title has gone (0..1) before the dash may show on tall and compact screens. */
  titleClear: 0.85,
  /** A title tease's blip on the idle strip (desktop, before her first input). */
  teaseRevs: 0.4,
  /** Seconds: pushing on the limiter needs a push held at the wall and an input of hers this recent. */
  hitInput: 0.3,
  /** Width of the status slot, in em of the dash: 19em less the padding, the speed and the gap. */
  slotEm: 9.3,
  /** The limit sign's diameter and the gap before it, in em of the dash. */
  signEm: 2.3,
  signGapEm: 0.5,
} as const;

/**
 * The three layouts, as media queries (verbatim in Hero.module.css, so CSS
 * and JS agree): wide windows put the dash in GTA's radar corner, bottom
 * left; tall ones (phones, portrait tablets) in the sky under the page
 * controls, centred; any other landscape window (small or short) top left. At exactly 1:1 both aspect queries match: wide wins
 * there when the window is big enough, tall otherwise.
 */
export const DASH_MEDIA = {
  wide: "(min-aspect-ratio: 1/1) and (min-width: 1024px) and (min-height: 501px)",
  tall: "(max-aspect-ratio: 1/1)",
} as const;

export type DashLayout = "wide" | "tall" | "compact";

/** The layout for the viewport, given a media query matcher (window.matchMedia). */
export function dashLayout(matches: (query: string) => boolean): DashLayout {
  if (matches(DASH_MEDIA.wide)) return "wide";
  if (matches(DASH_MEDIA.tall)) return "tall";
  return "compact";
}

/** Her throttle, 0..1, from the meter rate (viewport heights a second): the share of the pace's gain she asks for. */
export function throttleOf(rate: number): number {
  return (paceFor(rate) - 1) / THROTTLE.gain;
}

/**
 * What the strip shows of her throttle: her input's (the meter's rate,
 * viewport heights a second) or her foot on the pedal (0..1, what its
 * plate shows), whichever is further down. The pedal and the strip always
 * say the same thing.
 */
export function stripThrottle(rate: number, foot: number): number {
  const pedal = Number.isFinite(foot) ? Math.min(1, Math.max(0, foot)) : 0;
  return Math.max(throttleOf(rate), pedal);
}

/** Eases the strip's revs toward `target` over `dt` seconds: up with revRise, down with revFall; stays in 0..1. */
export function easeRevs(revs: number, target: number, dt: number): number {
  const goal = Math.min(1, Math.max(0, target));
  const tau = goal > revs ? DASH.revRise : DASH.revFall;
  const next = revs + (goal - revs) * (1 - Math.exp(-Math.max(0, dt) / tau));
  return Math.min(1, Math.max(0, next));
}

/** Shift lights lit for `revs`: at least one (the dash is on), at most ten while the limiter holds. */
export function litLeds(revs: number, limited: boolean): number {
  const lit = Math.ceil(DASH.leds * revs - 0.25);
  return Math.min(limited ? DASH.limiterLeds : DASH.leds, Math.max(1, Number.isFinite(lit) ? lit : 1));
}

export type Limiter = "off" | "armed" | "hit";

/**
 * The pit limiter: off without an unread line up (`unreadCard`), armed
 * while one is, and "hit" while she pushes on it: input held at the wall
 * (`holding`: the gate trimmed a push of hers in the last 300 ms) and an
 * input event of hers in the last DASH.hitInput seconds (`sinceInput`), so
 * a fling's leftover pressure after the finger has lifted is not a push.
 */
export function limiterState(input: { unreadCard: boolean; holding: boolean; sinceInput: number }): Limiter {
  if (!input.unreadCard) return "off";
  return input.holding && input.sinceInput < DASH.hitInput ? "hit" : "armed";
}

export type DashShow = "hidden" | "reverse" | "limiter" | "clear" | "prompt" | "floored" | "drive";

/**
 * What the dash says; the first rule that matches wins. Before her first
 * input it asks with her gesture (desktop shows it dimmed on the title);
 * going back it says REVERSE; for DASH.clearHold after a line has been
 * read, ALL CLEAR (`clearing`); while an unread line is up, LIMITER; once
 * the car waits for her (the transport says waiting), her gesture again;
 * then FLAT OUT or YOU DRIVE.
 */
export function dashShow(input: {
  p: number;
  started: boolean;
  mode: TransportMode;
  limiter: Limiter;
  clearing: boolean;
}): DashShow {
  if (input.p >= STORY.fadeFrom) return "hidden";
  if (!input.started) return "prompt";
  if (input.mode === "reverse") return "reverse";
  if (input.clearing) return "clear";
  if (input.limiter !== "off") return "limiter";
  if (input.mode === "waiting") return "prompt";
  if (input.mode === "floored") return "floored";
  return "drive";
}

export type DashVis = "off" | "idle" | "on";

/**
 * Whether the dash shows. Never from the fade to night on. On wide screens
 * it wakes dimmed ("idle") with the title hint, on the black letterbox bar,
 * and comes fully on with her first input. On tall and compact screens it
 * takes the title's place, so it shows only once the title has all but
 * gone (`titleOut`, 0..1, the title's position-based fade) and goes again
 * if she rewinds to it. The radio's one-time callout never takes its
 * place: on tall screens it hangs below the dash (RadioButton.module.css).
 */
export function dashVisibility(input: {
  layout: DashLayout;
  started: boolean;
  /** Seconds since she entered the site; negative before. */
  sinceEntered: number;
  titleOut: number;
  p: number;
}): DashVis {
  if (input.p >= STORY.fadeFrom) return "off";
  if (input.layout === "wide") {
    if (input.started) return "on";
    return input.sinceEntered >= PROMPT.hintAt ? "idle" : "off";
  }
  if (!input.started || input.titleOut < DASH.titleClear) return "off";
  return "on";
}

/** The speed in three fixed cells, right-aligned, leading cells blank (never a zero that reads as the letter O). */
export function speedCells(kmh: number): [string, string, string] {
  const value = Number.isFinite(kmh) ? Math.min(999, Math.max(0, Math.round(kmh))) : 0;
  const text = String(value);
  const at = (fromEnd: number) => (text.length >= fromEnd ? text[text.length - fromEnd] : "");
  return [at(3), at(2), at(1)];
}

/**
 * Width of a status word in em of the dash: JetBrains Mono advances 0.6em
 * a character, the status adds 0.16em of tracking, and it is set at
 * 0.8125em of the dash. The dictionary tests check every word fits the
 * slot (DASH.slotEm), LIMITER with its sign.
 */
export function statusEm(text: string): number {
  return Array.from(text).length * (0.6 + 0.16) * 0.8125;
}
