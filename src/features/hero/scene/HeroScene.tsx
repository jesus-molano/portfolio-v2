"use client";

import type { WebGLRenderer } from "three";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { palette } from "@/design/tokens";
import { SceneErrorBoundary } from "../SceneErrorBoundary";
import { getSceneLoading, subscribeSceneLoading } from "../sceneLoading";
import type { QualityTier } from "../useQualityTier";
import { Billboards } from "./Billboards";
import { Birds } from "./Birds";
import { CameraRig } from "./CameraRig";
import { Car } from "./Car";
import { DevHandle } from "./DevHandle";
import { DriveClock } from "./DriveClock";
import { Effects } from "./Effects";
import { Haze } from "./Haze";
import { Landmark } from "./Landmark";
import { LoadReporter } from "./LoadReporter";
import { Palms } from "./Palms";
import { Props } from "./Props";
import { Road } from "./Road";
import { Shore } from "./Shore";
import { Sky } from "./Sky";
import { SkyEnvironment } from "./SkyEnvironment";
import { Skyline } from "./Skyline";
import { Sun } from "./Sun";
import { Traffic } from "./Traffic";
import { Water } from "./Water";
import { Waterfront } from "./Waterfront";
import { SHOTS } from "./shots";
import { CAR_POSITION } from "./drive";
import { declineLevel, degradedSettings } from "./degrade";
import { READY_GRACE_MS, heroFrameloop } from "./heroFrameloop";
import { sunDirection } from "./skyUniforms";
import { world } from "./world";

/**
 * Light budget for the standard materials. The environment (the sky itself)
 * is the cool lavender fill; the key is the low sun, warm peach, from its
 * real direction. Integrated over the environment map, a face turned to the
 * sun gets about five times the light of a face turned away (key:fill above
 * the 3:1 floor of the art direction), and a shaded pastel facade still
 * reads as pastel. Exposure sits before the neutral tone mapping.
 */
const LIGHT = { environment: 1.4, hemisphere: 0.25, key: 3.6, exposure: 1.0 } as const;

/** A directional light shines from its position toward the origin. */
const KEY_POSITION = sunDirection(CAR_POSITION).multiplyScalar(100).toArray();

/**
 * Production only: development keeps full quality so captured frames stay
 * comparable (SwiftShader runs at a few frames a second and would always
 * step down). Watching starts once the visitor has entered, after the
 * loading screen, so shader compilation never counts as a slow device.
 */
const WATCH_FRAME_RATE = process.env.NODE_ENV === "production";

type Props = {
  tier: QualityTier;
  reducedMotion: boolean;
  /** False while the hero is scrolled out of view: the loop pauses. */
  active: boolean;
  /** Copy of the rooftop billboards, one line per board. */
  billboards: string[];
  /** Hands the renderer over once created (HeroCanvas watches it for a lost context). */
  onCreated?: (state: { gl: WebGLRenderer }) => void;
};

/**
 * The Three.js hero. Loaded client-side only (see HeroCanvas).
 * Under reduced motion the loop renders on demand: one still frame.
 * The Canvas is keyed by tier so a tier change rebuilds the renderer.
 */
export function HeroScene({ tier, reducedMotion, active, billboards, onCreated }: Props) {
  const animate = !reducedMotion;
  const high = tier === "high";
  const opening = SHOTS[0].from;
  // Steps down on a slow device (degrade.ts); never back up.
  const [level, setLevel] = useState(0);
  const quality = degradedSettings(tier, level);
  // A boolean snapshot, so the loading progress ticks do not re-render the scene.
  const entered = useSyncExternalStore(
    subscribeSceneLoading,
    () => getSceneLoading().entered,
    () => false,
  );
  const ready = useSyncExternalStore(
    subscribeSceneLoading,
    () => getSceneLoading().ready,
    () => false,
  );
  // Behind the start menu the scene stops drawing a few seconds after it is ready (heroFrameloop).
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    if (!ready || graceOver) return;
    const timer = setTimeout(() => setGraceOver(true), READY_GRACE_MS);
    return () => clearTimeout(timer);
  }, [ready, graceOver]);
  const frameloop = heroFrameloop({
    animate,
    active,
    ready,
    entered,
    sinceReadyMs: graceOver ? Number.POSITIVE_INFINITY : 0,
  });

  return (
    <Canvas
      key={tier}
      flat
      dpr={quality.dpr}
      // Measured on resize only: by default R3F re-measures its box on every scroll (a layout read) and,
      // as the box moves with the page, re-renders the whole scene tree about twenty times a second.
      resize={{ scroll: false }}
      frameloop={frameloop}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{
        fov: world.camera.fov,
        near: 0.2,
        far: 1400,
        position: [opening.position.x + CAR_POSITION.x, opening.position.y, opening.position.z],
      }}
      onCreated={(state) => {
        // Read by the ToneMapping effect; the materials themselves stay
        // linear (flat) so bloom sees real HDR values.
        state.gl.toneMappingExposure = LIGHT.exposure;
        onCreated?.(state);
      }}
      aria-hidden
    >
      <color attach="background" args={[palette.dusk]} />
      <fog attach="fog" args={[palette.haze, world.fog.near, world.fog.far]} />
      {/* Lit materials (car, driver, traffic, props, hotels): image-based
          light from our own sky, a warm key from the low sun and a faint
          sky/ground fill. Key against fill stays above 3:1. */}
      <SkyEnvironment tier={tier} intensity={LIGHT.environment} />
      <hemisphereLight args={[palette.pink, palette.ink, LIGHT.hemisphere]} />
      <directionalLight position={KEY_POSITION} intensity={LIGHT.key} color={palette.amber} />

      {WATCH_FRAME_RATE && entered && frameloop === "always" ? (
        <PerformanceMonitor onDecline={() => setLevel((current) => declineLevel(tier, current))} />
      ) : null}
      <DevHandle />
      <LoadReporter />
      <DriveClock animate={animate} />
      <CameraRig parallax={high && animate} reducedMotion={reducedMotion} />
      <Sky tier={tier} animate={animate} />
      <Sun tier={tier} animate={animate} />
      <Birds animate={animate} count={high ? 11 : 7} />
      <Haze />
      <Skyline tier={tier} />
      <Landmark />
      <Billboards texts={billboards} />
      <SceneErrorBoundary name="Waterfront">
        <Waterfront animate={animate} />
      </SceneErrorBoundary>
      <Water tier={tier} animate={animate} />
      <Shore animate={animate} />
      <Road animate={animate} />
      <Props animate={animate} tier={tier} />
      {/* One boundary per model group: the hero car never waits for the
          traffic, and a missing GLB hides only its own part. */}
      <SceneErrorBoundary name="Palms">
        <Suspense fallback={null}>
          <Palms animate={animate} count={high ? 28 : 18} />
        </Suspense>
      </SceneErrorBoundary>
      <SceneErrorBoundary name="Car">
        <Suspense fallback={null}>
          <Car animate={animate} tier={tier} />
        </Suspense>
      </SceneErrorBoundary>
      <SceneErrorBoundary name="Traffic">
        <Suspense fallback={null}>
          <Traffic animate={animate} perLane={high ? 3 : 2} />
        </Suspense>
      </SceneErrorBoundary>
      <Effects tier={tier} depthOfField={quality.depthOfField} />
    </Canvas>
  );
}
