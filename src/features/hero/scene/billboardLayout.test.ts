import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { Color } from "three";
import { palette } from "@/design/tokens";
import {
  buildBillboards,
  fitLines,
  GLOW_LUMINANCE,
  glowTone,
  NEON_ON,
  neonLevel,
  packAtlas,
} from "./billboardLayout";
import { AVENUE, BILLBOARD_PLOTS, buildCity } from "./cityLayout";
import { CAR_POSITION } from "./drive";
import { buildLandmark } from "./landmarkLayout";
import { type Box, type Point, visibleShare } from "./sightlines";
import { SHOTS } from "./shots";
import { buildWaterfront } from "./waterfrontLayout";

describe("fitLines", () => {
  it("stacks a name on two lines when the board is not wide enough for one", () => {
    expect(fitLines("JESÚS MOLANO", 2)).toEqual(["JESÚS", "MOLANO"]);
    expect(fitLines("FRONTEND ENGINEER", 26 / 11)).toEqual(["FRONTEND", "ENGINEER"]);
    expect(fitLines("INGENIERO FRONTEND", 26 / 11)).toEqual(["INGENIERO", "FRONTEND"]);
  });

  it("keeps short copy on one line on a wide board", () => {
    expect(fitLines("JESÚS MOLANO", 8)).toEqual(["JESÚS MOLANO"]);
  });

  it("never breaks beside a separator", () => {
    expect(fitLines("VUE · NUXT", 26 / 8)).toEqual(["VUE · NUXT"]);
    expect(fitLines("REACT · NEXT", 1)).toEqual(["REACT · NEXT"]);
  });

  it("normalises spaces and keeps a single word whole", () => {
    expect(fitLines("  FRONTEND  ", 1)).toEqual(["FRONTEND"]);
  });
});

describe("packAtlas", () => {
  const sizes = BILLBOARD_PLOTS.map((plot) => plot.board);
  const atlas = packAtlas(sizes, 768, 8);

  it("gives every board its own rectangle with the board's aspect", () => {
    expect(atlas.rects).toHaveLength(sizes.length);
    atlas.rects.forEach((rect, i) => {
      expect(rect.x).toBeGreaterThanOrEqual(8);
      expect(rect.x + rect.w).toBeLessThanOrEqual(atlas.width - 8);
      expect(rect.y + rect.h).toBeLessThanOrEqual(atlas.height - 8);
      expect(Math.abs(rect.h - (rect.w * sizes[i].h) / sizes[i].w)).toBeLessThanOrEqual(1);
    });
  });

  it("leaves a gutter between rectangles so mipmaps never bleed", () => {
    for (let i = 1; i < atlas.rects.length; i++) {
      const previous = atlas.rects[i - 1];
      expect(atlas.rects[i].y - (previous.y + previous.h)).toBeGreaterThanOrEqual(16);
    }
  });

  it("maps UVs with v up, the canvas's top row at v = 1", () => {
    for (const rect of atlas.rects) {
      expect(rect.u0).toBeCloseTo(rect.x / atlas.width, 9);
      expect(rect.u1).toBeCloseTo((rect.x + rect.w) / atlas.width, 9);
      expect(rect.v1).toBeCloseTo(1 - rect.y / atlas.height, 9);
      expect(rect.v0).toBeCloseTo(1 - (rect.y + rect.h) / atlas.height, 9);
      expect(rect.v0).toBeGreaterThan(0);
      expect(rect.v1).toBeLessThan(1);
    }
    expect(atlas.rects[0].v1).toBeGreaterThan(atlas.rects[1].v1);
  });
});

describe("buildBillboards", () => {
  const city = buildCity(150, 5000, 400);
  const layout = buildBillboards(city.frontage);

  it("puts one board on each plot, a copy line for each in both languages", () => {
    expect(layout.boards).toHaveLength(BILLBOARD_PLOTS.length);
    expect(en.hero.billboards).toHaveLength(BILLBOARD_PLOTS.length);
    expect(es.hero.billboards).toHaveLength(BILLBOARD_PLOTS.length);
  });

  it("only says what the site already says", () => {
    const allowed = ["JESÚS MOLANO", "FRONTEND ENGINEER", "INGENIERO FRONTEND", "VUE · NUXT", "REACT · NEXT"];
    for (const text of [...en.hero.billboards, ...es.hero.billboards]) expect(allowed).toContain(text);
  });

  it("turns every face toward the causeway", () => {
    for (const board of layout.boards) {
      const toRoad = { x: CAR_POSITION.x - board.x, z: 20 - board.z };
      const length = Math.hypot(toRoad.x, toRoad.z);
      const facing = (Math.sin(board.yaw) * toRoad.x + Math.cos(board.yaw) * toRoad.z) / length;
      expect(facing).toBeGreaterThan(0.999);
      expect(Math.abs(board.yaw)).toBeLessThan(0.2);
    }
  });

  it("stands each board on its host's roof, clear of the road", () => {
    layout.boards.forEach((board, i) => {
      const host = city.frontage.find((b) => b.billboard === i)!;
      expect(board.y - board.h / 2).toBeGreaterThan(host.h + 1);
      expect(Math.abs(board.x) - board.w / 2).toBeGreaterThanOrEqual(AVENUE.halfWidth);
      expect(Math.abs(board.x) + board.w / 2).toBeLessThanOrEqual(Math.abs(host.x) + host.w / 2);
      expect(board.z).toBeLessThan(host.z + host.d / 2);
      expect(board.z).toBeGreaterThan(host.z - host.d / 2);
    });
    // Two posts and a back panel per board; posts reach down to the roof.
    expect(layout.parts).toHaveLength(layout.boards.length * 3);
  });

  it("can be read from the causeway: nothing hides a board, one after another", () => {
    const waterfront = buildWaterfront();
    const landmark = buildLandmark();
    const panels = layout.parts.filter((part) => part.w > 1);
    const rear = SHOTS[0];
    const crane = SHOTS[SHOTS.length - 1];
    const eyes = [rear.from, rear.to, crane.via![crane.via!.length - 1], crane.to].map((key) => ({
      x: key.position.x + CAR_POSITION.x,
      y: key.position.y,
      z: key.position.z,
    }));
    layout.boards.forEach((board, i) => {
      const blockers: Box[] = [
        ...city.blocks,
        ...waterfront.solids,
        ...landmark.blocks,
        // The other boards' panels, a little wider for their small turn.
        ...panels
          .filter((_, j) => j !== i)
          .map((p) => ({ x: p.x, y: p.y - p.h / 2, z: p.z, w: p.w + 1, h: p.h, d: p.d + 1 })),
      ];
      const face: Point[] = [];
      for (let u = 0; u < 5; u++) {
        for (let v = 0; v < 3; v++) {
          const along = ((u + 0.5) / 5 - 0.5) * board.w * 0.95;
          face.push({
            x: board.x + Math.cos(board.yaw) * along + Math.sin(board.yaw) * 0.05,
            y: board.y + ((v + 0.5) / 3 - 0.5) * board.h * 0.95,
            z: board.z - Math.sin(board.yaw) * along + Math.cos(board.yaw) * 0.05,
          });
        }
      }
      for (const eye of eyes) expect(visibleShare(eye, face, blockers)).toBeGreaterThanOrEqual(0.9);
    });
  });
});

describe("glowTone", () => {
  const luminance = (css: string) => {
    const c = new Color(css);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  };

  it("dims a light tube's halo so the core stays brighter than it", () => {
    const halo = glowTone(palette.sodium);
    expect(luminance(halo)).toBeCloseTo(GLOW_LUMINANCE, 2);
    // Same hue: the channels keep their ratios.
    const tube = new Color(palette.sodium);
    const dimmed = new Color(halo);
    expect(dimmed.g / dimmed.r).toBeCloseTo(tube.g / tube.r, 1);
  });

  it("leaves darker tubes as they are", () => {
    for (const tube of [palette.magenta, palette.orange]) {
      expect(new Color(glowTone(tube)).getHex()).toBe(new Color(tube).getHex());
    }
  });
});

describe("neonLevel", () => {
  it("keeps the tubes off while the title is up and on once it has gone", () => {
    for (let i = 0; i < BILLBOARD_PLOTS.length; i++) {
      expect(neonLevel(0, i)).toBe(NEON_ON.idle);
      expect(neonLevel(0.03, i)).toBe(NEON_ON.idle);
      expect(neonLevel(0.1, i)).toBe(1);
      expect(neonLevel(1, i)).toBe(1);
    }
  });

  it("switches the boards on one after another, with a stutter", () => {
    const start = (i: number) => {
      for (let p = 0; p <= 0.2; p += 0.0005) if (neonLevel(p, i) === 1) return p;
      return Number.NaN;
    };
    for (let i = 1; i < BILLBOARD_PLOTS.length; i++) expect(start(i)).toBeGreaterThan(start(i - 1));
    const samples = Array.from({ length: 50 }, (_, k) => neonLevel(NEON_ON.from + (k / 50) * NEON_ON.flicker, 0));
    const switches = samples.filter((level, k) => k > 0 && level !== samples[k - 1]).length;
    expect(switches).toBeGreaterThanOrEqual(4);
    for (const level of samples) expect(level).toBeGreaterThanOrEqual(NEON_ON.idle);
  });
});
