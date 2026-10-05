/**
 * The loading screen's tips: which ones a visitor may see, in what order,
 * for how long, when the wait counts as slow, and which keys enter the
 * city. Pure functions, unit tested; LoadingScreen.tsx wires them up.
 *
 * The copy lives in the dictionaries (`loader.tips`): the same kinds and
 * conditions at every index in every language, each tip 120 characters at
 * most (i18n/dictionaries.test.ts).
 */
import { readingSeconds } from "@/features/hero/scroll/film";

/** `tip`: how to drive the site. `trivia`: a joke about the site or him. */
export type TipKind = "tip" | "trivia";

/**
 * Who may read a tip. `pointer`: a mouse or a trackpad, not a coarse
 * pointer. `touch`: a coarse pointer. `motion`: not reduced motion. All of
 * them must hold; an empty list is for everyone.
 */
export type TipCondition = "pointer" | "touch" | "motion";

export type LoaderTip = {
  kind: TipKind;
  when: readonly TipCondition[];
  text: string;
};

export type TipViewer = {
  /** `(pointer: coarse)`. */
  touch: boolean;
  /** `(prefers-reduced-motion: reduce)`. */
  reducedMotion: boolean;
};

/** Longest a tip may be, in characters: its card reserves three lines (four on a phone). */
export const TIP_MAX_CHARS = 120;

/** Shortest time a tip stays up, in seconds, however short it is. */
export const TIP_MIN_SECONDS = 5;

/** Time on top of its reading time before a tip moves on, in seconds. */
export const TIP_LINGER_SECONDS = 1.5;

export function eligible(tip: LoaderTip, viewer: TipViewer): boolean {
  return tip.when.every((condition) => {
    if (condition === "pointer") return !viewer.touch;
    if (condition === "touch") return viewer.touch;
    return !viewer.reducedMotion;
  });
}

/**
 * The tip the server renders first. Everyone gets `tips[0]` (a tip with no
 * device condition), except under reduced motion: then the first tip for
 * everyone (empty `when`). CSS picks between the two before any script
 * runs, so the first paint is already right.
 */
export function firstTip(tips: readonly LoaderTip[], reducedMotion: boolean): number {
  if (!reducedMotion) return 0;
  return Math.max(
    0,
    tips.findIndex((tip) => tip.kind === "tip" && tip.when.length === 0),
  );
}

/**
 * The order one visitor reads the tips in, as indices into `tips`: the
 * card the server rendered, then her other tips in authored order,
 * alternating with her trivia shuffled by `random`. When one kind runs
 * out, the rest of the other follows. The screen loops over the list.
 */
export function tipOrder(
  tips: readonly LoaderTip[],
  { touch, reducedMotion, random }: TipViewer & { random: () => number },
): number[] {
  const first = firstTip(tips, reducedMotion);
  const viewer = { touch, reducedMotion };
  const useful: number[] = [];
  const trivia: number[] = [];
  tips.forEach((tip, index) => {
    if (index === first || !eligible(tip, viewer)) return;
    (tip.kind === "tip" ? useful : trivia).push(index);
  });
  // Fisher–Yates, driven by the injected random so tests can pin it.
  for (let i = trivia.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [trivia[i], trivia[j]] = [trivia[j], trivia[i]];
  }
  const order = [first];
  // The first card is a tip, so a trivia comes next.
  let nextIsTrivia = true;
  while (useful.length > 0 || trivia.length > 0) {
    const from: number[] = (nextIsTrivia && trivia.length > 0) || useful.length === 0 ? trivia : useful;
    order.push(from.shift()!);
    nextIsTrivia = from === useful;
  }
  return order;
}

/** Seconds a tip stays up: its reading time (as the hero's cards) plus a beat, never under 5 s. */
export function tipDuration(text: string): number {
  return Math.max(TIP_MIN_SECONDS, readingSeconds(text) + TIP_LINGER_SECONDS);
}

/** The wait counts as slow after this long, if the scene is not loaded yet. */
export const SLOW_AFTER_MS = 8000;
/** ...or after this long without any progress. */
export const STALLED_AFTER_MS = 5000;

/**
 * True when the visitor has waited long enough to be offered a way in
 * before the scene has loaded. `sinceProgressMs` counts from the last time
 * the progress moved (from mount while it has not).
 */
export function isSlow({
  sinceMountMs,
  sinceProgressMs,
  progress,
}: {
  sinceMountMs: number;
  sinceProgressMs: number;
  progress: number;
}): boolean {
  if (progress >= 100) return false;
  return sinceMountMs >= SLOW_AFTER_MS || sinceProgressMs >= STALLED_AFTER_MS;
}

export type EnterKey = {
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
};

/**
 * "Press any key": one printable character, typed on purpose. Space and
 * Enter stay with the focused button; arrows, Page Down, Esc, Tab, Caps
 * Lock, F-keys and media keys do nothing (their names are words, not
 * characters), nor does a held key, an IME composition or a shortcut with
 * Ctrl, Alt or Meta (Ctrl+Shift+I, Cmd+L). Shift is fine: it makes a
 * capital letter. The hero ignores the key that entered (KEY_GUARD_MS), so
 * W or S does not also drive.
 */
export function entersOnKey(event: EnterKey): boolean {
  if (event.repeat || event.isComposing) return false;
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  if (event.key === " ") return false;
  return Array.from(event.key).length === 1;
}

/** "03" */
export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The percent as a fixed run of characters: figure spaces pad it to three
 * digits, so the number grows leftwards inside its box and the box never
 * moves or resizes.
 */
export function percentLabel(progress: number): string {
  const value = Math.min(100, Math.max(0, Math.round(progress)));
  return `${String(value).padStart(3, " ")}%`;
}
