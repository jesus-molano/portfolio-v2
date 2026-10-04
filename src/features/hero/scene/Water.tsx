"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { waterFragmentShader, waterVertexShader } from "../shaders/water";
import { drive } from "./drive";
import { world } from "./world";

type Props = { animate: boolean };

/**
 * The sea on both sides of the barrier island. A shader instead of a
 * reflector: no second scene render, no moving dark reflections, and the
 * pattern streams with the drive like the rest of the ground.
 */
export function Water({ animate }: Props) {
  const material = useRef<ShaderMaterial>(null);
  const { size, center } = world.ground;

  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDistance: { value: 0 },
          uSunX: { value: world.sun.position.x },
          uNear: { value: new Color("#5a3c97") },
          uFar: { value: new Color("#efa6c6") },
          uGlint: { value: new Color("#ffe1bd") },
        },
      ]),
    [],
  );

  useFrame((state) => {
    if (!animate || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uDistance.value = drive.distance;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={center}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        fog
      />
    </mesh>
  );
}
