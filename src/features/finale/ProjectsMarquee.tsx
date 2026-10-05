"use client";

import { useEffect, useRef, useState } from "react";
import type { Tile } from "./finaleLayout";
import { MarqueeRow, tileKey, type Vars } from "./Marquee";
import styles from "./Marquee.module.css";

type Props = {
  /** The idle rows, top and bottom. */
  idle: [Tile[], Tile[]];
  /** The bottom row re-lettered for each feature ("NOW SHOWING: DOTFILES"), by `data-feature` id. */
  showing: Record<string, Tile[]>;
  rowStyles: [Vars, Vars];
};

/** Keys of the tiles in `next` that `previous` did not have: the ones to hang. */
function freshKeys(previous: readonly Tile[] | null, next: readonly Tile[]): ReadonlySet<string> {
  if (!previous) return new Set();
  const before = new Set(previous.map(tileKey));
  return new Set(next.map(tileKey).filter((key) => !before.has(key)));
}

/**
 * The Afterglow's marquee. Hovering or focusing a poster case (any element
 * with `data-feature` in the section) re-letters the bottom row to that
 * feature's title, one tile at a time, left to right; leaving hangs the
 * idle row back. Only the letters that change are taken down. Reduced
 * motion cuts instead (Marquee.module.css).
 */
export function ProjectsMarquee({ idle, showing, rowStyles }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<{ current: string | null; previous: string | null; changed: boolean }>({
    current: null,
    previous: null,
    changed: false,
  });

  useEffect(() => {
    const section = root.current?.closest("section");
    if (!section) return;
    const featureOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-feature]") : null;
    const show = (id: string | null) =>
      setRows((state) => (state.current === id ? state : { current: id, previous: state.current, changed: true }));
    // Like the cases' CSS, the marquee answers hovering only where a pointer can hover.
    const canHover = window.matchMedia("(hover: hover)");
    const enter = (event: PointerEvent | FocusEvent) => {
      // A tap opens the link at once: the marquee answers mice, pens and the keyboard.
      if ("pointerType" in event && (event.pointerType === "touch" || !canHover.matches)) return;
      const feature = featureOf(event.target);
      if (feature) show(feature.dataset.feature ?? null);
    };
    const leave = (event: PointerEvent | FocusEvent) => {
      const from = featureOf(event.target);
      const to = featureOf(event.relatedTarget);
      if (from && from !== to) show(to?.dataset.feature ?? null);
    };
    section.addEventListener("pointerover", enter);
    section.addEventListener("focusin", enter);
    section.addEventListener("pointerout", leave);
    section.addEventListener("focusout", leave);
    return () => {
      section.removeEventListener("pointerover", enter);
      section.removeEventListener("focusin", enter);
      section.removeEventListener("pointerout", leave);
      section.removeEventListener("focusout", leave);
    };
  }, []);

  const tilesFor = (id: string | null) => (id && showing[id]) || idle[1];
  const bottom = tilesFor(rows.current);
  // Before the first change nothing is fresh: the server's row is already hung.
  const fresh = rows.changed ? freshKeys(tilesFor(rows.previous), bottom) : undefined;

  return (
    <div ref={root} className={styles.marquee} aria-hidden="true">
      <MarqueeRow tiles={idle[0]} style={rowStyles[0]} />
      <MarqueeRow tiles={bottom} style={rowStyles[1]} fresh={fresh} />
    </div>
  );
}
