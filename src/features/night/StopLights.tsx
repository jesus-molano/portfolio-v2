"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { PointLight } from "three";
import { palette } from "@/design/tokens";
import { night } from "./nightState";
import type { NightSet } from "./sets/types";

/**
 * The lights every stop shares: a weak cool moon, a violet hemisphere and
 * two point lights that take the stop's own neon or sodium. Their count
 * never changes, so no lit material recompiles at a cut.
 */
export function StopLights({ sets }: { sets: readonly NightSet[] }) {
  const a = useRef<PointLight>(null);
  const b = useRef<PointLight>(null);
  const lastStop = useRef(-1);

  useFrame(() => {
    if (night.stop === lastStop.current) return;
    lastStop.current = night.stop;
    const set = sets[night.stop];
    if (!set) return;
    [a.current, b.current].forEach((light, i) => {
      if (!light) return;
      const spec = set.lights[i];
      light.position.set(...spec.position);
      light.color.set(spec.color);
      light.intensity = spec.intensity;
      light.distance = spec.distance;
    });
  });

  return (
    <>
      <hemisphereLight args={[palette.violet, palette.ink, 0.35]} />
      <directionalLight position={[-30, 40, 20]} intensity={0.3} color={palette.moon} />
      <pointLight ref={a} decay={1.4} />
      <pointLight ref={b} decay={1.4} />
    </>
  );
}
