"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  type ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
} from "three";
import { sandFragmentShader, sandVertexShader } from "../shaders/sand";
import { drive } from "./drive";
import {
  CITY,
  CURB_OUTER,
  ROAD_GAP,
  SHORE,
  SHORE_MAX,
  shoreFlare,
  shoreFrequencies,
  shorePhases,
} from "./roadside";
import { SKY_COLORS } from "./skyUniforms";
import { world } from "./world";

type Props = { animate: boolean };

/** Dry sand in the low sun, its duskier patches, and the rest of the beach. */
const SAND = {
  dry: "#efc6a4",
  shade: "#d6a8a2",
  wet: "#b98597",
  wrack: "#7d5f86",
  grass: "#8a7a8c",
  foam: "#fff1ea",
  shallow: "#e3a9c8",
} as const;

/**
 * Side beaches: from the curb to the water, and on to the landfall on the
 * city beach. Each strip is as wide as the widest sand plus the shallows
 * (no transparent overdraw along the causeway); near the landfall its outer
 * edge follows the flare.
 */
export const BEACH = { inner: CURB_OUTER, width: SHORE_MAX + 5.5, zEnd: SHORE.flare.to - 2 } as const;
export { CITY, ROAD_GAP };

/** Segments along a side strip; the flare needs them, the rest is straight. */
const STRIP_SEGMENTS = 40;

/**
 * One side strip as a flat ribbon at height y, from the curb outward. The
 * outer edge bends out by the flare near the landfall.
 */
function stripGeometry(side: number, y: number): BufferGeometry {
  const zStart = world.road.zStart;
  const zEnd = BEACH.zEnd;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= STRIP_SEGMENTS; i += 1) {
    // Denser toward the landfall, where the flare curves.
    const t = i / STRIP_SEGMENTS;
    const z = zStart + (zEnd - zStart) * (1 - (1 - t) * (1 - t));
    const outer = BEACH.inner + BEACH.width + shoreFlare(z);
    positions.push(side * BEACH.inner, y, z, side * outer, y, z);
    if (i > 0) {
      const a = (i - 1) * 2;
      // Counter-clockwise from above on both sides, so the face points up.
      if (side > 0) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

type SandShape = {
  city: boolean;
  inner: number;
  mean: number;
  amplitude: [number, number];
  frequency: [number, number];
  left: [number, number];
  right: [number, number];
  flare: [number, number, number];
};

const CAUSEWAY: SandShape = {
  city: false,
  inner: CURB_OUTER,
  mean: SHORE.mean,
  amplitude: [SHORE.waves[0].amplitude, SHORE.waves[1].amplitude],
  frequency: shoreFrequencies(),
  left: shorePhases(-1),
  right: shorePhases(1),
  // smoothstep(edge0 < edge1): the flare is full at `to` and gone at `from`.
  flare: [SHORE.flare.to, SHORE.flare.from, SHORE.flare.extra],
};

const CITY_BEACH: SandShape = {
  city: true,
  // Measured from the seawall toward us.
  inner: CITY.beachTo,
  mean: CITY.waterline - CITY.beachTo,
  amplitude: [1.1, 0.45],
  frequency: [0.021, 0.083],
  left: [0.8, 2.6],
  right: [0.8, 2.6],
  flare: [0, 1, 0],
};

/**
 * Seaward edge of the city beach plane. Like the strips (BEACH.width), it
 * runs past the highest waterline by the swash and the shallows' fade, so
 * the shallows reach alpha 0 before the plane ends: no straight seam in
 * the sea.
 */
const CITY_BEACH_FRONT = CITY.waterline + CITY_BEACH.amplitude[0] + CITY_BEACH.amplitude[1] + 5.5;

function useSandUniforms(shape: SandShape) {
  return useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDistance: { value: 0 },
          uSand: { value: new Color(SAND.dry) },
          uSandShade: { value: new Color(SAND.shade) },
          uWetSand: { value: new Color(SAND.wet) },
          uWrack: { value: new Color(SAND.wrack) },
          uGrass: { value: new Color(SAND.grass) },
          uFoam: { value: new Color(SAND.foam) },
          uShallow: { value: new Color(SAND.shallow) },
          // Wet sand mirrors the horizon glow of the sky.
          uSheen: { value: new Color(SKY_COLORS.horizon) },
          uCity: { value: shape.city ? 1 : 0 },
          uInner: { value: shape.inner },
          uShoreMean: { value: shape.mean },
          uShoreAmp: { value: new Vector2(...shape.amplitude) },
          uShoreFreq: { value: new Vector2(...shape.frequency) },
          uPhaseLeft: { value: new Vector2(...shape.left) },
          uPhaseRight: { value: new Vector2(...shape.right) },
          uFlare: { value: new Vector3(...shape.flare) },
        },
      ]),
    [shape],
  );
}

/**
 * Land under everything: narrow beaches on both sides of the causeway, and
 * the city island with its own beach, seawall and paved ground. Beaches
 * render after the opaque water (renderOrder 1); contact shadows after them
 * (renderOrder 2).
 */
export function Shore({ animate }: Props) {
  const strips = useRef<ShaderMaterial>(null);
  const city = useRef<ShaderMaterial>(null);
  const stripUniforms = useSandUniforms(CAUSEWAY);
  const cityUniforms = useSandUniforms(CITY_BEACH);
  const geometries = useMemo(() => [stripGeometry(-1, 0.07), stripGeometry(1, 0.07)], []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  useFrame((state) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    if (strips.current) {
      strips.current.uniforms.uTime.value = t;
      strips.current.uniforms.uDistance.value = drive.distance;
    }
    if (city.current) city.current.uniforms.uTime.value = t;
  });

  const wallLength = CITY.width / 2 - ROAD_GAP;
  const wallCenter = ROAD_GAP + wallLength / 2;
  const groundDepth = CITY.beachTo - CITY.groundTo;

  return (
    <group>
      {/* Side beaches: one ribbon each, sharing one set of uniforms. */}
      {geometries.map((geometry, i) => (
        <mesh key={i === 0 ? "left" : "right"} geometry={geometry} renderOrder={1}>
          <shaderMaterial
            ref={i === 0 ? strips : undefined}
            uniforms={stripUniforms}
            vertexShader={sandVertexShader}
            fragmentShader={sandFragmentShader}
            transparent
            fog
          />
        </mesh>
      ))}

      {/* City beach, from the seawall toward us. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.065, (CITY_BEACH_FRONT + CITY.beachTo) / 2]}
        renderOrder={1}
      >
        <planeGeometry args={[CITY.width, CITY_BEACH_FRONT - CITY.beachTo]} />
        <shaderMaterial
          ref={city}
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
