import { afterEach, describe, expect, it } from "vitest";
import { getHeroCovered, getHeroInView, isCovered, setHeroCovered, setHeroInView } from "./heroCover";

afterEach(() => {
  setHeroCovered(false);
  setHeroInView(true);
});

describe("heroCover", () => {
  it("counts the picture covered only under the opaque night", () => {
    expect(isCovered(0)).toBe(false);
    expect(isCovered(0.998)).toBe(false);
    expect(isCovered(0.999)).toBe(true);
    expect(isCovered(1)).toBe(true);
  });

  it("holds what the stage and the observer last wrote, in view until told otherwise", () => {
    expect(getHeroCovered()).toBe(false);
    expect(getHeroInView()).toBe(true);
    setHeroCovered(true);
    setHeroInView(false);
    expect(getHeroCovered()).toBe(true);
    expect(getHeroInView()).toBe(false);
  });
});
