#!/usr/bin/env node
/**
 * Draws the STATS map: Tenerife at night, in our palette, with Gran Canaria
 * in a box in the corner, and the career's route across them (the ferry
 * from Las Palmas to the dock, then up to home base). Career geography
 * only: no hobby on it. Two crops of the same art:
 *
 *   public/stats/map.svg         16:11, with captions (1000 px and up)
 *   public/stats/map-square.svg  1:1, keyed pins (below 1000 px)
 *
 *   node tools/art/stats/map.mjs
 *
 * Inputs: tools/art/stats/canaries.json (the real coast, relief and depth,
 * from public-domain elevation data; see extract.mjs) and the projection,
 * places and blips in src/features/stats/statsLayout.ts, which the DOM over
 * the map uses too. Roads are schematic: smooth curves through the real
 * towns they join, not traced from any map. Every word on the map is DOM
 * text (Stats.tsx), so the SVG has none and works as a plain <img>.
 *
 * Deterministic: the lights are scattered by createRandom(seed); the same
 * inputs give byte-identical files. Each file must stay under 40 KB.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const layout = await import(path.join(ROOT, "src/features/stats/statsLayout.ts"));
const { palette } = await import(path.join(ROOT, "src/design/tokens.ts"));
const { createRandom } = await import(path.join(ROOT, "src/features/hero/scene/world.ts"));
const data = JSON.parse(fs.readFileSync(path.join(HERE, "canaries.json"), "utf8"));
const OUT_DIR = path.join(ROOT, "public/stats");
const MAX_BYTES = 40 * 1024;

/**
 * Map-only tones (the AGENTS rule for scene colours: a colour used by one
 * file stays in it). Land climbs from our ink to a moonlit lavender; the
 * Teide's top is the palest, the snow at night.
 */
const TONES = {
  seaDeep: "#0d0620",
  seaShelf: "#1d0f40",
  depthLine: "#7e64c2",
  land: palette.ink,
  bands: ["#311d54", "#38225f", "#40286b", "#492e77", "#533583", "#5e3d90", "#6f4ba0", "#9479bf", "#cfc2ea"],
  terrace: "#130923",
  contour: "#b9a4e0",
  coast: "#c9b6ee",
  shoal: palette.amber,
  roadCase: "#120826",
  minorRoad: "#9d86d6",
  boxFill: "#120826",
};

// ---------------------------------------------------------------------------
// Geometry helpers

/** Chaikin corner cutting on a closed or open polyline. */
function chaikin(points, closed, iterations = 2) {
  let pts = points;
  for (let n = 0; n < iterations; n++) {
    const out = [];
    const count = closed ? pts.length : pts.length - 1;
    if (!closed) out.push(pts[0]);
    for (let i = 0; i < count; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    if (!closed) out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker on an open polyline. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let index = -1;
    let max = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i], points[a], points[b]);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Catmull-Rom through waypoints, sampled: the schematic roads. */
function catmullRom(points, samples = 8) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        [0, 1].map(
          (k) =>
            0.5 *
            (2 * p1[k] +
              (-p0[k] + p2[k]) * t +
              (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
              (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
        ),
      );
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function insidePolygon([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distanceToRing(p, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) best = Math.min(best, distanceToSegment(p, ring[i], ring[(i + 1) % ring.length]));
  return best;
}

/** Path data with absolute rounding and relative moves (no drift, few bytes). */
function pathData(points, closed, precision = 1) {
  const f = 10 ** precision;
  const r = points.map(([x, y]) => [Math.round(x * f), Math.round(y * f)]);
  const fmt = (v) => {
    const s = String(v / f);
    return s.startsWith("0.") ? s.slice(1) : s.startsWith("-0.") ? "-" + s.slice(2) : s;
  };
  let d = `M${fmt(r[0][0])} ${fmt(r[0][1])}l`;
  let prev = r[0];
  let first = true;
  for (let i = 1; i < r.length; i++) {
    const dx = r[i][0] - prev[0];
    const dy = r[i][1] - prev[1];
    if (dx === 0 && dy === 0) continue;
    const sx = fmt(dx);
    const sy = fmt(dy);
    d += (first || sx.startsWith("-") ? "" : " ") + sx + (sy.startsWith("-") ? "" : " ") + sy;
    first = false;
    prev = r[i];
  }
  return d + (closed ? "z" : "");
}

const n1 = (v) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Scene content

/** Schematic roads through the real towns ([lon, lat]); `main` are the motorways. */
const ROADS = [
  // TF-5, the north motorway, and on along the north coast.
  {
    main: true,
    via: [
      [-16.255, 28.468], [-16.3, 28.478], [-16.355, 28.487], [-16.41, 28.476], [-16.462, 28.444],
      [-16.51, 28.418], [-16.548, 28.405], [-16.6, 28.383], [-16.66, 28.372], [-16.715, 28.362],
      [-16.764, 28.366], [-16.815, 28.362], [-16.86, 28.364],
    ],
  },
  // TF-1, the south motorway, to Adeje.
  {
    main: true,
    via: [
      [-16.255, 28.468], [-16.29, 28.44], [-16.318, 28.42], [-16.35, 28.392], [-16.385, 28.362],
      [-16.408, 28.3], [-16.435, 28.225],
      [-16.47, 28.15], [-16.52, 28.085], [-16.575, 28.063], [-16.65, 28.07], [-16.705, 28.063],
      [-16.722, 28.085], [-16.73, 28.12],
    ],
  },
  // The west coast and the Teno villages.
  { via: [[-16.73, 28.12], [-16.775, 28.168], [-16.81, 28.215], [-16.828, 28.252]] },
  { via: [[-16.828, 28.252], [-16.815, 28.295], [-16.78, 28.338], [-16.73, 28.357]] },
  { via: [[-16.815, 28.295], [-16.842, 28.31], [-16.85, 28.34], [-16.86, 28.364]] },
  // TF-24 along the ridge, from La Laguna to the caldera.
  {
    via: [
      [-16.31, 28.48], [-16.372, 28.45], [-16.43, 28.398], [-16.48, 28.345], [-16.51, 28.3],
      [-16.553, 28.296], [-16.585, 28.262], [-16.585, 28.236],
    ],
  },
  // TF-21 from La Orotava over the caldera to Vilaflor and Granadilla.
  {
    via: [
      [-16.523, 28.39], [-16.545, 28.34], [-16.553, 28.296], [-16.585, 28.236], [-16.625, 28.215],
      [-16.67, 28.205], [-16.655, 28.17], [-16.636, 28.157], [-16.6, 28.135], [-16.575, 28.12], [-16.56, 28.08],
    ],
  },
  // TF-38 from the caldera down to the west coast.
  { via: [[-16.67, 28.205], [-16.72, 28.225], [-16.77, 28.243], [-16.828, 28.252]] },
  // Anaga: over the ridge, and San Andrés on the coast.
  { via: [[-16.31, 28.48], [-16.28, 28.52], [-16.235, 28.535], [-16.195, 28.538], [-16.16, 28.548]] },
  { via: [[-16.262, 28.47], [-16.235, 28.492], [-16.207, 28.507]] },
];

/** Lights: [lon, lat, weight] for every town and village with a glow. */
const LIGHTS = [
  [-16.252, 28.466, 10], [-16.316, 28.487, 7], [-16.29, 28.47, 4], [-16.26, 28.432, 3], [-16.33, 28.505, 2],
  [-16.36, 28.53, 1.5], [-16.32, 28.55, 1.2], [-16.405, 28.477, 2.5], [-16.46, 28.445, 1.5], [-16.49, 28.43, 1.5],
  [-16.548, 28.413, 5], [-16.523, 28.39, 3.5], [-16.585, 28.385, 2.5], [-16.66, 28.375, 1], [-16.715, 28.366, 2],
  [-16.764, 28.372, 1], [-16.817, 28.366, 0.8], [-16.86, 28.372, 0.8], [-16.77, 28.343, 0.6],
  [-16.37, 28.355, 2.2], [-16.41, 28.315, 2.2], [-16.39, 28.33, 1], [-16.43, 28.24, 0.6], [-16.44, 28.17, 0.8],
  [-16.537, 28.046, 1.8], [-16.578, 28.115, 1.5], [-16.55, 28.09, 1.2], [-16.62, 28.03, 1.5], [-16.66, 28.025, 1.2],
  [-16.715, 28.052, 4.5], [-16.727, 28.074, 5], [-16.735, 28.098, 3.5], [-16.725, 28.122, 2], [-16.68, 28.098, 1.5],
  [-16.636, 28.157, 0.4], [-16.79, 28.185, 1], [-16.81, 28.215, 1], [-16.838, 28.245, 1.5], [-16.815, 28.295, 0.6],
  [-16.188, 28.508, 1], [-16.21, 28.565, 0.4], [-16.155, 28.565, 0.3],
];

const LIGHTS_GRAN_CANARIA = [
  [-15.43, 28.11, 9], [-15.42, 27.99, 4], [-15.44, 27.86, 3], [-15.58, 27.765, 4], [-15.52, 28.125, 1.5],
  [-15.65, 28.14, 1.2], [-15.7, 28.1, 0.6], [-15.755, 27.82, 0.8], [-15.5, 27.92, 1],
];

// ---------------------------------------------------------------------------
// Drawing

function render(frameId) {
  const frame = layout.FRAMES[frameId];
  const P = (lonLat) => layout.project(frame, lonLat);
  const PI = (lonLat) => layout.projectInset(frame, lonLat);
  const tenerife = data.islands.tenerife;
  const granCanaria = data.islands.granCanaria;
  const random = createRandom(frameId === "wide" ? 7177 : 7178);
  const out = [];
  const defs = [];

  const ring = (points, project, tolerance = 0.45) =>
    simplify(chaikin(points.map(project), true, 2), tolerance);

  const coast = ring(tenerife.levels[tenerife.coastLevel][0].points, P, 0.4);

  defs.push(
    `<radialGradient id="sea" cx="42%" cy="45%" r="75%"><stop offset="0" stop-color="${TONES.seaShelf}"/><stop offset=".6" stop-color="${palette.night}"/><stop offset="1" stop-color="${TONES.seaDeep}"/></radialGradient>`,
    `<radialGradient id="glow"><stop offset="0" stop-color="${palette.sodium}" stop-opacity=".34"/><stop offset=".45" stop-color="${palette.pink}" stop-opacity=".12"/><stop offset="1" stop-color="${palette.pink}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="peak"><stop offset="0" stop-color="${palette.cream}" stop-opacity=".22"/><stop offset="1" stop-color="${palette.cream}" stop-opacity="0"/></radialGradient>`,
    `<filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>`,
    `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>`,
  );

  // Sea, and a faint survey grid every 0.1 degree.
  out.push(`<rect width="${frame.width}" height="${frame.height}" fill="url(#sea)"/>`);
  let grid = "";
  for (let lon = -17.3; lon <= -15.0; lon += 0.1) {
    const [x] = P([lon, 28]);
    if (x > 0 && x < frame.width) grid += `M${n1(x)} 0V${frame.height}`;
  }
  for (let lat = 27.5; lat <= 29; lat += 0.1) {
    const [, y] = P([-16.5, lat]);
    if (y > 0 && y < frame.height) grid += `M0 ${n1(y)}H${frame.width}`;
  }
  out.push(`<path d="${grid}" stroke="${TONES.depthLine}" stroke-opacity=".07" stroke-width="1" fill="none"/>`);

  // Depth: the shelf as soft rings.
  for (const level of ["-1000", "-300"]) {
    for (const r of tenerife.levels[level] ?? []) {
      const pts = ring(r.points, P, 0.8);
      out.push(
        `<path d="${pathData(pts, true, 0)}" fill="${TONES.seaShelf}" fill-opacity="${level === "-300" ? ".55" : ".35"}" stroke="${TONES.depthLine}" stroke-opacity=".18" stroke-dasharray="2 6"/>`,
      );
    }
  }

  // The island: a drop shadow, a warm shoal glow, the land and its terraces.
  const coastD = pathData(coast, true);
  defs.push(`<path id="tf" d="${coastD}"/>`);
  out.push(`<use href="#tf" fill="${TONES.terrace}" opacity=".8" transform="translate(6 10)" filter="url(#blur)"/>`);
  out.push(`<use href="#tf" fill="none" stroke="${TONES.shoal}" stroke-opacity=".2" stroke-width="9" filter="url(#soft)"/>`);
  out.push(`<use href="#tf" fill="${TONES.land}"/>`);
  out.push(`<clipPath id="land"><use href="#tf"/></clipPath>`);
  out.push(`<g clip-path="url(#land)">`);
  const levels = Object.keys(tenerife.levels)
    .map(Number)
    .filter((l) => l > tenerife.coastLevel)
    .sort((a, b) => a - b);
  levels.forEach((level, i) => {
    const rings = tenerife.levels[level].map((r) => ring(r.points, P, 0.5));
    const d = rings.map((pts) => pathData(pts, true, 0)).join("");
    const id = `l${level}`;
    defs.push(`<path id="${id}" d="${d}" fill-rule="evenodd"/>`);
    out.push(`<use href="#${id}" fill="${TONES.terrace}" opacity=".55" transform="translate(2.2 3.4)"/>`);
    out.push(
      `<use href="#${id}" fill="${TONES.bands[Math.min(i, TONES.bands.length - 1)]}" stroke="${TONES.contour}" stroke-opacity="${(0.12 + i * 0.03).toFixed(2)}" stroke-width=".9"/>`,
    );
  });
  // Moonlight on the summit.
  const [tx, ty] = P(layout.TEIDE);
  out.push(`<circle cx="${n1(tx)}" cy="${n1(ty)}" r="70" fill="url(#peak)"/>`);
  out.push(`</g>`);
  out.push(`<use href="#tf" fill="none" stroke="${TONES.coast}" stroke-opacity=".75" stroke-width="1.6"/>`);

  // Town glow, under the roads.
  const coastMargin = (p) => insidePolygon(p, coast) && distanceToRing(p, coast) > 4;
  for (const [lon, lat, w] of LIGHTS) {
    if (w < 2) continue;
    const [x, y] = P([lon, lat]);
    out.push(`<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(18 + w * 6.5)}" fill="url(#glow)"/>`);
  }

  // Roads.
  let minor = "";
  let main = "";
  for (const road of ROADS) {
    const pts = simplify(catmullRom(road.via.map(P), 10), 0.35);
    for (const p of pts) {
      if (!insidePolygon(p, coast)) offIsland.add(`${frameId}: road through ${road.via.find((v) => Math.hypot(P(v)[0] - p[0], P(v)[1] - p[1]) < 40) ?? p.map(n1)}`);
    }
    if (road.main) main += pathData(pts, false);
    else minor += pathData(pts, false);
  }
  out.push(
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="${minor}${main}" stroke="${TONES.roadCase}" stroke-opacity=".75" stroke-width="5"/>` +
      `<path d="${minor}" stroke="${TONES.minorRoad}" stroke-opacity=".55" stroke-width="1.4"/>` +
      `<path d="${main}" stroke="${palette.sodium}" stroke-opacity=".85" stroke-width="2.2"/>` +
      `</g>`,
  );

  // Town lights: scattered dots, sodium mostly, some cream and pink.
  const dots = { sodium: [], cream: [], pink: [] };
  for (const [lon, lat, w] of LIGHTS) {
    const [cx, cy] = P([lon, lat]);
    const count = Math.round(5 + w * 7);
    const spread = 4 + Math.sqrt(w) * 7;
    for (let i = 0; i < count; i++) {
      // Box-Muller from the seeded generator.
      const r = Math.sqrt(-2 * Math.log(1 - random())) * spread;
      const a = random() * Math.PI * 2;
      const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85];
      const pick = random();
      if (!coastMargin(p)) continue;
      (pick < 0.68 ? dots.sodium : pick < 0.9 ? dots.cream : dots.pink).push(p);
    }
  }
  // Dots as zero-length round-capped segments, sorted and chained with
  // relative moves: a few bytes each.
  const dotPath = (list) => {
    const sorted = list.map(([x, y]) => [Math.round(x), Math.round(y)]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    let d = "";
    let prev = null;
    for (const [x, y] of sorted) {
      d += prev ? `m${x - prev[0]} ${y - prev[1]}h0` : `M${x} ${y}h0`;
      prev = [x, y];
    }
    return d.replace(/ -/g, "-");
  };
  out.push(
    `<g fill="none" stroke-linecap="round">` +
      `<path d="${dotPath(dots.sodium)}" stroke="${palette.sodium}" stroke-width="2.6"/>` +
      `<path d="${dotPath(dots.cream)}" stroke="${palette.cream}" stroke-width="2.2"/>` +
      `<path d="${dotPath(dots.pink)}" stroke="${palette.pink}" stroke-width="2.4"/>` +
      `</g>`,
  );

  // The two airports' runways (centre, length in km, heading).
  for (const [lon, lat, length, heading] of [
    [-16.5725, 28.0445, 3.2, 70],
    [-16.3415, 28.4827, 3.4, 120],
  ]) {
    const [cx, cy] = P([lon, lat]);
    const half = (P([lon + length / 2 / (111.32 * Math.cos((lat * Math.PI) / 180)), lat])[0] - cx);
    const a = ((heading - 90) * Math.PI) / 180;
    const [dx, dy] = [Math.cos(a) * half, Math.sin(a) * half];
    const d = `M${n1(cx - dx)} ${n1(cy - dy)}L${n1(cx + dx)} ${n1(cy + dy)}`;
    out.push(
      `<path d="${d}" stroke="${TONES.roadCase}" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="${d}" stroke="${TONES.minorRoad}" stroke-opacity=".6" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="${d}" stroke="${palette.cream}" stroke-opacity=".8" stroke-width="1" stroke-dasharray="3 4"/>`,
    );
  }

  // The summit glyph.
  out.push(
    `<path d="M${n1(tx - 9)} ${n1(ty + 6)}L${n1(tx)} ${n1(ty - 8)}L${n1(tx + 9)} ${n1(ty + 6)}Z" fill="${palette.cream}" fill-opacity=".9" stroke="${TONES.roadCase}" stroke-width="1.5" stroke-linejoin="round"/>`,
  );

  // The Gran Canaria box.
  const { inset } = frame;
  out.push(
    `<rect x="${inset.x}" y="${inset.y}" width="${inset.width}" height="${inset.height}" rx="14" fill="${TONES.boxFill}" fill-opacity=".86" stroke="${palette.cream}" stroke-opacity=".5" stroke-width="1.5"/>`,
  );
  out.push(`<clipPath id="box"><rect x="${inset.x}" y="${inset.y}" width="${inset.width}" height="${inset.height}" rx="14"/></clipPath>`);
  out.push(`<g clip-path="url(#box)">`);
  for (const r of granCanaria.levels["-300"] ?? []) {
    out.push(
      `<path d="${pathData(ring(r.points, PI, 0.6), true, 0)}" fill="${TONES.seaShelf}" fill-opacity=".6" stroke="${TONES.depthLine}" stroke-opacity=".18" stroke-dasharray="2 6"/>`,
    );
  }
  const gcCoast = ring(granCanaria.levels[granCanaria.coastLevel][0].points, PI, 0.35);
  defs.push(`<path id="gc" d="${pathData(gcCoast, true, 0)}"/>`);
  out.push(`<use href="#gc" fill="none" stroke="${TONES.shoal}" stroke-opacity=".2" stroke-width="6" filter="url(#soft)"/>`);
  out.push(`<use href="#gc" fill="${TONES.land}"/>`);
  out.push(`<clipPath id="gcland"><use href="#gc"/></clipPath><g clip-path="url(#gcland)">`);
  const gcLevels = Object.keys(granCanaria.levels)
    .map(Number)
    .filter((l) => l > granCanaria.coastLevel)
    .sort((a, b) => a - b);
  gcLevels.forEach((level, i) => {
    const d = granCanaria.levels[level].map((r) => pathData(ring(r.points, PI, 0.4), true, 0)).join("");
    out.push(`<path d="${d}" fill-rule="evenodd" fill="${TONES.bands[i * 2 + 1]}" stroke="${TONES.contour}" stroke-opacity=".18" stroke-width=".8"/>`);
  });
  out.push(`</g>`);
  out.push(`<use href="#gc" fill="none" stroke="${TONES.coast}" stroke-opacity=".7" stroke-width="1.3"/>`);
  const gcDots = [];
  for (const [lon, lat, w] of LIGHTS_GRAN_CANARIA) {
    const [cx, cy] = PI([lon, lat]);
    if (w >= 3) out.push(`<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(10 + w * 3.5)}" fill="url(#glow)"/>`);
    const count = Math.round(4 + w * 5);
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(-2 * Math.log(1 - random())) * (2.5 + Math.sqrt(w) * 3.5);
      const a = random() * Math.PI * 2;
      const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      if (insidePolygon(p, gcCoast) && distanceToRing(p, gcCoast) > 2) gcDots.push(p);
    }
  }
  out.push(`<path d="${dotPath(gcDots)}" stroke="${palette.sodium}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`);
  out.push(`</g>`);

  // The career route: the ferry out of the box to the dock, then up to home base.
  // (statsLayout.ts careerRoute: the same curve the tests keep clear of the names.)
  const routeD = pathData(simplify(layout.careerRoute(frame), 0.4), false);
  defs.push(`<path id="route" d="${routeD}"/>`);
  out.push(
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<use href="#route" stroke="${palette.magenta}" stroke-opacity=".35" stroke-width="9" filter="url(#soft)"/>` +
      `<use href="#route" stroke="${palette.magenta}" stroke-width="3.4"/>` +
      `<use href="#route" stroke="${palette.cream}" stroke-width="1.3" stroke-dasharray="2 8" stroke-opacity=".9"/>` +
      `</g>`,
  );

  // Compass and scale bar (their letters are DOM).
  const [cx, cy] = frame.compass;
  out.push(
    `<g transform="translate(${cx} ${cy})" stroke-linejoin="round">` +
      `<circle r="30" fill="${TONES.boxFill}" fill-opacity=".6" stroke="${palette.cream}" stroke-opacity=".35"/>` +
      `<path d="M0 -24L7 0L0 24L-7 0Z" fill="${TONES.contour}" fill-opacity=".35"/>` +
      `<path d="M0 -24L7 0H-7Z" fill="${palette.magenta}"/>` +
      `</g>`,
  );
  const tenKm = P([-16.5 + 10 / (111.32 * Math.cos((layout.REFERENCE_LAT * Math.PI) / 180)), 28])[0] - P([-16.5, 28])[0];
  const [sx, sy] = frame.scaleBar;
  out.push(
    `<g transform="translate(${sx} ${sy})" fill="none" stroke="${palette.cream}" stroke-opacity=".7" stroke-width="1.5">` +
      `<path d="M0 -6V0H${n1(tenKm)}V-6M${n1(tenKm / 2)} 0V-4"/>` +
      `<path d="M0 0H${n1(tenKm / 2)}" stroke-width="4" stroke-opacity=".5"/>` +
      `</g>`,
  );

  const body = out.join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}" width="${frame.width}" height="${frame.height}">` +
    `<!-- Tenerife and Gran Canaria for Vice Afterglow (tools/art/stats/map.mjs). Coast and relief from SRTM, GMTED2010 and ETOPO1, public domain. -->` +
    `<defs>${defs.join("")}</defs>${body}</svg>\n`;
  return { svg, tenKm };
}

/** Road points that fell in the sea: an error, unless --draft. */
const offIsland = new Set();
const draft = process.argv.includes("--draft");

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [frameId, file] of [
  ["wide", "map.svg"],
  ["square", "map-square.svg"],
]) {
  const { svg } = render(frameId);
  const bytes = Buffer.byteLength(svg);
  if (bytes > MAX_BYTES) {
    console.error(`${file} is ${(bytes / 1024).toFixed(1)} KB, over the 40 KB budget`);
    if (!draft) process.exit(1);
  }
  fs.writeFileSync(path.join(OUT_DIR, file), svg);
  console.log(`wrote public/stats/${file} (${(bytes / 1024).toFixed(1)} KB)`);
}
if (offIsland.size) {
  for (const line of offIsland) console.error(`off the island: ${line}`);
  if (!draft) process.exit(1);
}
