import { describe, expect, it } from "vitest";
import { createRandom } from "@/features/hero/scene/world";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { FACE, JIGSAW, jigsawEdge, PHOTO, PIECE, PIECE_BOX, pieceSides } from "./cloud";
import { raggedLine } from "./print";

const PX_PER_M = FACE.w / 18;

describe("the jigsaw cut on Pangea's face", () => {
  it("draws a straight edge as a straight edge", () => {
    const points: [number, number][] = [[0, 0]];
    jigsawEdge(0, 0, 170, 0, 0, points);
    expect(points).toEqual([
      [0, 0],
      [170, 0],
    ]);
  });

  it("bulges a knob exactly as far as the 3D piece's knob reaches, and ends on the corner", () => {
    const size = PIECE.size * PX_PER_M;
    for (const side of [1, -1]) {
      const points: [number, number][] = [[0, 0]];
      jigsawEdge(0, 0, size, 0, side, points);
      const reach = Math.max(...points.map(([, y]) => y * side));
      expect(reach).toBeCloseTo((PIECE.knob.offset + PIECE.knob.radius) * PX_PER_M, 0);
      expect(points[points.length - 1]).toEqual([size, 0]);
      // The knob stays in the middle third of the edge.
      for (const [x, y] of points) if (Math.abs(y) > 0.5) expect(Math.abs(x - size / 2)).toBeLessThanOrEqual(PIECE.knob.radius * PX_PER_M + 0.5);
    }
  });

  it("crops the 3D piece's picture to exactly the square and its knob, as its UVs span them", () => {
    const size = PIECE.size * PX_PER_M;
    const points: [number, number][] = [[0, 0]];
    jigsawEdge(0, 0, 0, size, -1, points);
    const reach = Math.max(...points.map(([x]) => x));
    expect(PIECE_BOX.x).toBeCloseTo(PIECE.slot.x - size / 2, 6);
    expect(PIECE_BOX.y).toBeCloseTo(PIECE.slot.y - size / 2, 6);
    expect(PIECE_BOX.h).toBeCloseTo(size, 6);
    expect(PIECE_BOX.w).toBeCloseTo(size + reach, 0);
    expect(PIECE_BOX.x + PIECE_BOX.w).toBeLessThan(FACE.w);
  });

  it("cuts the photo into whole pieces: no sliver on the card's border, every border edge straight", () => {
    const size = PIECE.size * PX_PER_M;
    expect(PHOTO.w / size).toBeCloseTo(JIGSAW.cols[1] - JIGSAW.cols[0] + 1, 6);
    expect(PHOTO.h / size).toBeCloseTo(JIGSAW.rows[1] - JIGSAW.rows[0] + 1, 6);
    expect((PIECE.slot.x - size / 2 - PHOTO.x) / size).toBeCloseTo(-JIGSAW.cols[0], 6);
    expect((PIECE.slot.y - size / 2 - PHOTO.y) / size).toBeCloseTo(-JIGSAW.rows[0], 6);
    // On the face, under the page's header, the missing piece and its knob inside the photo.
    expect(PHOTO.y).toBeGreaterThan(120);
    expect(PHOTO.y + PHOTO.h).toBeLessThan(FACE.h);
    expect(PIECE_BOX.x + PIECE_BOX.w).toBeLessThan(PHOTO.x + PHOTO.w);
    const [i0, i1] = JIGSAW.cols;
    const [j0, j1] = JIGSAW.rows;
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const [top, right, bottom, left] = pieceSides(i, j);
        if (j === j0) expect(top).toBe(0);
        if (j === j1) expect(bottom).toBe(0);
        if (i === i0) expect(left).toBe(0);
        if (i === i1) expect(right).toBe(0);
        // Inside, an edge is one cut: what bulges out of one piece bulges into its neighbour.
        if (i < i1) expect(pieceSides(i + 1, j)[3]).toBe(0 - right);
        if (j < j1) expect(pieceSides(i, j + 1)[0]).toBe(0 - bottom);
      }
    }
  });

  it("gives the missing piece one knob, on its right, as the 3D piece has", () => {
    expect(pieceSides(0, 0)).toEqual([0, 1, 0, 0]);
  });

  it("puts the missing piece where the 3D piece lands, inside the face", () => {
    expect(PIECE.slot.x / PX_PER_M - 9).toBeCloseTo(0.4, 1);
    expect(PIECE.slot.y).toBeCloseTo(FACE.h / 2, -1);
  });
});

describe("raggedLine", () => {
  it("starts and ends exactly on its ends, wandering in between", () => {
    const points = raggedLine(10, 20, 410, 60, createRandom(7), 20, 8);
    expect(points[0]).toEqual([10, 20]);
    expect(points[points.length - 1]).toEqual([410, 60]);
    expect(points.length).toBeGreaterThan(40);
    expect(points.some(([x, y]) => Math.abs(y - (20 + ((x - 10) / 400) * 40)) > 1)).toBe(true);
  });

  it("is deterministic for a seed", () => {
    expect(raggedLine(0, 0, 100, 0, createRandom(3))).toEqual(raggedLine(0, 0, 100, 0, createRandom(3)));
  });
});

describe("the boards' copy at Logixs and Cloud District", () => {
  for (const [locale, dict] of [
    ["en", en],
    ["es", es],
  ] as const) {
    it(`keeps the Logixs wall to Logixs (${locale}): no other stop's client or slogan on its paper`, () => {
      const text = JSON.stringify(dict.work.stops.logixs.board);
      expect(text).not.toMatch(/pangea|naturgy|telpark|abrir camino|open the road|bono cultural/i);
      expect(text).toMatch(/Bytetravel/i);
      expect(text).toMatch(/Retech/i);
      expect(dict.work.stops.logixs.board.snipe).toContain("FULL STACK DEVELOPER");
      expect(dict.work.stops.logixs.board.snipe).toContain("2025–2026");
    });

    it(`shows each client's own product on its face (${locale})`, () => {
      const stop = dict.work.stops["cloud-district"];
      const [naturgy, pangea, telpark] = stop.board.faces;
      expect([naturgy.title, pangea.title, telpark.title]).toEqual(["NATURGY", "PANGEA", "TELPARK"]);
      const products = naturgy.products ?? [];
      // Naturgy: the two things he built, each named and said in a few words.
      expect(products.map((p) => p.name)).toEqual(["OMEGA", "MONITOR"]);
      for (const p of products) {
        expect(p.kind.length).toBeGreaterThan(0);
        expect(Array.from(p.what).length).toBeLessThanOrEqual(32);
      }
      expect(products[1].what).toMatch(/log/i);
      expect(naturgy.lines).toContain("NEXT · REACT");
      // Pangea: our tagline, never theirs, and our button.
      expect(JSON.stringify(pangea)).not.toMatch(/viaja como eres|travel as you are|presupuesto/i);
      expect(pangea.cta?.length).toBeGreaterThan(0);
      expect(pangea.lines[1]).toBe("ATOMIC DESIGN · NEXT · STRAPI · STORYBOOK");
      // Telpark: where, arrival, departure, and one result with its price a day.
      expect(telpark.search).toHaveLength(3);
      for (const field of telpark.search ?? []) expect(field).toHaveLength(2);
      expect(telpark.spot?.price).toMatch(/9[.,]90/);
      // The mirror says what Omega and Monitor are; the first card says the clients rotated.
      expect(stop.mirror).toMatch(/Omega/);
      expect(stop.mirror).toMatch(/Monitor/);
      expect(stop.cards[0]).toMatch(/rota/i);
    });

    it(`names the café after the consultancy (${locale})`, () => {
      expect(dict.work.stops["cloud-district"].board.cafe).toBe("Cloud District Coffee");
    });
  }
});
