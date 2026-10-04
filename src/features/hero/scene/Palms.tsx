"use client";

import { useFrame } from "@react-three/fiber";
import { type Ref, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  type BufferGeometry,
  Color,
  DoubleSide,
  type InstancedMesh,
  type IUniform,
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
import { buildPalm, PALM_SHAPES, type StaticPalm } from "./palmGeometry";
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
const SINK_Y = -0.15;
const SHADOW_Y = 0.09;
const SHADOW_RADIUS = 2.6;

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
      // The procedural palms are built at real size (8-12.5 m).
      scale: 0.85 + random() * 0.3,
      variant: Math.floor(random() * PALM_SHAPES.length),
      lean: (random() - 0.5) * 0.1,
    });
  }
  return placements;
}

/** The four procedural palm geometries, disposed with the component. */
function usePalmGeometries() {
  const geometries = useMemo(() => PALM_SHAPES.map(buildPalm), []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return geometries;
}

function usePalmUniforms() {
  return useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          // Deep violet trunk base, a lilac lift toward the frond tips.
          uColor: { value: new Color(palette.ink) },
          uTip: { value: new Color("#4d3279") },
        },
      ]),
    [],
  );
}

function PalmMaterial({
  uniforms,
  material,
}: {
  uniforms: Record<string, IUniform>;
  material: Ref<ShaderMaterial>;
}) {
  return (
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      vertexShader={palmVertexShader}
      fragmentShader={palmFragmentShader}
      fog
      side={DoubleSide}
    />
  );
}

/** Procedural palms as tinted silhouettes, streaming past the car and swaying. */
export function Palms({ animate, count = 18 }: Props) {
  const geometries = usePalmGeometries();
  const placements = useMemo(() => placePalms(count), [count]);
  const groups = useMemo(
    () => PALM_SHAPES.map((_, variant) => placements.filter((p) => p.variant === variant)),
    [placements],
  );

  return (
    <group>
      {geometries.map((geometry, variant) => (
        <PalmInstances
          key={`palm-${PALM_SHAPES[variant].seed}`}
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
  const uniforms = usePalmUniforms();
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
        <PalmMaterial uniforms={uniforms} material={material} />
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

/** Palms that do not stream, such as the row on the city promenade. */
export function StaticPalms({ palms, animate }: { palms: StaticPalm[]; animate: boolean }) {
  const geometries = usePalmGeometries();
  return (
    <group>
      {geometries.map((geometry, variant) => (
        <StaticPalmInstances
          key={`static-palm-${PALM_SHAPES[variant].seed}`}
          geometry={geometry}
          palms={palms.filter((p) => p.variant === variant)}
          animate={animate}
        />
      ))}
    </group>
  );
}

function StaticPalmInstances({
  geometry,
  palms,
  animate,
}: {
  geometry: BufferGeometry;
  palms: StaticPalm[];
  animate: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = usePalmUniforms();

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    palms.forEach((p, i) => {
      quaternion.setFromAxisAngle(Y_AXIS, p.rotation);
      position.set(p.x, p.y, p.z);
      scale.setScalar(p.scale);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  }, [palms]);

  useFrame((state) => {
    if (animate && material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (palms.length === 0) return null;

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, palms.length]} frustumCulled={false}>
      <PalmMaterial uniforms={uniforms} material={material} />
    </instancedMesh>
  );
}
