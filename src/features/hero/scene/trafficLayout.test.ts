import { describe, expect, it } from "vitest";
import { CAR_POSITION, STREAM_LENGTH } from "./drive";
import { makeTraffic } from "./trafficLayout";

/** Longest model in the Quaternius pack is about 4.6 m. */
const CAR_LENGTH = 4.6;

describe("makeTraffic", () => {
  const cars = makeTraffic(3, 5);

  it("is deterministic", () => {
    expect(makeTraffic(3, 5)).toEqual(cars);
  });

  it("never lets same-direction traffic drive faster than the hero car", () => {
    // A positive relative speed drifts toward the camera: the hero overtakes.
    for (const car of cars.filter((c) => !c.oncoming)) {
      expect(car.relative).toBeGreaterThan(0);
    }
  });

  it("gives every car in a lane the same speed", () => {
    const byLane = new Map<number, Set<number>>();
    for (const car of cars) {
      byLane.set(car.x, (byLane.get(car.x) ?? new Set()).add(car.relative));
    }
    for (const speeds of byLane.values()) expect(speeds.size).toBe(1);
  });

  it("keeps cars in a lane apart, including across the wrap", () => {
    const lanes = new Map<number, number[]>();
    for (const car of cars) lanes.set(car.x, [...(lanes.get(car.x) ?? []), car.z0]);
    for (const zs of lanes.values()) {
      const sorted = [...zs].sort((a, b) => a - b);
      const gaps = sorted.map((z, i) =>
        i === 0 ? sorted[0] + STREAM_LENGTH - sorted[sorted.length - 1] : z - sorted[i - 1],
      );
      for (const gap of gaps) expect(gap).toBeGreaterThan(CAR_LENGTH * 3);
    }
  });

  it("keeps traffic out of the hero car's lane", () => {
    for (const car of cars) {
      expect(Math.abs(car.x - CAR_POSITION.x)).toBeGreaterThanOrEqual(3);
    }
  });

  it("only uses existing models", () => {
    for (const car of cars) {
      expect(car.model).toBeGreaterThanOrEqual(0);
      expect(car.model).toBeLessThan(5);
    }
  });
});
