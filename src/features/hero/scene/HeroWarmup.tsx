"use client";

import { useProgress } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { Texture } from "three";
import { useSceneInvalidate } from "./invalidate";
import { compileAsComposed, createWarmTarget, downloadsDone, isWarm, markWarm, uploadTextures, warmKey } from "./warmup";

/** Milliseconds between two looks at the scene while its models come in. */
const LOOK_EVERY_MS = 150;

/**
 * Looks in a row, the downloads done, at a scene unchanged since it was
 * compiled before it counts as warm. drei reports a model loaded a moment
 * before React mounts it (the Suspense boundary retries later), so one look
 * could still see the scene without its last model.
 */
const STABLE_LOOKS = 2;

/** The longest the warm-up holds the scene's readiness once the downloads are done: a slow GPU still gets in. */
const GUARD_MS = 5000;

/**
 * Warms the hero up behind the start menu (warmup.ts): compiles the
 * procedural world while the models download, then, as each one lands,
 * uploads its textures and compiles again, every material as the composer
 * draws it, visible or not: the shots after the first used to compile
 * their parts (the traffic behind, the city, the crane's view) in the first
 * frame that showed them, a stall in the middle of the film. Then it marks
 * the canvas warm, which LoadReporter waits for before it counts the
 * frames that make the scene ready; the guard marks it warm anyway. It
 * only reads the scene, never changes a material (the night clones the
 * models' materials). Its first look runs after the environment is set
 * (SkyEnvironment, a layout effect), which the standard materials'
 * programs depend on.
 */
export function HeroWarmup() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useSceneInvalidate();

  useEffect(() => {
    if (isWarm(gl)) return;
    const target = createWarmTarget();
    const seen = new WeakSet<Texture>();
    let compiled: string | null = null;
    let stable = 0;
    let busy = false;
    let over = false;
    let doneAt = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      over = true;
      target.dispose();
      markWarm(gl);
      // On demand (the load, reduced motion, out of view) a frame must come to see it: LoadReporter counts from there.
      invalidate();
    };

    const look = () => {
      timer = undefined;
      if (over) return;
      const now = performance.now();
      const done = downloadsDone(useProgress.getState());
      if (done && doneAt < 0) doneAt = now;
      if (doneAt >= 0 && now - doneAt >= GUARD_MS) {
        finish();
        return;
      }
      if (!busy) {
        const key = warmKey(scene);
        if (key !== compiled) {
          compiled = key;
          stable = 0;
          busy = true;
          uploadTextures(gl, scene, seen);
          compileAsComposed(gl, scene, camera, scene, target)
            .catch(() => undefined)
            .finally(() => {
              busy = false;
            });
        } else if (done) {
          stable += 1;
          if (stable >= STABLE_LOOKS) {
            finish();
            return;
          }
        }
      }
      timer = setTimeout(look, LOOK_EVERY_MS);
    };

    timer = setTimeout(look, 0);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (over) return;
      over = true;
      target.dispose();
    };
  }, [gl, scene, camera, invalidate]);

  return null;
}
