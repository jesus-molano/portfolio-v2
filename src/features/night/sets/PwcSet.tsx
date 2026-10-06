"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, type CanvasTexture, Color, type Mesh, UniformsLib, UniformsUtils } from "three";
import { palette } from "@/design/tokens";
import { createRandom } from "@/features/hero/scene/world";
import { glowFragmentShader, glowVertexShader } from "@/features/hero/shaders/neon";
import { fonts, loadFaces, toTexture } from "../artCanvas";
import { createFloods } from "../floods";
import type { Vec3 } from "../frame";
import { night } from "../nightState";
import { type BoxItem, Boxes } from "../parts/Boxes";
import { type Glow, type GlowHandle, Glows } from "../parts/Glows";
import { NightPalms } from "../parts/NightPalms";
import { type Pane, Windows } from "../parts/Windows";
import { structureFragmentShader } from "../shaders/board";
import { signFragmentShader, signVertexShader } from "../shaders/sign";
import { beatP } from "../timelineKeys";
import { LOBBY, PANE, pickPane } from "./art/windows";
import { BLADE, MARQUEE, MARQUEE_ROWS, paintBlade, paintDyingRay, paintMarquee } from "./art/pwc";
import { instancedBoardVertexShader } from "./instanced";
import type { NightSet, SetProps } from "./types";

/**
 * Stop 2, PwC (2023-2024): Ocean Drive hotel neon
 * on the islands' seafront. A pastel deco hotel and its vertical blade:
 * P, W and C stacked in pink neon on violet enamel, a crown with a fan of
 * rays, one of them dying (the only flicker, never in the name). Under it
 * the marquee: the role in neon over a readerboard with the season's bill. The border
 * tube runs on along the parapet as three magenta racing stripes. Armed,
 * the dying ray strikes and holds, the letters relight and a white pulse
 * runs along the stripes.
 */

const FACADE_Z = -8;
/**
 * The blade: double-sided, faces +-x, standing 1.4 m off the facade on steel
 * arms, so no eyebrow or stripe on the wall ever reaches its tubes.
 */
const BLADE_BOX = { x: 0, y0: 5.4, y1: 21.4, z0: -6.6, z1: -3.2, t: 0.6 } as const;
const PLANE = { h: BLADE.metresH, w: BLADE.metresW, y: BLADE_BOX.y0 + BLADE.metresH / 2, z: (BLADE_BOX.z0 + BLADE_BOX.z1) / 2 } as const;
/** The marquee under it: the role in neon over a readerboard, on both faces, under a lit canopy. */
const MARQUEE_BOX = { y0: 2.55, y1: 4.95, z0: -7.4, z1: -3.2, t: 0.7 } as const;
const CANOPY = { x: 3.2, y: 5.05, h: 0.3, z0: FACADE_Z, z1: -3.0 } as const;
const PARAPET = 16.4;
/** The lobby's sign over its windows, facing the street. */
const CHECK_IN = { x: -12, y: 3.42, w: 11.2, h: 1.4 } as const;

/** A rectangle on the blade's street face (-x), by its z and y extents. */
function onBlade(x: number, z0: number, z1: number, y0: number, y1: number): Vec3[] {
  return [
    [x, y1, z1],
    [x, y1, z0],
    [x, y0, z0],
    [x, y0, z1],
  ];
}
const PX_M = BLADE.metresH / BLADE.h;
const LETTER_Y = [0, 1, 2].map((i) => BLADE_BOX.y0 + BLADE.metresH / 2 + (BLADE.h / 2 - (520 + (2080 / 3) * (i + 0.5))) * PX_M);

/**
 * What the camera must frame at PwC, on the faces toward the oncoming car
 * (direction.test.ts): the blade's letters P, W and C, the readerboard
 * under the role, and the check-in sign with the years.
 */
export const PWC_FRAMING = {
  letters: LETTER_Y.map((y) => onBlade(-BLADE_BOX.t / 2, PLANE.z - 1.1, PLANE.z + 1.1, y - 1.05, y + 1.05)),
  reader: onBlade(-MARQUEE_BOX.t / 2, MARQUEE_BOX.z0 + 0.06, MARQUEE_BOX.z1 - 0.06, 2.7, 3.73),
  checkIn: [
    [CHECK_IN.x - CHECK_IN.w / 2, CHECK_IN.y + CHECK_IN.h / 2, FACADE_Z + 0.72],
    [CHECK_IN.x + CHECK_IN.w / 2, CHECK_IN.y + CHECK_IN.h / 2, FACADE_Z + 0.72],
    [CHECK_IN.x + CHECK_IN.w / 2, CHECK_IN.y - CHECK_IN.h / 2, FACADE_Z + 0.72],
    [CHECK_IN.x - CHECK_IN.w / 2, CHECK_IN.y - CHECK_IN.h / 2, FACADE_Z + 0.72],
  ] as Vec3[],
};

/** The hotel: a body, deco parapet steps, eyebrows with lit lips and fluted fins, in hotel-local metres. */
function hotelItems(): BoxItem[] {
  const items: BoxItem[] = [];
  items.push({ p: [-4, PARAPET / 2, FACADE_Z - 7], s: [64, PARAPET, 14] });
  items.push({ p: [-4, PARAPET + 1.2, FACADE_Z - 7.5], s: [24, 2.4, 12] });
  items.push({ p: [-4, PARAPET + 3.2, FACADE_Z - 8], s: [10, 1.8, 10] });
  for (const y of [4.3, 8.3, 12.3]) items.push({ p: [-4, y, FACADE_Z + 0.45], s: [64, 0.22, 0.9] });
  for (let x = -34; x <= 26; x += 6) items.push({ p: [x, PARAPET / 2 + 0.5, FACADE_Z + 0.25], s: [0.5, PARAPET + 1, 0.5] });
  // The canopy over the entrance and the steel arms that hold the blade off the wall.
  items.push({ p: [0, CANOPY.y, (CANOPY.z0 + CANOPY.z1) / 2], s: [CANOPY.x * 2, CANOPY.h, CANOPY.z1 - CANOPY.z0] });
  for (const y of [7.2, 12.4, 17.6]) {
    items.push({ p: [0, y, (FACADE_Z + BLADE_BOX.z0) / 2], s: [0.22, 0.22, BLADE_BOX.z0 - FACADE_Z + 0.2] });
    items.push({ p: [0, y - 0.7, FACADE_Z + 0.55], s: [0.12, 1.5, 0.12], r: [0.75, 0, 0] });
  }
  return items;
}

/** Trim in a darker plaster: a terrazzo plinth, sills under the rooms, the door's surround. */
function trimItems(): BoxItem[] {
  const items: BoxItem[] = [{ p: [-4, 0.35, FACADE_Z + 0.12], s: [64, 0.7, 0.3] }];
  for (let floor = 1; floor < 4; floor += 1) {
    const y = floor * 4 + 1.7 - 1.0;
    for (let x = -32.2; x < 26; x += 2) {
      if (Math.abs((x + 34) % 6) < 0.6 || (x > -1.4 && x < 1.4)) continue;
      items.push({ p: [x, y, FACADE_Z + 0.14], s: [1.25, 0.14, 0.3] });
    }
  }
  // The door surround: two fluted jambs and a lintel under the canopy.
  for (const x of [-1.85, 1.85]) items.push({ p: [x, 1.45, FACADE_Z + 0.2], s: [0.4, 2.9, 0.4] });
  items.push({ p: [0, 3.05, FACADE_Z + 0.2], s: [4.1, 0.35, 0.4] });
  // Planters either side of the steps.
  for (const x of [-3.0, 3.0]) items.push({ p: [x, 0.45, FACADE_Z + 0.9], s: [1.1, 0.9, 1.1] });
  return items;
}

/** Shrubs in the planters: clipped balls. */
const SHRUBS: BoxItem[] = [-3.0, 3.0].map((x) => ({ p: [x, 1.15, FACADE_Z + 0.9] as Vec3, s: [1.25, 0.8, 1.25] as Vec3 }));

/** The café's awning: candy stripes sloping out over the terrace. */
function awningItems(): BoxItem[] {
  const items: BoxItem[] = [];
  for (let i = 0; i < 12; i += 1) {
    const x = 5.6 + i * 0.9;
    const color = i % 2 ? "#f6d8c8" : "#e2507e";
    items.push({ p: [x, 3.35, FACADE_Z + 0.75], s: [0.9, 0.05, 1.6], r: [0.42, 0, 0], color });
    items.push({ p: [x, 2.85, FACADE_Z + 1.47], s: [0.9, 0.3, 0.04], color });
  }
  return items;
}

/** Windows: three per bay per floor, rooms from the hotel's mix, seeded; the lobby, the door and the café below. */
function windowPanes(): Pane[] {
  const random = createRandom(2023);
  const panes: Pane[] = [];
  for (let floor = 1; floor < 4; floor += 1) {
    const y = floor * 4 + 1.7;
    let beside = -1;
    for (let x = -32.2; x < 26; x += 2) {
      if (Math.abs((x + 34) % 6) < 0.6) continue;
      if (x > -1.4 && x < 1.4) continue;
      const look = pickPane(random, "hotel", 0.55, beside);
      beside = look.cell;
      panes.push({ p: [x, y, FACADE_Z + 0.06], s: [1.0, 1.8], ...look });
    }
  }
  // The lobby behind its sign, the glass doors under the canopy, the café under its awning.
  // The lobby is one room across its four panes (painted whole, art/windows.ts LOBBY); the doors show its desk.
  LOBBY.forEach((cell, i) => panes.push({ p: [-15.75 + i * 2.5, 1.55, FACADE_Z + 0.06], s: [2.4, 2.5], cell, gain: 1 }));
  for (const x of [-0.82, 0.82]) panes.push({ p: [x, 1.4, FACADE_Z + 0.06], s: [1.5, 2.8], cell: x < 0 ? PANE.lobbyB : PANE.lobbyC, gain: 1.1 });
  for (let i = 0; i < 4; i += 1) panes.push({ p: [6.2 + i * 2.6, 1.45, FACADE_Z + 0.06], s: [2.5, 2.3], cell: i % 2 ? PANE.cafeCounter : PANE.cafeTable, flip: i === 2 });
  return panes;
}

/** The cyan strip under each eyebrow's lip, lighting the band of wall below it. */
function eyebrowLights(): BoxItem[] {
  return [4.3, 8.3, 12.3].map((y) => ({ p: [-4, y - 0.13, FACADE_Z + 0.88] as Vec3, s: [64, 0.05, 0.05] as Vec3, color: "#5fe8e0" }));
}

/** The chaser bulbs round the marquee's neon fascia, both faces, in three phases. */
function bulbGlows(): Glow[] {
  const glows: Glow[] = [];
  const top = MARQUEE_BOX.y1 + 0.05;
  const bottom = MARQUEE_BOX.y1 - 1.18;
  for (const side of [-1, 1]) {
    for (let z = MARQUEE_BOX.z0 + 0.1; z <= MARQUEE_BOX.z1 - 0.1 + 1e-6; z += 0.3) {
      for (const y of [top, bottom]) glows.push({ position: [side * (MARQUEE_BOX.t / 2 + 0.1), y, z], size: 0.26, color: "#ffe2a8", intensity: 2.2 });
    }
  }
  return glows;
}

/** Downlights in the canopy's soffit, over the steps. */
const SOFFIT: Glow[] = [-2.2, -0.7, 0.7, 2.2].flatMap((x) => [-6.9, -4.4].map((z) => ({ position: [x, CANOPY.y - CANOPY.h / 2 - 0.05, z] as Vec3, size: 0.45, color: "#ffe6c0", intensity: 2.4 })));

// Clear of the lines from the cameras to the blade, the marquee, the years over the lobby and the car.
const PROMENADE_LAMPS: Vec3[] = [-33, 14].map((x) => [x, 4.4, 3.2] as Vec3);

function PwcSet({ work, tier, index, timeline }: SetProps) {
  const high = tier === "high";
  const board = work.stops.pwc.board;
  const [art, setArt] = useState<{ blade: CanvasTexture; ray: CanvasTexture; glass: CanvasTexture } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: { blade: CanvasTexture; ray: CanvasTexture; glass: CanvasTexture } | null = null;
    loadFaces([`800 200px ${fonts.display()}`, `400 120px ${fonts.script()}`, `700 50px ${fonts.mono()}`, `400 100px ${fonts.condensed()}`]).then(() => {
      if (cancelled) return;
      made = {
        blade: toTexture(paintBlade(board.blade), 8),
        ray: toTexture(paintDyingRay(), 4),
        glass: toTexture(paintMarquee(board), 8),
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
      checkIn: sign(art?.glass ?? null, 1.3, 0.4),
      // The readerboard's milk glass glows, but not so hot that the bloom eats its letters.
      reader: sign(art?.glass ?? null, 1.08, 0.4),
      trim: { ...fog(), ...floods, uColor: { value: new Color("#b67a98") }, uAmbient: { value: new Color("#33264f") }, uRim: { value: new Color("#7a4a8a") }, uLift: { value: 0.6 } },
      planting: { ...fog(), ...floods, uColor: { value: new Color("#5e8270") }, uAmbient: { value: new Color("#3a3458") }, uRim: { value: new Color("#8a7ab0") }, uLift: { value: 1.3 } },
      stripes: { ...fog(), uIntensity: { value: 1 }, uFogAmount: { value: 0.3 } },
    };
  }, [floods, art]);

  const hotel = useMemo(() => hotelItems(), []);
  const trim = useMemo(() => trimItems(), []);
  const awning = useMemo(() => awningItems(), []);
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
      <Boxes items={trim}>
        <shaderMaterial uniforms={uniforms.trim} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
      </Boxes>
      <Boxes items={SHRUBS} geometry={<sphereGeometry args={[0.5, 12, 8]} />}>
        <shaderMaterial uniforms={uniforms.planting} vertexShader={instancedBoardVertexShader} fragmentShader={structureFragmentShader} fog />
      </Boxes>
      <Boxes items={awning}>
        <meshStandardMaterial roughness={0.7} emissive="#3a1020" />
      </Boxes>
      <Glows glows={SOFFIT} />
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

      {/* The blade: enamel cabinet, neon faces both sides; the marquee under it. */}
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
      <mesh position={[0, (MARQUEE_BOX.y0 + MARQUEE_BOX.y1) / 2, (MARQUEE_BOX.z0 + MARQUEE_BOX.z1) / 2]}>
        <boxGeometry args={[MARQUEE_BOX.t, MARQUEE_BOX.y1 - MARQUEE_BOX.y0, MARQUEE_BOX.z1 - MARQUEE_BOX.z0]} />
        <meshStandardMaterial color="#1d0f35" roughness={0.3} metalness={0.1} />
      </mesh>
      {art ? <MarqueePanels fascia={uniforms.glass} reader={uniforms.reader} checkIn={uniforms.checkIn} /> : null}
      <Glows glows={bulbs} handle={bulbHandle} />

      {/* The promenade: deco lamp globes, palms backlit by the neon. */}
      <Boxes items={PROMENADE_LAMPS.map(([x, , z]) => ({ p: [x, 2.1, z] as Vec3, s: [0.14, 4.2, 0.14] as Vec3 }))}>
        <meshStandardMaterial color={palette.asphalt} roughness={0.5} metalness={0.4} />
      </Boxes>
      <Glows glows={lampGlows} />
      <NightPalms
        // Past the hotel's door, down the promenade: on the near side before it a trunk stood in front of the
        // car, the years over the lobby or the marquee in one shot or another.
        palms={(high
          ? [
              { position: [8, 0, 4.8], rotation: 3.1, scale: 1.1, variant: 1 },
              { position: [18, 0, 5.2], rotation: 0.9, scale: 0.95, variant: 3 },
              { position: [26, 0, 4.6], rotation: 0.3, scale: 1.05, variant: 0 },
              { position: [33, 0, 5.4], rotation: 1.9, scale: 0.85, variant: 2 },
            ]
          : [
              { position: [8, 0, 4.8], rotation: 3.1, scale: 1.1, variant: 1 },
              { position: [26, 0, 4.6], rotation: 0.3, scale: 1.05, variant: 0 },
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

/** The marquee's two faces (neon fascia over the readerboard) and the lobby's check-in sign, from one atlas. */
function MarqueePanels({ fascia, reader, checkIn }: Record<"fascia" | "reader" | "checkIn", Record<string, { value: unknown }>>) {
  const rows = useMemo(() => {
    const uv = (row: readonly number[]) => [row[0] / MARQUEE.w, 1 - (row[1] + row[3]) / MARQUEE.h, (row[0] + row[2]) / MARQUEE.w, 1 - row[1] / MARQUEE.h];
    return { fascia: uv(MARQUEE_ROWS.fascia), reader: uv(MARQUEE_ROWS.reader), checkIn: uv(MARQUEE_ROWS.checkIn) };
  }, []);
  const width = MARQUEE_BOX.z1 - MARQUEE_BOX.z0 - 0.12;
  const fasciaH = (width * MARQUEE_ROWS.fascia[3]) / MARQUEE_ROWS.fascia[2];
  const readerH = (width * MARQUEE_ROWS.reader[3]) / MARQUEE_ROWS.reader[2];
  const z = (MARQUEE_BOX.z0 + MARQUEE_BOX.z1) / 2;
  const fasciaY = MARQUEE_BOX.y1 - 0.06 - fasciaH / 2;
  const readerY = fasciaY - fasciaH / 2 - 0.04 - readerH / 2;
  const panels: { key: string; rect: number[]; p: Vec3; size: [number, number]; ry: number; uniforms: Record<string, { value: unknown }> }[] = [];
  for (const side of [-1, 1]) {
    const x = side * (MARQUEE_BOX.t / 2 + 0.02);
    const ry = side * (Math.PI / 2);
    panels.push({ key: `f${side}`, rect: rows.fascia, p: [x, fasciaY, z], size: [width, fasciaH], ry, uniforms: fascia });
    panels.push({ key: `r${side}`, rect: rows.reader, p: [x, readerY, z], size: [width, readerH], ry, uniforms: reader });
  }
  panels.push({ key: "check-in", rect: rows.checkIn, p: [CHECK_IN.x, CHECK_IN.y, FACADE_Z + 0.72], size: [CHECK_IN.w, CHECK_IN.h], ry: 0, uniforms: checkIn });
  return (
    <group>
      {panels.map((panel) => (
        <mesh key={panel.key} position={panel.p} rotation-y={panel.ry}>
          <planeGeometry args={panel.size}>
            <GlassUv rect={panel.rect} />
          </planeGeometry>
          <shaderMaterial uniforms={panel.uniforms} vertexShader={signVertexShader} fragmentShader={signFragmentShader} fog />
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
    [-0.4, BLADE_BOX.y0 + BLADE.metresH, BLADE_BOX.z0 - 1.6],
    [-0.4, BLADE_BOX.y0 + BLADE.metresH, BLADE_BOX.z1 + 2.0],
    [-0.4, 1.8, BLADE_BOX.z1 + 2.0],
    [-0.4, 1.8, BLADE_BOX.z0 - 1.6],
  ],
  boardNormal: [-1, 0, 0],
  // On a phone: the blade and its marquee, the years over the lobby (the check-in sign) and the car at the line.
  subject: (_pose, _p, car) => [
    [-0.4, BLADE_BOX.y0 + BLADE.metresH, BLADE_BOX.z0 - 1.6],
    [-0.4, 1.8, BLADE_BOX.z1 + 2.0],
    [CHECK_IN.x - CHECK_IN.w / 2, CHECK_IN.y + CHECK_IN.h / 2, FACADE_Z + 0.72],
    [CHECK_IN.x + CHECK_IN.w / 2, CHECK_IN.y - CHECK_IN.h / 2, FACADE_Z + 0.72],
    ...car,
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
    { position: [-33, 4.4, 3.2], color: "#dfe8ff", level: 0.5 },
    { position: [4.3, 2.75, 2.45], color: "#ff3a5c", level: 0.4 },
  ],
  kerbs: { near: 1.9, far: -5.4 },
};
