/**
 * The wall after the character select: until Jesús is chosen, her
 * scrolling stops where the line-up's foot meets the bottom of the screen
 * (on a phone, where his strip is a screen tall, no lower than keeps his
 * head in view), so the select is in view and the career city waits. Pure;
 * CharacterSelect.tsx writes the wall to `selectGate` (SmoothScroll trims
 * wheel and touch input to it, as to the hero's and the career city's) and
 * keeps the page there.
 *
 * Built like the other walls:
 * - Her input never passes it: wheel and touch are trimmed by the gate,
 *   and what is held there bounces the board and brings up "Choose your
 *   character to continue". Keys that scroll the page are held at the
 *   wall here (`keyAtWall`).
 * - Whatever else moves the page past it goes back, if it was hers (a
 *   recent wheel, touch or key, a finger's fling, the scrollbar dragged
 *   with a pointer held down or its track clicked, a push the wall is
 *   still pulling back); a move with no input of hers is navigation
 *   (find in page, a screen reader, a script's jump) and opens it, as the
 *   career city does (lib/navigate.ts isNavigation). Links, Skip, deep
 *   links and Back go through `goTo`, which opens the wall first (the
 *   select registers itself as a passage), and so does the focus moving
 *   past it.
 * - Once she has chosen, the wall is gone for the visit: she scrolls on
 *   and back as she likes.
 */
import { GATE } from "@/features/hero/scroll/gate";
import { isNavigation } from "@/lib/navigate";

/**
 * The scroll wall of the select (px of page scroll) the gate trims to.
 * Infinity when nothing holds (chosen, opened, no script, no select).
 */
export const selectGate = {
  maxScroll: Number.POSITIVE_INFINITY,
};

/**
 * Where the wall stands: the page scroll at which the select's foot meets
 * the bottom of a `screen` px tall screen, never above the select's own
 * top (a select shorter than the screen holds the page at its top). On a
 * phone, where his strip stands under the cats' and the select runs
 * screens long (`crown.stacked`), it stands no lower than keeps his crown
 * (`crown.top`, page px) in view `headroom` px under the top of the
 * screen: she can always see the one she can choose. With the five in one
 * row (a short desktop window, a phone on its side) the foot decides, even
 * when the row is taller than the screen: held at his crown, the plates
 * and their words were out of reach.
 */
export function selectFrontier(
  section: { top: number; bottom: number },
  screen: number,
  crown?: { top: number; stacked: boolean },
  headroom = 0,
): number {
  const foot = section.bottom - screen;
  const head = crown && crown.stacked && Number.isFinite(crown.top) ? crown.top - headroom : foot;
  return Math.max(section.top, Math.min(foot, head));
}

/** His slot stands under the cats' (a phone's strips), not beside them in one row. */
export function isStacked(player: { top: number }, cats: readonly { bottom: number }[]): boolean {
  return cats.length > 0 && cats.every((cat) => player.top >= cat.bottom - 1);
}

/** Room kept over his crown at the wall (rem): the page controls and the flag over his head. */
export const CROWN_HEADROOM_REM = 7;

/**
 * A move this soon (ms) after a mouse press on the scrollbar (the page's
 * root, outside any element) is that press's: a click on the track steps
 * the page with an animation that runs on after the button is up.
 */
export const BAR_WINDOW_MS = 600;

/**
 * A move this soon (ms) after the wall pulled the page back is the same
 * push going on: a native fling outlives every input window (on a phone
 * under reduced motion it ran on 1.5 s after the lift), and once read as
 * navigation it opened the wall. Only a page at rest is navigated.
 */
export const PULL_WINDOW_MS = 250;

/**
 * What the select does about the page this frame, with the wall closed at
 * `wall`: nothing while the page is at or before it, `back` to the wall
 * when her own input took it past (a wheel, a finger or a key in the input
 * window, a fling just lifted, a pointer held on the scrollbar or a click
 * on its track just before, a push the wall was already pulling back),
 * `open` when nothing of hers did (navigation).
 */
export type WallVerdict = "none" | "back" | "open";

export function wallVerdict(input: {
  scroll: number;
  wall: number;
  now: number;
  lastInputAt: number;
  liftedAt?: number;
  pointerHeld?: boolean;
  barAt?: number;
  pulledAt?: number;
}): WallVerdict {
  if (!Number.isFinite(input.wall) || input.scroll - input.wall <= GATE.snapSlop) return "none";
  if (input.pointerHeld) return "back";
  if (input.barAt !== undefined && input.now - input.barAt < BAR_WINDOW_MS) return "back";
  if (input.pulledAt !== undefined && input.now - input.pulledAt < PULL_WINDOW_MS) return "back";
  return isNavigation(input.lastInputAt, input.now, input.liftedAt) ? "open" : "back";
}

/** Keys that scroll the page forward, and how far (px, with a `screen` px tall screen); Infinity: to the end. */
export function keyForward(
  event: { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean },
  target: "field" | "control" | "page",
  screen: number,
): number | null {
  if (target === "field") return null;
  const { key } = event;
  if (key === "End" || (key === "ArrowDown" && (event.metaKey || event.ctrlKey))) return Number.POSITIVE_INFINITY;
  if (event.altKey || event.metaKey || event.ctrlKey) return null;
  if (key === "PageDown") return screen * 0.875;
  if (key === "ArrowDown") return 40;
  // Space on a control presses it; Shift+Space scrolls back.
  if (key === " " && target !== "control" && !event.shiftKey) return screen * 0.875;
  return null;
}

/**
 * A forward key with the wall closed: `native` when its scroll stays short
 * of the wall (the browser scrolls as ever), `glide` when it would pass
 * it (the page glides to the wall instead, and she feels it), `hold` when
 * the page is already there (a bounce, and the prompt).
 */
export function keyAtWall(scroll: number, wall: number, amount: number): "native" | "glide" | "hold" {
  if (!Number.isFinite(wall)) return "native";
  if (scroll >= wall - 1) return "hold";
  return scroll + amount > wall ? "glide" : "native";
}

/** How long the prompt stays up after her last push at the wall (ms). */
export const PROMPT_MS = 1400;
