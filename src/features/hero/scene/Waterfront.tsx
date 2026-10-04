"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { StaticPalms } from "./Palms";
import { CITY, ROAD_GAP } from "./Shore";
import { type Box, buildWaterfront, type Cylinder, type Pane, WATERFRONT } from "./waterfrontLayout";

type Props = { animate: boolean };

const LIT_WINDOW_BOOST = 1.5;

/**
 * The city waterfront (layout in waterfrontLayout.ts): promenade, pastel
 * art-deco hotels with neon fins and lit shopfronts, palms and lamps. Four
 * instanced draws plus the palms; nothing streams, the city stays put.
 */
export function Waterfront({ animate }: Props) {
  const layout = useMemo(() => buildWaterfront(), []);
  const promenadeLength = CITY.width / 2 - ROAD_GAP;
  const promenadeDepth = WATERFRONT.promenadeFrom - WATERFRONT.promenadeTo;

  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          rotation-x={-Math.PI / 2}
          position={[
            side * (ROAD_GAP + promenadeLength / 2),
            WATERFRONT.groundY + 0.02,
            (WATERFRONT.promenadeFrom + WATERFRONT.promenadeTo) / 2,
          ]}
        >
          <planeGeometry args={[promenadeLength, promenadeDepth]} />
          <meshStandardMaterial color="#e7c6cf" roughness={0.95} />
        </mesh>
      ))}
      <Boxes items={layout.solids} glow={false} />
      <Cylinders items={layout.cylinders} />
      <Boxes items={layout.glows} glow />
      <Panes items={layout.windows} />
      <StaticPalms palms={layout.palms} animate={animate} />
    </group>
  );
}

function Boxes({ items, glow }: { items: Box[]; glow: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const matrix = new Matrix4();
    const identity = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    const color = new Color();
    items.forEach((box, i) => {
      position.set(box.x, box.y + box.h / 2, box.z);
      scale.set(box.w, box.h, box.d);
      matrix.compose(position, identity, scale);
      instanced.setMatrixAt(i, matrix);
      color.set(box.color);
      if (glow) color.multiplyScalar(box.intensity ?? 1);
      instanced.setColorAt(i, color);
    });
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [items, glow]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      {glow ? (
        <meshBasicMaterial toneMapped={false} />
      ) : (
        <meshStandardMaterial roughness={0.85} metalness={0} />
      )}
    </instancedMesh>
  );
}

function Cylinders({ items }: { items: Cylinder[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const matrix = new Matrix4();
    const identity = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    const color = new Color();
    items.forEach((cylinder, i) => {
      position.set(cylinder.x, cylinder.y + cylinder.h / 2, cylinder.z);
      scale.set(cylinder.r, cylinder.h, cylinder.r);
      matrix.compose(position, identity, scale);
      instanced.setMatrixAt(i, matrix);
      instanced.setColorAt(i, color.set(cylinder.color));
    });
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 20]} />
      <meshStandardMaterial roughness={0.85} metalness={0} />
    </instancedMesh>
  );
}

function Panes({ items }: { items: Pane[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const matrix = new Matrix4();
    const identity = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    const color = new Color();
    items.forEach((pane, i) => {
      position.set(pane.x, pane.y, pane.z);
      scale.set(pane.w, pane.h, 1);
      matrix.compose(position, identity, scale);
      instanced.setMatrixAt(i, matrix);
      color.set(pane.color);
      if (pane.lit) color.multiplyScalar(LIT_WINDOW_BOOST);
      instanced.setColorAt(i, color);
    });
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
