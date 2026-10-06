"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, type Object3D } from "three";
import { CAR_URL, prepareCar } from "@/features/hero/scene/Car";
import { CAR_MODEL, WHEEL_RADIUS } from "@/features/hero/scene/carModel";
import type { QualityTier } from "@/features/hero/useQualityTier";
import type { StageTimeline } from "@/features/work/workTimeline";
import { braking, carBeat, carX } from "./carPath";
import { cloneBare } from "./cloneBare";
import { night } from "./nightState";
import { NightDriver } from "./NightDriver";
import { type Glow, type GlowHandle, Glows } from "./parts/Glows";

const WHEEL_NAMES = ["wheel_front_l", "wheel_front_r", "wheel_rear_l", "wheel_rear_r"];

/**
 * Lamps in the car's own frame at night (x forward, y up, z to its right):
 * the headlights' warm glow, and the tail and brake lights in a pink-red,
 * never the LIVE red (palette.onAir is the tally's alone).
 */
const LAMPS: Glow[] = [
  { position: [2.12, 0.62, -0.62], size: 0.9, color: "#ffd9a8", intensity: 2.6 },
  { position: [2.12, 0.62, 0.62], size: 0.9, color: "#ffd9a8", intensity: 2.6 },
  { position: [-2.18, 0.72, -0.6], size: 0.7, color: "#ff3d6e", intensity: 2.2 },
  { position: [-2.18, 0.72, 0.6], size: 0.7, color: "#ff3d6e", intensity: 2.2 },
];
const TAILS = [2, 3];

/**
 * The hero's convertible at night: it moves only in the arrival and leave
 * beats, with the scroll (carPath.ts), wheels turning with the distance;
 * brake lights on at every stop line. Faces +x, the street's direction.
 */
export function CarNight({ timeline, tier }: { timeline: StageTimeline; tier: QualityTier }) {
  const { scene } = useGLTF(CAR_URL);
  const group = useRef<Group>(null);
  const glows = useRef<GlowHandle | null>(null);
  const model = useMemo(() => {
    prepareCar(scene);
    return cloneBare(scene);
  }, [scene]);
  const wheels = useMemo(
    () => WHEEL_NAMES.map((name) => model.getObjectByName(name)).filter((o): o is Object3D => Boolean(o)),
    [model],
  );
  const lastX = useRef(0);
  const spin = useRef(0);

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame(({ camera }) => {
    const beat = carBeat(timeline, night.p);
    const x = carX(beat);
    // The cut to the next stop puts the car back at the line: the wheels do not spin back.
    const dx = Math.abs(x - lastX.current) < 6 ? x - lastX.current : 0;
    lastX.current = x;
    spin.current += dx / WHEEL_RADIUS;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    for (const wheel of wheels) wheel.rotation.x = spin.current;
    if (group.current) group.current.position.x = x;
    const brake = braking(beat) ? 1 : 0.35;
    // A lamp glows toward where it points: headlights only seen from ahead,
    // tail lights only from behind, so no glare shows through the body.
    const toCam = camera.position.x - x;
    const len = Math.max(1e-3, Math.hypot(toCam, camera.position.y - 0.7, camera.position.z));
    const ahead = Math.min(1, Math.max(0, toCam / len + 0.15) * 1.6);
    const behind = Math.min(1, Math.max(0, -toCam / len + 0.15) * 1.6);
    for (let i = 0; i < LAMPS.length; i += 1) {
      const tail = TAILS.includes(i);
      glows.current?.setLevel(i, tail ? brake * behind : ahead);
    }
  });

  return (
    <group ref={group}>
      {/* The hero's car group, turned so its nose points down the street (+x):
          the same car, with Jesús at the wheel exactly as in the hero, on the
          driver's side (the far side, -z). */}
      <group rotation-y={Math.PI / 2}>
        <primitive object={model} scale={CAR_MODEL.scale} rotation-y={Math.PI} />
        {tier === "high" ? <NightDriver /> : null}
      </group>
      <Glows glows={LAMPS} handle={glows} />
    </group>
  );
}
