"use client";

import { Environment } from "@react-three/drei";
import { memo, useMemo } from "react";
import { AdditiveBlending, BackSide, Color } from "three";
import { palette } from "@/design/tokens";
import {
  environmentGroundFragmentShader,
  environmentLightsFragmentShader,
} from "../shaders/environment";
import { skyFragmentShader, skyVertexShader } from "../shaders/sky";
import type { QualityTier } from "../useQualityTier";
import {
  ENVIRONMENT_LOOK,
  SKY_COLORS,
  cloudDefines,
  createEnvironmentLightUniforms,
  createSkyUniforms,
} from "./skyUniforms";

type Props = { tier: QualityTier; intensity: number };

/**
 * Image-based light from our own sky, rendered once into a cube map (no
 * preset, no network): the sky dome shader with its clouds, a ground below
 * the horizon, a thin warm horizon strip and a hot sun disc. Every standard
 * material in the scene (car, driver, traffic, props, hotels) reflects and
 * is lit by it, so the paint mirrors the sky and the clouds the camera sees.
 *
 * Memoised: drei re-renders the cube (and three.js the prefiltered map)
 * whenever the children change, so a parent re-render must not reach it.
 */
export const SkyEnvironment = memo(function SkyEnvironment({ tier, intensity }: Props) {
  const sky = useMemo(() => createSkyUniforms(), []);
  // Rendered once, so the clouds take full detail on every tier.
  const skyDefines = useMemo(() => cloudDefines("high"), []);
  const ground = useMemo(
    () => ({
      uHorizon: { value: new Color(palette.haze).multiplyScalar(ENVIRONMENT_LOOK.groundHorizon) },
      uDeep: { value: new Color(palette.asphalt).multiplyScalar(ENVIRONMENT_LOOK.groundDeep) },
    }),
    [],
  );
  const lights = useMemo(() => createEnvironmentLightUniforms(palette.amber, SKY_COLORS.glow), []);

  return (
    <Environment
      frames={1}
      resolution={tier === "high" ? 256 : 128}
      background={false}
      environmentIntensity={intensity}
    >
      <mesh renderOrder={0}>
        <sphereGeometry args={[100, 64, 32]} />
        <shaderMaterial
          uniforms={sky}
          defines={skyDefines}
          vertexShader={skyVertexShader}
          fragmentShader={skyFragmentShader}
          side={BackSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={1}>
        <sphereGeometry args={[90, 64, 32]} />
        <shaderMaterial
          uniforms={ground}
          vertexShader={skyVertexShader}
          fragmentShader={environmentGroundFragmentShader}
          side={BackSide}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={2}>
        <sphereGeometry args={[80, 128, 64]} />
        <shaderMaterial
          uniforms={lights}
          vertexShader={skyVertexShader}
          fragmentShader={environmentLightsFragmentShader}
          side={BackSide}
          transparent
          blending={AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </Environment>
  );
});
