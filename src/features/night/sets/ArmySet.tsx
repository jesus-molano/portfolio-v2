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
import { forTier, loadFaces, toTexture } from "../artCanvas";
import { type BoardFrame, boardCorners, boardNormal, toSet } from "../boardFrame";
import { createFloods } from "../floods";
import type { Vec3 } from "../frame";
import { night } from "../nightState";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { type Glow, type GlowHandle, Glows } from "../parts/Glows";
import { NightPalms } from "../parts/NightPalms";
import { beamFragmentShader, beamVertexShader } from "../shaders/beam";
import { boardFragmentShader, boardVertexShader, structureFragmentShader } from "../shaders/board";
import { ARMY_GIRDER, ARMY_HOLE, ARMY_POSTER, ARMY_STEEL, armyFaces, paintArmyPoster } from "./art/army";
import { ArmyProps } from "./army/props";
import { instancedBoardVertexShader } from "./instanced";
import type { NightSet, SetProps } from "./types";
import { ArmySite } from "./army/Site";

/**
 * Stop 1, the army (Las Palmas de Gran Canaria, 2018-2021): a roadside
 * poster on a sandy lot at the edge of the city, the only printed board in
 * a city of neon, lit by four sodium floods on its catwalk. A 1940s
 * recruiting poster: two sappers heave a bridge girder out over a river
 * at dawn, up into the torn corner (art/army.ts). The painted girder
 * breaks out of the paper as a real launching nose; armed, the floods
 * come up one after another and the nose launches half a bay more.
 * The checkpoint boom across the lane (army/Site.tsx) is the stop's signal.
 */

const FRAME: BoardFrame = { centre: [11, 7, -13], yaw: -Math.PI / 9, w: 16, h: 7 };

/** Flood heads on the catwalk, and where each one aims, in board-local metres. */
/**
 * The catwalk hangs 1.15 m under the face, so from the low camera its rail
 * and lamp heads pass below the foot band's copy instead of through it.
 */
const CATWALK_DROP = 1.15;
const HEADS_LOCAL: Vec3[] = [-6, -2, 2, 6].map((x) => [x, -FRAME.h / 2 - CATWALK_DROP - 0.05, 1.5] as Vec3);
/** Aimed above the middle of the face, so each pool reaches the headline and fades up into the sky. */
const AIMS_LOCAL: Vec3[] = [-6, -2, 2, 6].map((x) => [x * 0.95, 0.6, 0] as Vec3);
const HEADS = HEADS_LOCAL.map((p) => toSet(FRAME, p));
const AIMS = AIMS_LOCAL.map((p) => toSet(FRAME, p));
/**
 * The same heads seen by the paper: tighter cones aimed higher, so each
 * lamp paints its own warm pool from the foot band up into the headline,
 * with the night between the pools.
 */
const POSTER_AIMS = AIMS_LOCAL.map(([x]) => toSet(FRAME, [x, 2.6, 0]));
/** Warm, but whiter than the lamps' sodium haze: on the paper it reads as light, not as orange ink. */
const POSTER_FLOOD = "#ffd9a6";

/** Metres per poster pixel. */
const PX = FRAME.w / ARMY_POSTER.w;

/**
 * The launching nose: the painted girder's next panels, out of the tear
 * over the far bank. Same depth and bay as the painted part (a
 * Bailey-type panel twice as long as it is deep), the same V of braces
 * round a middle post, so the paper girder and the steel one are one
 * girder. It starts one bay back, behind the paper, with an end post
 * where the painted girder's sixth bay ends (the hole's centre); narrow
 * enough, at its yaw, that it crosses the paper inside the tear's dark
 * middle and nowhere else.
 */
const NOSE = { bay: ARMY_GIRDER.bay * PX, bays: 3, height: ARMY_GIRDER.depth * PX, width: 0.62, hidden: 1 } as const;
/** The tear's centre, on the paper (the poster plane sits at z -0.15). */
const HOLE_LOCAL: Vec3 = [
  (ARMY_HOLE.x / ARMY_POSTER.w - 0.5) * FRAME.w,
  (0.5 - ARMY_HOLE.y / ARMY_POSTER.h) * FRAME.h,
  -0.15,
];

/** Truss members along the nose axis (local frame of the nose: x along, y up, z across). */
function noseMembers(): BoxItem[] {
  const items: BoxItem[] = [];
  const { bay, bays, height, width } = NOSE;
  const chord = 0.19;
  const t = 0.12;
  const half = bay / 2;
  const diag = Math.hypot(half, height);
  const angle = Math.atan2(height, half);
  for (const side of [-width / 2, width / 2]) {
    items.push({ p: [(bays * bay) / 2, height / 2, side], s: [bays * bay, chord, chord] });
    items.push({ p: [(bays * bay) / 2, -height / 2, side], s: [bays * bay, chord, chord] });
    for (let i = 0; i < bays; i += 1) {
      const x0 = i * bay;
      // End post, middle post, and the V: bottom corners up to the middle of the top chord.
      items.push({ p: [x0, 0, side], s: [t * 1.3, height, t * 1.3] });
      items.push({ p: [x0 + half, 0, side], s: [t, height, t] });
      items.push({ p: [x0 + half / 2, 0, side], s: [diag, t, t], r: [0, 0, angle] });
      items.push({ p: [x0 + half * 1.5, 0, side], s: [diag, t, t], r: [0, 0, -angle] });
    }
    items.push({ p: [bays * bay, 0, side], s: [t * 1.6, height, t * 1.6] });
  }
  // Transoms under the deck every half bay, top ties at the posts.
  for (let i = 0; i <= bays * 2; i += 1) items.push({ p: [i * half, -height / 2, 0], s: [t, t, width] });
  for (let i = 0; i <= bays; i += 1) items.push({ p: [i * bay, height / 2, 0], s: [t, t, width] });
  return items;
}

const NOSE_ITEMS = noseMembers();
/**
 * The nose turns 16 degrees toward the road (enough to stand out of the
 * board, little enough that on screen it carries on along the painted
 * line) and keeps the painted girder's own pitch, a few degrees nose-up.
 */
const NOSE_YAW = (16 * Math.PI) / 180;
const NOSE_PITCH = ARMY_GIRDER.pitch;

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
  // The catwalk, its rail (a metre high) and posts, and the brackets up to the face.
  const deck = -h / 2 - CATWALK_DROP;
  items.push({ p: [0, deck, 0.65], s: [w + 0.6, 0.08, 1.3] });
  items.push({ p: [0, deck + 1.0, 1.28], s: [w + 0.6, 0.06, 0.06] });
  for (let x = -8; x <= 8; x += 2) items.push({ p: [x, deck + 0.5, 1.28], s: [0.05, 1.0, 0.05] });
  for (const x of [-7, -3, 3, 7]) items.push({ p: [x, deck + CATWALK_DROP / 2, 0.05], s: [0.08, CATWALK_DROP, 0.08] });
  HEADS_LOCAL.forEach(([x, y, z]) => {
    items.push({ p: [x, y - 0.25, (z + 0.65) / 2], s: [0.08, 0.08, z - 0.4] });
  });
  return items;
}

function ArmySet({ work, tier, timeline, index }: SetProps) {
  const high = tier === "high";
  const board = work.stops.army.board;
  const [art, setArt] = useState<{ poster: CanvasTexture } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: { poster: CanvasTexture } | null = null;
    loadFaces(armyFaces()).then(() => {
      if (cancelled) return;
      made = { poster: toTexture(forTier(paintArmyPoster(board), !high), 8) };
      setArt(made);
    });
    return () => {
      cancelled = true;
      made?.poster.dispose();
    };
  }, [board, high]);

  const floods = useMemo(() => createFloods(HEADS, AIMS, palette.sodiumNight, [78, 30]), []);
  const posterFloods = useMemo(() => createFloods(HEADS, POSTER_AIMS, POSTER_FLOOD, [50, 14]), []);
  const uniforms = useMemo(() => {
    const fog = () => UniformsUtils.clone(UniformsLib.fog);
    return {
      // A low, near-neutral night on the paper, so the cream stays cream and the sodium pools carry the face.
      poster: { ...fog(), ...posterFloods, uMap: { value: art?.poster ?? null }, uAmbient: { value: new Color("#2f2a4a") }, uEmissive: { value: 0.05 }, uLift: { value: 2.1 } },
      structure: { ...fog(), ...floods, uColor: { value: new Color(palette.asphalt) }, uAmbient: { value: new Color("#3a2c5a") }, uRim: { value: new Color("#5a2a5a") }, uLift: { value: 1.2 } },
      // The painted girder's olive, its top chord catching a warm light like the painted one.
      truss: { ...fog(), ...floods, uColor: { value: new Color(ARMY_STEEL.base) }, uAmbient: { value: new Color("#4a4652") }, uRim: { value: new Color(ARMY_STEEL.light).multiplyScalar(0.55) }, uLift: { value: 1.3 } },
      beam: { ...fog(), uColor: { value: new Color(palette.sodiumNight).multiplyScalar(0.16) }, uLevel: { value: 1 } },
    };
  }, [floods, posterFloods, art]);

  const structure = useMemo(() => structureItems(), []);
  const lampGlows = useMemo<Glow[]>(
    () => HEADS.map((position) => ({ position, size: 1.3, color: palette.sodiumNight, intensity: 2.8 })),
    [],
  );
  const glowHandle = useRef<GlowHandle | null>(null);
  const nose = useRef<Group>(null);
  const beams = useRef<(Mesh | null)[]>([]);
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
      // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
      posterFloods.uFloodLevel.value[i] = level;
      glowHandle.current?.setLevel(i, 0.75 + 0.4 * armed * on * sputter);
      const beam = beams.current[i];
      if (beam) (beam.material as unknown as { uniforms: { uLevel: { value: number } } }).uniforms.uLevel.value = 0.6 + 0.8 * armed * on;
    }
    // The nose launches half a bay more when armed, and settles back on its roller.
    if (nose.current) {
      const out = NOSE.bay * 0.5 * armed - 0.04 * Math.max(0, armed - 0.9) * 10;
      const { axis } = nosePose;
      const [sx, sy, sz] = nosePose.start;
      const back = -NOSE.bay * NOSE.hidden;
      nose.current.position.set(sx + axis.x * (back + out), sy + axis.y * (back + out), sz + axis.z * (back + out));
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
        {art ? (
          <mesh position={[0, 0, -0.15]}>
            <planeGeometry args={[FRAME.w, FRAME.h, 4, 2]} />
            <shaderMaterial uniforms={uniforms.poster} vertexShader={boardVertexShader} fragmentShader={boardFragmentShader} fog />
          </mesh>
        ) : null}
        {/* The launching nose, out of the tear over the far bank. */}
        <group ref={nose} quaternion={nosePose.q}>
          <Boxes items={NOSE_ITEMS}>
            <shaderMaterial uniforms={uniforms.truss} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
          </Boxes>
        </group>
      </group>
      <ArmyProps frame={FRAME} tier={tier} />

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

      {/* The ground, the perimeter and the checkpoint, whose boom is the stop's signal (army/Site.tsx). */}
      <ArmySite tier={tier} timeline={timeline} index={index} />

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
  maxBack: 18,
  lights: [
    { position: [11, 3.4, -9], color: palette.sodiumNight, intensity: 90, distance: 40 },
    { position: [-20, 12, 10], color: "#8a7cd0", intensity: 30, distance: 60 },
  ],
  streaks: HEADS.map((position) => ({ position, color: palette.sodiumNight, level: 0.7 })),
  kerbs: { near: 1.9, far: -5.4 },
};
