"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type PerspectiveCamera, Vector3 } from "three";
import { quadOverlapsScreen } from "@/features/work/hotspot";
import type { StageTimeline } from "@/features/work/workTimeline";
import { framedAt } from "./carMotion";
import { carAt, type CarState } from "./carPath";
import { night } from "./nightState";
import { FOLLOW, newShotClock, rigKeys, rigPose, stepShotClock } from "./rig";
import type { NightSet } from "./sets/types";

const v = new Vector3();
const toCamera = new Vector3();
const normal = new Vector3();
const lookWant = new Vector3();
const posWant = new Vector3();

type DevWindow = Window & { __vaCam?: { position: [number, number, number]; look: [number, number, number]; fov: number } };

/**
 * The night camera. Each stop's shot is a list of keys on the film
 * (direction.ts); the camera shoots the car's own moment of the drive
 * (rig.ts stepShotClock), which already moves like a car driven smoothly,
 * so the drawn car and the shot never part (a damped pose trailed a
 * tracked car by its speed times the damping, off a phone's narrow frame),
 * with the hero's faint hand-held life; a jump of the car's glides in, and
 * the camera cuts only between stops, which the dip to night covers. On a
 * portrait screen the pose is fitted to the stop's board and the car
 * (rig.ts). Every frame it also projects the active board's corners and the
 * LIVE tally for the stage's hotspot, reticle and iris.
 */
export function NightRig({ timeline, sets, parallax }: { timeline: StageTimeline; sets: readonly NightSet[]; parallax: boolean }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const keys = useMemo(() => rigKeys(timeline, sets.length), [sets, timeline]);
  const state = useRef({ stop: -1, fov: 0, car: { x: 0, brake: 1, stop: 0, lean: 0 } as CarState, clock: newShotClock(), px: 0, py: 0 });

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame(({ size, clock, pointer }, delta) => {
    const set = sets[night.stop];
    const aspect = size.width / Math.max(1, size.height);
    const stopKeys = keys[night.stop];
    if (!set || !stopKeys) return;
    const rig = state.current;
    const dev = process.env.NODE_ENV !== "production" ? (window as DevWindow).__vaCam : undefined;
    const cut = night.stop !== rig.stop;
    rig.stop = night.stop;
    const snap = cut || Boolean(dev) || night.snap;
    night.snap = false;
    // The car's own moment of the drive (night.car, stepped just before): the keyed pose there, fitted on a
    // phone to the board and the car at its line, panning with the car as drawn (rig.ts); the picture's car
    // while the car is in another stop.
    const at = stepShotClock(rig.clock, framedAt(night.car, night.stop, night.p), delta, { cut: snap, jumped: night.car.jumped });
    const carX = night.car.car.stop === night.stop ? night.car.car.x : carAt(timeline, night.p, rig.car).x;
    const pose = rigPose(timeline, set, stopKeys, at, aspect, carX);

    posWant.set(...pose.position);
    lookWant.set(...pose.look);
    let fov = pose.fov;
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
        // The pointer's parallax glides in at FOLLOW.
        const k = snap ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * FOLLOW);
        rig.px += (pointer.x - rig.px) * k;
        rig.py += (pointer.y - rig.py) * k;
        posWant.x += rig.px * 0.35 * reach;
        posWant.y += rig.py * 0.18 * reach;
      }
    }

    camera.position.copy(posWant);
    camera.lookAt(lookWant);
    if (Math.abs(fov - rig.fov) > 0.005) {
      // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
      camera.fov = fov;
      camera.updateProjectionMatrix();
      rig.fov = fov;
    }
    camera.updateMatrixWorld();

    // The board on screen, for the hotspot and the reticle.
    let onScreen = false;
    let inFront = true;
    set.board.forEach((corner, i) => {
      v.set(...corner).project(camera);
      night.quad[i][0] = v.x;
      night.quad[i][1] = v.y;
      if (v.z >= 1) inFront = false;
      if (v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) onScreen = true;
    });
    // A board wider than the frame (Logixs' wall on a phone) shows no corner and still fills the picture.
    night.quadOnScreen = onScreen || (inFront && quadOverlapsScreen(night.quad));
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
