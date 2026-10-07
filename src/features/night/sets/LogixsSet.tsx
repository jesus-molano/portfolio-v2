"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
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
  type MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  type ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import { palette } from "@/design/tokens";
import { fonts, loadFaces, makeCanvas, toTexture } from "../artCanvas";
import type { Vec3 } from "../frame";
import { night } from "../nightState";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { NightPalms, type NightPalm } from "../parts/NightPalms";
import { type Pane, Windows } from "../parts/Windows";
import { type Glow, type GlowHandle, Glows } from "../parts/Glows";
import { searchBeamFragmentShader, searchBeamVertexShader } from "../shaders/beam";
import { pasteUpFragmentShader, pasteUpVertexShader, wallFragmentShader, wallVertexShader } from "../shaders/pasteUp";
import { litBySearchlight } from "../shaders/spotLight";
import { type BoardUv, newSearchlight, SEARCHLIGHT, type SpotArea, spotBeam, stepSearchlight } from "../searchlight";
import { beatP } from "../timelineKeys";
import { COLLAGE, LOGIXS_ATLAS, paintLogixs, RECTS } from "./art/logixs";
import { PANE } from "./art/windows";
import type { NightSet, SetProps } from "./types";

/**
 * Stop 4, Logixs (2025-2026): a brick wall of wheat-paste bills, filmed
 * frontally like a drive past a wall of bills. Full stack is the whole
 * wall: the paper, the paste and what is under it. Years of scraped and
 * torn bills underneath; this season's run on top: Bytetravel's travel
 * poster and its three extras, Retech's official portal, the snipe with
 * the role and the years, and the street's painted ban above it all.
 * During the first card the corner of the lounge bill folds off as a paper
 * plane; during the second the newest bill, the FULL STACK gig, is pasted
 * up from the top, wet, by a roll of paper coming down the wall; the
 * crossing light at the corner turns green as the car leaves. Armed, a
 * police helicopter's searchlight hunts the bill sticker along the wall
 * under the ban, following the pointer (searchlight.ts).
 */

const WALL_Z = -6.4;
const BRICK_TOP = 4.2;
// Over the ban (y 4.38 to 4.98), between two balconies: its glare never sits on a word, its pool falls on the run.
const LANTERN: Vec3 = [-3, 5.65, WALL_Z + 0.9];
const SIGNAL: Vec3 = [9.6, 3.1, -5.9];
/** The crossing light's lenses (red, amber, green) above and below the head's centre, and their face toward the street. */
const LENS_Y = [0.47, 0.12, -0.23] as const;
const LENS_FRONT = SIGNAL[2] + 0.11;
const LENS_OFF = ["#3a1820", "#3a2a14", "#14301f"] as const;
const LENS_ON = [new Color("#ff3a5c").multiplyScalar(2.2), new Color("#4dffb0").multiplyScalar(2.2)] as const;
/** The board (the hotspot's quad) on the wall, metres: the searchlight's pointer and tap land on it. */
const BOARD: SpotArea = { x0: -9.5, x1: 7.0, y0: 0.6, y1: 4.4 };
/**
 * The searchlight on the wall at its full level (linear light): the
 * brightest thing in the frame, its core over the bloom's threshold even on
 * dark brick, the lantern's pool a glow beside it. And its shaft in the haze.
 */
const SPOT_LIGHT = new Color(palette.searchlight).multiplyScalar(3.9);
const SPOT_HAZE = new Color(palette.searchlight).multiplyScalar(0.9);

type Poster = { x: number; y: number; w: number; h: number; rect: readonly number[]; layer: number; lift: number; turn?: number; fresh?: boolean };

const C = COLLAGE;
const POSTERS: Poster[] = [
  { x: (C.x0 + C.x1) / 2, y: (C.y0 + C.y1) / 2, w: C.x1 - C.x0, h: C.y1 - C.y0, rect: RECTS.collage, layer: 0, lift: 0 },
  { x: -2.0, y: 4.68, w: 7.2, h: 0.6, rect: RECTS.ban, layer: 0, lift: 0 },
  { x: -8.9, y: 2.75, w: 1.04, h: 1.41, rect: RECTS.visa, layer: 1, lift: 0, turn: 1.2 },
  { x: -7.78, y: 2.8, w: 1.04, h: 1.41, rect: RECTS.esim, layer: 1, lift: 0.25, turn: -0.8 },
  { x: -6.66, y: 2.73, w: 1.04, h: 1.41, rect: RECTS.lounge, layer: 1, lift: 0, turn: 0.6 },
  { x: -4.45, y: 2.2, w: 2.3, h: 2.95, rect: RECTS.bytetravel, layer: 1, lift: 0.35, turn: -0.5 },
  { x: 0.3, y: 2.22, w: 2.2, h: 2.94, rect: RECTS.gig, layer: 1, lift: 0, turn: 0.4, fresh: true },
  { x: 4.7, y: 2.2, w: 2.3, h: 2.95, rect: RECTS.retech, layer: 1, lift: 0.3, turn: 0.7 },
  // Across the Bytetravel bill and the gig, the two the lines are about: whole in a phone's frame too.
  { x: -2.0, y: 3.98, w: 7.6, h: 0.35, rect: RECTS.snipe, layer: 2, lift: 0, turn: -0.25 },
  { x: -6.66, y: 2.73, w: 1.04, h: 1.41, rect: RECTS.corner, layer: 2, lift: 0, turn: 0.6 },
];
/** A poster's band from `top` to `bottom` (shares of its height from its top edge), on the wall. */
function band(poster: Poster, top: number, bottom: number): Vec3[] {
  const y1 = poster.y + poster.h / 2 - top * poster.h;
  const y0 = poster.y + poster.h / 2 - bottom * poster.h;
  return [
    [poster.x - poster.w / 2, y1, WALL_Z],
    [poster.x + poster.w / 2, y1, WALL_Z],
    [poster.x + poster.w / 2, y0, WALL_Z],
    [poster.x - poster.w / 2, y0, WALL_Z],
  ];
}

/**
 * What the camera must frame whole at Logixs (direction.test.ts): the snipe
 * with the role and the years, the ban, and the headline of each bill a
 * line is about (Bytetravel for the first, the gig for the second).
 */
export const LOGIXS_FRAMING = {
  snipe: band(POSTERS[8], 0, 1),
  ban: band(POSTERS[1], 0, 1),
  bytetravel: band(POSTERS[5], 0, 0.22),
  gig: band(POSTERS[6], 0, 0.3),
  retech: band(POSTERS[7], 0, 0.22),
};

/** The lounge bill whose corner becomes the plane; the flap that covers its cut until then; the fresh gig bill. */
const PLANE_POSTER = POSTERS[4];
const FLAP_INDEX = POSTERS.length - 1;
const GIG = POSTERS[6];

/** Sets a scalar uniform on a material that exists, the frame's way into a shader. */
function setUniform(material: ShaderMaterial | null, name: string, value: number): void {
  const uniform = material?.uniforms[name];
  if (uniform) uniform.value = value;
}

function uvRect(rect: readonly number[]): [number, number, number, number] {
  return [rect[0] / LOGIXS_ATLAS.w, 1 - (rect[1] + rect[3]) / LOGIXS_ATLAS.h, (rect[0] + rect[2]) / LOGIXS_ATLAS.w, 1 - rect[1] / LOGIXS_ATLAS.h];
}

function posterMatrix(poster: Poster, m: Matrix4, shown = true): Matrix4 {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), ((poster.turn ?? 0) * Math.PI) / 180);
  return m.compose(new Vector3(poster.x, poster.y, WALL_Z + 0.02 + poster.layer * 0.012), q, shown ? new Vector3(poster.w, poster.h, 1) : new Vector3(1e-4, 1e-4, 1));
}

/** The low tier keeps three quarters of the atlas: a phone never shows a bill wider than about 600 device pixels. */
function scaled(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale === 1) return canvas;
  const [small, ctx] = makeCanvas(Math.round(canvas.width * scale), Math.round(canvas.height * scale));
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return small;
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
  { position: [13.2, 0, -4.6] as Vec3, rotation: 2.4, scale: 0.95, variant: 0 },
  { position: [-20, 0, 4.8] as Vec3, rotation: 1.6, scale: 1.05, variant: 3 },
  { position: [16, 0, 5.2] as Vec3, rotation: 0.2, scale: 1.0, variant: 2 },
];

/** The flats over the wall: three floors of windows, the rooms behind them, never anyone at them. */
const ROOMS = [PANE.kitchen, PANE.dark, PANE.roomTv, PANE.curtained, PANE.dark, PANE.records, PANE.rollerBlind, PANE.dark, PANE.roomRight, PANE.dark, PANE.study, PANE.roomPink, PANE.dark, PANE.reader, PANE.dark];

/**
 * The run the lines are about, for a phone's fit: the snipe and the ban over
 * the Bytetravel bill and the gig (art/logixs.ts SNIPE, BAN), down to the
 * bills' feet.
 */
const RUN: Vec3[] = [
  [-6.0, 5.05, WALL_Z],
  [2.0, 5.05, WALL_Z],
  [2.0, 0.65, WALL_Z],
  [-6.0, 0.65, WALL_Z],
];

/** The closed shop beside the wall: a roller shutter's slats, its box, the plinth's stone. */
const SHUTTER = { x: 10.6, w: 2.8, h: 2.7 } as const;

function LogixsSet({ work, tier, timeline, index }: SetProps) {
  const high = tier === "high";
  const board = work.stops.logixs.board;
  const [atlas, setAtlas] = useState<CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: CanvasTexture | null = null;
    loadFaces([
      `800 90px ${fonts.display()}`,
      `400 60px ${fonts.deco()}`,
      `400 100px ${fonts.condensed()}`,
      `700 30px ${fonts.serif()}`,
      `italic 700 30px ${fonts.serif()}`,
      `400 60px ${fonts.block()}`,
      `700 30px ${fonts.mono()}`,
    ]).then(() => {
      if (cancelled) return;
      made = toTexture(scaled(paintLogixs(board), high ? 1 : 0.75), 8);
      setAtlas(made);
    });
    return () => {
      cancelled = true;
      made?.dispose();
    };
  }, [board, high]);

  const light = useMemo(
    () => ({
      uAmbient: { value: new Color("#3a2c58") },
      uLanternPos: { value: new Vector3(...LANTERN) },
      uLanternColor: { value: new Color(palette.sodiumNight).multiplyScalar(0.55) },
      uSignalPos: { value: new Vector3(SIGNAL[0], SIGNAL[1], WALL_Z + 1.5) },
      uSignalColor: { value: new Color("#ff3a5c").multiplyScalar(0.6) },
      // The searchlight: black until armed, the same program either way (no recompile when it comes on).
      uSpotFrom: { value: new Vector3(0, 20, 10) },
      uSpotAxis: { value: new Vector3(0, 0, -1) },
      uSpotTan: { value: 0.05 },
      uSpotColor: { value: new Color(0, 0, 0) },
    }),
    [],
  );
  const uniforms = useMemo(() => {
    const fog = () => UniformsUtils.clone(UniformsLib.fog);
    return {
      wall: { ...fog(), ...light, uBrickTop: { value: BRICK_TOP } },
      posters: { ...fog(), ...light, uMap: { value: atlas }, uTime: { value: 0 }, uLiftExtra: { value: 0 }, uReveal: { value: 0 }, uWet: { value: 0 } },
      haze: { ...fog(), uColor: { value: SPOT_HAZE.clone() }, uLevel: { value: 0 }, uTime: { value: 0 } },
    };
  }, [light, atlas]);
  // R3F copies a uniform object into the material, so the frame writes through the materials themselves.
  const wallMaterial = useRef<ShaderMaterial>(null);
  // The set's standard surfaces in the searchlight's pool take it too (its uniforms are `light`'s own objects):
  // the cornice, the plinth and the balconies, the pavement under the bills, the paste's roll.
  const lit = useMemo(
    () => ({
      boxes: litBySearchlight(new MeshStandardMaterial({ color: "#2a2140", roughness: 0.55, metalness: 0.45 }), light),
      pavement: litBySearchlight(new MeshStandardMaterial({ color: "#33284a", roughness: 0.85 }), light),
      roll: litBySearchlight(new MeshStandardMaterial({ color: "#e9d9b4", roughness: 0.9 }), light),
    }),
    [light],
  );
  useEffect(() => () => Object.values(lit).forEach((material) => material.dispose()), [lit]);
  const posterMaterial = useRef<ShaderMaterial>(null);

  const posters = useRef<InstancedMesh>(null);
  const attributes = useMemo(() => {
    const rects = new InstancedBufferAttribute(new Float32Array(POSTERS.flatMap((p) => uvRect(p.rect))), 4);
    const lifts = new InstancedBufferAttribute(new Float32Array(POSTERS.map((p) => (high ? p.lift : 0))), 1);
    const seeds = new InstancedBufferAttribute(new Float32Array(POSTERS.map((_, i) => (i * 0.37) % 1)), 1);
    const fresh = new InstancedBufferAttribute(new Float32Array(POSTERS.map((p) => (p.fresh ? 1 : 0))), 1);
    return { rects, lifts, seeds, fresh };
  }, [high]);

  useLayoutEffect(() => {
    const mesh = posters.current;
    if (!mesh) return;
    const m = new Matrix4();
    POSTERS.forEach((poster, i) => mesh.setMatrixAt(i, posterMatrix(poster, m)));
    mesh.instanceMatrix.needsUpdate = true;
  }, [atlas]);

  const balconies = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    for (const y of [5.6, 8.8, 12.0]) {
      for (const x of [-12, -6, 0, 6, 12]) {
        items.push({ p: [x, y, WALL_Z + 0.55], s: [2.6, 0.14, 1.1] });
        items.push({ p: [x, y + 0.95, WALL_Z + 1.08], s: [2.6, 0.05, 0.05] });
        for (let k = -1.25; k <= 1.26; k += 0.125) items.push({ p: [x + k, y + 0.5, WALL_Z + 1.08], s: [0.025, 0.9, 0.025] });
        // The window's lintel and sill, in the plaster.
        items.push({ p: [x, y + 2.15, WALL_Z + 0.05], s: [1.7, 0.16, 0.1] });
      }
    }
    // The cornice over the brick, the plinth under it, two downpipes.
    items.push({ p: [0, BRICK_TOP + 0.06, WALL_Z + 0.08], s: [60, 0.14, 0.16] });
    items.push({ p: [0, 0.2, WALL_Z + 0.04], s: [60, 0.4, 0.08] });
    for (const x of [-11.3, 8.95]) {
      items.push({ p: [x, 7.5, WALL_Z + 0.16], s: [0.11, 15, 0.11] });
      for (let y = 1.2; y < 15; y += 2.4) items.push({ p: [x, y, WALL_Z + 0.12], s: [0.16, 0.05, 0.16] });
    }
    // The shutter's box over the shop, and its slats.
    items.push({ p: [SHUTTER.x, SHUTTER.h + 0.62, WALL_Z + 0.16], s: [SHUTTER.w + 0.3, 0.36, 0.3] });
    for (let y = 0.48; y < SHUTTER.h + 0.42; y += 0.085) items.push({ p: [SHUTTER.x, y, WALL_Z + 0.08], s: [SHUTTER.w, 0.06, 0.04] });
    return items;
  }, []);
  const rooms = useMemo<Pane[]>(() => {
    const panes: Pane[] = [];
    let k = 0;
    for (const y of [6.7, 9.9, 13.1]) {
      for (const x of [-12, -6, 0, 6, 12]) {
        panes.push({ p: [x, y, WALL_Z + 0.03], s: [1.4, 2.0], cell: ROOMS[k % ROOMS.length], flip: k % 3 === 1, gain: k % 4 === 2 ? 0.6 : 1 });
        k += 1;
      }
    }
    return panes;
  }, []);

  // The crossing light at the corner, red and green; the lantern and its pool; a pink sign down the street.
  const glowList = useMemo<Glow[]>(
    () => [
      { position: [SIGNAL[0], SIGNAL[1] + LENS_Y[0], LENS_FRONT + 0.12], size: 0.6, color: "#ff3a5c", intensity: 2.4, level: 1 },
      { position: [SIGNAL[0], SIGNAL[1] + LENS_Y[2], LENS_FRONT + 0.12], size: 0.6, color: "#4dffb0", intensity: 2.4, level: 0 },
      { position: LANTERN, size: 1.3, color: palette.sodiumNight, intensity: 2.6 },
      { position: [LANTERN[0], LANTERN[1] - 0.4, LANTERN[2]], size: 5, color: palette.sodiumNight, intensity: 0.2 },
      { position: [26, 6, -40], size: 4, color: "#ff2d95", intensity: 1.2 },
    ],
    [],
  );
  const glows = useRef<GlowHandle | null>(null);
  const lenses = useRef<(MeshBasicMaterial | null)[]>([null, null, null]);
  const plane = useRef<Mesh>(null);
  const roll = useRef<Mesh>(null);
  const planeGeo = useMemo(() => planeGeometry(), []);
  useEffect(() => () => planeGeo.dispose(), [planeGeo]);
  const curve = useMemo(() => {
    const cx = PLANE_POSTER.x + PLANE_POSTER.w / 2 - 0.16;
    const cy = PLANE_POSTER.y + PLANE_POSTER.h / 2 - 0.16;
    return new CatmullRomCurve3([
      new Vector3(cx, cy, WALL_Z + 0.08),
      new Vector3(cx + 0.8, cy + 1.0, WALL_Z + 0.9),
      new Vector3(LANTERN[0] + 1.8, LANTERN[1] + 1.2, WALL_Z + 2.2),
      new Vector3(2.5, 3.6, 2.5),
      new Vector3(9, 3.2, 5.5),
    ]);
  }, []);
  const beats = useMemo(
    () => ({
      card0: [beatP(timeline, "logixs.card0"), beatP(timeline, "logixs.card0", 1)],
      card1: [beatP(timeline, "logixs.card1"), beatP(timeline, "logixs.card1", 1)],
      signal: [beatP(timeline, "logixs.signal"), beatP(timeline, "logixs.signal", 1)],
    }),
    [timeline],
  );
  const searchlightRef = useRef(newSearchlight());
  const haze = useRef<Mesh>(null);
  const hazeMaterial = useRef<ShaderMaterial>(null);
  const spot = useMemo(() => ({ from: new Vector3(), to: new Vector3(), axis: new Vector3(), q: new Quaternion(), down: new Vector3(0, -1, 0) }), []);
  const flapShown = useRef(true);
  const tangent = useMemo(() => new Vector3(), []);
  const scratch = useMemo(() => new Matrix4(), []);

  useFrame((state, delta) => {
    const searchlight = searchlightRef.current;
    if (night.stop !== index) {
      // Another stop: the light is out, and comes up where it is aimed when this board is armed again.
      searchlight.on = false;
      searchlight.fade = 0;
      return;
    }
    const t = state.clock.elapsedTime;
    const p = night.p;
    setUniform(posterMaterial.current, "uTime", t);
    setUniform(posterMaterial.current, "uLiftExtra", 0.35 * night.armed);
    // Armed: a police helicopter's searchlight hunts along the wall, after the pointer, at a tap, or on its own.
    const pointer: BoardUv | null = Number.isFinite(night.pointerU) && Number.isFinite(night.pointerV) ? [night.pointerU, night.pointerV] : null;
    const tap: BoardUv | null = Number.isFinite(night.tapU) && Number.isFinite(night.tapV) ? [night.tapU, night.tapV] : null;
    stepSearchlight(searchlight, BOARD, { armed: night.armTarget > 0, pointer, tap, dt: delta });
    const beam = spotBeam(searchlight, WALL_Z);
    spot.from.set(...beam.from);
    spot.to.set(...beam.to);
    spot.axis.subVectors(spot.to, spot.from);
    const length = spot.axis.length();
    spot.axis.divideScalar(Math.max(length, 1e-3));
    for (const u of [light, wallMaterial.current?.uniforms, posterMaterial.current?.uniforms]) {
      if (!u?.uSpotFrom) continue;
      (u.uSpotFrom.value as Vector3).copy(spot.from);
      (u.uSpotAxis.value as Vector3).copy(spot.axis);
      u.uSpotTan.value = beam.tan;
      (u.uSpotColor.value as Color).copy(SPOT_LIGHT).multiplyScalar(beam.level);
    }
    // The shaft is always drawn (its program compiled with the set, never at arming); off, it discards.
    if (haze.current) {
      spot.q.setFromUnitVectors(spot.down, spot.axis);
      haze.current.quaternion.copy(spot.q);
      haze.current.position.copy(spot.from).lerp(spot.to, 0.5);
      haze.current.scale.set(SEARCHLIGHT.radius, length, SEARCHLIGHT.radius);
      setUniform(hazeMaterial.current, "uLevel", beam.level);
      setUniform(hazeMaterial.current, "uTime", searchlight.t);
    }
    // The plane folds off the lounge bill with card 0, 1:1 with the scroll, and leaves frame right.
    const k = Math.min(1, Math.max(0, (p - beats.card0[0]) / Math.max(1e-6, beats.card0[1] - beats.card0[0])));
    const flying = k > 0.02;
    if (plane.current) {
      plane.current.visible = flying && k < 0.999;
      const e = k * k * (3 - 2 * k);
      curve.getPointAt(e, plane.current.position);
      curve.getTangentAt(e, tangent);
      plane.current.rotation.set(0, Math.atan2(-tangent.z, tangent.x), Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)) + Math.sin(e * 9) * 0.25);
    }
    const mesh = posters.current;
    if (mesh && flapShown.current === flying) {
      flapShown.current = !flying;
      mesh.setMatrixAt(FLAP_INDEX, posterMatrix(POSTERS[FLAP_INDEX], scratch, !flying));
      mesh.instanceMatrix.needsUpdate = true;
    }
    // The gig bill goes up during card 1: laid from the top in its first 60 %, wet until the light changes.
    const c = (p - beats.card1[0]) / Math.max(1e-6, beats.card1[1] - beats.card1[0]);
    const r = Math.min(1, Math.max(0, c / 0.6));
    const reveal = r * r * (3 - 2 * r);
    setUniform(posterMaterial.current, "uReveal", reveal);
    const dryFrom = beats.card1[0] + 0.6 * (beats.card1[1] - beats.card1[0]);
    const dry = Math.min(1, Math.max(0, (p - dryFrom) / Math.max(1e-6, beats.signal[1] - dryFrom)));
    setUniform(posterMaterial.current, "uWet", reveal > 0 ? 1 - dry : 0);
    if (roll.current) {
      roll.current.visible = reveal > 0.001 && reveal < 0.999;
      roll.current.position.y = GIG.y + GIG.h / 2 - reveal * GIG.h;
      roll.current.rotation.x = -reveal * 18;
    }
    // The crossing light goes green as the car is let go.
    const green = p >= beats.signal[0];
    glows.current?.setLevel(0, green ? 0 : 1);
    glows.current?.setLevel(1, green ? 1 : 0);
    lenses.current[0]?.color.set(green ? LENS_OFF[0] : LENS_ON[0]);
    lenses.current[2]?.color.set(green ? LENS_ON[1] : LENS_OFF[2]);
    light.uSignalColor.value.set(green ? "#4dffb0" : "#ff3a5c").multiplyScalar(0.6);
  });

  return (
    <group>
      {/* The wall: brick to the first floor, plaster above, balconies and windows. */}
      <mesh position={[0, 7.5, WALL_Z]}>
        <planeGeometry args={[60, 15]} />
        <shaderMaterial ref={wallMaterial} uniforms={uniforms.wall} vertexShader={wallVertexShader} fragmentShader={wallFragmentShader} fog />
      </mesh>
      <Boxes items={balconies}>
        <primitive object={lit.boxes} attach="material" />
      </Boxes>
      <Windows panes={rooms} gain={1} />
      {atlas ? (
        <instancedMesh ref={posters} args={[undefined, undefined, POSTERS.length]} frustumCulled={false}>
          <planeGeometry args={[1, 1, high ? 6 : 4, high ? 24 : 16]}>
            <primitive object={attributes.rects} attach="attributes-aUvRect" />
            <primitive object={attributes.lifts} attach="attributes-aLift" />
            <primitive object={attributes.seeds} attach="attributes-aSeed" />
            <primitive object={attributes.fresh} attach="attributes-aFresh" />
          </planeGeometry>
          <shaderMaterial ref={posterMaterial} uniforms={uniforms.posters} vertexShader={pasteUpVertexShader} fragmentShader={pasteUpFragmentShader} side={DoubleSide} fog />
        </instancedMesh>
      ) : null}
      {/* The roll of the fresh bill, coming down the wall as it is pasted. */}
      <mesh ref={roll} position={[GIG.x, GIG.y, WALL_Z + 0.1]} rotation-z={Math.PI / 2} visible={false}>
        <cylinderGeometry args={[0.075, 0.075, GIG.w + 0.06, 18]} />
        <primitive object={lit.roll} attach="material" />
      </mesh>
      {/* The lantern on its bracket, the crossing light at the corner. */}
      <mesh position={[LANTERN[0], LANTERN[1] + 0.35, (LANTERN[2] + WALL_Z) / 2]}>
        <boxGeometry args={[0.08, 0.08, LANTERN[2] - WALL_Z]} />
        <meshStandardMaterial color="#1d1630" />
      </mesh>
      {/* The crossing light: a post, a head of three lenses toward the street, each under its visor. */}
      <mesh position={[SIGNAL[0], SIGNAL[1] / 2 - 0.2, SIGNAL[2] - 0.1]}>
        <boxGeometry args={[0.12, SIGNAL[1] - 0.4, 0.12]} />
        <meshStandardMaterial color={palette.asphalt} />
      </mesh>
      <mesh position={[SIGNAL[0], SIGNAL[1] + LENS_Y[1], SIGNAL[2] - 0.03]}>
        <boxGeometry args={[0.4, 1.16, 0.26]} />
        <meshStandardMaterial color="#17121f" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[SIGNAL[0], SIGNAL[1] + LENS_Y[1], SIGNAL[2] - 0.17]}>
        <boxGeometry args={[0.62, 1.42, 0.02]} />
        <meshStandardMaterial color="#0e0b14" roughness={0.6} />
      </mesh>
      {LENS_Y.map((dy, i) => (
        <group key={i} position={[SIGNAL[0], SIGNAL[1] + dy, LENS_FRONT]}>
          <mesh>
            <circleGeometry args={[0.13, 20]} />
            <meshBasicMaterial ref={(m) => void (lenses.current[i] = m)} color={LENS_OFF[i]} />
          </mesh>
          <mesh position={[0, 0.15, 0.1]}>
            <boxGeometry args={[0.32, 0.025, 0.2]} />
            <meshStandardMaterial color="#17121f" roughness={0.5} />
          </mesh>
        </group>
      ))}
      <NightPalms palms={high ? LOGIXS_PALMS : LOGIXS_PALMS.slice(0, 2)} />
      <Glows glows={glowList} handle={glows} />
      {/* The searchlight's shaft in the haze, down from the helicopter over the frame to its spot on the wall. */}
      <mesh ref={haze} renderOrder={4} frustumCulled={false}>
        <coneGeometry args={[1, 1, 24, 1, true]} />
        <shaderMaterial
          ref={hazeMaterial}
          uniforms={uniforms.haze}
          vertexShader={searchBeamVertexShader}
          fragmentShader={searchBeamFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          fog
        />
      </mesh>
      <mesh ref={plane} geometry={planeGeo} visible={false}>
        <meshStandardMaterial color="#f2c46a" emissive="#4a2a24" side={DoubleSide} roughness={0.7} />
      </mesh>
      {/* The pavement under the wall. */}
      <mesh position={[0, 0.1, (WALL_Z - 5.4) / 2]}>
        <boxGeometry args={[60, 0.2, Math.abs(WALL_Z + 5.4)]} />
        <primitive object={lit.pavement} attach="material" />
      </mesh>
    </group>
  );
}

export const logixs: NightSet = {
  Set: LogixsSet,
  board: [
    [BOARD.x0, BOARD.y1, WALL_Z + 0.05],
    [BOARD.x1, BOARD.y1, WALL_Z + 0.05],
    [BOARD.x1, BOARD.y0, WALL_Z + 0.05],
    [BOARD.x0, BOARD.y0, WALL_Z + 0.05],
  ],
  boardNormal: [0, 0, 1],
  // On a phone the wall runs past both sides of the frame and shows no corner.
  boardWide: true,
  // On a phone: the run the lines are about, the ban over it to the bills' feet (RUN), and the car at its line.
  subject: (_pose, _p, car) => [...RUN, ...car],
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
