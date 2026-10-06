"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, type CanvasTexture, type InstancedMesh, Matrix4, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { palette } from "@/design/tokens";
import { buildLandmark, LANDMARK } from "@/features/hero/scene/landmarkLayout";
import { glowFragmentShader, glowVertexShader } from "@/features/hero/shaders/neon";
import type { Vec3 } from "../frame";
import { night } from "../nightState";
import { fonts, loadFaces, makeCanvas, toTexture } from "../artCanvas";
import { Glows, type Glow } from "../parts/Glows";
import { NightPalms, type NightPalm } from "../parts/NightPalms";
import { Lamps } from "../parts/Lamps";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { type Pane, Windows } from "../parts/Windows";
import { signFragmentShader, signVertexShader } from "../shaders/sign";
import { createRandom } from "@/features/hero/scene/world";
import { ATRIUM, PANE, pickPane } from "./art/windows";
import { inkOrigin, roleLine, withInkCentred } from "./art/ink";
import { Skyline, type SkylineSpec } from "../parts/Skyline";
import { ledFragmentShader, ledVertexShader } from "../shaders/led";
import { nightBlockFragmentShader, nightBlockVertexShader } from "../shaders/nightBlock";
import { beatP } from "../timelineKeys";
import type { NightSet, SetProps } from "./types";

/**
 * Stop 5, Heuristik: the drive ends where the hero aimed, at the art-deco
 * landmark, its crown retrofitted with LED: the newest light on the oldest
 * tower. A lower third on the upper tier names the job, a live timeline
 * band runs round the crown, and a lantern on the spire reads LIVE: dark
 * through the crane, it strikes on with the first card and holds. Its red
 * (palette.onAir) is the only red in the frame.
 */

/** The cool cyan-white of the LED lines along the crown's steps. */
const LED_EDGE = "#bfeaff";

/** The top of the lit mast over the tally (m, set frame); the needle above it stays dark against the sky. */
export const MAST_TOP = LANDMARK.spire.top;

/** The tower stands here in the set (its base centre), facing the camera. */
const TOWER = { x: 8, z: -42 } as const;
/** The landmark layout is in the hero's world: move it to the set. */
const OFFSET = { x: TOWER.x - LANDMARK.x, z: TOWER.z - LANDMARK.z } as const;
const UPPER = LANDMARK.tiers[3];
const CROWN = LANDMARK.tiers[4];

/** The LED screens, in set metres: centre, size, and how far proud of their face. */
const SCREENS = {
  name: { x: TOWER.x, y: 82.0, z: TOWER.z + UPPER.d / 2 + 1.2, w: 15.4, h: 3.0 },
  ticker: { x: TOWER.x, y: 79.1, z: TOWER.z + UPPER.d / 2 + 1.2, w: 15.4, h: 2.4 },
  band: { x: TOWER.x, y: 87.0, z: TOWER.z + CROWN.d / 2 + 1.0, w: CROWN.w + 0.6, h: 0.9 },
  tally: { x: TOWER.x, y: 100.6, z: TOWER.z, w: 8.2, h: 3.8, d: 5.2 },
} as const;

/**
 * Atlas rows in canvas pixels (x, y, w, h), each the shape of its screen so
 * the type is never squeezed: the name 15.4 x 3.0 m, the role 15.4 x 2.4,
 * the tally 8.2 x 3.8, the band 13.6 x 0.9.
 */
const ATLAS = { w: 1024, h: 1024 } as const;
const PX = {
  name: [0, 0, 1024, 200],
  ticker: [0, 220, 1024, 160],
  live: [0, 400, 560, 260],
  band: [0, 680, 1024, 68],
} as const;
/** The same rows as (u0, v0, u1, v1), with v up as WebGL samples it. */
const uvRow = ([x, y, w, h]: readonly number[]) => [x / ATLAS.w, 1 - (y + h) / ATLAS.h, (x + w) / ATLAS.w, 1 - y / ATLAS.h] as const;
const ROWS = { name: uvRow(PX.name), ticker: uvRow(PX.ticker), live: uvRow(PX.live), band: uvRow(PX.band) } as const;

/** Fills text centred on its measured ink: the LED matrix samples cell centres, so a few pixels off in the canvas is a dot off on the tower. */
function inkCentred(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number) {
  withInkCentred(ctx, text, cx, cy, maxWidth, (x, y) => ctx.fillText(text, x, y));
}

function paintAtlas(name: string, ticker: string, live: string): CanvasTexture {
  const [canvas, ctx] = makeCanvas(ATLAS.w, ATLAS.h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ATLAS.w, ATLAS.h);
  ctx.fillStyle = "#fff";
  // Name bar: the name centred, a short rule each side.
  {
    const [x, y, w, h] = PX.name;
    ctx.font = `800 120px ${fonts.display()}`;
    inkCentred(ctx, name, x + w / 2, y + h / 2, w - 200);
    for (const side of [-1, 1]) ctx.fillRect(x + w / 2 + side * (w / 2 - 50) - 18, y + h / 2 - 5, 36, 10);
  }
  // The role, still and centred: a line read at a glance, not a crawl.
  {
    const [x, y, w, h] = PX.ticker;
    ctx.font = `400 120px ${fonts.condensed()}`;
    inkCentred(ctx, roleLine(ticker), x + w / 2, y + h / 2, w - 60);
  }
  // LIVE in an on-air box: a frame of dots round the word.
  {
    const [x, y, w, h] = PX.live;
    ctx.font = `800 170px ${fonts.display()}`;
    inkCentred(ctx, live, x + w / 2, y + h / 2, w - 120);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 12;
    ctx.strokeRect(x + 14, y + 14, w - 28, h - 28);
  }
  // Timeline band: a rule from 2018 to a live dot, ticks at the earlier stops' years.
  {
    const [x, y, w, h] = PX.band;
    const mid = y + h / 2;
    ctx.fillRect(x + 40, mid - 5, w - 120, 10);
    for (const year of [2018, 2023, 2024, 2025]) {
      const tx = x + 40 + ((year - 2018) / 8) * (w - 120);
      ctx.fillRect(tx - 5, y + 8, 10, h - 16);
    }
    ctx.beginPath();
    ctx.arc(x + w - 50, mid, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, 8);
}

function ledUniforms(map: CanvasTexture | null, rect: readonly number[], cells: [number, number], tint: string) {
  return UniformsUtils.merge([
    UniformsLib.fog,
    {
      uMap: { value: map },
      uRect: { value: rect.slice() },
      uCells: { value: cells.slice() },
      uScroll: { value: 0 },
      uLevel: { value: 1 },
      uInvert: { value: 0 },
      uTint: { value: new Color(tint) },
    },
  ]);
}

/**
 * The tower's windows as painted offices: each bay of the layout split into
 * window units about 1.4 m wide, lit ones drawn from the office mix (desks
 * and screens, blinds, a late worker's lamp), dark ones glass or blinds.
 */
function officePanes(panes: { x: number; y: number; z: number; w: number; h: number; intensity: number }[]): Pane[] {
  const random = createRandom(2026);
  const out: Pane[] = [];
  for (const pane of panes) {
    const lit = pane.intensity > 1.2;
    const units = Math.max(1, Math.round(pane.w / 1.4));
    const w = pane.w / units;
    for (let i = 0; i < units; i += 1) {
      // Never the same room twice side by side: a row of copies reads as a pattern, not a floor of offices.
      const beside = i > 0 ? out[out.length - 1].cell : -1;
      out.push({
        p: [pane.x + OFFSET.x - pane.w / 2 + w * (i + 0.5), pane.y, pane.z + OFFSET.z],
        s: [w - 0.08, pane.h],
        ...pickPane(random, "office", lit ? 0.92 : 0.04, beside),
      });
    }
  }
  return out;
}

/** The podium's street face, in set metres. */
const PODIUM = { front: TOWER.z + LANDMARK.tiers[0].d / 2, x0: TOWER.x - LANDMARK.tiers[0].w / 2, x1: TOWER.x + LANDMARK.tiers[0].w / 2, top: LANDMARK.tiers[0].top } as const;
const PLAZA_TOP = 0.16;
/** A terrace across the lobby, three steps up to it under the canopy. */
const TERRACE = { y: PLAZA_TOP + 0.51, depth: 2.2 } as const;
const GLASS = { x0: PODIUM.x0 + 3.5, bay: 3, bays: 13, y0: TERRACE.y, y1: 5.6 } as const;
const CANOPY = { x: TOWER.x, w: 14, y: 6.15, h: 0.45, depth: 5 } as const;
const STEPS = { w: 14, rise: 0.17, run: 0.45 } as const;
/**
 * The building's name over the doors: lit letters standing on the canopy's
 * front edge, on the tower's axis, high enough to stand clear of the cues
 * and the chip at the foot of the frame (direction.test.ts).
 */
const SIGN = { x: TOWER.x, y: CANOPY.y + CANOPY.h / 2 + 0.85, z: PODIUM.front + CANOPY.depth - 0.35, w: 6.4, h: 1.6 } as const;
/** The sign's corners in the set, for the framing tests. */
export const NAME_SIGN_CORNERS: Vec3[] = [
  [SIGN.x - SIGN.w / 2, SIGN.y + SIGN.h / 2, SIGN.z],
  [SIGN.x + SIGN.w / 2, SIGN.y + SIGN.h / 2, SIGN.z],
  [SIGN.x + SIGN.w / 2, SIGN.y - SIGN.h / 2, SIGN.z],
  [SIGN.x - SIGN.w / 2, SIGN.y - SIGN.h / 2, SIGN.z],
];

function groundSolids(): { stone: BoxItem[]; bronze: BoxItem[]; dark: BoxItem[]; leaves: BoxItem[]; leds: BoxItem[] } {
  const stone: BoxItem[] = [];
  const bronze: BoxItem[] = [];
  const dark: BoxItem[] = [];
  const leaves: BoxItem[] = [];
  const leds: BoxItem[] = [];
  const f = PODIUM.front;
  const glassX1 = GLASS.x0 + GLASS.bay * GLASS.bays;
  // The terrace and the steps, an LED under each nosing.
  stone.push({ p: [(PODIUM.x0 + PODIUM.x1) / 2, (PLAZA_TOP + TERRACE.y) / 2, f + TERRACE.depth / 2], s: [PODIUM.x1 - PODIUM.x0, TERRACE.y - PLAZA_TOP, TERRACE.depth] });
  for (let i = 0; i < 3; i += 1) {
    const top = PLAZA_TOP + STEPS.rise * (i + 1);
    const z = f + TERRACE.depth + STEPS.run * (2 - i) + STEPS.run / 2;
    stone.push({ p: [TOWER.x, (PLAZA_TOP + top) / 2, z], s: [STEPS.w, top - PLAZA_TOP, STEPS.run] });
    leds.push({ p: [TOWER.x, top - 0.06, z + STEPS.run / 2 + 0.03], s: [STEPS.w - 0.2, 0.04, 0.04], color: "#ffd9a0" });
  }
  // Bronze mullions, transom and sill over the lobby glass.
  for (let i = 0; i <= GLASS.bays; i += 1) bronze.push({ p: [GLASS.x0 + i * GLASS.bay, (GLASS.y0 + GLASS.y1) / 2, f + 0.2], s: [0.24, GLASS.y1 - GLASS.y0, 0.36] });
  bronze.push({ p: [(GLASS.x0 + glassX1) / 2, GLASS.y1 + 0.15, f + 0.22], s: [glassX1 - GLASS.x0 + 0.24, 0.3, 0.4] });
  bronze.push({ p: [(GLASS.x0 + glassX1) / 2, GLASS.y0 + 0.06, f + 0.22], s: [glassX1 - GLASS.x0 + 0.24, 0.12, 0.4] });
  // Fluted stone above the glass: a pier over every mullion up to the cornice.
  for (let i = 0; i <= GLASS.bays; i += 1) stone.push({ p: [GLASS.x0 + i * GLASS.bay, (GLASS.y1 + 0.3 + PODIUM.top - 0.6) / 2, f + 0.15], s: [0.55, PODIUM.top - 0.6 - GLASS.y1 - 0.3, 0.3] });
  leds.push({ p: [TOWER.x, PODIUM.top - 0.75, f + 0.34], s: [PODIUM.x1 - PODIUM.x0, 0.1, 0.06], color: palette.sodiumNight });
  // The canopy on two slim columns, a warm line along its edge.
  dark.push({ p: [CANOPY.x, CANOPY.y, f + CANOPY.depth / 2], s: [CANOPY.w, CANOPY.h, CANOPY.depth] });
  for (const side of [-1, 1]) dark.push({ p: [CANOPY.x + side * (CANOPY.w / 2 - 0.6), (PLAZA_TOP + CANOPY.y) / 2, f + CANOPY.depth - 0.5], s: [0.22, CANOPY.y - PLAZA_TOP, 0.22] });
  leds.push({ p: [CANOPY.x, CANOPY.y - CANOPY.h / 2 + 0.05, f + CANOPY.depth + 0.03], s: [CANOPY.w, 0.06, 0.05], color: "#ffe2b8" });
  // Long planters either side of the steps, clipped hedges in them.
  for (const [x0, x1] of [
    [PODIUM.x0 + 1, TOWER.x - STEPS.w / 2 - 0.8],
    [TOWER.x + STEPS.w / 2 + 0.8, PODIUM.x1 - 1],
  ]) {
    const z = f + TERRACE.depth + 0.9;
    stone.push({ p: [(x0 + x1) / 2, PLAZA_TOP + 0.4, z], s: [x1 - x0, 0.8, 1.2] });
    for (let x = x0 + 0.7; x < x1 - 0.4; x += 1.1) leaves.push({ p: [x, PLAZA_TOP + 0.95, z], s: [1.3, 0.75, 1.1] });
  }
  // Bollards along the plaza's front, each with a lit head; benches toward the palms.
  for (let x = PODIUM.x0 + 2; x <= PODIUM.x1 - 2; x += 3.2) {
    dark.push({ p: [x, PLAZA_TOP + 0.45, -13.2], s: [0.22, 0.9, 0.22] });
    leds.push({ p: [x, PLAZA_TOP + 0.84, -13.2], s: [0.24, 0.1, 0.24], color: "#ffe2b8" });
  }
  for (const x of [20.5, 25.5]) {
    dark.push({ p: [x, PLAZA_TOP + 0.45, -18.2], s: [2.6, 0.1, 0.62] });
    dark.push({ p: [x, PLAZA_TOP + 0.72, -18.48], s: [2.6, 0.5, 0.08] });
    for (const s of [-1, 1]) dark.push({ p: [x + s * 1.1, PLAZA_TOP + 0.22, -18.2], s: [0.1, 0.44, 0.5] });
  }
  // The name sign's frame on the canopy, and the warm line that lights it from below.
  dark.push({ p: [SIGN.x, SIGN.y, SIGN.z - 0.08], s: [SIGN.w + 0.3, SIGN.h + 0.24, 0.14] });
  leds.push({ p: [SIGN.x, SIGN.y - SIGN.h / 2 - 0.1, SIGN.z + 0.12], s: [SIGN.w, 0.05, 0.05], color: "#ffd9a0" });
  return { stone, bronze, dark, leaves, leds };
}

/**
 * Behind the glass, left to right: a corner café, a bookshop, the lobby round
 * the doors, a co-working floor still lit, and a shop already closed.
 */
const GROUND_ROOMS: number[] = [
  PANE.cafeCounter,
  PANE.cafeTable,
  PANE.cafeTable,
  PANE.study,
  PANE.study,
  ...ATRIUM,
  PANE.office,
  PANE.office,
  PANE.officeLate,
  PANE.office,
  PANE.dark,
];

function lobbyPanes(): Pane[] {
  const panes: Pane[] = [];
  const h = GLASS.y1 - GLASS.y0 - 0.1;
  for (let i = 0; i < GLASS.bays; i += 1) {
    const cell = GROUND_ROOMS[i % GROUND_ROOMS.length];
    // The atrium's three panes are one space: never mirrored, one brightness.
    const atrium = (ATRIUM as readonly number[]).includes(cell);
    panes.push({ p: [GLASS.x0 + GLASS.bay * (i + 0.5), (GLASS.y0 + GLASS.y1) / 2, PODIUM.front + 0.12], s: [GLASS.bay - 0.1, h], cell, flip: !atrium && i % 2 === 1, gain: atrium ? 1 : i % 3 === 0 ? 0.92 : 1.05 });
  }
  return panes;
}

/** The name sign: bronze letters standing off dark stone, lit from behind (1024 x 256, the sign's 4:1). */
function paintPlaque(name: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(1024, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#2a2034");
  g.addColorStop(1, "#1a1424");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.font = `800 132px ${fonts.display()}`;
  const text = name.split("").join("\u2009");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(text);
  const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const { x, y, squeeze } = inkOrigin(m, 880);
  ctx.save();
  ctx.translate(512, 128);
  ctx.scale(squeeze, 1);
  // The halo on the stone behind the letters, twice for a wide soft wash.
  ctx.fillStyle = "#ffc888";
  for (const blur of [70, 26]) {
    ctx.shadowColor = "#ffb870";
    ctx.shadowBlur = blur;
    ctx.fillText(text, x + 4, y + 4);
  }
  ctx.shadowBlur = 0;
  // The letters' faces: dark bronze, a bright chamfer along their top edge.
  ctx.fillStyle = "#f6d6a0";
  ctx.fillText(text, x, y - 3);
  const face = ctx.createLinearGradient(0, -inkH / 2, 0, inkH / 2);
  face.addColorStop(0, "#4a3020");
  face.addColorStop(1, "#24160e");
  ctx.fillStyle = face;
  ctx.fillText(text, x, y);
  ctx.restore();
  return canvas;
}

function GroundFloor({ name }: { name: string }) {
  const solids = useMemo(() => groundSolids(), []);
  const lobby = useMemo(() => lobbyPanes(), []);
  const [plaque, setPlaque] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    let cancelled = false;
    let texture: CanvasTexture | null = null;
    loadFaces([`800 132px ${fonts.display()}`]).then(() => {
      if (cancelled) return;
      texture = toTexture(paintPlaque(name), 4);
      setPlaque(texture);
    });
    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [name]);
  const uniforms = useMemo(
    () => ({
      leds: UniformsUtils.merge([UniformsLib.fog, { uIntensity: { value: 1.6 }, uFogAmount: { value: 0.3 } }]),
      plaque: { ...UniformsUtils.clone(UniformsLib.fog), uMap: { value: plaque }, uLevel: { value: 1 }, uIntensity: { value: 1.7 }, uFogAmount: { value: 0.3 } },
    }),
    [plaque],
  );
  const soffit = useMemo<Glow[]>(
    () =>
      [-5, -1.7, 1.7, 5].flatMap((dx) =>
        [1.3, 3.6].map((dz) => ({ position: [CANOPY.x + dx, CANOPY.y - CANOPY.h / 2 - 0.08, PODIUM.front + dz] as Vec3, size: 0.7, color: "#ffe2b8", intensity: 2.2 })),
      ),
    [],
  );
  const palms = useMemo<NightPalm[]>(
    () => [
      { position: [PODIUM.x0 + 2.2, 0, PODIUM.front + 4.6], rotation: 0.6, scale: 0.62, variant: 1 },
      { position: [PODIUM.x1 - 2.2, 0, PODIUM.front + 4.6], rotation: 2.4, scale: 0.58, variant: 3 },
    ],
    [],
  );
  return (
    <group>
      <Windows panes={lobby} gain={1.15} fogAmount={0.3} />
      <Boxes items={solids.stone}>
        <meshStandardMaterial color="#8a6e92" roughness={0.7} />
      </Boxes>
      <Boxes items={solids.bronze}>
        <meshStandardMaterial color="#9a7050" roughness={0.35} metalness={0.7} />
      </Boxes>
      <Boxes items={solids.dark}>
        <meshStandardMaterial color="#2a1e3a" roughness={0.45} metalness={0.4} />
      </Boxes>
      <Boxes items={solids.leaves} geometry={<sphereGeometry args={[0.5, 10, 8]} />}>
        <meshStandardMaterial color="#3e5a4c" roughness={0.9} emissive="#141a22" />
      </Boxes>
      <Boxes items={solids.leds}>
        <shaderMaterial uniforms={uniforms.leds} vertexShader={glowVertexShader} fragmentShader={glowFragmentShader} fog />
      </Boxes>
      <Glows glows={soffit} />
      <NightPalms palms={palms} />
      {plaque ? (
        <mesh position={[SIGN.x, SIGN.y, SIGN.z + 0.01]}>
          <planeGeometry args={[SIGN.w, SIGN.h]} />
          <shaderMaterial uniforms={uniforms.plaque} vertexShader={signVertexShader} fragmentShader={signFragmentShader} fog />
        </mesh>
      ) : null}
    </group>
  );
}

const SKYLINE: SkylineSpec = {
  seed: 2026,
  count: 70,
  x: [-170, 190],
  z: [-210, -48],
  height: [14, 75],
  lit: 0.42,
  clear: [{ x: [-20, 36], z: [-70, -20] }],
};

const LAMP_BASES: [number, number, number][] = [
  [-22, 0.15, -7.2],
  [-6, 0.15, -7.2],
  [22, 0.15, -7.2],
  [38, 0.15, -7.2],
];

/** The island's palms along the kerb: every stop is the same island at night. */
const HEURISTIK_PALMS: NightPalm[] = [
  { position: [-16, 0, 4.8] as Vec3, rotation: 0.5, scale: 1.1, variant: 0 },
  { position: [-11, 0, 5.6] as Vec3, rotation: 2.0, scale: 0.95, variant: 2 },
  { position: [18, 0, 4.6] as Vec3, rotation: 1.1, scale: 1.05, variant: 1 },
  { position: [24, 0, 5.3] as Vec3, rotation: 2.9, scale: 0.9, variant: 3 },
];

function HeuristikSet({ work, tier, timeline, index }: SetProps) {
  const layout = useMemo(() => buildLandmark(), []);
  const [atlas, setAtlas] = useState<CanvasTexture | null>(null);
  const live = work.live;
  const { name, ticker } = work.stops.heuristik.board;

  useEffect(() => {
    let cancelled = false;
    let texture: CanvasTexture | null = null;
    loadFaces([`800 100px ${fonts.display()}`, `400 120px ${fonts.condensed()}`]).then(() => {
      if (cancelled) return;
      texture = paintAtlas(name, ticker, live);
      setAtlas(texture);
    });
    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [name, ticker, live]);

  const uniforms = useMemo(
    () => ({
      // The dot pitch is the type's: a coarser matrix on phones would not read.
      name: ledUniforms(atlas, ROWS.name, [104, 20], palette.led),
      // The role in amber, as in the concept: the name white, the job warm.
      ticker: ledUniforms(atlas, ROWS.ticker, [200, 24], "#ffc46b"),
      band: ledUniforms(atlas, ROWS.band, [150, 10], palette.led),
      tally: ledUniforms(atlas, ROWS.live, [38, 18], palette.onAir),
      tower: UniformsUtils.merge([
        UniformsLib.fog,
        { uBottom: { value: new Color("#4a2a52") }, uTop: { value: new Color("#21153d") }, uHeight: { value: 110 } },
      ]),
      glow: UniformsUtils.merge([UniformsLib.fog, { uIntensity: { value: 1 }, uFogAmount: { value: 0.35 } }]),
    }),
    [atlas],
  );

  const towerPanes = useMemo(() => officePanes(layout.panes), [layout]);
  const blocks = useRef<InstancedMesh>(null);
  const glows = useRef<InstancedMesh>(null);
  // The crown's old neon is retrofitted: cool white LED, a little dimmer than the screens.
  const crownGlows = useMemo(
    () =>
      layout.glows
        // The crown's neon; the podium's lobby slab would be one flat orange block at night. The spire's
        // rings and beacon are left dark: lit, they hung over the tally as loose brackets (the mast below).
        .filter((g) => g.y > 40 && g.y < SCREENS.tally.y)
        .map((g) => {
          const lobby = g.y < 2;
          // A band wrapped round a tier would show its whole roof from the crane: keep its front strip.
          const wrapped = g.d > 3;
          return {
            ...g,
            // A thin LED line along each step's lip, as in the concept, not a slab.
            y: wrapped ? g.y + g.h - 0.3 : g.y,
            h: wrapped ? 0.26 : g.h,
            z: wrapped ? g.z + g.d / 2 + 0.1 : g.z,
            d: wrapped ? 0.2 : g.d,
            color: lobby ? palette.sodiumNight : wrapped ? LED_EDGE : palette.led,
            intensity: lobby ? 0.55 : wrapped ? 2.4 : 1.1,
          };
        })
        .concat(MAST),
    [layout],
  );

  useLayoutEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const c = new Color();
    layout.blocks.forEach((b, i) => {
      m.compose(p.set(b.x + OFFSET.x, b.y + b.h / 2, b.z + OFFSET.z), q, s.set(b.w, b.h, b.d));
      blocks.current?.setMatrixAt(i, m);
    });
    crownGlows.forEach((g, i) => {
      m.compose(p.set(g.x + OFFSET.x, g.y + g.h / 2, g.z + OFFSET.z), q, s.set(g.w, g.h, g.d));
      glows.current?.setMatrixAt(i, m);
      glows.current?.setColorAt(i, c.set(g.color).multiplyScalar(g.intensity));
    });
    for (const mesh of [blocks.current, glows.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [layout, crownGlows]);

  const card0 = useMemo(() => beatP(timeline, "heuristik.card0"), [timeline]);
  const tallyHalo = useRef<{ setLevel: (i: number, l: number) => void } | null>(null);
  const haloGlows = useMemo<Glow[]>(
    // The halo stands well off the screen: a camera-facing glow closer to it cut a dark wedge out of its own light.
    () => [{ position: [SCREENS.tally.x, SCREENS.tally.y, SCREENS.tally.z + SCREENS.tally.d / 2 + 4], size: 16, color: palette.onAir, intensity: 0.5, level: 0 }],
    [],
  );
  const armedAt = useRef(-1);

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame((state) => {
    if (night.stop !== index) return;
    const isLive = night.p >= card0;
    night.live = isLive;
    const armed = night.armed;
    const t = state.clock.elapsedTime;
    if (night.armTarget > 0 && armedAt.current < 0) armedAt.current = t;
    if (night.armTarget === 0) armedAt.current = -1;
    // The name bar inverts for 0.6 s when the board arms.
    const sinceArm = armedAt.current >= 0 ? t - armedAt.current : 9;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    uniforms.name.uInvert.value = sinceArm < 0.6 ? 1 : 0;
    // The tally strikes on with the first card: no fade, no blink.
    uniforms.tally.uLevel.value = isLive ? 1 + 0.35 * armed : 0;
    uniforms.band.uLevel.value = 0.85 + 0.15 * armed;
    tallyHalo.current?.setLevel(0, isLive ? 1 + 0.6 * armed : 0);
  });

  return (
    <group>
      <Skyline spec={tier === "low" ? { ...SKYLINE, count: 45, lit: 0.36 } : SKYLINE} />
      {/* The plaza at the tower's foot. */}
      <mesh position={[TOWER.x, 0.08, -20]}>
        <boxGeometry args={[110, 0.16, 29]} />
        <meshStandardMaterial color="#5a4466" roughness={0.55} metalness={0.05} />
      </mesh>
      <instancedMesh ref={blocks} args={[undefined, undefined, layout.blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial uniforms={uniforms.tower} vertexShader={nightBlockVertexShader} fragmentShader={nightBlockFragmentShader} fog />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, crownGlows.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial uniforms={uniforms.glow} vertexShader={glowVertexShader} fragmentShader={glowFragmentShader} fog />
      </instancedMesh>
      <Windows panes={towerPanes} gain={1.05} fogAmount={0.45} />
      <GroundFloor name={name} />
      <NightPalms palms={tier === "high" ? HEURISTIK_PALMS : HEURISTIK_PALMS.slice(0, 2)} />
      {atlas ? (
        <>
          <mesh position={[SCREENS.name.x, SCREENS.name.y, SCREENS.name.z]}>
            <planeGeometry args={[SCREENS.name.w, SCREENS.name.h]} />
            <shaderMaterial uniforms={uniforms.name} vertexShader={ledVertexShader} fragmentShader={ledFragmentShader} fog />
          </mesh>
          <mesh position={[SCREENS.ticker.x, SCREENS.ticker.y, SCREENS.ticker.z]}>
            <planeGeometry args={[SCREENS.ticker.w, SCREENS.ticker.h]} />
            <shaderMaterial uniforms={uniforms.ticker} vertexShader={ledVertexShader} fragmentShader={ledFragmentShader} fog />
          </mesh>
          <mesh position={[SCREENS.band.x, SCREENS.band.y, SCREENS.band.z]}>
            <planeGeometry args={[SCREENS.band.w, SCREENS.band.h]} />
            <shaderMaterial uniforms={uniforms.band} vertexShader={ledVertexShader} fragmentShader={ledFragmentShader} fog />
          </mesh>
          {/* The tally: a dark housing, its LED face toward the street. */}
          <mesh position={[SCREENS.tally.x, SCREENS.tally.y, SCREENS.tally.z]}>
            <boxGeometry args={[SCREENS.tally.w + 0.5, SCREENS.tally.h + 0.5, SCREENS.tally.d]} />
            <meshStandardMaterial color="#1a1226" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[SCREENS.tally.x, SCREENS.tally.y, SCREENS.tally.z + SCREENS.tally.d / 2 + 0.12]}>
            <planeGeometry args={[SCREENS.tally.w, SCREENS.tally.h]} />
            <shaderMaterial uniforms={uniforms.tally} vertexShader={ledVertexShader} fragmentShader={ledFragmentShader} fog />
          </mesh>
        </>
      ) : null}
      <Glows glows={haloGlows} handle={tallyHalo} />
      <Lamps bases={LAMP_BASES} arm={1.4} />
    </group>
  );
}

const S = SCREENS;

/**
 * The mast: one continuous LED line up the spire's face, from the tally's
 * housing to the spire's top, and a cap there; in the landmark's own frame,
 * like the rest of the crown's light.
 */
const MAST = [
  {
    x: LANDMARK.x,
    y: S.tally.y + S.tally.h / 2 + 0.25,
    z: LANDMARK.z + LANDMARK.spire.w / 2 + 0.03,
    w: 0.2,
    h: MAST_TOP - (S.tally.y + S.tally.h / 2 + 0.25),
    d: 0.06,
    color: LED_EDGE,
    intensity: 2.2,
  },
  { x: LANDMARK.x, y: MAST_TOP - 0.1, z: LANDMARK.z, w: 0.55, h: 0.35, d: 0.55, color: LED_EDGE, intensity: 2.6 },
];

const heuristikBoard: readonly [Vec3, Vec3, Vec3, Vec3] = [
  [S.name.x - S.name.w / 2 - 0.5, S.tally.y + S.tally.h / 2 + 0.4, S.name.z],
  [S.name.x + S.name.w / 2 + 0.5, S.tally.y + S.tally.h / 2 + 0.4, S.name.z],
  [S.name.x + S.name.w / 2 + 0.5, S.ticker.y - S.ticker.h / 2 - 0.4, S.name.z],
  [S.name.x - S.name.w / 2 - 0.5, S.ticker.y - S.ticker.h / 2 - 0.4, S.name.z],
];

export const heuristik: NightSet = {
  Set: HeuristikSet,
  board: heuristikBoard,
  boardNormal: [0, 0, 1],
  // On a phone the crown (direction.ts eases into this fit over the crane; the street keeps its own framing).
  subject: () => heuristikBoard,
  maxBack: 40,
  lights: [
    { position: [-6, 7, -4], color: palette.sodiumNight, intensity: 60, distance: 40 },
    { position: [8, 30, -20], color: palette.led, intensity: 120, distance: 120 },
  ],
  streaks: [
    { position: [-22, 7.3, -8.6], color: palette.sodiumNight, level: 0.9 },
    { position: [-6, 7.3, -8.6], color: palette.sodiumNight, level: 0.9 },
    { position: [22, 7.3, -8.6], color: palette.sodiumNight, level: 0.9 },
    { position: [8, 10, -28], color: "#ffd9a0", level: 0.6 },
  ],
  kerbs: { near: 1.9, far: -5.4 },
  tally: [S.tally.x, S.tally.y, S.tally.z + S.tally.d / 2],
};
