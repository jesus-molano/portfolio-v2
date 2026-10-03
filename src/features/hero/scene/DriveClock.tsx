"use client";

import { useFrame } from "@react-three/fiber";
import { drive } from "./drive";

type Props = { animate: boolean };

/** Advances the shared drive distance before every other frame callback. */
export function DriveClock({ animate }: Props) {
  useFrame((_, delta) => {
    if (!animate) return;
    drive.distance += Math.min(delta, 0.1) * drive.speed;
  }, -10);
  return null;
}
