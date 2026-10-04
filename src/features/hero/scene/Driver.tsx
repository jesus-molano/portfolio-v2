"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { type Bone, Color, Euler, Mesh, type MeshStandardMaterial, Quaternion } from "three";
import { captureBindPose, poseDriver, type RestBone } from "./driverPose";

type Props = { animate: boolean };

/**
 * Composed from Quaternius "Ultimate Modular Men" (CC0): Adventurer head with
 * the long hair removed and the beard trimmed, Suit short hair, Suit jacket
 * without the tie (recoloured to leather), Casual 2 jeans and trainers.
 */
export const DRIVER_URL = "/models/quaternius-men/driver.glb";

useGLTF.preload(DRIVER_URL);

/**
 * Character root relative to the car origin (driver side is -x, front is -z).
 * Hips land at ~0.52 m in the seat cushion (top at 0.55 m, raycast), which
 * keeps the eyes below the windshield top (1.35 m). The seats were slid
 * 0.2 m forward in the model; the back rests on the backrest.
 */
export const DRIVER_SEAT = { x: -0.42, y: -0.29, z: 0.27 } as const;

/**
 * The exported GLB carries no base colours (the master file keeps them in
 * nodes the exporter skips), so every material is set here. Without this,
 * skin, eyes and eyebrows all render white.
 */
const MATERIAL_COLORS: Record<string, { color: string; roughness: number; metalness: number }> = {
  // Matte leather: a glossy jacket mirrored the lilac sky.
  Suit: { color: "#2a1d1b", roughness: 0.62, metalness: 0.05 },
  Hair: { color: "#2a1a12", roughness: 0.9, metalness: 0 },
  White: { color: "#e9e2ee", roughness: 0.85, metalness: 0 },
  LightBlue: { color: "#4f5f8f", roughness: 0.85, metalness: 0 },
  Skin: { color: "#c98f68", roughness: 0.75, metalness: 0 },
  Eye: { color: "#140d0b", roughness: 0.3, metalness: 0 },
  Eyebrows: { color: "#2a1a12", roughness: 0.9, metalness: 0 },
  Red_Dark: { color: "#6e2433", roughness: 0.8, metalness: 0 },
};

/** Slightly smaller than the stock 1.86 m figure, so he sits below the windshield. */
const DRIVER_SCALE = 0.92;

/**
 * Bind pose of a loaded scene, stored on the scene itself. The GLTF cache
 * outlives the Canvas (it remounts when the quality tier changes) and this
 * module (Fast Refresh), so the pose is captured once, before the first
 * poseDriver call.
 */
const REST_POSE_KEY = "vaBindPose";

const q1 = new Quaternion();
const euler = new Euler();

/** The guy at the wheel: seated, right hand on the wheel, left arm on the door. */
export function Driver({ animate }: Props) {
  const { scene } = useGLTF(DRIVER_URL);

  const { bones, rest } = useMemo(() => {
    const map = new Map<string, Bone>();
    scene.traverse((object) => {
      if ((object as Bone).isBone) map.set(object.name, object as Bone);
    });
    const stored = scene.userData[REST_POSE_KEY] as Map<string, RestBone> | undefined;
    const restMap = stored ?? captureBindPose(map);
    // eslint-disable-next-line react-hooks/immutability -- the cached GLTF scene owns its bind pose
    scene.userData[REST_POSE_KEY] = restMap;
    return { bones: map, rest: restMap };
  }, [scene]);

  // Layout effect: the pose is in place before the first frame renders, also
  // with frameloop="demand" (reduced motion), which renders only once.
  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.frustumCulled = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials as MeshStandardMaterial[]) {
        const look = MATERIAL_COLORS[material.name];
        if (!look) continue;
        material.color = new Color(look.color);
        material.roughness = look.roughness;
        material.metalness = look.metalness;
      }
    });
    poseDriver(scene, bones, rest);
  }, [scene, bones, rest]);

  // poseDriver leaves the head at its bind pose; the glance starts from it.
  const headRest = useMemo(
    () => rest.get("Head")?.quaternion.clone() ?? new Quaternion(),
    [rest],
  );

  useFrame((state) => {
    const head = bones.get("Head");
    if (!head) return;
    if (!animate) {
      // Reduced motion can switch on mid-glance: look ahead again.
      head.quaternion.copy(headRest);
      return;
    }
    const t = state.clock.elapsedTime;
    // Checks the mirror now and then; otherwise eyes on the road.
    const glance = Math.max(0, Math.sin(t * 0.35)) ** 8;
    head.quaternion
      .copy(headRest)
      .multiply(q1.setFromEuler(euler.set(0, -glance * 0.55 + Math.sin(t * 1.9) * 0.02, 0)));
  });

  return (
    <primitive
      object={scene}
      position={[DRIVER_SEAT.x, DRIVER_SEAT.y, DRIVER_SEAT.z]}
      rotation-y={Math.PI}
      scale={DRIVER_SCALE}
    />
  );
}
