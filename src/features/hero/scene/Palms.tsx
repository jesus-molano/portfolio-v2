"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
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
import { flattenPalm, PALM_MODELS } from "./palmModels";
import { createRandom } from "./world";

type Props = { animate: boolean; count?: number };

type Placement = { x: number; z0: number; rotation: number; scale: number; variant: number };

const Y_AXIS = new Vector3(0, 1, 0);

function placePalms(count: number): Placement[] {
  const random = createRandom(99);
  const placements: Placement[] = [];
  const step = STREAM_LENGTH / (count / 2);
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const z0 = STREAM.zBack - row * step - (side > 0 ? step * 0.45 : 0);
    // On the beach, just outside the guardrail.
    const x = side * (11 + random() * 5);
    placements.push({
      x,
      z0,
      rotation: random() * Math.PI * 2,
      scale: 0.8 + random() * 0.5,
      variant: Math.floor(random() * PALM_MODELS.length),
    });
  }
  return placements;
}

PALM_MODELS.forEach((url) => useGLTF.preload(url));

/** Kenney palms as tinted silhouettes, streaming past the car and swaying. */
export function Palms({ animate, count = 18 }: Props) {
  const gltfs = useGLTF([...PALM_MODELS]);
  const geometries = useMemo(() => gltfs.map((g) => flattenPalm(g.scene)), [gltfs]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  const placements = useMemo(() => placePalms(count), [count]);
  const groups = useMemo(
    () => PALM_MODELS.map((_, variant) => placements.filter((p) => p.variant === variant)),
    [placements],
  );

  return (
    <group>
      {geometries.map((geometry, variant) => (
        <PalmInstances
          key={PALM_MODELS[variant]}
          geometry={geometry}
          placements={groups[variant]}
          animate={animate}
        />
      ))}
    </group>
  );
}

type InstancesProps = { geometry: BufferGeometry; placements: Placement[]; animate: boolean };

function PalmInstances({ geometry, placements, animate }: InstancesProps) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);

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

  if (placements.length === 0) return null;

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
