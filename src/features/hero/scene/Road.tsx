"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  type InstancedMesh,
  type ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from "three";
import { palette } from "@/design/tokens";
import { roadFragmentShader, roadVertexShader } from "../shaders/road";
import { drive, placeStreamed, STREAM, STREAM_LENGTH, type StreamPlacement } from "./drive";
import { world } from "./world";

type Props = { animate: boolean };

const POST_SPACING = 4;
/** Guardrail sits on the curb line, beam facing the road. */
export const RAIL_X = world.road.width / 2 + 0.9;
const BEAM_Y = 0.62;

/** Wet causeway with curbs and a W-beam guardrail on both sides. */
export function Road({ animate }: Props) {
  const material = useRef<ShaderMaterial>(null);
  const posts = useRef<InstancedMesh>(null);
  const { width, zStart, zEnd, y } = world.road;
  const length = zStart - zEnd;
  const centerZ = (zStart + zEnd) / 2;

  const postGeometry = useMemo(() => {
    const geometry = new BoxGeometry(0.12, BEAM_Y + 0.12, 0.16);
    geometry.translate(0, (BEAM_Y + 0.12) / 2, 0);
    return geometry;
  }, []);
  useEffect(() => () => postGeometry.dispose(), [postGeometry]);

  const postPlacements = useMemo<StreamPlacement[]>(() => {
    const list: StreamPlacement[] = [];
    for (let z = STREAM.zFront; z < STREAM.zFront + STREAM_LENGTH; z += POST_SPACING) {
      for (const side of [-1, 1]) list.push({ x: side * (RAIL_X + 0.12), z0: z });
    }
    return list;
  }, []);

  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uDistance: { value: 0 },
          uAsphalt: { value: new Color("#3a2a5c") },
          uLine: { value: new Color("#ffd27a") },
          uEdge: { value: new Color("#fff4ea") },
          uGlow: { value: new Color("#ffb48c") },
          uHorizonZ: { value: zEnd + 20 },
          uSunX: { value: world.sun.position.x },
        },
      ]),
    [zEnd],
  );

  useLayoutEffect(() => {
    if (posts.current) placeStreamed(posts.current, postPlacements, drive.distance);
  }, [postPlacements]);

  useFrame(() => {
    if (!animate) return;
    if (material.current) material.current.uniforms.uDistance.value = drive.distance;
    if (posts.current) placeStreamed(posts.current, postPlacements, drive.distance);
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
          {/* Curb. */}
          <mesh position={[side * (width / 2 + 0.3), 0.18, centerZ]}>
            <boxGeometry args={[0.6, 0.36, length]} />
            <meshStandardMaterial color="#8a78a8" roughness={0.9} />
          </mesh>
          {/* W-beam: a pressed steel band with a darker groove. */}
          <mesh position={[side * RAIL_X, BEAM_Y, centerZ]}>
            <boxGeometry args={[0.06, 0.3, length]} />
            <meshStandardMaterial color="#d9d2e6" roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh position={[side * (RAIL_X - side * 0.035), BEAM_Y, centerZ]}>
            <boxGeometry args={[0.02, 0.07, length]} />
            <meshStandardMaterial color="#6e5d8c" roughness={0.5} metalness={0.5} />
          </mesh>
        </group>
      ))}
      <instancedMesh
        ref={posts}
        args={[postGeometry, undefined, postPlacements.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial color={palette.ink} roughness={0.7} metalness={0.3} />
      </instancedMesh>
    </group>
  );
}
