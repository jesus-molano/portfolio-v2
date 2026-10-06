/**
 * The radio behind the pause menu, as in a game: while STATS (the pause
 * menu) is the section on screen, the music sounds as if it played in the
 * room next door, muffled by a low-pass filter and ducked by about 10 dB,
 * and a short blip answers the pause and the resume. Pure: the player
 * (player.ts) schedules what this computes on its Web Audio graph, and
 * radio.ts steps the state machine. Nothing here sounds without the radio
 * on: the visitor chose audio, and only then does the pause have a sound.
 */

/** The mix the decks go through: a gain (linear) and a low-pass cutoff (Hz). */
export type Mix = { gain: number; cutoff: number };

export const PAUSE_MIX = {
  /** The duck while paused, in dB. */
  duckDb: -10,
  /** The low-pass cutoff while paused: the music behind a wall. */
  cutoff: 800,
  /** The filter wide open: above hearing, so it changes nothing. */
  open: 20_000,
  /** Eased in as the menu arrives. */
  inMs: 250,
  /** Eased back as she leaves it, a touch slower, so the music swells back in. */
  outMs: 380,
} as const;

/** dB to a linear gain. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** Linear gain to dB; silence is -120 dB, so it stays a number. */
export function gainToDb(gain: number): number {
  return gain > 1e-6 ? 20 * Math.log10(gain) : -120;
}

/** The mix to reach: paused or playing. */
export function mixTarget(paused: boolean): Mix {
  return paused ? { gain: dbToGain(PAUSE_MIX.duckDb), cutoff: PAUSE_MIX.cutoff } : { gain: 1, cutoff: PAUSE_MIX.open };
}

/** A move from one mix to another, from `start` (ms) over `ms`. */
export type MixRamp = { from: Mix; to: Mix; start: number; ms: number };

/** Ease in and out (smoothstep), clamped to [0, 1]. */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1));
  return x * x * (3 - 2 * x);
}

/**
 * The mix `now` ms into a ramp. The gain moves evenly in dB and the cutoff
 * evenly in octaves (the way the ear hears both), along the same ease, so
 * the duck and the muffle arrive together and never click.
 */
export function mixAt(ramp: MixRamp, now: number): Mix {
  const t = ease(ramp.ms > 0 ? (now - ramp.start) / ramp.ms : 1);
  const db = gainToDb(ramp.from.gain) + (gainToDb(ramp.to.gain) - gainToDb(ramp.from.gain)) * t;
  const octaves = Math.log2(ramp.to.cutoff / ramp.from.cutoff) * t;
  return { gain: t >= 1 ? ramp.to.gain : dbToGain(db), cutoff: t >= 1 ? ramp.to.cutoff : ramp.from.cutoff * 2 ** octaves };
}

/**
 * The ramp from wherever the mix is `now` (a ramp still running is taken
 * over from its current value, never restarted from its end) to the
 * paused or the playing mix.
 */
export function rampTo(current: MixRamp | null, paused: boolean, now: number): MixRamp {
  const from = current ? mixAt(current, now) : mixTarget(!paused);
  return { from, to: mixTarget(paused), start: now, ms: paused ? PAUSE_MIX.inMs : PAUSE_MIX.outMs };
}

/**
 * A ramp sampled for AudioParam.setValueCurveAtTime: `points` values of
 * one of the mix's two params, from the ramp's start to its end.
 */
export function rampCurve(ramp: MixRamp, param: keyof Mix, points = 24): Float32Array {
  const curve = new Float32Array(Math.max(2, points));
  for (let i = 0; i < curve.length; i++) {
    curve[i] = mixAt(ramp, ramp.start + (ramp.ms * i) / (curve.length - 1))[param];
  }
  return curve;
}

/** One note of a blip: when it starts (s), its pitch (Hz), how long it rings (s) and its share of the peak. */
export type BlipNote = { at: number; frequency: number; length: number; level: number };

/**
 * The pause and resume blips, made with oscillators (no file): two soft
 * notes a fourth apart, falling as the game stops and rising as it goes
 * on, like a menu's. Low enough not to sting at the music's level.
 */
export const PAUSE_BLIPS: Record<"pause" | "resume", readonly BlipNote[]> = {
  pause: [
    { at: 0, frequency: 987.77, length: 0.09, level: 0.8 },
    { at: 0.07, frequency: 739.99, length: 0.26, level: 1 },
  ],
  resume: [
    { at: 0, frequency: 739.99, length: 0.08, level: 0.75 },
    { at: 0.06, frequency: 987.77, length: 0.18, level: 0.85 },
  ],
};

/** The blips' peak, before her volume: under the music, never over it. */
export const BLIP_LEVEL = 0.045;

/** Two blips never come closer than this (ms): the edge of the screen crossed back and forth is one pause. */
export const BLIP_GAP_MS = 700;

export type PauseState = {
  paused: boolean;
  /** When the last blip sounded (ms), or -Infinity. */
  lastBlip: number;
};

export const PAUSE_IDLE: PauseState = { paused: false, lastBlip: Number.NEGATIVE_INFINITY };

/**
 * One step of the pause: the menu arrives (`paused` true) or leaves at
 * `now` (ms). `changed` says the mix must move; `blip` which blip sounds,
 * if any: one per change, but none within BLIP_GAP_MS of the last, so a
 * visitor scrolling back and forth over the line hears one, not a rattle.
 */
export function pauseStep(state: PauseState, paused: boolean, now: number): { state: PauseState; changed: boolean; blip: "pause" | "resume" | null } {
  if (paused === state.paused) return { state, changed: false, blip: null };
  const blip = now - state.lastBlip >= BLIP_GAP_MS ? (paused ? "pause" : "resume") : null;
  return { state: { paused, lastBlip: blip ? now : state.lastBlip }, changed: true, blip };
}
