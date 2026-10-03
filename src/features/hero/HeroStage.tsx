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
  hud: { title: string; subtitle: string };
  /** Short personal lines revealed along the drive. */
  beats: string[];
};

/** Scroll windows (percent of the stage) where each beat is visible. */
const BEAT_WINDOWS: Array<[number, number]> = [
  [18, 38],
  [42, 62],
  [66, 86],
];

/**
 * The tall scrolling stage: a sticky viewport with the canvas, the title, the
 * letterbox bars, the HUD and the beats. Owns every ScrollTrigger tied to the
 * stage element, because child layout effects run before the parent ref is set.
 */
export function HeroStage({ name, role, tagline, scrollHint, sceneLabel, hud, beats }: Props) {
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
      const trigger = stage.current;

      ScrollTrigger.create({
        trigger,
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
        scrollTrigger: { trigger, start: "top top", end: "40% top", scrub: true },
      });

      gsap.to("[data-hint]", {
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger, start: "top top", end: "12% top", scrub: true },
      });

      gsap.to("[data-bar='top']", {
        yPercent: -100,
        ease: "none",
        scrollTrigger: { trigger, start: "top top", end: "18% top", scrub: true },
      });
      gsap.to("[data-bar='bottom']", {
        yPercent: 100,
        ease: "none",
        scrollTrigger: { trigger, start: "top top", end: "18% top", scrub: true },
      });

      gsap.utils.toArray<HTMLElement>("[data-beat]").forEach((element, index) => {
        const [from, to] = BEAT_WINDOWS[index] ?? BEAT_WINDOWS[BEAT_WINDOWS.length - 1];
        gsap
          .timeline({
            scrollTrigger: { trigger, start: `${from}% top`, end: `${to}% top`, scrub: true },
          })
          .fromTo(element, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1 })
          .to(element, { opacity: 1, duration: 2 })
          .to(element, { opacity: 0, y: -14, duration: 1 });
      });
    },
    { scope: stage, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <div ref={stage} className={styles.stage}>
      <div className={styles.sticky}>
        <HeroCanvas label={sceneLabel} />
        <div className={`${styles.bar} ${styles.barTop}`} data-bar="top" aria-hidden="true" />
        <div className={`${styles.bar} ${styles.barBottom}`} data-bar="bottom" aria-hidden="true" />
        <p className={styles.hud}>
          <span className={styles.hudTitle}>{hud.title}</span>
          <span>{hud.subtitle}</span>
        </p>
        <HeroTitle ref={title} name={name} role={role} tagline={tagline} />
        <ul className={styles.beats} aria-label={hud.title}>
          {beats.map((beat, index) => (
            <li key={beat} className={styles.beat} data-beat>
              <span className={styles.beatIndex}>0{index + 1}</span>
              <span>{beat}</span>
            </li>
          ))}
        </ul>
        <p className={styles.hint} data-hint>
          <span className={styles.hintLine} />
          {scrollHint}
        </p>
      </div>
    </div>
  );
}
