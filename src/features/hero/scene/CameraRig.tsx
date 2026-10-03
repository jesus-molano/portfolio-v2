"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { heroProgress } from "../scroll/heroProgress";
import { easeInOutCubic, world } from "./world";

type Props = {
  /** Pointer parallax, desktop only. */
  parallax: boolean;
  /** Snap to the target instead of damping. */
  reducedMotion: boolean;
};

/**
 * Moves the camera forward along the avenue as the hero scrolls.
 * Reads the shared scroll progress; never touches React state.
 */
export function CameraRig({ parallax, reducedMotion }: Props) {
  const target = useRef(new Vector3());
  const look = useRef(new Vector3());

  useFrame((state, delta) => {
    const p = easeInOutCubic(heroProgress.value);
    const { start, end, lookStart, lookEnd } = world.camera;

    target.current.lerpVectors(start, end, p);
    look.current.lerpVectors(lookStart, lookEnd, p);

    if (parallax) {
      target.current.x += state.pointer.x * 2.2;
      target.current.y += state.pointer.y * 0.9;
    }

    // Frame-rate independent damping toward the target.
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.5);
    state.camera.position.lerp(target.current, k);
    state.camera.lookAt(look.current);
  });

  return null;
}
