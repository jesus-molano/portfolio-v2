import { describe, expect, it } from "vitest";
import { entryStation, parseVolume, roundVolume } from "./radio";
import { DEFAULT_STATION_ID, parseMemory } from "./stations";

describe("entryStation", () => {
  it("is BABYLON the first time", () => {
    expect(DEFAULT_STATION_ID).toBe("babylon");
    expect(entryStation(parseMemory(null, null))).toBe("babylon");
  });

  it("is the station she last tuned to", () => {
    expect(entryStation(parseMemory("crockett", "on"))).toBe("crockett");
  });

  it("is still that station after she entered without music last time", () => {
    expect(entryStation(parseMemory("mr-wolf", "off"))).toBe("mr-wolf");
  });

  it("falls back to BABYLON when the remembered station is gone or unreadable", () => {
    expect(entryStation(parseMemory("pirate-radio", "on"))).toBe("babylon");
    expect(entryStation({ station: null, on: false })).toBe("babylon");
  });
});

describe("her volume", () => {
  it("reads back what was stored, and full volume for anything else", () => {
    expect(parseVolume("0.35")).toBe(0.35);
    expect(parseVolume("0")).toBe(0);
    for (const value of [null, "", "  ", "loud", "1.5", "-0.2", "NaN"]) expect(parseVolume(value), String(value)).toBe(1);
  });

  it("moves in steps of 5 %, within 0 and 1", () => {
    expect(roundVolume(0.333)).toBe(0.35);
    expect(roundVolume(1.4)).toBe(1);
    expect(roundVolume(-1)).toBe(0);
  });
});
