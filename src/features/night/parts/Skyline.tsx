"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { createRandom } from "@/features/hero/scene/world";
import { glowFragmentShader, glowVertexShader } from "@/features/hero/shaders/neon";
import { nightBlockFragmentShader, nightBlockVertexShader } from "../shaders/nightBlock";

export type SkylineSpec = {
  seed: number;
  count: number;
  /** Where the blocks stand (x and z ranges) and how tall they are. */
  x: [number, number];
  z: [number, number];
  height: [number, number];
  /** Share of window cells lit. */
  lit: number;
  /** Boxes the skyline keeps clear of (the landmark, the board). */
  clear?: { x: [number, number]; z: [number, number] }[];
  /** Window colours. */
  warm?: string;
};

type Block = { x: number; z: number; w: number; d: number; h: number };

/** Deterministic blocks and their lit windows (front faces only, toward +z). */
export function buildSkyline(spec: SkylineSpec): { blocks: Block[]; windows: { x: number; y: number; z: number; w: number; h: number; c: number }[] } {
  const random = createRandom(spec.seed);
  const blocks: Block[] = [];
  const windows: { x: number; y: number; z: number; w: number; h: number; c: number }[] = [];
  let guard = 0;
  while (blocks.length < spec.count && guard++ < spec.count * 20) {
    const w = 8 + random() * 16;
    const d = 8 + random() * 14;
    const x = spec.x[0] + random() * (spec.x[1] - spec.x[0]);
    const z = spec.z[0] + random() * (spec.z[1] - spec.z[0]);
    const h = spec.height[0] + random() * random() * (spec.height[1] - spec.height[0]);
    const blocked = spec.clear?.some(
      (c) => x + w / 2 > c.x[0] && x - w / 2 < c.x[1] && z + d / 2 > c.z[0] && z - d / 2 < c.z[1],
    );
    if (blocked) continue;
    blocks.push({ x, z, w, d, h });
    const cols = Math.max(2, Math.floor(w / 3));
    for (let y = 3; y < h - 2; y += 3.2) {
      for (let i = 0; i < cols; i += 1) {
        if (random() > spec.lit) continue;
        windows.push({
          x: x - w / 2 + (i + 0.5) * (w / cols),
          y,
          z: z + d / 2 + 0.12,
          w: (w / cols) * 0.55,
          h: 1.5,
          c: random(),
        });
      }
    }
  }
  return { blocks, windows };
}

/** A far skyline at night: violet blocks with lit windows, two instanced draws. */
export function Skyline({ spec }: { spec: SkylineSpec }) {
  const layout = useMemo(() => buildSkyline(spec), [spec]);
  const blocks = useRef<InstancedMesh>(null);
  const windows = useRef<InstancedMesh>(null);
  const uniforms = useMemo(
    () => ({
      block: UniformsUtils.merge([
        UniformsLib.fog,
        { uBottom: { value: new Color("#1b1130") }, uTop: { value: new Color("#3a2660") }, uHeight: { value: 80 } },
      ]),
      glow: UniformsUtils.merge([UniformsLib.fog, { uIntensity: { value: 1 }, uFogAmount: { value: 0.6 } }]),
    }),
    [],
  );

  useLayoutEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const color = new Color();
    const warm = new Color(spec.warm ?? "#ffcf8a");
    const cool = new Color("#b9c8ff");
    layout.blocks.forEach((b, i) => {
      m.compose(p.set(b.x, b.h / 2, b.z), q, s.set(b.w, b.h, b.d));
      blocks.current?.setMatrixAt(i, m);
    });
    layout.windows.forEach((w, i) => {
      m.compose(p.set(w.x, w.y, w.z), q, s.set(w.w, w.h, 1));
      windows.current?.setMatrixAt(i, m);
      windows.current?.setColorAt(i, color.copy(w.c < 0.8 ? warm : cool).multiplyScalar(0.9 + w.c * 0.8));
    });
    if (blocks.current) blocks.current.instanceMatrix.needsUpdate = true;
    if (windows.current) {
      windows.current.instanceMatrix.needsUpdate = true;
      if (windows.current.instanceColor) windows.current.instanceColor.needsUpdate = true;
    }
  }, [layout, spec.warm]);

  return (
    <group>
      <instancedMesh ref={blocks} args={[undefined, undefined, layout.blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial uniforms={uniforms.block} vertexShader={nightBlockVertexShader} fragmentShader={nightBlockFragmentShader} fog />
      </instancedMesh>
      {layout.windows.length > 0 ? (
        <instancedMesh ref={windows} args={[undefined, undefined, layout.windows.length]} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial uniforms={uniforms.glow} vertexShader={glowVertexShader} fragmentShader={glowFragmentShader} fog />
        </instancedMesh>
      ) : null}
    </group>
  );
}
