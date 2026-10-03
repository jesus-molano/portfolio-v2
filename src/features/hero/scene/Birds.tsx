"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  type ShaderMaterial,
  Vector3,
} from "three";
import { palette } from "@/design/tokens";
import { birdFragmentShader, birdVertexShader } from "../shaders/bird";
import { createRandom, world } from "./world";

type Props = { animate: boolean; count?: number };

/** Two thin triangles: a V with flapping tips (see the bird shader). */
function createBirdGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, 0, 0, -1, 0.05, 0, 0, 0, 0.32, 0, 0, 0, 1, 0.05, 0, 0, 0, 0.32],
      3,
    ),
  );
  geometry.setAttribute("aWing", new Float32BufferAttribute([0, 1, 0, 0, 1, 0], 1));
  return geometry;
}

const FLOCK_Z = -275;
const FLOCK_Y = 50;
const SPAN = 150;
const PERIOD = 70;

/** A flock crossing in front of the sun, slowly, right to left. */
export function Birds({ animate, count = 11 }: Props) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => createBirdGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const formation = useMemo(() => {
    const random = createRandom(5);
    return Array.from({ length: count }, (_, i) => {
      const k = Math.ceil(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      return {
        dx: side * k * 2.6 + (random() - 0.5) * 0.8,
        dy: -k * 0.9 + (random() - 0.5) * 0.6,
        dz: k * 1.2,
        scale: 1.3 + random() * 0.5,
        wobble: random() * Math.PI * 2,
      };
    });
  }, [count]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new Color(palette.ink) } }),
    [],
  );

  const place = (instanced: InstancedMesh, time: number) => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    const position = new Vector3();
    const scale = new Vector3();
    const progress = (time % PERIOD) / PERIOD;
    const x = SPAN / 2 - progress * SPAN;
    formation.forEach((bird, i) => {
      position.set(
        x + bird.dx,
        FLOCK_Y + bird.dy + Math.sin(time * 0.8 + bird.wobble) * 0.6,
        FLOCK_Z + bird.dz,
      );
      scale.setScalar(bird.scale);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    // A still frame shows the flock just left of the sun.
    if (mesh.current) place(mesh.current, PERIOD * 0.42);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial placement only
  }, [formation]);

  useFrame((state) => {
    if (!animate || !mesh.current || !material.current) return;
    const t = state.clock.elapsedTime;
    material.current.uniforms.uTime.value = t;
    place(mesh.current, t + PERIOD * 0.42);
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, formation.length]}
      frustumCulled={false}
      position={[0, 0, world.sun.position.z - FLOCK_Z + 20]}
    >
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={birdVertexShader}
        fragmentShader={birdFragmentShader}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}
