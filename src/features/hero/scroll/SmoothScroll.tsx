"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { VirtualScrollData } from "lenis";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { motion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getSceneLoading } from "../sceneLoading";
import { recordInput, scrollGate } from "./heroProgress";

gsap.registerPlugin(ScrollTrigger);

/** Lifting a finger with less room than this (viewport heights) before the wall drops its inertia. */
const WALL_INERTIA_ROOM = 0.06;

/**
 * Lenis smooth scroll driven by the GSAP ticker, with ScrollTrigger kept in
 * sync (official Lenis + GSAP recipe). The tree shape never changes, so a late
 * reduced-motion value does not remount the page: under reduced motion Lenis
 * follows the native scroll position instantly (`lerp: 1`).
 *
 * Forward wheel and touch input is trimmed at `scrollGate.maxScroll`, the
 * hero story's frontier (see story.ts and HeroStage), and what is held
 * there becomes `scrollGate.pressure`, which the hero shows. Touch
 * scrolling is synced too (`syncTouch`), so phones get the same gate and no
 * native momentum runs past it. Every input is recorded (`recordInput`) for
 * the hero's feedback: the world's pace, the transport and the hints.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const lenisRef = useRef<LenisRef>(null);

  /** The current touch stroke moved the page: its touchend may carry inertia. */
  const strokeMoved = useRef(false);

  /*
   * Gate for wheel and touch input, run by Lenis before it scrolls. It
   * relies on three Lenis 1.3.26 internals (pinned in package.json and
   * guarded by lenisContract.test.ts):
   * 1. `options.virtualScroll` runs before Lenis' own ctrlKey and isStopped
   *    checks (onVirtualScroll), so pinch zoom is filtered here;
   * 2. Lenis reads the deltas from `data` after this callback, and zero
   *    deltas return early as for a tap;
   * 3. touchend inertia is computed after this callback from Lenis' own
   *    velocity, so it cannot be trimmed here: HeroStage.gate() retargets it.
   */
  const gateInput = useCallback(
    (data: VirtualScrollData) => {
      const { event } = data;
      // Pinch zoom, sideways gestures and input before the visitor entered are not scrolling.
      if (reducedMotion || event.ctrlKey || !getSceneLoading().entered) return true;
      if (event.type === "touchstart") {
        scrollGate.touching = true;
        strokeMoved.current = false;
        return true;
      }
      const lenis = lenisRef.current?.lenis;
      const gated = Boolean(lenis) && Number.isFinite(scrollGate.maxScroll);
      const room =
        lenis && gated ? scrollGate.maxScroll - Math.max(lenis.targetScroll, lenis.actualScroll) : Infinity;
      const now = performance.now();
      if (event.type === "touchend") {
        scrollGate.touching = false;
        if (strokeMoved.current) scrollGate.touchEndAt = now;
        strokeMoved.current = false;
        // Lifting near a wall: no inertia flies into it (internal 2: zero
        // deltas return as a tap). A flick back keeps its inertia.
        if (data.deltaY > 0 && room < WALL_INERTIA_ROOM * window.innerHeight) {
          data.deltaX = 0;
          data.deltaY = 0;
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

  useEffect(() => {
    // Lenis listens for no touchcancel: a stroke the system takes over (the
    // home indicator, an alert) must not leave the hero stretched under a
    // finger that is gone.
    const cancel = () => {
      if (!scrollGate.touching) return;
      scrollGate.touching = false;
      scrollGate.touchEndAt = performance.now();
      strokeMoved.current = false;
    };
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => window.removeEventListener("touchcancel", cancel);
  }, []);

  useEffect(() => {
    const update = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000);
    };
    // First on the ticker: the hero then draws this frame's scroll, not the last one's.
    gsap.ticker.add(update, false, true);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(update);
      gsap.ticker.lagSmoothing(500, 33);
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
      <ScrollTriggerSync />
      {children}
    </ReactLenis>
  );
}

/** Registers `ScrollTrigger.update` on the Lenis instance once it exists. */
function ScrollTriggerSync() {
  useLenis(() => ScrollTrigger.update());
  return null;
}
