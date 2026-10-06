"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  type CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  Quaternion,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { palette } from "@/design/tokens";
import { fonts, loadFaces, toTexture } from "../artCanvas";
import { LENS, type Vec3 } from "../frame";
import { night } from "../nightState";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { NightPalms, type NightPalm } from "../parts/NightPalms";
import { type Glow, type GlowHandle, Glows } from "../parts/Glows";
import { pasteUpFragmentShader, pasteUpVertexShader, wallFragmentShader, wallVertexShader } from "../shaders/pasteUp";
import { beatP, keyAt } from "../timelineKeys";
import { LOGIXS_ATLAS, paintLogixs, RECTS, TREE } from "./art/logixs";
import type { NightSet, SetProps } from "./types";

/**
 * Stop 4, Logixs (2025-2026): a brick wall of torn wheat-paste posters,
 * filmed frontally like a drive past a wall of bills. Full stack is the
 * whole wall: the paper, the paste and what is under it. Bytetravel's
 * travel posters and Retech's day-glo bills, the snipe over them, older
 * bills from the earlier stops showing through the tears. During the first
 * card a poster's corner flies off as a paper plane; during the second the
 * light tree's ambers count down, and it goes green with the street light.
 */

const WALL_Z = -6.4;
const BRICK_TOP = 4.2;
const LANTERN: Vec3 = [-3, 4.6, WALL_Z + 0.9];
const SIGNAL: Vec3 = [9.6, 3.1, -5.9];

type Poster = { x: number; y: number; w: number; h: number; rect: readonly number[]; layer: number; lift: number };

const PW = 1.8;
const PH = 2.6;
const POSTERS: Poster[] = [
  { x: 6.0, y: 2.0, w: PW, h: PH, rect: RECTS.fragments, layer: 0, lift: 0 },
  { x: -8.4, y: 2.0, w: PW, h: PH, rect: RECTS.bytetravel, layer: 1, lift: 0.4 },
  { x: -6.5, y: 2.0, w: PW, h: PH, rect: RECTS.bytetravelCut, layer: 1, lift: 0 },
  { x: -4.6, y: 2.0, w: PW, h: PH, rect: RECTS.bytetravel, layer: 1, lift: 0 },
  { x: -1.6, y: 2.0, w: PW, h: PH, rect: RECTS.retech, layer: 1, lift: 0 },
  { x: 0.3, y: 2.0, w: PW, h: PH, rect: RECTS.retech, layer: 1, lift: 0.5 },
  { x: 2.2, y: 2.0, w: PW, h: PH, rect: RECTS.retechTorn, layer: 1, lift: 0 },
  { x: 4.6, y: 2.05, w: PW, h: PH, rect: RECTS.retechTorn, layer: 2, lift: 0.3 },
  { x: -2.6, y: 3.55, w: 13.4, h: 0.42, rect: RECTS.snipe, layer: 3, lift: 0 },
  { x: -1.0, y: 4.05, w: 13, h: 0.44, rect: RECTS.ban, layer: 0, lift: 0 },
];
/** The Bytetravel poster whose corner becomes the plane, and the Retech bill whose tree counts down. */
const PLANE_POSTER = POSTERS[2];
const TREE_POSTER = POSTERS[5];

function uvRect(rect: readonly number[]): [number, number, number, number] {
  return [rect[0] / LOGIXS_ATLAS.w, 1 - (rect[1] + rect[3]) / LOGIXS_ATLAS.h, (rect[0] + rect[2]) / LOGIXS_ATLAS.w, 1 - rect[1] / LOGIXS_ATLAS.h];
}

/** A folded paper plane, four triangles, nose along +x. */
function planeGeometry(): BufferGeometry {
  const v = [
    [0.28, 0, 0],
    [-0.2, 0.02, 0],
    [-0.22, 0.0, 0.18],
    [0.28, 0, 0],
    [-0.22, 0.0, -0.18],
    [-0.2, 0.02, 0],
    [0.28, 0, 0],
    [-0.2, 0.02, 0],
    [-0.2, -0.07, 0.01],
    [0.28, 0, 0],
    [-0.2, -0.07, -0.01],
    [-0.2, 0.02, 0],
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(v.flat()), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The island's palms along the kerb: every stop is the same island at night. */
const LOGIXS_PALMS: NightPalm[] = [
  { position: [-13.5, 0, -4.6] as Vec3, rotation: 0.7, scale: 0.9, variant: 1 },
  { position: [11.5, 0, -4.6] as Vec3, rotation: 2.4, scale: 0.95, variant: 0 },
  { position: [-20, 0, 4.8] as Vec3, rotation: 1.6, scale: 1.05, variant: 3 },
  { position: [16, 0, 5.2] as Vec3, rotation: 0.2, scale: 1.0, variant: 2 },
];

function LogixsSet({ work, tier, timeline, index }: SetProps) {
  const high = tier === "high";
  const board = work.stops.logixs.board;
  const [atlas, setAtlas] = useState<CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: CanvasTexture | null = null;
    loadFaces([`800 90px ${fonts.display()}`, `400 60px ${fonts.deco()}`, `400 100px ${fonts.condensed()}`, `700 30px ${fonts.serif()}`, `400 40px ${fonts.script()}`, `700 30px ${fonts.mono()}`]).then(() => {
      if (cancelled) return;
      made = toTexture(paintLogixs(board), 8);
      setAtlas(made);
    });
    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, [board]);

  const light = useMemo(
    () => ({
      uAmbient: { value: new Color("#3a2c58") },
      uLanternPos: { value: new Vector3(...LANTERN) },
      uLanternColor: { value: new Color(palette.sodiumNight).multiplyScalar(0.55) },
      uSignalPos: { value: new Vector3(SIGNAL[0], SIGNAL[1], WALL_Z + 1.5) },
      uSignalColor: { value: new Color("#ff3a5c").multiplyScalar(0.6) },
      uSweep: { value: -100 },
      uSweepLevel: { value: 0 },
    }),
    [],
  );
  const uniforms = useMemo(() => {
    const fog = () => UniformsUtils.clone(UniformsLib.fog);
    return {
      wall: { ...fog(), ...light, uBrickTop: { value: BRICK_TOP } },
      posters: { ...fog(), ...light, uMap: { value: atlas }, uTime: { value: 0 }, uLiftExtra: { value: 0 } },
    };
  }, [light, atlas]);

  const posters = useRef<InstancedMesh>(null);
  const attributes = useMemo(() => {
    const rects = new InstancedBufferAttribute(new Float32Array(POSTERS.flatMap((p) => uvRect(p.rect))), 4);
    const lifts = new InstancedBufferAttribute(new Float32Array(POSTERS.map((p) => (high || p === POSTERS[5] ? p.lift : 0))), 1);
    const seeds = new InstancedBufferAttribute(new Float32Array(POSTERS.map((_, i) => (i * 0.37) % 1)), 1);
    return { rects, lifts, seeds };
  }, [high]);

  useLayoutEffect(() => {
    const mesh = posters.current;
    if (!mesh) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    POSTERS.forEach((poster, i) => {
      m.compose(new Vector3(poster.x, poster.y, WALL_Z + 0.02 + poster.layer * 0.012), q, s.set(poster.w, poster.h, 1));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [atlas]);

  const balconies = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    for (const y of [5.6, 8.8, 12.0]) {
      for (const x of [-12, -6, 0, 6, 12]) {
        items.push({ p: [x, y, WALL_Z + 0.55], s: [2.6, 0.14, 1.1] });
        items.push({ p: [x, y + 0.55, WALL_Z + 1.08], s: [2.6, 0.04, 0.04] });
        for (let k = -1.2; k <= 1.21; k += 0.3) items.push({ p: [x + k, y + 0.3, WALL_Z + 1.08], s: [0.03, 0.5, 0.03] });
      }
    }
    return items;
  }, []);
  const windows = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    let k = 0;
    for (const y of [6.7, 9.9, 13.1]) {
      for (const x of [-12, -6, 0, 6, 12]) {
        const lit = (k * 7) % 5 < 2;
        items.push({ p: [x, y, WALL_Z + 0.02], s: [1.3, 1.9, 1], color: lit ? "#d98a55" : "#1f1634" });
        k += 1;
      }
    }
    return items;
  }, []);

  // The light tree on its bill: three ambers and GO; then the crossing light, red and green.
  const treeGlows = useMemo<Glow[]>(
    () => [
      ...TREE.ys.map((fy, i) => ({
        position: [TREE_POSTER.x - TREE_POSTER.w / 2 + TREE.x * TREE_POSTER.w, TREE_POSTER.y + TREE_POSTER.h / 2 - fy * TREE_POSTER.h, WALL_Z + 0.12] as Vec3,
        size: 0.42,
        color: i === 3 ? "#4dffb0" : "#ffb347",
        intensity: 2.5,
        level: 0,
      })),
      { position: [SIGNAL[0], SIGNAL[1] + 0.35, SIGNAL[2]], size: 0.55, color: "#ff3a5c", intensity: 2.4, level: 1 },
      { position: [SIGNAL[0], SIGNAL[1] - 0.1, SIGNAL[2]], size: 0.55, color: "#4dffb0", intensity: 2.4, level: 0 },
      { position: LANTERN, size: 1.3, color: palette.sodiumNight, intensity: 2.6 },
      { position: [LANTERN[0], LANTERN[1] - 0.4, LANTERN[2]], size: 5, color: palette.sodiumNight, intensity: 0.2 },
      { position: [26, 6, -40], size: 4, color: "#ff2d95", intensity: 1.2 },
    ],
    [],
  );
  const glows = useRef<GlowHandle | null>(null);
  const plane = useRef<Mesh>(null);
  const planeGeo = useMemo(() => planeGeometry(), []);
  useEffect(() => () => planeGeo.dispose(), [planeGeo]);
  const curve = useMemo(() => {
    const cx = PLANE_POSTER.x + PLANE_POSTER.w / 2 - 0.2;
    const cy = PLANE_POSTER.y + PLANE_POSTER.h / 2 - 0.2;
    return new CatmullRomCurve3([
      new Vector3(cx, cy, WALL_Z + 0.08),
      new Vector3(cx + 0.8, cy + 1.2, WALL_Z + 0.9),
      new Vector3(LANTERN[0] + 1.8, LANTERN[1] + 1.4, WALL_Z + 2.2),
      new Vector3(2.5, 3.6, 2.5),
      new Vector3(9, 3.2, 5.5),
    ]);
  }, []);
  const beats = useMemo(
    () => ({
      card0: [beatP(timeline, "logixs.card0"), beatP(timeline, "logixs.card0", 1)],
      card1: [beatP(timeline, "logixs.card1"), beatP(timeline, "logixs.card1", 1)],
      signal: beatP(timeline, "logixs.signal"),
    }),
    [timeline],
  );
  const armedAt = useRef(-1);
  const tangent = useMemo(() => new Vector3(), []);

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame((state) => {
    if (night.stop !== index) return;
    const t = state.clock.elapsedTime;
    const p = night.p;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    uniforms.posters.uTime.value = t;
    uniforms.posters.uLiftExtra.value = 0.35 * night.armed;
    if (night.armTarget > 0 && armedAt.current < 0) armedAt.current = t;
    if (night.armTarget === 0) armedAt.current = -1;
    // Armed: a passing car's headlights rake the run under the pointer.
    const since = armedAt.current >= 0 ? t - armedAt.current : -1;
    const sweepFrom = Number.isFinite(night.pointerU) ? -9.5 + night.pointerU * 13 - 3 : -12;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    light.uSweep.value = since >= 0 ? sweepFrom + ((since * 9) % 14) : -100;
    light.uSweepLevel.value = 0.9 * night.armed;
    // The plane flies with card 0, 1:1 with the scroll, and leaves frame right.
    const k = Math.min(1, Math.max(0, (p - beats.card0[0]) / Math.max(1e-6, beats.card0[1] - beats.card0[0])));
    if (plane.current) {
      plane.current.visible = k > 0.02 && k < 0.999;
      const e = k * k * (3 - 2 * k);
      curve.getPointAt(e, plane.current.position);
      curve.getTangentAt(e, tangent);
      plane.current.rotation.set(0, Math.atan2(-tangent.z, tangent.x), Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)) + Math.sin(e * 9) * 0.25);
    }
    // The tree counts down through card 1 (one amber per third) and goes green with the street light.
    const c = (p - beats.card1[0]) / Math.max(1e-6, beats.card1[1] - beats.card1[0]);
    const green = p >= beats.signal;
    for (let i = 0; i < 3; i += 1) glows.current?.setLevel(i, !green && c >= i / 3 && c <= 1.05 ? 1 : 0);
    glows.current?.setLevel(3, green ? 1 : 0);
    glows.current?.setLevel(4, green ? 0 : 1);
    glows.current?.setLevel(5, green ? 1 : 0);
    light.uSignalColor.value.set(green ? "#4dffb0" : "#ff3a5c").multiplyScalar(0.6);
  });

  return (
    <group>
      {/* The wall: brick to the first floor, plaster above, balconies and windows. */}
      <mesh position={[0, 7.5, WALL_Z]}>
        <planeGeometry args={[60, 15]} />
        <shaderMaterial uniforms={uniforms.wall} vertexShader={wallVertexShader} fragmentShader={wallFragmentShader} fog />
      </mesh>
      <Boxes items={balconies}>
        <meshStandardMaterial color="#1d1630" roughness={0.6} metalness={0.4} />
      </Boxes>
      <Boxes items={windows} geometry={<planeGeometry args={[1, 1]} />}>
        <meshBasicMaterial toneMapped={false} />
      </Boxes>
      {atlas ? (
        <instancedMesh ref={posters} args={[undefined, undefined, POSTERS.length]} frustumCulled={false}>
          <planeGeometry args={[1, 1, high ? 6 : 4, high ? 8 : 6]}>
            <primitive object={attributes.rects} attach="attributes-aUvRect" />
            <primitive object={attributes.lifts} attach="attributes-aLift" />
            <primitive object={attributes.seeds} attach="attributes-aSeed" />
          </planeGeometry>
          <shaderMaterial uniforms={uniforms.posters} vertexShader={pasteUpVertexShader} fragmentShader={pasteUpFragmentShader} side={DoubleSide} fog />
        </instancedMesh>
      ) : null}
      {/* The lantern on its bracket, the crossing light at the corner. */}
      <mesh position={[LANTERN[0], LANTERN[1] + 0.35, (LANTERN[2] + WALL_Z) / 2]}>
        <boxGeometry args={[0.08, 0.08, LANTERN[2] - WALL_Z]} />
        <meshStandardMaterial color="#1d1630" />
      </mesh>
      <mesh position={[SIGNAL[0], SIGNAL[1] / 2 - 0.2, SIGNAL[2]]}>
        <boxGeometry args={[0.14, SIGNAL[1] - 0.4, 0.14]} />
        <meshStandardMaterial color={palette.asphalt} />
      </mesh>
      <mesh position={[SIGNAL[0], SIGNAL[1] + 0.12, SIGNAL[2] - 0.1]}>
        <boxGeometry args={[0.4, 1.0, 0.25]} />
        <meshStandardMaterial color="#141020" />
      </mesh>
      <NightPalms palms={high ? LOGIXS_PALMS : LOGIXS_PALMS.slice(0, 2)} />
      <Glows glows={treeGlows} handle={glows} />
      <mesh ref={plane} geometry={planeGeo} visible={false}>
        <meshStandardMaterial color="#d9c6ff" emissive="#4a2a74" side={DoubleSide} roughness={0.7} />
      </mesh>
      {/* The pavement under the wall. */}
      <mesh position={[0, 0.1, (WALL_Z - 5.4) / 2]}>
        <boxGeometry args={[60, 0.2, Math.abs(WALL_Z + 5.4)]} />
        <meshStandardMaterial color="#33284a" roughness={0.85} />
      </mesh>
    </group>
  );
}

export const logixs: NightSet = {
  Set: LogixsSet,
  board: [
    [-9.5, 4.4, WALL_Z + 0.05],
    [7.0, 4.4, WALL_Z + 0.05],
    [7.0, 0.6, WALL_Z + 0.05],
    [-9.5, 0.6, WALL_Z + 0.05],
  ],
  boardNormal: [0, 0, 1],
  shots: (timeline) => [
    // The car stays in the foreground while the camera tracks the wall past it.
    keyAt(timeline, "logixs.open", 0, { position: [0.5, 1.6, 7.5], look: [-5.5, 2.3, -6], fov: LENS.mm28 }),
    keyAt(timeline, "logixs.card0", 0.5, { position: [1.5, 1.6, 7], look: [-4, 2.3, -6], fov: LENS.mm28 }),
    keyAt(timeline, "logixs.card1", 0.5, { position: [0.3, 1.6, 7], look: [0.3, 2.3, -6], fov: LENS.mm40 }),
    keyAt(timeline, "logixs.signal", 1, { position: [4.8, 1.8, 10], look: [4.8, 2.4, -6], fov: LENS.mm28 }),
  ],
  // On a phone, the poster in front of the camera (and its neighbour's edge), not the whole run.
  subject: (pose, _p, car) => [
    [pose.look[0] - 1.7, 3.5, WALL_Z],
    [pose.look[0] + 1.7, 3.5, WALL_Z],
    [pose.look[0] + 1.7, 0.7, WALL_Z],
    [pose.look[0] - 1.7, 0.7, WALL_Z],
    ...car,
  ],
  maxBack: 12,
  lights: [
    { position: [LANTERN[0], LANTERN[1], LANTERN[2] + 0.4], color: palette.sodiumNight, intensity: 70, distance: 25 },
    { position: [SIGNAL[0], SIGNAL[1], SIGNAL[2] + 1], color: "#ff3a5c", intensity: 25, distance: 12 },
  ],
  streaks: [
    { position: LANTERN, color: palette.sodiumNight, level: 1.0 },
    { position: SIGNAL, color: "#ff3a5c", level: 0.8 },
    { position: [26, 6, -40], color: "#ff2d95", level: 0.6 },
  ],
  kerbs: { near: 1.9, far: -5.4 },
};
