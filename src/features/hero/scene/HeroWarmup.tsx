"use client";

import { useProgress } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { Object3D, Texture } from "three";
import { createIdleLoop } from "@/lib/idle";
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

/** Idle periods, as the night's Warmup takes them: a step at least every half second, whatever the page does. */
const WARM_IDLE = { timeoutMs: 500, reserveMs: 4 } as const;

/**
 * Warms the hero up behind the start menu (warmup.ts): compiles the
 * procedural world while the models download, then, as each one lands,
 * uploads its textures and compiles again, every material as the composer
 * draws it, visible or not: the shots after the first used to compile
 * their parts (the traffic behind, the city, the crane's view) in the first
 * frame that showed them, a stall in the middle of the film. It works in
 * the page's idle periods (lib/idle.ts), as the night's does, a texture or
 * one of the scene's parts (a child of the scene) a step: run whole each
 * time a model landed, every texture uploaded and the whole scene compiled
 * in one task, it held the start menu for seconds on a slow machine, her
 * keys and SETTINGS waiting behind it. Then it marks the canvas warm, which
 * LoadReporter waits for before it counts the frames that make the scene
 * ready; the guard marks it warm anyway. It only reads the scene, never
 * changes a material (the night clones the models' materials). Its first
 * look runs after the environment is set (SkyEnvironment, a layout
 * effect), which the standard materials' programs depend on.
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
    const compiled = new WeakMap<Object3D, string>();
    let sceneKey: string | null = null;
    let stable = 0;
    let busy = false;
    let over = false;
    let doneAt = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      over = true;
      idle.stop();
      target.dispose();
      markWarm(gl);
      // On demand (the load, reduced motion, out of view) a frame must come to see it: LoadReporter counts from there.
      invalidate();
    };

    // Looks again shortly: the downloads, a model mounting or the guard may change what is left to do.
    const lookAgain = () => {
      if (timer !== undefined || over) return;
      timer = setTimeout(() => {
        timer = undefined;
        idle.wake();
      }, LOOK_EVERY_MS);
    };

    const step = (): boolean => {
      if (over || busy) return false;
      const now = performance.now();
      const done = downloadsDone(useProgress.getState());
      if (done && doneAt < 0) doneAt = now;
      if (doneAt >= 0 && now - doneAt >= GUARD_MS) {
        finish();
        return false;
      }
      // A texture a step: the driver's skin or the boards' atlas is a long upload on its own.
      if (uploadTextures(gl, scene, seen, 1) > 0) {
        stable = 0;
        return true;
      }
      // Then a part a step, each compiled for the composer, lit by the whole scene.
      for (const part of scene.children) {
        const key = warmKey(part);
        if (key === null || compiled.get(part) === key) continue;
        compiled.set(part, key);
        stable = 0;
        busy = true;
        compileAsComposed(gl, part, camera, scene, target)
          .catch(() => undefined)
          .finally(() => {
            busy = false;
            idle.wake();
          });
        return false;
      }
      // Every part compiled as it stands: warm once the downloads are done and nothing has changed for a while.
      const key = warmKey(scene);
      if (key !== sceneKey) {
        sceneKey = key;
        stable = 0;
      } else if (done) {
        stable += 1;
        if (stable >= STABLE_LOOKS) {
          finish();
          return false;
        }
      }
      lookAgain();
      return false;
    };

    const idle = createIdleLoop(step, WARM_IDLE);
    idle.wake();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      idle.stop();
      if (over) return;
      over = true;
      target.dispose();
    };
  }, [gl, scene, camera, invalidate]);

  return null;
}
