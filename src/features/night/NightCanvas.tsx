"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SceneErrorBoundary } from "@/features/hero/SceneErrorBoundary";
import { useQualityTier } from "@/features/hero/useQualityTier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StageTimeline } from "@/features/work/workTimeline";
import styles from "./Night.module.css";
import { setNightReadiness } from "./nightState";

const NightScene = dynamic(() => import("./NightScene").then((m) => m.NightScene), { ssr: false });

type Props = { timeline: StageTimeline; work: Dictionary["work"]; locale: Locale };

/**
 * Mounts the night scene on the client only, and only near the work stage:
 * it mounts when the stage is within about a viewport and a half, renders
 * only while the stage is on screen, and unmounts again when the visitor is
 * far away, so a phone never keeps two scenes busy. A failed scene (no
 * WebGL) marks the night as failed and the stage shows its text.
 */
export function NightCanvas({ timeline, work, locale }: Props) {
  const tier = useQualityTier();
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const element = host.current?.closest("section");
    if (!element || typeof IntersectionObserver === "undefined") {
      setNear(true);
      setOnScreen(true);
      return;
    }
    const mount = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), {
      rootMargin: "150% 0px 150% 0px",
    });
    const release = new IntersectionObserver(([entry]) => !entry.isIntersecting && setNear(false), {
      rootMargin: "300% 0px 300% 0px",
    });
    const view = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    mount.observe(element);
    release.observe(element);
    view.observe(element);
    return () => {
      mount.disconnect();
      release.disconnect();
      view.disconnect();
    };
  }, []);

  return (
    <div ref={host} className={styles.canvas} aria-hidden="true">
      {near ? (
        <SceneErrorBoundary name="Night scene" onError={() => setNightReadiness("failed")}>
          <NightScene tier={tier} active={onScreen} timeline={timeline} work={work} locale={locale} />
        </SceneErrorBoundary>
      ) : null}
    </div>
  );
}
