"use client";

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BackSide, Color, type Mesh } from "three";
import { skyFragmentShader, skyVertexShader } from "../shaders/sky";
import type { QualityTier } from "../useQualityTier";
import { world } from "./world";

type Props = { tier: QualityTier; animate: boolean };

/**
 * Sky dome centred on the camera, with a direction-based afterglow gradient
 * and a warm glow around the sun, plus a star field. A dome instead of a flat
 * backdrop: side shots never see an edge.
 */
export function Sky({ tier, animate }: Props) {
  const dome = useRef<Mesh>(null);

  const uniforms = useMemo(
    () => ({
      // Afterglow ramp: peach at the horizon, pink, then lavender.
      uTop: { value: new Color("#7257cc") },
      uMiddle: { value: new Color("#e49bcd") },
      uHorizon: { value: new Color("#ffcaa0") },
      // Away from the sun the same ramp turns cooler.
      uAwayMiddle: { value: new Color("#b58ad6") },
      uAwayHorizon: { value: new Color("#dca3cf") },
      uGlow: { value: new Color("#ffe2b8") },
      uSunPosition: { value: world.sun.position.clone() },
    }),
    [],
  );

  // CameraRig is mounted first, so the camera already holds this frame's pose.
  useFrame(({ camera }) => {
    dome.current?.position.copy(camera.position);
  });

  return (
    <group>
      <mesh ref={dome} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[world.sky.radius, 48, 24]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={skyVertexShader}
          fragmentShader={skyFragmentShader}
          side={BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <group position={[0, 60, -120]}>
        <Stars
          radius={320}
          depth={60}
          count={tier === "high" ? 500 : 200}
          factor={4}
          saturation={0}
          fade
          speed={animate ? 0.35 : 0}
        />
      </group>
    </group>
  );
}
