"use client";

import type { MouseEvent } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { clearFragment, goTo } from "@/lib/navigate";

/** The glide back up the page, in seconds (instant under reduced motion). */
const GLIDE = 1.2;

/**
 * Back to the top of the page: a plain link to #main without JavaScript;
 * with it, a 1.2 s glide (Lenis, through lib/navigate.ts, so Lenis and the
 * page stay together) that rewinds the hero film on the way, then the
 * keyboard focus on the hero's title, so the next Tab starts from the top
 * as well. It drops the old fragment from the address (#projects after
 * the STATS booth), so a reload lands at the top too.
 */
export function BackToTop({ label, className }: { label: string; className?: string }) {
  const reducedMotion = usePrefersReducedMotion();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const title = document.getElementById("hero-title") ?? document.getElementById("main");
    // The address names no section any more: a reload starts at the top, never in the cinema.
    clearFragment();
    goTo(0, { focus: title, glide: reducedMotion ? undefined : GLIDE });
  };

  return (
    <a className={className} href="#main" onClick={onClick}>
      {label} <span aria-hidden="true">↑</span>
    </a>
  );
}
