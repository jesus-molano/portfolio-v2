"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { fitCards } from "@/features/hero/fitCards";
import { SUBTITLES_EVENT } from "@/lib/subtitleSize";

/**
 * A line of his as the hero's subtitle cards show it: one block around the
 * whole line, balanced, and as wide as its widest line. A wrapped block
 * would keep the full width of its row, an empty margin on both sides of
 * two short lines, so this sets it to its widest line (hero/fitCards.ts,
 * the hero's and the career city's own fitting), measured when its row
 * changes size (the viewport, the fonts arriving) or the subtitle size
 * changes (lib/subtitleSize.ts: it is a card, `data-card`, in a row that
 * carries `data-captions`), never per frame. The words are the server's;
 * without JS the block keeps its row's width.
 */
export function FitLine({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const text = ref.current;
    const row = text?.parentElement;
    if (!text || !row) return;
    const fit = () => fitCards([text]);
    let disposed = false;
    // The row is as wide as the section, whatever the block's width: fitting never resizes it.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(row);
    if (!observer) fit();
    window.addEventListener(SUBTITLES_EVENT, fit);
    document.fonts?.ready.then(() => {
      if (!disposed) fit();
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener(SUBTITLES_EVENT, fit);
    };
  }, []);

  return (
    <span ref={ref} className={className} data-card>
      {children}
    </span>
  );
}
