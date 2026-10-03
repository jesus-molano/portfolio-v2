"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, type ShaderMaterial } from "three";
import { palette } from "@/design/tokens";
import { gridFragmentShader, gridVertexShader } from "../shaders/grid";
import type { QualityTier } from "../useQualityTier";
import { world } from "./world";

type Props = { tier: QualityTier; animate: boolean };

/**
 * Wet, mirror-like ground with a neon grid sliding toward the camera.
 * The reflector renders the scene a second time, so the low tier swaps it
 * for a flat dark plane and keeps only the grid.
 */
export function Ground({ tier, animate }: Props) {
  const grid = useRef<ShaderMaterial>(null);
  const { size, center } = world.ground;

  const gridUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: 6 },
      uSpacing: { value: 8 },
      uColorA: { value: new Color(palette.cyan) },
      uColorB: { value: new Color(palette.magenta) },
      uIntensity: { value: 1.25 },
    }),
    [],
  );

  useFrame((state) => {
    if (!animate || !grid.current) return;
    grid.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group position={center}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[size, size]} />
        {tier === "high" ? (
          // The reflection is multiplied by `color` and lit by the ambient light
          // in HeroScene, so a dark tint plus a high mixStrength keeps the floor
          // black while the sun and the skyline mirror in it.
          <MeshReflectorMaterial
            color="#1a1226"
            resolution={1024}
            mirror={0.85}
            mixBlur={1}
            mixStrength={9}
            blur={[320, 120]}
            depthScale={0}
            roughness={1}
            metalness={0}
          />
        ) : (
          <meshBasicMaterial color={palette.ink} />
        )}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
        <planeGeometry args={[size, size]} />
        <shaderMaterial
          ref={grid}
          uniforms={gridUniforms}
          vertexShader={gridVertexShader}
          fragmentShader={gridFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
        />
      </mesh>
    </group>
  );
}
