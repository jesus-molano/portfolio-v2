"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { isOnScreen, lineRootMargin, ON_SCREEN_THRESHOLDS } from "@/lib/onScreen";
import styles from "./PageControls.module.css";

/**
 * The page controls, fixed at the top right: the radio button and the
 * language switch. Over the hero's picture (`data-scene`) they float on
 * their own glass. Anywhere else (the sections' text scrolling under
 * them, the running script under reduced motion, a page with no hero)
 * they sit on one backing (`data-backdrop`), so no line of text shows
 * through. Whether the picture is behind them is asked of an
 * IntersectionObserver whose root is the line of pixels at their bottom
 * edge: the hero is the top of the page, so while its picture crosses
 * that line it covers them. No work per frame. The controls live in the
 * locale's layout, which a client-side navigation keeps mounted (the 404's
 * way back to the city), so they ask again on every new path: the page
 * under them, and its scene or none, is new.
 */
export function PageControls({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    const setBackdrop = (on: boolean) => controls.toggleAttribute("data-backdrop", on);
    const scene = document.querySelector("[data-scene]");
    if (!scene || typeof IntersectionObserver === "undefined") {
      setBackdrop(true);
      return;
    }
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      // The controls keep their box while the loading screen hides them (opacity, visibility).
      const line = controls.getBoundingClientRect().bottom - 1;
      observer = new IntersectionObserver(
        // One target: the newest entry is its state now.
        (entries) => setBackdrop(!isOnScreen(entries[entries.length - 1])),
        { rootMargin: lineRootMargin(line, window.innerHeight), threshold: ON_SCREEN_THRESHOLDS },
      );
      observer.observe(scene);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      observer?.disconnect();
    };
  }, [pathname]);

  return (
    <div ref={ref} className={styles.controls} data-page-controls>
      {children}
    </div>
  );
}
