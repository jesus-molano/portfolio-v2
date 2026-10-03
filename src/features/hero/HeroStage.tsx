"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Hero.module.css";
import { HeroCanvas } from "./HeroCanvas";
import { HeroTitle } from "./HeroTitle";
import { heroProgress, STATIC_PROGRESS } from "./scroll/heroProgress";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Props = {
  name: string;
  role: string;
  tagline: string;
  scrollHint: string;
  sceneLabel: string;
};

/**
 * The tall scrolling stage: a sticky viewport with the canvas and the title.
 * Owns every ScrollTrigger tied to the stage element, because child layout
 * effects run before the parent ref is attached.
 */
export function HeroStage({ name, role, tagline, scrollHint, sceneLabel }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reducedMotion) {
        heroProgress.value = STATIC_PROGRESS;
        return;
      }
      heroProgress.value = 0;
      ScrollTrigger.create({
        trigger: stage.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          heroProgress.value = self.progress;
        },
      });
      gsap.to(title.current, {
        yPercent: -35,
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: stage.current,
          start: "top top",
          end: "40% top",
          scrub: true,
        },
      });
      gsap.to("[data-hint]", {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: stage.current,
          start: "top top",
          end: "15% top",
          scrub: true,
        },
      });
    },
    { scope: stage, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div ref={stage} className={styles.stage}>
      <div className={styles.sticky}>
        <HeroCanvas label={sceneLabel} />
        <HeroTitle ref={title} name={name} role={role} tagline={tagline} />
        <p className={styles.hint} data-hint>
          <span className={styles.hintLine} />
          {scrollHint}
        </p>
      </div>
    </div>
  );
}
