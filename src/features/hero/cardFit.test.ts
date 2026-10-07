import { describe, expect, it } from "vitest";
import { FIT_PASSES, fitWidth, settleFits, widestLine } from "./cardFit";

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

describe("settleFits", () => {
  /** A card laid out as `lines` (px wide each), one line under the other. */
  const laid = (lines: number[]) => lines.map((width, i) => rect(0, width, i * 22, i * 22 + 21));

  /**
   * Chrome's balance of the career city's "Zod doesn't take bribes, so no
   * field got through unchecked." at 1180 px: free in its 504 px band it
   * breaks 245 / 276; in the 277 px box that gives it, it breaks 266 / 254,
   * and from there it stays.
   */
  const zod = (box: number | null) => laid(box === null ? [245, 276] : [266, 254]);

  function run(models: ((box: number | null) => ReturnType<typeof laid> | null)[], passes?: number) {
    const boxes: (number | null)[] = models.map(() => null);
    const applied: [number, number][] = [];
    const widths = settleFits(
      models.length,
      (i) => models[i](boxes[i]),
      (i, width) => {
        boxes[i] = width;
        applied.push([i, width]);
      },
      passes,
    );
    return { widths, applied };
  }

  it("measures a balanced card again in its fitted box, and narrows it till its balance settles", () => {
    const { widths, applied } = run([zod]);
    // One pass would leave 277 px around a 266 px line: 11 px of empty card.
    expect(applied).toEqual([
      [0, 277],
      [0, 267],
    ]);
    expect(widths).toEqual([267]);
  });

  it("sets a card whose balance holds in its box once", () => {
    const steady = () => laid([180, 236]);
    expect(run([steady, zod]).applied).toEqual([
      [0, 237],
      [1, 277],
      [1, 267],
    ]);
  });

  it("never widens a box, and leaves missing and empty cards alone", () => {
    const widerInBox = (box: number | null) => laid(box === null ? [200] : [box + 5]);
    expect(run([() => null, () => [], widerInBox]).widths).toEqual([0, 0, 201]);
  });

  it("stops after its passes, whatever the layout does", () => {
    const shrinking = (box: number | null) => laid([(box ?? 400) - 20]);
    const { applied } = run([shrinking]);
    expect(applied).toHaveLength(FIT_PASSES);
    expect(run([shrinking], 1).applied).toEqual([[0, 381]]);
  });
});
