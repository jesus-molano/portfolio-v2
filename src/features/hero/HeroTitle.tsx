"use client";

import { type RefObject, useSyncExternalStore } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { motion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Hero.module.css";
import { getSceneLoading, subscribeSceneLoading } from "./sceneLoading";

gsap.registerPlugin(useGSAP);

type Props = {
  name: string;
  role: string;
  tagline: string;
  /** Root element, also used by HeroStage for the scroll-driven fade. */
  ref: RefObject<HTMLDivElement | null>;
};

/**
 * Real heading text over the canvas. Letters reveal on load, word by word so
 * the name can wrap on narrow screens. The initial hidden state comes from
 * CSS (see globals.css), so nothing flashes before hydration.
 */
export function HeroTitle({ name, role, tagline, ref }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  // The intro waits for the visitor to leave the loading screen.
  const entered = useSyncExternalStore(
    subscribeSceneLoading,
    () => getSceneLoading().entered,
    () => false,
  );

  useGSAP(
    () => {
      if (reducedMotion) {
        gsap.set("[data-letter], [data-line]", { clearProps: "all" });
        return;
      }
      if (!entered) return;

      const intro = gsap.timeline({ defaults: { ease: motion.ease }, delay: 0.2 });
      intro
        .fromTo(
          "[data-letter]",
          { yPercent: 60, opacity: 0, filter: "blur(10px)" },
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
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, stagger: 0.15 },
          "-=0.9",
        );
    },
    { scope: ref, dependencies: [reducedMotion, entered], revertOnUpdate: true },
  );

  return (
    <div ref={ref} className={styles.title}>
      <h1 id="hero-title" className={styles.heading}>
        <span className={styles.name} aria-hidden="true">
          {name.split(" ").map((word, wordIndex) => (
            <span key={`${word}-${wordIndex}`} className={styles.word}>
              {Array.from(word).map((letter, i) => (
                <span key={`${letter}-${i}`} className={styles.letter} data-letter>
                  {letter}
                </span>
              ))}
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
