"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, DoubleSide, type InstancedMesh, Matrix4, Quaternion, type ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from "three";
import { buildPalm, PALM_SHAPES } from "@/features/hero/scene/palmGeometry";
import { palmFragmentShader, palmVertexShader } from "@/features/hero/shaders/palm";
import type { Vec3 } from "../frame";

export type NightPalm = { position: Vec3; rotation: number; scale: number; variant: number };

/**
 * The hero's procedural palms at night: near-black violet silhouettes
 * against the city glow, swaying a little (ambient life, not story).
 */
export function NightPalms({ palms, tip = "#2c1d4a" }: { palms: NightPalm[]; tip?: string }) {
  const geometries = useMemo(() => PALM_SHAPES.map(buildPalm), []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        { uTime: { value: 0 }, uColor: { value: new Color("#130b24") }, uTip: { value: new Color(tip) } },
      ]),
    [tip],
  );
  const materials = useRef<(ShaderMaterial | null)[]>([]);
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const groups = useMemo(
    () => PALM_SHAPES.map((_, variant) => palms.filter((palm) => palm.variant % PALM_SHAPES.length === variant)),
    [palms],
  );

  useLayoutEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const up = new Vector3(0, 1, 0);
    groups.forEach((list, variant) => {
      const mesh = meshes.current[variant];
      if (!mesh) return;
      list.forEach((palm, i) => {
        m.compose(p.set(...palm.position), q.setFromAxisAngle(up, palm.rotation), s.setScalar(palm.scale));
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [groups]);

  useFrame(({ clock }) => {
    for (const material of materials.current) if (material) material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group>
      {groups.map((list, variant) =>
        list.length === 0 ? null : (
          <instancedMesh
            key={variant}
            ref={(mesh) => {
              meshes.current[variant] = mesh;
            }}
            args={[geometries[variant], undefined, list.length]}
            frustumCulled={false}
          >
            <shaderMaterial
              ref={(material) => {
                materials.current[variant] = material;
              }}
              uniforms={uniforms}
              vertexShader={palmVertexShader}
              fragmentShader={palmFragmentShader}
              fog
              side={DoubleSide}
            />
          </instancedMesh>
        ),
      )}
    </group>
  );
}
