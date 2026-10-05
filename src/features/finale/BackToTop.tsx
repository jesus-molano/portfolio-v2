"use client";

import { useLenis } from "lenis/react";
import type { MouseEvent } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** The glide back up the page, in seconds (instant under reduced motion). */
const GLIDE = 1.2;

/**
 * Back to the top of the page: a plain link to #main without JavaScript;
 * with it, a 1.2 s glide (Lenis) that rewinds the hero film on the way, then
 * the keyboard focus on the hero's title, so the next Tab starts from the
 * top as well.
 */
export function BackToTop({ label, className }: { label: string; className?: string }) {
  const lenis = useLenis();
  const reducedMotion = usePrefersReducedMotion();

  const focusTop = () => {
    const title = document.getElementById("hero-title") ?? document.getElementById("main");
    if (!title) return;
    if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
    title.focus({ preventScroll: true });
  };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (lenis && !reducedMotion) {
      lenis.scrollTo(0, { duration: GLIDE, force: true, onComplete: focusTop });
    } else {
      window.scrollTo(0, 0);
      focusTop();
    }
  };

  return (
    <a className={className} href="#main" onClick={onClick}>
      {label} <span aria-hidden="true">↑</span>
    </a>
  );
}
