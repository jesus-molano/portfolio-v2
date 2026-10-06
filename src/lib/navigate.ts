/**
 * Every move of the page that is not her scrolling goes through here: an
 * in-page link (the STATS booth, a mission, the skip link), a deep link or
 * a fragment change (components/PageEntry.tsx), back to top, the STATS
 * tabs, Skip, Esc and End, the still hero keeping her place, the loading
 * screen starting at the top.
 *
 * Two rules:
 * - The page and Lenis move together. A native jump (`scrollIntoView`,
 *   the browser following a link) leaves Lenis where it was whenever it
 *   misses the scroll event (it drops the one after its own landing or an
 *   immediate jump, and ignores them while it glides), and her next wheel
 *   notch or swipe then scrolls on from there: one notch after the booth
 *   took her to the cinema, the page flew back up to the hero's end. So
 *   Lenis is re-measured and stopped, the page moved, and Lenis stood
 *   where the page landed, in the same task.
 * - A page sent past a passage (the hero, whose walls hold the scroll for
 *   its film) opens it first, as the focus moving past it does: a link to
 *   a later section is her moving on, not a jump the hero pulls back.
 *
 * History: an in-page link adds an entry as the browser's jump would
 * (`pushFragment`), the entry she leaves remembering where the page was,
 * and Back goes there through `goTo` (PageEntry); back to top drops the
 * fragment (`clearFragment`).
 *
 * Pure helpers (`fragmentTarget`, `landingY`, `landsPast`, `placeOf`,
 * `withPlace`) are unit tested in navigate.test.ts; `goTo` applies them.
 */
import type Lenis from "lenis";

/**
 * What moves the page smoothly: Lenis, registered by SmoothScroll
 * (scroll/SmoothScroll.tsx). `reset` (stop any glide, stand where the
 * page is) is public at runtime but private in Lenis' types; the Lenis
 * contract test guards it.
 */
export type Scroller = Pick<Lenis, "scrollTo" | "resize" | "animatedScroll" | "targetScroll"> & { reset(): void };

/**
 * A section whose scroll is held until it opens (the hero film's walls,
 * HeroStage): a page sent past it opens it first, without moving.
 */
export type Passage = { section: HTMLElement; open: () => void };

let scroller: Scroller | null = null;
let passage: Passage | null = null;

/** SmoothScroll registers its Lenis while it lives; the newest one wins. */
export function registerScroller(next: Scroller): () => void {
  scroller = next;
  return () => {
    if (scroller === next) scroller = null;
  };
}

/** HeroStage registers its section and how it opens while it is mounted; the newest one wins. */
export function registerPassage(next: Passage): () => void {
  passage = next;
  return () => {
    if (passage === next) passage = null;
  };
}

export function getPassage(): Passage | null {
  return passage;
}

/**
 * The element id an in-page link points to, or null when the link leaves
 * the page (another path, origin or query) or names no element ("#" alone).
 * `href` and `here` are absolute URLs (an anchor's `href` property,
 * `location.href`).
 */
export function fragmentTarget(href: string, here: string): string | null {
  let to: URL;
  let from: URL;
  try {
    to = new URL(href);
    from = new URL(here);
  } catch {
    return null;
  }
  if (to.origin !== from.origin || to.pathname !== from.pathname || to.search !== from.search) return null;
  const raw = to.hash.slice(1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed escape: the browser looks the raw text up too.
    return raw;
  }
}

/**
 * Where the page lands to bring an element to the top, as
 * `scrollIntoView({ block: "start" })` would: its top on the page, less
 * its own scroll-margin and the page's scroll-padding (the fixed page
 * controls), within the page. Values from getComputedStyle may be NaN.
 */
export function landingY(input: { top: number; scrollY: number; scrollMargin: number; scrollPadding: number; limit: number }): number {
  const margin = Number.isFinite(input.scrollMargin) ? input.scrollMargin : 0;
  const padding = Number.isFinite(input.scrollPadding) ? input.scrollPadding : 0;
  const y = input.top + input.scrollY - margin - padding;
  return Math.min(Math.max(0, input.limit), Math.max(0, y));
}

/**
 * A move lands past a passage ending at `end` (page px): an element that
 * comes after it in the document (`follows`), or a page position at or
 * past its end.
 */
export function landsPast(to: { y: number; follows: boolean | null }, end: number): boolean {
  if (to.follows !== null) return to.follows;
  return to.y >= end - 1;
}

/**
 * Where the page was in a history entry, kept in the entry's state beside
 * Next's own keys: an in-page link writes it into the entry she leaves
 * (`pushFragment`), and Back (PageEntry's popstate) takes the page there.
 */
export const PLACE = "vaPlace";

/** The place a history entry remembers (page px), or null if none. */
export function placeOf(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const y = (state as Record<string, unknown>)[PLACE];
  return typeof y === "number" && Number.isFinite(y) && y >= 0 ? y : null;
}

/** A copy of a history entry's state with `y` as its place (null: none). */
export function withPlace(state: unknown, y: number | null): Record<string, unknown> {
  const next: Record<string, unknown> = state && typeof state === "object" ? { ...(state as Record<string, unknown>) } : {};
  if (y === null) delete next[PLACE];
  else next[PLACE] = Math.max(0, Math.round(y));
  return next;
}

/**
 * Follows an in-page link as the browser's own jump would leave the
 * history: a new entry whose address names `hash`, and the entry she
 * leaves remembering where the page was, so Back returns there (never a
 * dead Back). The page itself moves with `goTo`.
 */
export function pushFragment(hash: string): void {
  const { history } = window;
  history.replaceState(withPlace(history.state, window.scrollY), "");
  history.pushState(withPlace(history.state, null), "", hash);
}

/**
 * Drops the fragment from the address (back to top): a reload then starts
 * at the top, never at the section an earlier link named.
 */
export function clearFragment(): void {
  const { history, location } = window;
  if (!location.hash) return;
  history.replaceState(withPlace(history.state, null), "", location.pathname + location.search);
}

export type GoToOptions = {
  /**
   * What takes the keyboard focus once there, without scrolling: the
   * target element itself by default, `null` for nothing.
   */
  focus?: HTMLElement | null;
  /** Glide there over this many seconds (Lenis); at once by default. */
  glide?: number;
  /** The glide's easing (t from 0 to 1); Lenis' own by default. */
  easing?: (t: number) => number;
  /** Called once the page is there (after the glide). */
  onArrive?: () => void;
};

/** Focuses an element where it is; one that cannot take the focus can while it has it. */
export function focusInPlace(element: HTMLElement): void {
  if (element.tabIndex < 0 && !element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
    element.addEventListener("blur", () => element.removeAttribute("tabindex"), { once: true });
  }
  element.focus({ preventScroll: true });
}

function pageLimit(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

/**
 * Takes the page to an element (its top, as an in-page link would land
 * it) or a page position: Lenis and the page together, a passage on the
 * way past opened first, then the focus.
 */
export function goTo(to: HTMLElement | number, options: GoToOptions = {}): void {
  const element = typeof to === "number" ? null : to;
  let y: number;
  if (element) {
    const root = getComputedStyle(document.documentElement);
    y = landingY({
      top: element.getBoundingClientRect().top,
      scrollY: window.scrollY,
      scrollMargin: Number.parseFloat(getComputedStyle(element).scrollMarginTop),
      scrollPadding: Number.parseFloat(root.scrollPaddingTop),
      limit: pageLimit(),
    });
  } else {
    y = Math.min(Math.max(0, pageLimit()), Math.max(0, to as number));
  }

  const held = passage;
  if (held?.section.isConnected) {
    const end = held.section.getBoundingClientRect().bottom + window.scrollY;
    // An element is past it if it comes after it (not inside it, not around it); a position, by where it is.
    const follows = element
      ? !held.section.contains(element) &&
        Boolean(held.section.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      : null;
    if (landsPast({ y, follows }, end)) held.open();
  }

  const focus = options.focus === undefined ? element : options.focus;
  const arrive = () => {
    if (focus?.isConnected) focusInPlace(focus);
    options.onArrive?.();
  };

  const lenis = scroller;
  if (!lenis) {
    window.scrollTo({ top: y, behavior: "instant" });
    arrive();
    return;
  }
  // Lenis starts from where the page really is, with the page's current
  // height (a tab that just opened, a picture that just loaded: its
  // scrollTo clamps to the height it last measured), and any glide stopped.
  lenis.resize();
  lenis.reset();
  if (options.glide && options.glide > 0) {
    lenis.scrollTo(y, { duration: options.glide, easing: options.easing, force: true, onComplete: arrive });
    // Already there: Lenis completes at once, and has called `arrive`.
    return;
  }
  // The page goes there, and Lenis stands where it landed. Not Lenis' own
  // immediate scrollTo: that drops the next native scroll event, until the
  // next frame (seconds on a slow device), so a native move right after
  // (the scrollbar, find in page) would leave it behind again.
  window.scrollTo({ top: y, behavior: "instant" });
  lenis.animatedScroll = lenis.targetScroll = window.scrollY;
  arrive();
}
