"use client";

import { useFrame } from "@react-three/fiber";
import { heroFeedback } from "../scroll/heroProgress";
import { clampPace } from "../scroll/throttle";
import { drive } from "./drive";
import { easeTimeScale, timeScale } from "./timeScale";

type Props = { animate: boolean };

/**
 * Advances the shared drive distance before every other frame callback.
 * Two time scales multiply the step, so traffic and the roadside stay
 * coherent; `drive.speed` itself never changes and the world never stops or
 * runs backwards:
 * - the visitor's pace (heroFeedback.pace, see scroll/throttle.ts): a crawl
 *   while the film waits for her (lower after a long wait), x1 to x2 as she
 *   pushes, and no more than 80 km/h while an unread line holds the film
 *   (the pit limiter);
 * - `timeScale`, eased here, so the radio wheel can slow the drive down
 *   without a jolt.
 */
export function DriveClock({ animate }: Props) {
  useFrame((_, delta) => {
    if (!animate) return;
    const dt = Math.min(delta, 0.1);
    timeScale.value = easeTimeScale(timeScale.value, timeScale.target, dt);
    const pace = clampPace(heroFeedback.pace);
    drive.distance += dt * drive.speed * pace * timeScale.value;
  }, -10);
  return null;
}
