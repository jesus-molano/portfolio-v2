"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import type { QualityTier } from "../useQualityTier";
import { world } from "./world";

type Props = { tier: QualityTier };

/**
 * Still water on both sides of the causeway. The reflector renders the scene
 * a second time, so the low tier swaps it for a flat dark plane.
 */
export function Ground({ tier }: Props) {
  const { size, center } = world.ground;

  return (
    <mesh rotation-x={-Math.PI / 2} position={center}>
      <planeGeometry args={[size, size]} />
      {tier === "high" ? (
        // The reflection is multiplied by `color` and lit by the ambient light
        // in HeroScene, so a dark tint plus a high mixStrength keeps the water
        // black while the sun and the skyline mirror in it.
        <MeshReflectorMaterial
          color="#5a3f86"
          resolution={1024}
          mirror={0.7}
          mixBlur={1}
          mixStrength={3}
          blur={[360, 140]}
          depthScale={0}
          roughness={1}
          metalness={0}
        />
      ) : (
        <meshBasicMaterial color="#7a56ad" />
      )}
    </mesh>
  );
}
