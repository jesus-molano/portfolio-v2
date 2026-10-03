"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { motion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Hero.module.css";

gsap.registerPlugin(useGSAP);

type Props = {
  name: string;
  role: string;
  tagline: string;
  /** Root element, also used by HeroStage for the scroll-driven fade. */
  ref: RefObject<HTMLDivElement | null>;
};

/**
 * Real heading text over the canvas. Letters reveal on load. The initial
 * hidden state comes from CSS (see globals.css), so there is no flash between
 * the server paint and hydration; the tween animates to the visible state.
 */
export function HeroTitle({ name, role, tagline, ref }: Props) {
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reducedMotion) {
        gsap.set("[data-letter], [data-line]", { clearProps: "all" });
        return;
      }

      const intro = gsap.timeline({ defaults: { ease: motion.ease } });
      intro
        .fromTo(
          "[data-letter]",
          { yPercent: 70, opacity: 0, filter: "blur(14px)" },
          {
            yPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: motion.revealDuration,
            stagger: motion.revealStagger,
          },
        )
        .fromTo(
          "[data-line]",
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, stagger: 0.15 },
          "-=0.9",
        );
    },
    { scope: ref, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={styles.title}>
      <h1 id="hero-title" className={styles.heading}>
        <span className={styles.name} aria-hidden="true">
          {Array.from(name).map((letter, i) => (
            <span key={`${letter}-${i}`} className={styles.letter} data-letter>
              {letter === " " ? " " : letter}
            </span>
          ))}
        </span>
        <span className="sr-only">{name}</span>
        <span className={styles.role} data-line>
          {role}
        </span>
      </h1>
      <p className={styles.tagline} data-line>
        {tagline}
      </p>
    </div>
  );
}
