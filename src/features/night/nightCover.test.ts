import { describe, expect, it } from "vitest";
import { nightCovered } from "./nightCover";

const base = { ready: true, sceneIn: 1, endT: 0, dip: 0, warm: true };

describe("nightCovered", () => {
  it("draws while the picture shows", () => {
    expect(nightCovered(base)).toBe(false);
    expect(nightCovered({ ...base, endT: 0.99 })).toBe(false);
    expect(nightCovered({ ...base, sceneIn: 0.01, warm: true })).toBe(false);
  });

  it("rests under the closed iris", () => {
    expect(nightCovered({ ...base, endT: 1 })).toBe(true);
  });

  it("rests under the opening cover only once every stop is warm", () => {
    expect(nightCovered({ ...base, sceneIn: 0, warm: true })).toBe(true);
    expect(nightCovered({ ...base, sceneIn: 0, warm: false })).toBe(false);
  });

  it("never rests before the scene is ready or during a dip", () => {
    expect(nightCovered({ ...base, ready: false, endT: 1 })).toBe(false);
    expect(nightCovered({ ...base, ready: false, sceneIn: 0 })).toBe(false);
    expect(nightCovered({ ...base, dip: 0.5, endT: 1 })).toBe(false);
    expect(nightCovered({ ...base, dip: 1, sceneIn: 0 })).toBe(false);
  });
});
