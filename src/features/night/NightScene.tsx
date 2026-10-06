"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import type { Group } from "three";
import { palette } from "@/design/tokens";
import { SceneErrorBoundary } from "@/features/hero/SceneErrorBoundary";
import type { QualityTier } from "@/features/hero/useQualityTier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StageTimeline } from "@/features/work/workTimeline";
import { CarNight } from "./CarNight";
import { NightEffects } from "./NightEffects";
import { NightRig } from "./NightRig";
import { NightSky } from "./NightSky";
import { night, setNightReadiness } from "./nightState";
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

  return (
    <Canvas
      key={tier}
      flat
      dpr={tier === "high" ? [1, 1.75] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 35, near: 0.25, far: 1200, position: [-6, 1.5, 9] }}
      aria-hidden
    >
      <color attach="background" args={[palette.night]} />
      <fog attach="fog" args={[palette.nightFog, FOG.near, FOG.far]} />
      <SetSwitch groups={groups} />
      <NightRig timeline={timeline} sets={SETS} />
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
          <CarNight timeline={timeline} tier={tier} />
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
      <ReadyReporter />
      <DevHandle />
      <NightEffects tier={tier} />
    </Canvas>
  );
}
