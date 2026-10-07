"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, type Group, type Object3D, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { CAR_URL, prepareCar } from "@/features/hero/scene/Car";
import { CAR_MODEL, WHEEL_RADIUS } from "@/features/hero/scene/carModel";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { StageTimeline } from "@/features/work/workTimeline";
import { stepCarMotion } from "./carMotion";
import { HEADLIGHT } from "./carPath";
import { cloneOwned } from "./cloneBare";
import { night } from "./nightState";
import { NightDriver } from "./NightDriver";
import { type Glow, type GlowHandle, Glows } from "./parts/Glows";
import { beamFragmentShader, beamVertexShader } from "./shaders/beam";

type ProbeWindow = Window & {
  /** Set to [] to log the car every frame (tools that measure its motion): time, picture, x, pace, pitch, stop, brake lights. */
  __vaCarProbe?: { t: number; p: number; x: number; pace: number; pitch: number; stop: number; brake: number }[];
};

const WHEEL_NAMES = ["wheel_front_l", "wheel_front_r", "wheel_rear_l", "wheel_rear_r"];

/**
 * Lamps in the car's own frame at night (x forward, y up, z to its right):
 * the headlights' warm glow, and the tail and brake lights in a pink-red,
 * never the LIVE red (palette.onAir is the tally's alone).
 */
const LAMPS: Glow[] = [
  { position: [2.12, 0.62, -0.62], size: 0.9, color: HEADLIGHT, intensity: 2.6 },
  { position: [2.12, 0.62, 0.62], size: 0.9, color: HEADLIGHT, intensity: 2.6 },
  { position: [-2.18, 0.72, -0.6], size: 0.7, color: "#ff3d6e", intensity: 2.2 },
  { position: [-2.18, 0.72, 0.6], size: 0.7, color: "#ff3d6e", intensity: 2.2 },
];
const TAILS = [2, 3];

/** The headlights' beams in the night haze: a cone from each lamp, ahead and a little down. */
const BEAM = { length: 11, radius: 1.5, dip: 0.07, level: 0.32 } as const;

/**
 * Steps the car toward the picture once a frame (carMotion.ts), before the
 * camera (NightRig, priority -1), which pans with it, and before the street
 * and the car's own drawing, which read it. Mounted outside the car's
 * Suspense, so the camera follows the drive while the model loads.
 */
export function CarDrive({ timeline }: { timeline: StageTimeline }) {
  const still = usePrefersReducedMotion();
  useFrame((_, delta) => {
    // A dev jump, or the loop waking (the stage back on screen): the car lands on the picture. A long
    // frame mid-drive is no waking: carMotion integrates it (a frame over 0.5 s on a loaded phone snapped
    // the car up to its whole chase lag in one frame, metres).
    const woke = night.woke;
    night.woke = false;
    stepCarMotion(night.car, timeline, night.p, delta, { snap: night.snap || woke, still });
    if (process.env.NODE_ENV !== "production") {
      const probe = (window as ProbeWindow).__vaCarProbe;
      const m = night.car;
      if (probe) probe.push({ t: performance.now(), p: night.p, x: m.car.x, pace: m.pace, pitch: m.pitch, stop: m.car.stop, brake: m.car.brake });
    }
  }, -2);
  return null;
}

/**
 * The hero's convertible at night: it drives as carMotion.ts steps it,
 * chasing the picture like a car driven smoothly, rolling into every stop
 * and pulling away from it, wheels turning with the distance, the body on
 * its springs (the designed dive, squat and settle), the headlights' beams
 * sweeping the street ahead and the brake lights on at every stop line.
 * Faces +x, the street's direction.
 */
export function CarNight() {
  const { scene } = useGLTF(CAR_URL);
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const glows = useRef<GlowHandle | null>(null);
  const owned = useMemo(() => {
    prepareCar(scene);
    // Its own geometries, materials and textures (cloneOwned), released with the night.
    const copy = cloneOwned(scene);
    // The hero's turn and scale, set on the copy itself: given as primitive
    // props on this clone they never reached its matrix, so the car was
    // drawn unturned while Jesús, turned with the frame, sat backwards in
    // the passenger seat, his head against the windscreen.
    copy.object.rotation.set(0, Math.PI, 0);
    copy.object.scale.setScalar(CAR_MODEL.scale);
    return copy;
  }, [scene]);
  useEffect(() => () => owned.dispose(), [owned]);
  const model = owned.object;
  const wheels = useMemo(
    () => WHEEL_NAMES.map((name) => model.getObjectByName(name)).filter((o): o is Object3D => Boolean(o)),
    [model],
  );
  const beam = useMemo(() => {
    const dir = new Vector3(1, -BEAM.dip, 0).normalize();
    return {
      q: new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir),
      offset: dir.clone().multiplyScalar(BEAM.length / 2),
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uColor: { value: new Color(HEADLIGHT) }, uLevel: { value: BEAM.level } }]),
    };
  }, []);
  const wheel = useRef({ x: 0, stop: -1, spin: 0 });

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame(({ camera }) => {
    const { car } = night.car;
    const x = car.x;
    const w = wheel.current;
    // A cut to the next stop puts the car back up the road: no spin across it.
    const dx = car.stop === w.stop ? x - w.x : 0;
    w.stop = car.stop;
    w.x = x;
    w.spin += dx / WHEEL_RADIUS;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    for (const wheelObject of wheels) wheelObject.rotation.x = w.spin;
    if (group.current) group.current.position.x = x;
    if (body.current) body.current.rotation.z = night.car.pitch;

    // A lamp glows toward where it points: headlights only seen from ahead,
    // tail lights only from behind, so no glare shows through the body.
    const brake = 0.35 + 0.65 * car.brake;
    const toCam = camera.position.x - x;
    const len = Math.max(1e-3, Math.hypot(toCam, camera.position.y - 0.7, camera.position.z));
    const ahead = Math.min(1, Math.max(0, toCam / len + 0.15) * 1.6);
    const behind = Math.min(1, Math.max(0, -toCam / len + 0.15) * 1.6);
    for (let i = 0; i < LAMPS.length; i += 1) {
      const tail = TAILS.includes(i);
      glows.current?.setLevel(i, tail ? brake * behind : ahead);
    }
  });

  return (
    <group ref={group}>
      <group ref={body}>
        {/* The hero's car group (nose to -z), turned a quarter left so its nose points down the street (+x):
            the same car, with Jesús at the wheel exactly as in the hero, on the
            driver's side (the far side, -z). */}
        <group rotation-y={-Math.PI / 2}>
          <primitive object={model} />
          {/* On every tier, as in the hero: a phone's close shots without him were an empty car. */}
          <NightDriver />
        </group>
        <Glows glows={LAMPS} handle={glows} />
        {LAMPS.slice(0, 2).map((lamp, i) => (
          <mesh
            key={i}
            position={[lamp.position[0] + beam.offset.x, lamp.position[1] + beam.offset.y, lamp.position[2]]}
            quaternion={beam.q}
            scale={[1, BEAM.length, 1]}
            renderOrder={4}
            frustumCulled={false}
          >
            <coneGeometry args={[BEAM.radius, 1, 14, 1, true]} />
            <shaderMaterial
              uniforms={beam.uniforms}
              vertexShader={beamVertexShader}
              fragmentShader={beamFragmentShader}
              transparent
              depthWrite={false}
              blending={AdditiveBlending}
              fog
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
