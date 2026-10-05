#!/usr/bin/env node
/**
 * Extracts the real shape of Tenerife and Gran Canaria for the STATS map
 * from public-domain elevation data, and writes it as vectors to
 * tools/art/stats/canaries.json. Run it once; map.mjs reads the JSON offline.
 *
 *   node tools/art/stats/extract.mjs [--cache <dir>]
 *
 * Data: the Terrain Tiles on AWS Open Data (Terrarium encoding) at zoom 8,
 * where every pixel of these islands comes from SRTM (NASA / USGS), GMTED2010
 * (USGS) and, under the sea, ETOPO1 (NOAA): all three are US government works
 * in the public domain. The script records each tile's X-Imagery-Sources
 * header in the output and refuses a tile built from any other source (from
 * zoom 9 on, these islands also use EU-DEM, which needs an attribution).
 *
 * What it derives: contour rings by marching squares at fixed heights and
 * depths, simplified with Douglas-Peucker in metres, rounded to 5 decimals
 * of a degree (about 1 m). The coast is the 40 m ring, not the 0 m one: at
 * this resolution the land and sea sources blend into a fringe of low
 * positive pixels up to 2 km offshore, and these islands rise steeply, so
 * the 40 m ring lies on the towns that stand on the shore (Santa Cruz,
 * Candelaria, Puerto de la Cruz, Los Cristianos). The coast is read after a
 * morphological opening (strips one or two pixels wide are resampling
 * seams, such as the one between two SRTM cells at 28 N), and only the
 * island's largest coast ring is kept (the islets are below the resolution).
 * Deterministic: the same tiles give the same file.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "canaries.json");
const ZOOM = 8;
const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const PUBLIC_DOMAIN = /^(srtm|gmted|etopo1)\//;

const args = process.argv.slice(2);
const cacheDir = args.includes("--cache")
  ? path.resolve(args[args.indexOf("--cache") + 1])
  : path.join(os.tmpdir(), "va-terrain-tiles");

/**
 * Islands, their bounding boxes (degrees) and the contour levels kept.
 * Heights in metres above sea level; negative levels are depths.
 */
const ISLANDS = [
  {
    id: "tenerife",
    bbox: { west: -17.2, east: -15.9, south: 27.8, north: 28.8 },
    coast: 40,
    land: [400, 800, 1200, 1600, 2000, 2300, 2600, 3000, 3300],
    sea: [-300, -1000],
    tolerance: { coast: 60, contour: 110, sea: 300 },
    minArea: 0.6e6,
  },
  {
    id: "granCanaria",
    bbox: { west: -15.95, east: -15.25, south: 27.65, north: 28.25 },
    coast: 40,
    land: [500, 1000, 1500],
    sea: [-300, -1000],
    tolerance: { coast: 80, contour: 140, sea: 300 },
    minArea: 0.6e6,
  },
];

// ---------------------------------------------------------------------------
// Tiles

function lonToTileX(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}

function latToTileY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

function tileXToLon(x, z) {
  return (x / 2 ** z) * 360 - 180;
}

function tileYToLat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

async function fetchTile(z, x, y) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = path.join(cacheDir, `${z}-${x}-${y}.png`);
  const meta = `${file}.sources`;
  if (!fs.existsSync(file) || !fs.existsSync(meta)) {
    const response = await fetch(TILE_URL(z, x, y));
    if (!response.ok) throw new Error(`tile ${z}/${x}/${y}: HTTP ${response.status}`);
    const sources = response.headers.get("x-amz-meta-x-imagery-sources") ?? "";
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    fs.writeFileSync(meta, sources);
  }
  const sources = fs
    .readFileSync(meta, "utf8")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const foreign = sources.filter((s) => !PUBLIC_DOMAIN.test(s));
  if (sources.length === 0 || foreign.length > 0) {
    throw new Error(`tile ${z}/${x}/${y} uses sources outside the public domain: ${foreign.join(", ") || "(none listed)"}`);
  }
  return { png: decodePng(fs.readFileSync(file)), sources };
}

/** Minimal PNG decoder: 8-bit RGB or RGBA, not interlaced (what Terrarium tiles are). */
function decodePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colour = data[9];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || data[12] !== 0) {
        throw new Error(`unsupported PNG (depth ${depth}, colour ${colour}, interlace ${data[12]})`);
      }
      channels = colour === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? pixels[y * stride + i - channels] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + i] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

/** The elevation grid over a bounding box, one sample per tile pixel. */
async function elevationGrid(bbox) {
  const x0 = Math.floor(lonToTileX(bbox.west, ZOOM));
  const x1 = Math.floor(lonToTileX(bbox.east, ZOOM));
  const y0 = Math.floor(latToTileY(bbox.north, ZOOM));
  const y1 = Math.floor(latToTileY(bbox.south, ZOOM));
  const size = 256;
  const cols = (x1 - x0 + 1) * size;
  const rows = (y1 - y0 + 1) * size;
  const grid = new Float32Array(cols * rows);
  const tiles = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const { png, sources } = await fetchTile(ZOOM, tx, ty);
      tiles.push({ tile: `${ZOOM}/${tx}/${ty}`, sources });
      for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
          const i = (py * size + px) * png.channels;
          const [r, g, b] = [png.pixels[i], png.pixels[i + 1], png.pixels[i + 2]];
          const gx = (tx - x0) * size + px;
          const gy = (ty - y0) * size + py;
          grid[gy * cols + gx] = r * 256 + g + b / 256 - 32768;
        }
      }
    }
  }
  // Pixel centre (gx, gy) to degrees.
  const toLonLat = (gx, gy) => [
    tileXToLon(x0 + (gx + 0.5) / size, ZOOM),
    tileYToLat(y0 + (gy + 0.5) / size, ZOOM),
  ];
  return { grid, cols, rows, tiles, toLonLat };
}

// ---------------------------------------------------------------------------
// Contours

/**
 * Marching squares on the grid at one level: closed rings of [gx, gy] grid
 * coordinates around the cells at or above the level. The grid is read with
 * a one-cell border below every level, so every ring closes.
 */
function contourRings(field, cols, rows, level) {
  const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? -1e9 : field[y * cols + x]);
  const segments = new Map();
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const add = (a, b) => {
    // Directed so the high side is on the left: rings run counter-clockwise
    // around high ground in grid coordinates (y down).
    const ka = key(a);
    if (!segments.has(ka)) segments.set(ka, []);
    segments.get(ka).push({ a, b });
  };
  const lerp = (x0, y0, v0, x1, y1, v1) => {
    const t = (level - v0) / (v1 - v0);
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  };
  for (let y = -1; y < rows; y++) {
    for (let x = -1; x < cols; x++) {
      const tl = at(x, y);
      const tr = at(x + 1, y);
      const br = at(x + 1, y + 1);
      const bl = at(x, y + 1);
      const code = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const top = () => lerp(x, y, tl, x + 1, y, tr);
      const right = () => lerp(x + 1, y, tr, x + 1, y + 1, br);
      const bottom = () => lerp(x, y + 1, bl, x + 1, y + 1, br);
      const left = () => lerp(x, y, tl, x, y + 1, bl);
      const centre = (tl + tr + br + bl) / 4 >= level;
      switch (code) {
        case 1: add(bottom(), left()); break;
        case 2: add(right(), bottom()); break;
        case 3: add(right(), left()); break;
        case 4: add(top(), right()); break;
        case 5:
          if (centre) { add(top(), left()); add(bottom(), right()); }
          else { add(top(), right()); add(bottom(), left()); }
          break;
        case 6: add(top(), bottom()); break;
        case 7: add(top(), left()); break;
        case 8: add(left(), top()); break;
        case 9: add(bottom(), top()); break;
        case 10:
          if (centre) { add(left(), bottom()); add(right(), top()); }
          else { add(left(), top()); add(right(), bottom()); }
          break;
        case 11: add(right(), top()); break;
        case 12: add(left(), right()); break;
        case 13: add(bottom(), right()); break;
        case 14: add(left(), bottom()); break;
      }
    }
  }
  // Chain the directed segments into rings.
  const rings = [];
  for (const start of [...segments.keys()].sort()) {
    while (segments.get(start)?.length) {
      const first = segments.get(start).shift();
      const ring = [first.a];
      let current = first.b;
      let guard = 0;
      while (key(current) !== start && guard++ < 1e6) {
        ring.push(current);
        const next = segments.get(key(current));
        if (!next?.length) break;
        current = next.shift().b;
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  return rings;
}

/**
 * The grid with a morphological opening (erode, then dilate, 3 x 3) of the
 * ground at or above a level: strips and hooks one or two pixels wide
 * (resampling seams, not coast) drop just below the level; the rest of the
 * field is untouched, so the contour keeps its sub-pixel interpolation.
 */
function openedAt(field, cols, rows, level) {
  const above = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && field[y * cols + x] >= level;
  const eroded = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let all = true;
      for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1 && all; dx++) all = above(x + dx, y + dy);
      eroded[y * cols + x] = all ? 1 : 0;
    }
  }
  const out = Float32Array.from(field);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!above(x, y)) continue;
      let kept = false;
      for (let dy = -1; dy <= 1 && !kept; dy++) {
        for (let dx = -1; dx <= 1 && !kept; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          kept = nx >= 0 && ny >= 0 && nx < cols && ny < rows && eroded[ny * cols + nx] === 1;
        }
      }
      if (!kept) out[y * cols + x] = level - 1;
    }
  }
  return out;
}

/** Equirectangular metres around a reference latitude, for distances and areas. */
function metres(lonLat, lat0) {
  const k = (Math.PI / 180) * 6371008.8;
  return [lonLat[0] * k * Math.cos((lat0 * Math.PI) / 180), lonLat[1] * k];
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/** Douglas-Peucker on a closed ring (in metres), keeping the two farthest-apart anchors. */
function simplifyRing(points, tolerance) {
  const n = points.length;
  let far = 0;
  let best = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (d > best) { best = d; far = i; }
  }
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[far] = 1;
  const stack = [[0, far], [far, n]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const pa = points[a];
    const pb = points[b % n];
    let index = -1;
    let max = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i], pa, pb);
      if (d > max) { max = d; index = i; }
    }
    if (index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function round5(value) {
  return Math.round(value * 1e5) / 1e5;
}

async function extractIsland(island) {
  const { grid, cols, rows, tiles, toLonLat } = await elevationGrid(island.bbox);
  const lat0 = (island.bbox.north + island.bbox.south) / 2;
  const toDegrees = ([gx, gy]) => {
    // Bilinear between the pixel centres around (gx, gy).
    const fx = Math.floor(gx);
    const fy = Math.floor(gy);
    const [lonA, latA] = toLonLat(fx, fy);
    const [lonB, latB] = toLonLat(fx + 1, fy + 1);
    return [lonA + (lonB - lonA) * (gx - fx), latA + (latB - latA) * (gy - fy)];
  };
  const inBox = ([lon, lat]) =>
    lon >= island.bbox.west && lon <= island.bbox.east && lat >= island.bbox.south && lat <= island.bbox.north;

  // Mask everything but the island itself (the largest 0 m ring and what it
  // encloses) so the neighbouring islands' contours never leak in.
  const levels = [island.coast, ...island.land, ...island.sea];
  const out = { coastLevel: island.coast, levels: {} };
  const coastField = openedAt(grid, cols, rows, island.coast);
  for (const level of levels) {
    const tolerance =
      level === island.coast ? island.tolerance.coast : level > 0 ? island.tolerance.contour : island.tolerance.sea;
    const rings = contourRings(level === island.coast ? coastField : grid, cols, rows, level)
      .map((ring) => ring.map(toDegrees))
      .filter((ring) => ring.every(inBox))
      .map((ring) => {
        const m = ring.map((p) => metres(p, lat0));
        const simplified = simplifyRing(m, tolerance);
        const k = (Math.PI / 180) * 6371008.8;
        return {
          area: signedArea(m),
          points: simplified.map(([x, y]) => [round5(x / (k * Math.cos((lat0 * Math.PI) / 180))), round5(y / k)]),
        };
      })
      .filter((ring) => Math.abs(ring.area) >= island.minArea && ring.points.length >= 4);
    out.levels[level] = rings;
  }
  // Marching squares directs every ring the same way around high ground,
  // so the coast (the largest ring) gives the sign of an outer ring; a ring
  // of the other sign is a hole (a hollow below its level).
  const outerSign = Math.sign(
    out.levels[island.coast].reduce((a, b) => (Math.abs(b.area) > Math.abs(a.area) ? b : a)).area,
  );
  for (const level of levels) {
    out.levels[level] = out.levels[level].map((ring) => ({
      hole: Math.sign(ring.area) !== outerSign,
      points: ring.points,
    }));
  }
  // Keep only the island's own rings: the largest coast ring and what it encloses.
  const coast = out.levels[island.coast].filter((r) => !r.hole).sort((a, b) => b.points.length - a.points.length)[0];
  out.levels[island.coast] = [coast];
  const inside = (p, ring) => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  for (const level of island.land) {
    out.levels[level] = out.levels[level].filter((r) => r === coast || inside(r.points[0], coast.points));
  }
  // The highest sample, for the record (the real summits are higher: each
  // sample averages about half a kilometre).
  let peak = { h: -Infinity, at: [0, 0] };
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const h = grid[gy * cols + gx];
      const p = toLonLat(gx, gy);
      if (h > peak.h && inBox(p) && inside(p, coast.points)) peak = { h, at: p.map(round5) };
    }
  }
  return { tiles, peakSample: { metres: Math.round(peak.h), lonLat: peak.at }, ...out };
}

const result = {
  about:
    "Coast, contours and depth rings of Tenerife and Gran Canaria for the STATS map (tools/art/stats/map.mjs). " +
    "Derived by tools/art/stats/extract.mjs from the Terrain Tiles on AWS Open Data (Terrarium PNG, zoom 8, about 540 m a pixel at 28 N), " +
    "built there only from SRTM (NASA / USGS), GMTED2010 (USGS) and ETOPO1 (NOAA): US government works in the public domain. " +
    "Rings are [lon, lat] in degrees (WGS 84), simplified with Douglas-Peucker; levels in metres, negative under the sea; hole marks ground below its level.",
  source: "https://registry.opendata.aws/terrain-tiles/",
  licence: "Public domain (SRTM, GMTED2010, ETOPO1). Courtesy of the U.S. Geological Survey, NASA and NOAA.",
  zoom: ZOOM,
  islands: {},
};
for (const island of ISLANDS) {
  result.islands[island.id] = await extractIsland(island);
  const counts = Object.entries(result.islands[island.id].levels)
    .map(([level, rings]) => `${level}:${rings.length}/${rings.reduce((n, r) => n + r.points.length, 0)}`)
    .join(" ");
  console.log(`${island.id}: peak sample ${result.islands[island.id].peakSample.metres} m · rings/points ${counts}`);
}
fs.writeFileSync(OUT, JSON.stringify(result) + "\n");
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
