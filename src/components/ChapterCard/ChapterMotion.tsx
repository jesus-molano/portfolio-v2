"use client";

import { useEffect } from "react";
import { whenUncovered } from "@/lib/uncovered";

/** How much of a card shows before it plays its entrance. */
const VISIBLE = 0.35;

/** The font shorthand each of a card's texts is set in, with the text it needs. */
function faces(card: HTMLElement): { font: string; text: string }[] {
  return Array.from(card.querySelectorAll("text"), (text) => {
    const { fontStyle, fontWeight, fontFamily } = getComputedStyle(text);
    return { font: `${fontStyle} ${fontWeight} 16px ${fontFamily}`, text: text.textContent ?? "" };
  });
}

/**
 * Loads the faces a card is set in (the word's script and the banner's
 * capitals). Resolves once they are in, or once they have failed: a card
 * never stays hidden for a font that will not come.
 */
export function facesIn(card: HTMLElement): Promise<unknown> {
  return Promise.all(faces(card).map(({ font, text }) => document.fonts.load(font, text))).catch(() => undefined);
}

/** Whether a card's faces are in already. */
export function facesReady(card: HTMLElement): boolean {
  return faces(card).every(({ font, text }) => document.fonts.check(font, text));
}

/**
 * The chapter cards' entrance, once per card: the word fades in as it
 * turns into place, and 240 ms later the banner unfurls from its middle
 * (ChapterCard.module.css). One observer for every card on the page.
 *
 * The cards are on the page from the first paint, and their box never
 * changes: the server sends the finished drawing. Without JS they simply
 * show. A card still below the fold when the page hydrates waits hidden
 * (`waiting`) and plays when it comes up, once its faces are in. Any other
 * card (one in or above the viewport, or every card under reduced motion,
 * where nothing plays) shows at once if its faces are in, and is held
 * hidden (`held`) until they are otherwise: no card ever paints in a
 * fallback face, even once a slow line outlasts the faces' block period.
 * A card that comes up under a screen (the start menu, LOAD GAME's load
 * screen landing a save on it) plays once the screen has gone, where she
 * sees it (lib/uncovered.ts); the load screen waits for its faces.
 */
export function ChapterMotion() {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]")).filter((card) => card.dataset.chapter === "");
    if (cards.length === 0) return;
    const animate =
      typeof IntersectionObserver !== "undefined" && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
    const below = animate ? cards.filter((card) => card.getBoundingClientRect().top >= window.innerHeight) : [];
    const held = cards.filter((card) => !below.includes(card) && !facesReady(card));

    let live = true;
    const settle = (card: HTMLElement, from: string, to: string) => {
      void facesIn(card).then(() => {
        if (live && card.dataset.chapter === from) card.dataset.chapter = to;
      });
    };
    for (const card of held) {
      card.dataset.chapter = "held";
      settle(card, "held", "");
    }

    let observer: IntersectionObserver | null = null;
    const pending: (() => void)[] = [];
    if (below.length > 0) {
      const watch = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            watch.unobserve(entry.target);
            pending.push(whenUncovered(() => settle(entry.target as HTMLElement, "waiting", "in")));
          }
        },
        { threshold: VISIBLE },
      );
      for (const card of below) {
        card.dataset.chapter = "waiting";
        watch.observe(card);
      }
      observer = watch;
    }

    return () => {
      live = false;
      observer?.disconnect();
      for (const cancel of pending) cancel();
      for (const card of cards) {
        if (card.dataset.chapter === "waiting" || card.dataset.chapter === "held") card.dataset.chapter = "";
      }
    };
  }, []);

  return null;
}
