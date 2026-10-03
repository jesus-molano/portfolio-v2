"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { streakFragmentShader, streakVertexShader } from "../shaders/streak";
import { drive, STREAM, STREAM_LENGTH, wrapZ } from "./drive";
import { createRandom } from "./world";

type Props = { animate: boolean; perLane?: number };

/** Relative speed is against the hero car (positive drifts toward +z). */
type Car = { lane: number; z0: number; relativeSpeed: number; length: number };

const STREAK_Y = 0.5;
/** The hero car owns the right lane (x = 2.4); same-direction traffic uses the outer one. */
const LANES_SAME = [5.8];
const LANES_ONCOMING = [-2.4, -5.8];
const X_AXIS = new Vector3(1, 0, 0);

function makeCars(lanes: number[], perLane: number, seed: number, relative: [number, number]): Car[] {
  const random = createRandom(seed);
  const cars: Car[] = [];
  for (const lane of lanes) {
    for (let i = 0; i < perLane; i += 1) {
      cars.push({
        lane: lane + (random() - 0.5) * 0.5,
        z0: STREAM.zFront + random() * STREAM_LENGTH,
        relativeSpeed: relative[0] + random() * (relative[1] - relative[0]),
        length: 9 + random() * 9,
      });
    }
  }
  return cars;
}

/**
 * Long-exposure light trails relative to the hero car: tail lights of cars
 * pulling ahead or dropping back in the outer lane, headlights of oncoming
 * traffic on the left streaming past.
 */
export function Traffic({ animate, perLane = 4 }: Props) {
  const tail = useRef<InstancedMesh>(null);
  const head = useRef<InstancedMesh>(null);

  const same = useMemo(() => makeCars(LANES_SAME, perLane * 2, 11, [-9, 7]), [perLane]);
  const oncoming = useMemo(() => makeCars(LANES_ONCOMING, perLane, 23, [42, 60]), [perLane]);

  const tailUniforms = useMemo(
    () => ({ uColor: { value: new Color("#ff3b4a") }, uIntensity: { value: 1.1 } }),
    [],
  );
  const headUniforms = useMemo(
    () => ({ uColor: { value: new Color("#fff3d6") }, uIntensity: { value: 0.9 } }),
    [],
  );

  const place = (mesh: InstancedMesh, cars: Car[], time: number, towardCamera: boolean) => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    cars.forEach((car, i) => {
      const z = wrapZ(car.z0 + time * car.relativeSpeed);
      // The bright head leads the direction of relative motion.
      const leadsForward = towardCamera || car.relativeSpeed > 0;
      quaternion.setFromAxisAngle(X_AXIS, leadsForward ? Math.PI / 2 : -Math.PI / 2);
      position.set(car.lane, STREAK_Y, z);
      scale.set(1, car.length, 1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    if (tail.current) place(tail.current, same, 0, false);
    if (head.current) place(head.current, oncoming, 0, true);
  }, [same, oncoming]);

  useFrame(() => {
    if (!animate) return;
    const time = drive.distance / drive.speed;
    if (tail.current) place(tail.current, same, time, false);
    if (head.current) place(head.current, oncoming, time, true);
  });

  return (
    <group>
      <instancedMesh ref={tail} args={[undefined, undefined, same.length]} frustumCulled={false}>
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
      <instancedMesh ref={head} args={[undefined, undefined, oncoming.length]} frustumCulled={false}>
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
