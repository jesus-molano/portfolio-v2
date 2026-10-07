import type { ComponentType } from "react";
import type { QualityTier } from "@/features/hero/useQualityTier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { StageTimeline } from "@/features/work/workTimeline";
import type { Pose, Vec3 } from "../frame";

/** A light the wet road mirrors as a streak (see shaders/wetRoad.ts). */
export type Streak = { position: Vec3; color: string; level: number };

/**
 * One of the two point lights every stop shares (their count never changes,
 * so no material recompiles at a cut): they light the car and the props
 * with the stop's own neon or sodium.
 */
export type StopLight = { position: Vec3; color: string; intensity: number; distance: number };

export type SetProps = {
  tier: QualityTier;
  locale: Locale;
  work: Dictionary["work"];
  timeline: StageTimeline;
  /** False while another stop is on screen: the set skips its frame work. */
  index: number;
};

/**
 * A stop's set, in its own frame: the origin is the car's stop point, the
 * street runs along +x, the board stands at z < 0 and the camera at z > 0.
 */
export type NightSet = {
  Set: ComponentType<SetProps>;
  /** The board's corners (top left, top right, bottom right, bottom left) and its facing. */
  board: readonly [Vec3, Vec3, Vec3, Vec3];
  boardNormal: Vec3;
  /**
   * The board is drawn wider than a phone's frame (Logixs' wall): it is on
   * screen for its hotspot when it covers any of the screen, not only when
   * a corner shows (hotspot.ts `boardOnScreen`).
   */
  boardWide?: boolean;
  /** What a portrait fit frames for a pose at film position p (default: the board and the car at its line; the shots are direction.ts'). */
  subject?: (pose: Pose, p: number, car: readonly Vec3[]) => readonly Vec3[];
  /** How far a portrait fit may pull the camera back (m). */
  maxBack: number;
  lights: readonly [StopLight, StopLight];
  streaks: readonly Streak[];
  /** Kerbs: the near (camera-side) and far (board-side) edges of the road. */
  kerbs: { near: number; far: number };
  /** The LIVE tally (Heuristik only). */
  tally?: Vec3;
};
