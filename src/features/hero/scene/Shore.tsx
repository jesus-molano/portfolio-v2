"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { sandFragmentShader, sandVertexShader } from "../shaders/sand";
import { drive } from "./drive";
import { world } from "./world";

type Props = { animate: boolean };

const SAND = "#ecc8a8";
const WET_SAND = "#cf9ea4";
const FOAM = "#fff3ea";

/** Side beaches run from the curb out to the water, and end where the city starts. */
export const BEACH = { inner: world.road.width / 2 + 0.6, width: 38, zEnd: -160 } as const;
/** Approximate shoreline x on the side beaches (matches the sand shader). */
export const SHORELINE_X = BEACH.inner + BEACH.width * 0.86;
/**
 * The city island: a narrow beach facing us, a seawall with a gap for the
 * road, then the waterfront (Waterfront.tsx) and paved ground under the
 * skyline (which starts at z = -199).
 */
export const CITY = { beachFrom: -158, beachTo: -176, groundTo: -340, width: 720 } as const;
/** Half width of the opening the road needs through the seawall and promenade. */
export const ROAD_GAP = world.road.width / 2 + 1.5;

function useSandUniforms() {
  return useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDistance: { value: 0 },
          uSand: { value: new Color(SAND) },
          uWetSand: { value: new Color(WET_SAND) },
          uFoam: { value: new Color(FOAM) },
        },
      ]),
    [],
  );
}

/**
 * Land under everything: beaches on both sides of the road, and the city
 * island with its own beach, seawall and paved ground. Beaches render after
 * the opaque water (renderOrder 1); contact shadows after them (renderOrder 2).
 */
export function Shore({ animate }: Props) {
  const left = useRef<ShaderMaterial>(null);
  const right = useRef<ShaderMaterial>(null);
  const leftUniforms = useSandUniforms();
  const rightUniforms = useSandUniforms();
  const cityUniforms = useSandUniforms();

  const beachLength = world.road.zStart - BEACH.zEnd;
  const beachCenterZ = (world.road.zStart + BEACH.zEnd) / 2;

  useFrame((state) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    for (const ref of [left, right]) {
      if (!ref.current) continue;
      ref.current.uniforms.uTime.value = t;
      ref.current.uniforms.uDistance.value = drive.distance;
    }
  });

  const wallLength = CITY.width / 2 - ROAD_GAP;
  const wallCenter = ROAD_GAP + wallLength / 2;
  const groundDepth = CITY.beachTo - CITY.groundTo;

  return (
    <group>
      {/* Side beaches. UV u runs from the curb (0) to the water (1). */}
      <mesh
        rotation-x={-Math.PI / 2}
        rotation-z={Math.PI}
        position={[-(BEACH.inner + BEACH.width / 2), 0.07, beachCenterZ]}
        renderOrder={1}
      >
        <planeGeometry args={[BEACH.width, beachLength]} />
        <shaderMaterial
          ref={left}
          uniforms={leftUniforms}
          vertexShader={sandVertexShader}
          fragmentShader={sandFragmentShader}
          transparent
          fog
        />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[BEACH.inner + BEACH.width / 2, 0.07, beachCenterZ]}
        renderOrder={1}
      >
        <planeGeometry args={[BEACH.width, beachLength]} />
        <shaderMaterial
          ref={right}
          uniforms={rightUniforms}
          vertexShader={sandVertexShader}
          fragmentShader={sandFragmentShader}
          transparent
          fog
        />
      </mesh>

      {/* City beach, facing the water (u = 1 is the waterline, toward us). */}
      <mesh
        rotation-x={-Math.PI / 2}
        rotation-z={-Math.PI / 2}
        position={[0, 0.065, (CITY.beachFrom + CITY.beachTo) / 2]}
        renderOrder={1}
      >
        <planeGeometry args={[CITY.beachFrom - CITY.beachTo, CITY.width]} />
        <shaderMaterial
          uniforms={cityUniforms}
          vertexShader={sandVertexShader}
          fragmentShader={sandFragmentShader}
          transparent
          fog
        />
      </mesh>

      {/* Paved city ground under the skyline, split so the avenue stays visible. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`ground${side}`}
          rotation-x={-Math.PI / 2}
          position={[side * wallCenter, 0.3, CITY.beachTo - groundDepth / 2]}
        >
          <planeGeometry args={[wallLength, groundDepth]} />
          <meshStandardMaterial color="#7d6198" roughness={1} />
        </mesh>
      ))}

      {/* Seawall with a light cap stone and a promenade rail, split by the road. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * wallCenter, 0, CITY.beachTo - 1.5]}>
          <mesh position-y={0.2}>
            <boxGeometry args={[wallLength, 0.8, 3]} />
            <meshStandardMaterial color="#7b5a9e" roughness={0.9} />
          </mesh>
          <mesh position-y={0.66}>
            <boxGeometry args={[wallLength, 0.12, 3.25]} />
            <meshStandardMaterial color="#efd9e6" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.95, 1.45]}>
            <boxGeometry args={[wallLength, 0.08, 0.08]} />
            <meshStandardMaterial color="#d8c4ea" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
