import { describe, expect, it } from "vitest";
import {
  boardPoint,
  flicker,
  nearestPhase,
  newSearchlight,
  SEARCHLIGHT,
  type Searchlight,
  type SpotArea,
  type SpotInput,
  searchPath,
  spotBeam,
  springStep,
  stepSearchlight,
  wobble,
} from "./searchlight";

const BOARD: SpotArea = { x0: -9.5, x1: 7.0, y0: 0.6, y1: 4.4 };
const WALL_Z = -6.4;

function run(light: Searchlight, input: Omit<SpotInput, "dt">, seconds: number, fps = 60, each?: (l: Searchlight) => void) {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i += 1) {
    stepSearchlight(light, BOARD, { ...input, dt: 1 / fps });
    each?.(light);
  }
}

describe("the searchlight's follow", () => {
  it("is a critically damped spring: it closes on a target from rest without passing it", () => {
    let x = 0;
    let v = 0;
    let max = 0;
    for (let i = 0; i < 240; i += 1) {
      [x, v] = springStep(x, v, 1, SEARCHLIGHT.follow, 1 / 60);
      max = Math.max(max, x);
    }
    expect(max).toBeLessThanOrEqual(1 + 1e-9);
    expect(x).toBeCloseTo(1, 4);
  });

  it("is the same in one long step as in many short ones (any frame rate)", () => {
    let a: [number, number] = [0, 0];
    for (let i = 0; i < 15; i += 1) a = springStep(a[0], a[1], 2, SEARCHLIGHT.follow, 1 / 60);
    const b = springStep(0, 0, 2, SEARCHLIGHT.follow, 15 / 60);
    expect(a[0]).toBeCloseTo(b[0], 9);
    expect(a[1]).toBeCloseTo(b[1], 9);
  });

  it("maps the board's shares onto the wall: top left and bottom right", () => {
    const [x0, y0] = boardPoint(BOARD, [0, 0]);
    const [x1, y1] = boardPoint(BOARD, [1, 1]);
    expect([x0, y0, x1, y1].map((n) => Number(n.toFixed(9)))).toEqual([-9.5, 4.4, 7.0, 0.6]);
  });
});

describe("armed by the pointer", () => {
  it("comes up where the pointer is, never sweeping in from elsewhere", () => {
    const light = newSearchlight();
    stepSearchlight(light, BOARD, { armed: true, pointer: [0.8, 0.5], tap: null, dt: 1 / 60 });
    const [x, y] = boardPoint(BOARD, [0.8, 0.5]);
    expect(light.x).toBeCloseTo(x, 9);
    expect(light.y).toBeCloseTo(y, 9);
  });

  it("follows the pointer a little behind: under half way after 0.1 s, nearly there after 1 s", () => {
    const light = newSearchlight();
    run(light, { armed: true, pointer: [0.1, 0.5], tap: null }, 0.5);
    const from = light.x;
    const to = boardPoint(BOARD, [0.9, 0.5])[0];
    run(light, { armed: true, pointer: [0.9, 0.5], tap: null }, 0.1);
    expect((light.x - from) / (to - from)).toBeGreaterThan(0.03);
    expect((light.x - from) / (to - from)).toBeLessThan(0.5);
    run(light, { armed: true, pointer: [0.9, 0.5], tap: null }, 0.9);
    expect((light.x - from) / (to - from)).toBeGreaterThan(0.9);
    expect(light.x).toBeLessThanOrEqual(to + 1e-9);
  });

  it("fades in over 0.3 s and out over 0.3 s, and comes up again where it is aimed", () => {
    const light = newSearchlight();
    run(light, { armed: true, pointer: [0.3, 0.5], tap: null }, 0.15);
    expect(light.fade).toBeGreaterThan(0.4);
    expect(light.fade).toBeLessThan(0.6);
    run(light, { armed: true, pointer: [0.3, 0.5], tap: null }, 0.2);
    expect(light.fade).toBe(1);
    // Disarmed: it fades where it is, the pointer gone.
    const x = light.x;
    run(light, { armed: false, pointer: null, tap: null }, 0.15);
    expect(light.fade).toBeGreaterThan(0.4);
    expect(light.x).toBeCloseTo(x, 6);
    run(light, { armed: false, pointer: null, tap: null }, 0.2);
    expect(light.fade).toBe(0);
    expect(light.on).toBe(false);
    // Armed again elsewhere: it comes up there, not from where it went out.
    stepSearchlight(light, BOARD, { armed: true, pointer: [0.9, 0.2], tap: null, dt: 1 / 60 });
    expect(light.x).toBeCloseTo(boardPoint(BOARD, [0.9, 0.2])[0], 9);
  });

  it("never loops back or restarts while the pointer rests: it holds on it", () => {
    const light = newSearchlight();
    const [tx, ty] = boardPoint(BOARD, [0.5, 0.5]);
    let far = 0;
    run(light, { armed: true, pointer: [0.5, 0.5], tap: null }, 20, 60, (l) => {
      far = Math.max(far, Math.hypot(l.x - tx, l.y - ty));
    });
    expect(far).toBeLessThan(1e-9);
    expect(light.fade).toBe(1);
  });
});

describe("armed with no pointer", () => {
  it("settles where the tap landed", () => {
    const light = newSearchlight();
    run(light, { armed: true, pointer: null, tap: [0.62, 0.55] }, 3);
    const [x, y] = boardPoint(BOARD, [0.62, 0.55]);
    expect(light.x).toBeCloseTo(x, 6);
    expect(light.y).toBeCloseTo(y, 6);
  });

  it("searches on its own: a lazy eight over the run, inside the board", () => {
    const light = newSearchlight();
    const xs: number[] = [];
    const ys: number[] = [];
    run(light, { armed: true, pointer: null, tap: null }, SEARCHLIGHT.search.period, 60, (l) => {
      xs.push(l.x);
      ys.push(l.y);
    });
    const span = Math.max(...xs) - Math.min(...xs);
    expect(span).toBeGreaterThan(SEARCHLIGHT.search.ax * 1.6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(SEARCHLIGHT.search.ay);
    for (const x of xs) expect(x).toBeGreaterThan(BOARD.x0 + SEARCHLIGHT.radius);
    for (const x of xs) expect(x).toBeLessThan(BOARD.x1 - SEARCHLIGHT.radius);
    for (const y of ys) expect(y).toBeGreaterThan(BOARD.y0);
    for (const y of ys) expect(y).toBeLessThan(BOARD.y1);
    // A lazy hunt: never faster than 3 m/s.
    for (let i = 1; i < xs.length; i += 1) expect(Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]) * 60).toBeLessThan(3);
  });

  it("is an eight lying down: one lobe each side of its middle, which it crosses twice a lap, once each way", () => {
    const [cx, cy] = searchPath(0);
    expect(cx).toBeCloseTo(SEARCHLIGHT.search.cx, 9);
    expect(cy).toBeCloseTo(SEARCHLIGHT.search.cy, 9);
    const [mx, my] = searchPath(Math.PI);
    expect(mx).toBeCloseTo(cx, 9);
    expect(my).toBeCloseTo(cy, 9);
    const [xA] = searchPath(0.01);
    const [xB] = searchPath(Math.PI + 0.01);
    expect(Math.sign(xA - cx)).not.toBe(Math.sign(xB - cx));
    // Each lobe rises and falls: up then down on the right, the same on the left.
    expect(searchPath(Math.PI / 4)[1]).toBeGreaterThan(cy);
    expect(searchPath((3 * Math.PI) / 4)[1]).toBeLessThan(cy);
  });

  it("picks the search up where the pointer left the light, not at the eight's start", () => {
    const light = newSearchlight();
    run(light, { armed: true, pointer: [0.55, 0.3], tap: null }, 1.5);
    const before = { x: light.x, y: light.y };
    stepSearchlight(light, BOARD, { armed: true, pointer: null, tap: null, dt: 1 / 60 });
    const [px, py] = searchPath(light.phase);
    expect(light.phase).toBeCloseTo(nearestPhase(before.x, before.y) + (Math.PI * 2) / 60 / SEARCHLIGHT.search.period, 6);
    // The eight's nearest point is nearer than its start.
    const [sx, sy] = searchPath(0);
    expect(Math.hypot(px - before.x, py - before.y)).toBeLessThanOrEqual(Math.hypot(sx - before.x, sy - before.y));
    // And the light moves on from where it was: no jump.
    expect(Math.hypot(light.x - before.x, light.y - before.y)).toBeLessThan(0.05);
  });

  it("keeps real time: 6 fps and 60 fps hunt the same eight", () => {
    const a = newSearchlight();
    const b = newSearchlight();
    run(a, { armed: true, pointer: null, tap: null }, 4, 60);
    run(b, { armed: true, pointer: null, tap: null }, 4, 6);
    expect(a.phase).toBeCloseTo(b.phase, 6);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.15);
  });
});

describe("the hover and the rotor", () => {
  it("drifts the spot by a few centimetres, never more", () => {
    let max = 0;
    for (let t = 0; t < 60; t += 0.01) {
      const [dx, dy] = wobble(t);
      max = Math.max(max, Math.abs(dx), Math.abs(dy));
    }
    expect(max).toBeGreaterThan(0.02);
    expect(max).toBeLessThanOrEqual(SEARCHLIGHT.wobble.x + 1e-9);
  });

  it("chops the beam a few percent, at about 11 Hz", () => {
    let min = 1;
    let crossings = 0;
    let last = flicker(0);
    const mid = 1 - SEARCHLIGHT.flicker.depth / 2;
    for (let t = 0.0005; t <= 1; t += 0.0005) {
      const f = flicker(t);
      min = Math.min(min, f);
      if ((last - mid) * (f - mid) < 0) crossings += 1;
      last = f;
    }
    expect(min).toBeGreaterThan(0.94);
    expect(min).toBeLessThan(0.99);
    expect(crossings / 2).toBeGreaterThan(9);
    expect(crossings / 2).toBeLessThan(13);
  });

  it("shines from high over the street toward the wall, its spot a radius across the beam", () => {
    const light = newSearchlight();
    run(light, { armed: true, pointer: [0.5, 0.5], tap: null }, 1);
    const beam = spotBeam(light, WALL_Z);
    expect(beam.to[2]).toBe(WALL_Z);
    expect(beam.from[1] - beam.to[1]).toBeGreaterThan(10);
    expect(beam.from[2] - beam.to[2]).toBeGreaterThan(10);
    const length = Math.hypot(beam.from[0] - beam.to[0], beam.from[1] - beam.to[1], beam.from[2] - beam.to[2]);
    expect(beam.tan * length).toBeCloseTo(SEARCHLIGHT.radius, 9);
    // Slanted from above by 30 to 50 degrees off the wall's normal: a spot slightly taller than wide.
    const tilt = Math.atan2(beam.from[1] - beam.to[1], beam.from[2] - beam.to[2]);
    expect(tilt).toBeGreaterThan((30 * Math.PI) / 180);
    expect(tilt).toBeLessThan((50 * Math.PI) / 180);
    expect(beam.level).toBeGreaterThan(1 - SEARCHLIGHT.flicker.depth - 1e-9);
  });

  it("is dark when off: level 0 before arming and after the fade", () => {
    const light = newSearchlight();
    expect(spotBeam(light, WALL_Z).level).toBe(0);
    run(light, { armed: true, pointer: [0.5, 0.5], tap: null }, 1);
    run(light, { armed: false, pointer: null, tap: null }, 0.5);
    expect(spotBeam(light, WALL_Z).level).toBe(0);
  });
});

describe("still (reduced motion)", () => {
  it("no drift, no chop, no lag, no search path", () => {
    const light = newSearchlight();
    run(light, { armed: true, pointer: null, tap: null, still: true }, 3);
    expect(light.x).toBe(SEARCHLIGHT.search.cx);
    expect(light.y).toBe(SEARCHLIGHT.search.cy);
    stepSearchlight(light, BOARD, { armed: true, pointer: [0.2, 0.4], tap: null, dt: 1 / 60, still: true });
    expect(light.x).toBeCloseTo(boardPoint(BOARD, [0.2, 0.4])[0], 9);
    const beam = spotBeam(light, WALL_Z, true);
    expect(beam.to[0]).toBe(light.x);
    expect(beam.to[1]).toBe(light.y);
    expect(beam.level).toBe(1);
  });
});
