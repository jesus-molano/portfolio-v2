"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { type Group } from "three";
import { palette } from "@/design/tokens";
import { CAR, createCarBodyGeometry } from "./carGeometry";
import { CAR_POSITION, drive } from "./drive";
import { Driver } from "./Driver";

type Props = { animate: boolean };

const BODY_COLOR = "#4a2a86";
const TRIM_COLOR = "#1a0f33";
const WHEEL_COLOR = "#120a22";
const HUB_COLOR = "#8d6fb8";

/**
 * The hero car: a stylised wedge convertible, headlights on, cruising in the
 * right lane. It never moves; the world streams past. Wheels spin with the
 * drive distance and the body breathes with the suspension.
 */
export function Car({ animate }: Props) {
  const body = useRef<Group>(null);
  const wheels = useRef<Group[]>([]);
  const geometry = useMemo(() => createCarBodyGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    const spin = drive.distance / CAR.wheelRadius;
    for (const wheel of wheels.current) wheel.rotation.x = -spin;
    if (body.current) {
      body.current.position.y = Math.sin(t * 2.3) * 0.012 + Math.sin(t * 6.1) * 0.006;
      body.current.rotation.z = Math.sin(t * 0.8) * 0.006;
      body.current.rotation.x = Math.sin(t * 1.7) * 0.004;
    }
  });

  return (
    <group position={[CAR_POSITION.x, CAR_POSITION.y, CAR_POSITION.z]}>
      <group ref={body}>
        <mesh geometry={geometry} castShadow={false}>
          <meshStandardMaterial color={BODY_COLOR} roughness={0.42} metalness={0.3} />
        </mesh>

        {/* Cockpit well and seats. */}
        <mesh position={[0, 0.84, 0.12]}>
          <boxGeometry args={[1.45, 0.2, 0.9]} />
          <meshStandardMaterial color={TRIM_COLOR} roughness={0.9} />
        </mesh>
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} position={[x, 1.02, 0.42]}>
            <boxGeometry args={[0.46, 0.34, 0.16]} />
            <meshStandardMaterial color="#2a1848" roughness={0.9} />
          </mesh>
        ))}

        {/* Windshield. */}
        <mesh position={[0, 1.14, -0.5]} rotation-x={-0.55}>
          <planeGeometry args={[1.56, 0.5]} />
          <meshStandardMaterial
            color="#cdb6ff"
            transparent
            opacity={0.42}
            roughness={0.1}
            metalness={0.4}
            side={2}
          />
        </mesh>

        {/* Tail light bar and head lights. */}
        <mesh position={[0, 0.82, 2.33]}>
          <boxGeometry args={[1.62, 0.1, 0.05]} />
          <meshBasicMaterial color={[2.2, 0.25, 0.35]} toneMapped={false} />
        </mesh>
        {[-0.62, 0.62].map((x) => (
          <mesh key={x} position={[x, 0.52, -2.33]}>
            <boxGeometry args={[0.36, 0.12, 0.05]} />
            <meshBasicMaterial color={[2.0, 1.9, 1.6]} toneMapped={false} />
          </mesh>
        ))}

        <Driver animate={animate} />

        {/* Side mirrors. */}
        {[-1.0, 1.0].map((x) => (
          <mesh key={x} position={[x, 1.0, -0.3]}>
            <boxGeometry args={[0.18, 0.1, 0.14]} />
            <meshStandardMaterial color={BODY_COLOR} roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Wheels: tyre, rim and five spokes so the spin is visible. */}
      {CAR.wheels.map(([x, z], i) => (
        <group
          key={`${x}-${z}`}
          position={[x, CAR.wheelRadius, z]}
          ref={(el) => {
            if (el) wheels.current[i] = el;
          }}
        >
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[CAR.wheelRadius, CAR.wheelRadius, CAR.wheelWidth, 20]} />
            <meshStandardMaterial color={WHEEL_COLOR} roughness={0.95} />
          </mesh>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.07, 0.07, CAR.wheelWidth + 0.04, 10]} />
            <meshStandardMaterial color={HUB_COLOR} roughness={0.5} metalness={0.6} />
          </mesh>
          {Array.from({ length: 5 }, (_, s) => (
            <mesh key={s} rotation-x={(s / 5) * Math.PI * 2}>
              <boxGeometry args={[CAR.wheelWidth + 0.03, 0.46, 0.05]} />
              <meshStandardMaterial color={HUB_COLOR} roughness={0.5} metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Contact shadow. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.12}>
        <planeGeometry args={[3.2, 5.6]} />
        <meshBasicMaterial color={palette.night} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}
