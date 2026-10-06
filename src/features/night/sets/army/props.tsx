"use client";

import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  type BufferGeometry,
  type CanvasTexture,
  Color,
  Euler,
  type InstancedMesh,
  type Material,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { QualityTier } from "@/features/hero/useQualityTier";
import { loadFaces, toTexture } from "../../artCanvas";
import type { BoardFrame } from "../../boardFrame";
import type { Vec3 } from "../../frame";
import { kitFaces, paintBurlap, paintKitAtlas } from "../art/armyProps";
import {
  bearerGeometry,
  cableGeometry,
  canGeometry,
  crateGeometry,
  drumGeometry,
  jerrycanGeometry,
  panelGeometry,
  pickGeometry,
  sandbagGeometry,
  shovelGeometry,
} from "./propGeometry";
import { BAG_VARIANTS, type Placed } from "./propsLayout";
import { settledProps } from "./settle";

/**
 * The army stop's ground props (layout in propsLayout.ts): sandbag rings
 * round the board's legs and a short low wall, the ammunition point (olive
 * crates, steel ammo cans), the bridge panels on their bearers, the cable
 * drum and its cable, two jerrycans, a pick and a shovel stuck in the
 * bags. Standard materials, so the stop's sodium lights and the moon
 * light them like the lot they stand on; two painted textures (hessian,
 * the kit atlas), one instanced draw per kind of thing.
 */

const euler = new Euler(0, 0, 0, "YZX");
const quaternion = new Quaternion();

function matrixOf(item: Placed, scale: Vec3 = [1, 1, 1]): Matrix4 {
  euler.set(item.roll ?? 0, item.yaw, item.tilt ?? 0, "YZX");
  return new Matrix4().compose(new Vector3(...item.p), quaternion.setFromEuler(euler), new Vector3(...scale));
}

type Instance = { m: Matrix4; c?: Vec3 };

function Instanced({ geometry, material, items, children }: { geometry: BufferGeometry; material?: Material; items: Instance[]; children?: ReactNode }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const c = new Color();
    items.forEach((item, i) => {
      target.setMatrixAt(i, item.m);
      if (item.c) target.setColorAt(i, c.setRGB(...item.c));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[geometry, material, items.length]} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
}

export function ArmyProps({ frame, tier }: { frame: BoardFrame; tier: QualityTier }) {
  const high = tier === "high";
  const [art, setArt] = useState<{ burlap: CanvasTexture; kit: CanvasTexture } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let made: { burlap: CanvasTexture; kit: CanvasTexture } | null = null;
    loadFaces(kitFaces()).then(() => {
      if (cancelled) return;
      made = { burlap: toTexture(paintBurlap()), kit: toTexture(paintKitAtlas(), 8) };
      setArt(made);
    });
    return () => {
      cancelled = true;
      made?.burlap.dispose();
      made?.kit.dispose();
    };
  }, []);

  const layout = useMemo(() => settledProps(high), [high]);

  const geometries = useMemo(
    () => ({
      bags: Array.from({ length: BAG_VARIANTS }, (_, v) => sandbagGeometry(v, high)),
      crates: [crateGeometry(0, high), crateGeometry(1, high)],
      can: canGeometry(high),
      jerrycan: jerrycanGeometry(high),
      drum: drumGeometry(high),
      cable: cableGeometry(layout.cable, high),
      panel: panelGeometry(high),
      bearer: bearerGeometry(),
      pick: pickGeometry(),
      shovel: shovelGeometry(),
    }),
    [high, layout],
  );
  useEffect(
    () => () => {
      const { bags, crates, ...rest } = geometries;
      [...bags, ...crates, ...Object.values(rest)].forEach((g) => g.dispose());
    },
    [geometries],
  );

  const materials = useMemo(() => {
    if (!art) return null;
    return {
      // Hessian: matte, its shade in the vertex colours, each bag's tint (damp, olive) per instance.
      bag: new MeshStandardMaterial({ map: art.burlap, vertexColors: true, roughness: 1, metalness: 0 }),
      // Painted wood and steel: a dull sheen, never a mirror (there is no environment to reflect at night).
      kit: new MeshStandardMaterial({ map: art.kit, roughness: 0.78, metalness: 0.05 }),
      // Painted steel (bridge panels, ammo cans, jerrycans): the same atlas, a tighter highlight off the lamps.
      steel: new MeshStandardMaterial({ map: art.kit, roughness: 0.45, metalness: 0.2 }),
    };
  }, [art]);
  useEffect(
    () => () => {
      materials?.bag.dispose();
      materials?.kit.dispose();
      materials?.steel.dispose();
    },
    [materials],
  );

  const instances = useMemo(() => {
    const byVariant = (variant: number) =>
      layout.bags.filter((b) => b.variant === variant).map((b) => ({ m: matrixOf(b, b.s), c: b.tint }));
    const crates = (variant: 0 | 1) =>
      layout.crates.filter((c) => c.variant === variant).map((c, i) => ({ m: matrixOf(c), c: (i % 2 ? [0.94, 0.97, 0.92] : [1, 1, 1]) as Vec3 }));
    const plain = (items: Placed[]) => items.map((item) => ({ m: matrixOf(item) }));
    return {
      bags: Array.from({ length: BAG_VARIANTS }, (_, v) => byVariant(v)),
      crates: [crates(0), crates(1)],
      cans: layout.cans.map((c, i) => ({ m: matrixOf(c), c: ([[1, 1, 1], [0.86, 0.92, 0.84], [1.05, 1.02, 0.95]] as Vec3[])[i % 3] })),
      jerrycans: layout.jerrycans.map((c, i) => ({ m: matrixOf(c), c: (i ? [0.9, 0.95, 0.88] : [1, 1, 1]) as Vec3 })),
      panels: plain([...layout.panels, layout.leaning]),
      bearers: plain(layout.bearers),
      drum: plain([layout.drum]),
      pick: plain([layout.pick]),
      shovel: plain([layout.shovel]),
    };
  }, [layout]);

  if (!materials) return null;
  const { kit, bag, steel } = materials;
  return (
    <group position={[frame.centre[0], 0, frame.centre[2]]} rotation-y={frame.yaw}>
      {geometries.bags.map((geometry, v) => (
        <Instanced key={v} geometry={geometry} material={bag} items={instances.bags[v]} />
      ))}
      <Instanced geometry={geometries.crates[0]} material={kit} items={instances.crates[0]} />
      <Instanced geometry={geometries.crates[1]} material={kit} items={instances.crates[1]} />
      <Instanced geometry={geometries.can} material={steel} items={instances.cans} />
      <Instanced geometry={geometries.jerrycan} material={steel} items={instances.jerrycans} />
      <Instanced geometry={geometries.panel} material={steel} items={instances.panels} />
      <Instanced geometry={geometries.bearer} material={kit} items={instances.bearers} />
      <Instanced geometry={geometries.drum} material={kit} items={instances.drum} />
      <Instanced geometry={geometries.pick} material={kit} items={instances.pick} />
      <Instanced geometry={geometries.shovel} material={kit} items={instances.shovel} />
      <mesh geometry={geometries.cable} material={kit} />
    </group>
  );
}
