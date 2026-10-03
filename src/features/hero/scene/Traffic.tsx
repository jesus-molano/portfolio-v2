"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { streakFragmentShader, streakVertexShader } from "../shaders/streak";
import { createRandom, world } from "./world";

type Props = { animate: boolean; perLane?: number };

type Car = { lane: number; offset: number; speed: number; length: number };

const STREAK_Y = 0.5;
const LANES_AWAY = [2.2, 5.6];
const LANES_TOWARD = [-2.2, -5.6];

function makeCars(lanes: number[], perLane: number, seed: number, baseSpeed: number): Car[] {
  const random = createRandom(seed);
  const cars: Car[] = [];
  for (const lane of lanes) {
    for (let i = 0; i < perLane; i += 1) {
      cars.push({
        lane: lane + (random() - 0.5) * 0.6,
        offset: random(),
        speed: baseSpeed * (0.8 + random() * 0.5),
        length: 10 + random() * 10,
      });
    }
  }
  return cars;
}

/**
 * Long-exposure light trails on the causeway: red tail lights moving away on
 * the right, warm headlights coming toward the camera on the left.
 */
export function Traffic({ animate, perLane = 4 }: Props) {
  const tail = useRef<InstancedMesh>(null);
  const head = useRef<InstancedMesh>(null);

  const away = useMemo(() => makeCars(LANES_AWAY, perLane, 11, 26), [perLane]);
  const toward = useMemo(() => makeCars(LANES_TOWARD, perLane, 23, 34), [perLane]);

  const tailUniforms = useMemo(
    () => ({ uColor: { value: new Color("#ff3b4a") }, uIntensity: { value: 1.1 } }),
    [],
  );
  const headUniforms = useMemo(
    () => ({ uColor: { value: new Color("#fff3d6") }, uIntensity: { value: 0.9 } }),
    [],
  );

  const span = world.road.zStart - world.road.zEnd;

  const place = (mesh: InstancedMesh, cars: Car[], time: number, direction: 1 | -1) => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    // Plane +Y maps to the direction of travel; the bright head leads.
    quaternion.setFromAxisAngle(new Vector3(1, 0, 0), direction === -1 ? -Math.PI / 2 : Math.PI / 2);
    cars.forEach((car, i) => {
      const travelled = (car.offset * span + time * car.speed) % span;
      const z = direction === -1 ? world.road.zStart - travelled : world.road.zEnd + travelled;
      position.set(car.lane, STREAK_Y, z);
      scale.set(1, car.length, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    if (tail.current) place(tail.current, away, 0, -1);
    if (head.current) place(head.current, toward, 0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial placement only
  }, [away, toward]);

  useFrame((state) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    if (tail.current) place(tail.current, away, t, -1);
    if (head.current) place(head.current, toward, t, 1);
  });

  return (
    <group>
      <instancedMesh ref={tail} args={[undefined, undefined, away.length]} frustumCulled={false}>
        <planeGeometry args={[0.55, 1]} />
        <shaderMaterial
          uniforms={tailUniforms}
          vertexShader={streakVertexShader}
          fragmentShader={streakFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, toward.length]} frustumCulled={false}>
        <planeGeometry args={[0.55, 1]} />
        <shaderMaterial
          uniforms={headUniforms}
          vertexShader={streakVertexShader}
          fragmentShader={streakFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}
