import { afterEach, describe, expect, it, vi } from "vitest";
import { afterLoadHold, beginLoad, endHold, isLoadHolding, loadOwnsEntry, registerLoadCurtain, startHold, subscribeLoadHold } from "./loadHold";
import { SAVES } from "./saves";

afterEach(() => endHold());

describe("the load hold", () => {
  it("runs what waits on it at once when nothing is loading", () => {
    const fn = vi.fn();
    afterLoadHold(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("queues behind a load, in order, and runs them as it ends", () => {
    const order: number[] = [];
    startHold({ ownsEntry: false });
    afterLoadHold(() => order.push(1));
    afterLoadHold(() => order.push(2));
    expect(order).toEqual([]);
    endHold();
    expect(order).toEqual([1, 2]);
    // A second end changes nothing.
    endHold();
    expect(order).toEqual([1, 2]);
  });

  it("owns the start menu's landing only while it holds", () => {
    startHold({ ownsEntry: true });
    expect(loadOwnsEntry()).toBe(true);
    endHold();
    expect(loadOwnsEntry()).toBe(false);
    startHold({ ownsEntry: false });
    expect(loadOwnsEntry()).toBe(false);
  });

  it("tells its listeners when it starts and ends", () => {
    const seen: boolean[] = [];
    const stop = subscribeLoadHold(() => seen.push(isLoadHolding()));
    startHold({ ownsEntry: false });
    endHold();
    stop();
    expect(seen).toEqual([true, false]);
  });

  it("hands a load to the screen that registered, and says so when none did", () => {
    const save = SAVES[3];
    expect(beginLoad(save, { mode: "page", via: "pointer", picture: "" })).toBe(false);
    const begin = vi.fn(() => true);
    const unregister = registerLoadCurtain(begin);
    expect(beginLoad(save, { mode: "page", via: "key", picture: "/load/stats-160.webp" })).toBe(true);
    expect(begin).toHaveBeenCalledWith(save, { mode: "page", via: "key", picture: "/load/stats-160.webp" });
    unregister();
    expect(beginLoad(save, { mode: "page", via: "pointer", picture: "" })).toBe(false);
  });
});
