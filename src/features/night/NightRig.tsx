"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type PerspectiveCamera, Vector3 } from "three";
import type { StageTimeline } from "@/features/work/workTimeline";
import type { CarState } from "./carPath";
import { night } from "./nightState";
import { rigKeys, rigPose } from "./rig";
import type { NightSet } from "./sets/types";

/**
 * How fast the camera follows its pose (1/s), as in the hero's rig: the
 * scroll's steps (a wheel's notches, a finger's jitter on a phone) reach
 * the picture as one glide, and it settles within a fraction of a second
 * when the scroll stops. A cut (a new stop, under the dip) snaps.
 */
const FOLLOW = 5.5;

const v = new Vector3();
const toCamera = new Vector3();
const normal = new Vector3();
const lookNow = new Vector3();
const lookWant = new Vector3();
const posWant = new Vector3();

type DevWindow = Window & { __vaCam?: { position: [number, number, number]; look: [number, number, number]; fov: number } };

/**
 * The night camera. Each stop's shot is a list of keys on the film
 * (direction.ts); the pose follows the picture, damped like the hero's
 * camera, with the same faint hand-held life, and snaps only at a cut
 * between stops, which the dip to night covers. On a portrait screen the
 * pose is fitted to the stop's board and the car (rig.ts). Every frame it
 * also projects the active board's corners and the LIVE tally for the
 * stage's hotspot, reticle and iris.
 */
export function NightRig({ timeline, sets, parallax }: { timeline: StageTimeline; sets: readonly NightSet[]; parallax: boolean }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const keys = useMemo(() => rigKeys(timeline, sets.length), [sets, timeline]);
  const state = useRef({ stop: -1, fov: 0, car: { x: 0, brake: 1, stop: 0 } as CarState });

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame(({ size, clock, pointer }, delta) => {
    const set = sets[night.stop];
    const aspect = size.width / Math.max(1, size.height);
    const stopKeys = keys[night.stop];
    if (!set || !stopKeys) return;
    const rig = state.current;
    // The keyed pose, fitted on a phone to the board and the car at its line, panning with the car as it drives (rig.ts).
    const pose = rigPose(timeline, set, stopKeys, night.p, aspect, rig.car);

    posWant.set(...pose.position);
    lookWant.set(...pose.look);
    let fov = pose.fov;
    const dev = process.env.NODE_ENV !== "production" ? (window as DevWindow).__vaCam : undefined;
    const cut = night.stop !== rig.stop;
    rig.stop = night.stop;
    if (dev) {
      posWant.set(...dev.position);
      lookWant.set(...dev.look);
      fov = dev.fov;
    } else {
      // Hand-held: a faint bob and sway, scaled to the subject's distance, so a close shot does not shake more.
      const t = clock.elapsedTime;
      const reach = Math.min(1, Math.max(0.2, posWant.distanceTo(lookWant) / 25));
      posWant.y += (Math.sin(t * 1.9) * 0.022 + Math.sin(t * 4.7) * 0.008) * reach;
      posWant.x += Math.sin(t * 0.8) * 0.035 * reach;
      if (parallax) {
        posWant.x += pointer.x * 0.35 * reach;
        posWant.y += pointer.y * 0.18 * reach;
      }
    }

    const snap = cut || Boolean(dev) || night.snap;
    night.snap = false;
    const k = snap ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * FOLLOW);
    camera.position.lerp(posWant, k);
    if (snap) lookNow.copy(lookWant);
    else lookNow.lerp(lookWant, k);
    camera.lookAt(lookNow);
    const nextFov = snap ? fov : camera.fov + (fov - camera.fov) * k;
    if (Math.abs(nextFov - rig.fov) > 0.005) {
      // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
      rig.fov = nextFov;
    }
    camera.updateMatrixWorld();

    // The board on screen, for the hotspot and the reticle.
    let onScreen = false;
    set.board.forEach((corner, i) => {
      v.set(...corner).project(camera);
      night.quad[i][0] = v.x;
      night.quad[i][1] = v.y;
      if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) onScreen = true;
    });
    night.quadOnScreen = onScreen;
    v.set(0, 0, 0);
    for (const corner of set.board) v.add(toCamera.set(...corner));
    v.multiplyScalar(0.25);
    toCamera.copy(camera.position).sub(v);
    const len = toCamera.length();
    normal.set(...set.boardNormal);
    night.facing = len > 1e-6 ? normal.dot(toCamera) / len : 0;
    if (set.tally) {
      v.set(...set.tally).project(camera);
      night.tally[0] = v.x;
      night.tally[1] = v.y;
    }
  }, -1);

  return null;
}
