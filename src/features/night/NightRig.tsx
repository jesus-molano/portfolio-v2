"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type PerspectiveCamera, Vector3 } from "three";
import type { StageTimeline } from "@/features/work/workTimeline";
import { carBeat, carX } from "./carPath";
import { carBox, fitPose, poseAt, SAFE } from "./frame";
import { night } from "./nightState";
import type { NightSet } from "./sets/types";

/** Lowest eye height a fitted camera may take (m). */
const MIN_EYE = 0.7;

const v = new Vector3();
const toCamera = new Vector3();
const normal = new Vector3();

type DevWindow = Window & { __vaCam?: { position: [number, number, number]; look: [number, number, number]; fov: number } };

/**
 * The night camera. Each stop's shot is a list of keys on the film
 * (sets/*); the pose follows the picture 1:1 and cuts hard at every stop.
 * On a portrait screen the pose is fitted to the stop's board (frame.ts).
 * Every frame it also projects the active board's corners and the LIVE
 * tally for the stage's hotspot, reticle and iris.
 */
export function NightRig({ timeline, sets }: { timeline: StageTimeline; sets: readonly NightSet[] }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const keys = useMemo(() => sets.map((set) => set.shots(timeline)), [sets, timeline]);
  const portraitKeys = useMemo(() => sets.map((set) => (set.portrait ?? set.shots)(timeline)), [sets, timeline]);
  const last = useRef({ fov: 0 });

  // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
  useFrame(({ size }) => {
    const set = sets[night.stop];
    const aspect = size.width / Math.max(1, size.height);
    const stopKeys = (aspect < 1 ? portraitKeys : keys)[night.stop];
    if (!set || !stopKeys) return;
    let pose = poseAt(stopKeys, night.p);
    if (aspect < 1) {
      // The board and the car together: a phone never loses the car off the frame's edge.
      const car = carBox(carX(carBeat(timeline, night.p)));
      const subject = set.subject ? set.subject(pose, night.p, car) : [...set.board, ...car];
      pose = fitPose(pose, subject, aspect, SAFE.portrait, set.maxBack);
      // A fit never takes the camera under the street.
      const lift = Math.max(0, MIN_EYE - pose.position[1]);
      if (lift > 0) {
        pose = {
          ...pose,
          position: [pose.position[0], pose.position[1] + lift, pose.position[2]],
          look: [pose.look[0], pose.look[1] + lift, pose.look[2]],
        };
      }
    }
    const dev = process.env.NODE_ENV !== "production" ? (window as DevWindow).__vaCam : undefined;
    if (dev) pose = dev;
    camera.position.set(...pose.position);
    camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
    if (last.current.fov !== pose.fov) {
      // eslint-disable-next-line react-hooks/immutability -- per-frame scene state, the R3F pattern
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
      last.current.fov = pose.fov;
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
