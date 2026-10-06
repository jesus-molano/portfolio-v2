"use client";

import { useEffect } from "react";
import { isOnScreen, ON_SCREEN_THRESHOLDS } from "@/lib/onScreen";

/**
 * Stops the looping CSS animations of the sections marked `data-loops`
 * while they are off screen: the cinema's chasing bulbs, the pause
 * menu's clock, whose colon ticks while the game runs. A running
 * animation costs a style pass every frame wherever
 * the visitor is, and during the hero that time comes out of the scene's
 * frame budget. The section gets `data-offscreen`, and globals.css pauses
 * every animation under it. Without JS they simply run.
 */
export function PauseOffscreen() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.toggleAttribute("data-offscreen", !isOnScreen(entry));
      },
      { threshold: ON_SCREEN_THRESHOLDS },
    );
    document.querySelectorAll("[data-loops]").forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  return null;
}
