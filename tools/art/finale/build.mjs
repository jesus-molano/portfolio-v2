#!/usr/bin/env node
/**
 * Builds the finale's art (src/features/finale): the cinema plates (night
 * for the side projects, dawn for the end credits; wide for landscape
 * screens, tall for portrait ones; one per locale, since the booth and the
 * crest carry words) and the four posters per locale.
 *
 *   node tools/art/finale/build.mjs [--only night-wide,posters] [--png]
 *
 * Renders each SVG in Playwright's Chromium (fonts from Google Fonts, cached
 * in .art-cache/fonts), keeps the PNGs in .art-cache/finale, encodes them
 * to AVIF and WebP in public/finale (tools/art/encode.py, Pillow), and
 * writes the plates' geometry to src/features/finale/plates.json: the
 * marquee board and its rails, the bulb strips and the poster cases, in
 * frame units, so the DOM lands on the plate. The dawn plates' car is a
 * Blender render (tools/blender/render_finale_car.py, kept in
 * tools/art/finale/car), embedded in the SVG. Deterministic: every random
 * choice is seeded.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fontUrl, withRenderer } from "../browser.mjs";
import { Cam, edgeFade, filters, finish, f } from "./lib.mjs";
import { BILL, cinema, STREET } from "./cinema.mjs";
import { H as POSTER_H, POSTER_FONTS, W as POSTER_W, posterSvg } from "./posters.mjs";

/** The small posters' width (src/features/finale/links.ts POSTER_WIDTHS). */
const POSTER_SMALL = 216;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const CACHE = path.join(ROOT, ".art-cache/finale");
const OUT = path.join(ROOT, "public/finale");
const GEOMETRY = path.join(ROOT, "src/features/finale/plates.json");
const CAR_RENDERS = path.join(ROOT, "tools/art/finale/car");
const LOCALES = ["en", "es"];

const { values } = parseArgs({ options: { only: { type: "string" }, png: { type: "boolean", default: false } } });
const only = values.only ? new Set(values.only.split(",")) : null;
const wanted = (name) => !only || only.has(name);

/** Faces the plates are drawn in (the crest's neon, the brass plates, the booth). */
const PLATE_FONTS = ["Limelight", "JetBrains Mono:wght@500;700", "Bebas Neue", ...POSTER_FONTS];

/**
 * Letter rows of each marquee, as cap heights in metres: two equal rows at
 * night (TONIGHT / AFTER HOURS), a small and a big one at dawn (NOW
 * SHOWING / the name).
 */
const ROWS = { night: [0.6, 0.6], dawn: [0.42, 0.98] };

/** The dawn crest: AFTER has gone out, GLOW still burns. */
const GLOW_ONLY = [0, 0, 0, 0, 0, 1, 1, 1, 1];

/**
 * The plates. `size` is the encoded size in pixels; the SVG is drawn in
 * `w` x `h` frame units, which plates.json uses too. `o.car` is the hero's
 * car parked at the kerb, its ground centre in world metres: a render made
 * from this plate's camera (carRender), so moving it or the camera means
 * re-rendering it.
 */
const PLATES = {
  "night-wide": {
    w: 1280, h: 720, size: [2560, 1440],
    cam: new Cam({ x: 0, y: 1.35, z: 13.2, f: 900, cx: 640, cy: 566 }),
    o: {
      mode: "night", rows: ROWS.night, cases: "dom",
      palms: [{ x: -6, y: 96, size: 150, seed: 3, lean: 30, trunk: 26 }, { x: 1276, y: 70, size: 140, seed: 9, lean: -40, trunk: 24 }],
    },
    fade: { top: 0.07, left: 0.025, right: 0.025, bottom: 0.05 },
  },
  "night-tall": {
    w: 390, h: 440, size: [1170, 1320],
    cam: new Cam({ x: 0, y: 4.6, z: 33, f: 860, cx: 195, cy: 324 }),
    o: {
      mode: "night", rows: ROWS.night, cases: "none", landmark: false,
      palms: [{ x: -16, y: 170, size: 74, seed: 3, lean: 10, trunk: 13 }, { x: 406, y: 156, size: 70, seed: 9, lean: -12, trunk: 12 }],
    },
    fade: { top: 0.06, bottom: 0.2 },
    fadeColor: "#140a26",
  },
  "dawn-wide": {
    w: 1280, h: 720, size: [2560, 1440],
    cam: new Cam({ x: 5.2, y: 2.0, z: 27, f: 1000, cx: 640, cy: 470 }),
    o: {
      mode: "dawn", rows: ROWS.dawn, cases: "baked",
      lit: { posters: 0, soffit: 0.4, crest: 0, crestLetters: GLOW_ONLY, lobby: 0, booth: 0 },
      car: { x: 0.73, z: 7.2 },
      lamps: [{ x: -8.6, z: 5.3, dir: 1, on: true }, { x: 10.5, z: 5.3, dir: -1, on: false }],
      palms: [{ x: 40, y: 236, size: 120, seed: 21, lean: 10, trunk: 16 }],
      seed: 4,
    },
    sun: 0.5,
    fade: { top: 0.08 },
  },
  "dawn-tall": {
    w: 405, h: 460, size: [1080, 1227],
    cam: new Cam({ x: 0, y: 2.4, z: 30, f: 790, cx: 202.5, cy: 300 }),
    o: {
      mode: "dawn", rows: ROWS.dawn, cases: "baked",
      lit: { posters: 0, soffit: 0.15, crest: 0, crestLetters: GLOW_ONLY, lobby: 0, booth: 0 },
      car: { x: 0, z: 7.2 },
      lamps: [{ x: -7.6, z: 5.3, dir: 1, on: true }],
      palms: [],
      seed: 4,
    },
    sun: 0.6,
    fade: { top: 0.06, bottom: 0.14 },
  },
};

/**
 * The car's render for a plate (tools/blender/render_finale_car.py writes
 * tools/art/finale/car/<plate>.png and .json): the PNG embedded as a data
 * URL, so the page renders it without file access. The render is the plate's
 * own camera cropped to the car; one made for another camera or car place
 * would sit wrong, so the build refuses it.
 */
function carRender(name) {
  const stem = path.join(CAR_RENDERS, name);
  if (!fs.existsSync(`${stem}.json`)) throw new Error(`${path.relative(ROOT, stem)}.png is missing: run tools/blender/render_finale_car.py`);
  const meta = JSON.parse(fs.readFileSync(`${stem}.json`, "utf8"));
  const P = PLATES[name];
  const want = { cam: { x: P.cam.x, y: P.cam.y, z: P.cam.z, f: P.cam.F, cx: P.cam.cx, cy: P.cam.cy }, car: { x: P.o.car.x, z: P.o.car.z } };
  const same = (a, b) => Object.keys(a).every((k) => Math.abs(a[k] - b[k]) < 1e-6);
  const density = P.size[0] / P.w;
  if (!same(want.cam, meta.cam) || !same(want.car, meta.car) || Math.abs(meta.density - density) > 1e-6 || meta.street !== STREET) {
    throw new Error(`${path.relative(ROOT, stem)}.json was rendered for another camera or car place than ${name}: update VIEWS in tools/blender/render_finale_car.py and re-render`);
  }
  // Drawn 1:1 on the plate's pixel grid: a preview (half size) or an edited
  // image would be stretched over the car's frame.
  const png = fs.readFileSync(`${stem}.png`);
  const [pw, ph] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  if (pw !== Math.round(meta.frame.w * density) || ph !== Math.round(meta.frame.h * density)) {
    throw new Error(`${path.relative(ROOT, stem)}.png is ${pw}x${ph}, not ${name}'s pixels for its frame: re-render it without --preview`);
  }
  const href = `data:image/png;base64,${png.toString("base64")}`;
  return { href, window: meta.window, contactZ: meta.contactZ };
}

function plateSvg(name, lang) {
  const P = PLATES[name];
  const px = name.replace("-", "") + lang;
  const { w, h } = P;
  const o = P.o.car ? { ...P.o, car: { ...P.o.car, render: carRender(name) } } : P.o;
  const sc = cinema(P.cam, { px, w, h, lang, ...o });
  let body = sc.body;
  if (P.sun) {
    // the dawn's low sun behind the skyline, on the right
    const roofY = P.cam.p(0, 8.2, 0)[1];
    body = body.replace("<g>", `<ellipse cx="${f(w * 0.74)}" cy="${f(roofY - h * 0.04)}" rx="${f(w * 0.42)}" ry="${f(h * 0.12)}" fill="#fff0d8" opacity="${P.sun}" filter="url(#${px}b30)"/><g>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${P.size[0]}" height="${P.size[1]}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs>${filters(px)}${sc.defs}</defs>${body}${finish(px, w, h, 0.07, P.o.mode === "dawn" ? 0.6 : 0.7)}${edgeFade(px, w, h, P.fade, P.fadeColor)}</svg>`;
  return { svg, geo: { width: w, height: h, ...sc.geo } };
}

const page = (svg, families) =>
  `<!doctype html><meta charset="utf-8"><style>@import url('${fontUrl(families)}');html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`;

function encode(png, stem, quality, width) {
  const args = ["tools/art/encode.py", png, stem];
  if (quality) args.push("--webp-quality", String(quality.webp), "--avif-quality", String(quality.avif));
  if (width) args.push("--width", String(width));
  process.stdout.write(execFileSync("python3", args, { cwd: ROOT, encoding: "utf8" }));
}

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(GEOMETRY), { recursive: true });

await withRenderer(async (render) => {
  const geometry = fs.existsSync(GEOMETRY) ? JSON.parse(fs.readFileSync(GEOMETRY, "utf8")) : {};
  for (const name of Object.keys(PLATES)) {
    if (!wanted(name)) continue;
    const [width, height] = PLATES[name].size;
    for (const lang of LOCALES) {
      const { svg, geo } = plateSvg(name, lang);
      // The geometry is the same in every locale: only the painted words differ.
      geometry[name] = geo;
      const png = path.join(CACHE, `${name}-${lang}.png`);
      fs.writeFileSync(png, await render(page(svg, PLATE_FONTS), width, height));
      if (!values.png) encode(png, path.join(OUT, `${name}-${lang}`), { webp: 78, avif: 52 });
    }
  }
  fs.writeFileSync(GEOMETRY, JSON.stringify(geometry, null, 2) + "\n");

  if (wanted("posters")) {
    // 1.6x the poster's units: sharp at about 270 css px wide on a 2x screen; and half that.
    const width = Math.round(POSTER_W * 1.6), height = Math.round(POSTER_H * 1.6);
    for (const lang of LOCALES) {
      for (const repo of BILL) {
        for (const hot of [false, true]) {
          const slug = `${repo.toLowerCase()}-${lang}${hot ? "-hot" : ""}`;
          const png = path.join(CACHE, `poster-${slug}.png`);
          fs.writeFileSync(png, await render(page(posterSvg(repo, lang, { width, height, hot }), POSTER_FONTS), width, height));
          if (!values.png) {
            encode(png, path.join(OUT, `poster-${slug}`));
            // Half size for a case about 108 css px wide on a 1x screen (PosterCase's srcset).
            encode(png, path.join(OUT, `poster-${slug}-${POSTER_SMALL}`), undefined, POSTER_SMALL);
          }
        }
      }
    }
  }
});
console.log("geometry:", path.relative(ROOT, GEOMETRY));
