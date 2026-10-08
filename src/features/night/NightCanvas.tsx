"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SceneErrorBoundary } from "@/features/hero/SceneErrorBoundary";
import { useQualityTier } from "@/features/hero/useQualityTier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StageTimeline } from "@/features/work/workTimeline";
import styles from "./Night.module.css";
import { getSelectHeld, subscribeSelectHeld } from "@/features/suspects/selectWall";
import { useContextLoss } from "@/hooks/useContextLoss";
import { getNightCovered, setNightReadiness, subscribeNightCovered } from "./nightState";

const NightScene = dynamic(() => import("./NightScene").then((m) => m.NightScene), { ssr: false });

type Props = { timeline: StageTimeline; work: Dictionary["work"]; locale: Locale };

/**
 * Mounts the night scene on the client only, and only near the work stage:
 * it mounts when the stage is within about a viewport and a half, renders
 * only while the stage is on screen and not under its own opaque night
 * (nightCover.ts: the closed iris, the opening's full cover), and unmounts again when the visitor is
 * far away (six screens), so a phone
 * never keeps two scenes busy. While the character select holds her (her
 * choice still ahead) it waits: the city is out of her reach, and its
 * mount, painting every board, landed on a phone pushing at that wall. A failed scene (no
 * WebGL) marks the night as failed and the stage shows its text.
 */
const markFailed = () => setNightReadiness("failed");

export function NightCanvas({ timeline, work, locale }: Props) {
  const tier = useQualityTier();
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const covered = useSyncExternalStore(subscribeNightCovered, getNightCovered, () => false);
  const held = useSyncExternalStore(subscribeSelectHeld, getSelectHeld, () => false);
  // A lost context (a phone short of GPU memory: a white canvas, Chrome's frowning face) mounts a
  // fresh canvas; after a few the night stays dark and the stage plays its text (lib/contextLoss.ts).
  const loss = useContextLoss(markFailed);

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
    // Released only far away (six screens): a pass back up into the hero's end and down again keeps
    // the scene, or the night came back under its cover, compiling, over the first stops.
    const release = new IntersectionObserver(([entry]) => !entry.isIntersecting && setNear(false), {
      rootMargin: "600% 0px 600% 0px",
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
      {near && !held ? (
        <SceneErrorBoundary name="Night scene" onError={() => setNightReadiness("failed")}>
          {loss.mounted ? (
            <NightScene
              key={loss.generation}
              tier={tier}
              active={onScreen && !covered}
              timeline={timeline}
              work={work}
              locale={locale}
              onCreated={loss.onCreated}
            />
          ) : null}
        </SceneErrorBoundary>
      ) : null}
    </div>
  );
}
