"use client";

import { Environment, Lightformer, PerformanceMonitor, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Group, Material, Mesh, Texture, WebGLRenderer } from "three";
import { palette } from "@/design/tokens";
import { SceneErrorBoundary } from "@/features/hero/SceneErrorBoundary";
import { FULL_DPR } from "@/features/hero/scene/degrade";
import type { QualityTier } from "@/features/hero/useQualityTier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StageTimeline } from "@/features/work/workTimeline";
import { CarDrive, CarNight } from "./CarNight";
import { NightEffects } from "./NightEffects";
import { NightRig } from "./NightRig";
import { NightSky } from "./NightSky";
import { night, setNightReadiness } from "./nightState";
import { boundTextures } from "./releaseTextures";
import { SETS } from "./sets/registry";
import { StopLights } from "./StopLights";
import { Street } from "./Street";

type Props = {
  tier: QualityTier;
  /** False while the stage is out of view or covered: the loop stops. */
  active: boolean;
  timeline: StageTimeline;
  work: Dictionary["work"];
  locale: Locale;
};

/** Production only, as in the hero: a dev build's frame rate says nothing about the device. */
const WATCH_FRAME_RATE = process.env.NODE_ENV === "production";

/** One fog for every stop: it is the same island all night. */
const FOG = { near: 30, far: 260 } as const;

/** Shows only the stop on screen. */
function SetSwitch({ groups }: { groups: { current: (Group | null)[] } }) {
  const last = useRef(-1);
  useFrame(() => {
    if (night.stop === last.current) return;
    last.current = night.stop;
    groups.current.forEach((group, i) => {
      if (group) group.visible = i === night.stop;
    });
  });
  return null;
}

/** Seconds between two looks at what is left to warm up. */
const WARM_EVERY = 0.4;

function meshCount(group: Group): number {
  let count = 0;
  group.traverse((object) => {
    if ((object as Mesh).isMesh) count += 1;
  });
  return count;
}

/** Uploads every texture a group's materials use (maps and shader uniforms), once. */
function uploadTextures(gl: WebGLRenderer, group: Group, seen: WeakSet<Texture>) {
  const upload = (value: unknown) => {
    const texture = value as Texture | null;
    if (!texture || !texture.isTexture || seen.has(texture)) return;
    seen.add(texture);
    gl.initTexture(texture);
  };
  group.traverse((object) => {
    const material = (object as Mesh).material as Material | Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(m)) upload(value);
      const uniforms = (m as { uniforms?: Record<string, { value: unknown }> }).uniforms;
      if (uniforms) {
        for (const uniform of Object.values(uniforms)) {
          if (Array.isArray(uniform?.value)) uniform.value.forEach(upload);
          else upload(uniform?.value);
        }
      }
    }
  });
}

/**
 * Warms every stop up before its cut: compiles its materials (in parallel
 * where the GPU allows) and uploads its textures while another stop is on
 * screen, the next one first, so the first frame of a stop never stalls on
 * a shader or a texture. A set that loads more later is warmed again.
 * Every stop warm and nothing loading is `night.warm`, which lets the
 * opening cover rest the canvas (nightCover.ts).
 */
function Warmup({ groups }: { groups: { current: (Group | null)[] } }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const warm = useRef(new Map<number, number>());
  const textures = useRef(new WeakSet<Texture>());
  const busy = useRef(false);
  const lookAt = useRef(0);
  // Anything still loading (a set's model or texture) may add meshes to a set already warmed.
  const loading = useProgress((state) => state.active);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
    // Something new loads: look again once it is in.
    if (loading) night.warm = false;
  }, [loading]);
  useEffect(
    () => () => {
      night.warm = false;
    },
    [],
  );

  useFrame(({ clock }) => {
    // It keeps looking while the frame loop runs (a few small traversals every WARM_EVERY): a set's
    // art lands after its fonts and adds its meshes then, and a stop counted warm before that
    // compiled them in its first frame on screen.
    if (busy.current || clock.elapsedTime < lookAt.current) return;
    lookAt.current = clock.elapsedTime + WARM_EVERY;
    const count = groups.current.length;
    let ready = 0;
    for (let k = 0; k < count; k += 1) {
      const i = (night.stop + 1 + k) % count;
      const group = groups.current[i];
      if (!group) continue;
      const meshes = meshCount(group);
      if (meshes === 0) continue;
      if (warm.current.get(i) === meshes) {
        ready += 1;
        continue;
      }
      warm.current.set(i, meshes);
      night.warm = false;
      busy.current = true;
      uploadTextures(gl, group, textures.current);
      gl.compileAsync(group, camera, scene)
        .catch(() => undefined)
        .finally(() => {
          busy.current = false;
        });
      return;
    }
    night.warm = count > 0 && ready === count && !loadingRef.current;
  });
  return null;
}

/**
 * Releases, as the night's renderer goes, the textures its programs bound
 * that outlive it (releaseTextures.ts): the window atlas, three's shared
 * DFG lookup table, the hero car's rim blur. Each keeps its image; the
 * next renderer to draw one (the hero's on its next frame, the next night)
 * uploads it again. The first child of the canvas, so its cleanup runs
 * while the scene still holds every object.
 */
function DisposeOnUnmount() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useLayoutEffect(
    () => () => {
      const uniforms: Record<string, { value: unknown } | undefined>[] = [];
      scene.traverse((object) => {
        const material = (object as Mesh).material as Material | Material[] | undefined;
        if (!material) return;
        for (const m of Array.isArray(material) ? material : [material]) {
          const compiled = (gl.properties.get(m) as { uniforms?: Record<string, { value: unknown } | undefined> }).uniforms;
          if (compiled) uniforms.push(compiled);
        }
      });
      boundTextures(uniforms).forEach((texture) => texture.dispose());
    },
    [gl, scene],
  );
  return null;
}

type DevWindow = Window & { __vaNight?: { info: () => Record<string, number> } };

/** Dev only: renderer counts of the last frame, for the budget audit (tools/capture). */
function DevHandle() {
  const gl = useThree((state) => state.gl);
  // Count the whole frame, post included: reset at its start, read after it.
  useFrame(() => {
    if (process.env.NODE_ENV !== "production") gl.info.reset();
  }, -100);
  // eslint-disable-next-line react-hooks/immutability -- the renderer's counters, dev only
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    // eslint-disable-next-line react-hooks/immutability -- the renderer's counters, dev only
    gl.info.autoReset = false;
    (window as DevWindow).__vaNight = {
      info: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
        programs: gl.info.programs?.length ?? 0,
      }),
    };
    return () => {
      gl.info.autoReset = true;
      delete (window as DevWindow).__vaNight;
    };
  }, [gl]);
  return null;
}

/** Reports the night ready after a few settled frames (shaders compiled, models in). */
function ReadyReporter() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 4) setNightReadiness("ready");
  });
  useEffect(() => () => setNightReadiness("waiting"), []);
  return null;
}

/**
 * The night city: five small sets, one per stop, of which only the one on
 * screen is visible; the street, the car, the sky and the lights are
 * shared and take the stop's look at each cut.
 */
export function NightScene({ tier, active, timeline, work, locale }: Props) {
  const groups = useRef<(Group | null)[]>([]);
  // The hero's pixels (degrade.ts), and its one step down on a slow device: dpr 1, never back up.
  const [slow, setSlow] = useState(false);
  // The frame loop wakes as the stage comes back on screen: the car lands on the picture (CarDrive).
  useEffect(() => {
    if (active) night.woke = true;
  }, [active]);

  return (
    <Canvas
      key={tier}
      flat
      dpr={slow ? 1 : FULL_DPR}
      // Measured on resize only: by default R3F re-measures its box on every scroll (a layout read) and,
      // as the box moves with the page, re-renders the whole scene tree about twenty times a second.
      resize={{ scroll: false }}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 35, near: 0.25, far: 1200, position: [-6, 1.5, 9] }}
      aria-hidden
    >
      <DisposeOnUnmount />
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.nightFog, FOG.near, FOG.far]} />
      {WATCH_FRAME_RATE && active && !slow ? <PerformanceMonitor onDecline={() => setSlow(true)} /> : null}
      <SetSwitch groups={groups} />
      {/* Steps the car toward the picture before the camera, which pans with it, and the street, which it lights. */}
      <CarDrive timeline={timeline} />
      <NightRig timeline={timeline} sets={SETS} parallax={tier === "high"} />
      <NightSky />
      <StopLights sets={SETS} />
      {/* The car's paint mirrors a night of its own: violet sky, a pink glow, sodium and cyan strips. */}
      <Environment resolution={tier === "high" ? 128 : 64} frames={1} background={false}>
        <color attach="background" args={["#120a26"]} />
        <Lightformer form="rect" intensity={2.2} color={palette.magenta} position={[0, 2, -14]} scale={[30, 2, 1]} />
        <Lightformer form="rect" intensity={1.6} color={palette.sodiumNight} position={[-12, 6, 6]} scale={[6, 1, 1]} />
        <Lightformer form="rect" intensity={1.2} color={palette.cyan} position={[12, 5, 4]} scale={[5, 0.6, 1]} />
        <Lightformer form="rect" intensity={0.6} color={palette.violet} position={[0, 20, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
      </Environment>
      <Street sets={SETS} />
      <SceneErrorBoundary name="Night car">
        <Suspense fallback={null}>
          <CarNight />
        </Suspense>
      </SceneErrorBoundary>
      {SETS.map((set, i) => (
        <group
          key={i}
          ref={(group) => {
            groups.current[i] = group;
          }}
          visible={i === 0}
        >
          <SceneErrorBoundary name={`Night set ${i + 1}`}>
            <Suspense fallback={null}>
              <set.Set tier={tier} locale={locale} work={work} timeline={timeline} index={i} />
            </Suspense>
          </SceneErrorBoundary>
        </group>
      ))}
      <Warmup groups={groups} />
      <ReadyReporter />
      <DevHandle />
      <NightEffects tier={tier} />
    </Canvas>
  );
}
