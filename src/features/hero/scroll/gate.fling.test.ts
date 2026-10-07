import { describe, expect, it } from "vitest";
import { GATE, newStroke, resetStroke, steadyFling, strokeLift, strokeMove } from "./gate";

/**
 * A flick of `dy` px over `ms`, the finger sampled every 8 ms, read by a page drawing a frame every
 * `frameMs` (a multiple of 8): each frame gets that frame's moves as one coalesced touchmove. Lenis
 * 1.3.26 under syncTouch sets its target at once on every move (lerp 1) and its velocity in its
 * frame, so at the lift its velocity is the last frame's move, and its fling |velocity|^1.7. With
 * `sameTask`, the lift comes in the same task as the last frame's moves (a frame blocked longer than
 * the gesture's tail): Lenis' velocity is still the frame before's.
 */
function flick(dy: number, ms: number, frameMs: number, sameTask = false) {
  const stroke = newStroke();
  resetStroke(stroke, 1000);
  let velocity = 0;
  let last = 0;
  for (let t = frameMs; t <= ms; t += frameMs) {
    const move = (dy * frameMs) / ms;
    strokeMove(stroke, move, 1000 + t);
    velocity = last;
    last = move;
  }
  if (!sameTask) velocity = last;
  const at = 1000 + ms + 4;
  return { lenis: Math.abs(velocity) ** 1.7, steady: steadyFling(stroke, 1.7, at), lift: strokeLift(stroke, at) };
}

describe("steadyFling", () => {
  it("flings a flick as far at 20 or 30 fps as at 60, where Lenis' own flew three to six times further", () => {
    const at60 = flick(420, 96, 16);
    expect(at60.lift).toBe(1);
    // At 60 fps it is Lenis' own fling, within a tenth.
    expect(at60.steady).toBeGreaterThan(at60.lenis * 0.9);
    expect(at60.steady).toBeLessThan(at60.lenis * 1.1);
    for (const frameMs of [32, 48]) {
      const slow = flick(420, 96, frameMs);
      expect(slow.lenis).toBeGreaterThan(at60.lenis * 3);
      expect(slow.lift).toBe(1);
      expect(slow.steady).toBeLessThan(at60.lenis * 1.25);
      expect(slow.steady).toBeGreaterThan(at60.lenis * 0.75);
    }
  });

  it("flings a flick whose lift shares a frame's task with its last moves as far as at 60 fps", () => {
    const at60 = flick(420, 96, 16);
    for (const frameMs of [48, 96]) {
      // Lenis' velocity was still the frame before's (or zeroed): measured, it flew 150 px, then none.
      const loaded = flick(420, 96, frameMs, true);
      expect(loaded.lift).toBe(1);
      expect(loaded.steady).toBeGreaterThan(at60.lenis * 0.75);
      expect(loaded.steady).toBeLessThan(at60.lenis * 1.25);
    }
  });

  it("flings nothing for a finger that stopped before it lifted, or never moved", () => {
    const s = newStroke();
    resetStroke(s, 0);
    for (let t = 16; t <= 96; t += 16) strokeMove(s, 70, t);
    expect(steadyFling(s, 1.7, 96 + GATE.flingStaleMs)).toBeGreaterThan(0);
    expect(steadyFling(s, 1.7, 96 + GATE.flingStaleMs + 1)).toBe(0);
    expect(steadyFling(newStroke(), 1.7, 0)).toBe(0);
    const still = newStroke();
    resetStroke(still, 0);
    expect(steadyFling(still, 1.7, 8)).toBe(0);
  });

  it("reads one coalesced move from the landing: a flick of a single frame still flings", () => {
    const s = newStroke();
    resetStroke(s, 0);
    strokeMove(s, 300, 60);
    expect(steadyFling(s, 1.7, 64)).toBeGreaterThan((300 / 60 * GATE.flingFrameMs * 0.9) ** 1.7);
  });
});

/**
 * A flick as iOS reports it: 160 px over 90 ms, the finger sampled once a display frame (60 Hz),
 * accelerating into the lift; `tail` moves that did not move (a force or contact change as the finger
 * leaves the glass, `dt` ms apart) after it, and the lift `gap` ms after the last one.
 */
function iosFlick({ step = 1000 / 60, gap = 16, tail = [] as number[], ios = true } = {}) {
  const stroke = newStroke();
  resetStroke(stroke, 0);
  const n = Math.round(90 / step);
  let y = 0;
  let t = 0;
  for (let i = 1; i <= n; i += 1) {
    t = (90 * i) / n;
    const next = 160 * (i / n) ** 2;
    strokeMove(stroke, next - y, t, ios && next === y);
    y = next;
  }
  for (const dt of tail) {
    t += dt;
    strokeMove(stroke, 0, t, ios);
  }
  const at = t + gap;
  return { lift: strokeLift(stroke, at), fling: strokeLift(stroke, at) === 0 ? 0 : steadyFling(stroke, 1.7, at, ios) };
}

describe("steadyFling on iOS", () => {
  const prompt = iosFlick({ gap: 16 }).fling;

  it("flings a flick whose lift comes a frame or more behind its last move", () => {
    expect(prompt).toBeGreaterThan(500);
    for (const gap of [41, 50, 80, GATE.flingStaleMsIos]) {
      const late = iosFlick({ gap });
      expect(late.lift).toBe(1);
      expect(late.fling).toBe(prompt);
    }
    // Read by the rest of the page's rule, the same lifts flew nothing: the page moved only as far as the finger.
    expect(iosFlick({ gap: 50, ios: false }).fling).toBe(0);
  });

  it("takes no speed from moves that did not move before the lift", () => {
    expect(iosFlick({ tail: [16, 16], gap: 8 }).fling).toBe(prompt);
    // Read as samples of the finger's speed, two of them took the fling down to a few px.
    expect(iosFlick({ tail: [16, 16], gap: 8, ios: false }).fling).toBeLessThan(prompt * 0.05);
  });

  it("still flings nothing for a finger that stopped before it lifted", () => {
    // Its moves stopped moving for 150 ms: it came to rest.
    expect(iosFlick({ tail: Array(9).fill(16), gap: 8 })).toEqual({ lift: 0, fling: 0 });
    // A lift past the window, or after a finger that rested with no moves at all.
    expect(iosFlick({ gap: GATE.flingStaleMsIos + 1 }).fling).toBe(0);
    expect(iosFlick({ gap: 160 })).toEqual({ lift: 0, fling: 0 });
  });

  it("leaves every other platform's rule as it was", () => {
    // A 120 Hz flick (Android): flung up to 40 ms after the last move, nothing after.
    const android = (gap: number) => iosFlick({ step: 90 / 11, gap, ios: false });
    expect(android(6).fling).toBeGreaterThan(500);
    expect(android(GATE.flingStaleMs).fling).toBe(android(6).fling);
    expect(android(GATE.flingStaleMs + 1).fling).toBe(0);
    expect(GATE.flingStaleMs).toBe(40);
  });

  it("keeps a move that did not move in the stroke's slop and rest", () => {
    const s = newStroke();
    resetStroke(s, 0);
    expect(strokeMove(s, 0, 16, true)).toBe(0);
    expect(s.speedAt).toBe(0);
    expect(strokeMove(s, 10, 32, false)).toBe(10);
    expect(s.speedAt).toBe(32);
    const speed = s.speed;
    expect(strokeMove(s, 0, 48, true)).toBe(0);
    expect(s.speed).toBe(speed);
    expect(s.speedAt).toBe(32);
    // Standing that way for restMs, it has come to rest all the same.
    strokeMove(s, 0, 32 + GATE.restMs, true);
    expect(strokeMove(s, GATE.touchSlop, 32 + GATE.restMs + 16)).toBe(0);
  });
});
