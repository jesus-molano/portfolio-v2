"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { fitWidth } from "@/features/hero/cardFit";

/**
 * A line of his as the hero's subtitle cards show it: one block around the
 * whole line, balanced, and as wide as its widest line. A wrapped block
 * would keep the full width of its row, an empty margin on both sides of
 * two short lines, so this sets it to its widest line (hero/cardFit.ts),
 * measured when its row changes size (the viewport, the fonts arriving),
 * never per frame. The words are the server's; without JS the block keeps
 * its row's width.
 */
export function FitLine({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const text = ref.current;
    const row = text?.parentElement;
    if (!text || !row) return;
    const fit = () => {
      text.style.removeProperty("--fit");
      const range = document.createRange();
      range.selectNodeContents(text);
      const width = fitWidth(range.getClientRects());
      if (width > 0) text.style.setProperty("--fit", `${width}px`);
    };
    let disposed = false;
    // The row is as wide as the section, whatever the block's width: fitting never resizes it.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(row);
    if (!observer) fit();
    document.fonts?.ready.then(() => {
      if (!disposed) fit();
    });
    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
