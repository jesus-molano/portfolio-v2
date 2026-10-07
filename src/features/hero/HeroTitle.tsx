"use client";

import { type RefObject, useSyncExternalStore } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { motion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Hero.module.css";
import { getSceneLoading, subscribeSceneLoading } from "./sceneLoading";
import { markTitleIntroDone, registerTitleIntro } from "./titleIntro";

gsap.registerPlugin(useGSAP);

type Props = {
  name: string;
  role: string;
  tagline: string;
  /** Root element, also used by HeroStage for the scroll-driven fade. */
  ref: RefObject<HTMLDivElement | null>;
};

/** The first scroll plays the rest of the reveal this much faster. */
const HURRY = 4;

/**
 * Real heading text over the canvas. Letters reveal on load, word by word so
 * the name can wrap on narrow screens. The initial hidden state comes from
 * CSS (see globals.css), so nothing flashes before hydration. The reveal is
 * shared with the story (titleIntro.ts): the title holds the drive until
 * the name has formed, and the first scroll fast-forwards it.
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
        return registerTitleIntro({ progress: () => 1, hurry: () => {}, complete: () => {} }, true);
      }
      if (!entered) return;

      // Once formed, the letters drop their filter: a blur(0) left inline kept every letter on the
      // filter path of the compositor for the rest of the drive, at no visible difference.
      const letters = ref.current?.querySelectorAll("[data-letter]") ?? [];
      const formed = () => {
        gsap.set(letters, { clearProps: "filter" });
        markTitleIntroDone();
      };
      const intro = gsap.timeline({
        defaults: { ease: motion.ease },
        delay: 0.2,
        onComplete: formed,
      });
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
      return registerTitleIntro({
        progress: () => intro.progress(),
        hurry: () => {
          if (intro.timeScale() < HURRY) intro.timeScale(HURRY);
        },
        complete: () => {
          intro.progress(1);
          formed();
        },
      });
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
