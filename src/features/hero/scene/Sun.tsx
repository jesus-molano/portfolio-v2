"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial } from "three";
import { palette } from "@/design/tokens";
import { sunFragmentShader, sunVertexShader } from "../shaders/sun";
import { world } from "./world";

type Props = { animate: boolean };

/** Synthwave sun: gradient disc with drifting horizontal bands, bloom-bright. */
export function Sun({ animate }: Props) {
  const material = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTop: { value: new Color(palette.amber) },
      uMiddle: { value: new Color(palette.orange) },
      uBottom: { value: new Color(palette.magenta) },
      uIntensity: { value: 1.45 },
    }),
    [],
  );

  useFrame((state) => {
    if (!animate || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const { position, size } = world.sun;

  return (
    <mesh position={position} renderOrder={-1}>
      <planeGeometry args={[size, size]} />
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
  );
}
