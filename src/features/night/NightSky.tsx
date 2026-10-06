"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BackSide, Color, type Mesh, Vector3 } from "three";
import { palette } from "@/design/tokens";
import { nightSkyFragmentShader, nightSkyVertexShader } from "./shaders/nightSky";

/** The dome follows the camera, so no shot ever sees its edge. */
const RADIUS = 800;

/**
 * The night sky: a dome centred on the camera with a violet gradient, the
 * city's magenta glow on the horizon, stars and a thin moon: the same
 * island sky at every stop, since he never moved.
 */
export function NightSky() {
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new Color(palette.night).multiplyScalar(0.85) },
      uHorizon: { value: new Color("#3b1a5e") },
      uGlow: { value: new Color(palette.magenta).multiplyScalar(0.12) },
      uGlowLevel: { value: 0.75 },
      uStars: { value: 1 },
      uMoonDir: { value: new Vector3(-0.55, 0.42, -0.72).normalize() },
      uMoon: { value: 1 },
    }),
    [],
  );

  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[RADIUS, 32, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={nightSkyVertexShader}
        fragmentShader={nightSkyFragmentShader}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
