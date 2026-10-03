"use client";

import { Stars } from "@react-three/drei";
import { useMemo } from "react";
import { Color, Vector2 } from "three";
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
      // Afterglow ramp: peach at the horizon, pink, then lavender.
      uTop: { value: new Color("#7257cc") },
      uMiddle: { value: new Color("#e49bcd") },
      uHorizon: { value: new Color("#ffcaa0") },
      uGlow: { value: new Color("#ffe2b8") },
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
          count={tier === "high" ? 500 : 200}
          factor={4}
          saturation={0}
          fade
          speed={animate ? 0.35 : 0}
        />
      </group>
    </group>
  );
}
