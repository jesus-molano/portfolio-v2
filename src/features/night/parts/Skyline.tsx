"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Matrix4, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { nightBlockFragmentShader, nightBlockVertexShader } from "../shaders/nightBlock";
import { buildSkyline, type SkylineSpec } from "./skylineLayout";
import { Windows } from "./Windows";

export type { SkylineSpec };

/** A far skyline at night: violet blocks, their rooflines and painted lit windows, three instanced draws. */
export function Skyline({ spec }: { spec: SkylineSpec }) {
  const layout = useMemo(() => buildSkyline(spec), [spec]);
  const blocks = useRef<InstancedMesh>(null);
  const roofs = useRef<InstancedMesh>(null);
  const uniforms = useMemo(
    () =>
      UniformsUtils.merge([
        UniformsLib.fog,
        { uBottom: { value: new Color("#1b1130") }, uTop: { value: new Color("#3a2660") }, uHeight: { value: 80 } },
      ]),
    [],
  );

  useLayoutEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    layout.blocks.forEach((b, i) => {
      m.compose(p.set(b.x, b.h / 2, b.z), q, s.set(b.w, b.h, b.d));
      blocks.current?.setMatrixAt(i, m);
    });
    layout.roofs.forEach((b, i) => {
      m.compose(p.set(b.x, b.y + b.h / 2, b.z), q, s.set(b.w, b.h, b.d));
      roofs.current?.setMatrixAt(i, m);
    });
    for (const mesh of [blocks.current, roofs.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  }, [layout]);

  return (
    <group>
      <instancedMesh ref={blocks} args={[undefined, undefined, layout.blocks.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial uniforms={uniforms} vertexShader={nightBlockVertexShader} fragmentShader={nightBlockFragmentShader} fog />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, layout.roofs.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial uniforms={uniforms} vertexShader={nightBlockVertexShader} fragmentShader={nightBlockFragmentShader} fog />
      </instancedMesh>
      {layout.windows.length > 0 ? <Windows panes={layout.windows} gain={1.5} fogAmount={0.6} /> : null}
    </group>
  );
}
