"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, type Group, type Object3D, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { CAR_URL, prepareCar } from "@/features/hero/scene/Car";
import { CAR_MODEL, WHEEL_RADIUS } from "@/features/hero/scene/carModel";
import type { StageTimeline } from "@/features/work/workTimeline";
import { carAt, type CarState, HEADLIGHT } from "./carPath";
import { cloneBare } from "./cloneBare";
import { night } from "./nightState";
import { NightDriver } from "./NightDriver";
import { type Glow, type GlowHandle, Glows } from "./parts/Glows";
import { beamFragmentShader, beamVertexShader } from "./shaders/beam";

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
 * How the body sits on its springs: it dives as it brakes, squats as it
 * pulls away and rocks once as it stops (a damped spring on the pitch).
 */
const SPRING = { gain: 0.0042, max: 0.04, omega: 9, damping: 0.42 } as const;

/**
 * The hero's convertible at night: it drives with the scroll (carPath.ts),
 * rolling into every stop and pulling away from it, wheels turning with the
 * distance, the body pitching on its springs, the headlights' beams
 * sweeping the street ahead and the brake lights on at every stop line.
 * Faces +x, the street's direction.
 */
export function CarNight({ timeline }: { timeline: StageTimeline }) {
  const { scene } = useGLTF(CAR_URL);
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const glows = useRef<GlowHandle | null>(null);
  const model = useMemo(() => {
    prepareCar(scene);
    const copy = cloneBare(scene);
    // The hero's turn and scale, set on the copy itself: given as primitive
    // props on this clone they never reached its matrix, so the car was
    // drawn unturned while Jesús, turned with the frame, sat backwards in
    // the passenger seat, his head against the windscreen.
    copy.rotation.set(0, Math.PI, 0);
    copy.scale.setScalar(CAR_MODEL.scale);
    return copy;
  }, [scene]);
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
  const motion = useRef({ x: 0, stop: -1, spin: 0, speed: 0, accel: 0, pitch: 0, pitchVel: 0, car: { x: 0, brake: 1, stop: 0 } as CarState });

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame(({ camera }, delta) => {
    const m = motion.current;
    const car = carAt(timeline, night.p, m.car);
    const x = car.x;
    const dt = Math.min(Math.max(delta, 1e-3), 0.1);
    // A cut to the next stop puts the car back up the road: no spin, no lurch across it.
    const cut = car.stop !== m.stop;
    m.stop = car.stop;
    const dx = cut ? 0 : x - m.x;
    m.x = x;
    m.spin += dx / WHEEL_RADIUS;
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    for (const wheel of wheels) wheel.rotation.x = m.spin;
    if (group.current) group.current.position.x = x;

    // The springs: the speed and its change, smoothed over a few frames, pitch the body.
    const speed = cut ? 0 : dx / dt;
    const lastSpeed = m.speed;
    m.speed += (speed - m.speed) * (1 - Math.exp(-dt / 0.09));
    const accel = cut ? 0 : (m.speed - lastSpeed) / dt;
    m.accel += (accel - m.accel) * (1 - Math.exp(-dt / 0.12));
    const want = Math.min(SPRING.max, Math.max(-SPRING.max, m.accel * SPRING.gain));
    const force = SPRING.omega * SPRING.omega * (want - m.pitch) - 2 * SPRING.damping * SPRING.omega * m.pitchVel;
    m.pitchVel += force * dt;
    m.pitch += m.pitchVel * dt;
    if (cut) {
      m.pitch = 0;
      m.pitchVel = 0;
    }
    if (body.current) body.current.rotation.z = m.pitch;

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
