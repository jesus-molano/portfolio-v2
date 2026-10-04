"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type Group, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { palette } from "@/design/tokens";
import { softDiscFragmentShader, softDiscVertexShader } from "../shaders/softDisc";
import { CAR_POSITION, drive } from "./drive";
import { Driver } from "./Driver";

type Props = { animate: boolean };

/** "Convertible" by Poly by Google, CC BY 3.0 (see public/models/poly-convertible). */
export const CAR_URL = "/models/poly-convertible/convertible.glb";
/** The model is ~10 units long; a real roadster is ~4.5 m. */
const CAR_SCALE = 0.45;
/** Wheel radius in world units (model radius 0.856). */
const WHEEL_RADIUS = 0.856 * CAR_SCALE;
const WHEEL_NAMES = ["wheel_front_l", "wheel_front_r", "wheel_rear_l", "wheel_rear_r"];

useGLTF.preload(CAR_URL);

/**
 * The hero car. It never moves: the world streams past. Wheels spin with the
 * drive distance; the body (and the driver with it) rides the suspension.
 */
export function Car({ animate }: Props) {
  const { scene } = useGLTF(CAR_URL);
  const ride = useRef<Group>(null);
  const parts = useRef<{ wheels: Object3D[]; body?: Object3D }>({ wheels: [] });
  const shadowUniforms = useMemo(
    () => ({ uColor: { value: new Color(palette.night) }, uOpacity: { value: 0.7 } }),
    [],
  );

  // Layout effect: the paint swap lands before the first frame renders.
  useLayoutEffect(() => {
    parts.current = {
      wheels: WHEEL_NAMES.map((name) => scene.getObjectByName(name)).filter(
        (o): o is Object3D => Boolean(o),
      ),
      body: scene.getObjectByName("body"),
    };
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // The source OBJ declares the material as glass (Tf 1), which glTF turns
      // into full transmission and renders the car black. Use plain paint.
      const source = object.material as MeshStandardMaterial;
      object.material = new MeshStandardMaterial({
        map: source.map,
        color: new Color(1.15, 1.1, 1.2),
        roughness: 0.4,
        metalness: 0.2,
      });
      source.dispose();
    });
  }, [scene]);

  useFrame((state) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;
    // The model faces +z; it is rotated 180 degrees, so a positive spin rolls forward (-z).
    const spin = drive.distance / WHEEL_RADIUS;
    const { wheels, body } = parts.current;
    // Per-frame mutation of scene objects is the R3F pattern; nothing here feeds React state.
    // eslint-disable-next-line react-hooks/immutability
    for (const wheel of wheels) wheel.rotation.x = spin;
    if (ride.current) {
      ride.current.position.y = Math.sin(t * 2.3) * 0.01 + Math.sin(t * 6.1) * 0.004;
      ride.current.rotation.z = Math.sin(t * 0.8) * 0.004;
      ride.current.rotation.x = Math.sin(t * 1.7) * 0.003;
      if (body) body.position.y = ride.current.position.y / CAR_SCALE;
    }
  });

  return (
    <group position={[CAR_POSITION.x, CAR_POSITION.y, CAR_POSITION.z]}>
      <primitive object={scene} scale={CAR_SCALE} rotation-y={Math.PI} />
      <group ref={ride}>
        <Driver animate={animate} />
      </group>
      {/* Soft contact shadow (radial, no hard rectangle). */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.12} renderOrder={2}>
        <planeGeometry args={[3.0, 6.0]} />
        <shaderMaterial
          uniforms={shadowUniforms}
          vertexShader={softDiscVertexShader}
          fragmentShader={softDiscFragmentShader}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}
