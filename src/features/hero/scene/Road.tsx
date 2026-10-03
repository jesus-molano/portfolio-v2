"use client";

import { useMemo } from "react";
import { Color, UniformsLib, UniformsUtils } from "three";
import { palette } from "@/design/tokens";
import { roadFragmentShader, roadVertexShader } from "../shaders/road";
import { world } from "./world";

/** Wet causeway over the water, with curbs. The camera drives on it. */
export function Road() {
  const { width, zStart, zEnd, y } = world.road;
  const length = zStart - zEnd;
  const centerZ = (zStart + zEnd) / 2;

  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uAsphalt: { value: new Color("#3a2a5c") },
          uLine: { value: new Color("#ffe9bd") },
          uEdge: { value: new Color("#fff4ea") },
          uGlow: { value: new Color("#ffb48c") },
          uHorizonZ: { value: zEnd + 20 },
        },
      ]),
    [zEnd],
  );

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, y, centerZ]}>
        <planeGeometry args={[width, length]} />
        <shaderMaterial
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
