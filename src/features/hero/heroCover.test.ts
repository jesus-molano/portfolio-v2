import { afterEach, describe, expect, it, vi } from "vitest";
import { getHeroCovered, isCovered, setHeroCovered, subscribeHeroCovered } from "./heroCover";

afterEach(() => setHeroCovered(false));

describe("heroCover", () => {
  it("counts the picture covered only under the opaque night", () => {
    expect(isCovered(0)).toBe(false);
    expect(isCovered(0.998)).toBe(false);
    expect(isCovered(0.999)).toBe(true);
    expect(isCovered(1)).toBe(true);
  });

  it("tells its listeners only when it flips", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHeroCovered(listener);
    setHeroCovered(true);
    setHeroCovered(true);
    expect(getHeroCovered()).toBe(true);
    setHeroCovered(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setHeroCovered(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
