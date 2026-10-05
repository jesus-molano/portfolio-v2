"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Box3,
  Color,
  type Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import { drive, streamFade, wrapZ } from "./drive";
import { makeTraffic, restingY } from "./trafficLayout";

type Props = { animate: boolean; perLane?: number };

/** Quaternius "Cars Pack" (CC0). Models face +z, are real scale (~4 m). */
const CAR_MODELS = [
  "/models/quaternius-cars/SportsCar.glb",
  "/models/quaternius-cars/SportsCar2.glb",
  "/models/quaternius-cars/NormalCar1.glb",
  "/models/quaternius-cars/Taxi.glb",
  "/models/quaternius-cars/SUV.glb",
] as const;
// Preload with the same array the component loads: the loader cache is keyed
// by the whole input, so per-URL preloads fetched and parsed every car twice.
useGLTF.preload([...CAR_MODELS]);

/**
 * Traffic paint: a satin clear coat, so the bodies reflect the sky like the
 * hero's instead of reading as clay, but rougher and duller than his.
 */
const TRAFFIC_PAINT = {
  metalness: 0.1,
  roughness: 0.55,
  clearcoat: 0.35,
  clearcoatRoughness: 0.3,
} as const;

/** Lamp glow on the traffic: warm headlights, red tail lights. */
const HEADLIGHT = "#ffe1b8";
const TAILLIGHT = "#ff3344";

/** Our material for one of a traffic model's materials, painted `paint`. */
function trafficMaterial(source: MeshStandardMaterial, paint: string): Material {
  const name = source.name.toLowerCase();
  if (name.includes("headlight") || name.includes("taillight")) {
    const material = source.clone();
    material.emissive = new Color(name.includes("headlight") ? HEADLIGHT : TAILLIGHT);
    material.emissiveIntensity = name.includes("headlight") ? 1.6 : 1.4;
    material.roughness = 0.45;
    return material;
  }
  if (name.includes("window")) {
    // Dark glass that mirrors the sky at an angle.
    return new MeshStandardMaterial({ color: source.color, metalness: 0, roughness: 0.12 });
  }
  if (/orange|blue|yellow|white|red|green|purple|paint|main|body/.test(name)) {
    // Two-tone bodies keep their darker panel as a darker shade of the paint.
    const color = new Color(paint).multiplyScalar(name.startsWith("dark") ? 0.7 : 1);
    return new MeshPhysicalMaterial({ color, ...TRAFFIC_PAINT });
  }
  // Tyres, trim and bumpers.
  const material = source.clone();
  material.roughness = 0.7;
  return material;
}

/** Real cars in the outer lanes: same-direction traffic and oncoming cars. */
export function Traffic({ animate, perLane = 3 }: Props) {
  const gltfs = useGLTF([...CAR_MODELS]);
  const cars = useMemo(() => makeTraffic(perLane, CAR_MODELS.length), [perLane]);
  const groups = useRef<Array<Group | null>>([]);
  // Each model's lowest point (its tyres) is a little off y = 0: rest it on the road.
  const heights = useMemo(
    () => gltfs.map((gltf) => restingY(new Box3().setFromObject(gltf.scene).min.y)),
    [gltfs],
  );

  // One painted clone per car; the light materials glow.
  const clones = useMemo(
    () =>
      cars.map((car) => {
        const clone = gltfs[car.model].scene.clone(true);
        clone.traverse((object: Object3D) => {
          if (!(object instanceof Mesh)) return;
          const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(
            (m: MeshStandardMaterial) => trafficMaterial(m, car.paint),
          );
          object.material = Array.isArray(object.material) ? materials : materials[0];
        });
        return clone;
      }),
    [cars, gltfs],
  );
  useEffect(
    () => () =>
      clones.forEach((clone) =>
        clone.traverse((object) => {
          if (object instanceof Mesh) {
            const list = Array.isArray(object.material) ? object.material : [object.material];
            list.forEach((m) => m.dispose());
          }
        }),
      ),
    [clones],
  );

  const update = (distance: number) => {
    const time = distance / drive.speed;
    cars.forEach((car, i) => {
      const group = groups.current[i];
      if (!group) return;
      const z = wrapZ(car.z0 + time * car.relative);
      group.position.set(car.x, heights[car.model], z);
      group.scale.setScalar(Math.max(0.001, streamFade(z)));
    });
  };

  // Layout effect: placed before the first frame, also in demand mode.
  useLayoutEffect(() => update(drive.distance));
  useFrame(() => {
    if (animate) update(drive.distance);
  });

  return (
    <group>
      {cars.map((car, i) => (
        <group
          key={`${car.x}-${car.z0}`}
          ref={(el) => {
            groups.current[i] = el;
          }}
          // Models face +z: same-direction cars turn around to face -z.
          rotation-y={car.oncoming ? 0 : Math.PI}
        >
          <primitive object={clones[i]} />
        </group>
      ))}
    </group>
  );
}
