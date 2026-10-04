"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  type Group,
  type InstancedMesh,
  PlaneGeometry,
} from "three";
import { palette } from "@/design/tokens";
import { softDiscFragmentShader, softDiscInstancedVertexShader } from "../shaders/softDisc";
import {
  drive,
  placeStreamed,
  STREAM,
  STREAM_LENGTH,
  streamFade,
  type StreamPlacement,
  wrapZ,
} from "./drive";
import { RAIL_X } from "./Road";
import { SHORELINE_X } from "./Shore";

type Props = { animate: boolean; tier: "high" | "low" };

const LAMP_SPACING = 44;
const LAMP_X = RAIL_X + 0.7;
const POLE_HEIGHT = 8.2;
const ARM_LENGTH = 2.8;

/** Pastel lifeguard towers, Miami Beach style. */
const TOWERS = [
  { x: -27, z0: -10, body: "#9fe3d2", trim: "#ff8fb8" },
  { x: 29, z0: -85, body: "#ffb3cf", trim: "#7fd8e8" },
  { x: -25, z0: -140, body: "#ffd99a", trim: "#b08cff" },
  { x: 27, z0: 40, body: "#c7b3ff", trim: palette.sodium },
] as const;

/**
 * The deck starts 8 m inland of the mean shoreline (it wanders about 1.3 m),
 * and a ramp brings it down to the sand, so the pier always starts on the
 * beach instead of floating above it.
 */
const PIER = {
  x0: SHORELINE_X - 8,
  length: 60,
  width: 3.6,
  deckY: 1.05,
  z0: -60,
  rampRun: 6,
} as const;
/** Top of the beach plane (Shore.tsx) under the pier. */
const SAND_Y = 0.07;

function baseAt0(geometry: BoxGeometry | CylinderGeometry, height: number) {
  geometry.translate(0, height / 2, 0);
  return geometry;
}

/**
 * Everything on the roadside that gives the drive its rhythm: street lights
 * with warm pools of light, lifeguard towers on the sand and a wooden pier.
 * All of it streams with the car and grows in from the haze.
 */
export function Props({ animate, tier }: Props) {
  return (
    <group>
      <StreetLights animate={animate} />
      <LifeguardTowers animate={animate} />
      {tier === "high" && <Pier animate={animate} />}
    </group>
  );
}

function StreetLights({ animate }: { animate: boolean }) {
  const poles = useRef<InstancedMesh>(null);
  const arms = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);

  const placements = useMemo(() => {
    const list: Array<StreamPlacement & { side: number }> = [];
    for (let z = STREAM.zFront, i = 0; z < STREAM.zFront + STREAM_LENGTH; z += LAMP_SPACING / 2, i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      // Arm points to the road: rotate the right-hand poles by 180 degrees.
      list.push({ x: side * LAMP_X, z0: z, rotY: side > 0 ? Math.PI : 0, side });
    }
    return list;
  }, []);
  const poolPlacements = useMemo(
    () =>
      placements.map((p) => ({ x: p.x - p.side * (ARM_LENGTH - 0.3), y: 0.115, z0: p.z0 })),
    [placements],
  );

  const geometries = useMemo(() => {
    const pole = baseAt0(new CylinderGeometry(0.07, 0.11, POLE_HEIGHT, 8), POLE_HEIGHT);
    const arm = new BoxGeometry(ARM_LENGTH, 0.08, 0.08);
    arm.translate(ARM_LENGTH / 2, POLE_HEIGHT - 0.1, 0);
    const head = new BoxGeometry(0.75, 0.16, 0.34);
    head.translate(ARM_LENGTH - 0.25, POLE_HEIGHT - 0.22, 0);
    const pool = new PlaneGeometry(9, 12);
    pool.rotateX(-Math.PI / 2);
    return { pole, arm, head, pool };
  }, []);
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries]);

  const poolUniforms = useMemo(
    () => ({ uColor: { value: new Color("#ffc58f") }, uOpacity: { value: 0.16 } }),
    [],
  );

  const update = (distance: number) => {
    if (poles.current) placeStreamed(poles.current, placements, distance);
    if (arms.current) placeStreamed(arms.current, placements, distance);
    if (heads.current) placeStreamed(heads.current, placements, distance);
    if (pools.current) placeStreamed(pools.current, poolPlacements, distance);
  };

  useLayoutEffect(() => update(drive.distance));
  useFrame(() => {
    if (animate) update(drive.distance);
  });

  return (
    <group>
      <instancedMesh ref={poles} args={[geometries.pole, undefined, placements.length]} frustumCulled={false}>
        <meshStandardMaterial color="#3b2a5a" roughness={0.5} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[geometries.arm, undefined, placements.length]} frustumCulled={false}>
        <meshStandardMaterial color="#3b2a5a" roughness={0.5} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[geometries.head, undefined, placements.length]} frustumCulled={false}>
        <meshBasicMaterial color={[2.2, 1.7, 1.15]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={pools}
        args={[geometries.pool, undefined, poolPlacements.length]}
        frustumCulled={false}
        renderOrder={3}
      >
        <shaderMaterial
          uniforms={poolUniforms}
          vertexShader={softDiscInstancedVertexShader}
          fragmentShader={softDiscFragmentShader}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}

function LifeguardTowers({ animate }: { animate: boolean }) {
  const refs = useRef<Array<Group | null>>([]);

  const update = (distance: number) => {
    TOWERS.forEach((tower, i) => {
      const group = refs.current[i];
      if (!group) return;
      const z = wrapZ(tower.z0 + distance);
      group.position.set(tower.x, 0.05, z);
      group.scale.setScalar(Math.max(0.001, streamFade(z)));
    });
  };

  useLayoutEffect(() => update(drive.distance));
  useFrame(() => {
    if (animate) update(drive.distance);
  });

  return (
    <group>
      {TOWERS.map((tower, i) => (
        <group
          key={tower.z0}
          ref={(el) => {
            refs.current[i] = el;
          }}
          // The window faces the sea; the ramp comes down on the road side.
          rotation-y={tower.x > 0 ? Math.PI / 2 : -Math.PI / 2}
        >
          <LifeguardTower body={tower.body} trim={tower.trim} />
        </group>
      ))}
    </group>
  );
}

/** Stilts, deck, cabin with a slanted roof, a ramp and a flag. Faces local +z. */
function LifeguardTower({ body, trim }: { body: string; trim: string }) {
  const stilts: Array<[number, number]> = [
    [-1.0, -0.8],
    [1.0, -0.8],
    [-1.0, 0.8],
    [1.0, 0.8],
  ];
  return (
    <group>
      {stilts.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 1.1, z]}>
          <boxGeometry args={[0.16, 2.2, 0.16]} />
          <meshStandardMaterial color="#e9dcf2" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 2.25, 0.3]}>
        <boxGeometry args={[2.8, 0.14, 2.6]} />
        <meshStandardMaterial color="#efe3f7" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.1, -0.1]}>
        <boxGeometry args={[2.2, 1.6, 1.7]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.2, 0.76]}>
        <boxGeometry args={[1.5, 0.6, 0.04]} />
        <meshStandardMaterial color={palette.asphalt} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 2.55, 0.76]}>
        <boxGeometry args={[2.22, 0.16, 0.06]} />
        <meshStandardMaterial color={trim} roughness={0.6} />
      </mesh>
      <mesh position={[0, 4.02, -0.05]} rotation-x={-0.12}>
        <boxGeometry args={[2.7, 0.12, 2.3]} />
        <meshStandardMaterial color={trim} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.15, -2.3]} rotation-x={-0.62}>
        <boxGeometry args={[0.9, 0.08, 3.2]} />
        <meshStandardMaterial color="#e9dcf2" roughness={0.8} />
      </mesh>
      <mesh position={[1.25, 4.9, -0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 6]} />
        <meshStandardMaterial color="#e9dcf2" />
      </mesh>
      <mesh position={[1.55, 5.5, -0.6]}>
        <boxGeometry args={[0.6, 0.36, 0.02]} />
        <meshStandardMaterial color="#ff5a6e" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Pier({ animate }: { animate: boolean }) {
  const group = useRef<Group>(null);
  const posts = useMemo(() => {
    const list: Array<[number, number]> = [];
    // First pair right at the top of the ramp, so the deck never starts unsupported.
    for (let x = 0.4; x < PIER.length; x += 5) {
      list.push([x, -PIER.width / 2 + 0.25]);
      list.push([x, PIER.width / 2 - 0.25]);
    }
    return list;
  }, []);

  const update = (distance: number) => {
    if (!group.current) return;
    const z = wrapZ(PIER.z0 + distance);
    group.current.position.set(PIER.x0, 0, z);
    group.current.scale.setScalar(Math.max(0.001, streamFade(z)));
  };

  useLayoutEffect(() => update(drive.distance));
  useFrame(() => {
    if (animate) update(drive.distance);
  });

  // Ramp from the sand (x = -rampRun) up to the deck (x = 0).
  const rise = PIER.deckY - SAND_Y;
  const rampLength = Math.hypot(PIER.rampRun, rise);
  const rampSlope = Math.atan2(rise, PIER.rampRun);

  return (
    <group ref={group}>
      <mesh position={[PIER.length / 2, PIER.deckY, 0]}>
        <boxGeometry args={[PIER.length, 0.2, PIER.width]} />
        <meshStandardMaterial color="#7a5a8c" roughness={0.9} />
      </mesh>
      <mesh position={[-PIER.rampRun / 2, SAND_Y + rise / 2, 0]} rotation-z={rampSlope}>
        <boxGeometry args={[rampLength, 0.2, PIER.width]} />
        <meshStandardMaterial color="#7a5a8c" roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`ramp-rail${side}`}
          position={[-PIER.rampRun / 2, SAND_Y + rise / 2 + 0.55, (side * PIER.width) / 2]}
          rotation-z={rampSlope}
        >
          <boxGeometry args={[rampLength, 0.06, 0.06]} />
          <meshStandardMaterial color={palette.ink} />
        </mesh>
      ))}
      {/* Landing slab at the foot of the ramp, half buried in the sand. */}
      <mesh position={[-PIER.rampRun - 0.9, SAND_Y, 0]}>
        <boxGeometry args={[1.8, 0.16, PIER.width + 0.8]} />
        <meshStandardMaterial color="#c9a9b8" roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[PIER.length / 2, PIER.deckY + 0.55, (side * PIER.width) / 2]}>
          <boxGeometry args={[PIER.length, 0.06, 0.06]} />
          <meshStandardMaterial color={palette.ink} />
        </mesh>
      ))}
      {posts.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, (PIER.deckY + 0.6) / 2 - 0.3, z]}>
          <cylinderGeometry args={[0.14, 0.17, PIER.deckY + 0.6, 6]} />
          <meshStandardMaterial color="#4a3266" roughness={0.9} />
        </mesh>
      ))}
      {/* Bait shop at the end, warm window. */}
      <group position={[PIER.length - 3, PIER.deckY + 0.1, 0]}>
        <mesh position-y={1.35}>
          <boxGeometry args={[4.2, 2.7, 3.2]} />
          <meshStandardMaterial color="#ffd0dc" roughness={0.8} />
        </mesh>
        <mesh position-y={3.05} rotation-y={Math.PI / 4}>
          <coneGeometry args={[3.3, 1.3, 4]} />
          <meshStandardMaterial color="#6e4f9a" roughness={0.8} />
        </mesh>
        <mesh position={[-2.12, 1.45, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[1.4, 0.9]} />
          <meshBasicMaterial color={[1.7, 1.35, 0.9]} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
