"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, type ShaderMaterial } from "three";
import { palette } from "@/design/tokens";
import {
  flareFragmentShader,
  flareVertexShader,
  sunFragmentShader,
  sunVertexShader,
} from "../shaders/sun";
import type { QualityTier } from "../useQualityTier";
import { cloudDefines, createSkyUniforms } from "./skyUniforms";
import { world } from "./world";

type Props = { tier: QualityTier; animate: boolean };

/**
 * Linear HDR radiance of the disc. The core sits well above the bloom
 * threshold (0.8), so the bloom haloes it and the neutral tone mapping
 * rolls it off to a warm white instead of clipping; the limb stays a
 * saturated peach.
 */
const SUN_LOOK = {
  core: { color: "#fff3d6", radiance: 5 },
  limb: { color: "#ffb07a", radiance: 2.2 },
  halo: { color: "#ffc29a", radiance: 0.9 },
  /** The anamorphic streak: faint, a lens hint, not a neon bar. */
  flareOpacity: 0.16,
} as const;

/** Low sun with a faint halo and an anamorphic streak. Bloom-bright. */
export function Sun({ tier, animate }: Props) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => {
    const sky = createSkyUniforms();
    return {
      uTime: { value: 0 },
      uCore: { value: new Color(SUN_LOOK.core.color).multiplyScalar(SUN_LOOK.core.radiance) },
      uLimb: { value: new Color(SUN_LOOK.limb.color).multiplyScalar(SUN_LOOK.limb.radiance) },
      uHalo: { value: new Color(SUN_LOOK.halo.color).multiplyScalar(SUN_LOOK.halo.radiance) },
      // The dome's clouds, to dim the disc where they pass in front of it.
      uSunPosition: sky.uSunPosition,
      uCloudTime: sky.uCloudTime,
    };
  }, []);
  const defines = useMemo(() => cloudDefines(tier), [tier]);

  const flareUniforms = useMemo(
    () => ({
      uColor: { value: new Color(palette.amber) },
      uOpacity: { value: SUN_LOOK.flareOpacity },
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (!animate || !material.current) return;
    // Same clock as the dome (Sky.tsx), so the clouds line up.
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uCloudTime.value = clock.elapsedTime;
  });

  const { position, size } = world.sun;

  return (
    <group position={position}>
      <mesh renderOrder={-1}>
        <planeGeometry args={[size * 1.9, size * 1.9]} />
        <shaderMaterial
          // Defines compile into the program: a new tier needs a new material.
          key={tier}
          ref={material}
          uniforms={uniforms}
          defines={defines}
          vertexShader={sunVertexShader}
          fragmentShader={sunFragmentShader}
          transparent
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <mesh renderOrder={-1} position={[0, -size * 0.04, 0.5]}>
        <planeGeometry args={[size * 5, size * 0.3]} />
        <shaderMaterial
          uniforms={flareUniforms}
          vertexShader={flareVertexShader}
          fragmentShader={flareFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
        />
      </mesh>
    </group>
  );
}
