"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { motion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Hero.module.css";
import { HeroCanvas } from "./HeroCanvas";
import { HeroTitle } from "./HeroTitle";
import { heroProgress, STATIC_PROGRESS } from "./scroll/heroProgress";
import { SHOT_COUNT, shotIndexAt } from "./scene/shots";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Props = {
  name: string;
  role: string;
  tagline: string;
  scrollHint: string;
  sceneLabel: string;
  hud: { title: string; subtitle: string; camera: string };
  /** One label per shot, shown in the HUD. */
  shots: string[];
  /** Speaker name for the subtitles. */
  speaker: string;
  /** Subtitle lines, in order; see LINE_WINDOWS for when each one shows. */
  lines: string[];
};

/**
 * Scroll windows (progress 0..1) where each subtitle line is visible. The
 * first two share the opening shot and start once the title has faded.
 */
const LINE_WINDOWS: Array<[number, number]> = [
  [0.13, 0.185],
  [0.19, 0.245],
  [0.27, 0.375],
  [0.38, 0.485],
  [0.52, 0.735],
  [0.77, 0.985],
];
const TITLE_OUT = 0.12;

/**
 * ScrollTrigger percentages refer to the stage height, while the scroll
 * progress runs over stage height minus one viewport. This maps progress to
 * a "<x>% top" position so DOM animations line up with the camera shots.
 */
function at(progress: number): string {
  const factor = 1 - 100 / motion.heroScrollVh;
  return `${(progress * 100 * factor).toFixed(2)}% top`;
}

/**
 * The tall scrolling stage: a sticky viewport with the canvas, the title, the
 * letterbox bars, the HUD, the cut flash and the subtitles. Owns every
 * ScrollTrigger tied to the stage element, because child layout effects run
 * before the parent ref is set.
 */
export function HeroStage({
  name,
  role,
  tagline,
  scrollHint,
  sceneLabel,
  hud,
  shots,
  speaker,
  lines,
}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [shot, setShot] = useState(0);

  useGSAP(
    () => {
      if (reducedMotion) {
        heroProgress.value = STATIC_PROGRESS;
        setShot(shotIndexAt(STATIC_PROGRESS));
        return;
      }
      heroProgress.value = 0;
      const trigger = stage.current;
      let currentShot = 0;

      ScrollTrigger.create({
        trigger,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          heroProgress.value = self.progress;
          const next = shotIndexAt(self.progress);
          if (next !== currentShot) {
            currentShot = next;
            setShot(next);
            // Hard cut: one dark frame, like a cinematic edit.
            gsap.fromTo(
              flash.current,
              { opacity: 1 },
              { opacity: 0, duration: 0.26, ease: "power2.out", overwrite: true },
            );
          }
        },
      });

      gsap.to(title.current, {
        yPercent: -30,
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger, start: "top top", end: at(TITLE_OUT), scrub: true },
      });

      gsap.to("[data-hint]", {
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger, start: "top top", end: at(0.1), scrub: true },
      });

      gsap.to("[data-bar='top']", {
        yPercent: -100,
        ease: "none",
        scrollTrigger: { trigger, start: "top top", end: at(0.16), scrub: true },
      });
      gsap.to("[data-bar='bottom']", {
        yPercent: 100,
        ease: "none",
        scrollTrigger: { trigger, start: "top top", end: at(0.16), scrub: true },
      });

      gsap.utils.toArray<HTMLElement>("[data-line-index]").forEach((element, index) => {
        const [start, end] = LINE_WINDOWS[index] ?? LINE_WINDOWS[LINE_WINDOWS.length - 1];
        gsap
          .timeline({
            scrollTrigger: { trigger, start: at(start), end: at(end), scrub: true },
          })
          .fromTo(element, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1 })
          .to(element, { opacity: 1, duration: 4 })
          .to(element, { opacity: 0, y: -8, duration: 0.8 });
      });
    },
    { scope: stage, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  const shotLabel = shots[shot] ?? shots[0];

  return (
    <div ref={stage} className={styles.stage}>
      <div className={styles.sticky}>
        <HeroCanvas label={sceneLabel} />
        <div ref={flash} className={styles.flash} aria-hidden="true" />
        <div className={`${styles.bar} ${styles.barTop}`} data-bar="top" aria-hidden="true" />
        <div className={`${styles.bar} ${styles.barBottom}`} data-bar="bottom" aria-hidden="true" />

        <p className={styles.hud}>
          <span className={styles.hudTitle}>{hud.title}</span>
          <span>{hud.subtitle}</span>
        </p>
        <p className={styles.hudCamera} aria-live="off">
          <span className={styles.hudRec} />
          {hud.camera} {String(shot + 1).padStart(2, "0")}/{String(SHOT_COUNT).padStart(2, "0")}
          <span className={styles.hudShot}>{shotLabel}</span>
        </p>

        <HeroTitle ref={title} name={name} role={role} tagline={tagline} />

        <ul className={styles.subtitles} aria-label={speaker}>
          {lines.map((line, index) => (
            <li key={line} className={styles.subtitle} data-line-index={index}>
              <span className={styles.speaker}>{speaker}:</span> {line}
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
