"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { glowSpriteFragmentShader, glowSpriteVertexShader } from "../shaders/glow";
import type { Vec3 } from "../frame";

export type Glow = { position: Vec3; size: number; color: string; intensity: number; level?: number };

export type GlowHandle = {
  /** Sets one glow's level (0..1+) for the next frame. */
  setLevel: (index: number, level: number) => void;
};

/**
 * Soft camera-facing glows, one instanced draw: lamp heads, headlights,
 * brake lights, the halo of a neon. `handle` lets a set dim or strike
 * single glows every frame without React.
 */
export function Glows({ glows, handle, intensity = 1 }: { glows: Glow[]; handle?: { current: GlowHandle | null }; intensity?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const levels = useMemo(() => new InstancedBufferAttribute(new Float32Array(glows.length), 1), [glows]);
  const uniforms = useMemo(
    () => UniformsUtils.merge([UniformsLib.fog, { uIntensity: { value: intensity } }]),
    [intensity],
  );

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new Matrix4();
    const scale = new Vector3();
    const position = new Vector3();
    const identity = new Quaternion();
    const color = new Color();
    levels.setUsage(DynamicDrawUsage);
    glows.forEach((glow, i) => {
      position.set(...glow.position);
      scale.setScalar(glow.size);
      matrix.compose(position, identity, scale);
      target.setMatrixAt(i, matrix);
      target.setColorAt(i, color.set(glow.color).multiplyScalar(glow.intensity));
      levels.setX(i, glow.level ?? 1);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    levels.needsUpdate = true;
    if (handle) {
      // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
      handle.current = {
        setLevel: (index, level) => {
          if (levels.getX(index) === level) return;
          levels.setX(index, level);
          levels.needsUpdate = true;
        },
      };
    }
  }, [glows, levels, handle]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, glows.length]} frustumCulled={false} renderOrder={5}>
      <planeGeometry args={[1, 1]}>
        <primitive object={levels} attach="attributes-aLevel" />
      </planeGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={glowSpriteVertexShader}
        fragmentShader={glowSpriteFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        fog
      />
    </instancedMesh>
  );
}
