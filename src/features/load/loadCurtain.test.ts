import { describe, expect, it } from "vitest";
import {
  checkDone,
  curtainKey,
  heroDone,
  inBand,
  LOAD,
  loadProgress,
  loadVerdict,
  nightDone,
  slotScene,
  stepVisibleClock,
} from "./loadCurtain";
import { SAVE_IDS } from "./saves";

describe("the load screen's verdict", () => {
  const ready = { visibleMs: 1000, painted: 2, okPolls: 2, goNow: false };

  it("lifts once the minimum has passed, the new place is painted and every check held for two polls", () => {
    expect(loadVerdict(ready)).toBe("lift");
    expect(loadVerdict({ ...ready, visibleMs: LOAD.minMs - 1 })).toBe("hold");
    expect(loadVerdict({ ...ready, painted: 1 })).toBe("hold");
    // One poll that found everything in is not enough: a later render may add an image.
    expect(loadVerdict({ ...ready, okPolls: 1 })).toBe("hold");
  });

  it("lifts at the hard limit whatever is left, and on Go in now", () => {
    expect(loadVerdict({ visibleMs: LOAD.capMs, painted: 0, okPolls: 0, goNow: false })).toBe("lift");
    expect(loadVerdict({ visibleMs: 0, painted: 0, okPolls: 0, goNow: true })).toBe("lift");
    expect(loadVerdict({ visibleMs: LOAD.capMs - 1, painted: 5, okPolls: 0, goNow: false })).toBe("hold");
  });

  it("gives up on each check at its own limit", () => {
    expect(checkDone(false, LOAD.facesMs - 1, LOAD.facesMs)).toBe(false);
    expect(checkDone(false, LOAD.facesMs, LOAD.facesMs)).toBe(true);
    expect(checkDone(true, 0, LOAD.imagesMs)).toBe(true);
    // Every limit is inside the hard one, and "Go in now" comes before it.
    for (const limit of [LOAD.facesMs, LOAD.imagesMs, LOAD.heroMs, LOAD.nightMs]) expect(limit).toBeLessThanOrEqual(LOAD.capMs);
    expect(LOAD.slowMs).toBeLessThan(LOAD.capMs);
    expect(LOAD.tipMs).toBeLessThan(LOAD.slowMs);
  });
});

describe("the load screen's clock", () => {
  it("counts only time she could see it, a long frame in full", () => {
    let clock = { ms: 0, last: 0 };
    clock = stepVisibleClock(clock, 100, true);
    expect(clock.ms).toBe(100);
    // A hidden tab for ten seconds: nothing.
    clock = stepVisibleClock(clock, 10_100, false);
    expect(clock.ms).toBe(100);
    clock = stepVisibleClock(clock, 10_200, true);
    expect(clock.ms).toBe(200);
    // A main thread blocked for 3 s: 3 s.
    clock = stepVisibleClock(clock, 13_200, true);
    expect(clock.ms).toBe(3200);
  });
});

describe("what a slot waits for", () => {
  it("lands the prologue on the hero's canvas and the main story on the city's, the rest on none", () => {
    expect(slotScene("hero", false)).toBe("hero");
    expect(slotScene("work", false)).toBe("night");
    for (const id of SAVE_IDS.filter((id) => id !== "hero" && id !== "work")) expect(slotScene(id, false)).toBe("none");
    // Under reduced motion the hero is a still screen and the city its plates.
    for (const id of SAVE_IDS) expect(slotScene(id, true)).toBe("none");
  });

  it("counts a box on her first screen, or just below it", () => {
    const vh = 800;
    expect(inBand({ top: 100, bottom: 300, width: 200, height: 200 }, vh)).toBe(true);
    expect(inBand({ top: vh + LOAD.band - 1, bottom: vh + 400, width: 200, height: 200 }, vh)).toBe(true);
    expect(inBand({ top: vh + LOAD.band, bottom: vh + 400, width: 200, height: 200 }, vh)).toBe(false);
    expect(inBand({ top: -400, bottom: 0, width: 200, height: 400 }, vh)).toBe(false);
    expect(inBand({ top: 100, bottom: 100, width: 0, height: 0 }, vh)).toBe(false);
  });

  it("waits for the hero's fresh frames at the top, unless it has no canvas", () => {
    const base = { ready: true, frames: 10, framesAtJump: 10, hasCanvas: true };
    expect(heroDone(base)).toBe(false);
    expect(heroDone({ ...base, frames: 10 + LOAD.heroFrames })).toBe(true);
    expect(heroDone({ ...base, ready: false, frames: 99 })).toBe(false);
    expect(heroDone({ ...base, hasCanvas: false })).toBe(true);
  });

  it("waits for the city only where it is wanted, and never for a city that failed", () => {
    const base = {
      wanted: true,
      mounted: true,
      onScreen: true,
      readiness: "ready" as const,
      frames: 50,
      framesAtJump: 50,
      covered: false,
    };
    expect(nightDone({ ...base, wanted: false, mounted: false, readiness: "waiting" })).toBe(true);
    expect(nightDone({ ...base, readiness: "failed", mounted: false })).toBe(true);
    // Its mount, one long task, happens under the screen, on screen or off.
    expect(nightDone({ ...base, mounted: false, onScreen: false, readiness: "waiting" })).toBe(false);
    expect(nightDone({ ...base, onScreen: false, readiness: "waiting" })).toBe(true);
    expect(nightDone({ ...base, readiness: "waiting" })).toBe(false);
    // Ready from an earlier pass: fresh frames from where she landed, or resting under the stage's own night.
    expect(nightDone(base)).toBe(false);
    expect(nightDone({ ...base, frames: 50 + LOAD.nightFrames })).toBe(true);
    expect(nightDone({ ...base, covered: true })).toBe(true);
  });
});

describe("the load screen's bar", () => {
  it("never goes back and fills only when everything is in", () => {
    expect(loadProgress(0, 1, 4, false)).toBe(0.25);
    expect(loadProgress(0.5, 1, 4, false)).toBe(0.5);
    expect(loadProgress(0, 4, 4, false)).toBe(0.95);
    expect(loadProgress(0.2, 4, 4, true)).toBe(1);
    expect(loadProgress(0, 0, 0, false)).toBe(0);
  });
});

describe("the keys while it loads", () => {
  const key = (k: string, extra: Partial<Parameters<typeof curtainKey>[0]> = {}) =>
    curtainKey({ key: k, ctrlKey: false, metaKey: false, altKey: false, repeat: false, onGoNow: false, holding: true, spent: false, ...extra });

  it("takes every key that would move, play, drive or skip behind it", () => {
    for (const k of ["Escape", "End", "Home", "PageDown", "PageUp", " ", "Enter", "ArrowDown", "w", "q", "[", "]"]) expect(key(k), k).toBe("block");
    // The hero takes Ctrl+End and Cmd+Down as Skip.
    expect(key("End", { ctrlKey: true })).toBe("block");
    expect(key("ArrowDown", { metaKey: true })).toBe("block");
  });

  it("lets Tab, the browser's own shortcuts and Go in now's own keys through", () => {
    expect(key("Tab")).toBe("pass");
    expect(key("r", { ctrlKey: true })).toBe("pass");
    expect(key("f", { metaKey: true })).toBe("pass");
    expect(key("Enter", { onGoNow: true })).toBe("pass");
    expect(key(" ", { onGoNow: true })).toBe("pass");
    expect(key("Enter", { onGoNow: true, repeat: true })).toBe("block");
  });

  it("keeps the loading key's autorepeat from playing anything after the lift", () => {
    expect(key("Enter", { holding: false, spent: true, repeat: true })).toBe("block");
    expect(key("Enter", { holding: false, spent: false, repeat: true })).toBe("pass");
    expect(key("Enter", { holding: false, spent: true, repeat: false })).toBe("pass");
  });
});
