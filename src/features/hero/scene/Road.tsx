"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { palette } from "@/design/tokens";
import { roadFragmentShader, roadVertexShader } from "../shaders/road";
import { drive } from "./drive";
import { world } from "./world";

type Props = { animate: boolean };

/** Wet causeway over the water, with curbs. Lane dashes stream with the drive. */
export function Road({ animate }: Props) {
  const material = useRef<ShaderMaterial>(null);
  const { width, zStart, zEnd, y } = world.road;
  const length = zStart - zEnd;
  const centerZ = (zStart + zEnd) / 2;

  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uDistance: { value: 0 },
          uAsphalt: { value: new Color("#3a2a5c") },
          uLine: { value: new Color("#ffe9bd") },
          uEdge: { value: new Color("#fff4ea") },
          uGlow: { value: new Color("#ffb48c") },
          uHorizonZ: { value: zEnd + 20 },
        },
      ]),
    [zEnd],
  );

  useFrame(() => {
    if (!animate || !material.current) return;
    material.current.uniforms.uDistance.value = drive.distance;
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, y, centerZ]}>
        <planeGeometry args={[width, length]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={roadVertexShader}
          fragmentShader={roadFragmentShader}
          fog
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 0.3), 0.22, centerZ]}>
          <boxGeometry args={[0.6, 0.45, length]} />
          <meshBasicMaterial color={palette.ink} />
        </mesh>
      ))}
    </group>
  );
}
