import { describe, expect, it } from "vitest";
import { buildWaterfront, MAX_SETBACK, towersClearHotels, WATERFRONT } from "./waterfrontLayout";

describe("buildWaterfront", () => {
  const layout = buildWaterfront();
  const sides = [-1, 1].map((side) =>
    layout.hotels.filter((h) => Math.sign(h.x) === side).sort((a, b) => Math.abs(a.x) - Math.abs(b.x)),
  );

  it("is deterministic", () => {
    expect(buildWaterfront()).toEqual(layout);
  });

  it("fills both sides with a row of hotels", () => {
    for (const row of sides) expect(row.length).toBeGreaterThan(6);
  });

  it("mixes styles: never the same style twice in a row, at least three per side", () => {
    for (const row of sides) {
      for (let i = 1; i < row.length; i++) expect(row[i].style).not.toBe(row[i - 1].style);
      expect(new Set(row.map((h) => h.style)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it("frames the avenue with a tower on each side", () => {
    for (const row of sides) expect(row[0].style).toBe("tower");
  });

  it("never paints two neighbours the same colour", () => {
    for (const row of sides) {
      for (let i = 1; i < row.length; i++) expect(row[i].color).not.toBe(row[i - 1].color);
    }
  });

  it("keeps the avenue mouth free for the road", () => {
    for (const hotel of layout.hotels) {
      expect(Math.abs(hotel.x) - hotel.w / 2).toBeGreaterThanOrEqual(WATERFRONT.avenueHalf - 1e-9);
    }
    for (const palm of layout.palms) expect(Math.abs(palm.x)).toBeGreaterThan(12);
  });

  it("never overlaps two hotels", () => {
    for (const row of sides) {
      for (let i = 1; i < row.length; i++) {
        const gap = Math.abs(row[i].x) - row[i].w / 2 - (Math.abs(row[i - 1].x) + row[i - 1].w / 2);
        expect(gap).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("keeps every hotel front on the promenade line or set back a little", () => {
    for (const hotel of layout.hotels) {
      const front = hotel.z + hotel.d / 2;
      expect(front).toBeLessThanOrEqual(WATERFRONT.hotelFront + 1e-9);
      expect(front).toBeGreaterThanOrEqual(WATERFRONT.hotelFront - MAX_SETBACK - 1e-9);
    }
  });

  it("keeps every window on its facade, below the roof and above the shopfront", () => {
    expect(layout.windows.length).toBeGreaterThan(50);
    for (const pane of layout.windows) {
      const hotel = layout.hotels[pane.hotel];
      expect(pane.y + pane.h / 2).toBeLessThanOrEqual(hotel.y + hotel.h - 0.2);
      expect(pane.y - pane.h / 2).toBeGreaterThanOrEqual(hotel.y + WATERFRONT.floorHeight);
      expect(Math.abs(pane.x - hotel.x) + pane.w / 2).toBeLessThanOrEqual(hotel.w / 2 + 1e-9);
      expect(pane.z).toBeCloseTo(hotel.z + hotel.d / 2 + 0.04, 9);
    }
  });

  it("starts the towers behind the hotel row", () => {
    expect(towersClearHotels(layout.hotels)).toBe(true);
  });

  it("stands everything on the city ground", () => {
    for (const box of [...layout.solids, ...layout.glows, ...layout.cylinders]) {
      expect(box.y).toBeGreaterThanOrEqual(WATERFRONT.groundY - 1e-9);
    }
  });

  it("puts the palms on the promenade", () => {
    for (const palm of layout.palms) {
      expect(palm.z).toBeLessThanOrEqual(WATERFRONT.promenadeFrom);
      expect(palm.z).toBeGreaterThanOrEqual(WATERFRONT.promenadeTo);
    }
  });
});
