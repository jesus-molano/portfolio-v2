"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./Hero.module.css";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { markSceneReady } from "./sceneLoading";
import { useQualityTier } from "./useQualityTier";

const HeroScene = dynamic(() => import("./scene/HeroScene").then((m) => m.HeroScene), {
  ssr: false,
});

type Props = { label: string };

/**
 * Mounts the 3D scene on the client only. The wrapper carries the accessible
 * description; the canvas itself is decorative. If WebGL fails, the CSS sky
 * from the body background stays visible. The render loop pauses while the
 * hero is scrolled out of view.
 */
export function HeroCanvas({ label }: Props) {
  const tier = useQualityTier();
  const reducedMotion = usePrefersReducedMotion();
  const wrapper = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = wrapper.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapper} className={styles.canvas} role="img" aria-label={label}>
      {/* A failed scene (no WebGL) must not keep the loading screen up. */}
      <SceneErrorBoundary onError={markSceneReady}>
        <HeroScene tier={tier} reducedMotion={reducedMotion} active={inView} />
      </SceneErrorBoundary>
    </div>
  );
}
