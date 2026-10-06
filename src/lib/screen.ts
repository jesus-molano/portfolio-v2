/**
 * The screen's height as the page is laid out with it: one hundredth of the
 * small and of the large viewport height, as `--va-svh` and `--va-lvh` on
 * the root element, held still while a phone's browser shows and hides its
 * bars.
 *
 * Standard phone browsers already keep `svh` and `lvh` still while the
 * address bar and the toolbar come and go (only `dvh`, `innerHeight` and a
 * resize event follow them), but the in-app browsers and the iOS browsers
 * that resize their web view to hide their bars (and device emulation)
 * change every viewport unit with them. Everything the page lays out in
 * the flow then grew and shrank on every change of direction: the hero's
 * stage is six screens tall, so the page under her finger jumped by six
 * times the bar's height. A bar-only resize (same width, a height change
 * under `BAR_SLACK_PX`, a touch screen) keeps the last values; a real one
 * (a rotation, a resized window, a split view) takes the new ones.
 *
 * The CSS defaults (globals.css) are `1svh` and `1lvh`; the values written
 * here start as exactly those, so writing them moves nothing.
 */

/** A bar-only resize changes the height by less than this (the tallest bars, an iOS toolbar and its address bar, are ~120 px). */
export const BAR_SLACK_PX = 160;

/** The viewport the page is laid out with, in CSS px. */
export type Screen = { width: number; small: number; large: number };

/**
 * Whether `next` is only the browser's bars coming or going since `prev`:
 * the same width, the heights within `BAR_SLACK_PX`, on a touch screen (a
 * desktop window has no bars: any height change of it is real).
 */
export function isBarResize(prev: Screen, next: Screen, touch: boolean): boolean {
  return (
    touch &&
    Math.abs(next.width - prev.width) < 0.5 &&
    Math.abs(next.small - prev.small) < BAR_SLACK_PX &&
    Math.abs(next.large - prev.large) < BAR_SLACK_PX
  );
}

/** The screen the page keeps after a resize from `prev` to `next`. */
export function keptScreen(prev: Screen | null, next: Screen, touch: boolean): Screen {
  return prev && isBarResize(prev, next, touch) ? prev : next;
}

let kept: Screen | null = null;
let probes: { small: HTMLElement; large: HTMLElement } | null = null;
let listening = false;

function probe(height: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;contain:strict;height:100vh";
  el.style.setProperty("height", height);
  document.body.appendChild(el);
  return el;
}

function measured(): Screen {
  probes ??= { small: probe("100svh"), large: probe("100lvh") };
  const small = probes.small.getBoundingClientRect().height || window.innerHeight;
  const large = probes.large.getBoundingClientRect().height || window.innerHeight;
  return { width: window.innerWidth, small, large: Math.max(small, large) };
}

/**
 * The screen the page is laid out with, re-read now (a viewport change
 * reads it before measuring anything): the kept one through a bar-only
 * resize. Writes `--va-svh` and `--va-lvh` when they change. On the server,
 * a desktop screen.
 */
export function stableScreen(): Screen {
  if (typeof window === "undefined" || typeof document === "undefined" || !document.body) {
    return { width: 1440, small: 900, large: 900 };
  }
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const next = keptScreen(kept, measured(), touch);
  if (next !== kept) {
    const root = document.documentElement.style;
    if (!kept || kept.small !== next.small) root.setProperty("--va-svh", `${next.small / 100}px`);
    if (!kept || kept.large !== next.large) root.setProperty("--va-lvh", `${next.large / 100}px`);
    kept = next;
  }
  if (!listening) {
    listening = true;
    window.addEventListener("resize", () => stableScreen());
  }
  return kept;
}
