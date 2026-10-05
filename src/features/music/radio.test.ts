import { describe, expect, it } from "vitest";
import { entryStation } from "./radio";
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
