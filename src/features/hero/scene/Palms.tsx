"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
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
import { drive, STREAM, STREAM_LENGTH, wrapZ } from "./drive";
import { createPalmGeometry } from "./palmGeometry";
import { createRandom } from "./world";

type Props = { animate: boolean; count?: number };

type Placement = { x: number; z0: number; rotation: number; scale: number };

const Y_AXIS = new Vector3(0, 1, 0);

function placePalms(count: number): Placement[] {
  const random = createRandom(99);
  const placements: Placement[] = [];
  const step = STREAM_LENGTH / (count / 2);
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const z0 = STREAM.zBack - row * step - (side > 0 ? step * 0.45 : 0);
    // On the shoulders of the causeway, just outside the curbs.
    const x = side * (10.5 + random() * 4);
    placements.push({ x, z0, rotation: random() * Math.PI * 2, scale: 0.85 + random() * 0.5 });
  }
  return placements;
}

/** Instanced palm silhouettes streaming past the car, swaying in the wind. */
export function Palms({ animate, count = 18 }: Props) {
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

  const place = (instanced: InstancedMesh, distance: number) => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    placements.forEach((p, i) => {
      quaternion.setFromAxisAngle(Y_AXIS, p.rotation);
      scale.setScalar(p.scale);
      position.set(p.x, 0, wrapZ(p.z0 + distance));
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    if (mesh.current) place(mesh.current, drive.distance);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial placement only
  }, [placements]);

  useFrame((state) => {
    if (!animate || !mesh.current || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    place(mesh.current, drive.distance);
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
