import { afterEach, describe, expect, it, vi } from "vitest";
import type { IdleScheduler } from "@/lib/idle";
import { createPrefetch, PREFETCH_TIMEOUT_MS, sharedImport } from "./prefetch";

/** Idle periods the test hands out. */
function fakeIdle() {
  const waiting: { run: () => void; timeoutMs: number }[] = [];
  const idle: IdleScheduler = {
    request: (run, timeoutMs) => waiting.push({ run: () => run({ didTimeout: false, timeRemaining: () => 20 }), timeoutMs }),
    cancel: () => undefined,
  };
  return { idle: () => idle, waiting };
}

/** A browser window, its reduced-motion setting and its data saver. */
function browser({ still = false, saveData = false } = {}) {
  vi.stubGlobal("window", { matchMedia: (query: string) => ({ matches: still && query.includes("reduce") }) });
  vi.stubGlobal("navigator", { connection: { saveData } });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the night's prefetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for the night's code once, in an idle period, then paints ahead", async () => {
    browser();
    const night = { paintNightAhead: vi.fn() };
    const load = vi.fn(() => Promise.resolve(night));
    const { idle, waiting } = fakeIdle();
    const prefetch = createPrefetch(load, idle);
    prefetch();
    prefetch();
    expect(waiting).toHaveLength(1);
    expect(waiting[0].timeoutMs).toBe(PREFETCH_TIMEOUT_MS);
    // Nothing fetched before the page is idle.
    expect(load).not.toHaveBeenCalled();
    waiting[0].run();
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(night.paintNightAhead).toHaveBeenCalledTimes(1);
  });

  it("fetches nothing for a visitor saving data, or where the night never mounts", () => {
    for (const setting of [{ saveData: true }, { still: true }]) {
      browser(setting);
      const load = vi.fn(() => Promise.resolve({ paintNightAhead: () => undefined }));
      const { idle, waiting } = fakeIdle();
      createPrefetch(load, idle)();
      expect(waiting).toHaveLength(0);
      expect(load).not.toHaveBeenCalled();
    }
  });

  it("does nothing on the server", () => {
    const load = vi.fn(() => Promise.resolve({ paintNightAhead: () => undefined }));
    const { idle, waiting } = fakeIdle();
    createPrefetch(load, idle)();
    expect(waiting).toHaveLength(0);
  });

  it("paints nothing ahead when the code fails to come, and says nothing of it", async () => {
    browser();
    const { idle, waiting } = fakeIdle();
    const load = vi.fn(() => Promise.reject(new Error("chunk failed to load")));
    createPrefetch(load, idle)();
    waiting[0].run();
    // Handled: no unhandled rejection reaches the page (the mount asks again for itself).
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("sharedImport", () => {
  it("is one import for the prefetch and the mount", async () => {
    const load = vi.fn(() => Promise.resolve("night"));
    const ask = sharedImport(load);
    const first = ask();
    expect(ask()).toBe(first);
    await expect(first).resolves.toBe("night");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed import", async () => {
    let fail = true;
    const load = vi.fn((): Promise<string> => (fail ? Promise.reject(new Error("chunk failed to load")) : Promise.resolve("night")));
    const ask = sharedImport(load);
    await expect(ask()).rejects.toThrow("chunk failed to load");
    await settle();
    fail = false;
    await expect(ask()).resolves.toBe("night");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
