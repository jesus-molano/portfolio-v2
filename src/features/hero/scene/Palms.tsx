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
import { CAR_POSITION, drive, wrapZ } from "./drive";
import { buildPalm, PALM_SHAPES, type StaticPalm } from "./palmGeometry";
import { groundShadow, type RoadsidePalm, roadsidePalms } from "./roadside";
import { sunDirection } from "./skyUniforms";

type Props = { animate: boolean; count?: number };

/** A roadside palm and whether it streams or stands as a twin in the grove. */
type Placement = RoadsidePalm & { fixed: boolean };

const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const X_AXIS = new Vector3(1, 0, 0);
/** Trunk base sinks into the sand; the beach plane sits at 0.07. */
const SINK_Y = -0.15;
const SHADOW_Y = 0.09;
const SHADOW_RADIUS = 1.9;
/**
 * The long soft shadow each palm throws away from the low sun, for a palm
 * of shape scale 1 (its crown sits about this high).
 */
const THROW = groundShadow(sunDirection(CAR_POSITION), 10);

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

/**
 * Procedural palms as tinted silhouettes along both sides of the causeway,
 * streaming past the car and swaying (layout in roadside.ts). Each palm
 * comes in at the landfall at full size, on top of its static twin in the
 * grove there, so none of them grows or pops at the end of the causeway.
 */
export function Palms({ animate, count = 28 }: Props) {
  const geometries = usePalmGeometries();
  const placements = useMemo<Placement[]>(() => {
    const { streamed, twins } = roadsidePalms(count);
    return [
      ...streamed.map((p) => ({ ...p, fixed: false })),
      ...twins.map((p) => ({ ...p, fixed: true })),
    ];
  }, [count]);
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
    () => ({ uColor: { value: new Color("#4a2d6e") }, uOpacity: { value: 0.5 } }),
    [],
  );
  const throwUniforms = useMemo(
    () => ({ uColor: { value: new Color("#4a2d6e") }, uOpacity: { value: 0.32 } }),
    [],
  );
  const throws = useRef<InstancedMesh>(null);

  const place = (instanced: InstancedMesh, distance: number) => {
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const tilt = new Quaternion();
    const flat = new Quaternion().setFromAxisAngle(X_AXIS, -Math.PI / 2);
    const yaw = new Quaternion().setFromAxisAngle(Y_AXIS, THROW.yaw).multiply(flat);
    const position = new Vector3();
    const scale = new Vector3();
    const discs = shadows.current;
    const long = throws.current;
    placements.forEach((p, i) => {
      const z = p.fixed ? p.z0 : wrapZ(p.z0 + distance, p.window);
      quaternion.setFromAxisAngle(Y_AXIS, p.rotation);
      tilt.setFromAxisAngle(Z_AXIS, p.lean);
      quaternion.multiply(tilt);
      scale.setScalar(p.scale);
      position.set(p.x, SINK_Y, z);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
      if (discs) {
        // Contact shadow at the foot of the trunk.
        scale.set(SHADOW_RADIUS * p.scale, SHADOW_RADIUS * p.scale * 0.8, 1);
        position.set(p.x, SHADOW_Y, z);
        matrix.compose(position, flat, scale);
        discs.setMatrixAt(i, matrix);
      }
      if (long) {
        // The long shadow starts at the trunk and runs away from the sun.
        const length = Math.max(THROW.length * p.scale, SHADOW_RADIUS);
        const reach = length / 2 - SHADOW_RADIUS * 0.5;
        scale.set(SHADOW_RADIUS * 1.2 * p.scale, length, 1);
        position.set(p.x + THROW.x * reach, SHADOW_Y + 0.005, z + THROW.z * reach);
        matrix.compose(position, yaw, scale);
        long.setMatrixAt(i, matrix);
      }
    });
    instanced.instanceMatrix.needsUpdate = true;
    if (discs) discs.instanceMatrix.needsUpdate = true;
    if (long) long.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    if (mesh.current) place(mesh.current, drive.distance);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial placement only
  }, [placements]);

  useFrame((state) => {
    if (!animate || !mesh.current || !material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    place(mesh.current, drive.distance);
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
      {THROW.length > 0 ? (
        <instancedMesh
          ref={throws}
          args={[undefined, undefined, placements.length]}
          frustumCulled={false}
          renderOrder={2}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            uniforms={throwUniforms}
            vertexShader={softDiscInstancedVertexShader}
            fragmentShader={softDiscFragmentShader}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </instancedMesh>
      ) : null}
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
