"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { createGlowUniforms, glowFragmentShader, glowVertexShader } from "../shaders/neon";
import {
  createSilhouetteUniforms,
  silhouetteFragmentShader,
  silhouetteVertexShader,
} from "../shaders/silhouette";
import type { QualityTier } from "../useQualityTier";
import { buildCity, CITY_CENTRE, windowSize, type Block } from "./cityLayout";
import { sunDirection } from "./skyUniforms";

type Props = { tier: QualityTier };

const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Art-deco city as three instanced draws: silhouettes, windows and neon
 * (edge strips, shopfronts, blade signs). The avenue buildings come first,
 * the skyline behind them. The layout is deterministic (seeded), so frames
 * are reproducible.
 */
export function Skyline({ tier }: Props) {
  const blocksRef = useRef<InstancedMesh>(null);
  const windowsRef = useRef<InstancedMesh>(null);
  const stripsRef = useRef<InstancedMesh>(null);

  const city = useMemo(
    () => (tier === "high" ? buildCity(150, 5000, 400) : buildCity(90, 1500, 120)),
    [tier],
  );

  const silhouetteUniforms = useMemo(
    () => createSilhouetteUniforms({ height: 55, sun: sunDirection(CITY_CENTRE) }),
    [],
  );
  // Neon and shopfronts keep some colour through the haze.
  const stripUniforms = useMemo(() => createGlowUniforms(0.75, 1.3), []);

  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();

    const placeBlock = (mesh: InstancedMesh, block: Block, index: number) => {
      position.set(block.x, block.y + block.h / 2, block.z);
      scale.set(block.w, block.h, block.d);
      quaternion.identity();
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    };

    const blocks = blocksRef.current;
    if (blocks) {
      city.blocks.forEach((b, i) => placeBlock(blocks, b, i));
      blocks.instanceMatrix.needsUpdate = true;
    }

    const strips = stripsRef.current;
    if (strips) {
      city.strips.forEach((s, i) => {
        placeBlock(strips, s, i);
        strips.setColorAt(i, s.color);
      });
      strips.instanceMatrix.needsUpdate = true;
      if (strips.instanceColor) strips.instanceColor.needsUpdate = true;
    }

    const windows = windowsRef.current;
    if (windows) {
      scale.set(1, 1, 1);
      city.windows.forEach((w, i) => {
        position.set(w.x, w.y, w.z);
        quaternion.setFromAxisAngle(Y_AXIS, w.yaw);
        matrix.compose(position, quaternion, scale);
        windows.setMatrixAt(i, matrix);
        windows.setColorAt(i, w.color);
      });
      windows.instanceMatrix.needsUpdate = true;
      if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
    }
  }, [city]);

  return (
    <group>
      <instancedMesh
        ref={blocksRef}
        args={[undefined, undefined, city.blocks.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          uniforms={silhouetteUniforms}
          vertexShader={silhouetteVertexShader}
          fragmentShader={silhouetteFragmentShader}
          fog
        />
      </instancedMesh>
      <instancedMesh
        ref={stripsRef}
        args={[undefined, undefined, city.strips.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          uniforms={stripUniforms}
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          fog
        />
      </instancedMesh>
      <instancedMesh
        ref={windowsRef}
        args={[undefined, undefined, city.windows.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[windowSize.w, windowSize.h]} />
        <meshBasicMaterial color={[1.05, 1.05, 1.05]} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
