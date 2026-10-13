"use client";

import { Environment, Lightformer, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { Group, Material, Mesh, Texture, WebGLRenderer, WebGLRenderTarget } from "three";
import { palette } from "@/design/tokens";
import { SceneErrorBoundary } from "@/features/hero/SceneErrorBoundary";
import { isWarmFrame, warmFrame } from "@/features/hero/scene/frameDriver";
import { PacedRoot } from "@/features/hero/scene/PacedRoot";
import { getQuality, getServerQuality, seedFromRenderer, subscribeQuality } from "@/features/hero/scene/qualityStore";
import { useCanvasDpr } from "@/features/hero/scene/useCanvasDpr";
import { compileAsComposed, createWarmTarget, uploadTextures, warmKey } from "@/features/hero/scene/warmup";
import type { QualityTier } from "@/features/hero/useQualityTier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { createIdleLoop } from "@/lib/idle";
import type { StageTimeline } from "@/features/work/workTimeline";
import { stopOrder } from "./artQueue";
import { CarDrive, CarNight } from "./CarNight";
import { NightEffects } from "./NightEffects";
import { NightRig } from "./NightRig";
import { NightSky } from "./NightSky";
import { getNightCovered, night, setNightReadiness } from "./nightState";
import { onPaintsChange, paintsPending } from "./paintSet";
import { NightPalmShapes } from "./parts/NightPalms";
import { paintWindowsAhead } from "./parts/Windows";
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

/** Milliseconds between two looks while something is still on its way in (a model, a board, its React update). */
const WARM_EVERY_MS = 400;

/** Looks in a row that find every part warm before the warm-up rests (a board's set takes its art a moment after it is painted). */
const STABLE_LOOKS = 2;

/** The longest a warm-up step waits for an idle period, and what must be left of one to start a step (ms). */
const WARM_IDLE = { timeoutMs: 500, reserveMs: 4 } as const;

type Parts = { shared: { current: Group | null }; groups: { current: (Group | null)[] } };

/**
 * Warms the night up while nobody waits on it: its textures uploaded and
 * its materials compiled as the composer draws them (compileAsComposed, in
 * parallel where the GPU allows), in idle periods (lib/idle.ts), a texture
 * or a part a step: the shared street, car and sky first, then the stops
 * in the order she reaches them (stopOrder), from the moment it mounts,
 * well before the stage is on screen. Then, once, a hidden frame
 * (frameDriver `warmFrame`) compiles the post's passes and uploads the
 * stop's buffers under the frame loop's rest, so the first frame she sees
 * compiles nothing. It used to run in the frame loop, so nothing warmed
 * before the canvas drew, and the first frame on screen compiled the whole
 * city in one long task as she scrolled into it. A part that loads more
 * later, or whose board art lands, is warmed again. Every part warm,
 * nothing loading and no board still to paint (paintsPending) is
 * `night.warm`, which lets the opening cover rest the canvas
 * (nightCover.ts); found so twice in a row, it rests until a model or a
 * board comes in.
 */
function Warmup({ shared, groups }: Parts) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const get = useThree((state) => state.get);
  // Anything still loading (a set's model or texture) may add meshes to a part already warmed.
  const loading = useProgress((state) => state.active);
  const loadingRef = useRef(loading);
  const lookAgain = useRef<(() => void) | null>(null);
  const framed = useRef(false);
  useEffect(() => {
    loadingRef.current = loading;
    // Something new loads: not warm until it is in; look again either way.
    if (loading) night.warm = false;
    lookAgain.current?.();
  }, [loading]);

  // A frame drawn, hidden or not, has compiled the post: no hidden one is needed after it.
  useFrame(() => {
    framed.current = true;
  });

  useEffect(() => {
    // The composer's kind of target, bound while it compiles; released with the canvas (a renderer's
    // listener on it would keep the whole renderer).
    const target = createWarmTarget();
    const warm = new WeakMap<Group, string>();
    const textures = new WeakSet<Texture>();
    let busy = false;
    let stable = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const step = (): boolean => {
      // One part compiles at a time: the loop is woken as it settles.
      if (busy) return false;
      const sets = groups.current;
      const parts = [shared.current, ...stopOrder(sets.length, night.stop).map((i) => sets[i])];
      let ready = 0;
      for (const group of parts) {
        if (!group) continue;
        const key = warmKey(group);
        if (key === null) continue;
        if (warm.get(group) === key) {
          ready += 1;
          continue;
        }
        night.warm = false;
        stable = 0;
        // A texture a step: an atlas is a long upload on its own.
        if (uploadTextures(gl, group, textures, 1) > 0) return true;
        warm.set(group, key);
        busy = true;
        compileAsComposed(gl, group, camera, scene, target)
          .catch(() => undefined)
          .finally(() => {
            busy = false;
            idle.wake();
          });
        return false;
      }
      const all = ready === parts.length && !loadingRef.current;
      night.warm = all && paintsPending() === 0;
      // Warm before it ever drew: one hidden frame for the post (the driver draws none if the canvas draws anyway).
      if (all && !framed.current) warmFrame(get);
      stable = night.warm ? stable + 1 : 0;
      // Something is still on its way: look again shortly. Warm twice over, it rests until woken.
      if (stable < STABLE_LOOKS && timer === undefined) {
        timer = setTimeout(() => {
          timer = undefined;
          idle.wake();
        }, WARM_EVERY_MS);
      }
      return false;
    };

    const idle = createIdleLoop(step, WARM_IDLE);
    lookAgain.current = () => {
      stable = 0;
      idle.wake();
    };
    // A set asks for its boards, or one lands: the night is not warm until it is in.
    const offPaints = onPaintsChange(() => {
      if (paintsPending() > 0) night.warm = false;
      lookAgain.current?.();
    });
    idle.wake();
    return () => {
      offPaints();
      lookAgain.current = null;
      idle.stop();
      if (timer !== undefined) clearTimeout(timer);
      target.dispose();
      night.warm = false;
    };
  }, [gl, scene, camera, get, shared, groups]);
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
  const shared = useRef<Group>(null);
  return (
    <NightPalmShapes>
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.nightFog, FOG.near, FOG.far]} />
      <SetSwitch groups={groups} />
      {/* Steps the car toward the picture before the camera, which pans with it, and the street, which it lights. */}
      <CarDrive timeline={timeline} />
      <NightRig timeline={timeline} sets={SETS} parallax={tier === "high"} />
      <NightEnvironment tier={tier} />
      {/* What every stop draws, in a group of its own: Warmup warms it first. */}
      <group ref={shared}>
        <NightSky />
        <StopLights sets={SETS} />
        <Street sets={SETS} />
        <SceneErrorBoundary name="Night car">
          <Suspense fallback={null}>
            <CarNight />
          </Suspense>
        </SceneErrorBoundary>
      </group>
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
      <Warmup shared={shared} groups={groups} />
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
 * What the night does ahead of its mount, once its code is in
 * (prefetch.ts): its window atlas, painted a room per idle slice.
 */
export function paintNightAhead(): void {
  paintWindowsAhead();
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
