"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, type CanvasTexture, type InstancedMesh, Matrix4, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { palette } from "@/design/tokens";
import { buildLandmark, LANDMARK } from "@/features/hero/scene/landmarkLayout";
import { glowFragmentShader, glowVertexShader } from "@/features/hero/shaders/neon";
import { LENS, type Vec3 } from "../frame";
import { night } from "../nightState";
import { fonts, loadFaces, makeCanvas, toTexture } from "../artCanvas";
import { Glows, type Glow } from "../parts/Glows";
import { NightPalms, type NightPalm } from "../parts/NightPalms";
import { Lamps } from "../parts/Lamps";
import { Skyline, type SkylineSpec } from "../parts/Skyline";
import { ledFragmentShader, ledVertexShader } from "../shaders/led";
import { nightBlockFragmentShader, nightBlockVertexShader } from "../shaders/nightBlock";
import { beatP, keyAt } from "../timelineKeys";
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

/** Atlas rows (u0, v0, u1, v1, with v up as WebGL samples it). */
const ATLAS = { w: 1024, h: 512 } as const;
const ROWS = {
  name: [0, 1 - 150 / 512, 1, 1],
  ticker: [0, 1 - 280 / 512, 1, 1 - 160 / 512],
  live: [0, 1 - 420 / 512, 0.5, 1 - 290 / 512],
  band: [0, 0, 1, 1 - 430 / 512],
} as const;

function paintAtlas(name: string, ticker: string, live: string): CanvasTexture {
  const [canvas, ctx] = makeCanvas(ATLAS.w, ATLAS.h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ATLAS.w, ATLAS.h);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  // Name bar: an accent tab, then the name.
  ctx.fillRect(18, 22, 46, 106);
  ctx.font = `800 104px ${fonts.display()}`;
  ctx.textAlign = "left";
  const nameWidth = ctx.measureText(name).width;
  const nameScale = Math.min(1, (ATLAS.w - 120) / nameWidth);
  ctx.save();
  ctx.translate(96, 76);
  ctx.scale(nameScale, 1);
  ctx.fillText(name, 0, 0);
  ctx.restore();
  // Ticker: one loop of the role, wrapping seamlessly.
  ctx.font = `700 76px ${fonts.mono()}`;
  const tickerWidth = ctx.measureText(ticker).width;
  ctx.save();
  ctx.translate(0, 220);
  ctx.scale(ATLAS.w / tickerWidth, 1);
  ctx.fillText(ticker, 0, 0);
  ctx.restore();
  // LIVE, the tally's word.
  ctx.font = `800 104px ${fonts.display()}`;
  ctx.textAlign = "center";
  ctx.fillText(live, 256, 356);
  // Timeline band: 2026 to a live edge, ticks at the earlier stops' years.
  ctx.fillRect(40, 470, 900, 10);
  for (const year of [2018, 2023, 2024, 2025]) {
    const x = 40 + ((year - 2018) / 9) * 900;
    ctx.fillRect(x - 3, 452, 6, 46);
  }
  ctx.font = `700 52px ${fonts.mono()}`;
  ctx.textAlign = "left";
  ctx.fillText("2026", 760, 470);
  ctx.beginPath();
  ctx.arc(980, 475, 26, 0, Math.PI * 2);
  ctx.fill();
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
    loadFaces([`800 100px ${fonts.display()}`, `700 70px ${fonts.mono()}`]).then(() => {
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
      ticker: ledUniforms(atlas, ROWS.ticker, [168, 19], "#ffc46b"),
      band: ledUniforms(atlas, ROWS.band, [120, 6], palette.led),
      tally: ledUniforms(atlas, ROWS.live, [40, 16], palette.onAir),
      tower: UniformsUtils.merge([
        UniformsLib.fog,
        { uBottom: { value: new Color("#4a2a52") }, uTop: { value: new Color("#21153d") }, uHeight: { value: 110 } },
      ]),
      glow: UniformsUtils.merge([UniformsLib.fog, { uIntensity: { value: 1 }, uFogAmount: { value: 0.35 } }]),
      panes: UniformsUtils.merge([UniformsLib.fog, { uIntensity: { value: 0.9 }, uFogAmount: { value: 0.5 } }]),
    }),
    [atlas],
  );

  const blocks = useRef<InstancedMesh>(null);
  const glows = useRef<InstancedMesh>(null);
  const panes = useRef<InstancedMesh>(null);
  // The crown's old neon is retrofitted: cool white LED, a little dimmer than the screens.
  const crownGlows = useMemo(
    () =>
      layout.glows
        // The crown's neon; the podium's lobby slab would be one flat orange block at night.
        .filter((g) => g.y > 40)
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
        }),
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
    layout.panes.forEach((pane, i) => {
      m.compose(p.set(pane.x + OFFSET.x, pane.y, pane.z + OFFSET.z), q, s.set(pane.w, pane.h, 1));
      panes.current?.setMatrixAt(i, m);
      // Night: the sky glass goes dark; lit rooms stay warm.
      const lit = pane.intensity > 1.2;
      panes.current?.setColorAt(i, c.set(lit ? pane.color : "#2e2148").multiplyScalar(lit ? 0.85 : 1));
    });
    for (const mesh of [blocks.current, glows.current, panes.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [layout, crownGlows]);

  const card0 = useMemo(() => beatP(timeline, "heuristik.card0"), [timeline]);
  const tallyHalo = useRef<{ setLevel: (i: number, l: number) => void } | null>(null);
  const haloGlows = useMemo<Glow[]>(
    () => [{ position: [SCREENS.tally.x, SCREENS.tally.y, SCREENS.tally.z + SCREENS.tally.d / 2 + 0.3], size: 16, color: palette.onAir, intensity: 0.5, level: 0 }],
    [],
  );
  const scroll = useRef(0);
  const armedAt = useRef(-1);

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame((state, delta) => {
    if (night.stop !== index) return;
    const isLive = night.p >= card0;
    night.live = isLive;
    const armed = night.armed;
    const t = state.clock.elapsedTime;
    if (night.armTarget > 0 && armedAt.current < 0) armedAt.current = t;
    if (night.armTarget === 0) armedAt.current = -1;
    // The ticker runs on time (ambient), and stops while the board is armed.
    scroll.current = (scroll.current + delta * 0.05 * (1 - armed)) % 1;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    uniforms.ticker.uScroll.value = scroll.current;
    // The name bar inverts for 0.6 s when the board arms.
    const sinceArm = armedAt.current >= 0 ? t - armedAt.current : 9;
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
      <instancedMesh ref={panes} args={[undefined, undefined, layout.panes.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial uniforms={uniforms.panes} vertexShader={glowVertexShader} fragmentShader={glowFragmentShader} fog />
      </instancedMesh>
      <NightPalms palms={tier === "high" ? HEURISTIK_PALMS : HEURISTIK_PALMS.slice(0, 2)} />
      {/* Warm uplights on the shaft. */}
      <Glows
        glows={[-10, -3, 3, 10].map((x) => ({ position: [TOWER.x + x, 4, TOWER.z + 13] as [number, number, number], size: 14, color: palette.sodiumNight, intensity: 0.32 }))}
      />
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
          <mesh position={[SCREENS.tally.x, SCREENS.tally.y, SCREENS.tally.z]}>
            <boxGeometry args={[SCREENS.tally.w, SCREENS.tally.h, SCREENS.tally.d]} />
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

/** Set by the shots: where the crane starts on the film. */
let craneStart = 0.9;

const heuristikBoard: Vec3[] = [
  [S.name.x - S.name.w / 2 - 0.5, S.tally.y + S.tally.h / 2 + 0.4, S.name.z],
  [S.name.x + S.name.w / 2 + 0.5, S.tally.y + S.tally.h / 2 + 0.4, S.name.z],
  [S.name.x + S.name.w / 2 + 0.5, S.ticker.y - S.ticker.h / 2 - 0.4, S.name.z],
  [S.name.x - S.name.w / 2 - 0.5, S.ticker.y - S.ticker.h / 2 - 0.4, S.name.z],
];

export const heuristik: NightSet = {
  Set: HeuristikSet,
  board: [
    [S.name.x - S.name.w / 2 - 0.5, S.tally.y + S.tally.h / 2 + 0.4, S.name.z],
    [S.name.x + S.name.w / 2 + 0.5, S.tally.y + S.tally.h / 2 + 0.4, S.name.z],
    [S.name.x + S.name.w / 2 + 0.5, S.ticker.y - S.ticker.h / 2 - 0.4, S.name.z],
    [S.name.x - S.name.w / 2 - 0.5, S.ticker.y - S.ticker.h / 2 - 0.4, S.name.z],
  ],
  boardNormal: [0, 0, 1],
  shots: (timeline) => {
    craneStart = beatP(timeline, "heuristik.crane", 0.15);
    return [
    // Behind the car at the plaza's edge, the tower rising ahead: the climb to come.
    // Over the car's shoulder, as the hero frames it, before the crane rises off the street.
    keyAt(timeline, "heuristik.open", 0, { position: [-6, 1.6, 11], look: [6, 14, -42], fov: LENS.mm28 }),
    keyAt(timeline, "heuristik.crane", 0, { position: [-6, 1.6, 11], look: [6, 14, -42], fov: LENS.mm28 }),
    keyAt(timeline, "heuristik.crane", 1, { position: [1, 88, 34], look: [8, 89.5, -42], fov: 32 }),
    ];
  },
  // On a phone: the car and the tower's foot until the crane lifts off, then the crown.
  subject: (_pose, p, car) => (p < craneStart ? [...car, [0, 0, -27], [16, 0, -27], [0, 20, -31], [16, 20, -31]] : [...heuristikBoard]),
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
