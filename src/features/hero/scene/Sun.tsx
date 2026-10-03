"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, type ShaderMaterial } from "three";
import { palette } from "@/design/tokens";
import {
  flareFragmentShader,
  flareVertexShader,
  sunFragmentShader,
  sunVertexShader,
} from "../shaders/sun";
import { world } from "./world";

type Props = { animate: boolean };

/** Low sun with atmospheric glow and an anamorphic streak. Bloom-bright. */
export function Sun({ animate }: Props) {
  const material = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCore: { value: new Color("#fff7dc") },
      uRim: { value: new Color("#ffc48c") },
      uGlow: { value: new Color("#ffb79a") },
      uIntensity: { value: 1.02 },
    }),
    [],
  );

  const flareUniforms = useMemo(
    () => ({
      uColor: { value: new Color(palette.amber) },
      uOpacity: { value: 0.32 },
    }),
    [],
  );

  useFrame((state) => {
    if (!animate || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const { position, size } = world.sun;

  return (
    <group position={position}>
      <mesh renderOrder={-1}>
        <planeGeometry args={[size * 1.9, size * 1.9]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={sunVertexShader}
          fragmentShader={sunFragmentShader}
          transparent
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <mesh renderOrder={-1} position={[0, -size * 0.06, 0.5]}>
        <planeGeometry args={[size * 6, size * 0.42]} />
        <shaderMaterial
          uniforms={flareUniforms}
          vertexShader={flareVertexShader}
          fragmentShader={flareFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
        />
      </mesh>
    </group>
  );
}
