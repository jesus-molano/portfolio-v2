"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Mesh, UniformsLib, UniformsUtils, Vector3 } from "three";
import { palette } from "@/design/tokens";
import type { StageTimeline } from "@/features/work/workTimeline";
import { carAt, type CarState, HEADLIGHT } from "./carPath";
import { night } from "./nightState";
import type { NightSet } from "./sets/types";
import { WET_ROAD_LIGHTS, wetRoadFragmentShader, wetRoadVertexShader } from "./shaders/wetRoad";

/** The street plane: long along x, wide enough to be the ground of every set. */
const SIZE = { x: 420, z: 140 } as const;
/** Kerb stones: height and depth. */
const KERB = { h: 0.16, d: 0.35 } as const;

/**
 * The wet street every stop shares: dark violet asphalt that mirrors the
 * stop's lights as long streaks, its lane lines, the two kerbs, and the
 * car's headlights on the asphalt ahead of it. Its uniforms switch with the
 * stop, so one draw serves the whole drive.
 */
export function Street({ sets, timeline }: { sets: readonly NightSet[]; timeline: StageTimeline }) {
  const near = useRef<Mesh>(null);
  const far = useRef<Mesh>(null);
  const lastStop = useRef(-1);
  const car = useRef<CarState>({ x: 0, brake: 1, stop: 0 });
  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uBase: { value: new Color("#1d1430") },
          uLine: { value: new Color("#8f86a8") },
          uLightPos: { value: Array.from({ length: WET_ROAD_LIGHTS }, () => new Vector3()) },
          uLightColor: { value: Array.from({ length: WET_ROAD_LIGHTS }, () => new Color()) },
          uLightLevel: { value: new Array<number>(WET_ROAD_LIGHTS).fill(0) },
          uKerbNear: { value: 1.9 },
          uKerbFar: { value: -5.4 },
          uWet: { value: 1 },
          uCarX: { value: 0 },
          uHeadColor: { value: new Color(HEADLIGHT) },
          uHeadLevel: { value: 0.55 },
        },
      ]),
    [],
  );

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame(() => {
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    uniforms.uCarX.value = carAt(timeline, night.p, car.current).x;
    if (night.stop === lastStop.current) return;
    lastStop.current = night.stop;
    const set = sets[night.stop];
    if (!set) return;
    for (let i = 0; i < WET_ROAD_LIGHTS; i += 1) {
      const streak = set.streaks[i];
      uniforms.uLightLevel.value[i] = streak ? streak.level : 0;
      if (!streak) continue;
      (uniforms.uLightPos.value[i] as Vector3).set(...streak.position);
      (uniforms.uLightColor.value[i] as Color).set(streak.color);
    }
    uniforms.uKerbNear.value = set.kerbs.near;
    uniforms.uKerbFar.value = set.kerbs.far;
    near.current?.position.set(0, KERB.h / 2, set.kerbs.near + KERB.d / 2);
    far.current?.position.set(0, KERB.h / 2, set.kerbs.far - KERB.d / 2);
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -20]}>
        <planeGeometry args={[SIZE.x, SIZE.z]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={wetRoadVertexShader}
          fragmentShader={wetRoadFragmentShader}
          fog
        />
      </mesh>
      <mesh ref={near}>
        <boxGeometry args={[SIZE.x, KERB.h, KERB.d]} />
        <meshStandardMaterial color={palette.asphalt} roughness={0.6} />
      </mesh>
      <mesh ref={far}>
        <boxGeometry args={[SIZE.x, KERB.h, KERB.d]} />
        <meshStandardMaterial color={palette.asphalt} roughness={0.6} />
      </mesh>
    </group>
  );
}
