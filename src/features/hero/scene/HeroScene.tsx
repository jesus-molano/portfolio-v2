"use client";

import { Canvas } from "@react-three/fiber";
import { palette } from "@/design/tokens";
import type { QualityTier } from "../useQualityTier";
import { Birds } from "./Birds";
import { CameraRig } from "./CameraRig";
import { Car } from "./Car";
import { DriveClock } from "./DriveClock";
import { Effects } from "./Effects";
import { Ground } from "./Ground";
import { Haze } from "./Haze";
import { Palms } from "./Palms";
import { Road } from "./Road";
import { Shore } from "./Shore";
import { Sky } from "./Sky";
import { Skyline } from "./Skyline";
import { Sun } from "./Sun";
import { Traffic } from "./Traffic";
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
 * The Canvas is keyed by tier so a tier change rebuilds the renderer and
 * frees the reflector's render targets instead of leaking them.
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
      {/* Lit materials: the car and the water. Everything else is unlit. */}
      <ambientLight intensity={Math.PI * 0.55} color="#d9c4ff" />
      <hemisphereLight args={["#f0b4d8", "#2a1646", 1.6]} />
      <directionalLight position={[-40, 14, -120]} intensity={2.6} color="#ffc9a0" />
      <directionalLight position={[6, 10, 30]} intensity={0.9} color="#e7b7ff" />

      <DriveClock animate={animate} />
      <CameraRig parallax={high && animate} reducedMotion={reducedMotion} />
      <Sky tier={tier} animate={animate} />
      <Sun animate={animate} />
      <Birds animate={animate} count={high ? 11 : 7} />
      <Haze />
      <Skyline tier={tier} />
      <Palms animate={animate} count={high ? 18 : 10} />
      <Ground tier={tier} />
      <Shore animate={animate} />
      <Road animate={animate} />
      <Traffic animate={animate} perLane={high ? 3 : 2} />
      <Car animate={animate} />
      <Effects tier={tier} />
    </Canvas>
  );
}
