"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { palette } from "@/design/tokens";
import { SceneErrorBoundary } from "../SceneErrorBoundary";
import type { QualityTier } from "../useQualityTier";
import { Birds } from "./Birds";
import { CameraRig } from "./CameraRig";
import { Car } from "./Car";
import { DevHandle } from "./DevHandle";
import { DriveClock } from "./DriveClock";
import { Effects } from "./Effects";
import { Haze } from "./Haze";
import { Palms } from "./Palms";
import { Props } from "./Props";
import { Road } from "./Road";
import { Shore } from "./Shore";
import { Sky } from "./Sky";
import { Skyline } from "./Skyline";
import { Sun } from "./Sun";
import { Traffic } from "./Traffic";
import { Water } from "./Water";
import { SHOTS } from "./shots";
import { CAR_POSITION } from "./drive";
import { world } from "./world";

type Props = {
  tier: QualityTier;
  reducedMotion: boolean;
  /** False while the hero is scrolled out of view: the loop pauses. */
  active: boolean;
};

/**
 * The Three.js hero. Loaded client-side only (see HeroCanvas).
 * Under reduced motion the loop renders on demand: one still frame.
 * The Canvas is keyed by tier so a tier change rebuilds the renderer.
 */
export function HeroScene({ tier, reducedMotion, active }: Props) {
  const animate = !reducedMotion;
  const high = tier === "high";
  const opening = SHOTS[0].from;

  return (
    <Canvas
      key={tier}
      flat
      dpr={[1, 1.5]}
      frameloop={animate && active ? "always" : "demand"}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{
        fov: world.camera.fov,
        near: 0.2,
        far: 1400,
        position: [opening.position.x + CAR_POSITION.x, opening.position.y, opening.position.z],
      }}
      aria-hidden
    >
      <color attach="background" args={[palette.dusk]} />
      <fog attach="fog" args={[palette.haze, world.fog.near, world.fog.far]} />
      {/* Lit materials: the car, the driver and the roadside props. */}
      <ambientLight intensity={Math.PI * 0.45} color="#d9c4ff" />
      <hemisphereLight args={["#f6c2df", "#3a2252", 1.5]} />
      <directionalLight position={[0, 14, -120]} intensity={2.4} color="#ffc9a0" />
      <directionalLight position={[8, 10, 30]} intensity={0.8} color="#e7b7ff" />

      <DevHandle />
      <DriveClock animate={animate} />
      <CameraRig parallax={high && animate} reducedMotion={reducedMotion} />
      <Sky tier={tier} animate={animate} />
      <Sun animate={animate} />
      <Birds animate={animate} count={high ? 11 : 7} />
      <Haze />
      <Skyline tier={tier} />
      <Water animate={animate} />
      <Shore animate={animate} />
      <Road animate={animate} />
      <Props animate={animate} tier={tier} />
      {/* One boundary per model group: the hero car never waits for the
          traffic, and a missing GLB hides only its own part. */}
      <SceneErrorBoundary name="Palms">
        <Suspense fallback={null}>
          <Palms animate={animate} count={high ? 16 : 10} />
        </Suspense>
      </SceneErrorBoundary>
      <SceneErrorBoundary name="Car">
        <Suspense fallback={null}>
          <Car animate={animate} />
        </Suspense>
      </SceneErrorBoundary>
      <SceneErrorBoundary name="Traffic">
        <Suspense fallback={null}>
          <Traffic animate={animate} perLane={high ? 3 : 2} />
        </Suspense>
      </SceneErrorBoundary>
      <Effects tier={tier} />
    </Canvas>
  );
}
