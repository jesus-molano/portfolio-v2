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
import { drive, placeStreamed, ROADSIDE, streamFade, type StreamPlacement, wrapZ } from "./drive";
import {
  gapZ,
  LAMP,
  lampPlacements,
  PIER,
  pierPlacement,
  RISE,
  TOWER_REACH,
  TOWER_X,
  TOWERS,
} from "./roadside";

type Props = { animate: boolean; tier: "high" | "low" };

/** Top of the beach plane (Shore.tsx). */
const SAND_Y = 0.07;

const { x: LAMP_X, poleHeight: POLE_HEIGHT, arm: ARM_LENGTH } = LAMP;

/** The warm pool of light under a lamp's head, on the outer lane. */
function poolUnder(lamp: StreamPlacement): StreamPlacement {
  return { x: lamp.x - Math.sign(lamp.x) * (ARM_LENGTH - 0.3), y: 0.115, z0: lamp.z0 };
}

function baseAt0(geometry: BoxGeometry | CylinderGeometry, height: number) {
  geometry.translate(0, height / 2, 0);
  return geometry;
}

/**
 * Everything on the roadside that gives the drive its rhythm: street lights
 * with warm pools of light, lifeguard towers on the sand and a wooden pier
 * (layout in roadside.ts). All of it streams with the car in the ROADSIDE
 * window. The lamps come in at the landfall on top of a static twin, so
 * none grows; the towers and the pier rise out of the sand and the sea
 * over the first RISE metres, like a ship over the horizon.
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

  const placements = useMemo(
    () =>
      lampPlacements().map((lamp) => ({
        ...lamp,
        // Arm points to the road: rotate the right-hand poles by 180 degrees.
        rotY: lamp.side > 0 ? Math.PI : 0,
      })),
    [],
  );
  // One static twin per side where the lamps come in.
  const twins = useMemo<StreamPlacement[]>(
    () => [-1, 1].map((side) => ({ x: side * LAMP_X, z0: ROADSIDE.zFront, rotY: side > 0 ? Math.PI : 0 })),
    [],
  );
  const poolPlacements = useMemo(() => placements.map(poolUnder), [placements]);
  const poolTwins = useMemo(() => twins.map(poolUnder), [twins]);

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
    const lamps = { window: ROADSIDE, grow: false, fixed: twins };
    if (poles.current) placeStreamed(poles.current, placements, distance, lamps);
    if (arms.current) placeStreamed(arms.current, placements, distance, lamps);
    if (heads.current) placeStreamed(heads.current, placements, distance, lamps);
    if (pools.current) {
      placeStreamed(pools.current, poolPlacements, distance, { window: ROADSIDE, grow: false, fixed: poolTwins });
    }
  };
  const count = placements.length + twins.length;

  useLayoutEffect(() => update(drive.distance));
  useFrame(() => {
    if (animate) update(drive.distance);
  });

  return (
    <group>
      <instancedMesh ref={poles} args={[geometries.pole, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color="#3b2a5a" roughness={0.5} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[geometries.arm, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color="#3b2a5a" roughness={0.5} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[geometries.head, undefined, count]} frustumCulled={false}>
        <meshBasicMaterial color={[2.2, 1.7, 1.15]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={pools}
        args={[geometries.pool, undefined, count]}
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

/** How far a prop at z has risen out of the ground: 0 at the far edge of the window. */
function risen(z: number): number {
  return streamFade(z, ROADSIDE, RISE);
}

function LifeguardTowers({ animate }: { animate: boolean }) {
  const refs = useRef<Array<Group | null>>([]);
  const towers = useMemo(() => TOWERS.map((tower) => ({ ...tower, z0: gapZ(tower.gap, tower.side) })), []);

  const update = (distance: number) => {
    towers.forEach((tower, i) => {
      const group = refs.current[i];
      if (!group) return;
      const z = wrapZ(tower.z0 + distance, ROADSIDE);
      // Sunk under the sand (which hides it) until it rises at the far end.
      group.position.set(tower.side * TOWER_X, 0.05 - TOWER_REACH.height * (1 - risen(z)), z);
    });
  };

  useLayoutEffect(() => update(drive.distance));
  useFrame(() => {
    if (animate) update(drive.distance);
  });

  return (
    <group>
      {towers.map((tower, i) => (
        <group
          key={tower.gap}
          ref={(el) => {
            refs.current[i] = el;
          }}
          // The window faces the sea; the ramp comes down on the road side.
          rotation-y={tower.side > 0 ? Math.PI / 2 : -Math.PI / 2}
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

/** The pier sinks this far under the sea and the sand before it rises. */
const PIER_SINK = 5.5;

function Pier({ animate }: { animate: boolean }) {
  const group = useRef<Group>(null);
  const placement = useMemo(() => pierPlacement(), []);
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
    const z = wrapZ(placement.z0 + distance, ROADSIDE);
    group.current.position.set(placement.x0, -PIER_SINK * (1 - risen(z)), z);
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
      <mesh position={[-PIER.rampRun - PIER.slab / 2, SAND_Y, 0]}>
        <boxGeometry args={[PIER.slab, 0.16, PIER.width + 0.8]} />
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
