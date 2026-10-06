import { describe, expect, it } from "vitest";
import { buildHorizon, CAUSEWAY, LAYOUTS, project } from "./horizon";

/** The numbers in an SVG path, as points. */
function points(d: string): { x: number; y: number }[] {
  const values = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const out = [];
  for (let i = 0; i + 1 < values.length; i += 2) out.push({ x: values[i], y: values[i + 1] });
  return out;
}

/**
 * What a window shows of each layout (LoadingScreen.module.css): the wide
 * one fills the screen, sliced from the right and centred up and down
 * (xMaxYMid slice); the tall one is as wide as the screen, its horizon
 * placed above the menu, and shows its whole width from 390 units down
 * on a 360 x 640 phone (the most it loses; 120 on a 390 x 844 one).
 */
type View = { name: string; x0: number; x1: number; y0: number; y1: number };
const WIDE_WINDOWS = [
  [1440, 900],
  [1920, 1080],
  [1366, 650],
  [1280, 720],
  [960, 540],
  [1024, 768],
  [800, 600],
  [844, 390],
  [740, 360],
  [667, 375],
  [720, 450],
] as const;
function viewsOf(name: string, W: number, H: number): View[] {
  if (name === "tall") return [{ name: "a portrait screen", x0: 0, x1: W, y0: 400, y1: H }];
  return WIDE_WINDOWS.map(([vw, vh]) => {
    const scale = Math.max(vw / W, vh / H);
    const w = vw / scale;
    const h = vh / scale;
    return { name: `${vw}x${vh}`, x0: W - w, x1: W, y0: (H - h) / 2, y1: (H + h) / 2 };
  });
}

for (const layout of Object.values(LAYOUTS)) {
  const scene = buildHorizon(layout);
  const { width: W, height: H, horizon: hy, vp } = layout;
  const views = viewsOf(layout.name, W, H);

  describe(`the start menu's picture, ${layout.name}`, () => {
    it("is the same picture on every run", () => {
      expect(JSON.stringify(buildHorizon(layout))).toBe(JSON.stringify(scene));
    });

    it("draws a whole road: both edges run from below the picture's bottom to the vanishing point", () => {
      const { nearLeft, nearRight } = scene.road;
      expect(nearLeft.y).toBeGreaterThan(H);
      expect(nearRight.y).toBeGreaterThan(H);
      // A band, not a line: wide at the bottom of the picture.
      const atBottom = (p: { x: number; y: number }) => vp + ((p.x - vp) * (H - hy)) / (p.y - hy);
      expect(atBottom(nearRight) - atBottom(nearLeft)).toBeGreaterThan(W * 0.12);
      // Both edges end at the vanishing point, on the horizon.
      const surface = points(scene.road.surface);
      for (const far of surface.filter((p) => p.y < hy + 3)) {
        expect(Math.abs(far.x - vp)).toBeLessThan(2);
      }
      // The near end of the road shows between the picture's edges.
      expect(atBottom(nearLeft)).toBeGreaterThan(0);
      expect(atBottom(nearRight)).toBeLessThan(W);
    });

    it("marks the lanes, the dashes shrinking with distance", () => {
      expect(scene.road.edgeLines).toHaveLength(2);
      expect(scene.road.dashes.length).toBeGreaterThan(6);
      const heights = scene.road.dashes.map((d) => {
        const ys = points(d).map((p) => p.y);
        return Math.max(...ys) - Math.min(...ys);
      });
      for (let i = 1; i < heights.length; i += 1) expect(heights[i]).toBeLessThan(heights[i - 1] + 0.11);
      expect(heights.at(-1)).toBeLessThan(heights[0] / 4);
    });

    it("stands the lamps on the right parapet, smaller and closer to the horizon the farther they are", () => {
      const lamps = scene.lamps;
      expect(lamps.length).toBe(CAUSEWAY.lampCount);
      for (let i = 1; i < lamps.length; i += 1) {
        const [a, b] = [lamps[i - 1], lamps[i]];
        expect(b.z).toBeGreaterThan(a.z);
        expect(b.head.rx).toBeLessThanOrEqual(a.head.rx);
        expect(b.glow).toBeLessThanOrEqual(a.glow);
        // Heads converge to the vanishing point.
        expect(Math.abs(b.head.x - vp)).toBeLessThan(Math.abs(a.head.x - vp));
        expect(Math.abs(b.head.y - hy)).toBeLessThan(Math.abs(a.head.y - hy) + 0.11);
      }
      for (const lamp of lamps) {
        // Each pole's foot is on the parapet, its height a believable 8.5 m at its distance.
        const [base, top] = points(lamp.pole);
        const parapet = project(layout, layout.road.right + 0.15, CAUSEWAY.deck + CAUSEWAY.parapet, lamp.z);
        expect(Math.abs(base.x - parapet.x)).toBeLessThan(0.2);
        expect(Math.abs(base.y - parapet.y)).toBeLessThan(0.2);
        const metres = ((base.y - top.y) * lamp.z) / layout.focal;
        expect(metres).toBeGreaterThan(8);
        expect(metres).toBeLessThan(9.5);
        // A lamp head is a lamp head: under a metre across, never "enormous".
        expect((2 * lamp.head.rx * lamp.z) / layout.focal).toBeLessThan(1.2);
        // Its pool lies on the road, between the parapets.
        const left = project(layout, layout.road.left, CAUSEWAY.deck, lamp.z).x;
        const right = project(layout, layout.road.right, CAUSEWAY.deck, lamp.z).x;
        expect(lamp.pool.x).toBeGreaterThan(left);
        expect(lamp.pool.x).toBeLessThan(right);
      }
    });

    it("shows lamp reflections on the water beside the deck, never over the road", () => {
      const reflected = scene.lamps.filter((lamp) => lamp.reflection);
      expect(reflected.length).toBeGreaterThanOrEqual(3);
      for (const lamp of reflected) {
        const r = lamp.reflection!;
        expect(r.y).toBeGreaterThan(hy);
        expect(r.y).toBeLessThan(H);
        // Right of the deck's edge at that height on the picture.
        const depth = (layout.focal * (layout.camera - CAUSEWAY.slab)) / (r.y + r.height * 0.3 - hy);
        const edge = project(layout, layout.road.right + 0.25, CAUSEWAY.slab, depth).x;
        expect(r.x).toBeGreaterThan(edge);
      }
    });

    it("keeps the far islet's palms a few pixels tall, smaller than the city's towers, at its distance", () => {
      expect(scene.islet.tallest).toBeLessThan(layout.city.tallest / 3);
      expect(scene.islet.tallest).toBeLessThan(20);
      for (const palm of scene.islet.palms) {
        for (const p of points(palm)) {
          expect(p.y).toBeLessThanOrEqual(hy + 1);
          expect(p.y).toBeGreaterThan(hy - layout.islet.height * 1.2 - scene.islet.tallest * 1.6);
        }
      }
    });

    it("frames the shot with whole palms: their feet on the headland's sand and their crowns in the picture, above the city", () => {
      for (const view of views) {
        for (const palm of scene.palms) {
          const where = `${view.name}, the palm ${palm.z} m out`;
          // Its foot shows, above the fade into the night under a tall screen's menu.
          expect(palm.base.y, where).toBeLessThan(view.y1);
          expect(palm.base.y, where).toBeLessThan(layout.name === "tall" ? hy + (H - hy) * 0.45 : H);
          expect(palm.base.x, where).toBeLessThan(view.x1);
          // The whole crown, every leaflet's tip, inside the picture.
          expect(palm.top, where).toBeGreaterThan(view.y0);
          expect(palm.left, where).toBeGreaterThan(view.x0);
          expect(palm.right, where).toBeLessThan(view.x1);
        }
      }
      for (const palm of scene.palms) {
        // Above the city's towers, never a crown pasted over them.
        expect(palm.crown.y).toBeLessThan(hy - layout.city.tallest);
        // On the camera's right, clear of the road and of the vanishing point.
        expect(palm.left).toBeGreaterThan(vp);
      }
      // Each foot on the sand: right of the waterline at its distance.
      for (const spec of layout.palms) {
        const shore = layout.shore;
        const i = shore.findIndex((point) => point.z >= spec.z);
        expect(i).toBeGreaterThan(0);
        const [a, b] = [shore[i - 1], shore[i]];
        const waterline = a.x + ((b.x - a.x) * (spec.z - a.z)) / (b.z - a.z);
        expect(spec.x).toBeGreaterThan(waterline + 0.5);
      }
      // A palm is a palm: 15 to 30 m tall, its fronds 4 to 5 m.
      for (const [i, palm] of scene.palms.entries()) {
        const k = layout.focal / palm.z;
        expect((palm.base.y - palm.crown.y) / k).toBeGreaterThan(15);
        expect((palm.base.y - palm.crown.y) / k).toBeLessThan(30);
        expect((palm.right - palm.left) / k).toBeLessThan(12);
        if (i > 0) expect(palm.z).toBeLessThan(scene.palms[i - 1].z);
      }
    });

    it("plants the islet's palms in two uneven clumps, leaning both ways, with bushes between them", () => {
      const palms = scene.islet.palms.map((d) => {
        const [foot, , crown] = points(d);
        return { foot, crown, height: foot.y - crown.y };
      });
      expect(palms.length).toBeGreaterThanOrEqual(3);
      expect(palms.length).toBeLessThanOrEqual(5);
      const gaps = palms.slice(1).map((palm, i) => palm.foot.x - palms[i].foot.x);
      expect(Math.max(...gaps)).toBeGreaterThan(Math.min(...gaps) * 3);
      const heights = palms.map((palm) => palm.height);
      expect(Math.min(...heights)).toBeLessThan(Math.max(...heights) * 0.7);
      expect(palms.some((palm) => palm.crown.x < palm.foot.x - 0.5)).toBe(true);
      expect(palms.some((palm) => palm.crown.x > palm.foot.x + 0.5)).toBe(true);
      expect(scene.islet.bushes.length).toBeGreaterThan(0);
      for (const bush of scene.islet.bushes) expect(bush.cy).toBeLessThanOrEqual(hy);
    });

    it("keeps the moon whole in every window", () => {
      const { x, y, r } = layout.moon;
      for (const view of views) {
        expect(y - r, view.name).toBeGreaterThan(view.y0);
        expect(x - r, view.name).toBeGreaterThan(view.x0);
      }
    });

    it("keeps the sun and the city on the horizon, the road running into the city", () => {
      expect(layout.city.from).toBeLessThan(vp);
      expect(layout.city.to).toBeGreaterThan(vp);
      expect(layout.sun.x + layout.sun.r * 0.4).toBeLessThan(vp);
      for (const top of scene.city.tops) {
        expect(top).toBeLessThan(hy);
        expect(top).toBeGreaterThanOrEqual(hy - layout.city.tallest);
      }
    });
  });
}
