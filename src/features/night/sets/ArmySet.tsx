"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  type CanvasTexture,
  Color,
  type Group,
  type Mesh,
  Quaternion,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { palette } from "@/design/tokens";
import { createRandom } from "@/features/hero/scene/world";
import { fonts, forTier, loadFaces, toTexture } from "../artCanvas";
import { type BoardFrame, boardCorners, boardNormal, toSet } from "../boardFrame";
import { createFloods } from "../floods";
import { LENS, type Vec3 } from "../frame";
import { night } from "../nightState";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { type Glow, type GlowHandle, Glows } from "../parts/Glows";
import { NightPalms } from "../parts/NightPalms";
import { beamFragmentShader, beamVertexShader } from "../shaders/beam";
import { boardFragmentShader, boardVertexShader, structureFragmentShader } from "../shaders/board";
import { beatP, keyAt } from "../timelineKeys";
import { ARMY_HOLE, ARMY_POSTER, paintArmyPoster, paintCrate } from "./art/army";
import { instancedBoardVertexShader } from "./instanced";
import type { NightSet, SetProps } from "./types";

/**
 * Stop 1, the army (Las Palmas de Gran Canaria, 2018-2021): a roadside
 * poster on a sandy lot at the edge of the city, the only printed board in
 * a city of neon, lit by four sodium floods on its catwalk. A 1940s
 * propaganda poster: two sappers push a bridge girder up into the torn
 * corner under a vermilion sky (art/army.ts). The painted girder breaks
 * out of the paper as a real launching nose; armed,
 * the floods come up one after another and the nose launches one more bay.
 * The striped barrier across the lane is the stop's signal.
 */

const FRAME: BoardFrame = { centre: [11, 7, -13], yaw: -Math.PI / 9, w: 16, h: 7 };
const OLIVE = "#5d6a33";
const KHAKI = "#a48d58";

/** Flood heads on the catwalk, and where each one aims, in board-local metres. */
const HEADS_LOCAL: Vec3[] = [-6, -2, 2, 6].map((x) => [x, -4.1, 1.5] as Vec3);
const AIMS_LOCAL: Vec3[] = [-6, -2, 2, 6].map((x) => [x * 0.95, -0.4, 0] as Vec3);
const HEADS = HEADS_LOCAL.map((p) => toSet(FRAME, p));
const AIMS = AIMS_LOCAL.map((p) => toSet(FRAME, p));

/** The launching nose: two side panels of 1.6 m bays, out of the torn corner, turned toward the road. */
const NOSE = { bay: 1.6, bays: 5, height: 1.4, width: 1.2, hidden: 1 } as const;
const HOLE_LOCAL: Vec3 = [
  (ARMY_HOLE.x / ARMY_POSTER.w - 0.5) * FRAME.w,
  (0.5 - ARMY_HOLE.y / ARMY_POSTER.h) * FRAME.h,
  -0.3,
];

/** Truss members along the nose axis (local frame of the nose: x along, y up, z across). */
function noseMembers(): BoxItem[] {
  const items: BoxItem[] = [];
  const { bay, bays, height, width } = NOSE;
  const t = 0.12;
  for (const side of [-width / 2, width / 2]) {
    for (let i = 0; i < bays; i += 1) {
      const x0 = i * bay;
      // Top and bottom chords, a vertical and a diagonal per bay.
      items.push({ p: [x0 + bay / 2, height / 2, side], s: [bay, t, t] });
      items.push({ p: [x0 + bay / 2, -height / 2, side], s: [bay, t, t] });
      items.push({ p: [x0, 0, side], s: [t, height, t] });
      const diag = Math.hypot(bay, height);
      const angle = Math.atan2(height, bay) * (i % 2 ? 1 : -1);
      items.push({ p: [x0 + bay / 2, 0, side], s: [diag, t * 0.8, t * 0.8], r: [0, 0, angle] });
    }
    items.push({ p: [bays * bay, 0, side], s: [t, height, t] });
  }
  for (let i = 0; i <= bays; i += 1) {
    items.push({ p: [i * bay, -height / 2, 0], s: [t, t, width] });
    items.push({ p: [i * bay, height / 2, 0], s: [t, t, width] });
  }
  return items;
}

const NOSE_ITEMS = noseMembers();
/** The nose turns 30 degrees toward the road and lifts 14 degrees, like a nose on its rollers. */
const NOSE_YAW = (30 * Math.PI) / 180;
const NOSE_PITCH = (14 * Math.PI) / 180;

/** Posts, bracing, backing, catwalk, railing and gooseneck arms, in board-local metres. */
function structureItems(): BoxItem[] {
  const items: BoxItem[] = [];
  const { w, h } = FRAME;
  const groundY = -FRAME.centre[1];
  for (const x of [-6, 0, 6]) {
    items.push({ p: [x, (groundY + h / 2) / 2, -0.55], s: [0.36, h / 2 - groundY, 0.36] });
    items.push({ p: [x, (groundY + h / 2) / 2, -0.55], s: [0.1, h / 2 - groundY, 0.6] });
  }
  for (const [a, b] of [
    [-6, 0],
    [0, 6],
  ]) {
    const len = Math.hypot(b - a, 3.2);
    const angle = Math.atan2(3.2, b - a);
    items.push({ p: [(a + b) / 2, -4.6, -0.7], s: [len, 0.12, 0.12], r: [0, 0, angle] });
    items.push({ p: [(a + b) / 2, -4.6, -0.7], s: [len, 0.12, 0.12], r: [0, 0, -angle] });
  }
  // The backing stands 15 cm behind the paper: closer, the two z-fight at 20 m.
  items.push({ p: [0, 0, -0.45], s: [w + 0.5, h + 0.5, 0.3] });
  items.push({ p: [0, -h / 2 - 0.55, 0.65], s: [w + 0.6, 0.08, 1.3] });
  items.push({ p: [0, -h / 2 + 0.45, 1.28], s: [w + 0.6, 0.06, 0.06] });
  for (let x = -8; x <= 8; x += 2) items.push({ p: [x, -h / 2 - 0.05, 1.28], s: [0.05, 1.0, 0.05] });
  HEADS_LOCAL.forEach(([x, y, z]) => {
    items.push({ p: [x, y - 0.25, (z + 0.65) / 2], s: [0.08, 0.08, z - 0.4] });
  });
  return items;
}

function sandbags(count: number): BoxItem[] {
  const random = createRandom(1918);
  const items: BoxItem[] = [];
  const groundY = -FRAME.centre[1];
  const perPost = Math.floor(count / 3);
  for (const px of [-6, 0, 6]) {
    for (let i = 0; i < perPost; i += 1) {
      const layer = Math.floor(i / 8);
      const a = -Math.PI * 0.1 + ((i % 8) / 7) * Math.PI * 1.2;
      const r = 1.05 - layer * 0.18;
      items.push({
        p: [px + Math.cos(a) * r, groundY + 0.13 + layer * 0.24, -0.55 + Math.sin(a) * r * 0.8],
        s: [0.62, 0.24, 0.36],
        r: [0, -a + (random() - 0.5) * 0.3, (random() - 0.5) * 0.08],
      });
    }
  }
  return items;
}

function ArmySet({ work, tier, timeline, index }: SetProps) {
  const high = tier === "high";
  const board = work.stops.army.board;
  const [art, setArt] = useState<{ poster: CanvasTexture; crate: CanvasTexture } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: { poster: CanvasTexture; crate: CanvasTexture } | null = null;
    loadFaces([`800 160px ${fonts.display()}`, `700 40px ${fonts.mono()}`]).then(() => {
      if (cancelled) return;
      made = { poster: toTexture(forTier(paintArmyPoster(board), !high), 8), crate: toTexture(paintCrate(board.crate)) };
      setArt(made);
    });
    return () => {
      cancelled = true;
      made?.poster.dispose();
      made?.crate.dispose();
    };
  }, [board, high]);

  const floods = useMemo(() => createFloods(HEADS, AIMS, palette.sodiumNight, [78, 30]), []);
  const uniforms = useMemo(() => {
    const fog = () => UniformsUtils.clone(UniformsLib.fog);
    return {
      poster: { ...fog(), ...floods, uMap: { value: art?.poster ?? null }, uAmbient: { value: new Color("#3b2d5c") }, uEmissive: { value: 0 }, uLift: { value: 0.75 } },
      structure: { ...fog(), ...floods, uColor: { value: new Color(palette.asphalt) }, uAmbient: { value: new Color("#3a2c5a") }, uRim: { value: new Color("#5a2a5a") }, uLift: { value: 1.2 } },
      truss: { ...fog(), ...floods, uColor: { value: new Color(OLIVE) }, uAmbient: { value: new Color("#4a3c66") }, uRim: { value: new Color("#c2508f") }, uLift: { value: 1.4 } },
      bags: { ...fog(), ...floods, uColor: { value: new Color(KHAKI) }, uAmbient: { value: new Color("#3a2f55") }, uRim: { value: new Color("#4a2a55") }, uLift: { value: 0.9 } },
      beam: { ...fog(), uColor: { value: new Color(palette.sodiumNight).multiplyScalar(0.16) }, uLevel: { value: 1 } },
    };
  }, [floods, art]);

  const structure = useMemo(() => structureItems(), []);
  const bags = useMemo(() => sandbags(high ? 44 : 22), [high]);
  const lampGlows = useMemo<Glow[]>(
    () => HEADS.map((position) => ({ position, size: 1.3, color: palette.sodiumNight, intensity: 2.8 })),
    [],
  );
  const glowHandle = useRef<GlowHandle | null>(null);
  const nose = useRef<Group>(null);
  const barrier = useRef<Group>(null);
  const beams = useRef<(Mesh | null)[]>([]);
  const leave = useMemo(() => ({ from: beatP(timeline, "army.leave"), to: beatP(timeline, "army.leave", 1) }), [timeline]);
  const armedAt = useRef(-1);

  /** The nose's pose: out of the torn corner, along its axis by `out` metres. */
  const nosePose = useMemo(() => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -NOSE_YAW);
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), NOSE_PITCH));
    return { q, start: HOLE_LOCAL, axis: new Vector3(1, 0, 0).applyQuaternion(q) };
  }, []);

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame((state) => {
    if (night.stop !== index) return;
    const t = state.clock.elapsedTime;
    const armed = night.armed;
    if (night.armTarget > 0 && armedAt.current < 0) armedAt.current = t;
    if (night.armTarget === 0) armedAt.current = -1;
    // Floods: dim at idle; armed, they come up in turn, each with a short sodium sputter.
    const since = armedAt.current >= 0 ? t - armedAt.current : -1;
    for (let i = 0; i < 4; i += 1) {
      const local = since - i * 0.09;
      const sputter = local > 0 && local < 0.25 ? (Math.sin(local * 90) > 0 ? 1 : 0.55) : 1;
      const on = local > 0 ? 1 : 0;
      const level = 0.7 + 0.55 * armed * on * sputter;
      // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
      floods.uFloodLevel.value[i] = level;
      glowHandle.current?.setLevel(i, 0.75 + 0.4 * armed * on * sputter);
      const beam = beams.current[i];
      if (beam) (beam.material as unknown as { uniforms: { uLevel: { value: number } } }).uniforms.uLevel.value = 0.6 + 0.8 * armed * on;
    }
    // The nose launches one more bay when armed, and settles back on its roller.
    if (nose.current) {
      const out = NOSE.bay * armed - 0.04 * Math.max(0, armed - 0.9) * 10;
      const { axis } = nosePose;
      const [sx, sy, sz] = nosePose.start;
      const back = -NOSE.bay * NOSE.hidden;
      nose.current.position.set(sx + axis.x * (back + out), sy + axis.y * (back + out), sz + axis.z * (back + out));
    }
    // The barrier lifts with the scroll in the leave beat (the first 40% of it).
    if (barrier.current) {
      const u = Math.min(1, Math.max(0, (night.p - leave.from) / Math.max(1e-6, (leave.to - leave.from) * 0.4)));
      barrier.current.rotation.x = (80 * Math.PI) / 180 * u * u * (3 - 2 * u);
    }
  });

  const beamItems = useMemo(
    () =>
      HEADS.map((head, i) => {
        const dir = new Vector3(...AIMS[i]).sub(new Vector3(...head));
        const length = dir.length();
        dir.normalize();
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir);
        const centre = new Vector3(...head).addScaledVector(dir, length / 2);
        return { centre, q, length };
      }),
    [],
  );

  const barrierStripes = useMemo<BoxItem[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        p: [0, 0, -0.3 - i * 0.6] as Vec3,
        s: [0.12, 0.16, 0.6] as Vec3,
        color: i % 2 ? palette.cream : palette.sodiumNight,
      })),
    [],
  );

  const guardRail = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    for (let x = -70; x <= -2; x += 4) items.push({ p: [x, 0.4, -5.9], s: [0.12, 0.8, 0.12] });
    items.push({ p: [-36, 0.7, -5.95], s: [68, 0.3, 0.06] });
    for (let x = 26; x <= 90; x += 4) items.push({ p: [x, 0.4, -5.9], s: [0.12, 0.8, 0.12] });
    items.push({ p: [58, 0.7, -5.95], s: [64, 0.3, 0.06] });
    return items;
  }, []);

  const moonGlint = useMemo<Glow[]>(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        position: [-150 + i * 9.5, -0.3, -210 + i * 17] as Vec3,
        size: 6 + i * 0.6,
        color: palette.moon,
        intensity: 0.22,
      })),
    [],
  );

  return (
    <group>
      {/* The sea beyond the lot, the dark headland, the moon's glint. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, -280]}>
        <planeGeometry args={[900, 460]} />
        <meshStandardMaterial color="#0f0a22" roughness={0.25} metalness={0.2} />
      </mesh>
      <mesh position={[-110, -6, -150]} scale={[70, 22, 34]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#160d29" roughness={1} />
      </mesh>
      <Glows glows={moonGlint} />
      {/* The sandy lot. */}
      <mesh rotation-x={-Math.PI / 2} position={[10, 0.03, -27]}>
        <planeGeometry args={[150, 42]} />
        <meshStandardMaterial color="#3d3040" roughness={0.95} />
      </mesh>
      <Boxes items={guardRail}>
        <meshStandardMaterial color="#7d7590" roughness={0.4} metalness={0.6} />
      </Boxes>

      {/* The board, turned toward the approaching car. */}
      <group position={FRAME.centre} rotation-y={FRAME.yaw}>
        <Boxes items={structure}>
          <shaderMaterial uniforms={uniforms.structure} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
        </Boxes>
        <Boxes items={bags} geometry={<sphereGeometry args={[0.5, 8, 6]} />}>
          <shaderMaterial uniforms={uniforms.bags} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
        </Boxes>
        {art ? (
          <mesh position={[0, 0, -0.15]}>
            <planeGeometry args={[FRAME.w, FRAME.h, 4, 2]} />
            <shaderMaterial uniforms={uniforms.poster} vertexShader={boardVertexShader} fragmentShader={boardFragmentShader} fog />
          </mesh>
        ) : null}
        {/* The launching nose, out of the torn corner. */}
        <group ref={nose} quaternion={nosePose.q}>
          <Boxes items={NOSE_ITEMS}>
            <shaderMaterial uniforms={uniforms.truss} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
          </Boxes>
          <mesh position={[NOSE.bay * NOSE.bays + 0.2, -NOSE.height / 2 - 0.25, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.25, 0.25, NOSE.width + 0.3, 12]} />
            <meshStandardMaterial color="#2a2238" roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
        {art ? (
          <mesh position={[3.2, -FRAME.centre[1] + 0.42, 2.6]} rotation-y={0.4}>
            <boxGeometry args={[1.2, 0.84, 0.84]} />
            <meshStandardMaterial map={art.crate} roughness={0.85} />
          </mesh>
        ) : null}
      </group>

      <Glows glows={lampGlows} handle={glowHandle} />
      {beamItems.slice(0, high ? 4 : 2).map((beam, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            beams.current[i] = mesh;
          }}
          position={beam.centre}
          quaternion={beam.q}
          scale={[1, beam.length, 1]}
          renderOrder={4}
        >
          <coneGeometry args={[2.4, 1, 20, 1, true]} />
          <shaderMaterial
            uniforms={uniforms.beam}
            vertexShader={beamVertexShader}
            fragmentShader={beamFragmentShader}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            fog
          />
        </mesh>
      ))}

      {/* The stop's signal: a striped road-works barrier across the lane. */}
      <mesh position={[3, 0.55, 2.35]}>
        <boxGeometry args={[0.18, 1.1, 0.18]} />
        <meshStandardMaterial color={palette.asphalt} roughness={0.6} />
      </mesh>
      <group ref={barrier} position={[3, 1.05, 2.3]}>
        <Boxes items={barrierStripes}>
          <meshStandardMaterial roughness={0.5} emissive="#2a1a10" />
        </Boxes>
      </group>

      <NightPalms
        palms={(high
          ? [
              { position: [26, 0, -10] as Vec3, rotation: 0.4, scale: 1.0, variant: 1 },
              { position: [33, 0, -14] as Vec3, rotation: 2.2, scale: 0.9, variant: 2 },
            ]
          : [{ position: [27, 0, -11] as Vec3, rotation: 0.4, scale: 1.0, variant: 1 }])}
      />
    </group>
  );
}

export const army: NightSet = {
  Set: ArmySet,
  board: boardCorners(FRAME, 0.2),
  boardNormal: boardNormal(FRAME),
  shots: (timeline) => {
    const wide = { position: [-15, 2.4, 17] as Vec3, look: [6, 4.6, -10] as Vec3, fov: LENS.mm28 };
    // Low behind the car's rear quarter: his head and shoulder a dark shape lower left, looking up at the board.
    const readFrom = { position: [-8.6, 1.7, 3.0] as Vec3, look: [10.5, 4.6, -13] as Vec3, fov: LENS.mm28 };
    const readTo = { position: [-7.4, 1.75, 2.6] as Vec3, look: [10.5, 4.8, -13] as Vec3, fov: LENS.mm28 };
    return [
      keyAt(timeline, "title", 0, wide),
      keyAt(timeline, "army.arrive", 1, wide),
      keyAt(timeline, "army.card0", 0, readFrom),
      keyAt(timeline, "army.card1", 1, readTo),
    ];
  },
  // On a phone the camera turns within 10 degrees of square to the board, then pulls back.
  portrait: (timeline) => {
    // From down the road, so the car sits in front of the board's foot rather than beside it.
    const square = { position: [-9, 2.2, 13] as Vec3, look: [9, 5.2, -13] as Vec3, fov: LENS.mm35 };
    return [keyAt(timeline, "title", 0, square), keyAt(timeline, "army.card1", 1, { ...square, position: [-8, 2.3, 12] })];
  },
  maxBack: 18,
  lights: [
    { position: [11, 3.4, -9], color: palette.sodiumNight, intensity: 90, distance: 40 },
    { position: [-20, 12, 10], color: "#8a7cd0", intensity: 30, distance: 60 },
  ],
  streaks: HEADS.map((position) => ({ position, color: palette.sodiumNight, level: 0.7 })),
  kerbs: { near: 1.9, far: -5.4 },
};
