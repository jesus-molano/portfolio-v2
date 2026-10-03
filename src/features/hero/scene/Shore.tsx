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
import { sandFragmentShader, sandVertexShader } from "../shaders/sand";
import { world } from "./world";

type Props = { animate: boolean };

const SAND = "#e9c6a6";
const WET_SAND = "#c99fa0";
const FOAM = "#fff1e6";
const WOOD = "#3b2452";
const WOOD_DARK = "#2a1a3c";

/** Side beaches run from the curb out to the water. */
const BEACH_WIDTH = 38;
/** The city stands on a shore band with a promenade in front of it. */
const CITY_SHORE = { zFrom: -160, zTo: -200, width: 620 };
/** A wooden pier on the right, reaching into the water. */
const PIER = { x0: 12, length: 52, width: 4.2, z: -48, deckY: 1.1 };

function useSandUniforms() {
  return useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSand: { value: new Color(SAND) },
          uWetSand: { value: new Color(WET_SAND) },
          uFoam: { value: new Color(FOAM) },
        },
      ]),
    [],
  );
}

/**
 * Land under everything that used to float: beaches on both shoulders of the
 * causeway, a shore and promenade under the skyline, and a pier with a hut.
 */
export function Shore({ animate }: Props) {
  const left = useRef<ShaderMaterial>(null);
  const right = useRef<ShaderMaterial>(null);
  const city = useRef<ShaderMaterial>(null);
  const posts = useRef<InstancedMesh>(null);

  const leftUniforms = useSandUniforms();
  const rightUniforms = useSandUniforms();
  const cityUniforms = useSandUniforms();

  const { width: roadWidth, zStart, zEnd } = world.road;
  const roadLength = zStart - zEnd;
  const roadCenterZ = (zStart + zEnd) / 2;
  const beachInner = roadWidth / 2 + 0.6;

  const pierPosts = useMemo(() => {
    const list: Array<[number, number]> = [];
    for (let x = PIER.x0 + 3; x < PIER.x0 + PIER.length; x += 6) {
      list.push([x, PIER.z - PIER.width / 2 + 0.3]);
      list.push([x, PIER.z + PIER.width / 2 - 0.3]);
    }
    return list;
  }, []);

  useLayoutEffect(() => {
    const mesh = posts.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    pierPosts.forEach(([x, z], i) => {
      matrix.compose(new Vector3(x, PIER.deckY / 2 - 0.2, z), quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [pierPosts]);

  useFrame((state) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    for (const ref of [left, right, city]) {
      if (ref.current) ref.current.uniforms.uTime.value = t;
    }
  });

  return (
    <group>
      {/* Side beaches. UV u runs from the curb (0) to the water (1). */}
      <mesh
        rotation-x={-Math.PI / 2}
        rotation-z={Math.PI}
        position={[-(beachInner + BEACH_WIDTH / 2), 0.07, roadCenterZ]}
      >
        <planeGeometry args={[BEACH_WIDTH, roadLength]} />
        <shaderMaterial
          ref={left}
          uniforms={leftUniforms}
          vertexShader={sandVertexShader}
          fragmentShader={sandFragmentShader}
          transparent
          fog
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[beachInner + BEACH_WIDTH / 2, 0.07, roadCenterZ]}>
        <planeGeometry args={[BEACH_WIDTH, roadLength]} />
        <shaderMaterial
          ref={right}
          uniforms={rightUniforms}
          vertexShader={sandVertexShader}
          fragmentShader={sandFragmentShader}
          transparent
          fog
        />
      </mesh>

      {/* City shore: sand facing the water, promenade and seawall under the skyline. */}
      <mesh
        rotation-x={-Math.PI / 2}
        rotation-z={-Math.PI / 2}
        position={[0, 0.07, (CITY_SHORE.zFrom + CITY_SHORE.zTo) / 2]}
      >
        <planeGeometry args={[CITY_SHORE.zFrom - CITY_SHORE.zTo, CITY_SHORE.width]} />
        <shaderMaterial
          ref={city}
          uniforms={cityUniforms}
          vertexShader={sandVertexShader}
          fragmentShader={sandFragmentShader}
          transparent
          fog
        />
      </mesh>
      <mesh position={[0, 0.5, CITY_SHORE.zTo + 4]}>
        <boxGeometry args={[CITY_SHORE.width, 1.0, 8]} />
        <meshBasicMaterial color="#4b2f70" />
      </mesh>
      <mesh position={[0, 1.15, CITY_SHORE.zTo + 7.6]}>
        <boxGeometry args={[CITY_SHORE.width, 0.3, 0.3]} />
        <meshBasicMaterial color="#8c62b8" />
      </mesh>

      {/* Pier with posts and a hut at the end. */}
      <mesh position={[PIER.x0 + PIER.length / 2, PIER.deckY, PIER.z]}>
        <boxGeometry args={[PIER.length, 0.22, PIER.width]} />
        <meshBasicMaterial color={WOOD} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[PIER.x0 + PIER.length / 2, PIER.deckY + 0.5, PIER.z + (side * PIER.width) / 2]}
        >
          <boxGeometry args={[PIER.length, 0.08, 0.08]} />
          <meshBasicMaterial color={WOOD_DARK} />
        </mesh>
      ))}
      <instancedMesh ref={posts} args={[undefined, undefined, pierPosts.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.16, 0.2, PIER.deckY + 0.4, 6]} />
        <meshBasicMaterial color={WOOD_DARK} />
      </instancedMesh>
      <group position={[PIER.x0 + PIER.length - 3, PIER.deckY + 0.11, PIER.z]}>
        <mesh position-y={1.3}>
          <boxGeometry args={[4.2, 2.6, 3.4]} />
          <meshBasicMaterial color={palette.ink} />
        </mesh>
        <mesh position-y={2.9} rotation-y={Math.PI / 4}>
          <coneGeometry args={[3.4, 1.4, 4]} />
          <meshBasicMaterial color={WOOD_DARK} />
        </mesh>
        <mesh position={[0, 1.4, -1.72]}>
          <planeGeometry args={[1.2, 0.9]} />
          <meshBasicMaterial color={[1.6, 1.3, 0.9]} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
