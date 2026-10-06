"use client";

import { type AnimationEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, useEffect, useRef } from "react";
import { type AchievementId, stepInBranch } from "./achievements";

/** The sky is drawn (stars placed on the plane) from this width; under it, each branch is a vertical list. */
export const WIDE_SKY = "(min-width: 1000px)";

const buttonOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLButtonElement>("[data-achievement]") : null);

/**
 * The achievement tree's client part, around the server's stars (Achievements.tsx):
 *
 * - A tap or a click opens a star's details (data-open on its item; CSS
 *   already opens them on hover and keyboard focus, before hydration
 *   too), and a second one, a tap elsewhere or Esc closes them.
 * - A locked star shakes when it is activated, as a locked door would.
 * - The arrow keys step along a branch in its order, from the hub out:
 *   up the sky on a wide screen (Up and Right go on, Down and Left come
 *   back), down the list on a narrow one; Home and End go to its ends.
 */
export function AchievementSky({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const open = useRef<HTMLElement | null>(null);

  const setOpen = (button: HTMLElement | null) => {
    if (open.current === button) return;
    open.current?.closest("li")?.removeAttribute("data-open");
    open.current = button;
    button?.closest("li")?.setAttribute("data-open", "");
  };

  useEffect(() => {
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (open.current && !(event.target instanceof Node && ref.current?.contains(event.target))) setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const onClick = (event: MouseEvent) => {
    const button = buttonOf(event.target);
    if (!button) {
      setOpen(null);
      return;
    }
    setOpen(open.current === button ? null : button);
    if (button.hasAttribute("data-locked") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const item = button.closest("li");
      if (!item) return;
      // Restart the shake on every activation.
      item.removeAttribute("data-shake");
      void item.offsetWidth;
      item.setAttribute("data-shake", "");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (open.current) setOpen(null);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const button = buttonOf(event.target);
    const id = button?.dataset.achievement as AchievementId | undefined;
    if (!button || !id) return;
    const wide = window.matchMedia(WIDE_SKY).matches;
    const steps: Record<string, 1 | -1 | "first" | "last"> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowUp: wide ? 1 : -1,
      ArrowDown: wide ? -1 : 1,
      Home: "first",
      End: "last",
    };
    const step = steps[event.key];
    if (step === undefined) return;
    let next: AchievementId = id;
    if (typeof step === "number") next = stepInBranch(id, step);
    else for (let i = 0; i < 40; i++) next = stepInBranch(next, step === "first" ? -1 : 1);
    event.preventDefault();
    if (next === id) return;
    if (open.current) setOpen(null);
    ref.current?.querySelector<HTMLElement>(`[data-achievement="${next}"]`)?.focus();
  };

  // A pointer on another star: the one a tap opened closes, so two never show at once.
  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const button = buttonOf(event.target);
    if (button && open.current && open.current !== button) setOpen(null);
  };

  // The shake's keyframes are named tree-shake (CSS Modules adds a hash).
  const onAnimationEnd = (event: AnimationEvent) => {
    if (!event.animationName.includes("tree-shake") || !(event.target instanceof Element)) return;
    event.target.closest("[data-shake]")?.removeAttribute("data-shake");
  };

  return (
    <div ref={ref} className={className} onClick={onClick} onKeyDown={onKeyDown} onPointerOver={onPointerOver} onAnimationEnd={onAnimationEnd}>
      {children}
    </div>
  );
}
