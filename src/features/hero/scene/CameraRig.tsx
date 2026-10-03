"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { heroProgress } from "../scroll/heroProgress";
import { easeInOutCubic, world } from "./world";

type Props = {
  /** Pointer parallax, desktop only. */
  parallax: boolean;
  /** Snap to the target instead of damping, no idle motion. */
  reducedMotion: boolean;
};

/**
 * Drives the camera down the causeway as the hero scrolls, with a faint
 * suspension bob. Reads the shared scroll progress; never touches React state.
 */
export function CameraRig({ parallax, reducedMotion }: Props) {
  const target = useRef(new Vector3());
  const look = useRef(new Vector3());

  useFrame((state, delta) => {
    const p = easeInOutCubic(heroProgress.value);
    const { start, end, lookStart, lookEnd } = world.camera;
    const t = state.clock.elapsedTime;

    target.current.lerpVectors(start, end, p);
    look.current.lerpVectors(lookStart, lookEnd, p);

    if (!reducedMotion) {
      target.current.y += Math.sin(t * 1.3) * 0.05 + Math.sin(t * 2.9) * 0.02;
      target.current.x += Math.sin(t * 0.7) * 0.08;
    }
    if (parallax) {
      target.current.x += state.pointer.x * 2.0;
      target.current.y += state.pointer.y * 0.8;
    }

    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.5);
    state.camera.position.lerp(target.current, k);
    state.camera.lookAt(look.current);
  });

  return null;
}
