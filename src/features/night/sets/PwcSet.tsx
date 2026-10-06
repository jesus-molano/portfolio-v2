"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, type CanvasTexture, Color, type Mesh, UniformsLib, UniformsUtils } from "three";
import { palette } from "@/design/tokens";
import { createRandom } from "@/features/hero/scene/world";
import { glowFragmentShader, glowVertexShader } from "@/features/hero/shaders/neon";
import { fonts, loadFaces, toTexture } from "../artCanvas";
import { createFloods } from "../floods";
import { LENS, type Vec3 } from "../frame";
import { night } from "../nightState";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { type Glow, type GlowHandle, Glows } from "../parts/Glows";
import { NightPalms } from "../parts/NightPalms";
import { type Pane, Windows } from "../parts/Windows";
import { structureFragmentShader } from "../shaders/board";
import { signFragmentShader, signVertexShader } from "../shaders/sign";
import { beatP, keyAt } from "../timelineKeys";
import { PANE } from "./art/windows";
import { BLADE, GLASS, GLASS_ROWS, paintBlade, paintDyingRay, paintGlass } from "./art/pwc";
import { instancedBoardVertexShader } from "./instanced";
import type { NightSet, SetProps } from "./types";

/**
 * Stop 2, PwC (Santa Cruz de Tenerife, 2023-2024): Ocean Drive hotel neon
 * on the islands' seafront. A pastel deco hotel and its vertical blade:
 * P, W and C stacked in pink neon on violet enamel, a crown with a fan of
 * rays, one of them dying (the only flicker, never in the name). Under it
 * a crossbar with the role and two plaques with the projects. The border
 * tube runs on along the parapet as three magenta racing stripes. Armed,
 * the dying ray strikes and holds, the letters relight and a white pulse
 * runs along the stripes.
 */

const FACADE_Z = -8;
/** The blade: double-sided, projecting from the facade over the pavement, faces +-x. */
const BLADE_BOX = { x: 0, y0: 4, y1: 20, z0: -7.8, z1: -4.4, t: 0.6 } as const;
const PLANE = { h: BLADE.metresH, w: BLADE.metresW, y: 4 + BLADE.metresH / 2, z: (BLADE_BOX.z0 + BLADE_BOX.z1) / 2 } as const;
const CROSSBAR = { y: 3.3, h: 1.1, z0: -9.4, z1: -2.6 } as const;
const PARAPET = 16.4;

/** The hotel: a body, deco parapet steps, eyebrows with lit lips and fluted fins, in hotel-local metres. */
function hotelItems(): BoxItem[] {
  const items: BoxItem[] = [];
  items.push({ p: [-4, PARAPET / 2, FACADE_Z - 7], s: [64, PARAPET, 14] });
  items.push({ p: [-4, PARAPET + 1.2, FACADE_Z - 7.5], s: [24, 2.4, 12] });
  items.push({ p: [-4, PARAPET + 3.2, FACADE_Z - 8], s: [10, 1.8, 10] });
  for (const y of [4.3, 8.3, 12.3]) items.push({ p: [-4, y, FACADE_Z + 0.45], s: [64, 0.22, 0.9] });
  for (let x = -34; x <= 26; x += 6) items.push({ p: [x, PARAPET / 2 + 0.5, FACADE_Z + 0.25], s: [0.5, PARAPET + 1, 0.5] });
  return items;
}

/** Windows: three per bay per floor, rooms behind half-drawn curtains, seeded; the lobby and the café below. */
function windowPanes(): Pane[] {
  const random = createRandom(2023);
  const panes: Pane[] = [];
  const rooms = [PANE.roomLeft, PANE.roomRight, PANE.roomPink];
  for (let floor = 1; floor < 4; floor += 1) {
    const y = floor * 4 + 1.7;
    for (let x = -32.2; x < 26; x += 2) {
      if (Math.abs((x + 34) % 6) < 0.6) continue;
      if (x > -1.4 && x < 1.4) continue;
      const lit = random() < 0.5;
      const room = rooms[Math.floor(random() * (random() < 0.75 ? 2 : 3))];
      panes.push({ p: [x, y, FACADE_Z + 0.06], s: [1.0, 1.8], cell: lit ? room : PANE.dark });
    }
  }
  // The lobby and the café at street level, people at the tables.
  for (let i = 0; i < 4; i += 1) panes.push({ p: [-15.75 + i * 2.5, 1.6, FACADE_Z + 0.06], s: [2.4, 2.6], cell: i % 2 ? PANE.cafeCounter : PANE.cafeTable });
  for (let i = 0; i < 3; i += 1) panes.push({ p: [7.4 + i * 2.6, 1.6, FACADE_Z + 0.06], s: [2.5, 2.6], cell: i === 1 ? PANE.cafeCounter : PANE.cafeTable });
  return panes;
}

/** The cyan strip under each eyebrow's lip, lighting the band of wall below it. */
function eyebrowLights(): BoxItem[] {
  return [4.3, 8.3, 12.3].map((y) => ({ p: [-4, y - 0.13, FACADE_Z + 0.88] as Vec3, s: [64, 0.05, 0.05] as Vec3, color: "#5fe8e0" }));
}

/** The chaser bulbs round the crossbar, in three phases. */
function bulbGlows(): Glow[] {
  const glows: Glow[] = [];
  for (let z = CROSSBAR.z0; z <= CROSSBAR.z1 + 1e-6; z += 0.34) {
    for (const y of [CROSSBAR.y - CROSSBAR.h / 2 - 0.05, CROSSBAR.y + CROSSBAR.h / 2 + 0.05]) {
      glows.push({ position: [-0.45, y, z], size: 0.32, color: "#ffe2a8", intensity: 2.2 });
    }
  }
  return glows;
}

const PROMENADE_LAMPS: Vec3[] = [-30, -16, -2, 12].map((x) => [x, 4.4, 3.2] as Vec3);

function PwcSet({ work, tier, index, timeline }: SetProps) {
  const high = tier === "high";
  const board = work.stops.pwc.board;
  const [art, setArt] = useState<{ blade: CanvasTexture; ray: CanvasTexture; glass: CanvasTexture } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: { blade: CanvasTexture; ray: CanvasTexture; glass: CanvasTexture } | null = null;
    loadFaces([`800 200px ${fonts.display()}`, `400 120px ${fonts.script()}`, `700 50px ${fonts.mono()}`]).then(() => {
      if (cancelled) return;
      made = {
        blade: toTexture(paintBlade(board.blade), 8),
        ray: toTexture(paintDyingRay(), 4),
        glass: toTexture(paintGlass(board), 8),
      };
      setArt(made);
    });
    return () => {
      cancelled = true;
      made?.blade.dispose();
      made?.ray.dispose();
      made?.glass.dispose();
    };
  }, [board]);

  // Peach uplights wash the wall from the pavement; the blade throws a pink aura.
  const floods = useMemo(
    () =>
      createFloods(
        [
          [-20, 0.3, FACADE_Z + 1.2],
          [-8, 0.3, FACADE_Z + 1.2],
          [16, 0.3, FACADE_Z + 1.2],
          [-0.8, 12, -3],
        ],
        [
          [-20, 10, FACADE_Z],
          [-8, 10, FACADE_Z],
          [16, 10, FACADE_Z],
          [-0.8, 11, FACADE_Z],
        ],
        ["#ffb48a", "#ffb48a", "#ffb48a", "#ff6fb8"],
        [70, 35],
      ),
    [],
  );
  const uniforms = useMemo(() => {
    const fog = () => UniformsUtils.clone(UniformsLib.fog);
    const sign = (map: CanvasTexture | null, intensity: number, fogAmount: number) => ({
      ...fog(),
      uMap: { value: map },
      uLevel: { value: 1 },
      uIntensity: { value: intensity },
      uFogAmount: { value: fogAmount },
    });
    return {
      hotel: { ...fog(), ...floods, uColor: { value: new Color("#efb9c8") }, uAmbient: { value: new Color("#33264f") }, uRim: { value: new Color("#7a4a8a") }, uLift: { value: 0.7 } },
      enamel: { ...fog(), ...floods, uColor: { value: new Color("#2a1745") }, uAmbient: { value: new Color("#40305f") }, uRim: { value: new Color("#5a2a6a") }, uLift: { value: 0.6 } },
      blade: sign(art?.blade ?? null, 2.6, 0.35),
      ray: sign(art?.ray ?? null, 2.6, 0.35),
      glass: sign(art?.glass ?? null, 1.6, 0.4),
      stripes: { ...fog(), uIntensity: { value: 1 }, uFogAmount: { value: 0.3 } },
    };
  }, [floods, art]);

  const hotel = useMemo(() => hotelItems(), []);
  const windows = useMemo(() => windowPanes(), []);
  const eyebrows = useMemo(() => eyebrowLights(), []);
  const bulbs = useMemo(() => bulbGlows(), []);
  const bulbHandle = useRef<GlowHandle | null>(null);
  const crossing = useRef<GlowHandle | null>(null);
  const pulse = useRef<Mesh>(null);
  const armedAt = useRef(-1);
  const leave = useMemo(() => beatP(timeline, "pwc.leave"), [timeline]);

  const stripes = useMemo<BoxItem[]>(
    () =>
      [15.0, 15.45, 15.9].map((y) => ({ p: [12.6, y, FACADE_Z + 0.32] as Vec3, s: [25.2, 0.14, 0.14] as Vec3, color: "#ff2d95" })),
    [],
  );

  const lampGlows = useMemo<Glow[]>(
    () => PROMENADE_LAMPS.map((position) => ({ position, size: 0.7, color: "#dfe8ff", intensity: 2.0 })),
    [],
  );
  const signalGlows = useMemo<Glow[]>(
    () => [
      { position: [4.3, 2.75, 2.45], size: 0.55, color: "#ff3a5c", intensity: 2.4 },
      { position: [4.3, 2.3, 2.45], size: 0.55, color: "#4dffb0", intensity: 2.4, level: 0 },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame((state) => {
    if (night.stop !== index) return;
    const t = state.clock.elapsedTime;
    const armed = night.armed;
    if (night.armTarget > 0 && armedAt.current < 0) armedAt.current = t;
    if (night.armTarget === 0) armedAt.current = -1;
    const since = armedAt.current >= 0 ? t - armedAt.current : -1;
    // The dying ray: an irregular flicker, at most three changes a second,
    // never below 40%; armed it strikes three times and holds.
    const slot = Math.floor(t * 3);
    const flicker = Math.sin(slot * 12.9898) * 43758.5453;
    const idle = 0.4 + 0.45 * (flicker - Math.floor(flicker));
    const strike = since < 0 ? 0 : since < 1.2 ? (Math.floor(since / 0.4) % 2 === 0 ? 1 : 0.4) : 1;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    uniforms.ray.uLevel.value = since >= 0 ? strike : idle * 0.6;
    uniforms.blade.uLevel.value = 1 + 0.35 * armed;
    uniforms.hotel.uFloodLevel.value[3] = 0.55 + 0.45 * armed;
    // Chaser bulbs: three phases, twice as fast when armed.
    const phase = Math.floor(t * (4 + 4 * armed)) % 3;
    for (let i = 0; i < bulbs.length; i += 1) {
      bulbHandle.current?.setLevel(i, Math.floor(i / 2) % 3 === phase ? 1 : 0.35);
    }
    // A white pulse runs along the racing stripes when the board arms.
    if (pulse.current) {
      const x = since >= 0 ? -0.5 + since * 12 : -100;
      pulse.current.position.x = x;
      pulse.current.visible = since >= 0 && x < 26;
    }
    // The crossing light: red while the stop holds, green in its leave beat.
    const green = night.p >= leave;
    crossing.current?.setLevel(0, green ? 0 : 1);
    crossing.current?.setLevel(1, green ? 1 : 0);
  });

  return (
    <group>
      {/* The hotel. */}
      <Boxes items={hotel}>
        <shaderMaterial uniforms={uniforms.hotel} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
      </Boxes>
      <Windows panes={windows} />
      <Boxes items={eyebrows}>
        <shaderMaterial uniforms={uniforms.stripes} vertexShader={glowVertexShader} fragmentShader={glowFragmentShader} fog />
      </Boxes>
      {/* The racing stripes: the border tube running on along the parapet. */}
      <Boxes items={stripes}>
        <shaderMaterial uniforms={uniforms.stripes} vertexShader={glowVertexShader} fragmentShader={glowFragmentShader} fog />
      </Boxes>
      <mesh ref={pulse} position={[-100, 15.45, FACADE_Z + 0.42]} visible={false}>
        <boxGeometry args={[1.2, 1.2, 0.1]} />
        <meshBasicMaterial color={new Color("#ffffff").multiplyScalar(3)} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* The blade: enamel cabinet, neon faces both sides, the crossbar and the plaques. */}
      <mesh position={[BLADE_BOX.x, (BLADE_BOX.y0 + BLADE_BOX.y1) / 2, (BLADE_BOX.z0 + BLADE_BOX.z1) / 2]}>
        <boxGeometry args={[BLADE_BOX.t, BLADE_BOX.y1 - BLADE_BOX.y0, BLADE_BOX.z1 - BLADE_BOX.z0]} />
        <meshStandardMaterial color="#1d0f35" roughness={0.3} metalness={0.1} />
      </mesh>
      {art
        ? [-1, 1].map((side) => (
            <group key={side} position={[side * (BLADE_BOX.t / 2 + 0.04), PLANE.y, PLANE.z]} rotation-y={side * (Math.PI / 2)}>
              <mesh>
                <planeGeometry args={[PLANE.w, PLANE.h]} />
                <shaderMaterial uniforms={uniforms.blade} vertexShader={signVertexShader} fragmentShader={signFragmentShader} fog />
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <planeGeometry args={[PLANE.w, PLANE.h]} />
                <shaderMaterial
                  uniforms={uniforms.ray}
                  vertexShader={signVertexShader}
                  fragmentShader={signFragmentShader}
                  transparent
                  blending={AdditiveBlending}
                  depthWrite={false}
                  fog
                />
              </mesh>
            </group>
          ))
        : null}
      <mesh position={[0, CROSSBAR.y, (CROSSBAR.z0 + CROSSBAR.z1) / 2]}>
        <boxGeometry args={[0.7, CROSSBAR.h, CROSSBAR.z1 - CROSSBAR.z0]} />
        <meshStandardMaterial color="#1d0f35" roughness={0.3} metalness={0.1} />
      </mesh>
      {art ? <GlassPanels uniforms={uniforms.glass} /> : null}
      <Glows glows={bulbs} handle={bulbHandle} />

      {/* The promenade: deco lamp globes, palms backlit by the neon. */}
      <Boxes items={PROMENADE_LAMPS.map(([x, , z]) => ({ p: [x, 2.1, z] as Vec3, s: [0.14, 4.2, 0.14] as Vec3 }))}>
        <meshStandardMaterial color={palette.asphalt} roughness={0.5} metalness={0.4} />
      </Boxes>
      <Glows glows={lampGlows} />
      <NightPalms
        palms={(high
          ? [
              { position: [-12, 0, 4.6], rotation: 0.3, scale: 1.05, variant: 0 },
              { position: [-6, 0, 5.4], rotation: 1.9, scale: 0.85, variant: 2 },
              { position: [8, 0, 4.8], rotation: 3.1, scale: 1.1, variant: 1 },
              { position: [18, 0, 5.2], rotation: 0.9, scale: 0.95, variant: 3 },
            ]
          : [
              { position: [-12, 0, 4.6], rotation: 0.3, scale: 1.05, variant: 0 },
              { position: [8, 0, 4.8], rotation: 3.1, scale: 1.1, variant: 1 },
            ]) as { position: Vec3; rotation: number; scale: number; variant: number }[]}
      />
      {/* The pavement, the zebra crossing and its light: the stop's signal. */}
      <mesh position={[-4, 0.1, -6.7]}>
        <boxGeometry args={[80, 0.2, 2.6]} />
        <meshStandardMaterial color="#3a2d50" roughness={0.8} />
      </mesh>
      <mesh position={[-4, 0.08, 4.5]}>
        <boxGeometry args={[80, 0.16, 5.2]} />
        <meshStandardMaterial color="#3a2d50" roughness={0.8} />
      </mesh>
      <Boxes items={Array.from({ length: 8 }, (_, i) => ({ p: [5.5, 0.012, -4.6 + i * 0.85] as Vec3, s: [2.4, 0.02, 0.45] as Vec3 }))}>
        <meshStandardMaterial color="#b9b0cc" roughness={0.6} />
      </Boxes>
      <mesh position={[4.3, 1.3, 2.45]}>
        <boxGeometry args={[0.12, 2.6, 0.12]} />
        <meshStandardMaterial color={palette.asphalt} />
      </mesh>
      <Glows glows={signalGlows} handle={crossing} />
    </group>
  );
}

/** The crossbar's role on both sides, and the hanging plaques, from the glass atlas. */
function GlassPanels({ uniforms }: { uniforms: Record<string, { value: unknown }> }) {
  const rows = useMemo(() => {
    const uv = (row: readonly number[]) => [row[0] / GLASS.w, 1 - (row[1] + row[3]) / GLASS.h, (row[0] + row[2]) / GLASS.w, 1 - row[1] / GLASS.h];
    return { crossbar: uv(GLASS_ROWS.crossbar), plaque0: uv(GLASS_ROWS.plaque0), plaque1: uv(GLASS_ROWS.plaque1), lobby: uv(GLASS_ROWS.lobby), amenities: uv(GLASS_ROWS.amenities), door: uv(GLASS_ROWS.door) };
  }, []);
  const panels: { key: string; rect: number[]; p: Vec3; size: [number, number]; ry: number }[] = [
    { key: "cb-l", rect: rows.crossbar, p: [-0.37, CROSSBAR.y, (CROSSBAR.z0 + CROSSBAR.z1) / 2], size: [CROSSBAR.z1 - CROSSBAR.z0 - 0.2, CROSSBAR.h - 0.12], ry: -Math.PI / 2 },
    { key: "cb-r", rect: rows.crossbar, p: [0.37, CROSSBAR.y, (CROSSBAR.z0 + CROSSBAR.z1) / 2], size: [CROSSBAR.z1 - CROSSBAR.z0 - 0.2, CROSSBAR.h - 0.12], ry: Math.PI / 2 },
    { key: "p0", rect: rows.plaque0, p: [-0.08, 2.1, -7.6], size: [3.2, 0.48], ry: -Math.PI / 2 },
    { key: "p1", rect: rows.plaque1, p: [-0.08, 2.1, -4.4], size: [3.2, 0.48], ry: -Math.PI / 2 },
    { key: "lobby", rect: rows.lobby, p: [-12, 3.35, FACADE_Z + 0.95], size: [9, 0.9], ry: 0 },
    { key: "amen", rect: rows.amenities, p: [10, 3.35, FACADE_Z + 0.95], size: [8, 0.8], ry: 0 },
    { key: "door", rect: rows.door, p: [-4.5, 2.6, FACADE_Z + 0.08], size: [3.4, 0.36], ry: 0 },
  ];
  return (
    <group>
      {panels.map((panel) => (
        <mesh key={panel.key} position={panel.p} rotation-y={panel.ry}>
          <planeGeometry args={panel.size}>
            <GlassUv rect={panel.rect} />
          </planeGeometry>
          <shaderMaterial uniforms={uniforms} vertexShader={signVertexShader} fragmentShader={signFragmentShader} fog />
        </mesh>
      ))}
    </group>
  );
}

/** Points a plane's uv at one row of an atlas. */
function GlassUv({ rect }: { rect: number[] }) {
  const array = useMemo(() => new Float32Array([rect[0], rect[3], rect[2], rect[3], rect[0], rect[1], rect[2], rect[1]]), [rect]);
  return <bufferAttribute attach="attributes-uv" args={[array, 2]} />;
}

export const pwc: NightSet = {
  Set: PwcSet,
  board: [
    [-0.4, 24, BLADE_BOX.z0 - 1.6],
    [-0.4, 24, BLADE_BOX.z1 + 2.0],
    [-0.4, 1.8, BLADE_BOX.z1 + 2.0],
    [-0.4, 1.8, BLADE_BOX.z0 - 1.6],
  ],
  boardNormal: [-1, 0, 0],
  shots: (timeline) => [
    keyAt(timeline, "pwc.open", 0, { position: [-40, 2.2, 14], look: [0, 5.5, -4], fov: LENS.mm50 }),
    keyAt(timeline, "pwc.card0", 0.1, { position: [-40, 2.6, 14], look: [0, 8, -6], fov: LENS.mm50 }),
    keyAt(timeline, "pwc.card1", 1, { position: [-40, 9, 14], look: [0, 14, -6], fov: LENS.mm50 }),
  ],
  maxBack: 30,
  lights: [
    { position: [-1.5, 12, -3], color: "#ff4fa8", intensity: 140, distance: 45 },
    { position: [-12, 3, -6], color: "#ffb978", intensity: 50, distance: 30 },
  ],
  streaks: [
    { position: [-0.5, 10, -6.1], color: "#ff4fa8", level: 1.0 },
    { position: [-0.5, 6, -5], color: "#3be8ff", level: 0.6 },
    { position: [-0.5, 3.3, -6], color: "#ffe2a8", level: 0.7 },
    { position: [-16, 4.4, 3.2], color: "#dfe8ff", level: 0.5 },
    { position: [4.3, 2.75, 2.45], color: "#ff3a5c", level: 0.4 },
  ],
  kerbs: { near: 1.9, far: -5.4 },
};
