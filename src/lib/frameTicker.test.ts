import { describe, expect, it, vi } from "vitest";
import { createFrameTicker, frameStamp, type FrameScheduler } from "./frameTicker";

/** Animation frames by hand: `frame(stamp)` runs every callback asked for before it, as the browser does. */
function fakeFrames() {
  let next = 1;
  const pending = new Map<number, (stamp: number) => void>();
  const frames: FrameScheduler = {
    request: (callback) => {
      const handle = next++;
      pending.set(handle, callback);
      return handle;
    },
    cancel: (handle) => {
      pending.delete(handle);
    },
  };
  const frame = (stamp: number) => {
    const due = [...pending.values()];
    pending.clear();
    for (const callback of due) callback(stamp);
  };
  return { frames, frame, waiting: () => pending.size };
}

describe("the page's frame", () => {
  it("runs Lenis, then every stage tick, then every render tick, whatever order they were added in", () => {
    const { frames, frame } = fakeFrames();
    const { addFrameTick } = createFrameTicker(frames);
    const order: string[] = [];
    addFrameTick("render", () => order.push("canvas"));
    addFrameTick("stage", () => order.push("hero"));
    addFrameTick("scroll", () => order.push("lenis"));
    addFrameTick("stage", () => order.push("city"));
    frame(1000);
    expect(order).toEqual(["lenis", "hero", "city", "canvas"]);
  });

  it("asks for one animation frame at a time while any tick is added, and none after", () => {
    const { frames, frame, waiting } = fakeFrames();
    const { addFrameTick } = createFrameTicker(frames);
    expect(waiting()).toBe(0);
    const offScroll = addFrameTick("scroll", () => undefined);
    const offRender = addFrameTick("render", () => undefined);
    expect(waiting()).toBe(1);
    frame(1000);
    expect(waiting()).toBe(1);
    offScroll();
    expect(waiting()).toBe(1);
    offRender();
    expect(waiting()).toBe(0);
    addFrameTick("stage", () => undefined);
    expect(waiting()).toBe(1);
  });

  it("never calls a tick removed during the frame, and stops once the last one goes", () => {
    const { frames, frame, waiting } = fakeFrames();
    const { addFrameTick } = createFrameTicker(frames);
    const later = vi.fn();
    let offLater = () => {};
    let offFirst = () => {};
    offFirst = addFrameTick("stage", () => {
      offLater();
      offFirst();
    });
    offLater = addFrameTick("render", later);
    frame(1000);
    expect(later).not.toHaveBeenCalled();
    expect(waiting()).toBe(0);
  });

  it("passes the frame's time in seconds, the ms since the frame before (0 on the first) and its timestamp", () => {
    const { frames, frame } = fakeFrames();
    const { addFrameTick } = createFrameTicker(frames);
    const seen = vi.fn();
    const off = addFrameTick("render", seen);
    frame(5000);
    frame(5016.5);
    expect(seen).toHaveBeenNthCalledWith(1, 5, 0, 5000);
    expect(seen).toHaveBeenNthCalledWith(2, 5.0165, 16.5, 5016.5);
    // Stopped and started again: no delta across the pause.
    off();
    addFrameTick("render", seen);
    frame(9000);
    expect(seen).toHaveBeenLastCalledWith(9, 0, 9000);
  });

  it("runs on every refresh of a fast display, with nothing capping it (240, 300 and 360 Hz)", () => {
    for (const hz of [240, 300, 360]) {
      const { frames, frame } = fakeFrames();
      const { addFrameTick } = createFrameTicker(frames);
      const deltas: number[] = [];
      addFrameTick("render", (_time, deltaMs) => deltas.push(deltaMs));
      const refresh = 1000 / hz;
      for (let i = 0; i < hz; i++) frame(1000 + i * refresh);
      // GSAP's ticker, at most 240 a second on Date.now's whole milliseconds, skipped one in five at 300 Hz.
      expect(deltas).toHaveLength(hz);
      for (const delta of deltas.slice(1)) expect(delta).toBeCloseTo(refresh, 9);
    }
  });

  it("keeps the frames coming when a tick throws: the rest of the frame runs, then the error is thrown", () => {
    const { frames, frame, waiting } = fakeFrames();
    const { addFrameTick } = createFrameTicker(frames);
    const canvas = vi.fn();
    addFrameTick("stage", () => {
      throw new Error("broken tick");
    });
    addFrameTick("render", canvas);
    expect(() => frame(1000)).toThrow("broken tick");
    expect(canvas).toHaveBeenCalledTimes(1);
    expect(waiting()).toBe(1);
  });

  it("reads the page's clock when the animation frame gives no timestamp", () => {
    const now = () => 777;
    expect(frameStamp(4321.5, now)).toBe(4321.5);
    expect(frameStamp(0, now)).toBe(777);
    expect(frameStamp(true, now)).toBe(777);
    expect(frameStamp(undefined, now)).toBe(777);
    expect(frameStamp(Number.NaN, now)).toBe(777);
  });
});
