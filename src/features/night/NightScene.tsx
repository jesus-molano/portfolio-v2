"use client";

import { Environment, Lightformer, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { Group, Material, Mesh, Texture, WebGLRenderer, WebGLRenderTarget } from "three";
import { palette } from "@/design/tokens";
import { SceneErrorBoundary } from "@/features/hero/SceneErrorBoundary";
import { isWarmFrame } from "@/features/hero/scene/frameDriver";
import { PacedRoot } from "@/features/hero/scene/PacedRoot";
import { getQuality, getServerQuality, seedFromRenderer, subscribeQuality } from "@/features/hero/scene/qualityStore";
import { useCanvasDpr } from "@/features/hero/scene/useCanvasDpr";
import { compileAsComposed, createWarmTarget, uploadTextures, warmKey } from "@/features/hero/scene/warmup";
import type { QualityTier } from "@/features/hero/useQualityTier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StageTimeline } from "@/features/work/workTimeline";
import { CarDrive, CarNight } from "./CarNight";
import { NightEffects } from "./NightEffects";
import { NightRig } from "./NightRig";
import { NightSky } from "./NightSky";
import { getNightCovered, night, setNightReadiness } from "./nightState";
import { paintsPending } from "./paintSet";
import { NightPalmShapes } from "./parts/NightPalms";
import { boundTextures } from "./releaseTextures";
import { SETS } from "./sets/registry";
import { StopLights } from "./StopLights";
import { Street } from "./Street";

type Props = {
  tier: QualityTier;
  timeline: StageTimeline;
  work: Dictionary["work"];
  locale: Locale;
  /** Hands the renderer over once created (NightCanvas watches it for a lost context). */
  onCreated?: (state: { gl: WebGLRenderer }) => void;
};

const getStructure = () => getQuality().structure;
const getServerStructure = () => getServerQuality().structure;

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

/** Milliseconds between two looks at what is left to warm up. */
const WARM_EVERY_MS = 400;

/**
 * Warms every stop up before its cut: compiles its materials as the
 * composer draws them (compileAsComposed, in parallel where the GPU
 * allows) and uploads its textures while another stop is on screen, the
 * next one first, so the first frame of a stop never stalls on a shader or
 * a texture. A set that loads more later, or whose board art lands, is
 * warmed again. Every stop warm, nothing loading and no board still to
 * paint (paintsPending) is `night.warm`, which lets the opening cover rest
 * the canvas (nightCover.ts).
 */
function Warmup({ groups }: { groups: { current: (Group | null)[] } }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const warm = useRef(new Map<number, string>());
  const textures = useRef(new WeakSet<Texture>());
  const target = useRef<WebGLRenderTarget | null>(null);
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
  // The composer's kind of target, bound while it compiles; released with the canvas (a renderer's
  // listener on it would keep the whole renderer).
  useEffect(() => {
    const made = createWarmTarget();
    target.current = made;
    return () => {
      target.current = null;
      made.dispose();
      night.warm = false;
    };
  }, []);

  useFrame(() => {
    // It keeps looking while the frame loop runs (a few small traversals every WARM_EVERY_MS): a set's
    // art lands after its fonts and adds its meshes or its texture then, and a stop counted warm before
    // that compiled them in its first frame on screen. Timed on the page's clock: the scene's own stands
    // still while the canvas rests (frameDriver.ts), and R3F's used to start again from zero at every wake.
    const now = performance.now();
    if (busy.current || !target.current || now < lookAt.current) return;
    lookAt.current = now + WARM_EVERY_MS;
    const count = groups.current.length;
    let ready = 0;
    for (let k = 0; k < count; k += 1) {
      const i = (night.stop + 1 + k) % count;
      const group = groups.current[i];
      if (!group) continue;
      const key = warmKey(group);
      if (key === null) continue;
      if (warm.current.get(i) === key) {
        ready += 1;
        continue;
      }
      warm.current.set(i, key);
      night.warm = false;
      busy.current = true;
      uploadTextures(gl, group, textures.current);
      compileAsComposed(gl, group, camera, scene, target.current)
        .catch(() => undefined)
        .finally(() => {
          busy.current = false;
        });
      return;
    }
    night.warm = count > 0 && ready === count && !loadingRef.current && paintsPending() === 0;
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
    // A hidden frame (frameDriver `warmFrame`) is no frame of the picture: the stage waits for a real one.
    if (isWarmFrame()) return;
    frames.current += 1;
    night.frames += 1;
    if (frames.current === 4) setNightReadiness("ready");
  });
  useEffect(() => () => setNightReadiness("waiting"), []);
  return null;
}

/**
 * The car's paint mirrors a night of its own: violet sky, a pink glow,
 * sodium and cyan strips. Memoised, as the hero's SkyEnvironment is: drei
 * renders the cube again (six faces, and three.js filters it again)
 * whenever its children change, and inline they changed at every render
 * of the scene, each time the stage came on screen or its cover lifted.
 */
const NightEnvironment = memo(function NightEnvironment({ tier }: { tier: QualityTier }) {
  return (
    <Environment resolution={tier === "high" ? 128 : 64} frames={1} background={false}>
      <color attach="background" args={["#120a26"]} />
      <Lightformer form="rect" intensity={2.2} color={palette.magenta} position={[0, 2, -14]} scale={[30, 2, 1]} />
      <Lightformer form="rect" intensity={1.6} color={palette.sodiumNight} position={[-12, 6, 6]} scale={[6, 1, 1]} />
      <Lightformer form="rect" intensity={1.2} color={palette.cyan} position={[12, 5, 4]} scale={[5, 0.6, 1]} />
      <Lightformer form="rect" intensity={0.6} color={palette.violet} position={[0, 20, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
    </Environment>
  );
});

type WorldProps = { tier: QualityTier; timeline: StageTimeline; work: Dictionary["work"]; locale: Locale };

/**
 * Everything the night's canvas draws, the post aside. Memoised, and fed
 * only what changes the city (the tier, the timeline, the copy): the
 * quality level and the window's size re-render NightScene, and with it
 * the Canvas, which re-renders whatever it holds; here they stop at the
 * root, and none of them reconciles the five sets (the frame loop waking
 * and resting re-renders nothing at all: the frame driver reads it).
 */
const NightWorld = memo(function NightWorld({ tier, timeline, work, locale }: WorldProps) {
  const groups = useRef<(Group | null)[]>([]);
  return (
    <NightPalmShapes>
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.nightFog, FOG.near, FOG.far]} />
      <SetSwitch groups={groups} />
      {/* Steps the car toward the picture before the camera, which pans with it, and the street, which it lights. */}
      <CarDrive timeline={timeline} />
      <NightRig timeline={timeline} sets={SETS} parallax={tier === "high"} />
      <NightSky />
      <StopLights sets={SETS} />
      <NightEnvironment tier={tier} />
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
    </NightPalmShapes>
  );
});

/**
 * Whether the night draws every frame, read by the frame driver once a
 * frame after WorkStage has written the cover: the stage on screen
 * (NightCanvas's observer) and not under its own opaque night
 * (nightCover.ts).
 */
function nightWants(): boolean {
  return night.onScreen && !getNightCovered();
}

/** The canvas draws again after a rest (the stage back on screen, its cover lifting): the car lands on the picture (CarDrive). */
function wakeNight() {
  night.woke = true;
}

/**
 * The night city: five small sets, one per stop, of which only the one on
 * screen is visible; the street, the car, the sky and the lights are
 * shared and take the stop's look at each cut. It draws in the page's
 * frame (frameDriver.ts), only while the stage is on screen and not
 * covered.
 */
export function NightScene({ tier, timeline, work, locale, onCreated }: Props) {
  // The visit's quality level, the hero's (qualityStore.ts): a step down in either canvas holds in both.
  const dpr = useCanvasDpr(tier);
  const structure = useSyncExternalStore(subscribeQuality, getStructure, getServerStructure);

  return (
    <Canvas
      key={tier}
      flat
      dpr={dpr}
      // Measured on resize only: by default R3F re-measures its box on every scroll (a layout read) and,
      // as the box moves with the page, re-renders the whole scene tree about twenty times a second.
      resize={{ scroll: false }}
      // Drawn by the frame driver (PacedRoot), never by R3F's own loop.
      frameloop="never"
      // No depth on the canvas's own buffer: the composer draws the scene into its own target, with its
      // own depth, and only a full-screen pass ever reaches the screen.
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false, depth: false }}
      camera={{ fov: 35, near: 0.25, far: 1200, position: [-6, 1.5, 9] }}
      onCreated={(state) => {
        // Production skips reading each program's logs back on its first use (a wait on the driver each).
        state.gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
        // The hero's renderer has usually seeded the visit's level already; if it had none, this one does.
        seedFromRenderer(state.gl);
        onCreated?.(state);
      }}
      aria-hidden
    >
      <DisposeOnUnmount />
      <PacedRoot id="night" wants={nightWants} onWake={wakeNight} />
      <NightWorld tier={tier} timeline={timeline} work={work} locale={locale} />
      <NightEffects tier={tier} structure={structure} />
    </Canvas>
  );
}
