"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BackSide, type Mesh, type ShaderMaterial } from "three";
import { skyFragmentShader, skyVertexShader } from "../shaders/sky";
import type { QualityTier } from "../useQualityTier";
import { cloudDefines, createSkyUniforms } from "./skyUniforms";
import { world } from "./world";

type Props = { tier: QualityTier; animate: boolean };

/**
 * Sky dome centred on the camera: a direction-based afterglow gradient, a
 * warm glow around the sun and lit clouds (a cumulus bank on the horizon,
 * altocumulus above). A dome instead of a flat backdrop: side shots never
 * see an edge. No stars: this is golden hour.
 */
export function Sky({ tier, animate }: Props) {
  const dome = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);

  // Shared with the environment map (SkyEnvironment), so reflections match.
  const uniforms = useMemo(() => createSkyUniforms(), []);
  const defines = useMemo(() => cloudDefines(tier), [tier]);

  // CameraRig is mounted first, so the camera already holds this frame's pose.
  useFrame(({ camera, clock }) => {
    dome.current?.position.copy(camera.position);
    // The clouds drift with time, never with the drive: they are kilometres
    // away. Under reduced motion they hold still.
    if (animate && material.current) material.current.uniforms.uCloudTime.value = clock.elapsedTime;
  });

  return (
    <mesh ref={dome} renderOrder={-2} frustumCulled={false}>
      <sphereGeometry args={[world.sky.radius, 48, 24]} />
      <shaderMaterial
        // Defines compile into the program: a new tier needs a new material.
        key={tier}
        ref={material}
        uniforms={uniforms}
        defines={defines}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
        side={BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
