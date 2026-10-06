import { describe, expect, it } from "vitest";
import { entryChoice, entryStation, parseCue, parseVolume, roundVolume } from "./radio";
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

describe("the start menu's radio", () => {
  it("plays the entry station, on, until she cues another in the settings", () => {
    expect(entryChoice(parseMemory(null, null), null)).toEqual({ station: "babylon", on: true });
    expect(entryChoice(parseMemory("crockett", "on"), null)).toEqual({ station: "crockett", on: true });
  });

  it("is never silenced by CONTINUE last time: that way in always saves off", () => {
    expect(entryChoice(parseMemory("mr-wolf", "off"), null)).toEqual({ station: "mr-wolf", on: true });
  });

  it("follows what she cued, a station or the radio off", () => {
    const memory = parseMemory("crockett", "on");
    expect(entryChoice(memory, { station: "love-daddy", on: true })).toEqual({ station: "love-daddy", on: true });
    expect(entryChoice(memory, { station: "love-daddy", on: false })).toEqual({ station: "love-daddy", on: false });
  });

  it("reads a stored cue back, and nothing from anything else", () => {
    expect(parseCue("on:babylon")).toEqual({ station: "babylon", on: true });
    expect(parseCue("off:crockett")).toEqual({ station: "crockett", on: false });
    for (const value of [null, "", "on", "maybe:babylon", "on:pirate-radio", "babylon"]) expect(parseCue(value), String(value)).toBeNull();
  });
});
