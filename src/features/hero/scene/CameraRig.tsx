"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { heroProgress } from "../scroll/heroProgress";
import { evaluateCamera, type CameraPose } from "./shots";

type Props = {
  /** Pointer parallax, desktop only. */
  parallax: boolean;
  /** Snap to the target instead of damping, no idle motion. */
  reducedMotion: boolean;
};

/**
 * Places the camera on the current shot. Inside a shot the pose is damped;
 * on a cut the camera snaps, so the edit reads as a hard cut.
 */
export function CameraRig({ parallax, reducedMotion }: Props) {
  const pose = useRef<CameraPose>({
    position: new Vector3(),
    look: new Vector3(),
    fov: 50,
    shot: -1,
  });
  const look = useRef(new Vector3());
  const lastShot = useRef(-1);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    const target = evaluateCamera(heroProgress.value, pose.current);
    const t = state.clock.elapsedTime;
    const cut = target.shot !== lastShot.current;
    lastShot.current = target.shot;

    if (!reducedMotion) {
      // Suspension: a faint bob and sway, stronger close to the asphalt.
      const closeness = target.shot === 2 ? 1.6 : 1;
      target.position.y += (Math.sin(t * 2.1) * 0.025 + Math.sin(t * 5.3) * 0.012) * closeness;
      target.position.x += Math.sin(t * 0.9) * 0.04;
    }
    if (parallax) {
      target.position.x += state.pointer.x * 0.5;
      target.position.y += state.pointer.y * 0.25;
    }

    const k = reducedMotion || cut ? 1 : 1 - Math.exp(-delta * 4.5);
    camera.position.lerp(target.position, k);
    look.current.lerp(target.look, k);
    if (cut) look.current.copy(target.look);
    camera.lookAt(look.current);

    const fov = cut || reducedMotion ? target.fov : camera.fov + (target.fov - camera.fov) * k;
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
