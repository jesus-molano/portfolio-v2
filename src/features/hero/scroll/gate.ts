/**
 * The page scroll's wall, frame by frame. The story's frontier is a page
 * position (`scrollGate.maxScroll`, px): SmoothScroll trims her wheel,
 * touch and key input to it, so the input it gates never passes it; the
 * stage (HeroStage.gate) keeps the page itself there, whatever moved it.
 *
 * The rule: the page is never left past the frontier. If it ends up there
 * by any path the input gate did not trim (the scrollbar, find in page, an
 * anchor, a programmatic scroll, an extension, wheel events the browser
 * would not let the page cancel), the stage puts it back at the frontier
 * in the same frame, and a jump of a viewport or more offers Skip at once.
 * Pulling back, rather than opening the walls, is what never strands her:
 * the page and the picture agree again in that frame, so her next input
 * works from where the film is, and Skip takes her wherever she was
 * heading in one press; opening the walls would let any path around the
 * gate skip the whole film, the one thing the owner asked never to happen
 * again. Focus that moves below the hero (Tab, a screen reader, a link
 * that moves focus) still opens the walls (HeroStage): the keyboard and
 * assistive technology are never pulled back.
 *
 * Where the page is comes from the page itself. Lenis (1.3.26) tracks the
 * page's native scrolls, but it drops the scroll event that follows its
 * own landing (preventNextNativeScrollEvent, cleared on the next frame: a
 * whole second at 1 fps) and ignores native scrolls while it glides. Once
 * it missed a move, Lenis said the page was where it had left it: the
 * stage saw no overshoot to correct, the input gate (which measures from
 * the page) held every push, and only scrolling back up, which Lenis
 * applies from its stale position, freed her. So the frame reads the
 * page's offset (after Lenis has written it, so nothing is laid out
 * twice), draws from Lenis' sub-pixel value while the two agree, and
 * starts Lenis again from the page when it missed a move.
 *
 * Pure functions; HeroStage and the scroller model (testing/
 * scrollerModel.ts) apply them.
 */
export const GATE = {
  /** Lenis and the page agree within this (px): the page's offset rounds to device pixels. */
  syncSlop: 1.5,
  /** The page past the wall by more than this (px) goes back to it. */
  snapSlop: 4,
  /** Held pixels one overshoot may add to the pressure. */
  overshootCap: 400,
  /** Lifting a finger with less room than this (viewport heights) before the wall drops its fling. */
  liftRoom: 0.06,
} as const;

/** One frame's reading of where the page is. */
export type PageReading = {
  /** The page's own scroll offset (window.scrollY), px. */
  page: number;
  /** Lenis' value (animatedScroll), px: sub-pixel while it glides. */
  lenis: number;
  /** Lenis is gliding: it writes the page every frame, so the page is where it says. */
  gliding: boolean;
};

/** The scroll the frame is drawn from: Lenis' smooth value while it agrees with the page, the page's own otherwise. */
export function pageScroll(reading: PageReading): number {
  return Math.abs(reading.page - reading.lenis) <= GATE.syncSlop ? reading.lenis : reading.page;
}

/**
 * Lenis missed a native move of the page (it is not gliding, yet it is
 * somewhere else): it must start again from the page (`lenis.reset()`),
 * or its next glide would set off from a place the page left long ago.
 */
export function lenisMissed(reading: PageReading): boolean {
  return !reading.gliding && Math.abs(reading.page - reading.lenis) > GATE.syncSlop;
}

/**
 * What the stage does about the page this frame:
 * - `back`: the page is past the wall (by more than `snapSlop`): back to
 *   the wall now, whatever moved it there;
 * - `into`: a glide aims past the wall: it is turned into the wall, still
 *   gliding (a safety net: gated input never aims past it);
 * - `none`.
 * `scroll` is this frame's page scroll (pageScroll), `max` the wall
 * (Infinity once every beat is done).
 */
export type GateAction = "none" | "into" | "back";

export function gateAction(input: { scroll: number; lenisTarget: number; gliding: boolean; max: number }): GateAction {
  if (!Number.isFinite(input.max)) return "none";
  if (input.scroll - input.max > GATE.snapSlop) return "back";
  if (input.gliding && input.lenisTarget > input.max + 1) return "into";
  return "none";
}

/**
 * A finger lifting forward with `room` px left before the wall: how far
 * Lenis' fling (`fling` px, sign(delta)·|velocity|^1.7) may fly. Nothing
 * this close to the wall (`liftRoom` viewports of a `vh` px viewport): it
 * would only bounce off it. Elsewhere it flies up to the wall and no
 * further, so gated input never passes the frontier; what does not fit is
 * held (it becomes pressure).
 */
export function liftFling(fling: number, room: number, vh: number): number {
  if (!(fling > 0) || room < GATE.liftRoom * vh) return 0;
  return Math.min(fling, room);
}
