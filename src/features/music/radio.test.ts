import { describe, expect, it } from "vitest";
import { entryChoice, entryStation, parseCue, parseVolume, roundVolume } from "./radio";
import { DEFAULT_STATION_ID, parseMemory } from "./stations";

describe("entryStation", () => {
  it("is MANERO the first time", () => {
    expect(DEFAULT_STATION_ID).toBe("manero");
    expect(entryStation(parseMemory(null, null))).toBe("manero");
  });

  it("is the station she last tuned to", () => {
    expect(entryStation(parseMemory("raheem", "on"))).toBe("raheem");
  });

  it("is still that station after she entered without music last time", () => {
    expect(entryStation(parseMemory("one-louder", "off"))).toBe("one-louder");
  });

  it("falls back to MANERO when the remembered station is gone or unreadable", () => {
    expect(entryStation(parseMemory("pirate-radio", "on"))).toBe("manero");
    expect(entryStation({ station: null, on: false })).toBe("manero");
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
    expect(entryChoice(parseMemory(null, null), null)).toEqual({ station: "manero", on: true });
    expect(entryChoice(parseMemory("tofu", "on"), null)).toEqual({ station: "tofu", on: true });
  });

  it("is never silenced by CONTINUE last time: that way in always saves off", () => {
    expect(entryChoice(parseMemory("one-louder", "off"), null)).toEqual({ station: "one-louder", on: true });
  });

  it("follows what she cued, a station or the radio off", () => {
    const memory = parseMemory("tofu", "on");
    expect(entryChoice(memory, { station: "raheem", on: true })).toEqual({ station: "raheem", on: true });
    expect(entryChoice(memory, { station: "raheem", on: false })).toEqual({ station: "raheem", on: false });
  });

  it("reads a stored cue back, and nothing from anything else", () => {
    expect(parseCue("on:manero")).toEqual({ station: "manero", on: true });
    expect(parseCue("off:tofu")).toEqual({ station: "tofu", on: false });
    for (const value of [null, "", "on", "maybe:babylon", "on:pirate-radio", "manero"]) expect(parseCue(value), String(value)).toBeNull();
  });
});
