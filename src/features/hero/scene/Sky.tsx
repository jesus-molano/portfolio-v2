"use client";

import { Stars } from "@react-three/drei";
import { useMemo } from "react";
import { Color, Vector2 } from "three";
import { palette } from "@/design/tokens";
import { skyFragmentShader, skyVertexShader } from "../shaders/sky";
import type { QualityTier } from "../useQualityTier";
import { world } from "./world";

type Props = { tier: QualityTier; animate: boolean };

/** Gradient backdrop with a warm glow around the sun, plus a star field. */
export function Sky({ tier, animate }: Props) {
  const { position, width, height } = world.sky;

  const uniforms = useMemo(() => {
    // Sun position projected onto the sky plane, in plane UV space.
    const sunUv = new Vector2(
      0.5 + (world.sun.position.x - position.x) / width,
      0.5 + (world.sun.position.y - position.y) / height,
    );
    return {
      uTop: { value: new Color(palette.night) },
      uMiddle: { value: new Color(palette.dusk) },
      uHorizon: { value: new Color(palette.haze) },
      uGlow: { value: new Color(palette.magenta) },
      uSunUv: { value: sunUv },
    };
  }, [position, width, height]);

  return (
    <group>
      <mesh position={position} renderOrder={-2}>
        <planeGeometry args={[width, height]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={skyVertexShader}
          fragmentShader={skyFragmentShader}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <group position={[0, 60, -120]}>
        <Stars
          radius={320}
          depth={60}
          count={tier === "high" ? 2200 : 700}
          factor={5}
          saturation={0.15}
          fade
          speed={animate ? 0.35 : 0}
        />
      </group>
    </group>
  );
}
