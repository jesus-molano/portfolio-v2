"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  type ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { palette } from "@/design/tokens";
import { palmFragmentShader, palmVertexShader } from "../shaders/palm";
import { createPalmGeometry } from "./palmGeometry";
import { createRandom } from "./world";

type Props = { animate: boolean; count?: number };

type Placement = { position: Vector3; rotation: number; scale: number };

function placePalms(count: number): Placement[] {
  const random = createRandom(99);
  const placements: Placement[] = [];
  const zStart = 60;
  const zEnd = -140;
  const step = (zStart - zEnd) / (count / 2);
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const z = zStart - row * step - (side > 0 ? step * 0.45 : 0);
    // On the shoulders of the causeway, just outside the curbs.
    const x = side * (10.5 + random() * 4);
    placements.push({
      position: new Vector3(x, 0, z),
      rotation: random() * Math.PI * 2,
      scale: 0.85 + random() * 0.5,
    });
  }
  return placements;
}

/** Instanced palm silhouettes lining the avenue, swaying in the wind. */
export function Palms({ animate, count = 16 }: Props) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);

  const geometry = useMemo(() => createPalmGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const placements = useMemo(() => placePalms(count), [count]);

  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        { uTime: { value: 0 }, uColor: { value: new Color(palette.ink) } },
      ]),
    [],
  );

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    placements.forEach((p, i) => {
      quaternion.setFromAxisAngle(new Vector3(0, 1, 0), p.rotation);
      scale.setScalar(p.scale);
      matrix.compose(p.position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  }, [placements]);

  useFrame((state) => {
    if (!animate || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, placements.length]}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={palmVertexShader}
        fragmentShader={palmFragmentShader}
        fog
        side={2}
      />
    </instancedMesh>
  );
}
