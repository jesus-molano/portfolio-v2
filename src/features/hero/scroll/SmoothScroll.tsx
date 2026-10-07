"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import type { VirtualScrollData } from "lenis";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { motion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { registerScroller, type Scroller } from "@/lib/navigate";
import { stableScreen } from "@/lib/screen";
import { getSceneLoading } from "../sceneLoading";
import { selectGate } from "@/features/suspects/selectWall";
import { stageGate } from "@/features/work/stageGate";
import {
  browserStroke,
  firstWall,
  GATE,
  iosTouch,
  keyScrollsPage,
  lenisMissed,
  liftFling,
  newStroke,
  type PageReading,
  resetStroke,
  steadyFling,
  strokeLift,
  strokeMove,
} from "./gate";
import { recordInput, scrollDrive, scrollGate, scrollInput } from "./heroProgress";

/**
 * Lenis smooth scroll driven by the GSAP ticker. No ScrollTrigger: nothing
 * on the page made a trigger, and the plugin alone kept a frame loop, a
 * timer and a refresh on every resize running for the whole visit. The tree shape never changes, so a late
 * reduced-motion value does not remount the page: under reduced motion Lenis
 * follows the native scroll position instantly (`lerp: 1`).
 *
 * Forward wheel and touch input is trimmed at `scrollGate.maxScroll`, the
 * hero story's frontier (see story.ts, gate.ts and HeroStage), and what is
 * held there becomes `scrollGate.pressure`, which the hero shows. Touch
 * scrolling is synced too (`syncTouch`), so phones get the same gate and no
 * native momentum runs past it: every move of a stroke is cancelled, by
 * Lenis or by the gate, so the browser never takes a stroke over. Below
 * the hero, with every wall open (the hero's and the career city's), a
 * stroke is the browser's own from its first move (gate.ts
 * browserStroke), but for one that starts in the career city's film,
 * which Lenis drives as it drives the hero's: nothing to gate there, and the
 * browser, not Lenis, owns a phone's bars coming and going. A
 * finger moves the page once past its slop, so a resting thumb that
 * trembles is still, and its fling flies up to the wall and no further.
 * The input this gate passes never goes past the frontier; whatever else
 * moves the page there, HeroStage puts it back (gate.ts).
 * Every input is recorded (`recordInput`) for the hero's feedback: the
 * world's pace, the transport and the hints. The hero's pedal drives the
 * same scroll from the ticker (`scrollDrive`, right before `lenis.raf`),
 * and a finger on it is never a scroll stroke.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const lenisRef = useRef<LenisRef>(null);

  /** The current touch stroke moved the page: its touchend may carry inertia. */
  const strokeMoved = useRef(false);
  /** The finger on the glass, read through its slop (gate.ts): a trembling thumb is still. */
  const stroke = useRef(newStroke());
  /** Where the page is when her input comes, against where Lenis thinks it is (gate.ts). */
  const reading = useRef<PageReading>({ page: 0, lenis: 0, gliding: false });
  /** Two fingers are on the picture (a pinch): the browser's zoom until every finger has lifted. */
  const pinch = useRef(false);
  /** The current touch stroke started below the hero: the browser scrolls it (gate.ts browserStroke). */
  const browserOwns = useRef(false);
  /** The career city's pinned film (px), read at each finger's landing. */
  const pinned = useRef({ from: Number.POSITIVE_INFINITY, to: Number.NEGATIVE_INFINITY });
  /** iOS or iPadOS (WebKit's touch clock, gate.ts flingStaleMsIos), read once on the client. */
  const ios = useRef<boolean | null>(null);

  /*
   * Gate for wheel and touch input, run by Lenis before it scrolls. It
   * relies on four Lenis 1.3.26 internals (pinned in package.json and
   * guarded by lenisContract.test.ts):
   * 1. `options.virtualScroll` runs before Lenis' own ctrlKey and isStopped
   *    checks (onVirtualScroll), so pinch zoom is filtered here (a
   *    trackpad's ctrlKey wheel, and two fingers on a touch screen, whose
   *    moves it must never cancel: the browser zooms);
   * 2. Lenis reads the deltas from `data` after this callback, and zero
   *    deltas return early as for a tap;
   * 3. touchend inertia, sign(delta)·|velocity|^touchInertiaExponent, is
   *    computed after this callback from Lenis' own velocity, which is set in
   *    its frame and so grows with a long frame or goes stale when the lift
   *    shares a task with the last moves: the gate zeroes the deltas (2) and
   *    glides the same law itself from the finger's own speed, into the wall
   *    at most;
   * 4. a touchmove Lenis drops (zero vertical delta, or `false` from this
   *    callback) returns before Lenis cancels it. A cancelable touchmove
   *    nobody cancels hands the rest of the stroke to the browser's own
   *    scrolling (its later moves come uncancelable), which no gate trims:
   *    a drag and its fling would run past the wall. So with syncTouch on,
   *    the gate cancels every move it holds or Lenis would drop itself
   *    (a still finger whose moves Chrome coalesced to nothing, a pressure
   *    change, a sideways sway), and the stroke stays gated.
   * The room is measured from the page as well as from Lenis' target: if
   * the page moved without Lenis (gate.ts), nothing passes the wall. A
   * finger is read through its slop (gate.ts Stroke): a resting thumb that
   * trembles neither goes back nor pushes.
   */
  const gateInput = useCallback(
    (data: VirtualScrollData) => {
      const { event } = data;
      // A finger on the pedal holds it, it never scrolls: a second finger swiping the picture is the
      // stroke. (The pedal stops its own touch events too; this is the second guard.)
      if (event.type.startsWith("touch") && event.target instanceof Element && event.target.closest("[data-pedal]")) {
        return false;
      }
      // Two fingers on the picture are a pinch (or a two-finger pan): the browser's zoom, never a
      // stroke. Nothing cancels their moves, Lenis drops them before it would (internal 4), until
      // every finger has lifted: a finger left from the pinch is not a stroke either.
      if (event.type.startsWith("touch") && "touches" in event) {
        const fingers = fingersOnPicture((event as TouchEvent).touches);
        // A finger landing: a pinch only with another one on the picture (a lost touchend never sticks).
        if (event.type === "touchstart") {
          pinch.current = fingers >= 2;
          if (pinch.current) {
            resetStroke(stroke.current);
            scrollGate.touching = false;
            strokeMoved.current = false;
            browserOwns.current = false;
          }
        }
        if (pinch.current) {
          if (event.type === "touchend" && fingers === 0) pinch.current = false;
          return false;
        }
      }
      // Under reduced motion the page scrolls natively (no Lenis), and only the character select's wall
      // still holds it (selectWall.ts): a notch or a drag that would pass it is cancelled, the page
      // stands at the wall and the select says why. (A drag the browser already took over cannot be
      // cancelled any more: the select puts the page back.)
      if (reducedMotion && !event.ctrlKey && getSceneLoading().entered && Number.isFinite(selectGate.maxScroll)) {
        const wall = selectGate.maxScroll;
        const forward = (event.type === "wheel" || event.type === "touchmove") && data.deltaY > 0;
        if (forward && window.scrollY + data.deltaY > wall - 0.5) {
          if (event.cancelable) event.preventDefault();
          if (window.scrollY < wall) window.scrollTo({ top: wall, behavior: "instant" });
          scrollGate.pressure += data.deltaY;
          scrollGate.pushedAt = performance.now();
          return false;
        }
      }
      // Pinch zoom on a trackpad (ctrlKey), sideways gestures and input before the visitor entered are not scrolling.
      if (reducedMotion || event.ctrlKey || !getSceneLoading().entered) return true;
      const lenis = lenisRef.current?.lenis;
      ios.current ??= iosTouch(navigator.userAgent, navigator.maxTouchPoints);
      // On iOS a move that did not move (a force or contact change) is no sample of the finger's speed.
      const stationary = ios.current && data.deltaX === 0 && data.deltaY === 0;
      // Every finger lands still.
      if (event.type === "touchstart") resetStroke(stroke.current, event.timeStamp);
      // Scroll held (the radio wheel is open): nothing reaches the hero, not
      // even as feedback; Lenis drops the event itself after this callback.
      if (lenis?.isStopped) {
        if (event.type === "touchend") {
          scrollGate.touching = false;
          strokeMoved.current = false;
        }
        return true;
      }
      // Lenis scrolls on from where it thinks the page is. A native move it
      // has not heard of yet (the scrollbar, find in page: scroll events
      // come with the next frame, seconds away on a slow device, and it
      // drops the one after its own landing) would send her input from
      // there; it starts from the page instead, as the hero's frame does.
      if (lenis) {
        const at = reading.current;
        at.page = window.scrollY;
        at.lenis = lenis.scroll;
        at.gliding = lenis.isScrolling === "smooth";
        if (lenisMissed(at)) lenis.animatedScroll = lenis.targetScroll = at.page;
      }
      if (event.type === "touchstart") {
        scrollGate.touching = true;
        strokeMoved.current = false;
        // Below the hero with every wall open, the stroke is the browser's (gate.ts browserStroke). A
        // closed wall of the career city's binds as the hero's does: a native stroke there ran past it
        // on every move, and the stage pulled the page back a frame later.
        // The career city's film is the hero's kind of page: a stroke there is Lenis' as in the hero.
        pinned.current.from = stageGate.pinFrom;
        pinned.current.to = stageGate.pinTo;
        browserOwns.current = browserStroke(
          window.scrollY,
          scrollGate.heroEnd,
          firstWall(scrollGate.maxScroll, selectGate.maxScroll, stageGate.maxScroll),
          pinned.current,
          lenis?.isScrolling === "native",
        );
        // A second finger landing beside a held pedal: Lenis would take it for a tap that stops the
        // scroll (reset), dropping the pedal's glide. Its strokes still scroll as ever. Otherwise
        // the tap stops any glide of Lenis' under her finger, the browser's strokes included.
        return scrollInput.pedal === 0;
      }
      if (browserOwns.current && event.type.startsWith("touch")) {
        // Lenis drops what this returns false for before it cancels it (internal 4), so the
        // browser scrolls the stroke and flings it, its bars coming and going as on any page.
        // The stroke is still her input, through its slop, for the hero she may scroll back into.
        const now = performance.now();
        if (event.type === "touchmove") {
          const move = strokeMove(stroke.current, data.deltaY, event.timeStamp, stationary);
          if (move !== 0) {
            strokeMoved.current = true;
            recordInput(move, "touch", now);
          }
        } else if (event.type === "touchend") {
          scrollGate.touching = false;
          if (strokeMoved.current) scrollGate.touchEndAt = now;
          strokeMoved.current = false;
          browserOwns.current = false;
        }
        return false;
      }
      if (event.type === "touchmove") {
        // A finger moves the page only once it is past its slop (gate.ts).
        // On the event's own clock: a slow frame never turns a move into a rest.
        const move = strokeMove(stroke.current, data.deltaY, event.timeStamp, stationary);
        if (move === 0) {
          // Still, or a move with nothing vertical in it: nothing scrolls,
          // and the move is cancelled here, or the browser takes the rest of
          // the stroke (internal 4).
          if (event.cancelable && lenis && lenisDrivesTouch(lenis, event)) event.preventDefault();
          return false;
        }
        data.deltaY = move;
      }
      // The first wall on the page binds: the hero's, the character select's, or the career city's.
      const maxScroll = firstWall(scrollGate.maxScroll, selectGate.maxScroll, stageGate.maxScroll);
      const gated = Boolean(lenis) && Number.isFinite(maxScroll);
      const room = lenis && gated ? maxScroll - Math.max(lenis.targetScroll, lenis.actualScroll) : Infinity;
      const now = performance.now();
      if (event.type === "touchend") {
        scrollGate.touching = false;
        if (strokeMoved.current) scrollGate.touchEndAt = now;
        strokeMoved.current = false;
        // The fling goes the stroke's way, not its last tremble's; a finger
        // that never left its slop (a tap) or came to rest flings nothing.
        const lift = strokeLift(stroke.current, event.timeStamp);
        if (lift === 0) data.deltaX = 0;
        data.deltaY = lift;
        // The fling is the finger's, read at a 60 fps frame (gate.ts
        // steadyFling; on iOS, whose lift comes a frame or two behind the
        // last move, with a longer window): Lenis' own grows with the frame, so a loaded phone's
        // flick flew from the career city to the top of the hero, and once
        // the lift came in the same task as the last moves its velocity was
        // stale, so a hard flick barely flew at all. The gate always flies it
        // itself. A forward fling flies up to the wall and no further (gate.ts
        // liftFling); near the wall it does not fly at all. A flick back keeps
        // its inertia.
        // (Not under data-lenis-prevent or a selection handle, where Lenis flings nothing either.)
        if (lenis && lift !== 0 && lenisDrivesTouch(lenis, event)) {
          const steady = steadyFling(stroke.current, lenis.options.touchInertiaExponent, event.timeStamp, ios.current);
          const fly = lift > 0 && Number.isFinite(room) ? liftFling(steady, room, window.innerHeight) : steady;
          // Internal 2: zero deltas return as a tap, so Lenis flings nothing (internal 3)...
          data.deltaX = 0;
          data.deltaY = 0;
          if (fly > 0) {
            // ...and the fling glides the way Lenis' own would, into the wall at most.
            if (event.cancelable) event.preventDefault();
            lenis.scrollTo(lenis.targetScroll + lift * fly, { programmatic: false, lerp: motion.touchLerp });
            if (steady > fly) {
              scrollGate.pressure += Math.min(steady - fly, GATE.overshootCap);
              scrollGate.pushedAt = now;
            }
          }
        }
        return true;
      }
      if (data.deltaY === 0) return true;
      if (Math.abs(data.deltaX) > Math.abs(data.deltaY)) {
        // A sideways gesture is not her scrolling: no feedback, no pressure.
        // Lenis still scrolls its vertical part, so it is trimmed like any other.
        if (data.deltaY <= room) return true;
        if (room >= 1) {
          data.deltaY = room;
          return true;
        }
        if (event.cancelable) event.preventDefault();
        return false;
      }
      const touch = event.type.startsWith("touch");
      if (touch) strokeMoved.current = true;
      if (data.deltaY < 0) {
        if (touch && scrollGate.pressure > 0) {
          // Dragging back first spends the stretch, as at the end of a list.
          scrollGate.pressure = Math.max(0, scrollGate.pressure + data.deltaY);
          recordInput(0, "touch", now);
          if (event.cancelable) event.preventDefault();
          return false;
        }
        recordInput(data.deltaY, touch ? "touch" : "wheel", now);
        return true;
      }
      recordInput(data.deltaY, touch ? "touch" : "wheel", now);
      if (!gated) return true;
      const accepted = Math.max(0, Math.min(data.deltaY, room));
      if (data.deltaY > accepted) {
        scrollGate.pressure += data.deltaY - accepted;
        scrollGate.pushedAt = now;
      }
      if (accepted >= 1) {
        // Internal 2: Lenis scrolls by the delta it reads after this callback.
        data.deltaY = accepted;
        return true;
      }
      // Native touch scrolling only stops if the move is cancelled.
      if (event.cancelable) event.preventDefault();
      return false;
    },
    [reducedMotion],
  );

  // The page's stable screen height (--va-svh, --va-lvh) from the first frame on, hero or not.
  useLayoutEffect(() => {
    stableScreen();
  }, []);

  useEffect(() => {
    // A key that scrolls the page below the hero, in the tail of a wheel's glide: the glide stops,
    // so the browser's own key scroll runs and Lenis follows it (gate.ts keyScrollsPage). The
    // hero's keys are its own (HeroStage drives Lenis with them).
    const onKey = (event: KeyboardEvent) => {
      const lenis = lenisRef.current?.lenis;
      if (!lenis || event.defaultPrevented || lenis.isScrolling !== "smooth") return;
      if (window.scrollY <= scrollGate.heroEnd + 1) return;
      const target = event.target instanceof Element ? event.target : null;
      const kind = target?.closest("input, textarea, select, [contenteditable='true']")
        ? "field"
        : target?.closest("button, a[href], summary, [role='button'], [role='tab']")
          ? "control"
          : "page";
      if (keyScrollsPage(event.key, kind)) (lenis as unknown as { reset(): void }).reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Lenis listens for no touchcancel: a stroke the system takes over (the
    // home indicator, an alert) must not leave the hero stretched under a
    // finger that is gone.
    const cancel = () => {
      if (!scrollGate.touching) return;
      scrollGate.touching = false;
      scrollGate.touchEndAt = performance.now();
      strokeMoved.current = false;
      browserOwns.current = false;
    };
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => window.removeEventListener("touchcancel", cancel);
  }, []);

  // Where Lenis drives a stroke, the browser may not pan the page itself (globals.css data-touch-held).
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    let held = false;
    const hold = (next: boolean) => {
      if (next === held) return;
      held = next;
      document.documentElement.toggleAttribute("data-touch-held", next);
    };
    const update = (time: number, deltaMs: number) => {
      const lenis = lenisRef.current?.lenis;
      if (!lenis) return;
      // A held pedal pushes the scroll first, so this very frame moves with it.
      scrollDrive.step?.(deltaMs, lenis);
      for (const step of scrollDrive.steps) step(deltaMs, lenis);
      lenis.raf(time * 1000);
      // The next stroke is Lenis' (the hero, a closed wall, the career city's film: gate.ts
      // browserStroke): the browser must not pan it. A phone too busy to answer a touch in time
      // gets its moves uncancelable (Chrome stops waiting), so they were never cancelled: the
      // browser scrolled past the character select's wall and the wall pulled the page back a
      // frame later, over and over, the page trembling under her finger. With touch-action set
      // ahead of the stroke (the compositor reads it at the touch, not the page) nothing pans,
      // however late the page answers. Pinch zoom stays.
      hold(
        !reducedRef.current &&
          !browserStroke(
            lenis.animatedScroll,
            scrollGate.heroEnd,
            firstWall(scrollGate.maxScroll, selectGate.maxScroll, stageGate.maxScroll),
            { from: stageGate.pinFrom, to: stageGate.pinTo },
            lenis.isScrolling === "native",
          ),
      );
    };
    // First on the ticker: the hero then draws this frame's scroll, not the last one's.
    gsap.ticker.add(update, false, true);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(update);
      gsap.ticker.lagSmoothing(500, 33);
      hold(false);
    };
  }, []);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        autoRaf: false,
        lerp: reducedMotion ? 1 : motion.scrollLerp,
        smoothWheel: !reducedMotion,
        // Lenis drives touch scrolling as well, with its own inertia: the
        // hero gate then trims touch input like wheel input, with no native
        // momentum to fight, and the phone's address bar no longer jumps.
        syncTouch: !reducedMotion,
        syncTouchLerp: motion.touchLerp,
        virtualScroll: gateInput,
      }}
    >
      <ScrollerRegistration />
      {children}
    </ReactLenis>
  );
}

/** Fingers on the glass that are not holding the hero's pedal: a thumb on it is never part of a pinch. */
function fingersOnPicture(touches: TouchList): number {
  let count = 0;
  for (let i = 0; i < touches.length; i += 1) {
    const target = touches[i].target;
    if (!(target instanceof Element && target.closest("[data-pedal]"))) count += 1;
  }
  return count;
}

/** Lenis' touch handling that the gate mirrors (lenisContract.test.ts). */
type LenisTouch = { rootElement: HTMLElement; _isDraggingSelection?: boolean };

/**
 * Lenis drives this touch stroke: it cancels the moves it scrolls, so the
 * gate must cancel the ones it drops. Not under an element that keeps its
 * own touch scrolling (`data-lenis-prevent` and its touch and orientation
 * variants), nor while iOS drags a text selection's handle, where Lenis
 * leaves the stroke to the browser.
 */
function lenisDrivesTouch(lenis: object, event: Event): boolean {
  const own = lenis as LenisTouch;
  if (own._isDraggingSelection) return false;
  const path = event.composedPath();
  for (const node of path) {
    if (node === own.rootElement) break;
    if (
      node instanceof HTMLElement &&
      (node.hasAttribute("data-lenis-prevent") ||
        node.hasAttribute("data-lenis-prevent-touch") ||
        node.hasAttribute("data-lenis-prevent-vertical") ||
        node.hasAttribute("data-lenis-prevent-horizontal"))
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Hands the Lenis instance to the page's navigation (lib/navigate.ts), so
 * a link, Skip or back to top moves Lenis and the page together. A layout
 * effect ahead of the page: a section that moves the page as it mounts
 * (the hero keeping her place) finds the new instance already there.
 */
function ScrollerRegistration() {
  const lenis = useLenis();
  useLayoutEffect(() => (lenis ? registerScroller(lenis as unknown as Scroller) : undefined), [lenis]);
  return null;
}
