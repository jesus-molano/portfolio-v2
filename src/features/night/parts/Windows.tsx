"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { InstancedBufferAttribute, type InstancedMesh, Matrix4, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { toTexture } from "../artCanvas";
import type { Vec3 } from "../frame";
import { PANE_COUNT, paintWindows } from "../sets/art/windows";
import { windowFragmentShader, windowVertexShader } from "../shaders/windows";

/** A pane: centre, size (the plane faces +z) and which painted interior it shows (`PANE`). */
export type Pane = { p: Vec3; s: readonly [number, number]; cell: number };

/** Painted windows in one draw: cafés, hotel rooms, offices. */
export function Windows({ panes, gain = 1.2, fogAmount = 0.3 }: { panes: Pane[]; gain?: number; fogAmount?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const map = useMemo(() => (typeof document === "undefined" ? null : toTexture(paintWindows(), 4)), []);
  const uniforms = useMemo(
    () => ({
      ...UniformsUtils.clone(UniformsLib.fog),
      uMap: { value: map },
      uCells: { value: PANE_COUNT },
      uGain: { value: gain },
      uFogAmount: { value: fogAmount },
    }),
    [map, gain, fogAmount],
  );
  useEffect(() => () => map?.dispose(), [map]);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const cells = new Float32Array(panes.length);
    panes.forEach((pane, i) => {
      m.compose(p.set(...pane.p), q, s.set(pane.s[0], pane.s[1], 1));
      target.setMatrixAt(i, m);
      cells[i] = pane.cell;
    });
    target.geometry.setAttribute("aCell", new InstancedBufferAttribute(cells, 1));
    target.instanceMatrix.needsUpdate = true;
  }, [panes]);
  if (!map) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, panes.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={windowVertexShader} fragmentShader={windowFragmentShader} fog />
    </instancedMesh>
  );
}
