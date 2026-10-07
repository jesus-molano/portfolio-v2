"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { type Bone, FrontSide, Group, Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { DRIVER_URL } from "@/features/hero/scene/Driver";
import { captureBindPose, DRIVER_SCALE, DRIVER_SEAT, poseDriver, type RestBone } from "@/features/hero/scene/driverPose";
import { SUNGLASSES_URL } from "@/features/hero/scene/Sunglasses";
import { adopt, cloneOwned } from "./cloneBare";

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
    // Pose a copy of our own, seated in a car frame of our own: the pose's
    // targets are in the car's space (poseDriver reads the character's
    // parent), and the shared scene's parent is the hero's car only while
    // the hero is mounted; posed in whatever frame it happened to have, his
    // hands missed the wheel and the door. Posed here he sits as in the hero.
    // Its own geometries, materials and textures (cloneOwned), released with the night.
    const owned = cloneOwned<Object3D>(scene, (source) => cloneSkinned(source));
    const copy = owned.object;
    const copyBones = new Map<string, Bone>();
    copy.traverse((object) => {
      if ((object as Bone).isBone) copyBones.set(object.name, object as Bone);
    });
    const seat = new Group();
    copy.position.set(DRIVER_SEAT.x, DRIVER_SEAT.y, DRIVER_SEAT.z);
    copy.rotation.set(0, Math.PI, 0);
    copy.scale.setScalar(DRIVER_SCALE);
    seat.add(copy);
    poseDriver(copy, copyBones, rest);
    seat.remove(copy);
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
    if (!head) return owned;
    const shades = cloneOwned(glasses);
    head.add(shades.object);
    return adopt(owned, shades);
  }, [scene, glasses]);
  useEffect(() => () => driver.dispose(), [driver]);

  return (
    <primitive
      object={driver.object}
      position={[DRIVER_SEAT.x, DRIVER_SEAT.y, DRIVER_SEAT.z]}
      rotation-y={Math.PI}
      scale={DRIVER_SCALE}
    />
  );
}
