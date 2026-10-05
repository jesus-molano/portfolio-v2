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
  Vector2,
  Vector3,
} from "three";
import { palette } from "@/design/tokens";
import { roadFragmentShader, roadVertexShader } from "../shaders/road";
import { CAR_POSITION, drive, placeStreamed, ROADSIDE, ROADSIDE_LENGTH, type StreamPlacement } from "./drive";
import { LAMP, LAMP_HEAD, lampPhase, RAIL_X } from "./roadside";
import { createSkyUniforms, SKY_COLORS } from "./skyUniforms";
import { world } from "./world";

export { RAIL_X };

type Props = { animate: boolean };

const POST_SPACING = 4;
const BEAM_Y = 0.62;

/**
 * What the wet film mirrors, in linear HDR (the bloom threshold is 0.8):
 * the sun's column, the sodium lamp heads, the hero's tail lights, and how
 * much of the sky's own colour comes back.
 */
const WET = {
  sun: { color: SKY_COLORS.glow, radiance: 1.8 },
  lamp: { color: palette.sodium, radiance: 3.2 },
  tail: { color: "#ff2a3a", radiance: 2.4 },
  sky: 0.7,
} as const;

/**
 * The hero's tail lights, relative to CAR_POSITION: the centres of the lamp
 * faces of convertible.glb (atlas alpha 0.25, red), at the scale and turn
 * Car.tsx gives the model.
 */
const TAIL_LIGHT = { x: 0.64, y: 0.9, z: 2.1 } as const;

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
    for (let z = ROADSIDE.zFront; z < ROADSIDE.zFront + ROADSIDE_LENGTH; z += POST_SPACING) {
      for (const side of [-1, 1]) list.push({ x: side * (RAIL_X + 0.12), z0: z });
    }
    return list;
  }, []);

  const uniforms = useMemo(() => {
    const glint = (light: { color: string; radiance: number }) =>
      new Color(light.color).multiplyScalar(light.radiance);
    const tail = (side: number) =>
      new Vector3(
        CAR_POSITION.x + side * TAIL_LIGHT.x,
        CAR_POSITION.y + TAIL_LIGHT.y,
        CAR_POSITION.z + TAIL_LIGHT.z,
      );
    return {
      ...UniformsUtils.merge([UniformsLib.fog]),
      // The afterglow gradient the wet film mirrors (skyGradientChunk) and the sun.
      ...createSkyUniforms(),
      uDistance: { value: 0 },
      uAsphalt: { value: new Color(palette.asphalt) },
      uLine: { value: new Color(palette.sodium) },
      uEdge: { value: new Color("#fff4ea") },
      uSunGlint: { value: glint(WET.sun) },
      uLampGlint: { value: glint(WET.lamp) },
      uTailGlint: { value: glint(WET.tail) },
      uLamp: { value: new Vector3(LAMP_HEAD.x, LAMP_HEAD.y, LAMP.spacing) },
      uLampPhase: { value: new Vector2(lampPhase(-1, drive.distance), lampPhase(1, drive.distance)) },
      uLampWindow: { value: new Vector2(ROADSIDE.zFront, ROADSIDE.zBack) },
      uTailLeft: { value: tail(-1) },
      uTailRight: { value: tail(1) },
      uReflection: { value: WET.sky },
    };
  }, []);

  const placePosts = (distance: number) => {
    if (posts.current) placeStreamed(posts.current, postPlacements, distance, { window: ROADSIDE });
  };

  useLayoutEffect(() => {
    placePosts(drive.distance);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial placement only
  }, [postPlacements]);

  useFrame(() => {
    if (!animate) return;
    const shader = material.current;
    if (shader) {
      shader.uniforms.uDistance.value = drive.distance;
      shader.uniforms.uLampPhase.value.set(lampPhase(-1, drive.distance), lampPhase(1, drive.distance));
    }
    placePosts(drive.distance);
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
