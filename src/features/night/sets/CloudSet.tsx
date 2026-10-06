"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CanvasTexture,
  Color,
  DynamicDrawUsage,
  ExtrudeGeometry,
  type Group,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  Shape,
  ShapeGeometry,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { palette } from "@/design/tokens";
import { createRandom } from "@/features/hero/scene/world";
import { glowFragmentShader, glowVertexShader } from "@/features/hero/shaders/neon";
import { fonts, forTier, loadFaces, toTexture } from "../artCanvas";
import { cloneBare } from "../cloneBare";
import { createFloods } from "../floods";
import type { Vec3 } from "../frame";
import { night } from "../nightState";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { type Pane, Windows } from "../parts/Windows";
import { NightPalms, type NightPalm } from "../parts/NightPalms";
import { type Glow, type GlowHandle, Glows } from "../parts/Glows";
import { Lamps } from "../parts/Lamps";
import { Skyline } from "../parts/Skyline";
import { buildPrism } from "../prismGeometry";
import { structureFragmentShader } from "../shaders/board";
import { signFragmentShader, signVertexShader } from "../shaders/sign";
import { trivisionFragmentShader, trivisionVertexShader } from "../shaders/trivision";
import { beatP } from "../timelineKeys";
import { prismAngle, rippleAngle, TRIVISION } from "../trivision";
import { paintCafeRoom, paintCafeSign, ROOM, SIGN } from "./art/cafe";
import { paintCloudSigns, paintPiece, paintTrivision, PIECE } from "./art/cloud";
import { pickPane } from "./art/windows";
import { instancedBoardVertexShader } from "./instanced";
import type { NightSet, SetProps } from "./types";

/**
 * Stop 3, Cloud District (2024-2025): a rotating trivision billboard over a
 * Streamline Moderne corner. A consultancy is a billboard operator: the
 * frame and the lit nameplate are Cloud District, the faces are its
 * clients, and every turn brings a new one. The prisms turn with the
 * scroll, in a wave from left to right; armed, the prisms near the pointer
 * twist toward the next face. The first stop without palms.
 */

const BOARD = { x: 1, y: 15.5, z: -11, w: 18, h: 7.5 } as const;
/** Naturgy's bolt: a glyph in metres (centred), where it breaks out over the face's top right corner, its colour hot enough to bloom. */
const BOLT: [number, number][] = [
  [-0.1, 1.65],
  [0.75, 1.65],
  [0.2, 0.3],
  [0.7, 0.3],
  [-0.6, -1.65],
  [-0.1, -0.12],
  [-0.6, -0.12],
];
const BOLT_AT: Vec3 = [BOARD.x + BOARD.w / 2 - 1.3, BOARD.y + BOARD.h / 2 + 0.35, BOARD.z + 0.6];
const BOLT_HOT = new Color("#ffb35a").multiplyScalar(2.6);
const BOLT_GLOW: Glow[] = [{ position: [0, 0, 0.05], size: 3.4, color: "#ff8a2a", intensity: 1.4 }];
/** The Telpark car's bay: on the roof's front edge, right of the nameplate. */
const CAR_BAY = { x: BOARD.x + 7.6 } as const;
/** Where Pangea's missing piece (the last continent) fits on the face (see art/cloud.ts). */
const SLOT = { x: BOARD.x + 0.4, y: BOARD.y } as const;
const PRISM = BOARD.w / TRIVISION.prisms;
/** The prism under the piece's middle: once it starts to turn away, the piece goes with the face it completes. */
const PIECE_PRISM = Math.floor((SLOT.x - (BOARD.x - BOARD.w / 2)) / PRISM);
const TELPARK_CAR = "/models/quaternius-cars/SportsCar2.glb";

/** The corner block: a footprint with a rounded prow, extruded to the cornice. */
function buildBlock(): ExtrudeGeometry {
  const shape = new Shape();
  // Drawn in x/y with the front edge at y = 0 and the back at y = 22.
  shape.moveTo(-18, 0);
  shape.lineTo(9, 0);
  shape.absarc(9, 6, 6, -Math.PI / 2, 0, false);
  shape.lineTo(15, 22);
  shape.lineTo(-18, 22);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 9.2, bevelEnabled: false, curveSegments: 18 });
  // Stand it up: the shape's y becomes -z (the front toward the street), the extrusion the height.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, BLOCK_FRONT);
  return geometry;
}

/**
 * Pangea's missing piece: the same cut as the hole on the face (a square,
 * one knob on its right), a card's thickness, printed with its own patch of
 * the picture (`paintPiece`): its UVs span the square and its knob, as
 * `PIECE_BOX` does on the face, so once home it completes the photo.
 */
function buildPiece(): ExtrudeGeometry {
  const half = PIECE.size / 2;
  const { offset, radius } = PIECE.knob;
  const chord = Math.sqrt(radius * radius - offset * offset);
  const shape = new Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, -chord);
  const from = Math.atan2(-chord, -offset);
  const to = Math.atan2(chord, -offset);
  // Round the far side of the knob, from just below the edge's middle to just above it.
  shape.absarc(half + offset, 0, radius, from, to, false);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false, curveSegments: 16 });
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const wide = PIECE.size + offset + radius;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (position.getX(i) + half) / wide, (position.getY(i) + half) / PIECE.size);
  return geometry;
}

/** The island's palms along the kerb: every stop is the same island at night. */
const CLOUD_PALMS: NightPalm[] = [
  { position: [-24, 0, 4.8] as Vec3, rotation: 0.4, scale: 1.1, variant: 0 },
  { position: [-19, 0, 5.4] as Vec3, rotation: 2.2, scale: 0.9, variant: 2 },
  { position: [13, 0, 4.9] as Vec3, rotation: 1.3, scale: 1.05, variant: 1 },
  { position: [18, 0, 5.5] as Vec3, rotation: 2.8, scale: 0.9, variant: 3 },
];

/** The block's front, just behind the far pavement. */
const BLOCK_FRONT = -6.6;

/** The café: its room behind the glass (centre x), the door's bay, the canopy, the sign over it, the ribbon windows upstairs. */
const ROOM_X = -15 - 1.05 + ROOM.w / 2;
const DOOR_X = -4;
const CANOPY_Y = 3.2;
const CAFE_SIGN = { x: -3.6, y: 4.45, w: 10.5 } as const;
const RIBBON_Y = 6.1;

const LAMPS: Vec3[] = [
  [-14, 0.15, 2.6],
  [12, 0.15, 2.6],
];

function CloudSet({ work, tier, timeline, index }: SetProps) {
  const high = tier === "high";
  const board = work.stops["cloud-district"].board;
  const [art, setArt] = useState<{ faces: CanvasTexture; piece: CanvasTexture; signs: CanvasTexture; cafe: CanvasTexture; room: CanvasTexture } | null>(null);
  const { scene: carScene } = useGLTF(TELPARK_CAR);
  const telpark = useMemo(() => cloneBare(carScene), [carScene]);

  useEffect(() => {
    let cancelled = false;
    let made: { faces: CanvasTexture; piece: CanvasTexture; signs: CanvasTexture; cafe: CanvasTexture; room: CanvasTexture } | null = null;
    loadFaces([`800 200px ${fonts.display()}`, `700 60px ${fonts.mono()}`, `400 180px ${fonts.script()}`, `italic 600 60px ${fonts.body()}`, `600 60px ${fonts.body()}`, `italic 600 60px ${fonts.serif()}`]).then(() => {
      if (cancelled) return;
      made = {
        faces: toTexture(forTier(paintTrivision(board.faces, board.pieces), !high), 8),
        piece: toTexture(paintPiece(board.faces[1], board.pieces), 4),
        signs: toTexture(paintCloudSigns(board.nameplate), 4),
        cafe: toTexture(paintCafeSign(board.cafe), 4),
        room: toTexture(forTier(paintCafeRoom(), !high), 4),
      };
      setArt(made);
    });
    return () => {
      cancelled = true;
      made?.faces.dispose();
      made?.piece.dispose();
      made?.signs.dispose();
      made?.cafe.dispose();
      made?.room.dispose();
    };
  }, [board, high]);

  const heads: Vec3[] = useMemo(() => [-6.5, -1.5, 3.5, 8.5].map((x) => [x, BOARD.y - BOARD.h / 2 - 0.6, BOARD.z + 1.6] as Vec3), []);
  const floods = useMemo(
    () => createFloods(heads, heads.map(([x]) => [x, BOARD.y + 0.5, BOARD.z] as Vec3), palette.sodiumNight, [75, 30]),
    [heads],
  );
  const uniforms = useMemo(() => {
    const fog = () => UniformsUtils.clone(UniformsLib.fog);
    const prisms = {
      ...fog(),
      ...floods,
      uMap: { value: art?.faces ?? null },
      uAmbient: { value: new Color("#9a90c0") },
      uLift: { value: 0.9 },
      uFront: { value: new Vector3(0, 0, 1) },
      uSlices: { value: TRIVISION.prisms },
    };
    return {
      prisms,
      frame: { ...fog(), ...floods, uColor: { value: new Color("#2b2340") }, uAmbient: { value: new Color("#3a2d58") }, uRim: { value: new Color("#5a2a6a") }, uLift: { value: 0.8 } },
      block: { ...fog(), ...floods, uColor: { value: new Color("#cdb8c9") }, uAmbient: { value: new Color("#30254c") }, uRim: { value: new Color("#ff6fb8") }, uLift: { value: 0.25 } },
      signs: { ...fog(), uMap: { value: art?.signs ?? null }, uLevel: { value: 1 }, uIntensity: { value: 1.6 }, uFogAmount: { value: 0.3 } },
      cafe: { ...fog(), uMap: { value: art?.cafe ?? null }, uLevel: { value: 1 }, uIntensity: { value: 2.2 }, uFogAmount: { value: 0.2 } },
      room: { ...fog(), uMap: { value: art?.room ?? null }, uLevel: { value: 0.95 }, uIntensity: { value: 1.25 }, uFogAmount: { value: 0.25 } },
      // The piece is lit, capped and fogged by the face's own shader and uniforms, its own picture in uMap: once home it is the photo.
      piece: { ...prisms, uMap: { value: art?.piece ?? null } },
      glow: { ...fog(), uIntensity: { value: 1 }, uFogAmount: { value: 0.3 } },
    };
  }, [floods, art]);

  const prism = useMemo(() => buildPrism(PRISM, BOARD.h), []);
  const pieceGeo = useMemo(() => buildPiece(), []);
  useEffect(() => () => pieceGeo.dispose(), [pieceGeo]);
  const block = useMemo(() => buildBlock(), []);
  useEffect(() => () => {
    prism.dispose();
    block.dispose();
  }, [prism, block]);
  const prisms = useRef<InstancedMesh>(null);
  const angles = useMemo(() => {
    const attribute = new InstancedBufferAttribute(new Float32Array(TRIVISION.prisms), 1);
    attribute.setUsage(DynamicDrawUsage);
    return attribute;
  }, []);
  const slices = useMemo(() => new InstancedBufferAttribute(new Float32Array(Array.from({ length: TRIVISION.prisms }, (_, i) => i)), 1), []);

  useEffect(() => {
    const mesh = prisms.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3(1, 1, 1);
    for (let i = 0; i < TRIVISION.prisms; i += 1) {
      m.compose(new Vector3(BOARD.x - BOARD.w / 2 + PRISM * (i + 0.5), BOARD.y, BOARD.z), q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [art]);

  const frame = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    const { x, y, z, w, h } = BOARD;
    items.push({ p: [x, y + h / 2 + 0.25, z - 0.1], s: [w + 0.8, 0.5, 1.4] });
    items.push({ p: [x, y - h / 2 - 0.25, z - 0.1], s: [w + 0.8, 0.5, 1.4] });
    items.push({ p: [x - w / 2 - 0.2, y, z - 0.1], s: [0.4, h + 1, 1.4] });
    items.push({ p: [x + w / 2 + 0.2, y, z - 0.1], s: [0.4, h + 1, 1.4] });
    items.push({ p: [x, y, z - 0.6], s: [w + 0.4, h + 0.4, 0.2] });
    for (const lx of [-6, 0, 6]) items.push({ p: [x + lx, (9.2 + y - h / 2) / 2, z - 0.4], s: [0.3, y - h / 2 - 9.2, 0.3] });
    items.push({ p: [x, y - h / 2 - 0.7, z + 1.1], s: [w + 0.8, 0.1, 1.4] });
    items.push({ p: [x, y - h / 2 - 0.1, z + 1.75], s: [w + 0.8, 0.06, 0.06] });
    for (const [hx, hy, hz] of heads) items.push({ p: [hx, hy + 0.1, (hz + z + 0.6) / 2], s: [0.08, 0.08, hz - z - 0.6] });
    // The steel ledge under the right end, where the Telpark car parks.
    items.push({ p: [CAR_BAY.x, 9.3, z + 2.2], s: [3.0, 0.18, 4.8] });
    return items;
  }, [heads]);

  const speedLines = useMemo<BoxItem[]>(
    () => [7.4, 7.9, 8.4].map((y, i) => ({ p: [-4.5, y, BLOCK_FRONT + 0.12] as Vec3, s: [27, 0.12, 0.12] as Vec3, color: i === 1 ? "#ff2d95" : "#ff8fd0" })),
    [],
  );
  const ribbon = useMemo<Pane[]>(() => {
    // Upstairs: the consultancy's ribbon windows, some of its rooms still lit, no two alike side by side.
    const random = createRandom(2024);
    const panes: Pane[] = [];
    let beside = -1;
    for (let x = -15; x <= 7; x += 2.2) {
      const look = pickPane(random, "office", 0.5, beside);
      beside = look.cell;
      panes.push({ p: [x, RIBBON_Y, BLOCK_FRONT + 0.08], s: [2.1, 1.3], ...look });
    }
    return panes;
  }, []);
  const storefront = useMemo<BoxItem[]>(() => {
    // The café's glass: mullions between the bays, a transom, the kick plate, the door's brass bar; the canopy over it.
    const items: BoxItem[] = [];
    const left = ROOM_X - ROOM.w / 2;
    for (let k = 0; k <= 11; k += 1) items.push({ p: [left + k * 2.2 - (k === 11 ? 0.1 : 0), 1.9, BLOCK_FRONT + 0.1], s: [0.1, 2.36, 0.1], color: "#2a2036" });
    items.push({ p: [ROOM_X, 2.62, BLOCK_FRONT + 0.1], s: [ROOM.w, 0.07, 0.08], color: "#2a2036" });
    items.push({ p: [ROOM_X, 0.8, BLOCK_FRONT + 0.1], s: [ROOM.w, 0.12, 0.08], color: "#2a2036" });
    items.push({ p: [DOOR_X - 0.18, 1.55, BLOCK_FRONT + 0.16], s: [0.04, 0.8, 0.04], color: "#8a7050" });
    items.push({ p: [DOOR_X + 0.18, 1.55, BLOCK_FRONT + 0.16], s: [0.04, 0.8, 0.04], color: "#8a7050" });
    items.push({ p: [DOOR_X, 1.9, BLOCK_FRONT + 0.11], s: [0.05, 2.3, 0.08], color: "#2a2036" });
    items.push({ p: [ROOM_X, CANOPY_Y, BLOCK_FRONT + 0.75], s: [ROOM.w + 0.6, 0.16, 1.5], color: "#231a33" });
    items.push({ p: [ROOM_X, CANOPY_Y + 0.1, BLOCK_FRONT + 1.5], s: [ROOM.w + 0.6, 0.06, 0.04], color: "#c8a060" });
    return items;
  }, []);
  const downlights = useMemo<Glow[]>(
    () => Array.from({ length: 11 }, (_, k) => ({ position: [ROOM_X - ROOM.w / 2 + 1.1 + k * 2.2, CANOPY_Y - 0.12, BLOCK_FRONT + 1.0] as Vec3, size: 0.45, color: "#ffd9a0", intensity: 1.6 })),
    [],
  );
  const signal = useRef<GlowHandle | null>(null);
  const signalGlows = useMemo<Glow[]>(
    () => [
      { position: [4.1, 3.9, 2.6], size: 0.5, color: "#ff3a5c", intensity: 2.4 },
      { position: [4.1, 3.5, 2.6], size: 0.5, color: "#ffb347", intensity: 1.0, level: 0.15 },
      { position: [4.1, 3.1, 2.6], size: 0.5, color: "#4dffb0", intensity: 2.4, level: 0 },
    ],
    [],
  );
  const lampHeads = useMemo<Glow[]>(() => heads.map((position) => ({ position, size: 1.1, color: palette.sodiumNight, intensity: 2.6 })), [heads]);
  const bolt = useRef<Group>(null);
  const piece = useRef<Group>(null);
  const car = useRef<Group>(null);
  const beats = useMemo(
    () => ({
      flip1: [beatP(timeline, "cloud.flip1"), beatP(timeline, "cloud.flip1", 1)],
      pangea: [beatP(timeline, "cloud.pangea"), beatP(timeline, "cloud.pangea", 1)],
      flip2: [beatP(timeline, "cloud.flip2"), beatP(timeline, "cloud.flip2", 1)],
      card1: [beatP(timeline, "cloud.card1"), beatP(timeline, "cloud.card1", 1)],
      leave: beatP(timeline, "cloud.leave"),
    }),
    [timeline],
  );

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame((state) => {
    if (night.stop !== index) return;
    const p = night.p;
    const u = (range: number[]) => Math.min(1, Math.max(0, (p - range[0]) / Math.max(1e-6, range[1] - range[0])));
    let face = 0;
    let flip = 0;
    if (p >= beats.flip2[0]) {
      face = 1;
      flip = u(beats.flip2);
    } else if (p >= beats.flip1[0]) {
      face = 0;
      flip = u(beats.flip1);
    }
    const pointer = Number.isFinite(night.pointerU) ? night.pointerU * TRIVISION.prisms - 0.5 : Number.NaN;
    const at = night.armTarget > 0 && !Number.isFinite(pointer) ? ((state.clock.elapsedTime * 6) % (TRIVISION.prisms + 8)) - 4 : pointer;
    for (let i = 0; i < TRIVISION.prisms; i += 1) {
      angles.setX(i, prismAngle(i, face, flip) + rippleAngle(i, at, night.armed));
    }
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    angles.needsUpdate = true;
    const shown = face + Math.round(flip);
    // The bolt while Naturgy is up, gone as soon as the board starts to turn; the piece flies home during the Pangea hold.
    if (bolt.current) bolt.current.visible = p < beats.flip1[0];
    if (piece.current) {
      // Up from the moment Pangea shows until the prism under it turns away (never floating over a turning board).
      piece.current.visible = shown === 1 && (face === 0 || prismAngle(PIECE_PRISM, 1, flip) <= prismAngle(PIECE_PRISM, 1, 0) + 1e-4);
      const k = u(beats.pangea);
      const e = k * k * (3 - 2 * k);
      // From floating off the top-right corner, along an arc, into its slot.
      piece.current.position.set(
        SLOT.x + 2.6 * (1 - e),
        SLOT.y + 4.4 * (1 - e) + 1.2 * Math.sin(Math.PI * e),
        BOARD.z + 0.35 + 1.2 * (1 - e),
      );
      piece.current.rotation.z = 0.6 * (1 - e) + (night.armed > 0 ? Math.sin(state.clock.elapsedTime * 7) * 0.05 * night.armed : 0);
    }
    // The Telpark car drives out of the print and parks on its ledge in the first half of card 1.
    if (car.current) {
      const k = Math.min(1, u(beats.card1) * 2);
      car.current.visible = shown === 2 || p >= beats.card1[0];
      car.current.position.set(CAR_BAY.x, 9.4, BOARD.z - 0.2 + 3.2 * k);
      car.current.scale.setScalar(0.55 + 0.45 * k);
    }
    // The traffic light: red while the stop holds, green when it leaves.
    const green = p >= beats.leave;
    signal.current?.setLevel(0, green ? 0 : 1);
    signal.current?.setLevel(2, green ? 1 : 0);
    // Armed, the floods lift.
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    for (let i = 0; i < 4; i += 1) floods.uFloodLevel.value[i] = 1 + 0.45 * night.armed;
  });

  // Naturgy's breakout: a lightning bolt out of the face's top right corner, over the gauge, hot and glowing.
  const boltGeo = useMemo(() => {
    const shape = new Shape();
    BOLT.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
    shape.closePath();
    return new ShapeGeometry(shape);
  }, []);
  useEffect(() => () => boltGeo.dispose(), [boltGeo]);

  return (
    <group>
      <Skyline spec={{ seed: 2024, count: high ? 60 : 40, x: [-160, 170], z: [-200, -40], height: [12, 55], lit: 0.32, clear: [{ x: [-30, 30], z: [-50, -20] }] }} />
      {/* A dome on the skyline, like the old city's. */}
      <mesh position={[-48, 22, -95]} scale={[11, 9, 11]}>
        <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#251a3d" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[-48, 11, -95]}>
        <cylinderGeometry args={[11.5, 12, 22, 24]} />
        <meshStandardMaterial color="#1f1636" roughness={0.9} />
      </mesh>
      {/* The corner block, its speed lines, the café. */}
      <mesh geometry={block}>
        <shaderMaterial uniforms={uniforms.block} vertexShader={blockVertexShader} fragmentShader={structureFragmentShader} fog />
      </mesh>
      <Boxes items={speedLines}>
        <shaderMaterial uniforms={uniforms.glow} vertexShader={glowVertexShader} fragmentShader={glowFragmentShader} fog />
      </Boxes>
      <Windows panes={ribbon} />
      <Boxes items={storefront}>
        <meshStandardMaterial roughness={0.45} metalness={0.6} />
      </Boxes>
      <Glows glows={downlights} />
      {art ? (
        <>
          {/* The café's room behind the glass, and its sign over the canopy. */}
          <mesh position={[ROOM_X, 1.9, BLOCK_FRONT + 0.06]}>
            <planeGeometry args={[ROOM.w, ROOM.h]} />
            <shaderMaterial uniforms={uniforms.room} vertexShader={signVertexShader} fragmentShader={signFragmentShader} fog />
          </mesh>
          <mesh position={[CAFE_SIGN.x, CAFE_SIGN.y, BLOCK_FRONT + 0.3]}>
            <planeGeometry args={[CAFE_SIGN.w, (CAFE_SIGN.w * SIGN.h) / SIGN.w]} />
            <shaderMaterial uniforms={uniforms.cafe} vertexShader={signVertexShader} fragmentShader={signFragmentShader} fog />
          </mesh>
          <mesh position={[BOARD.x, BOARD.y - BOARD.h / 2 - 1.2, BOARD.z + 1.82]}>
            <planeGeometry args={[11, 0.9]} />
            <shaderMaterial uniforms={uniforms.signs} vertexShader={signVertexShader} fragmentShader={signFragmentShader} fog />
          </mesh>
          <instancedMesh ref={prisms} args={[prism, undefined, TRIVISION.prisms]} frustumCulled={false}>
            <primitive object={angles} attach="geometry-attributes-aAngle" />
            <primitive object={slices} attach="geometry-attributes-aSlice" />
            <shaderMaterial uniforms={uniforms.prisms} vertexShader={trivisionVertexShader} fragmentShader={trivisionFragmentShader} fog />
          </instancedMesh>
        </>
      ) : null}
      <Boxes items={frame}>
        <shaderMaterial uniforms={uniforms.frame} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
      </Boxes>
      <NightPalms palms={high ? CLOUD_PALMS : CLOUD_PALMS.slice(0, 2)} />
      <Glows glows={lampHeads} />
      {/* Breakouts: Naturgy's bolt, Pangea's last piece, Telpark's car. */}
      <group ref={bolt} position={BOLT_AT} rotation-z={-0.14}>
        <mesh geometry={boltGeo} scale={1.22} position-z={-0.03}>
          <meshBasicMaterial color="#ff7a1a" transparent opacity={0.4} depthWrite={false} />
        </mesh>
        <mesh geometry={boltGeo}>
          <meshBasicMaterial color={BOLT_HOT} />
        </mesh>
        <Glows glows={BOLT_GLOW} />
      </group>
      <group ref={piece} visible={false}>
        {art ? (
          <mesh geometry={pieceGeo} position-z={-0.07}>
            <shaderMaterial uniforms={uniforms.piece} vertexShader={pieceVertexShader} fragmentShader={trivisionFragmentShader} fog />
          </mesh>
        ) : null}
      </group>
      <group ref={car} visible={false}>
        <primitive object={telpark} scale={0.75} />
      </group>
      {/* The street: a multi-lantern lamp each side, the traffic light at the kerb. */}
      <Lamps bases={LAMPS} arm={-1.4} color="#ffd9a0" />
      <mesh position={[4.1, 1.8, 2.6]}>
        <boxGeometry args={[0.14, 3.6, 0.14]} />
        <meshStandardMaterial color={palette.asphalt} />
      </mesh>
      <mesh position={[4.1, 3.5, 2.6]}>
        <boxGeometry args={[0.36, 1.3, 0.36]} />
        <meshStandardMaterial color="#141020" roughness={0.6} />
      </mesh>
      <Glows glows={signalGlows} handle={signal} />
    </group>
  );
}

/** The piece is one plain mesh: the varyings the trivision's fragment shader reads, its own UVs as they are. */
const pieceVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/** The block is one mesh, not instanced: the board vertex shader as it is. */
const blockVertexShader = instancedBoardVertexShader.replace("modelMatrix * instanceMatrix * vec4", "modelMatrix * vec4").replace(
  "mat3(modelMatrix) * mat3(instanceMatrix) * normal",
  "mat3(modelMatrix) * normal",
);

useGLTF.preload(TELPARK_CAR);

export const cloud: NightSet = {
  Set: CloudSet,
  board: [
    [BOARD.x - BOARD.w / 2 - 0.3, BOARD.y + BOARD.h / 2 + 0.4, BOARD.z + 0.5],
    [BOARD.x + BOARD.w / 2 + 0.3, BOARD.y + BOARD.h / 2 + 0.4, BOARD.z + 0.5],
    [BOARD.x + BOARD.w / 2 + 0.3, BOARD.y - BOARD.h / 2 - 1.6, BOARD.z + 0.5],
    [BOARD.x - BOARD.w / 2 - 0.3, BOARD.y - BOARD.h / 2 - 1.6, BOARD.z + 0.5],
  ],
  boardNormal: [0, 0, 1],
  maxBack: 34,
  lights: [
    { position: [1, 10.5, -8], color: palette.sodiumNight, intensity: 120, distance: 40 },
    { position: [-3.6, 4.6, -2.5], color: "#ff7ac0", intensity: 60, distance: 30 },
  ],
  streaks: [
    { position: [-14, 7.3, 1.2], color: "#ffd9a0", level: 0.8 },
    { position: [12, 7.3, 1.2], color: "#ffd9a0", level: 0.8 },
    { position: [-4, 7.9, 0.2], color: "#ff2d95", level: 0.9 },
    { position: [-9, 1.9, 0.2], color: "#ffbf7a", level: 0.6 },
    { position: [-3.6, 4.45, 0.2], color: "#ffd8ee", level: 0.7 },
    { position: [4.1, 3.9, 2.6], color: "#ff3a5c", level: 0.5 },
    { position: [1, 11, -9.5], color: palette.sodiumNight, level: 0.6 },
  ],
  kerbs: { near: 1.9, far: -5.4 },
};
