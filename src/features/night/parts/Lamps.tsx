"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { palette } from "@/design/tokens";
import type { Vec3 } from "../frame";
import { type Glow, Glows } from "./Glows";

/**
 * Street lamps: a pole with a short arm over the road and a sodium head.
 * One instanced draw for the poles and arms, one for the glows.
 */
export function Lamps({ bases, height = 7.5, color = palette.sodiumNight, arm = -1.4 }: { bases: Vec3[]; height?: number; color?: string; arm?: number }) {
  const poles = useRef<InstancedMesh>(null);
  const glows = useMemo<Glow[]>(
    () =>
      bases.flatMap(([x, y, z]) => [
        { position: [x, y + height - 0.15, z + arm] as Vec3, size: 1.1, color, intensity: 2.6 },
        { position: [x, y + height - 0.6, z + arm] as Vec3, size: 4.5, color, intensity: 0.22 },
      ]),
    [bases, height, color, arm],
  );

  useLayoutEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    bases.forEach(([x, y, z], i) => {
      m.compose(p.set(x, y + height / 2, z), q, s.set(0.16, height, 0.16));
      poles.current?.setMatrixAt(i * 2, m);
      m.compose(p.set(x, y + height, z + arm / 2), q, s.set(0.12, 0.12, Math.abs(arm) + 0.2));
      poles.current?.setMatrixAt(i * 2 + 1, m);
    });
    if (poles.current) poles.current.instanceMatrix.needsUpdate = true;
  }, [bases, height, arm]);

  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, bases.length * 2]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette.asphalt} roughness={0.7} metalness={0.3} />
      </instancedMesh>
      <Glows glows={glows} />
    </group>
  );
}
