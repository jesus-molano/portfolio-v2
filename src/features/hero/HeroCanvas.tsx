"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { isOnScreen, ON_SCREEN_THRESHOLDS } from "@/lib/onScreen";
import styles from "./Hero.module.css";
import { getHeroCovered, getServerHeroCovered, subscribeHeroCovered } from "./heroCover";
import { useContextLoss } from "@/hooks/useContextLoss";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { markSceneReady } from "./sceneLoading";
import { useQualityTier } from "./useQualityTier";

/**
 * The scene's code, asked for as this module runs in the browser, before
 * hydration renders the canvas: left to next/dynamic, the chunk (three.js,
 * the renderer, the post and the scene) was fetched only once hydration
 * reached HeroCanvas, a round trip after all of the page's own code, and
 * the models it loads waited on it. next/dynamic is handed the same promise,
 * so a failed import still reaches the error boundary below (through
 * React.lazy); the handler here only keeps it from being reported as
 * unhandled before the canvas renders. On the server there is nothing to
 * fetch (`ssr: false`).
 */
const heroSceneModule = typeof window === "undefined" ? null : import("./scene/HeroScene");
heroSceneModule?.catch(() => undefined);

const HeroScene = dynamic(() => (heroSceneModule ?? import("./scene/HeroScene")).then((m) => m.HeroScene), {
  ssr: false,
});

type Props = {
  label: string;
  /** Copy of the rooftop billboards, one line per board. */
  billboards: string[];
};

/**
 * Mounts the 3D scene on the client only. The wrapper carries the accessible
 * description; the canvas itself is decorative. If WebGL fails, the CSS sky
 * from the body background stays visible. The render loop pauses while the
 * hero is scrolled out of view, including where Skip leaves it, its edge
 * touching the viewport's (lib/onScreen.ts), and under the opaque night at
 * the end of the drive (heroCover.ts), where nothing of it shows. A held right click or a
 * long-press on it opens the radio wheel (`data-radio-surface`, see
 * RadioWheel). While it is behind the page controls they need no backing
 * (`data-scene`, see PageControls). Memoised: its props are the server's
 * copy, so nothing the stage renders reaches the scene.
 */
export const HeroCanvas = memo(function HeroCanvas({ label, billboards }: Props) {
  const tier = useQualityTier();
  const reducedMotion = usePrefersReducedMotion();
  const wrapper = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const covered = useSyncExternalStore(subscribeHeroCovered, getHeroCovered, getServerHeroCovered);
  const loss = useContextLoss(markSceneReady);

  useEffect(() => {
    const element = wrapper.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // One target: the newest entry is its state now.
    const observer = new IntersectionObserver((entries) => setInView(isOnScreen(entries[entries.length - 1])), {
      threshold: ON_SCREEN_THRESHOLDS,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapper} className={styles.canvas} role="img" aria-label={label} data-radio-surface data-scene>
      {/* A failed scene (no WebGL) must not keep the loading screen up. A lost context mounts a fresh canvas, then gives up to the CSS sky. */}
      <SceneErrorBoundary onError={markSceneReady}>
        {loss.mounted ? (
          <HeroScene
            key={loss.generation}
            tier={tier}
            reducedMotion={reducedMotion}
            active={inView && !covered}
            billboards={billboards}
            onCreated={loss.onCreated}
          />
        ) : null}
      </SceneErrorBoundary>
    </div>
  );
});
