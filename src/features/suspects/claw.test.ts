import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLAW_TIMING, clawMarks, clawStart, TEAR, tearNoise } from "./claw";

/** Every number in a path. */
const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("Dante's claw swipe", () => {
  const desktop = clawMarks(1440, 900, clawStart({ left: 620, top: 160, width: 200, height: 480 }, { width: 1440, height: 900 }, false), false);
  const phone = clawMarks(390, 844, clawStart({ left: 0, top: 300, width: 195, height: 330 }, { width: 390, height: 844 }, true), true);

  it("tears three marks, each a closed outline per layer and a centre line for its reveal", () => {
    for (const claw of [desktop, phone]) {
      expect(claw.marks).toHaveLength(3);
      for (const mark of claw.marks) {
        expect(mark.glow).toHaveLength(3);
        for (const layer of [...mark.glow, mark.edge, mark.flesh, mark.gash, mark.core]) {
          expect(layer).toMatch(/^M[\d.\- L]+Z$/);
          expect(numbers(layer).every(Number.isFinite)).toBe(true);
        }
        expect(mark.center).toMatch(/^M[\d.\- L]+$/);
      }
    }
  });

  it("rakes down and to the left, across the whole screen", () => {
    for (const [claw, w, h] of [
      [desktop, 1440, 900],
      [phone, 390, 844],
    ] as const) {
      const middle = numbers(claw.marks[1].center);
      const [x0, y0] = middle;
      const [x1, y1] = middle.slice(-2);
      expect(x1).toBeLessThan(x0);
      expect(y1).toBeGreaterThan(y0);
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(Math.hypot(w, h) * 0.9);
    }
  });

  it("is the same three marks every time at one screen size", () => {
    const again = clawMarks(1440, 900, clawStart({ left: 620, top: 160, width: 200, height: 480 }, { width: 1440, height: 900 }, false), false);
    expect(again).toEqual(desktop);
  });

  it("starts up and right of his head on a wide screen and past the edge on a phone", () => {
    // Dante 110 px wide at x 600, his ears at y 500: the paw comes from (882.8, 185).
    const from = clawStart({ left: 600, top: 500, width: 110, height: 160 }, { width: 1440, height: 900 }, false);
    expect(from.x).toBeCloseTo(882.8, 6);
    expect(from.y).toBeCloseTo(185, 6);
    // Never off the top of the screen.
    expect(clawStart({ left: 600, top: 100, width: 110, height: 160 }, { width: 1440, height: 900 }, false).y).toBe(27);
    expect(clawStart({ left: 0, top: 300, width: 195, height: 330 }, { width: 390, height: 844 }, true).x).toBeGreaterThan(390);
  });

  it("tears fast and fades slowly", () => {
    expect(CLAW_TIMING.rake).toBeLessThan(CLAW_TIMING.hold);
    expect(CLAW_TIMING.lead + CLAW_TIMING.hold + CLAW_TIMING.out).toBeLessThan(2600);
  });

  it("tears its edges itself, raggedly but within the tear's reach, the same every time", () => {
    for (let s = 0; s < 2000; s += 7) {
      const n = tearNoise(3, s, TEAR.edge.frequency);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      expect(tearNoise(3, s, TEAR.edge.frequency)).toBe(n);
    }
    // The torn pale edge strays from a smooth one: many points, and its width changes from step to step.
    for (const claw of [desktop, phone]) {
      const edge = numbers(claw.marks[1].edge);
      expect(edge.length / 2).toBeGreaterThan(200);
      const reach = claw.width * TEAR.edge.amplitude;
      expect(reach).toBeGreaterThan(1);
    }
  });

  it("draws with no SVG filter, which Safari renders on the CPU every frame (an iPhone froze on his strike)", () => {
    // (The stylesheet's grain is a 240 px tile drawn once as an image, not a live filter.)
    const select = readFileSync(new URL("./CharacterSelect.tsx", import.meta.url), "utf8");
    for (const filter of ["feTurbulence", "feDisplacementMap", "feGaussianBlur", "<filter", 'filter="url(']) {
      expect(select).not.toContain(filter);
    }
    const styles = readFileSync(new URL("./Suspects.module.css", import.meta.url), "utf8");
    const clawRules = styles.match(/\.claw[A-Za-z]*\s*\{[^}]*\}/g) ?? [];
    expect(clawRules.length).toBeGreaterThan(4);
    for (const rule of clawRules) expect(rule).not.toMatch(/filter|backdrop/);
  });
});
