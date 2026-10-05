"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { heroFeedback, heroProgress } from "../scroll/heroProgress";
import { lens } from "./lens";
import { type CameraPose, DRIVER_HEAD, evaluateCamera, SHOTS } from "./shots";

type Props = {
  /** Pointer parallax, desktop only. */
  parallax: boolean;
  /** Snap to the target instead of damping, no idle motion. */
  reducedMotion: boolean;
};

/** Seconds the lens takes to settle on a new shot's bokeh after a cut. */
const LENS_EASE = 0.35;

/**
 * Places the camera on the current shot, framed for the screen's aspect.
 * Inside a shot the pose is damped; on a cut the camera snaps, so the edit
 * reads as a hard cut. Every frame it also points the lens at the driver's
 * head and eases the shot's depth of field in (scene/lens.ts).
 */
export function CameraRig({ parallax, reducedMotion }: Props) {
  const pose = useRef<CameraPose>({
    position: new Vector3(),
    look: new Vector3(),
    fov: 50,
    shot: -1,
  });
  const look = useRef(new Vector3());
  const lastShot = useRef(-1);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    const focus = () => {
      lens.focusDistance = camera.position.distanceTo(DRIVER_HEAD);
    };
    if (process.env.NODE_ENV !== "production") {
      // Dev-only free camera for framing work: window.__vaCam = { position, look, fov }.
      const debug = (window as unknown as { __vaCam?: { position: number[]; look: number[]; fov?: number } }).__vaCam;
      if (debug) {
        camera.position.set(debug.position[0], debug.position[1], debug.position[2]);
        camera.lookAt(debug.look[0], debug.look[1], debug.look[2]);
        if (debug.fov && debug.fov !== camera.fov) {
          camera.fov = debug.fov;
          camera.updateProjectionMatrix();
        }
        focus();
        return;
      }
    }
    const aspect = state.size.width / Math.max(1, state.size.height);
    const target = evaluateCamera(heroProgress.value, pose.current, aspect);
    // The visitor's push widens the lens a little (scroll/throttle.ts).
    if (!reducedMotion) target.fov += heroFeedback.fovKick;
    const shot = SHOTS[target.shot];
    const t = state.clock.elapsedTime;
    const cut = target.shot !== lastShot.current;
    lastShot.current = target.shot;

    // Hand-held and parallax motion scale with the distance to the subject,
    // so a close-up does not shake more than a wide shot.
    const reach = Math.min(1, Math.max(0.15, target.position.distanceTo(DRIVER_HEAD) / 10));
    if (!reducedMotion) {
      // Suspension: a faint bob and sway, stronger close to the asphalt.
      const closeness = shot.id === "low" ? 1.6 : 1;
      target.position.y += (Math.sin(t * 2.1) * 0.025 + Math.sin(t * 5.3) * 0.012) * closeness * Math.max(reach, 0.5);
      target.position.x += Math.sin(t * 0.9) * 0.04 * reach;
    }
    if (parallax) {
      target.position.x += state.pointer.x * 0.5 * reach;
      target.position.y += state.pointer.y * 0.25 * reach;
    }

    const k = reducedMotion || cut ? 1 : 1 - Math.exp(-delta * 4.5);
    camera.position.lerp(target.position, k);
    look.current.lerp(target.look, k);
    if (cut) look.current.copy(target.look);
    camera.lookAt(look.current);

    const fov = cut || reducedMotion ? target.fov : camera.fov + (target.fov - camera.fov) * k;
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Lens: focus on his head; the shot's bokeh eases in across the cut.
    focus();
    const ease = reducedMotion ? 1 : 1 - Math.exp(-delta / LENS_EASE);
    lens.bokehScale += (shot.lens.bokehScale - lens.bokehScale) * ease;
    lens.focusRange += (shot.lens.focusRange - lens.focusRange) * ease;
  });

  return null;
}
