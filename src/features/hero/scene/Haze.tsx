"use client";

import { useMemo } from "react";
import { AdditiveBlending, Color } from "three";
import { palette } from "@/design/tokens";
import { hazeFragmentShader, hazeVertexShader } from "../shaders/haze";

const LAYERS = [
  { z: -140, y: 12, width: 900, height: 46, color: palette.pink, opacity: 0.1 },
  { z: -200, y: 18, width: 1000, height: 70, color: palette.amber, opacity: 0.12 },
  { z: -250, y: 24, width: 1100, height: 90, color: palette.haze, opacity: 0.16 },
] as const;

/** Additive gradient planes that melt the horizon into pink light. */
export function Haze() {
  const materials = useMemo(
    () =>
      LAYERS.map((layer) => ({
        uColor: { value: new Color(layer.color) },
        uOpacity: { value: layer.opacity },
      })),
    [],
  );

  return (
    <group>
      {LAYERS.map((layer, i) => (
        <mesh key={layer.z} position={[0, layer.y, layer.z]} renderOrder={1}>
          <planeGeometry args={[layer.width, layer.height]} />
          <shaderMaterial
            uniforms={materials[i]}
            vertexShader={hazeVertexShader}
            fragmentShader={hazeFragmentShader}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}
