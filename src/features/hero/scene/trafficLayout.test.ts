import { describe, expect, it } from "vitest";
import { CAR_POSITION, STREAM, STREAM_LENGTH, streamFade, wrapZ } from "./drive";
import { HERO_CLEARANCE, makeTraffic, PAINTS, restingY } from "./trafficLayout";
import { world } from "./world";

/** Longest model in the Quaternius pack is about 4.6 m. */
const CAR_LENGTH = 4.6;

/** Position of a car after `seconds` of driving, as Traffic.tsx places it. */
const zAt = (car: { z0: number; relative: number }, seconds: number) => wrapZ(car.z0 + seconds * car.relative);

describe("makeTraffic", () => {
  const cars = makeTraffic(3, 5);

  it("is deterministic", () => {
    expect(makeTraffic(3, 5)).toEqual(cars);
  });

  it("never lets same-direction traffic drive faster than the hero car", () => {
    // A positive relative speed drifts toward the camera: the hero overtakes.
    for (const car of cars.filter((c) => !c.oncoming)) {
      expect(car.relative).toBeGreaterThanOrEqual(0);
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

  it("never brings a same-direction car alongside the hero, however long the drive", () => {
    for (const car of cars.filter((c) => !c.oncoming)) {
      for (let seconds = 0; seconds <= 600; seconds += 0.5) {
        expect(Math.abs(zAt(car, seconds) - CAR_POSITION.z)).toBeGreaterThanOrEqual(HERO_CLEARANCE);
      }
    }
  });

  it("parks no same-direction car in the haze, where it would stay shrunk", () => {
    for (const car of cars.filter((c) => !c.oncoming)) {
      expect(streamFade(zAt(car, 0))).toBe(1);
      expect(car.z0).toBeLessThan(STREAM.zBack);
    }
  });

  it("puts a car ahead of the hero on every tier", () => {
    for (const perLane of [2, 3]) {
      const ahead = makeTraffic(perLane, 5).filter((c) => !c.oncoming && c.z0 < CAR_POSITION.z);
      expect(ahead.length).toBeGreaterThan(0);
    }
  });

  it("only uses existing models and paints", () => {
    for (const car of cars) {
      expect(car.model).toBeGreaterThanOrEqual(0);
      expect(car.model).toBeLessThan(5);
      expect(PAINTS).toContain(car.paint);
    }
  });
});

describe("restingY", () => {
  it("puts a model's lowest point on the road surface", () => {
    for (const minY of [-0.018, -0.01, 0, 0.006]) {
      expect(restingY(minY) + minY).toBeCloseTo(world.road.y);
    }
  });
});
