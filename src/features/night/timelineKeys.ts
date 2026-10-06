import type { StageTimeline } from "@/features/work/workTimeline";
import type { Key, Pose } from "./frame";

/** The film position of a point inside a beat (t 0..1), for camera keys. */
export function beatP(timeline: StageTimeline, id: string, t = 0): number {
  const beat = timeline.beats.find((b) => b.id === id);
  if (!beat) throw new Error(`Unknown beat "${id}"`);
  return beat.start + (beat.end - beat.start) * t;
}

/** A key at a point inside a beat. */
export function keyAt(timeline: StageTimeline, id: string, t: number, pose: Pose): Key {
  return { ...pose, p: beatP(timeline, id, t) };
}

/** A stop's film range: from its first beat to its last. */
export function stopRange(timeline: StageTimeline, stop: number): { from: number; to: number } {
  return timeline.stops[stop];
}
