import type { RootState } from "@react-three/fiber";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The frame driver with R3F and the page's ticker faked: `advance` steps a
 * fake root's clock as R3F's does under "never" (the delta is the
 * timestamp less the clock's time) and records what it drew; the render
 * tick is called by hand, one call a frame.
 */
const fiber = vi.hoisted(() => ({
  log: [] as string[],
  advance: (timestamp: number, _global: boolean, state: FakeState) => {
    const delta = timestamp - state.clock.elapsedTime;
    state.clock.elapsedTime = timestamp;
    state.deltas.push(delta);
    fiber.log.push(`draw ${state.name}`);
    state.onFrame?.();
  },
  flushGlobalEffects: (type: string) => {
    fiber.log.push(type);
  },
}));
vi.mock("@react-three/fiber", () => ({ advance: fiber.advance, flushGlobalEffects: fiber.flushGlobalEffects }));

const frame = vi.hoisted(() => ({ tick: null as null | ((time: number, deltaMs: number, stamp: number) => void) }));
vi.mock("@/lib/frameTicker", () => ({
  addFrameTick: (_phase: string, tick: (time: number, deltaMs: number, stamp: number) => void) => {
    frame.tick = tick;
    return () => {
      frame.tick = null;
    };
  },
}));

type FakeState = {
  name: string;
  internal: { active: boolean };
  clock: { elapsedTime: number };
  gl: { domElement: { attrs: Record<string, string>; setAttribute(name: string, value: string): void } };
  frameloop: "never" | "demand";
  invalidate: (frames?: number) => void;
  deltas: number[];
  onFrame?: () => void;
};

function fakeRoot(name: string) {
  const attrs: Record<string, string> = {};
  const state: FakeState = {
    name,
    internal: { active: true },
    clock: { elapsedTime: 0 },
    gl: { domElement: { attrs, setAttribute: (key, value) => void (attrs[key] = value) } },
    frameloop: "never",
    invalidate: vi.fn(),
    deltas: [],
  };
  const get = () => state as unknown as RootState;
  return { state, get, attrs };
}

let driver: typeof import("./frameDriver");
let quality: typeof import("./qualityStore");

beforeEach(async () => {
  vi.resetModules();
  fiber.log.length = 0;
  frame.tick = null;
  driver = await import("./frameDriver");
  quality = await import("./qualityStore");
});

/** One frame of the page at `stamp` ms. */
const tick = (stamp: number) => frame.tick?.(stamp / 1000, 16, stamp);

describe("the frame driver", () => {
  it("draws a canvas that wants to every frame, its clock running from zero at its first", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    tick(1000);
    tick(1016);
    tick(1032);
    expect(hero.state.deltas).toHaveLength(3);
    expect(hero.state.deltas[0]).toBe(0);
    expect(hero.state.deltas[1]).toBeCloseTo(0.016, 9);
    expect(hero.state.deltas[2]).toBeCloseTo(0.016, 9);
  });

  it("runs R3F's global effects once a frame, around every canvas that draws", () => {
    const hero = fakeRoot("hero");
    const night = fakeRoot("night");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    driver.registerRoot({ id: "night", get: night.get, wants: () => true });
    tick(1000);
    expect(fiber.log).toEqual(["before", "draw hero", "draw night", "after"]);
  });

  it("draws a canvas at rest only the frames asked of it, as R3F's invalidate counts them", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => false });
    tick(1000);
    expect(hero.state.deltas).toHaveLength(0);
    driver.requestFrames(hero.get);
    driver.requestFrames(hero.get);
    tick(1016);
    tick(1032);
    expect(hero.state.deltas).toHaveLength(1);
    driver.requestFrames(hero.get, 3);
    for (let i = 0; i < 5; i++) tick(1048 + 16 * i);
    expect(hero.state.deltas).toHaveLength(4);
    // Nothing drew, nothing ran: the global effects too.
    fiber.log.length = 0;
    tick(2000);
    expect(fiber.log).toEqual([]);
  });

  it("draws the next frame too when asked during one", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => false });
    let more = 2;
    hero.state.onFrame = () => {
      if (more-- > 0) driver.requestFrames(hero.get);
    };
    driver.requestFrames(hero.get);
    for (let i = 0; i < 6; i++) tick(1000 + 16 * i);
    expect(hero.state.deltas).toHaveLength(3);
    // Consecutive frames: its clock ran between them.
    expect(hero.state.deltas[1]).toBeCloseTo(0.016, 9);
  });

  it("keeps the frames asked of a canvas while it holds them (the hero, until it is warm)", () => {
    const hero = fakeRoot("hero");
    let warm = false;
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => false, holds: () => !warm });
    driver.requestFrames(hero.get);
    tick(1000);
    tick(1016);
    expect(hero.state.deltas).toHaveLength(0);
    warm = true;
    tick(1032);
    tick(1048);
    expect(hero.state.deltas).toHaveLength(1);
  });

  it("never holds a canvas that wants to draw (she entered before the scene was warm)", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true, holds: () => true });
    tick(1000);
    expect(hero.state.deltas).toHaveLength(1);
  });

  it("keeps a frame asked for before its canvas registered", () => {
    const night = fakeRoot("night");
    driver.requestFrames(night.get);
    driver.registerRoot({ id: "night", get: night.get, wants: () => false });
    tick(1000);
    expect(night.state.deltas).toHaveLength(1);
  });

  it("asks R3F itself for frames of a canvas it does not drive (reduced motion)", () => {
    const still = fakeRoot("still");
    still.state.frameloop = "demand";
    driver.requestFrames(still.get, 1);
    expect(still.state.invalidate).toHaveBeenCalledWith(1);
  });

  it("wakes a canvas after a rest: onWake once, its clock carrying on with no jump", () => {
    const night = fakeRoot("night");
    let wants = true;
    const onWake = vi.fn();
    driver.registerRoot({ id: "night", get: night.get, wants: () => wants, onWake });
    tick(1000);
    tick(1016);
    expect(onWake).toHaveBeenCalledTimes(1);
    wants = false;
    tick(1032);
    tick(9000);
    wants = true;
    tick(9016);
    tick(9032);
    expect(onWake).toHaveBeenCalledTimes(2);
    expect(night.state.deltas.map((d) => +d.toFixed(3))).toEqual([0, 0.016, 0, 0.016]);
    expect(night.state.clock.elapsedTime).toBeCloseTo(0.032, 9);
  });

  it("draws every second refresh of a fast display at half rate, and marks the canvas", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    quality.qualityRuntime.refreshHz = 144;
    quality.qualityRuntime.halfRate = true;
    const refresh = 1000 / 144;
    for (let i = 0; i < 20; i++) tick(1000 + i * refresh);
    expect(hero.state.deltas).toHaveLength(10);
    expect(hero.state.deltas[2]).toBeCloseTo((2 * refresh) / 1000, 6);
    expect(hero.attrs["data-pace"]).toBe("2");
    expect(hero.attrs["data-quality"]).toBe("0");
  });

  it("never paces a display of 100 Hz or less", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    quality.qualityRuntime.refreshHz = 60;
    quality.qualityRuntime.halfRate = true;
    for (let i = 0; i < 20; i++) tick(1000 + (i * 1000) / 60);
    expect(hero.state.deltas).toHaveLength(20);
    expect(hero.attrs["data-pace"]).toBe("1");
  });

  it("reads the display's rate from the frames in which no canvas drew", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => false });
    for (let i = 0; i <= 40; i++) tick(1000 + (i * 1000) / 144);
    expect(quality.qualityRuntime.refreshHz).toBeCloseTo(144, 3);
  });

  it("measures nothing from frames that drew: the GPU stretches them", () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    for (let i = 0; i <= 80; i++) tick(1000 + i * 25);
    expect(quality.qualityRuntime.refreshHz).toBeNull();
  });

  it("draws one hidden frame on request, its clock still, flagged while it draws", () => {
    const night = fakeRoot("night");
    driver.registerRoot({ id: "night", get: night.get, wants: () => false });
    const flagged: boolean[] = [];
    night.state.onFrame = () => flagged.push(driver.isWarmFrame());
    night.state.clock.elapsedTime = 5;
    driver.warmFrame(night.get);
    tick(1000);
    tick(1016);
    expect(flagged).toEqual([true]);
    expect(night.state.deltas).toEqual([0]);
    expect(driver.isWarmFrame()).toBe(false);
  });

  it("lets the other canvas draw and the frame end when one throws, then throws", () => {
    const hero = fakeRoot("hero");
    const night = fakeRoot("night");
    hero.state.onFrame = () => {
      throw new Error("broken frame");
    };
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    driver.registerRoot({ id: "night", get: night.get, wants: () => true });
    expect(() => tick(1000)).toThrow("broken frame");
    expect(fiber.log).toEqual(["before", "draw hero", "draw night", "after"]);
  });

  it("skips a canvas R3F has not set up yet, and stops ticking once none is left", () => {
    const hero = fakeRoot("hero");
    hero.state.internal.active = false;
    const unregister = driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    tick(1000);
    expect(hero.state.deltas).toHaveLength(0);
    expect(frame.tick).not.toBeNull();
    unregister();
    expect(frame.tick).toBeNull();
  });
});
