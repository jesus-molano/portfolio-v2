"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { waterFragmentShader, waterVertexShader } from "../shaders/water";
import type { QualityTier } from "../useQualityTier";
import { drive } from "./drive";
import { createSkyUniforms } from "./skyUniforms";
import { world } from "./world";

type Props = { tier: QualityTier; animate: boolean };

/**
 * The sun glints. Linear HDR colour, above the bloom threshold. The facets
 * mirror the sun moved `leftOf` metres to the left: seen from the rear and
 * crane cameras, the true glitter path lies under the island (the beach
 * reaches 41 m out from the road axis), so it is cast onto the open water
 * left of the causeway instead, where the sky glow is already warm.
 */
const GLINT = { color: "#ffd6a6", radiance: 3.2, leftOf: 90 } as const;

/**
 * The sea on both sides of the barrier island. A shader instead of a
 * reflector: no second scene render. It mirrors our own sky (the dome's
 * gradient, with a Fresnel falloff) and the sun's glitter path, and its
 * waves stream with the drive like the rest of the ground.
 */
export function Water({ tier, animate }: Props) {
  const material = useRef<ShaderMaterial>(null);
  const { size, center } = world.ground;

  const uniforms = useMemo(() => {
    const sky = createSkyUniforms();
    return {
      ...UniformsUtils.merge([UniformsLib.fog]),
      // The afterglow gradient the surface reflects (skyGradientChunk).
      uTop: sky.uTop,
      uMiddle: sky.uMiddle,
      uHorizon: sky.uHorizon,
      uAwayMiddle: sky.uAwayMiddle,
      uAwayHorizon: sky.uAwayHorizon,
      uGlow: sky.uGlow,
      uSunPosition: sky.uSunPosition,
      uGlintSource: { value: world.sun.position.clone().setX(world.sun.position.x - GLINT.leftOf) },
      uTime: { value: 0 },
      uDistance: { value: 0 },
      uNear: { value: new Color("#5a3c97") },
      uFar: { value: new Color("#efa6c6") },
      uGlint: { value: new Color(GLINT.color).multiplyScalar(GLINT.radiance) },
    };
  }, []);
  const defines = useMemo(() => (tier === "high" ? { WATER_FINE: 1 } : {}), [tier]);

  useFrame((state) => {
    if (!animate || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uDistance.value = drive.distance;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position={center}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        // Defines compile into the program: a new tier needs a new material.
        key={tier}
        ref={material}
        uniforms={uniforms}
        defines={defines}
        vertexShader={waterVertexShader}
        fragmentShader={waterFragmentShader}
        fog
      />
    </mesh>
  );
}
