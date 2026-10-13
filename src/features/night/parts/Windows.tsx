"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { type CanvasTexture, type InstancedMesh, Matrix4, Quaternion, UniformsLib, UniformsUtils, Vector3 } from "three";
import { createIdleLoop } from "@/lib/idle";
import { toTexture } from "../artCanvas";
import type { Vec3 } from "../frame";
import { ATLAS, finishWindows, type PaneLook, paintWindowsSteps } from "../sets/art/windows";
import { windowFragmentShader, windowVertexShader } from "../shaders/windows";
import { instancedAttribute } from "./instancedAttribute";

/** A pane: centre, size (the plane faces +z) and how it shows its painted interior (`PANE`, `pickPane`). */
export type Pane = { p: Vec3; s: readonly [number, number] } & PaneLook;

/**
 * The atlas is painted once and shared by every set's windows for the life
 * of the page (one 2048 x 1280 texture): a renderer that comes back uploads
 * it again on its own.
 */
let atlas: CanvasTexture | null = null;
/** Its canvas once painted, or the steps painting it ahead (paintWindowsAhead). */
let painted: HTMLCanvasElement | null = null;
let painting: Generator<number, HTMLCanvasElement, unknown> | null = null;

/** The longest a room waits for an idle period: the night may mount soon after its code is in. */
const AHEAD_TIMEOUT_MS = 2000;

/** The atlas's canvas, whatever the idle steps have not painted yet painted now. */
function atlasCanvas(): HTMLCanvasElement {
  if (!painted) {
    // Taken first: steps that throw (no 2D canvas) are never stepped again, the next mount starts afresh.
    const steps = painting ?? paintWindowsSteps();
    painting = null;
    painted = finishWindows(steps);
  }
  return painted;
}

function windowAtlas(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  atlas ??= toTexture(atlasCanvas(), 4);
  return atlas;
}

/**
 * Paints the atlas ahead of the night's mount, a room per idle slice
 * (prefetch.ts, once the night's code is in): painted in the mount, its 31
 * rooms were one more long task in the commit that builds the five sets. A
 * mount that comes first paints what is left at once (`windowAtlas`).
 */
export function paintWindowsAhead(): void {
  if (painted || painting || typeof document === "undefined") return;
  painting = paintWindowsSteps();
  createIdleLoop(
    () => {
      // Finished by a mount that came first.
      const steps = painting;
      if (!steps) return false;
      let step: IteratorResult<number, HTMLCanvasElement>;
      try {
        step = steps.next();
      } catch {
        // No 2D canvas: the mount paints it whole and fails there, where the scene's error boundary hears it.
        painting = null;
        return false;
      }
      if (!step.done) return true;
      painted = step.value;
      painting = null;
      return false;
    },
    { timeoutMs: AHEAD_TIMEOUT_MS },
  ).wake();
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
    // Written in place (instancedAttribute): a new pair per layout left the old buffers on the GPU.
    const cell = instancedAttribute(target.geometry, "aCell", panes.length, 1);
    const look = instancedAttribute(target.geometry, "aLook", panes.length, 3);
    const cells = cell.array as Float32Array;
    const looks = look.array as Float32Array;
    panes.forEach((pane, i) => {
      m.compose(p.set(...pane.p), q, s.set(pane.s[0], pane.s[1], 1));
      target.setMatrixAt(i, m);
      cells[i] = pane.cell;
      looks[i * 3] = pane.flip ? 1 : 0;
      looks[i * 3 + 1] = pane.gain ?? 1;
      looks[i * 3 + 2] = pane.flicker ?? 0;
    });
    cell.needsUpdate = true;
    look.needsUpdate = true;
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
