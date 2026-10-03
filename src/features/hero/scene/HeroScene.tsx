"use client";

import { Canvas } from "@react-three/fiber";
import { palette } from "@/design/tokens";
import type { QualityTier } from "../useQualityTier";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Ground } from "./Ground";
import { Haze } from "./Haze";
import { Palms } from "./Palms";
import { Sky } from "./Sky";
import { Skyline } from "./Skyline";
import { Sun } from "./Sun";
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

  return (
    <Canvas
      key={tier}
      flat
      dpr={high ? [1, 1.5] : [1, 1.5]}
      frameloop={animate && active ? "always" : "demand"}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{
        fov: world.camera.fov,
        near: 0.5,
        far: 1200,
        position: world.camera.start.toArray(),
      }}
      aria-hidden
    >
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.haze, world.fog.near, world.fog.far]} />
      {/* Only the reflective ground is lit; every other material is unlit. */}
      <ambientLight intensity={Math.PI} />

      <CameraRig parallax={high && animate} reducedMotion={reducedMotion} />
      <Sky tier={tier} animate={animate} />
      <Sun animate={animate} />
      <Haze />
      <Skyline tier={tier} />
      <Palms animate={animate} count={high ? 16 : 10} />
      <Ground tier={tier} animate={animate} />
      <Effects tier={tier} />
    </Canvas>
  );
}
