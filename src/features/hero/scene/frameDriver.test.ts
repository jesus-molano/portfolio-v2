import type { RootState } from "@react-three/fiber";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The frame driver with R3F and the page's ticker faked: `advance` steps a
 * fake root's clock as R3F's does under "never" (the delta is the
 * timestamp less the clock's time) and records what it drew; the render
 * tick is called by hand, one call a frame.
 */
const fiber = vi.hoisted(() => ({
  log: [] as string[],
  draws: 0,
  advance: (timestamp: number, _global: boolean, state: FakeState) => {
    const delta = timestamp - state.clock.elapsedTime;
    state.clock.elapsedTime = timestamp;
    state.deltas.push(delta);
    fiber.draws += 1;
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

// She has long entered: the monitor counts every frame (it watches only in a production build).
vi.mock("../sceneLoading", () => ({
  getSceneLoading: () => ({ entered: true, enteredAt: Number.NEGATIVE_INFINITY }),
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
  fiber.draws = 0;
  frame.tick = null;
  driver = await import("./frameDriver");
  quality = await import("./qualityStore");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** One frame of the page at `stamp` ms. */
const tick = (stamp: number) => frame.tick?.(stamp / 1000, 16, stamp);

/** The driver as a production build runs it: the quality monitor watches the frames. */
async function production() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.resetModules();
  frame.tick = null;
  driver = await import("./frameDriver");
  quality = await import("./qualityStore");
}

/**
 * The page's frames from `from` for `ms`: `next(drew)` is the interval to
 * the next frame after one in which a canvas drew or none did (a GPU that
 * falls behind stretches only the frames that drew). Returns where it got to.
 */
function run(from: number, ms: number, next: (drew: boolean) => number): number {
  let now = from;
  while (now < from + ms) {
    const before = fiber.draws;
    tick(now);
    now += next(fiber.draws > before);
  }
  return now;
}

/** A canvas that draws while `wanting.on`, after a second at rest behind the start menu at `hz` (the rate read there). */
function enteredAt(hz: number) {
  const hero = fakeRoot("hero");
  const wanting = { on: false };
  driver.registerRoot({ id: "hero", get: hero.get, wants: () => wanting.on });
  const end = run(0, 1000, () => 1000 / hz);
  expect(quality.qualityRuntime.refreshHz).toBeCloseTo(hz, 3);
  wanting.on = true;
  return { hero, end };
}

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

describe("drawing a canvas again after its buffer was cleared", () => {
  it("draws a canvas that is drawing once more before the page paints, its clock still", async () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    tick(1000);
    tick(1016);
    // A level landed at the cut in this frame: React resizes the canvas in a microtask after it.
    quality.qualityRuntime.changedAt = 1016.4;
    driver.redrawSoon(hero.get);
    driver.redrawSoon(hero.get);
    expect(hero.state.deltas).toHaveLength(2);
    await Promise.resolve();
    expect(hero.state.deltas).toHaveLength(3);
    expect(hero.state.deltas[2]).toBe(0);
    // The next frame carries on from the frame before, not from the redraw.
    tick(1032);
    expect(hero.state.deltas[3]).toBeCloseTo(0.016, 9);
  });

  it("leaves a canvas at rest to the frame asked of it: out of sight, it shows nothing cleared", async () => {
    const night = fakeRoot("night");
    driver.registerRoot({ id: "night", get: night.get, wants: () => false });
    tick(1000);
    quality.qualityRuntime.changedAt = 1000.4;
    driver.redrawSoon(night.get);
    await Promise.resolve();
    expect(night.state.deltas).toHaveLength(0);
  });

  it("leaves a window's resize to the next frame, which draws before the page paints", async () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    quality.qualityRuntime.changedAt = 900;
    tick(1000);
    driver.redrawSoon(hero.get);
    await Promise.resolve();
    expect(hero.state.deltas).toHaveLength(1);
  });

  it("draws after the frame a change inside it, and never again from a redraw's own frame", async () => {
    const hero = fakeRoot("hero");
    driver.registerRoot({ id: "hero", get: hero.get, wants: () => true });
    hero.state.onFrame = () => driver.redrawSoon(hero.get);
    quality.qualityRuntime.changedAt = 1000.4;
    tick(1000);
    expect(hero.state.deltas).toHaveLength(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(hero.state.deltas).toHaveLength(2);
  });
});

describe("the quality monitor (a production build)", () => {
  beforeEach(production);

  it("never steps down a canvas that keeps up with a 240, 300 or 360 Hz display", async () => {
    for (const hz of [240, 300, 360]) {
      await production();
      const { hero, end } = enteredAt(hz);
      const draws = fiber.draws;
      const frames = Math.round((10_000 * hz) / 1000);
      run(end, 10_000, () => 1000 / hz);
      expect(fiber.draws - draws).toBeGreaterThanOrEqual(frames - 1);
      expect(quality.getQuality().level).toBe(0);
      expect(quality.getQuality().pending).toBeNull();
      expect(quality.getQuality().halfRate).toBe(false);
      expect(hero.attrs["data-pace"]).toBe("1");
    }
  });

  it("steps down a canvas that falls behind its display, once a check has found the rate the same", () => {
    const { end } = enteredAt(60);
    // Twelve seconds on time: the rate read behind the start menu is no longer trusted.
    const later = run(end, 12_000, () => 1000 / 60);
    expect(quality.getQuality().level).toBe(0);
    // The GPU falls behind: a frame that draws takes two refreshes, one that does not takes one.
    run(later, 8000, (drew) => (drew ? 2000 / 60 : 1000 / 60));
    expect(quality.qualityRuntime.refreshHz).toBeCloseTo(60, 3);
    expect(quality.getQuality().level).toBeGreaterThanOrEqual(1);
  });

  it("takes a power mode holding the page at 30 frames a second for a new rate, not a slow GPU", () => {
    const { hero, end } = enteredAt(60);
    const later = run(end, 12_000, () => 1000 / 60);
    // Chrome's Energy Saver comes on: every frame takes two refreshes, drawn or not.
    const after = run(later, 6000, () => 1000 / 30);
    expect(quality.qualityRuntime.refreshHz).toBeCloseTo(30, 3);
    expect(quality.getQuality().level).toBe(0);
    expect(quality.getQuality().pending).toBeNull();
    run(after, 10_000, () => 1000 / 30);
    expect(quality.getQuality().level).toBe(0);
    expect(hero.attrs["data-pace"]).toBe("1");
  });

  it("takes another display for a new rate (144 Hz to 60), never for a step to half rate", () => {
    const { end } = enteredAt(144);
    const later = run(end, 12_000, () => 1000 / 144);
    run(later, 8000, () => 1000 / 60);
    expect(quality.qualityRuntime.refreshHz).toBeCloseTo(60, 3);
    expect(quality.getQuality().halfRate).toBe(false);
    expect(quality.getQuality().level).toBe(0);
  });

  it("checks nothing, and draws every frame, when there is nothing left to give up", () => {
    const { end } = enteredAt(60);
    for (let i = 0; i < 6; i++) {
      quality.requestDecline(60, i);
      quality.markCut(i + 0.5);
    }
    expect(quality.canStepDown(60)).toBe(false);
    const later = run(end, 12_000, () => 1000 / 60);
    const draws = fiber.draws;
    let frames = 0;
    run(later, 6000, () => {
      frames += 1;
      return 1000 / 30;
    });
    expect(fiber.draws - draws).toBe(frames);
  });

  it("steps down a canvas whose every frame takes longer than a hitch", () => {
    const { end } = enteredAt(60);
    run(end, 8000, () => 300);
    expect(quality.getQuality().level + (quality.getQuality().pending ?? 0)).toBeGreaterThanOrEqual(1);
  });
});
