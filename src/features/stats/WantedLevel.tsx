"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { getServerWanted, getWanted, markSeen, raised, readSeen, subscribeWanted, WANTED_MAX } from "@/features/suspects/wanted";
import styles from "./Stats.module.css";

type Props = {
  /** The five star slots, one glyph each ("★★★★★"). */
  value: string;
  caption: string;
  /** Said for each level, one star to five ("One star:"). */
  levels: readonly string[];
  /** The popup while she can still raise it, and its flourish at five. */
  hint: string;
  top: string;
};

/** Ties the record to its popup; there is one on the page. */
const HINT_ID = "stats-wanted-hint";

/**
 * Dante's wanted level, live (features/suspects/wanted.ts): one star until
 * she has tried to choose him in the character select, one more a try, up
 * to five. Five fixed star slots, the unlit ones dimmed, so the record is
 * the same size at every level (the server draws one star). The record is
 * a button for its popup: hover (where a pointer hovers), keyboard focus or
 * a tap brings up "Try choosing him, then come back" (at five, "Most
 * wanted"), named for screen readers as its description. Arriving with a
 * level raised since STATS last showed it, the stars flash once (not under
 * reduced motion).
 */
export function WantedLevel({ value, caption, levels, hint, top }: Props) {
  const level = useSyncExternalStore(subscribeWanted, getWanted, getServerWanted);
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  // The flash: once the record is well in view with a level raised since STATS last showed it.
  useEffect(() => {
    const el = button.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (raised(level, readSeen()) && !reducedMotion) {
          setFlash(false);
          requestAnimationFrame(() => setFlash(true));
        }
        markSeen(level);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [level, reducedMotion]);

  // A tapped popup closes on a tap elsewhere or Esc.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !button.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const stars = Array.from(value).slice(0, WANTED_MAX);
  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.wanted}
        aria-describedby={HINT_ID}
        data-open={open ? "" : undefined}
        data-flash={flash ? "" : undefined}
        onClick={() => setOpen((was) => !was)}
        onBlur={() => setOpen(false)}
        onAnimationEnd={() => setFlash(false)}
      >
        <span className={styles.recordValue} aria-hidden="true">
          {stars.map((star, i) => (
            <span key={i} className={styles.star} data-lit={i < level ? "" : undefined}>
              {star}
            </span>
          ))}
        </span>
        <span className="sr-only">{levels[level - 1] ?? levels[0]} </span>
        <span className={styles.recordCaption}>{caption}</span>
      </button>
      <span id={HINT_ID} role="tooltip" className={styles.wantedHint}>
        {level < WANTED_MAX ? hint : top}
      </span>
    </>
  );
}
