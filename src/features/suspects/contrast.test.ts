import { describe, expect, it } from "vitest";
import { lineup, palette } from "@/design/tokens";
import { contrast, hexToRgb, luminance, over } from "./contrast";

const rgb = hexToRgb;

describe("contrast helpers", () => {
  it("reads #rrggbb and refuses anything else", () => {
    expect(rgb("#ff8000")).toEqual([255, 128, 0]);
    expect(() => rgb("rgba(0,0,0,1)")).toThrow();
    expect(() => rgb("#fff")).toThrow();
  });

  it("matches the WCAG endpoints", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1);
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrast([12, 34, 56], [12, 34, 56])).toBe(1);
  });

  it("lays a translucent colour over a background", () => {
    expect(over([255, 255, 255], 0.5, [0, 0, 0])).toEqual([127.5, 127.5, 127.5]);
    expect(over([10, 20, 30], 1.4, [0, 0, 0])).toEqual([10, 20, 30]);
  });
});

describe("line-up colours", () => {
  const cream = rgb(palette.cream);

  it("cream on night, and on the floor and the plates, is at least 12:1", () => {
    expect(contrast(cream, rgb(palette.night))).toBeGreaterThanOrEqual(12);
    expect(contrast(cream, rgb(lineup.plate))).toBeGreaterThanOrEqual(12);
    // The descriptions: cream at 86% on the floor.
    expect(contrast(over(cream, 0.86, rgb(lineup.floor)), rgb(lineup.floor))).toBeGreaterThanOrEqual(12);
  });

  it("ink on the complaint is at least 11:1 across the paper, the ticks at least 7:1", () => {
    for (const paper of [lineup.paper, lineup.paperShade]) {
      expect(contrast(rgb(palette.ink), rgb(paper)), paper).toBeGreaterThanOrEqual(11);
      expect(contrast(rgb(lineup.stamp), rgb(paper)), paper).toBeGreaterThanOrEqual(7);
    }
  });

  it("the plates' pink aliases read at least 7:1", () => {
    expect(contrast(rgb(palette.pink), rgb(lineup.plate))).toBeGreaterThanOrEqual(7);
  });

  it("the GUILTY stamp reads at least 4.5:1 on the plate, and is not the on-air red", () => {
    expect(contrast(rgb(lineup.verdict), rgb(lineup.plate))).toBeGreaterThanOrEqual(4.5);
    expect(lineup.verdict.toLowerCase()).not.toBe(palette.onAir.toLowerCase());
  });
});
