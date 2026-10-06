import { describe, expect, it } from "vitest";
import {
  BLIP_GAP_MS,
  BLIP_LEVEL,
  dbToGain,
  ease,
  gainToDb,
  mixAt,
  mixTarget,
  PAUSE_BLIPS,
  PAUSE_IDLE,
  PAUSE_MIX,
  pauseStep,
  rampCurve,
  rampTo,
} from "./pauseMix";

describe("the paused mix", () => {
  it("muffles the radio behind a wall and ducks it by about 10 dB, never mutes it", () => {
    const paused = mixTarget(true);
    expect(gainToDb(paused.gain)).toBeCloseTo(-10, 5);
    expect(paused.cutoff).toBeGreaterThanOrEqual(700);
    expect(paused.cutoff).toBeLessThanOrEqual(900);
  });

  it("is transparent while the game runs", () => {
    expect(mixTarget(false)).toEqual({ gain: 1, cutoff: PAUSE_MIX.open });
    expect(PAUSE_MIX.open).toBeGreaterThanOrEqual(18_000);
  });

  it("converts dB both ways", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-20)).toBeCloseTo(0.1, 10);
    expect(gainToDb(dbToGain(-7.5))).toBeCloseTo(-7.5, 10);
    expect(gainToDb(0)).toBe(-120);
  });
});

describe("ease", () => {
  it("runs from 0 to 1, slow at both ends, and clamps", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
    expect(ease(Number.NaN)).toBe(1);
  });
});

describe("mixAt", () => {
  const into = rampTo(null, true, 1000);

  it("eases into the pause in about a quarter of a second", () => {
    expect(into.ms).toBeGreaterThanOrEqual(200);
    expect(into.ms).toBeLessThanOrEqual(300);
    expect(mixAt(into, 1000)).toEqual(mixTarget(false));
    expect(mixAt(into, 1000 + into.ms)).toEqual(mixTarget(true));
    expect(mixAt(into, 5000)).toEqual(mixTarget(true));
  });

  it("moves the gain evenly in dB and the cutoff evenly in octaves", () => {
    const half = mixAt(into, 1000 + into.ms / 2);
    expect(gainToDb(half.gain)).toBeCloseTo(PAUSE_MIX.duckDb / 2, 5);
    expect(Math.log2(PAUSE_MIX.open / half.cutoff)).toBeCloseTo(Math.log2(PAUSE_MIX.open / PAUSE_MIX.cutoff) / 2, 5);
  });

  it("only ever goes one way along a ramp", () => {
    let previous = mixAt(into, 1000);
    for (let t = 1000; t <= 1000 + into.ms; t += 10) {
      const now = mixAt(into, t);
      expect(now.gain).toBeLessThanOrEqual(previous.gain + 1e-12);
      expect(now.cutoff).toBeLessThanOrEqual(previous.cutoff + 1e-9);
      previous = now;
    }
  });

  it("takes a ramp over from where it is, never from its end (no jump when she turns back)", () => {
    const halfway = 1000 + into.ms / 2;
    const back = rampTo(into, false, halfway);
    expect(back.from).toEqual(mixAt(into, halfway));
    expect(back.to).toEqual(mixTarget(false));
    expect(back.ms).toBe(PAUSE_MIX.outMs);
    expect(mixAt(back, halfway)).toEqual(back.from);
  });
});

describe("rampCurve", () => {
  it("samples a param from the ramp's start to its end", () => {
    const ramp = rampTo(null, true, 0);
    const gain = rampCurve(ramp, "gain", 11);
    const cutoff = rampCurve(ramp, "cutoff");
    expect(gain).toHaveLength(11);
    expect(gain[0]).toBeCloseTo(1, 5);
    expect(gain[10]).toBeCloseTo(dbToGain(PAUSE_MIX.duckDb), 5);
    expect(cutoff[0]).toBeCloseTo(PAUSE_MIX.open, 0);
    expect(cutoff[cutoff.length - 1]).toBeCloseTo(PAUSE_MIX.cutoff, 0);
    expect(rampCurve(ramp, "gain", 1)).toHaveLength(2);
  });
});

describe("pauseStep", () => {
  it("pauses with a blip and resumes with another", () => {
    const paused = pauseStep(PAUSE_IDLE, true, 10_000);
    expect(paused).toMatchObject({ changed: true, blip: "pause", state: { paused: true, lastBlip: 10_000 } });
    const resumed = pauseStep(paused.state, false, 20_000);
    expect(resumed).toMatchObject({ changed: true, blip: "resume", state: { paused: false, lastBlip: 20_000 } });
  });

  it("does nothing when nothing changes", () => {
    const step = pauseStep(PAUSE_IDLE, false, 0);
    expect(step.changed).toBe(false);
    expect(step.blip).toBeNull();
    expect(step.state).toBe(PAUSE_IDLE);
  });

  it("never rattles: the line crossed back and forth moves the mix but blips once", () => {
    let state = PAUSE_IDLE;
    const blips: string[] = [];
    for (const [on, at] of [
      [true, 0],
      [false, 120],
      [true, 260],
      [false, 400],
      [true, 550],
    ] as const) {
      const step = pauseStep(state, on, at);
      expect(step.changed).toBe(true);
      if (step.blip) blips.push(step.blip);
      state = step.state;
    }
    expect(blips).toEqual(["pause"]);
    // Once things settle, leaving is heard again.
    expect(pauseStep(state, false, BLIP_GAP_MS + 1).blip).toBe("resume");
  });
});

describe("the blips", () => {
  it("fall as the game pauses and rise as it resumes", () => {
    const pitches = (kind: keyof typeof PAUSE_BLIPS) => PAUSE_BLIPS[kind].map((note) => note.frequency);
    const [pauseFirst, pauseLast] = [pitches("pause")[0], pitches("pause").at(-1)!];
    const [resumeFirst, resumeLast] = [pitches("resume")[0], pitches("resume").at(-1)!];
    expect(pauseLast).toBeLessThan(pauseFirst);
    expect(resumeLast).toBeGreaterThan(resumeFirst);
  });

  it("are short and quiet: under 0.4 s, never a beep over the music", () => {
    for (const notes of Object.values(PAUSE_BLIPS)) {
      const end = Math.max(...notes.map((note) => note.at + note.length));
      expect(end).toBeLessThan(0.4);
      for (const note of notes) {
        expect(note.level).toBeGreaterThan(0);
        expect(note.level).toBeLessThanOrEqual(1);
        // In the ear's soft middle, not a piercing whistle.
        expect(note.frequency).toBeGreaterThan(400);
        expect(note.frequency).toBeLessThan(1500);
      }
    }
    expect(BLIP_LEVEL).toBeLessThanOrEqual(0.06);
  });
});
