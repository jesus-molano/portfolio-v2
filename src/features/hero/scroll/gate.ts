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
 * that trembles or rolls is still, neither going back nor pushing.
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
  /**
   * A finger that has gone less than `restPx` its way over `restMs` has
   * come to rest: it lands still again where it is. A thumb left on the
   * glass after a swipe trembles and rolls a few px as its pad flattens;
   * followed, every roll back read as REVERSE for as long as it rested.
   * A deliberate drag goes 20 px a second and more.
   */
  restMs: 150,
  restPx: 3,
  /** From rest, a finger moves the page again once it has moved this far (px): past a tremble and a roll. */
  restSlop: 12,
  /** The frame Lenis' touch inertia is read at (ms): |px per frame|^1.7, a 60 fps frame whatever the device's. */
  flingFrameMs: 1000 / 60,
  /** The finger's speed is smoothed over this long (ms, the moves' own clock): about the frame Lenis' velocity reads. */
  flingTau: 16,
  /**
   * A lift more than this (ms, the events' own clock) after the finger's last move flings nothing:
   * the finger had stopped (Android's VelocityTracker assumes a pointer stopped after 40 ms).
   */
  flingStaleMs: 40,
  /**
   * The same on iOS (WebKit, every browser there): its touch events carry the UIKit touch's own time
   * (WKTouchEventsGestureRecognizer: `timestamp = touches.anyObject.timestamp`), delivered a display
   * frame at a time, and the lift's sample comes a frame or two behind the last move, more as the
   * finger leaves the glass: 40 ms left about a frame's margin, and past it a flick flew nothing, the
   * page moving only as far as the finger did. Android's VelocityTracker reads 100 ms of samples.
   * A finger that really stopped still flings nothing: it comes to rest first (`restMs`).
   */
  flingStaleMsIos: 100,
} as const;

/**
 * Whether the page runs on iOS or iPadOS, where every browser is WebKit (its touch clock, above):
 * an iPhone, iPad or iPod in the user agent (Lenis' own `isIos`), or a "Macintosh" with a touch
 * screen, as iPadOS' Safari calls itself.
 */
export function iosTouch(userAgent: string, maxTouchPoints: number): boolean {
  return /(iPad|iPhone|iPod)/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * The page's first wall (px of page scroll) a stroke or a notch is trimmed to: the smallest of the
 * hero's, the character select's and the career city's (Infinity once every one is open).
 */
export function firstWall(hero: number, select: number, city: number): number {
  return Math.min(hero, select, city);
}

/**
 * A finger's stroke, as the gate reads it (SmoothScroll, the scroller
 * model). A thumb resting on the glass trembles; the page must not follow
 * it, or every tremble back reads as going back (REVERSE, the card being
 * read hides and its reading clock stops) and every tremble forward at a
 * wall as a push. So a stroke scrolls once the finger has moved
 * `touchSlop` px from where it landed, and then follows it 1:1 in its
 * direction; turning back, it waits until the finger is `touchSlop` px
 * back from the furthest it went (backlash). A finger that has come to
 * rest (`restMs`, `restPx`) lands still again where it is, and moves the
 * page again only past `restSlop`: after a swipe, back or forward, a
 * thumb left on the glass is rest, not more of the swipe. Nothing is
 * lost: when the stroke starts, turns or goes on from rest, it scrolls
 * the finger's whole travel, so the page is under the finger again.
 */
export type Stroke = {
  /** Which way the stroke scrolls: 1 forward, -1 back, 0 not yet (the finger is within its slop). */
  dir: -1 | 0 | 1;
  /** Finger travel (px, positive forward) since the stroke last scrolled: held in the slop. */
  slack: number;
  /** Travel its way (px) since `paceAt` (ms, the moves' own clock): under `restPx` for `restMs`, it rests. */
  pace: number;
  paceAt: number;
  /** It came to rest: it goes on only past `restSlop`. */
  rested: boolean;
  /** The finger's speed (px/ms, positive forward) on its moves' own clock, and the time (ms) of its last move or landing. */
  speed: number;
  speedAt: number;
};

export function newStroke(): Stroke {
  return { dir: 0, slack: 0, pace: 0, paceAt: 0, rested: false, speed: 0, speedAt: Number.NaN };
}

/** A new finger on the glass at `at` ms (the touchstart's own time): its stroke starts still. */
export function resetStroke(stroke: Stroke, at = Number.NaN): void {
  stroke.dir = 0;
  stroke.slack = 0;
  stroke.pace = 0;
  stroke.paceAt = 0;
  stroke.rested = false;
  stroke.speed = 0;
  stroke.speedAt = at;
}

/**
 * One move of the finger (`delta` px, positive forward) at `at` ms (the
 * event's own time): how far it scrolls the page, 0 while the finger is
 * still (within the slop, trembling back from the furthest it went, or
 * resting). `stationary`: the move carried no movement at all, and the
 * page runs on iOS (SmoothScroll): it leaves the finger's speed as it was.
 */
export function strokeMove(stroke: Stroke, delta: number, at: number, stationary = false): number {
  if (!Number.isFinite(delta)) return 0;
  // The finger's own speed, on its moves' clock: a frame's coalesced moves count over the time they took.
  // A move that did not move (`stationary`: iOS reports a touch whose force or contact changed, as a
  // finger leaves the glass) is no sample of its speed: read as one, two of them just before the lift
  // took a flick's fling from 700 px to 24.
  if (!stationary) {
    if (Number.isFinite(stroke.speedAt) && at > stroke.speedAt) {
      const dt = at - stroke.speedAt;
      stroke.speed += (delta / dt - stroke.speed) * (1 - Math.exp(-dt / GATE.flingTau));
    }
    if (!(at <= stroke.speedAt)) stroke.speedAt = at;
  }
  // Gone less than restPx its way for restMs: it has come to rest, and lands still where it is.
  if (stroke.dir !== 0 && at - stroke.paceAt >= GATE.restMs) {
    stroke.dir = 0;
    stroke.slack = 0;
    stroke.rested = true;
  }
  stroke.slack += delta;
  const { dir, slack } = stroke;
  // Further the way it goes: on at once.
  if (dir !== 0 && Math.sign(slack) === dir) {
    stroke.slack = 0;
    stroke.pace += Math.abs(slack);
    if (stroke.pace >= GATE.restPx) {
      stroke.pace = 0;
      stroke.paceAt = at;
    }
    return slack;
  }
  // Starting, turning back or going on from rest: only past the slop.
  if (Math.abs(slack) >= (stroke.rested && dir === 0 ? GATE.restSlop : GATE.touchSlop)) {
    stroke.dir = slack > 0 ? 1 : -1;
    stroke.slack = 0;
    stroke.pace = 0;
    stroke.paceAt = at;
    stroke.rested = false;
    return slack;
  }
  return 0;
}

/**
 * The finger lifts: which way its fling goes (Lenis takes only the sign
 * of the lift's delta; its size is Lenis' own velocity). A stroke that
 * never left its slop flings nothing (a tap, a thumb that rested), nor
 * does one that has come to rest by `at` (ms, the lift's own time), and a
 * last tremble back does not turn a forward fling around.
 */
export function strokeLift(stroke: Stroke, at: number): -1 | 0 | 1 {
  return stroke.dir !== 0 && at - stroke.paceAt >= GATE.restMs ? 0 : stroke.dir;
}

/**
 * How far a lift's fling flies (px): Lenis' touch inertia, |velocity|^exponent with its velocity in px
 * per frame, read at a 60 fps frame from the finger's own speed alone. On a loaded device the frames
 * are long and a frame's moves coalesce, so the last frame's delta, and with it Lenis' fling, grew
 * with the frame: the same 420 px flick sent the page 1,500 px at 60 fps and 7,800 px at 25, from
 * the career city to the top of the hero in leaps of 1,300 px a frame. And Lenis' velocity is set in
 * its frame, not by the moves: once a frame took 40 ms the last moves and the lift came in one task,
 * its velocity was still the frame before's (or zeroed), and the same flick flew 150 px, then
 * nothing. The finger's speed, on its events' own clock, is the same whatever the frame rate. It
 * counts only while the finger is still moving as it lifts (`at`, the lift's own time, within
 * `flingStaleMs` of its last move, `flingStaleMsIos` on iOS): a finger that stopped before lifting
 * flings nothing.
 */
export function steadyFling(stroke: Stroke, exponent: number, at: number, ios = false): number {
  if (!(at - stroke.speedAt <= (ios ? GATE.flingStaleMsIos : GATE.flingStaleMs))) return 0;
  const perFrame = Math.abs(stroke.speed) * GATE.flingFrameMs;
  return perFrame > 0 ? perFrame ** exponent : 0;
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
 * to the browser: past the film's end (`heroEnd`, p = 1) with every wall
 * open (`maxScroll` Infinity: the smaller of the hero's wall and the
 * career city's, SmoothScroll; a closed wall in the city is gated like
 * the hero's, or every native move ran past it and was pulled back). Below the hero there is nothing to gate,
 * and Lenis driving a finger there read every move of the viewport as
 * finger travel: a phone's bars coming or going mid-stroke shifted the
 * finger's clientY under a still thumb, so the page jumped against the
 * stroke, and its fling knew nothing of the bars. The browser's own
 * scrolling owns the bars and its momentum. In the hero, Lenis drives
 * every stroke as ever (a native fling back up into it is fine: the walls
 * are open, and the frame reads the page).
 *
 * The career city's film (`pinned`, its pinned stretch of the page) is
 * the hero's kind of page: a stroke that starts there is Lenis' too, its
 * walls open or not. Its picture is drawn from the page in the same frame
 * Lenis moves it, so the film follows the finger 1:1, where the browser's
 * own scrolling ran ahead of it on the compositor (a phone's picture
 * stepping at every other frame) and boosted flick after flick into
 * thousands of pixels a frame. The bars stay as they are under a stroke
 * Lenis drives, as in the hero.
 *
 * With every wall open, a finger landing on the browser's own fling
 * (`native`: Lenis saw the page scroll natively in the last 0.4 s, a
 * fling flown in from STATS into the city, or from THE USUAL SUSPECTS
 * into the hero's end) stays the browser's, wherever it lands: its touch
 * stops its own fling. Taken over by Lenis, the fling ran on under the
 * stroke and the two moved the page by turns, against her finger.
 */
export function browserStroke(
  page: number,
  heroEnd: number,
  maxScroll: number,
  pinned: { from: number; to: number } = { from: Number.POSITIVE_INFINITY, to: Number.NEGATIVE_INFINITY },
  native = false,
): boolean {
  const open = !Number.isFinite(maxScroll) && Number.isFinite(heroEnd);
  if (open && native) return true;
  if (page >= pinned.from - 0.5 && page <= pinned.to + 0.5) return false;
  return open && page >= heroEnd - 0.5;
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
