"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
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
import { softDiscFragmentShader, softDiscInstancedVertexShader } from "../shaders/softDisc";
import { palmFragmentShader, palmVertexShader } from "../shaders/palm";
import { drive, STREAM, STREAM_LENGTH, streamFade, wrapZ } from "./drive";
import { flattenPalm, PALM_MODELS } from "./palmModels";
import { createRandom } from "./world";

type Props = { animate: boolean; count?: number };

type Placement = {
  x: number;
  z0: number;
  rotation: number;
  scale: number;
  variant: number;
  /** Small lean so the row does not look stamped. */
  lean: number;
};

const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const X_AXIS = new Vector3(1, 0, 0);
/** Trunk base sinks into the sand; the beach plane sits at 0.07. */
const SINK_Y = -0.25;
const SHADOW_Y = 0.09;
const SHADOW_RADIUS = 2.4;

function placePalms(count: number): Placement[] {
  const random = createRandom(99);
  const placements: Placement[] = [];
  const step = STREAM_LENGTH / (count / 2);
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const z0 = STREAM.zBack - row * step - (side > 0 ? step * 0.45 : 0);
    // On the beach, clear of the street lights; never right next to the lens.
    const x = side * (13.5 + random() * 7);
    placements.push({
      x,
      z0,
      rotation: random() * Math.PI * 2,
      scale: 0.8 + random() * 0.5,
      variant: Math.floor(random() * PALM_MODELS.length),
      lean: (random() - 0.5) * 0.12,
    });
  }
  return placements;
}

PALM_MODELS.forEach((url) => useGLTF.preload(url));

/** Kenney palms as tinted silhouettes, streaming past the car and swaying. */
export function Palms({ animate, count = 18 }: Props) {
  const gltfs = useGLTF([...PALM_MODELS]);
  const geometries = useMemo(() => gltfs.map((g) => flattenPalm(g.scene)), [gltfs]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  const placements = useMemo(() => placePalms(count), [count]);
  const groups = useMemo(
    () => PALM_MODELS.map((_, variant) => placements.filter((p) => p.variant === variant)),
    [placements],
  );

  return (
    <group>
      {geometries.map((geometry, variant) => (
        <PalmInstances
          key={PALM_MODELS[variant]}
          geometry={geometry}
          placements={groups[variant]}
          animate={animate}
        />
      ))}
    </group>
  );
}

type InstancesProps = { geometry: BufferGeometry; placements: Placement[]; animate: boolean };

function PalmInstances({ geometry, placements, animate }: InstancesProps) {
  const mesh = useRef<InstancedMesh>(null);
  const shadows = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        { uTime: { value: 0 }, uColor: { value: new Color(palette.ink) } },
      ]),
    [],
  );
  const shadowUniforms = useMemo(
    () => ({ uColor: { value: new Color("#4a2d6e") }, uOpacity: { value: 0.55 } }),
    [],
  );

  const place = (instanced: InstancedMesh, discs: InstancedMesh | null, distance: number) => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const tilt = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    placements.forEach((p, i) => {
      const z = wrapZ(p.z0 + distance);
      const fade = Math.max(0.001, streamFade(z));
      quaternion.setFromAxisAngle(Y_AXIS, p.rotation);
      tilt.setFromAxisAngle(Z_AXIS, p.lean);
      quaternion.multiply(tilt);
      scale.setScalar(p.scale * fade);
      position.set(p.x, SINK_Y, z);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
      if (discs) {
        quaternion.setFromAxisAngle(X_AXIS, -Math.PI / 2);
        scale.set(SHADOW_RADIUS * p.scale * fade, SHADOW_RADIUS * p.scale * 0.8 * fade, 1);
        position.set(p.x, SHADOW_Y, z);
        matrix.compose(position, quaternion, scale);
        discs.setMatrixAt(i, matrix);
      }
    });
    instanced.instanceMatrix.needsUpdate = true;
    if (discs) discs.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    if (mesh.current) place(mesh.current, shadows.current, drive.distance);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial placement only
  }, [placements]);

  useFrame((state) => {
    if (!animate || !mesh.current || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    place(mesh.current, shadows.current, drive.distance);
  });

  if (placements.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[geometry, undefined, placements.length]}
        frustumCulled={false}
      >
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={palmVertexShader}
          fragmentShader={palmFragmentShader}
          fog
          side={2}
        />
      </instancedMesh>
      <instancedMesh
        ref={shadows}
        args={[undefined, undefined, placements.length]}
        frustumCulled={false}
        renderOrder={2}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={shadowUniforms}
          vertexShader={softDiscInstancedVertexShader}
          fragmentShader={softDiscFragmentShader}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </instancedMesh>
    </group>
  );
}
