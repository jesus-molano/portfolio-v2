import { describe, expect, it, vi } from "vitest";
import { createFrameTicker, frameStamp, type Ticker } from "./frameTicker";

type Callback = (time: number, deltaMs: number, frame: number, stamp: number) => void;

function fakeTicker() {
  const listeners: Callback[] = [];
  const ticker: Ticker = {
    add: (callback) => listeners.push(callback),
    remove: (callback) => {
      const i = listeners.indexOf(callback);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  const tick = (stamp: unknown = 1000) => {
    for (const listener of [...listeners]) listener(1, 16, 1, stamp as number);
  };
  return { ticker, listeners, tick };
}

describe("the page's frame", () => {
  it("runs every stage tick before any render tick, whatever order they were added in", () => {
    const { ticker, tick } = fakeTicker();
    const { addFrameTick } = createFrameTicker(ticker);
    const order: string[] = [];
    addFrameTick("render", () => order.push("canvas"));
    addFrameTick("stage", () => order.push("hero"));
    addFrameTick("stage", () => order.push("city"));
    tick();
    expect(order).toEqual(["hero", "city", "canvas"]);
  });

  it("holds one listener on the ticker while any tick is added, and none after", () => {
    const { ticker, listeners } = fakeTicker();
    const { addFrameTick } = createFrameTicker(ticker);
    const offStage = addFrameTick("stage", () => undefined);
    const offRender = addFrameTick("render", () => undefined);
    expect(listeners).toHaveLength(1);
    offStage();
    expect(listeners).toHaveLength(1);
    offRender();
    expect(listeners).toHaveLength(0);
    addFrameTick("stage", () => undefined);
    expect(listeners).toHaveLength(1);
  });

  it("never calls a tick removed during the frame", () => {
    const { ticker, tick } = fakeTicker();
    const { addFrameTick } = createFrameTicker(ticker);
    const later = vi.fn();
    let offLater = () => {};
    addFrameTick("stage", () => offLater());
    offLater = addFrameTick("render", later);
    tick();
    expect(later).not.toHaveBeenCalled();
  });

  it("passes GSAP's time and delta, and the animation frame's timestamp", () => {
    const { ticker, tick } = fakeTicker();
    const { addFrameTick } = createFrameTicker(ticker);
    const seen = vi.fn();
    addFrameTick("render", seen);
    tick(5123.4);
    expect(seen).toHaveBeenCalledWith(1, 16, 5123.4);
  });

  it("reads the page's clock when the ticker gives no timestamp (its wake-up, a manual tick)", () => {
    const now = () => 777;
    expect(frameStamp(4321.5, now)).toBe(4321.5);
    expect(frameStamp(2, now)).toBe(777);
    expect(frameStamp(true, now)).toBe(777);
    expect(frameStamp(undefined, now)).toBe(777);
    expect(frameStamp(Number.NaN, now)).toBe(777);
  });
});
