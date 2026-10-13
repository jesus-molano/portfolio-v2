"use client";

import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import { isLoadHolding } from "@/features/load/loadHold";
import { getSceneLoading } from "../sceneLoading";
import { MONITOR, newMonitor, quietMonitor, stepMonitor } from "./qualityMonitor";
import { commitIfDue, qualityRuntime, requestDecline } from "./qualityStore";

/** The first frames after the start menu are no measure: the film's first shot is settling in. */
const AFTER_ENTRY_MS = 2000;

/** The first second after the loop wakes or a new level lands is left out: uploads, reallocated targets. */
const AFTER_WAKE_MS = 1000;

/** Until something has measured the display, a frame is expected at 60 Hz. */
const DEFAULT_HZ = 60;

/**
 * Production only, one per canvas: watches the intervals between the frames
 * the canvas draws (qualityMonitor.ts) and asks the visit's quality level
 * to step down when it falls behind (qualityStore.ts), and lands a pending
 * level once it is due. It never counts a frame before she has entered
 * (compiling the scene's programs is no slow device), under the load
 * screen (a save's compile and teardown frames), in a hidden tab, in the
 * first two seconds after she entered, in the first second after the loop
 * wakes or a level lands, nor a frame drawn on request (reduced motion, a
 * canvas at rest repainting a texture).
 */
export const QualityWatch = memo(function QualityWatch() {
  const monitor = useRef(newMonitor());
  const last = useRef(Number.NaN);
  const levelAt = useRef(qualityRuntime.changedAt);

  useFrame((state) => {
    const now = performance.now();
    const interval = now - last.current;
    last.current = now;
    commitIfDue(now);
    const m = monitor.current;
    // A gap longer than a hitch is the loop resting and waking (off screen, under a cover, a frame loop flip).
    if (!(interval <= MONITOR.hitchMs)) quietMonitor(m, now + AFTER_WAKE_MS);
    if (qualityRuntime.changedAt !== levelAt.current) {
      levelAt.current = qualityRuntime.changedAt;
      quietMonitor(m, now + AFTER_WAKE_MS);
    }
    const loading = getSceneLoading();
    const skip =
      !loading.entered ||
      now - loading.enteredAt < AFTER_ENTRY_MS ||
      isLoadHolding() ||
      document.visibilityState !== "visible" ||
      state.frameloop === "demand";
    const hz = qualityRuntime.refreshHz;
    if (stepMonitor(m, { now, intervalMs: interval, expectedMs: 1000 / (hz ?? DEFAULT_HZ), skip })) requestDecline(hz, now);
  });

  return null;
});
