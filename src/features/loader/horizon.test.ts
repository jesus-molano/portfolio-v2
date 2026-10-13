import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Horizon } from "./Horizon";
import { buildHorizon, CAUSEWAY, LAYOUTS, project, TWINKLE_GROUPS } from "./horizon";

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

    it("twinkles its stars in a handful of phase groups, one layer each, never two neighbours on one clock", () => {
      expect(TWINKLE_GROUPS).toBeGreaterThanOrEqual(6);
      expect(TWINKLE_GROUPS).toBeLessThanOrEqual(8);
      expect(scene.twinkles).toHaveLength(TWINKLE_GROUPS);
      const twinkling = scene.stars.filter((star) => star.phase !== null);
      expect(twinkling.length).toBeGreaterThanOrEqual(TWINKLE_GROUPS * 2);
      expect(twinkling.length).toBeLessThan(scene.stars.length);
      const apart = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
      for (let group = 0; group < TWINKLE_GROUPS; group += 1) {
        const members = twinkling.filter((star) => star.phase === group);
        // Spread over the sky: a group never blinks as a cluster.
        expect(members.length, `group ${group}`).toBeGreaterThanOrEqual(2);
        for (const a of members) for (const b of members) if (a !== b) expect(apart(a, b), `group ${group}`).toBeGreaterThan(W / 10);
      }
      for (const star of twinkling) {
        const [nearest] = twinkling.filter((other) => other !== star).sort((a, b) => apart(a, star) - apart(b, star));
        expect(nearest.phase, `the star at ${star.x}, ${star.y}`).not.toBe(star.phase);
      }
      // Each group at a pace of its own, 2 to 6 s a breath, as each star had.
      expect(new Set(scene.twinkles.map((clock) => clock.dur)).size).toBe(TWINKLE_GROUPS);
      for (const clock of scene.twinkles) {
        expect(clock.dur).toBeGreaterThanOrEqual(2);
        expect(clock.dur).toBeLessThanOrEqual(6);
        expect(clock.delay).toBeLessThanOrEqual(0);
        expect(clock.delay).toBeGreaterThanOrEqual(-4);
      }
    });

    it("keeps the twinkling stars, drawn over the moon and its halo, clear of the moon", () => {
      const { x, y, r } = layout.moon;
      for (const star of scene.stars.filter((s) => s.phase !== null)) {
        expect(Math.hypot(star.x - x, star.y - y)).toBeGreaterThan(r + star.r + 2);
      }
    });

    it("flaps each bird about where its wings hinge: mid-span, 60 % down from the wings' peaks to their tips", () => {
      for (const bird of scene.birds) {
        const [tip, control, middle] = points(bird.d);
        expect(Math.abs(bird.pivot.x - middle.x)).toBeLessThan(0.11);
        // A quadratic's peak is halfway to its control point.
        const peak = (tip.y + control.y) / 2;
        expect(Math.abs(bird.pivot.y - (peak + (tip.y - peak) * 0.6))).toBeLessThan(0.15);
      }
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

/*
 * The picture is a stack: its still parts are whole <svg>s the pages place
 * (`.art > svg[data-layout]`), and between them each moving group is HTML
 * the compositor animates, placed by Horizon.module.css over the same
 * picture. Chrome animates an SVG element on the main thread, repainting
 * the whole drawing every frame, so no SVG element carries a motion.
 */
describe("the start menu's picture, on the compositor", () => {
  const html = renderToStaticMarkup(createElement(Horizon));
  // The wide layout's markup, then the tall one's, from the tag of its first part.
  const tallFrom = html.lastIndexOf("<", html.indexOf('data-layout="tall"'));
  const markup = { wide: html.slice(0, tallFrom), tall: html.slice(tallFrom) };
  // Vitest names a CSS module's class `_<name>_<hash>`.
  const MOVING = /<(\w+)[^>]*class="_(twinkle|drift|shimmer|sway|flock|flap)_/g;

  for (const layout of Object.values(LAYOUTS)) {
    const scene = buildHorizon(layout);
    const own = markup[layout.name];

    it(`${layout.name}: stacks the still <svg>s and the moving groups in paint order`, () => {
      const stack = [...own.matchAll(new RegExp(`<(svg|div)[^>]*data-layout="${layout.name}"`, "g"))].map((match) => match[1]);
      const palms = scene.palms.flatMap((_, i) => (i === 0 ? ["div"] : ["svg", "div"]));
      // The sky, the twinkling stars, the clouds, the sun and the sea, the water's glints, the
      // causeway and the headland, each palm's crown (the nearer trunk between), the grass, the birds.
      expect(stack).toEqual(["svg", "div", "div", "svg", "div", "svg", ...palms, "svg", "div"]);
      // Each group's frame is the layout's viewBox, its horizon where horizon.ts has it.
      const frames = own.split(`style="--w:${layout.width};--h:${layout.height};--hy:${layout.horizon}"`).length - 1;
      expect(frames).toBe(stack.filter((tag) => tag === "div").length);
    });

    it(`${layout.name}: moves HTML only, a layer per star group, glint, crown and bird`, () => {
      const moving = [...own.matchAll(MOVING)];
      expect(new Set(moving.map((match) => match[1]))).toEqual(new Set(["span"]));
      const count = (kind: string) => moving.filter((match) => match[2] === kind).length;
      expect(count("twinkle")).toBe(TWINKLE_GROUPS);
      expect(count("drift")).toBe(1);
      expect(count("shimmer")).toBeGreaterThan(scene.glitter.length + scene.swells.length);
      expect(count("sway")).toBe(scene.palms.length);
      expect(count("flock")).toBe(1);
      expect(count("flap")).toBe(scene.birds.length);
    });
  }
});

describe("the moving groups lie on the picture as the pages place it", () => {
  /** A stylesheet without its comments. */
  const sheet = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  /** The media query a rule at `at` sits in. */
  const queryAt = (css: string, at: number) => {
    const start = css.lastIndexOf("@media", at);
    return css.slice(start, css.indexOf("{", start)).trim();
  };
  const horizon = sheet("src/features/loader/Horizon.module.css");
  const tallStage = horizon.search(/\.stage\[data-layout="tall"\] \{\s*display: block;/);
  const { width, height, horizon: hy } = LAYOUTS.tall;

  it("places each frame as the <svg>s lay out the viewBox: wide sliced from the right, tall from --horizon-y", () => {
    expect(tallStage).toBeGreaterThan(0);
    expect(horizon).toMatch(/\.frame \{\s*--u: max\(100cqw \/ var\(--w\), 100cqh \/ var\(--h\)\);[^}]*top: calc\(50% - var\(--h\) \* var\(--u\) \/ 2\);\s*right: 0;/);
    expect(horizon).toMatch(/\.stage\[data-layout="tall"\] \.frame \{\s*--u: calc\(100cqw \/ var\(--w\)\);\s*top: calc\(var\(--horizon-y\) - var\(--hy\) \* var\(--u\)\);/);
  });

  for (const page of ["src/features/loader/LoadingScreen.module.css", "src/app/[lang]/not-found.module.css"]) {
    it(`${page} shows and places the layouts as Horizon.module.css does`, () => {
      const css = sheet(page);
      expect(css).toMatch(/\.art > svg\[data-layout="wide"\] \{\s*top: 0;\s*height: 100%;\s*\}/);
      const tall = /\.art > svg\[data-layout="tall"\] \{\s*display: block;\s*top: calc\(var\(--horizon-y\) - ([\d.]+)cqw\);\s*height: ([\d.]+)cqw;\s*\}/.exec(css);
      expect(tall).not.toBeNull();
      expect(Number(tall![1])).toBeCloseTo((hy / width) * 100, 3);
      expect(Number(tall![2])).toBeCloseTo((height / width) * 100, 3);
      expect(queryAt(css, tall!.index)).toBe(queryAt(horizon, tallStage));
    });
  }
});
