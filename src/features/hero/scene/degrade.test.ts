import { describe, expect, it } from "vitest";
import { FULL_DPR, declineLevel, degradedSettings } from "./degrade";

describe("degradedSettings", () => {
  it("keeps everything at level 0", () => {
    expect(degradedSettings("high", 0)).toEqual({ depthOfField: true, dpr: FULL_DPR });
    expect(degradedSettings("low", 0)).toEqual({ depthOfField: false, dpr: FULL_DPR });
  });

  it("drops the depth of field first on the high tier, then the pixels", () => {
    expect(degradedSettings("high", 1)).toEqual({ depthOfField: false, dpr: FULL_DPR });
    expect(degradedSettings("high", 2)).toEqual({ depthOfField: false, dpr: 1 });
  });

  it("drops the pixels at once on the low tier, which has no depth of field", () => {
    expect(degradedSettings("low", 1)).toEqual({ depthOfField: false, dpr: 1 });
  });
});

describe("declineLevel", () => {
  it("steps down one level at a time and stops at the last step", () => {
    expect(declineLevel("high", 0)).toBe(1);
    expect(declineLevel("high", 1)).toBe(2);
    expect(declineLevel("high", 2)).toBe(2);
    expect(declineLevel("low", 0)).toBe(1);
    expect(declineLevel("low", 1)).toBe(1);
  });

  it("never goes back up", () => {
    let level = 0;
    for (let i = 0; i < 10; i++) {
      const next = declineLevel("high", level);
      expect(next).toBeGreaterThanOrEqual(level);
      level = next;
    }
  });
});
