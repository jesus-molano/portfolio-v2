import { describe, expect, it } from "vitest";
import { fitWidth, widestLine } from "./cardFit";

const rect = (left: number, right: number, top: number, bottom: number) => ({ left, right, top, bottom });

describe("widestLine", () => {
  it("measures one line from its leftmost to its rightmost fragment", () => {
    // "Jesús:" in bold, then the line, on one line.
    expect(widestLine([rect(100, 160, 10, 32), rect(164, 420, 11, 31)])).toBe(320);
  });

  it("takes the widest of a balanced block's lines", () => {
    const rects = [rect(120, 180, 10, 32), rect(184, 400, 10, 32), rect(130, 390, 38, 60)];
    expect(widestLine(rects)).toBe(280);
  });

  it("ignores empty fragments and is 0 for no text", () => {
    expect(widestLine([rect(50, 50, 10, 32)])).toBe(0);
    expect(widestLine([])).toBe(0);
    expect(widestLine([rect(10, 110, 0, 20), rect(300, 300, 40, 60)])).toBe(100);
  });

  it("keeps lines apart however close a line-height packs them", () => {
    expect(widestLine([rect(0, 100, 0, 20), rect(0, 150, 21, 41)])).toBe(150);
  });
});

describe("fitWidth", () => {
  it("rounds up and adds a pixel, so the widest line never wraps again", () => {
    expect(fitWidth([rect(0, 280.2, 0, 20)])).toBe(282);
    expect(fitWidth([rect(0, 280, 0, 20)])).toBe(281);
  });

  it("is 0 (leave the box alone) when nothing was measured", () => {
    expect(fitWidth([])).toBe(0);
  });
});
