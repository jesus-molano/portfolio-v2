"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, Quaternion, Vector3 } from "three";

type Props = { animate: boolean };

const SKIN = "#d9a27a";
const HAIR = "#3a2416";
const BEARD = "#2e1c14";
const LEATHER = "#17111f";
const LEATHER_EDGE = "#2a2033";
const TEE = "#efe6ff";
const TRIM = "#1a0f33";
const LENS = "#0d0a18";
const FRAME = "#c9a85a";

/** Driver seat, left-hand drive, relative to the car origin. */
const SEAT_X = -0.42;
const SEAT_Z = 0.32;

const UP = new Vector3(0, 1, 0);

type LimbProps = {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  color: string;
  roughness?: number;
  metalness?: number;
};

/** A cylinder stretched between two points. */
function Limb({ from, to, radius, color, roughness = 0.5, metalness = 0.2 }: LimbProps) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(UP, dir.normalize()),
      length: len,
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius * 0.9, radius, length, 10]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

/**
 * The guy at the wheel: buzz cut, short beard, gold-framed shades, leather
 * jacket over a light tee. Right hand on the wheel, left arm resting on the
 * door. Stylised like key art: few colours, clean volumes.
 */
export function Driver({ animate }: Props) {
  const head = useRef<Group>(null);

  useFrame((state) => {
    if (!animate || !head.current) return;
    const t = state.clock.elapsedTime;
    // Checks the mirror now and then; otherwise eyes on the road.
    const glance = Math.max(0, Math.sin(t * 0.35)) ** 8;
    head.current.rotation.y = -glance * 0.45 + Math.sin(t * 1.9) * 0.02;
    head.current.rotation.z = Math.sin(t * 2.3) * 0.015;
  });

  return (
    <group position={[SEAT_X, 0, SEAT_Z]}>
      {/* Leather jacket: torso, shoulders, collar, lapels over a tee. */}
      <mesh position={[0, 1.07, 0]}>
        <boxGeometry args={[0.5, 0.42, 0.26]} />
        <meshStandardMaterial color={LEATHER} roughness={0.38} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.27, 0]}>
        <boxGeometry args={[0.64, 0.11, 0.27]} />
        <meshStandardMaterial color={LEATHER} roughness={0.38} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.31, 0.06]}>
        <boxGeometry args={[0.3, 0.07, 0.12]} />
        <meshStandardMaterial color={LEATHER_EDGE} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.12, -0.135]}>
        <boxGeometry args={[0.13, 0.3, 0.01]} />
        <meshStandardMaterial color={TEE} roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.1, 1.15, -0.14]} rotation-z={side * 0.32}>
          <boxGeometry args={[0.075, 0.3, 0.02]} />
          <meshStandardMaterial color={LEATHER_EDGE} roughness={0.35} metalness={0.35} />
        </mesh>
      ))}

      {/* Neck. */}
      <mesh position={[0, 1.34, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>

      {/* Head group: skull, buzz cut, beard, shades, ears. */}
      <group ref={head} position={[0, 1.5, 0]}>
        <mesh scale={[1, 1.1, 1.02]}>
          <sphereGeometry args={[0.125, 24, 18]} />
          <meshStandardMaterial color={SKIN} roughness={0.75} />
        </mesh>
        {/* Short hair: a cap over the top and the back of the skull, tilted
            back so the forehead and temples stay clear. */}
        <mesh rotation-x={0.3} scale={[1.03, 1.12, 1.04]}>
          <sphereGeometry args={[0.125, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        {/* Short beard: a narrow band along the jaw and chin, front half only. */}
        <mesh scale={[1.01, 1.1, 1.03]}>
          <sphereGeometry
            args={[0.125, 24, 10, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.7, Math.PI * 0.2]}
          />
          <meshStandardMaterial color={BEARD} roughness={0.95} />
        </mesh>
        {/* Shades: two lenses, bridge and temples. */}
        {[-0.058, 0.058].map((x) => (
          <mesh key={x} position={[x, 0.03, -0.118]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.046, 0.046, 0.014, 16]} />
            <meshStandardMaterial color={LENS} roughness={0.15} metalness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.035, -0.122]}>
          <boxGeometry args={[0.03, 0.008, 0.008]} />
          <meshStandardMaterial color={FRAME} roughness={0.3} metalness={0.9} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.115, 0.035, -0.05]} rotation-y={side * 0.08}>
            <boxGeometry args={[0.006, 0.006, 0.14]} />
            <meshStandardMaterial color={FRAME} roughness={0.3} metalness={0.9} />
          </mesh>
        ))}
        {/* Ears. */}
        {[-0.126, 0.126].map((x) => (
          <mesh key={x} position={[x, -0.005, 0.01]} scale={[0.6, 1, 0.8]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial color={SKIN} roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Left arm: out of the cockpit, forearm resting along the door top. */}
      <Limb from={[-0.3, 1.24, 0.02]} to={[-0.56, 0.99, -0.03]} radius={0.06} color={LEATHER} roughness={0.4} metalness={0.3} />
      <Limb from={[-0.56, 0.99, -0.03]} to={[-0.56, 0.99, -0.44]} radius={0.055} color={LEATHER} roughness={0.4} metalness={0.3} />
      <mesh position={[-0.56, 1.0, -0.48]} scale={[0.9, 0.7, 1.2]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>

      {/* Right arm: to the top of the wheel. */}
      <Limb from={[0.28, 1.24, 0.02]} to={[0.04, 1.14, -0.4]} radius={0.06} color={LEATHER} roughness={0.4} metalness={0.3} />
      <mesh position={[0.02, 1.15, -0.43]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>

      {/* Steering wheel and column. */}
      <mesh position={[0, 1.0, -0.46]} rotation-x={-1.15}>
        <torusGeometry args={[0.17, 0.022, 8, 24]} />
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.96, -0.52]} rotation-x={-1.15}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
        <meshStandardMaterial color={TRIM} roughness={0.6} />
      </mesh>
    </group>
  );
}
