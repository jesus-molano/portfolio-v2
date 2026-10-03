"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
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
import { roadFragmentShader, roadVertexShader } from "../shaders/road";
import { drive } from "./drive";
import { world } from "./world";

type Props = { animate: boolean };

const POST_SPACING = 8;
const RAIL_X_OFFSET = 1.1;

/** Wet causeway with curbs and guardrails. Lane dashes stream with the drive. */
export function Road({ animate }: Props) {
  const material = useRef<ShaderMaterial>(null);
  const posts = useRef<InstancedMesh>(null);
  const { width, zStart, zEnd, y } = world.road;
  const length = zStart - zEnd;
  const centerZ = (zStart + zEnd) / 2;
  const railX = width / 2 + RAIL_X_OFFSET;
  const postCount = Math.floor(length / POST_SPACING) * 2;

  useLayoutEffect(() => {
    const mesh = posts.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    let i = 0;
    for (let z = zEnd + POST_SPACING / 2; z < zStart; z += POST_SPACING) {
      for (const side of [-1, 1]) {
        matrix.compose(new Vector3(side * railX, 0.42, z), quaternion, scale);
        mesh.setMatrixAt(i, matrix);
        i += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [railX, zStart, zEnd]);

  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uDistance: { value: 0 },
          uAsphalt: { value: new Color("#3a2a5c") },
          uLine: { value: new Color("#ffe9bd") },
          uEdge: { value: new Color("#fff4ea") },
          uGlow: { value: new Color("#ffb48c") },
          uHorizonZ: { value: zEnd + 20 },
          uSunX: { value: world.sun.position.x },
        },
      ]),
    [zEnd],
  );

  useFrame(() => {
    if (!animate || !material.current) return;
    material.current.uniforms.uDistance.value = drive.distance;
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, y, centerZ]}>
        <planeGeometry args={[width, length]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={roadVertexShader}
          fragmentShader={roadFragmentShader}
          fog
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (width / 2 + 0.3), 0.22, centerZ]}>
            <boxGeometry args={[0.6, 0.45, length]} />
            <meshBasicMaterial color={palette.ink} />
          </mesh>
          {/* Guardrail. */}
          <mesh position={[side * railX, 0.78, centerZ]}>
            <boxGeometry args={[0.1, 0.22, length]} />
            <meshBasicMaterial color="#e2d6f2" />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={posts} args={[undefined, undefined, postCount]} frustumCulled={false}>
        <boxGeometry args={[0.14, 0.84, 0.14]} />
        <meshBasicMaterial color={palette.ink} />
      </instancedMesh>
    </group>
  );
}
