#!/usr/bin/env node
/**
 * THE USUAL SUSPECTS: flat violet placeholder silhouettes of the four cats.
 *
 * The real cats are rendered in Blender by the cats package
 * (tools/blender/build_cats.py) and land in public/interlude/ under the
 * same names, with the same manifest. Until then the line-up is built
 * against these: one flat colour, a soft contact shadow baked into the
 * alpha, every image at the line-up's one scale (24 px per cm), each cat
 * seated, facing the camera, centred on its slot with the floor at y = 0.
 *
 *   node tools/art/suspects/placeholder.mjs [--out public/interlude]
 *
 * Writes <cat>.webp and <cat>.avif (RGBA, straight alpha; WebP q82 and
 * AVIF q60 through Pillow, `python3` or $PYTHON) and manifest.json:
 *
 *   { "pxPerCm": 24, "cats": { "<cat>": { w, h, floorY, headTopY, centerX, headWidth } } }
 *
 * in image pixels: w and h the image size, floorY the row where the cat
 * meets the floor, headTopY the highest row of the head (ear tips
 * included), centerX the column of the slot centre, headWidth the width of
 * the head across the cheeks. Seated heights to the ear tips, in the order
 * the owner gives their sizes: Tom 31 cm (the biggest, a bit chubby, only
 * just over the others), Kira 30 (a normal adult), Odin 27 (smaller than
 * both, a little short in the leg, a shorter tail) and Dante 20 (a kitten
 * of six months).
 *
 * The shapes are signed distance fields (ellipses, tapered capsules,
 * triangles, smooth unions), rasterised with analytic antialiasing:
 * deterministic, no randomness, no dependencies beyond Node and Pillow.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { crc32, deflateSync } from "node:zlib";

const { values } = parseArgs({
  options: { out: { type: "string", default: "public/interlude" } },
});

/** The line-up's one scale, shared with the Blender renders (spec 5.3). */
const PX_PER_CM = 24;
/** Flat violet of the silhouettes: a shade of the site's `ink`, a touch darker than the wall. */
const FILL = [0x22, 0x13, 0x3d];
/** Peak opacity of the contact shadow under the paws. */
const SHADOW_ALPHA = 0.5;

// ------------------------------------------------------------ distance fields

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * t;

function ellipse(cx, cy, a, b) {
  return {
    box: [cx - a, cy - b, cx + a, cy + b],
    d(x, y) {
      const px = x - cx;
      const py = y - cy;
      const k0 = Math.hypot(px / a, py / b);
      const k1 = Math.hypot(px / (a * a), py / (b * b));
      return k1 === 0 ? -Math.min(a, b) : (k0 * (k0 - 1)) / k1;
    },
  };
}

/** A capsule from a to b whose radius runs from ra to rb. */
function capsule(ax, ay, ra, bx, by, rb) {
  const r = Math.max(ra, rb);
  return {
    box: [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r],
    d(x, y) {
      const pax = x - ax;
      const pay = y - ay;
      const bax = bx - ax;
      const bay = by - ay;
      const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
      return Math.hypot(pax - bax * h, pay - bay * h) - mix(ra, rb, h);
    },
  };
}

/** A chain of capsules through [x, y, r] points (tails). */
function chain(points) {
  const parts = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay, ra] = points[i - 1];
    const [bx, by, rb] = points[i];
    parts.push(capsule(ax, ay, ra, bx, by, rb));
  }
  return union(parts, 0.3);
}

/** A triangle with corners rounded by r (ears). */
function triangle(p0, p1, p2, r = 0) {
  const xs = [p0[0], p1[0], p2[0]];
  const ys = [p0[1], p1[1], p2[1]];
  return {
    box: [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r],
    d(x, y) {
      const e0 = [p1[0] - p0[0], p1[1] - p0[1]];
      const e1 = [p2[0] - p1[0], p2[1] - p1[1]];
      const e2 = [p0[0] - p2[0], p0[1] - p2[1]];
      const v0 = [x - p0[0], y - p0[1]];
      const v1 = [x - p1[0], y - p1[1]];
      const v2 = [x - p2[0], y - p2[1]];
      const proj = (v, e) => {
        const h = clamp((v[0] * e[0] + v[1] * e[1]) / (e[0] * e[0] + e[1] * e[1]), 0, 1);
        return [v[0] - e[0] * h, v[1] - e[1] * h];
      };
      const pq0 = proj(v0, e0);
      const pq1 = proj(v1, e1);
      const pq2 = proj(v2, e2);
      const s = Math.sign(e0[0] * e2[1] - e0[1] * e2[0]);
      const c0 = [pq0[0] ** 2 + pq0[1] ** 2, s * (v0[0] * e0[1] - v0[1] * e0[0])];
      const c1 = [pq1[0] ** 2 + pq1[1] ** 2, s * (v1[0] * e1[1] - v1[1] * e1[0])];
      const c2 = [pq2[0] ** 2 + pq2[1] ** 2, s * (v2[0] * e2[1] - v2[1] * e2[0])];
      const dist = Math.min(c0[0], c1[0], c2[0]);
      const side = Math.min(c0[1], c1[1], c2[1]);
      return -Math.sqrt(dist) * Math.sign(side) - r;
    },
  };
}

/** Polynomial smooth minimum: joins shapes with a fillet of size k. */
function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}

function union(parts, k) {
  return {
    box: parts.reduce(
      (box, part) => [
        Math.min(box[0], part.box[0]),
        Math.min(box[1], part.box[1]),
        Math.max(box[2], part.box[2]),
        Math.max(box[3], part.box[3]),
      ],
      [Infinity, Infinity, -Infinity, -Infinity],
    ),
    d(x, y) {
      let d = parts[0].d(x, y);
      for (let i = 1; i < parts.length; i++) d = smin(d, parts[i].d(x, y), k);
      return d;
    },
  };
}

/** Rotates a shape by `deg` about a pivot (a tilted head). */
function rotate(shape, deg, px, py) {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  const [x0, y0, x1, y1] = shape.box;
  const corners = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ].map(([x, y]) => [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c]);
  return {
    box: [
      Math.min(...corners.map((p) => p[0])),
      Math.min(...corners.map((p) => p[1])),
      Math.max(...corners.map((p) => p[0])),
      Math.max(...corners.map((p) => p[1])),
    ],
    // Inverse rotation of the sample point.
    d: (x, y) => shape.d(px + (x - px) * c + (y - py) * s, py - (x - px) * s + (y - py) * c),
  };
}

/** Long hair: soft rounded tufts on the outline, strongest at the sides. */
function fluffy(shape, amplitude, cx, cy) {
  return {
    box: shape.box.map((v, i) => (i < 2 ? v - amplitude : v + amplitude)),
    d(x, y) {
      const theta = Math.atan2(y - cy, x - cx);
      const tufts = (0.5 + 0.5 * Math.sin(theta * 13)) ** 2 * 0.7 + (0.5 + 0.5 * Math.sin(theta * 7 + 0.8)) ** 2 * 0.3;
      return shape.d(x, y) - amplitude * tufts * Math.abs(Math.cos(theta));
    },
  };
}

/** Cuts `cut` out of `shape` with a fillet of size k (the gap between the front paws). */
function subtract(shape, cut, k) {
  return {
    box: shape.box,
    d: (x, y) => -smin(-shape.d(x, y), cut.d(x, y), k),
  };
}

// ------------------------------------------------------------ the four suspects

/**
 * A seated cat facing the camera, in centimetres: x to the right, y up,
 * floor at y = 0, slot centre at x = 0. Every number is a nominal size;
 * the cat is then scaled so its ear tips reach `height`.
 */
function cat(spec) {
  const s = spec;
  const head = [
    ellipse(0, s.headY, s.headA, s.headB),
    ellipse(0, s.cheekY, s.cheekA, s.cheekB),
    // Ears: outer base, inner base, tip (left); mirrored for the right.
    triangle(s.ear[0], s.ear[1], s.ear[2], 0.25),
    triangle(mirror(s.ear[0]), mirror(s.ear[2]), mirror(s.ear[1]), 0.25),
    ...(s.tufts
      ? [
          capsule(s.ear[2][0], s.ear[2][1] - 0.4, 0.16, s.ear[2][0] - 0.1, s.ear[2][1] + s.tufts, 0.03),
          capsule(-s.ear[2][0], s.ear[2][1] - 0.4, 0.16, -s.ear[2][0] + 0.1, s.ear[2][1] + s.tufts, 0.03),
        ]
      : []),
  ];
  let headShape = union(head, 0.45);
  if (s.fluff) headShape = fluffy(headShape, s.fluff * 0.7, 0, s.cheekY);
  if (s.tilt) headShape = rotate(headShape, s.tilt, 0, s.neckY);

  let body = union(
    [
      ellipse(0, s.bodyY ?? s.bodyB, s.bodyA, s.bodyB),
      ellipse(0, s.chestY, s.chestA, s.chestB),
      ellipse(0, s.neckY, s.neckA, s.neckB),
      capsule(-s.legX, s.pawB, s.legR0, -s.legX * 0.94, s.legTop, s.legR1),
      capsule(s.legX, s.pawB, s.legR0, s.legX * 0.94, s.legTop, s.legR1),
      ellipse(-s.legX * 1.08, s.pawB, s.pawA, s.pawB),
      ellipse(s.legX * 1.08, s.pawB, s.pawA, s.pawB),
    ],
    0.8,
  );
  // The gap between the front paws, so they read as two.
  body = subtract(body, ellipse(0, 0, s.legX * 0.3, s.pawB * 1.35), 0.3);
  if (s.fluff) body = fluffy(body, s.fluff, 0, s.chestY * 0.7);

  const shape = union([body, headShape, chain(s.tail)], s.neckBlend ?? 0.5);
  return { shape, headA: Math.max(s.headA, s.cheekA), shadowA: s.bodyA * 1.12 };
}

const mirror = ([x, y]) => [-x, y];

/** Shared adult build, about 30 cm to the ear tips. */
const ADULT = {
  bodyY: 7.8,
  bodyA: 9.2,
  bodyB: 7.8,
  chestY: 14.2,
  chestA: 5.8,
  chestB: 6.4,
  neckY: 19.6,
  neckA: 3.8,
  neckB: 2.6,
  headY: 23.8,
  headA: 5.3,
  headB: 4.4,
  cheekY: 22.4,
  cheekA: 5.9,
  cheekB: 3.1,
  ear: [
    [-5.7, 23.9],
    [-1.6, 27.2],
    [-4.3, 30.4],
  ],
  legX: 2.5,
  legTop: 12.5,
  legR0: 1.35,
  legR1: 1.75,
  pawA: 1.9,
  pawB: 1.0,
  neckBlend: 0.6,
};

const SUSPECTS = {
  /** Long-haired torbie: a ruff, full cheeks, a bushy tail curled up on the left. */
  kira: {
    height: 30,
    ...ADULT,
    bodyA: 9.8,
    chestA: 6.8,
    chestB: 6.8,
    neckA: 4.6,
    cheekA: 6.5,
    cheekB: 3.5,
    fluff: 0.45,
    tilt: -4,
    neckBlend: 0.8,
    tail: [
      [-8.6, 2.0, 1.9],
      [-10.4, 3.2, 1.95],
      [-11.0, 5.6, 1.85],
      [-10.4, 8.0, 1.65],
      [-9.4, 9.2, 1.4],
    ],
  },
  /** The biggest, and a bit chubby: round haunches, tomcat jowls, a thick tail curled up on the right. */
  tom: {
    height: 31,
    ...ADULT,
    bodyY: 8.3,
    bodyA: 10.7,
    bodyB: 8.3,
    chestY: 14.8,
    chestA: 6.7,
    chestB: 6.6,
    neckA: 4.6,
    headA: 5.7,
    headB: 4.5,
    cheekA: 6.9,
    cheekB: 3.5,
    ear: [
      [-6.1, 23.7],
      [-1.9, 27.0],
      [-4.5, 29.8],
    ],
    tail: [
      [10.2, 1.6, 1.45],
      [11.9, 2.4, 1.4],
      [12.6, 4.2, 1.3],
      [12.2, 6.0, 1.2],
      [11.3, 6.9, 1.05],
    ],
  },
  /** Six months old: big head, big tufted ears, thin legs, tail up like a question mark. */
  dante: {
    height: 20,
    bodyY: 4.9,
    bodyA: 5.4,
    bodyB: 4.9,
    chestY: 8.9,
    chestA: 3.5,
    chestB: 4.2,
    neckY: 12.0,
    neckA: 2.4,
    neckB: 1.7,
    headY: 14.6,
    headA: 4.0,
    headB: 3.3,
    cheekY: 13.8,
    cheekA: 4.3,
    cheekB: 2.3,
    ear: [
      [-4.3, 14.6],
      [-1.2, 17.2],
      [-3.5, 19.6],
    ],
    tufts: 1.0,
    tilt: 9,
    legX: 1.55,
    legTop: 7.6,
    legR0: 0.85,
    legR1: 1.05,
    pawA: 1.25,
    pawB: 0.7,
    neckBlend: 0.4,
    tail: [
      [4.6, 1.8, 0.75],
      [6.4, 3.6, 0.7],
      [7.2, 6.6, 0.62],
      [6.7, 9.4, 0.55],
      [5.6, 10.8, 0.5],
    ],
  },
  /**
   * Ginger tabby, smaller than Kira and Tom and a little short in the leg:
   * the chest and head sit 1.4 cm lower on the front legs than the shared
   * build, so the haunches take more of him. The tail is a short stub at his
   * side. Subtle on purpose: a cat, not a caricature.
   */
  odin: {
    height: 27,
    ...ADULT,
    bodyY: 7.3,
    bodyA: 9.0,
    bodyB: 7.3,
    legTop: 10.9,
    chestY: 12.8,
    chestA: 5.7,
    chestB: 6.0,
    neckY: 18.2,
    headY: 22.4,
    cheekY: 21.0,
    // The ears' outer corners tuck inside the head, so the outline has no straight wall.
    ear: [
      [-5.0, 23.0],
      [-1.6, 25.8],
      [-4.1, 29.0],
    ],
    tilt: 4,
    tail: [
      [8.0, 2.3, 1.2],
      [9.2, 2.9, 1.0],
    ],
  },
};

// ------------------------------------------------------------ raster and files

function render(id) {
  const spec = SUSPECTS[id];
  const { shape, headA, shadowA } = cat(spec);
  // Scale so the ear tips (the top of the shape) reach the seated height.
  const nominalTop = topOf(shape);
  const k = spec.height / nominalTop;
  const shadow = ellipse(0, 0, shadowA, 1.1);

  const margin = 0.6; // cm of empty border around the cat and its shadow
  const [bx0, by0, bx1, by1] = shape.box;
  const x0 = Math.floor((Math.min(bx0, -shadowA) * k - margin) * PX_PER_CM);
  const x1 = Math.ceil((Math.max(bx1, shadowA) * k + margin) * PX_PER_CM);
  const yTop = Math.ceil((by1 * k + margin) * PX_PER_CM);
  const yBottom = Math.floor((Math.min(by0 * k, -1.1) - margin) * PX_PER_CM);
  const w = x1 - x0;
  const h = yTop - yBottom;

  const rgba = Buffer.alloc(w * h * 4);
  let headTop = h;
  for (let j = 0; j < h; j++) {
    const y = (yTop - j - 0.5) / PX_PER_CM / k;
    for (let i = 0; i < w; i++) {
      const x = (x0 + i + 0.5) / PX_PER_CM / k;
      const dPx = shape.d(x, y) * k * PX_PER_CM;
      const body = clamp(0.5 - dPx, 0, 1);
      // Contact shadow: densest at the paws, gone a centimetre out.
      const sd = shadow.d(x, y) * k;
      const shade = SHADOW_ALPHA * (1 - smoothstep(-0.9, 0.9, sd));
      const alpha = body + shade * (1 - body);
      if (body > 0.5 && j < headTop) headTop = j;
      const o = (j * w + i) * 4;
      rgba[o] = FILL[0];
      rgba[o + 1] = FILL[1];
      rgba[o + 2] = FILL[2];
      rgba[o + 3] = Math.round(alpha * 255);
    }
  }
  return {
    rgba,
    entry: {
      w,
      h,
      floorY: yTop,
      headTopY: headTop,
      centerX: -x0,
      headWidth: Math.round(2 * headA * k * PX_PER_CM),
    },
  };
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Highest y inside the shape, found by bisection on a column scan. */
function topOf(shape) {
  const [x0, , x1, y1] = shape.box;
  let top = -Infinity;
  for (let x = x0; x <= x1; x += 0.02) {
    let lo = 0;
    let hi = y1 + 1;
    if (shape.d(x, lo) > 0 && shape.d(x, y1 * 0.5) > 0) continue;
    // Walk down from above to the first inside sample, then refine.
    let y = hi;
    while (y > 0 && shape.d(x, y) > 0) y -= 0.05;
    if (y <= 0) continue;
    lo = y;
    hi = y + 0.05;
    for (let n = 0; n < 20; n++) {
      const mid = (lo + hi) / 2;
      if (shape.d(x, mid) > 0) hi = mid;
      else lo = mid;
    }
    top = Math.max(top, lo);
  }
  return top;
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.resolve(values.out);
mkdirSync(out, { recursive: true });
const work = mkdtempSync(path.join(tmpdir(), "suspects-"));
const encoder = path.join(path.dirname(new URL(import.meta.url).pathname), "encode.py");
const manifest = { pxPerCm: PX_PER_CM, cats: {} };

try {
  for (const id of Object.keys(SUSPECTS)) {
    const { rgba, entry } = render(id);
    const source = path.join(work, `${id}.png`);
    writeFileSync(source, png(entry.w, entry.h, rgba));
    execFileSync(process.env.PYTHON ?? "python3", [encoder, source, path.join(out, id)], { stdio: "inherit" });
    manifest.cats[id] = entry;
    const top = ((entry.floorY - entry.headTopY) / PX_PER_CM).toFixed(1);
    console.log(`${id}: ${entry.w}x${entry.h}px, head top ${top} cm`);
  }
  writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(path.join(out, "manifest.json"));
} finally {
  rmSync(work, { recursive: true, force: true });
}
