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
import { createRandom } from "./world";

type Props = { animate: boolean; count?: number };

/**
 * An "M" silhouette in the xy plane, facing the cameras (they look down
 * -z): each wing is an inner and an outer triangle, bent at the elbow, the
 * tips drooping. `aWing` is 0 at the body, 1 at the tips: the shader flaps
 * by it. One unit is one metre of half span.
 */
function createBirdGeometry(): BufferGeometry {
  const positions: number[] = [];
  const wing: number[] = [];
  for (const side of [-1, 1]) {
    // Inner wing: body to elbow.
    positions.push(0, 0.07, 0, 0, -0.1, 0, side * 0.48, 0.13, 0);
    wing.push(0, 0, 0.5);
    // Outer wing: elbow to tip.
    positions.push(side * 0.48, 0.13, 0, side * 0.4, 0.0, 0, side * 1.0, -0.07, 0);
    wing.push(0.5, 0.5, 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aWing", new Float32BufferAttribute(wing, 1));
  return geometry;
}

/**
 * The flock flies right to left in front of the city, close enough to read
 * as birds (a few metres of span about 100 m out), high enough to cross
 * the upper third of the rear and crane frames, under the title. At y 24
 * the highest wing tip stays near NDC 0.48 in the desktop rear chase, clear
 * of the title's lowest glyphs (about 0.52 at the start of the scroll).
 */
const FLOCK = { z: -115, y: 24, span: 220, period: 70 } as const;

/** A loose, irregular flock crossing the sky slowly, right to left. */
export function Birds({ animate, count = 11 }: Props) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => createBirdGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // No formation: a loose cluster, a leader ahead, stragglers behind.
  const flock = useMemo(() => {
    const random = createRandom(7);
    return Array.from({ length: count }, (_, i) => {
      const lag = (i / Math.max(1, count - 1)) * 26;
      return {
        dx: lag + (random() - 0.5) * 8,
        dy: (random() - 0.5) * 7 - lag * 0.08,
        dz: (random() - 0.5) * 16,
        scale: 2.9 + random() * 0.9,
        bob: random() * Math.PI * 2,
        bank: (random() - 0.5) * 0.35,
      };
    });
  }, [count]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new Color(palette.ink) } }),
    [],
  );

  const place = (instanced: InstancedMesh, time: number) => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const roll = new Vector3(0, 0, 1);
    const position = new Vector3();
    const scale = new Vector3();
    const progress = (time % FLOCK.period) / FLOCK.period;
    const x = FLOCK.span / 2 - progress * FLOCK.span;
    flock.forEach((bird, i) => {
      position.set(
        x + bird.dx,
        FLOCK.y + bird.dy + Math.sin(time * 0.7 + bird.bob) * 0.9,
        FLOCK.z + bird.dz,
      );
      // A slight, slowly changing bank, so no two birds look stamped.
      quaternion.setFromAxisAngle(roll, bird.bank + Math.sin(time * 0.5 + bird.bob) * 0.12);
      scale.setScalar(bird.scale);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    // A still frame shows the flock just left of the frame centre.
    if (mesh.current) place(mesh.current, FLOCK.period * 0.42);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial placement only
  }, [flock]);

  useFrame((state) => {
    if (!animate || !mesh.current || !material.current) return;
    const t = state.clock.elapsedTime;
    material.current.uniforms.uTime.value = t;
    place(mesh.current, t + FLOCK.period * 0.42);
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, flock.length]} frustumCulled={false}>
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
