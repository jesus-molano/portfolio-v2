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
 * A finger's stroke is read through its slop (`Stroke`): a resting thumb
 * that trembles is still, neither going back nor pushing.
 *
 * Pure functions; HeroStage, SmoothScroll and the scroller model
 * (testing/scrollerModel.ts) apply them.
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
  /**
   * A finger's slop (px): within this of where it landed, or of the
   * furthest it went, a finger is still. A resting thumb trembles by 0.3
   * to 3 px; Android's own touch slop is 8 dp.
   */
  touchSlop: 8,
} as const;

/**
 * A finger's stroke, as the gate reads it (SmoothScroll, the scroller
 * model). A thumb resting on the glass trembles; the page must not follow
 * it, or every tremble back reads as going back (REVERSE, the card being
 * read hides and its reading clock stops) and every tremble forward at a
 * wall as a push. So a stroke scrolls once the finger has moved
 * `touchSlop` px from where it landed, and then follows it 1:1 in its
 * direction; turning back, it waits until the finger is `touchSlop` px
 * back from the furthest it went (backlash). Nothing is lost: when the
 * stroke starts or turns, it scrolls the finger's whole travel, so the
 * page is under the finger again.
 */
export type Stroke = {
  /** Which way the stroke scrolls: 1 forward, -1 back, 0 not yet (the finger is within its slop). */
  dir: -1 | 0 | 1;
  /** Finger travel (px, positive forward) since the stroke last scrolled: held in the slop. */
  slack: number;
};

export function newStroke(): Stroke {
  return { dir: 0, slack: 0 };
}

/** A new finger on the glass: its stroke starts still. */
export function resetStroke(stroke: Stroke): void {
  stroke.dir = 0;
  stroke.slack = 0;
}

/**
 * One move of the finger (`delta` px, positive forward): how far it
 * scrolls the page, 0 while the finger is still (within the slop, or
 * trembling back from the furthest it went).
 */
export function strokeMove(stroke: Stroke, delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  stroke.slack += delta;
  const { dir, slack } = stroke;
  // Further the way it goes: on at once.
  if (dir !== 0 && Math.sign(slack) === dir) {
    stroke.slack = 0;
    return slack;
  }
  // Starting, or turning back: only past the slop.
  if (Math.abs(slack) >= GATE.touchSlop) {
    stroke.dir = slack > 0 ? 1 : -1;
    stroke.slack = 0;
    return slack;
  }
  return 0;
}

/**
 * The finger lifts: which way its fling goes (Lenis takes only the sign
 * of the lift's delta; its size is Lenis' own velocity). A stroke that
 * never left its slop flings nothing (a tap, a thumb that rested), and a
 * last tremble back does not turn a forward fling around.
 */
export function strokeLift(stroke: Stroke): -1 | 0 | 1 {
  return stroke.dir;
}

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

/**
 * Whether a finger landing with the page at `page` px leaves its stroke
 * to the browser: past the film's end (`heroEnd`, p = 1) with the walls
 * open (`maxScroll` Infinity). Below the hero there is nothing to gate,
 * and Lenis driving a finger there read every move of the viewport as
 * finger travel: a phone's bars coming or going mid-stroke shifted the
 * finger's clientY under a still thumb, so the page jumped against the
 * stroke, and its fling knew nothing of the bars. The browser's own
 * scrolling owns the bars and its momentum. In the hero, Lenis drives
 * every stroke as ever (a native fling back up into it is fine: the walls
 * are open, and the frame reads the page).
 */
export function browserStroke(page: number, heroEnd: number, maxScroll: number): boolean {
  return !Number.isFinite(maxScroll) && Number.isFinite(heroEnd) && page >= heroEnd - 0.5;
}

/** The keys whose default action scrolls the page (with or without modifiers: Ctrl+End, Cmd+Down). */
const PAGE_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);

/**
 * Whether a key the page did not take scrolls the page natively, so a
 * glide of Lenis' must stop for it (SmoothScroll): Lenis ignores native
 * scrolls while it glides and writes its own place every frame, so a key
 * pressed in the tail of a wheel's glide was swallowed, or scrolled and
 * was yanked back a screen within two frames. Never in a field, and Space
 * on a control presses it.
 */
export function keyScrollsPage(key: string, target: "field" | "control" | "page"): boolean {
  if (!PAGE_KEYS.has(key) || target === "field") return false;
  return !(key === " " && target === "control");
}
