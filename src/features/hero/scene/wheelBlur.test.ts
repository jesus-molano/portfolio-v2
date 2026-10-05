import { describe, expect, it } from "vitest";
import { drive } from "./drive";
import { WHEEL_RADIUS } from "./carModel";
import { BLUR_FULL, BLUR_START, blurAmount, radialAverage, rimUvCircle, wheelAngularSpeed } from "./wheelBlur";

describe("blurAmount", () => {
  it("keeps the spokes sharp on a still or slow wheel", () => {
    expect(blurAmount(0)).toBe(0);
    expect(blurAmount(BLUR_START)).toBe(0);
  });

  it("is fully blurred at cruising speed, either way round", () => {
    const cruising = drive.speed / WHEEL_RADIUS;
    expect(cruising).toBeGreaterThan(BLUR_FULL);
    expect(blurAmount(cruising)).toBe(1);
    expect(blurAmount(-cruising)).toBe(1);
  });

  it("never decreases as the wheel speeds up", () => {
    let previous = 0;
    for (let speed = 0; speed <= BLUR_FULL + 5; speed += 0.5) {
      const value = blurAmount(speed);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("rimUvCircle", () => {
  it("finds the disc's centre on the axle and its radius in UV units", () => {
    // A hub vertex on the axle (x) and four rim vertices 0.5 off it.
    const positions = [0.1, 0, 0, 0.1, 0.5, 0, 0.1, 0, 0.5, 0.1, -0.5, 0, 0.1, 0, -0.5];
    const uvs = [0.6, 0.7, 0.65, 0.7, 0.6, 0.75, 0.55, 0.7, 0.6, 0.65];
    const circle = rimUvCircle(positions, uvs);
    expect(circle?.u).toBeCloseTo(0.6);
    expect(circle?.v).toBeCloseTo(0.7);
    expect(circle?.radius).toBeCloseTo(0.05);
  });

  it("returns null for an empty geometry", () => {
    expect(rimUvCircle([], [])).toBeNull();
  });
});

describe("radialAverage", () => {
  /** A square image with one white spoke (a bright column) on black. */
  function spokeImage(size: number): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4;
        const bright = x === size / 2 && y < size / 2 ? 255 : 0;
        pixels.set([bright, bright, bright, 255], i);
      }
    }
    return pixels;
  }

  it("gives every pixel of a ring the same colour", () => {
    const size = 16;
    const out = radialAverage(spokeImage(size), size);
    // Four pixels on the same ring, rotated by quarter turns about the centre.
    const at = (x: number, y: number) => out[(y * size + x) * 4];
    expect(at(8, 3)).toBe(at(12, 8));
    expect(at(8, 3)).toBe(at(7, 12));
    expect(at(8, 3)).toBe(at(3, 7));
  });

  it("spreads a spoke into a faint ring instead of dropping it", () => {
    const size = 16;
    const out = radialAverage(spokeImage(size), size);
    const ring = out[(3 * size + 8) * 4];
    expect(ring).toBeGreaterThan(0);
    expect(ring).toBeLessThan(255);
  });

  it("keeps a uniform image unchanged and the alpha opaque", () => {
    const size = 8;
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([90, 140, 200, 255], i);
    const out = radialAverage(pixels, size);
    for (let i = 0; i < out.length; i += 4) {
      expect(Math.abs(out[i] - 90)).toBeLessThanOrEqual(1);
      expect(Math.abs(out[i + 1] - 140)).toBeLessThanOrEqual(1);
      expect(Math.abs(out[i + 2] - 200)).toBeLessThanOrEqual(1);
      expect(out[i + 3]).toBe(255);
    }
  });
});

describe("wheelAngularSpeed", () => {
  it("is the distance rolled over the time and the radius", () => {
    expect(wheelAngularSpeed(drive.speed / 60, 1 / 60, WHEEL_RADIUS)).toBeCloseTo(drive.speed / WHEEL_RADIUS, 10);
  });

  it("doubles when the visitor's push doubles the pace", () => {
    const cruise = wheelAngularSpeed(drive.speed / 60, 1 / 60, WHEEL_RADIUS);
    expect(wheelAngularSpeed((2 * drive.speed) / 60, 1 / 60, WHEEL_RADIUS)).toBeCloseTo(2 * cruise, 10);
  });

  it("is 0, never NaN, for an empty frame or a still car", () => {
    expect(wheelAngularSpeed(0.3, 0, WHEEL_RADIUS)).toBe(0);
    expect(wheelAngularSpeed(0.3, -1, WHEEL_RADIUS)).toBe(0);
    expect(wheelAngularSpeed(0, 1 / 60, WHEEL_RADIUS)).toBe(0);
  });
});
