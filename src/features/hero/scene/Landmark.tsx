"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { createGlowUniforms, glowFragmentShader, glowVertexShader } from "../shaders/neon";
import {
  createSilhouetteUniforms,
  silhouetteFragmentShader,
  silhouetteVertexShader,
} from "../shaders/silhouette";
import { CITY_CENTRE } from "./cityLayout";
import { buildLandmark, CROWN_TOP } from "./landmarkLayout";
import { sunDirection } from "./skyUniforms";

/**
 * How much of the scene's haze each part takes. The tower is the farthest
 * thing in the city, so full aerial perspective would wash it into the
 * sky; as the focal point it keeps a little more of its colour, and its
 * neon reads through the haze.
 */
const FOG = { tower: 0.7, neon: 0.35, windows: 0.65 } as const;

/** A box (with a depth) or a pane facing +z, with an optional colour and HDR intensity. */
type Instance = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d?: number;
  color?: string;
  intensity?: number;
};

/** Writes axis-aligned instances: boxes (origin at the bottom) or panes (origin at the centre). */
function useInstances(items: Instance[], kind: "box" | "pane") {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const identity = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    const color = new Color();
    items.forEach((item, i) => {
      position.set(item.x, kind === "box" ? item.y + item.h / 2 : item.y, item.z);
      scale.set(item.w, item.h, item.d ?? 1);
      matrix.compose(position, identity, scale);
      mesh.setMatrixAt(i, matrix);
      if (item.color) mesh.setColorAt(i, color.set(item.color).multiplyScalar(item.intensity ?? 1));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, kind]);
  return ref;
}

/**
 * The landmark tower at the end of the avenue (layout in landmarkLayout.ts),
 * with the sidewalks, the plaza and the street lamps that lead to it.
 * Four instanced draws; nothing moves.
 */
export function Landmark() {
  const layout = useMemo(() => buildLandmark(), []);
  const uniforms = useMemo(
    () => ({
      tower: createSilhouetteUniforms({
        height: CROWN_TOP,
        sun: sunDirection(CITY_CENTRE),
        fogAmount: FOG.tower,
        rim: 0.6,
        rimWidth: 1.2,
      }),
      neon: createGlowUniforms(FOG.neon),
      windows: createGlowUniforms(FOG.windows),
    }),
    [],
  );
  const blocks = useInstances(layout.blocks, "box");
  const glows = useInstances(layout.glows, "box");
  const panes = useInstances(layout.panes, "pane");
  const ground = useInstances(layout.ground, "box");

  return (
    <group>
      <instancedMesh ref={blocks} args={[undefined, undefined, layout.blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          uniforms={uniforms.tower}
          vertexShader={silhouetteVertexShader}
          fragmentShader={silhouetteFragmentShader}
          fog
        />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, layout.glows.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          uniforms={uniforms.neon}
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          fog
        />
      </instancedMesh>
      <instancedMesh ref={panes} args={[undefined, undefined, layout.panes.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={uniforms.windows}
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          fog
        />
      </instancedMesh>
      <instancedMesh ref={ground} args={[undefined, undefined, layout.ground.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.9} metalness={0} />
      </instancedMesh>
    </group>
  );
}
