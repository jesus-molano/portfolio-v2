"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { type Bone, FrontSide, Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { DRIVER_URL } from "@/features/hero/scene/Driver";
import { captureBindPose, DRIVER_SCALE, DRIVER_SEAT, poseDriver, type RestBone } from "@/features/hero/scene/driverPose";
import { SUNGLASSES_URL } from "@/features/hero/scene/Sunglasses";
import { cloneBare } from "./cloneBare";

/** The bind pose stored on the cached scene, shared with the hero's Driver. */
const REST_POSE_KEY = "vaBindPose";

/**
 * Jesús at the wheel at night: the hero's driver, posed once and cloned,
 * so the hero keeps its own (a scene graph node has one parent). At night
 * he is a shape under the street light: crew cut, beard and aviators.
 */
export function NightDriver() {
  const { scene } = useGLTF(DRIVER_URL);
  const glasses = useGLTF(SUNGLASSES_URL).scene;

  const driver = useMemo(() => {
    const bones = new Map<string, Bone>();
    scene.traverse((object) => {
      if ((object as Bone).isBone) bones.set(object.name, object as Bone);
    });
    const stored = scene.userData[REST_POSE_KEY] as Map<string, RestBone> | undefined;
    const rest = stored ?? captureBindPose(bones);
    // eslint-disable-next-line react-hooks/immutability -- the cached GLTF scene owns its bind pose
    scene.userData[REST_POSE_KEY] = rest;
    poseDriver(scene, bones, rest);
    const copy = cloneBare<Object3D>(scene, (source) => cloneSkinned(source));
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.frustumCulled = false;
      const materials = (Array.isArray(object.material) ? object.material : [object.material]) as MeshStandardMaterial[];
      for (const material of materials) {
        if (material.name.startsWith("HairShell")) {
          material.transparent = false;
          material.depthWrite = true;
          material.side = FrontSide;
        }
      }
    });
    const head = copy.getObjectByName("head");
    if (head) head.add(cloneBare(glasses));
    return copy;
  }, [scene, glasses]);

  return (
    <primitive
      object={driver}
      position={[DRIVER_SEAT.x, DRIVER_SEAT.y, DRIVER_SEAT.z]}
      rotation-y={Math.PI}
      scale={DRIVER_SCALE}
    />
  );
}
