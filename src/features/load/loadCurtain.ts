/**
 * The load screen's rules, pure and tested (loadCurtain.test.ts); the
 * controller (curtainController.ts) runs them on the page.
 *
 * Loading a save jumps the page in the click, under a screen of night that
 * covers it in that same frame, and the screen lifts only once the place
 * she loads has been drawn: the images on her first screen loaded and
 * decoded, the chapter card's faces in, the hero's canvas or the city's
 * drawn afresh there. On a fast device that is the minimum (0.4 s); on a
 * slow phone it lasts as long as the work takes, with "Go in now" after
 * 2.5 s and a hard limit of 6 s, both counted in time she could see the
 * screen (a hidden tab counts for nothing, a frame the main thread held
 * for seconds counts in full). Nothing waits on a signal that may never
 * come: every check has its own limit.
 */

import type { SaveId } from "./saves";

export const LOAD = {
  /** The screen stays up at least this long (ms of visible time): never a flash. */
  minMs: 400,
  /** How often the controller asks whether the place is ready. */
  pollMs: 100,
  /** Polls in a row that must find everything ready (an image a later render adds is caught). */
  readyPolls: 2,
  /** Frames the browser must have painted since the jump. */
  paintedFrames: 2,
  /** A tip shows after this long (a fast load never shows one). */
  tipMs: 900,
  /** "Still loading", and the way in now, after this long. */
  slowMs: 2500,
  /** The screen lifts after this long whatever is left (the stage's own cover takes over). */
  capMs: 6000,
  /** Each check's own limit. */
  facesMs: 1500,
  imagesMs: 4000,
  heroMs: 2500,
  nightMs: 6000,
  /** The lift's fade (none under reduced motion), and the fallback if no transitionend comes. */
  fadeMs: 240,
  idleFallbackMs: 400,
  /** Fresh frames the hero's canvas must draw at the top. */
  heroFrames: 3,
  /** Fresh frames the city's canvas must draw after the jump. */
  nightFrames: 2,
  /** How far below the screen an image or a card still counts as on her first screen (px). */
  band: 64,
} as const;

/** Which canvas a slot lands on: the hero's, the city's, or none (the static sections). */
export type SlotScene = "hero" | "night" | "none";

export function slotScene(id: SaveId, reducedMotion: boolean): SlotScene {
  if (reducedMotion) return "none";
  if (id === "hero") return "hero";
  if (id === "work") return "night";
  return "none";
}

/** Time she could see the screen: a hidden tab's time never counts, a long frame counts in full. */
export type VisibleClock = { ms: number; last: number };

export function stepVisibleClock(clock: VisibleClock, now: number, visible: boolean): VisibleClock {
  return visible ? { ms: clock.ms + Math.max(0, now - clock.last), last: now } : { ms: clock.ms, last: now };
}

/** A box on her first screen (or just below it): drawn, with a size, crossing the screen. */
export function inBand(rect: { top: number; bottom: number; width: number; height: number }, vh: number): boolean {
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < vh + LOAD.band;
}

/** The hero is drawn at the top: its scene ready and fresh frames drawn since the jump (no canvas: nothing to wait for). */
export function heroDone(s: { ready: boolean; frames: number; framesAtJump: number; hasCanvas: boolean }): boolean {
  if (!s.hasCanvas) return true;
  return s.ready && s.frames - s.framesAtJump >= LOAD.heroFrames;
}

export type NightReadiness = "waiting" | "ready" | "failed";

/**
 * The city is drawn where she lands, or there is no city to wait for. Its
 * scene mounts near its stage only (`wanted`), and a mount is one long
 * task (five sets built, the window atlas painted): it must have mounted
 * (its canvas in the page) under the screen. Off screen, or resting under
 * the stage's own opaque night, it draws nothing, and that is all; on
 * screen it must have said ready and drawn fresh frames since the jump (a
 * scene still mounted from an earlier pass says ready from its old
 * place). A failed scene (no WebGL) has nothing to wait for: the stage
 * shows its text.
 */
export function nightDone(s: {
  wanted: boolean;
  mounted: boolean;
  onScreen: boolean;
  readiness: NightReadiness;
  frames: number;
  framesAtJump: number;
  covered: boolean;
}): boolean {
  if (!s.wanted || s.readiness === "failed") return true;
  if (!s.mounted) return false;
  if (!s.onScreen || s.covered) return true;
  if (s.readiness !== "ready") return false;
  return s.frames - s.framesAtJump >= LOAD.nightFrames;
}

/** A check is done when it is, or when its own limit has passed. */
export function checkDone(done: boolean, sinceMs: number, limitMs: number): boolean {
  return done || sinceMs >= limitMs;
}

/**
 * Hold or lift: lift on "Go in now", at the hard limit, or once the
 * minimum has passed, the browser has painted the new place and every
 * check has been done (or timed out) for `readyPolls` polls in a row.
 */
export function loadVerdict(s: { visibleMs: number; painted: number; okPolls: number; goNow: boolean }): "hold" | "lift" {
  if (s.goNow || s.visibleMs >= LOAD.capMs) return "lift";
  if (s.visibleMs >= LOAD.minMs && s.painted >= LOAD.paintedFrames && s.okPolls >= LOAD.readyPolls) return "lift";
  return "hold";
}

/** The bar: never back, never full before everything is in (a limit or "Go in now" never fills it). */
export function loadProgress(previous: number, done: number, total: number, allDone: boolean): number {
  if (allDone) return 1;
  return Math.max(previous, Math.min(0.95, done / Math.max(1, total)));
}

/** The keys that would move the page, play a line, drive or skip behind the screen. */
const PAGE_KEYS = new Set([
  "Escape",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
  "Spacebar",
  "Enter",
]);

/**
 * A key while the screen is up: "block" takes it (its default prevented,
 * so every page handler, which ignores a prevented key, leaves it, and
 * the browser scrolls nothing), "pass" lets it be. Tab passes (the focus
 * stays on the screen or its button); Enter or Space on "Go in now" pass
 * (the button's own); a shortcut that moves no page passes (reload, zoom,
 * find), but Ctrl+End and Cmd+Down do not (the hero takes them as Skip).
 * While the key that loaded is still down (`spent`), its autorepeat stays
 * blocked after the lift too: a held Enter never plays a line there.
 */
export function curtainKey(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  onGoNow: boolean;
  holding: boolean;
  spent: boolean;
}): "pass" | "block" {
  if (e.spent && e.repeat) return "block";
  if (!e.holding) return "pass";
  if (e.key === "Tab") return "pass";
  if (e.onGoNow && (e.key === "Enter" || e.key === " " || e.key === "Spacebar") && !e.repeat) return "pass";
  if ((e.ctrlKey || e.metaKey || e.altKey) && !PAGE_KEYS.has(e.key)) return "pass";
  return "block";
}
