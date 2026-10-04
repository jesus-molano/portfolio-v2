import { describe, expect, it } from "vitest";
import { STREAM, STREAM_LENGTH, streamFade, wrapZ } from "./drive";

describe("wrapZ", () => {
  it("keeps a value inside the stream window unchanged", () => {
    expect(wrapZ(0)).toBeCloseTo(0);
    expect(wrapZ(STREAM.zFront)).toBeCloseTo(STREAM.zFront);
    expect(wrapZ(STREAM.zBack - 1)).toBeCloseTo(STREAM.zBack - 1);
  });

  it("wraps values behind the camera back to the far edge", () => {
    expect(wrapZ(STREAM.zBack + 5)).toBeCloseTo(STREAM.zFront + 5);
    expect(wrapZ(10 + STREAM_LENGTH * 3)).toBeCloseTo(10);
  });

  it("wraps values beyond the far edge forward", () => {
    expect(wrapZ(STREAM.zFront - 5)).toBeCloseTo(STREAM.zBack - 5);
  });

  it("stays in the window after hours of driving", () => {
    // 18 m/s for 10 hours.
    const z = wrapZ(-40 + 18 * 3600 * 10);
    expect(z).toBeGreaterThanOrEqual(STREAM.zFront);
    expect(z).toBeLessThan(STREAM.zBack);
  });
});

describe("streamFade", () => {
  it("is 0 at the far edge and 1 well inside the window", () => {
    expect(streamFade(STREAM.zFront)).toBe(0);
    expect(streamFade(0)).toBe(1);
  });

  it("never decreases as a prop comes closer", () => {
    let previous = 0;
    for (let z = STREAM.zFront; z <= STREAM.zFront + 60; z += 1) {
      const value = streamFade(z);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});
