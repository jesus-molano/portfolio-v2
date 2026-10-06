/**
 * The camera's direction of the night drive: one list of keys per stop, on
 * the film (frame.ts eases between two keys with a smoothstep, so every
 * change of framing is a camera move that starts and lands softly). The
 * sets hold the geometry (where the board stands, what a phone must
 * frame); this file holds how the camera films it, so the two can change
 * apart.
 *
 * The grammar, the same at every stop:
 * - The arrival: up out of the dip to night, the camera picks the car up as
 *   it rolls in (its look pans with the car: `track`, rig.ts) and settles
 *   on the board as it brakes. The board is framed and held before the
 *   first line, so its words are read before any move.
 * - The lines: slow pushes only, at most 3 m and a few degrees a line
 *   (direction.test.ts); a change of framing between two lines has a beat
 *   of its own (PwC's marquee, Cloud District's flips, the crane).
 * - The leave: the camera lets the car go, turning a little after it, and
 *   the picture dips to night as it leaves the shot (work/dip.ts).
 *
 * A key is a beat and a point inside it: keys sit on beats, never on film
 * positions, so the pacing follows the script in both languages.
 */
import type { StageTimeline } from "@/features/work/workTimeline";
import { type Key, LENS, type Pose, type Vec3 } from "./frame";
import { keyAt } from "./timelineKeys";

export type Direction = {
  /** Keys for a landscape screen. */
  shots: (timeline: StageTimeline) => Key[];
  /** Keys for a portrait screen, fitted to the stop's subject there (frame.ts fitPose). */
  portrait?: (timeline: StageTimeline) => Key[];
  /**
   * Where the stop's captions (the HUD and the super, top left) stand on a
   * portrait screen, a phone, when the stop's art holds the top left of its
   * portrait shots (work stage, `data-caption-side`; at most `CAPTION_SPAN`
   * of the width). Left when unset.
   */
  phoneCaptions?: "right";
};

/** The share of a portrait screen's width the stop's captions take when they stand on the right (Work.module.css). */
export const CAPTION_SPAN = 0.48;

function pose(position: Vec3, look: Vec3, fov: number, extra: Pick<Pose, "track" | "fit"> = {}): Pose {
  return { position, look, fov, ...extra };
}

/** A key that pans with the car (rig.ts): the look is the car's cabin. */
const TRACK = { track: 1 } as const;
/** On a phone, a key that keeps its own framing rather than the stop's fit. */
const OWN = { fit: 0 } as const;

/**
 * The army: the roadside billboard. Under the bridge line the camera rides
 * behind the car down the coast road, the board ahead; as the car brakes at
 * its foot the camera comes round low behind its rear quarter, his head
 * and shoulder a dark shape under the board, and holds there for the lines.
 */
const army: Direction = {
  shots: (timeline) => {
    const chaseFar = pose([-62, 2.0, 7.5], [-44, 1.2, 0], LENS.mm35, TRACK);
    const chaseNear = pose([-24, 2.1, 7.5], [-8, 1.2, 0], LENS.mm35, TRACK);
    const read = pose([-8.6, 1.6, 3.0], [10.5, 3.85, -13], LENS.mm28);
    const readOn = pose([-7.8, 1.62, 2.75], [10.5, 3.9, -13], LENS.mm28);
    const readOn2 = pose([-7.2, 1.64, 2.6], [10.5, 3.95, -13], LENS.mm28);
    const letGo = pose([-6.9, 1.66, 2.5], [13.5, 3.75, -12], LENS.mm28);
    return [
      keyAt(timeline, "title", 0, chaseFar),
      keyAt(timeline, "bridge", 0.15, chaseFar),
      keyAt(timeline, "army.arrive", 0, chaseNear),
      keyAt(timeline, "army.arrive", 1, read),
      keyAt(timeline, "army.card0", 1, readOn),
      keyAt(timeline, "army.card1", 1, readOn2),
      keyAt(timeline, "army.leave", 0.15, readOn2),
      keyAt(timeline, "army.leave", 1, letGo),
    ];
  },
  // On a phone the same ride in, then from down the road, so the car stops in front of the board's foot.
  portrait: (timeline) => {
    const chaseFar = pose([-60, 2.2, 8], [-44, 1.2, 0], 50, { ...TRACK, ...OWN });
    const chaseNear = pose([-22, 2.2, 8.5], [-8, 1.2, 0], 50, { ...TRACK, ...OWN });
    return [
      keyAt(timeline, "title", 0, chaseFar),
      keyAt(timeline, "bridge", 0.15, chaseFar),
      keyAt(timeline, "army.arrive", 0, chaseNear),
      keyAt(timeline, "army.arrive", 1, pose([-8.6, 2.25, 12.6], [9, 5.2, -13], LENS.mm35)),
      keyAt(timeline, "army.card1", 1, pose([-8, 2.3, 12], [9, 5.2, -13], LENS.mm35)),
      keyAt(timeline, "army.leave", 0.15, pose([-8, 2.3, 12], [9, 5.2, -13], LENS.mm35)),
      keyAt(timeline, "army.leave", 1, pose([-7.6, 2.3, 11.8], [10.5, 5.0, -13], LENS.mm35)),
    ];
  },
};

/**
 * PwC: the hotel's neon blade and the marquee under it face the oncoming
 * car, down the street; the check-in sign with the years hangs on the
 * facade over the lobby. From the kerb the camera watches the car drive on
 * to the hotel and brake under the blade, the whole hotel in frame: P, W
 * and C, the years and the car. Then it rises to the blade and reads it
 * down to the marquee, whose readerboard bills the work the lines are
 * about, the car at its foot, and holds there; as the car pulls away it
 * eases back and turns a little after it.
 */
const pwc: Direction = {
  shots: (timeline) => {
    // From the kerb, down the street: the car passes the camera and drives on to the hotel, the blade whole.
    const kerb = pose([-46, 1.6, 9.5], [-10, 7.6, -4], LENS.mm28);
    const hotel = pose([-40, 2.2, 15], [0, 9.6, -5], LENS.mm28);
    // On its way to the marquee the camera rises to the blade and reads it down: it closes on W first,
    // so C is cropped before P leaves the frame, and slides down tight, so W is cropped before C is whole
    // again. The blade never reads WC (direction.test.ts).
    const bladeMid = { ...pose([-10.5, 10, 4.5], [0, 13.4, -4.9], LENS.mm50), pass: true };
    const reader = pose([-12.5, 1.6, 4.2], [0, 2.0, -4.6], LENS.mm50);
    const readerOn = pose([-11.8, 1.6, 4.0], [0, 2.02, -4.6], LENS.mm50);
    const readerOn2 = pose([-11.2, 1.62, 3.85], [0, 2.05, -4.6], LENS.mm50);
    // The car pulls away out of the shot; the camera eases back and turns a little after it, the marquee kept.
    const letGo = pose([-13, 1.8, 5.0], [3.5, 2.2, -4.0], LENS.mm50, { track: 0.15 });
    return [
      keyAt(timeline, "pwc.open", 0, kerb),
      keyAt(timeline, "pwc.open", 1, hotel),
      keyAt(timeline, "pwc.marquee", 0.5, bladeMid),
      keyAt(timeline, "pwc.marquee", 1, reader),
      keyAt(timeline, "pwc.card0", 1, readerOn),
      keyAt(timeline, "pwc.card1", 1, readerOn2),
      keyAt(timeline, "pwc.leave", 0.12, readerOn2),
      keyAt(timeline, "pwc.leave", 1, letGo),
    ];
  },
  // On a phone the hotel is fitted from the start (the blade, the years, the car); the marquee keeps its own close framing.
  // There the blade's C stands over the readerboard, left of the car (seen from down the street the car is
  // always right of the board), in the top left of every reading shot: no framing keeps the C, the readerboard
  // and the car in a tall frame without it, so the captions stand on the right and the C reads whole.
  phoneCaptions: "right",
  portrait: (timeline) => {
    const kerb = pose([-40, 2.2, 13], [0, 10, -5], LENS.mm35);
    const hotel = pose([-36, 2.4, 14], [0, 10, -5], LENS.mm35);
    const bladeMid = { ...pose([-10.5, 10, 4.5], [0, 13.4, -4.9], 26, OWN), pass: true };
    // Further back down the street than on a wide screen, so the readerboard and the car line up in a tall frame.
    const reader = pose([-21, 2.0, 10], [0, 2.0, -3.4], 40, OWN);
    const readerOn = pose([-20.2, 2.0, 9.6], [0, 2.02, -3.4], 40, OWN);
    const readerOn2 = pose([-19.6, 2.02, 9.3], [0, 2.05, -3.4], 40, OWN);
    const letGo = pose([-21, 2.2, 10.2], [3, 2.3, -2.6], 40, { ...OWN, track: 0.15 });
    return [
      keyAt(timeline, "pwc.open", 0, kerb),
      keyAt(timeline, "pwc.open", 1, hotel),
      keyAt(timeline, "pwc.marquee", 0.5, bladeMid),
      keyAt(timeline, "pwc.marquee", 1, reader),
      keyAt(timeline, "pwc.card0", 1, readerOn),
      keyAt(timeline, "pwc.card1", 1, readerOn2),
      keyAt(timeline, "pwc.leave", 0.12, readerOn2),
      keyAt(timeline, "pwc.leave", 1, letGo),
    ];
  },
};

/**
 * Cloud District: the trivision on the roof over the corner, the car waiting
 * at the light under it. From the far pavement, low, so the board stands
 * over the café and the car stops in the clear above the subtitles.
 */
const cloud: Direction = {
  shots: (timeline) => {
    const pickUp = pose([-22, 1.8, 30], [-20, 1.2, 0], LENS.mm35, TRACK);
    const corner = pose([-6, 1.9, 40], [0.5, 9.2, -11], LENS.mm35);
    const across = pose([-4, 1.95, 40], [1, 9.3, -11], LENS.mm35);
    const letGo = pose([-3.6, 1.95, 40], [4.5, 9.0, -11], LENS.mm35, { track: 0.2 });
    return [
      keyAt(timeline, "cloud.open", 0, pickUp),
      keyAt(timeline, "cloud.open", 1, corner),
      keyAt(timeline, "cloud.card1", 1, across),
      keyAt(timeline, "cloud.leave", 0.15, across),
      keyAt(timeline, "cloud.leave", 1, letGo),
    ];
  },
  portrait: (timeline) => {
    const pickUp = pose([-22, 2.0, 30], [-20, 1.2, 0], 50, { ...TRACK, ...OWN });
    const corner = pose([-6, 2.4, 34], [0.5, 9.2, -11], LENS.mm35);
    const across = pose([-4.5, 2.4, 34], [1, 9.3, -11], LENS.mm35);
    return [
      keyAt(timeline, "cloud.open", 0, pickUp),
      keyAt(timeline, "cloud.open", 1, corner),
      keyAt(timeline, "cloud.card1", 1, across),
      keyAt(timeline, "cloud.leave", 0.15, across),
      keyAt(timeline, "cloud.leave", 1, pose([-4, 2.4, 34], [4, 9.0, -11], LENS.mm35)),
    ];
  },
};

/** The poster wall's face (sets/LogixsSet.tsx). */
const WALL_Z = -6.4;

/**
 * Logixs: the wall of torn posters. The camera picks the car up down the
 * street and pans with it to the wall, landing square on to the run (the
 * ban, the snipe, this season's bills) with the car in front of it, and
 * holds there for both lines; with the light it turns to the corner.
 */
const logixs: Direction = {
  shots: (timeline) => {
    const wall = (x: number, z = 7.8) => pose([x, 2.2, z], [x, 2.45, WALL_Z], LENS.mm28);
    return [
      keyAt(timeline, "logixs.open", 0, pose([-12, 1.9, 9], [-24, 1.2, 0], LENS.mm28, TRACK)),
      keyAt(timeline, "logixs.open", 1, wall(-1.6)),
      keyAt(timeline, "logixs.card0", 1, wall(-1.4, 7.5)),
      keyAt(timeline, "logixs.card1", 1, wall(-1.0, 7.3)),
      keyAt(timeline, "logixs.signal", 1, pose([0.6, 2.2, 8.2], [4.5, 2.4, WALL_Z], LENS.mm28)),
      keyAt(timeline, "logixs.leave", 1, pose([1.6, 2.2, 8.4], [8, 2.3, WALL_Z], LENS.mm28, { track: 0.3 })),
    ];
  },
  // On a phone: the run fitted (the ban, the snipe, the two bills) over the car; then the corner and its light.
  portrait: (timeline) => {
    const run = (x: number, z = 13) => pose([x, 3.0, z], [x, 2.3, WALL_Z], LENS.mm35);
    return [
      keyAt(timeline, "logixs.open", 0, pose([-14, 2.2, 12], [-24, 1.2, 0], 50, { ...TRACK, ...OWN })),
      keyAt(timeline, "logixs.open", 1, run(-2)),
      keyAt(timeline, "logixs.card1", 1, run(-1.8, 12.7)),
      keyAt(timeline, "logixs.signal", 1, pose([5.5, 2.6, 12], [6.8, 2.3, WALL_Z], 50, OWN)),
      keyAt(timeline, "logixs.leave", 1, pose([6.4, 2.6, 12], [9.5, 2.2, WALL_Z], 50, { ...OWN, track: 0.3 })),
    ];
  },
};

/**
 * Heuristik: the car rolls into the plaza under the landmark (its name over
 * the lobby's canopy), then the crane climbs the tower at a crane's pace and
 * looks up at the crown: the screens and the tally.
 */
const heuristik: Direction = {
  shots: (timeline) => {
    const kerb = pose([-14, 1.5, 14], [-24, 1.2, 0], LENS.mm28, TRACK);
    const shoulder = pose([-6, 1.6, 11], [6, 13, -42], LENS.mm28);
    const top = pose([2, 50, 40], [8, 89, -42], 30);
    const topOn = pose([1.7, 50.4, 39.5], [8, 89.3, -42], 30);
    return [
      keyAt(timeline, "heuristik.open", 0, kerb),
      keyAt(timeline, "heuristik.open", 1, shoulder),
      keyAt(timeline, "heuristik.crane", 0, shoulder),
      keyAt(timeline, "heuristik.crane", 1, top),
      keyAt(timeline, "heuristik.card1", 1, topOn),
    ];
  },
  // On a phone the street keeps its own framing (the car, the canopy and its name), and the crane eases into the crown's fit.
  portrait: (timeline) => {
    const kerb = pose([-14, 1.6, 14], [-24, 1.2, 0], 50, { ...TRACK, ...OWN });
    const street = pose([-5, 1.8, 15], [6, 9, -30], 55, OWN);
    const top = pose([2, 50, 46], [8, 88.5, -42], 40);
    const topOn = pose([1.7, 50.4, 45.5], [8, 88.8, -42], 40);
    return [
      keyAt(timeline, "heuristik.open", 0, kerb),
      keyAt(timeline, "heuristik.open", 1, street),
      keyAt(timeline, "heuristik.crane", 0, street),
      keyAt(timeline, "heuristik.crane", 1, top),
      keyAt(timeline, "heuristik.card1", 1, topOn),
    ];
  },
};

/** One direction per stop, in the order of the drive (work/stops.ts, sets/registry.ts). */
export const DIRECTION: readonly Direction[] = [army, pwc, cloud, logixs, heuristik];
