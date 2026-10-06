"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { type CanvasTexture, InstancedBufferAttribute, type InstancedMesh, Matrix4, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { toTexture } from "../artCanvas";
import type { Vec3 } from "../frame";
import { ATLAS, type PaneLook, paintWindows } from "../sets/art/windows";
import { windowFragmentShader, windowVertexShader } from "../shaders/windows";

/** A pane: centre, size (the plane faces +z) and how it shows its painted interior (`PANE`, `pickPane`). */
export type Pane = { p: Vec3; s: readonly [number, number] } & PaneLook;

/**
 * The atlas is painted once and shared by every set's windows for the life
 * of the page (one 2048 x 1280 texture): a renderer that comes back uploads
 * it again on its own.
 */
let atlas: CanvasTexture | null = null;

function windowAtlas(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  atlas ??= toTexture(paintWindows(), 4);
  return atlas;
}

/** Painted windows in one draw: cafés, hotel rooms, homes, offices. */
export function Windows({ panes, gain = 1.2, fogAmount = 0.3 }: { panes: Pane[]; gain?: number; fogAmount?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const map = useMemo(() => windowAtlas(), []);
  const uniforms = useMemo(
    () => ({
      ...UniformsUtils.clone(UniformsLib.fog),
      uMap: { value: map },
      uGrid: { value: [ATLAS.cols, ATLAS.rows] },
      uGain: { value: gain },
      uFogAmount: { value: fogAmount },
      uTime: { value: 0 },
    }),
    [map, gain, fogAmount],
  );
  const flickers = useMemo(() => panes.some((pane) => (pane.flicker ?? 0) > 0), [panes]);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    const cells = new Float32Array(panes.length);
    const looks = new Float32Array(panes.length * 3);
    panes.forEach((pane, i) => {
      m.compose(p.set(...pane.p), q, s.set(pane.s[0], pane.s[1], 1));
      target.setMatrixAt(i, m);
      cells[i] = pane.cell;
      looks[i * 3] = pane.flip ? 1 : 0;
      looks[i * 3 + 1] = pane.gain ?? 1;
      looks[i * 3 + 2] = pane.flicker ?? 0;
    });
    target.geometry.setAttribute("aCell", new InstancedBufferAttribute(cells, 1));
    target.geometry.setAttribute("aLook", new InstancedBufferAttribute(looks, 3));
    target.instanceMatrix.needsUpdate = true;
  }, [panes]);
  useFrame((state) => {
    // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
    if (flickers) uniforms.uTime.value = state.clock.elapsedTime;
  });
  if (!map) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, panes.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={windowVertexShader} fragmentShader={windowFragmentShader} fog />
    </instancedMesh>
  );
}
