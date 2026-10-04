"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { type Bone, Euler, FrontSide, Mesh, type MeshStandardMaterial, Quaternion } from "three";
import { BONES, captureBindPose, DRIVER_SCALE, DRIVER_SEAT, poseDriver, type RestBone } from "./driverPose";

type Props = { animate: boolean };

/**
 * Jesús, built with MakeHuman / MPFB from CC0 assets by
 * tools/blender/build_driver_mpfb.py: his face shape, skin fade and beard,
 * the striped tee and the black earring.
 */
export const DRIVER_URL = "/models/makehuman-driver/driver.glb";

useGLTF.preload(DRIVER_URL);

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
      // The skinned bounds are the bind pose's; the posed arms leave them.
      object.frustumCulled = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials as MeshStandardMaterial[]) {
        // Hair and beard shells are alpha-tested layers: keep them out of the
        // transparent sort and writing depth, so the layers stack cleanly.
        if (material.name.startsWith("HairShell")) {
          material.transparent = false;
          material.depthWrite = true;
          material.side = FrontSide;
        }
        // Brows and lashes blend over the skin without hiding each other.
        if (material.name === "Brows" || material.name === "Lashes") material.depthWrite = false;
      }
    });
    poseDriver(scene, bones, rest);
  }, [scene, bones, rest]);

  // poseDriver leaves the head at its bind pose; the glance starts from it.
  const headRest = useMemo(
    () => rest.get(BONES.head)?.quaternion.clone() ?? new Quaternion(),
    [rest],
  );

  useFrame((state) => {
    const head = bones.get(BONES.head);
    if (!head) return;
    if (!animate) {
      // Reduced motion can switch on mid-glance: look ahead again.
      head.quaternion.copy(headRest);
      return;
    }
    const t = state.clock.elapsedTime;
    // Checks the mirror now and then; otherwise eyes on the road. The head
    // bone's +Y runs up the neck, so turning about it turns the head.
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
