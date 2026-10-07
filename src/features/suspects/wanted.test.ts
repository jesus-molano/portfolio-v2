import { describe, expect, it } from "vitest";
import { parseSeen, parseTries, raised, WANTED_MAX, wantedLevel } from "./wanted";

describe("Dante's wanted level", () => {
  it("is one star until she has tried to choose him, one more a try, five at most", () => {
    expect([0, 1, 2, 3, 4, 5, 40].map(wantedLevel)).toEqual([1, 2, 3, 4, 5, 5, 5]);
    expect(WANTED_MAX).toBe(5);
  });

  it("reads anything odd as no tries", () => {
    expect(wantedLevel(Number.NaN)).toBe(1);
    expect(wantedLevel(-3)).toBe(1);
    expect(wantedLevel(2.9)).toBe(3);
  });

  it("keeps a stored count only when it is a whole number", () => {
    expect(parseTries("3")).toBe(3);
    expect(parseTries(" 2 ")).toBe(2);
    for (const raw of [null, undefined, "", "-1", "1.5", "lots", "9999999"]) expect(parseTries(raw), String(raw)).toBe(0);
  });

  it("flashes the stars only for a level raised since STATS last showed it", () => {
    expect(raised(3, 2)).toBe(true);
    expect(raised(3, 3)).toBe(false);
    // The select comes before STATS: tried before STATS ever showed a level, it flashes.
    expect(raised(3, null)).toBe(true);
    expect(raised(1, null)).toBe(false);
    expect(parseSeen("4")).toBe(4);
    for (const raw of [null, "0", "6", "x"]) expect(parseSeen(raw), String(raw)).toBeNull();
  });
});
