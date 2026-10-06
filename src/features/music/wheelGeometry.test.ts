import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { visibleStations } from "./stations";
import {
  CENTRE_BUDGET,
  CENTRE_TYPE,
  centreType,
  DISC,
  polarPoint,
  ringSectorPath,
  sectorArcPath,
  sectorSizes,
  SMALL_WHEEL,
  unwrapAngle,
  WHEEL_LAYOUT,
  wheelSize,
} from "./wheelGeometry";

describe("polarPoint", () => {
  it("measures clockwise from 12 o'clock with y down", () => {
    expect(polarPoint(0, 10)).toEqual({ x: 0, y: -10 });
    expect(polarPoint(90, 10)).toEqual({ x: 10, y: 0 });
    expect(polarPoint(180, 10)).toEqual({ x: 0, y: 10 });
    expect(polarPoint(270, 10)).toEqual({ x: -10, y: 0 });
  });
});

describe("ringSectorPath", () => {
  it("draws a closed wedge between both radii", () => {
    const path = ringSectorPath(0, 4, 50, 100, 0, 0);
    // From -45° to 45° on the outer edge, back along the inner edge.
    expect(path).toBe("M-70.71 -70.71 A100 100 0 0 1 70.71 -70.71 L35.36 -35.36 A50 50 0 0 0 -35.36 -35.36 Z");
  });

  it("leaves the gap between neighbours and turns with the index", () => {
    const path = ringSectorPath(2, 4, 50, 100, 10, 0);
    const start = polarPoint(135 + 5, 100);
    expect(path.startsWith(`M${start.x} ${start.y}`)).toBe(true);
  });
});

describe("sectorArcPath", () => {
  it("follows the wedge's outer edge, clockwise", () => {
    expect(sectorArcPath(0, 4, 100, 0, 0)).toBe("M-70.71 -70.71 A100 100 0 0 1 70.71 -70.71");
    // Same ends as the wedge's outer edge, gap included.
    const wedge = ringSectorPath(3, 7, 50, 99, 1.6, 180);
    expect(wedge.startsWith(sectorArcPath(3, 7, 99, 1.6, 180))).toBe(true);
  });

  it("takes the long way only for a sector wider than half the wheel", () => {
    expect(sectorArcPath(0, 1, 10, 10, 0)).toContain(" 0 1 1 ");
    expect(sectorArcPath(0, 2, 10, 10, 0)).toContain(" 0 0 1 ");
  });
});

describe("unwrapAngle", () => {
  it("takes the short way across 0°", () => {
    expect(unwrapAngle(350, 10)).toBe(370);
    expect(unwrapAngle(10, 350)).toBe(-10);
    expect(unwrapAngle(720 + 90, 100)).toBe(820);
  });

  it("keeps the angle when it does not change", () => {
    expect(unwrapAngle(-30, 330)).toBe(-30);
  });
});

describe("sectorSizes", () => {
  it("keeps every sector a 44 px touch target on a 360 px phone, with 4 or 6 stations", () => {
    const size = wheelSize(360, 640);
    expect(size).toBe(336);
    // Radio off plus the stations on air.
    for (const count of [5, 7]) {
      const sector = sectorSizes(size, count);
      expect(sector.badge).toBeGreaterThanOrEqual(44);
      expect(sector.arc).toBeGreaterThanOrEqual(44);
      expect(sector.clearance).toBeGreaterThan(0);
    }
  });

  it("keeps every sector a 44 px target on a phone on its side", () => {
    for (const [width, height] of [
      [568, 320],
      [640, 360],
      [844, 390],
    ]) {
      for (const count of [5, 7]) {
        const sector = sectorSizes(wheelSize(width, height), count);
        expect(sector.badge).toBeGreaterThanOrEqual(44);
        expect(sector.arc).toBeGreaterThanOrEqual(44);
        expect(sector.clearance).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the badges inside the ring", () => {
    const { inner, outer, orbit, badge } = WHEEL_LAYOUT;
    expect(orbit - badge / 2).toBeGreaterThan(inner);
    expect(orbit + badge / 2).toBeLessThan(outer);
  });
});

describe("wheelSize", () => {
  it("caps the wheel at 600 px and leaves room for the margins and the hint", () => {
    expect(wheelSize(1440, 900)).toBe(600);
    expect(wheelSize(390, 844)).toBe(366);
    expect(wheelSize(1024, 600)).toBe(456);
  });

  it("gives a phone on its side the screen's height, the hint beside the wheel", () => {
    expect(wheelSize(640, 360)).toBe(328);
    expect(wheelSize(844, 390)).toBe(358);
    // A short desktop window takes the same layout; a tall one does not.
    expect(wheelSize(1280, 480)).toBe(448);
    expect(wheelSize(1280, 501)).toBe(357);
  });
});

/** Phone wheels, upright and on their side, from a 320 px phone up. */
const PHONES = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [412, 915],
  [568, 320],
  [640, 360],
  [844, 390],
].map(([width, height]) => wheelSize(width, height));

describe("the centre on a phone's wheel", () => {
  it("takes CENTRE_TYPE on every phone, upright or on its side", () => {
    for (const size of PHONES) expect(size).toBeLessThanOrEqual(SMALL_WHEEL);
    // A tablet keeps the big wheel's type.
    expect(wheelSize(768, 1024)).toBeGreaterThan(SMALL_WHEEL);
  });

  it("never sets the name under 11 px, and keeps it the biggest line", () => {
    for (const size of PHONES) {
      const type = centreType(size);
      expect(type.name).toBeGreaterThanOrEqual(11);
      for (const row of ["frequency", "tagline", "track", "status"] as const) {
        expect(type.name).toBeGreaterThan(type[row]);
      }
    }
    // On a 360 px phone, the size measured in the browser.
    expect(centreType(336).name).toBeCloseTo(13.44, 2);
  });

  it("reads the disc as the circle the wheel draws", () => {
    expect(DISC).toBeCloseTo(0.235, 6);
    expect(DISC).toBeLessThan(WHEEL_LAYOUT.inner);
  });

  it("holds no text longer than it was measured with", () => {
    const stations = visibleStations();
    for (const station of stations) {
      expect(station.name.length, station.name).toBeLessThanOrEqual(CENTRE_BUDGET.name);
      for (const { credit } of station.tracks) {
        expect(credit.title.length, credit.title).toBeLessThanOrEqual(CENTRE_BUDGET.trackTitle);
        expect(credit.artist.length, credit.artist).toBeLessThanOrEqual(CENTRE_BUDGET.trackArtist);
      }
    }
    for (const dict of [en, es]) {
      expect(dict.radio.off.length).toBeLessThanOrEqual(CENTRE_BUDGET.off);
      for (const station of stations) {
        const tagline = (dict.radio.taglines as Record<string, string>)[station.id];
        expect(tagline.length, tagline).toBeLessThanOrEqual(CENTRE_BUDGET.tagline);
      }
    }
  });

  it("names a fraction for every row of the centre", () => {
    expect(Object.keys(CENTRE_TYPE).sort()).toEqual(["frequency", "name", "status", "tagline", "track"]);
  });
});
