/**
 * The start menu's picture: the causeway at sunset, drawn once on the
 * server as SVG (Horizon.tsx) from this pure, deterministic geometry.
 *
 * One camera, one world, so every element has a believable size: a drone
 * shot from 14 m over the sea, beside a causeway that runs from under the
 * camera to the city on the horizon. Everything on the water is projected
 * with the same pinhole camera (`project`): x = vp + f·X/Z, y = horizon +
 * f·(camera height − Y)/Z, in metres (X right of the camera, Y up from the
 * water, Z ahead). So the road is a real band with both edges, its lane
 * marks and its parapets, converging to the vanishing point; the lamps
 * stand on its right parapet every 34 m and shrink with distance; each
 * lights a pool on the road and, past the deck's edge, its reflection on
 * the water; the palms framing the shot stand whole on a headland on
 * the right, their feet on its sand and their crowns above the city, and
 * the ones on the far islet are a few pixels tall, in two clumps, as they
 * would be at that distance. The sun and the city sit on the horizon, far
 * beyond the road; the sun is low on the left, so the lit faces and rims
 * are on that side.
 *
 * Two layouts, each its own viewBox, picked by media queries in CSS: `wide`
 * (landscape: the menu on the left over the sky, the road coming in
 * between the menu and the tip card) and `tall` (portrait: the sky above
 * the menu, the road running down under it).
 *
 * Coordinates are rounded to tenths so the markup stays small and the same
 * on every run (horizon.test.ts checks the rules above).
 */

export type HorizonLayoutName = "wide" | "tall";

export type HorizonLayout = {
  name: HorizonLayoutName;
  width: number;
  height: number;
  /** y of the horizon in the viewBox. */
  horizon: number;
  /** x of the vanishing point: where the road meets the horizon, at the city. */
  vp: number;
  /** Focal length in viewBox units. */
  focal: number;
  /** The road's left and right edges (the parapets' inner faces), in metres left of the camera. */
  road: { left: number; right: number };
  /** The camera's height over the water, in metres. */
  camera: number;
  sun: { x: number; r: number };
  moon: { x: number; y: number; r: number };
  city: { from: number; to: number; tallest: number };
  /** The far islet on the left of the sun: its ends and its height, in viewBox units. */
  islet: { from: number; to: number; height: number; distance: number };
  /** Palms on the shore: their foot in metres from the camera (X right, Z ahead), height, and lean (crown offset per metre of height). */
  palms: readonly { x: number; z: number; height: number; lean: number }[];
  /** The shore's waterline on the right, near to far, in metres (X right, Z ahead): the palms stand right of it. */
  shore: readonly { x: number; z: number }[];
  birds: { x: number; y: number; scale: number };
  stars: number;
  /** How far up the sun starts while the city loads (it sinks to its rest as the load completes). */
  sunRise: number;
  seed: number;
};

/** The causeway, in metres: deck surface and parapets over the water. */
export const CAUSEWAY = {
  /** Road surface over the water. */
  deck: 3,
  /** The deck slab's underside: below it, piers and water. */
  slab: 1.8,
  /** Parapet height over the road. */
  parapet: 1,
  /** Lamp spacing, and the first and last lamp's distance. */
  lampEvery: 34,
  lampFrom: 38,
  lampCount: 18,
  /** Lamp head height over the water and the arm's reach over the road. */
  lampHeight: 12.5,
  lampArm: 1.7,
  /** Where the road is drawn from and to. */
  near: 4,
  far: 20000,
} as const;

export const LAYOUTS: Record<HorizonLayoutName, HorizonLayout> = {
  wide: {
    name: "wide",
    width: 1600,
    height: 900,
    horizon: 567,
    vp: 1215,
    focal: 1100,
    road: { left: -16, right: -7 },
    camera: 14,
    sun: { x: 1090, r: 150 },
    // Below the top 80 units a phone on its side slices off.
    moon: { x: 700, y: 170, r: 12 },
    city: { from: 1168, to: 1560, tallest: 64 },
    islet: { from: 770, to: 930, height: 11, distance: 1800 },
    // Two palms on the headland at the right, 70 to 80 m out: whole, from their foot on the sand
    // (inside every window the wide layout fills) to their crowns, which stand above the city.
    palms: [
      { x: 24, z: 80, height: 23, lean: -0.07 },
      { x: 16.8, z: 68, height: 24, lean: -0.12 },
    ],
    shore: [
      { x: 6, z: 30 },
      { x: 9, z: 50 },
      { x: 12.5, z: 66 },
      { x: 18, z: 80 },
      { x: 40, z: 110 },
      { x: 120, z: 160 },
    ],
    birds: { x: 520, y: 210, scale: 1.1 },
    stars: 70,
    sunRise: 120,
    seed: 7,
  },
  tall: {
    name: "tall",
    width: 900,
    height: 1300,
    horizon: 700,
    vp: 640,
    focal: 900,
    road: { left: -11, right: -3 },
    camera: 14,
    sun: { x: 370, r: 190 },
    // Low over the islet: a short phone shows the tall picture only from about 400 units down.
    moon: { x: 150, y: 440, r: 14 },
    city: { from: 500, to: 905, tallest: 74 },
    islet: { from: -20, to: 190, height: 15, distance: 1400 },
    // The tall picture shows its whole width: two palms on the headland right of the road, 48 to
    // 60 m out, their crowns inside the right edge and above the city.
    palms: [
      { x: 12.4, z: 58, height: 23, lean: -0.06 },
      { x: 8.4, z: 48, height: 22, lean: -0.1 },
    ],
    shore: [
      { x: 3.5, z: 14 },
      { x: 5, z: 26 },
      { x: 6.5, z: 40 },
      { x: 8.5, z: 58 },
      { x: 14, z: 80 },
      { x: 24, z: 120 },
      // On toward the city: the coast it stands on.
      { x: 45, z: 220 },
      { x: 90, z: 420 },
    ],
    birds: { x: 250, y: 420, scale: 1 },
    stars: 60,
    sunRise: 150,
    seed: 11,
  },
};

/** A seeded generator (mulberry32), so every render draws the same picture. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tenths: small markup, the same on every run. */
export const r1 = (value: number) => Math.round(value * 10) / 10;

export type Point = { x: number; y: number };

/** Where a point in metres (X right, Y up from the water, Z ahead) lands in the viewBox. */
export function project(layout: HorizonLayout, x: number, y: number, z: number): Point {
  return {
    x: layout.vp + (layout.focal * x) / z,
    y: layout.horizon + (layout.focal * (layout.camera - y)) / z,
  };
}

const pt = (p: Point) => `${r1(p.x)} ${r1(p.y)}`;
const poly = (points: Point[]) => `M${points.map(pt).join("L")}Z`;

export type Lamp = {
  /** Its order from the camera: it lights as the load passes it. */
  index: number;
  z: number;
  /** Pole and arm, one stroke. */
  pole: string;
  poleWidth: number;
  head: { x: number; y: number; rx: number; ry: number };
  glow: number;
  /** The light on the road under it. */
  pool: { x: number; y: number; rx: number; ry: number };
  /** Its streak on the water right of the deck; null where the deck hides it or it falls off the picture. */
  reflection: { x: number; y: number; width: number; height: number } | null;
};

export type Palm = {
  /** Its distance: the far one is drawn first and lighter, in the haze. */
  z: number;
  trunk: string;
  rim: string;
  crown: { x: number; y: number };
  /** Each frond's midrib, a filled taper; its leaflets, one stroke each, `width` wide. */
  spines: string;
  leaflets: string;
  width: number;
  nuts: { x: number; y: number; r: number }[];
  /** The palm's foot on the sand, and its crown's extent (leaflet tips included). */
  base: Point;
  top: number;
  left: number;
  right: number;
};

export type HorizonScene = {
  layout: HorizonLayout;
  stars: { x: number; y: number; r: number; o: number; twinkle: boolean; delay: number; dur: number }[];
  moon: string;
  clouds: { cx: number; cy: number; rx: number; ry: number; o: number; dim: boolean }[];
  /** The windows are one path of small squares, lit once the city is in. */
  city: { skyline: string; windows: string; tops: number[] };
  /** The islet's palms (strokes), in two clumps, and its low bushes. */
  islet: { land: string; palms: string[]; bushes: { cx: number; cy: number; rx: number; ry: number }[]; tallest: number };
  glitter: { x: number; y: number; w: number; h: number; o: number; dur: number; delay: number }[];
  swells: { x: number; y: number; w: number; h: number; o: number; dur: number; delay: number }[];
  road: {
    surface: string;
    leftParapet: string;
    rightParapet: string;
    leftTop: string;
    rightTop: string;
    fascia: string;
    piers: string[];
    edgeLines: string[];
    dashes: string[];
    /** The near end of the edges, at the bottom of the picture, and the vanishing point. */
    nearLeft: Point;
    nearRight: Point;
  };
  lamps: Lamp[];
  palms: Palm[];
  /** The headland: its land, the lit sand along its waterline, and the grass at the palms' feet. */
  shore: { land: string; sand: string; grass: string };
  birds: { d: string; width: number; delay: number }[];
};

/** The depth at which the road surface meets the bottom of the picture (a little past it). */
function nearDepth(layout: HorizonLayout): number {
  const below = layout.height + 40 - layout.horizon;
  return Math.max(CAUSEWAY.near, (layout.focal * (layout.camera - CAUSEWAY.deck)) / below);
}

function roadOf(layout: HorizonLayout): HorizonScene["road"] {
  const { deck, slab, parapet, far } = CAUSEWAY;
  const { left, right } = layout.road;
  const near = nearDepth(layout);
  const P = (x: number, y: number, z: number) => project(layout, x, y, z);
  const surface = poly([P(left, deck, near), P(left, deck, far), P(right, deck, far), P(right, deck, near)]);
  // Parapets: the left one's inner face (it faces the camera), the right one's outer face, both 1 m.
  const top = deck + parapet;
  const leftParapet = poly([P(left, deck, near), P(left, top, near), P(left, top, far), P(left, deck, far)]);
  const rightParapet = poly([P(right, deck, near), P(right, top, near), P(right, top, far), P(right, deck, far)]);
  const line = (x: number, y: number, width: number) => poly([P(x, y, near), P(x, y, far), P(x + width, y, far), P(x + width, y, near)]);
  // The sun-side rim along each parapet's top, a hand's width.
  const leftTop = poly([P(left - 0.25, top, near), P(left - 0.25, top, far), P(left, top, far), P(left, top, near)]);
  const rightTop = poly([P(right, top, near), P(right, top, far), P(right + 0.25, top, far), P(right + 0.25, top, near)]);
  // The deck slab's edge on the camera's side, and the piers under it.
  const fascia = poly([P(right + 0.25, top, near), P(right + 0.25, top, far), P(right + 0.25, slab, far), P(right + 0.25, slab, near)]);
  const piers: string[] = [];
  for (let z = 30; z < 1400; z += 30) {
    if (z < near) continue;
    const a = P(right - 0.4, slab, z);
    const b = P(right - 0.4, 0, z);
    const half = (layout.focal * 0.7) / z;
    if (half < 0.3) break;
    piers.push(poly([{ x: a.x - half, y: a.y }, { x: a.x + half, y: a.y }, { x: b.x + half, y: b.y }, { x: b.x - half, y: b.y }]));
  }
  // Solid edge lines 0.15 m wide, 0.5 m in from each parapet; a dashed centre line, 3 m on, 9 m off.
  const edgeLines = [line(left + 0.5, deck, 0.15), line(right - 0.65, deck, 0.15)];
  const dashes: string[] = [];
  const centre = (left + right) / 2;
  for (let z = Math.ceil(near / 12) * 12; z < 900; z += 12) {
    const a = P(centre, deck, z);
    const b = P(centre, deck, z + 3);
    if (a.y - b.y < 0.35) break;
    dashes.push(poly([P(centre - 0.08, deck, z), P(centre - 0.08, deck, z + 3), P(centre + 0.08, deck, z + 3), P(centre + 0.08, deck, z)]));
  }
  return {
    surface,
    leftParapet,
    rightParapet,
    leftTop,
    rightTop,
    fascia,
    piers,
    edgeLines,
    dashes,
    nearLeft: P(left, deck, near),
    nearRight: P(right, deck, near),
  };
}

function lampsOf(layout: HorizonLayout): Lamp[] {
  const { deck, parapet, lampEvery, lampFrom, lampCount, lampHeight, lampArm, slab } = CAUSEWAY;
  const { right } = layout.road;
  const lamps: Lamp[] = [];
  const P = (x: number, y: number, z: number) => project(layout, x, y, z);
  for (let index = 0; index < lampCount; index += 1) {
    const z = lampFrom + index * lampEvery;
    const base = P(right + 0.15, deck + parapet, z);
    const top = P(right + 0.15, lampHeight + 0.3, z);
    const elbow = P(right - lampArm * 0.35, lampHeight + 0.45, z);
    const tip = P(right - lampArm, lampHeight, z);
    const k = layout.focal / z;
    const pole = `M${pt(base)}L${pt(top)}Q${pt(elbow)} ${pt(tip)}`;
    const head = { x: r1(tip.x), y: r1(tip.y + 0.12 * k), rx: r1(Math.max(0.8, 0.42 * k)), ry: r1(Math.max(0.5, 0.17 * k)) };
    // The pool: about 9 m across and 12 m long on the road under the head.
    const poolCentre = P(right - lampArm - 1, deck, z);
    const poolNear = P(right - lampArm - 1, deck, z - 6);
    const poolFar = P(right - lampArm - 1, deck, z + 6);
    const pool = { x: r1(poolCentre.x), y: r1(poolCentre.y), rx: r1((layout.focal * 4.5) / z), ry: r1((poolNear.y - poolFar.y) / 2) };
    // Its mirror image under the water, stretched by the swell: visible only right of the deck's edge.
    const mirror = P(right - lampArm, -lampHeight, z);
    let reflection: Lamp["reflection"] = null;
    if (mirror.y < layout.height) {
      // Where the deck's edge (its slab on the water side) is at that height on the picture.
      const depth = (layout.focal * (layout.camera - slab)) / (mirror.y - layout.horizon);
      const edge = P(right + 0.25, slab, depth).x;
      const width = Math.max(1, 0.9 * k);
      if (mirror.x - width > edge + 2) {
        const height = Math.min(layout.height - mirror.y, Math.max(6, 7 * k));
        reflection = { x: r1(mirror.x - width / 2), y: r1(mirror.y - height * 0.3), width: r1(width), height: r1(height) };
      }
    }
    lamps.push({
      index,
      z,
      pole,
      poleWidth: r1(Math.max(0.7, 0.24 * k)),
      head,
      glow: r1(Math.max(3, 2.6 * k)),
      pool,
      reflection,
    });
  }
  return lamps;
}

/** A point on a quadratic curve, and its heading. */
function onCurve(a: Point, c: Point, b: Point, t: number): { p: Point; heading: number } {
  const u = 1 - t;
  const p = { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  const dx = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x);
  const dy = 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y);
  return { p, heading: Math.atan2(dy, dx) };
}

/**
 * A coconut palm on the shore, sized in metres at its distance: a curved,
 * tapering trunk, and a crown of nine pinnate fronds about 4 to 5 m long,
 * each a solid midrib arching out and drooping, with long leaflets that
 * point toward its tip and hang a little (the hero's palms, palmGeometry.ts,
 * seen as a silhouette), and a few coconuts under them.
 */
function palmOf(layout: HorizonLayout, spec: HorizonLayout["palms"][number], random: () => number): Palm {
  const base = project(layout, spec.x, 0.3, spec.z);
  const crownWorld = { x: spec.x + spec.lean * spec.height, y: spec.height };
  const crown = project(layout, crownWorld.x, crownWorld.y, spec.z);
  const k = layout.focal / spec.z;
  const bend = project(layout, spec.x + spec.lean * spec.height * 0.25, spec.height * 0.55, spec.z);
  const w0 = 0.5 * k;
  const w1 = 0.28 * k;
  const steps = 18;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const { p, heading } = onCurve(base, bend, crown, t);
    const nx = -Math.sin(heading);
    const ny = Math.cos(heading);
    // A little flare at the foot, a slight swelling of the rings along it.
    const w = ((w0 + (w1 - w0) * t) / 2) * (1 + 0.35 * Math.max(0, 1 - t * 8)) * (1 + 0.05 * Math.sin(t * 50));
    left.push({ x: p.x + nx * w, y: p.y + ny * w });
    right.push({ x: p.x - nx * w, y: p.y - ny * w });
  }
  const trunk = `M${left.map(pt).join("L")}L${[...right].reverse().map(pt).join("L")}Z`;
  // The sun is low on the left: a lit rim down the trunk's left side.
  const rim = `M${(left[0].x < right[0].x ? left : right).slice(2).map(pt).join("L")}`;

  let spines = "";
  let leaflets = "";
  let top = crown.y;
  let minX = crown.x;
  let maxX = crown.x;
  const reach = (p: Point) => {
    top = Math.min(top, p.y);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  };
  const count = 9;
  for (let i = 0; i < count; i += 1) {
    // Spread round the crown, none straight up; the side ones longest and drooping most.
    const angle = -Math.PI / 2 + (i / (count - 1) - 0.5) * Math.PI * 1.75 + (random() - 0.5) * 0.22;
    const side = Math.abs(Math.cos(angle));
    const length = (4 + random() * 0.8) * k * (0.78 + 0.22 * side);
    const droop = 0.25 + side * 0.75;
    const end = {
      x: crown.x + Math.cos(angle) * length * (0.92 - droop * 0.12),
      y: crown.y + Math.sin(angle) * length * 0.55 + length * droop * 0.62,
    };
    const ctrl = { x: crown.x + Math.cos(angle) * length * 0.6, y: crown.y + Math.sin(angle) * length * 0.7 - length * 0.12 };
    // The midrib: as thick as a wrist at the crown, to nothing at the tip.
    const sideA: Point[] = [];
    const sideB: Point[] = [];
    for (let j = 0; j <= 10; j += 1) {
      const t = j / 10;
      const { p, heading } = onCurve(crown, ctrl, end, t);
      const half = Math.max(0.35, 0.09 * k * (1 - t * 0.9));
      sideA.push({ x: p.x - Math.sin(heading) * half, y: p.y + Math.cos(heading) * half });
      sideB.push({ x: p.x + Math.sin(heading) * half, y: p.y - Math.cos(heading) * half });
      reach(p);
    }
    spines += `M${sideA.map(pt).join("L")}L${[...sideB].reverse().map(pt).join("L")}Z`;
    // Leaflets: eleven a side, longest mid-frond, pointing toward its tip and hanging under it.
    const pairs = 11;
    for (let j = 0; j < pairs; j += 1) {
      const t = 0.12 + (j / (pairs - 1)) * 0.84;
      const { p, heading } = onCurve(crown, ctrl, end, t);
      const leaf = length * 0.24 * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * t)), 0.6) * (0.88 + random() * 0.24);
      for (const sign of [-1, 1]) {
        const dir = heading + sign * 0.62;
        let vx = Math.cos(dir);
        let vy = Math.sin(dir) + 0.5;
        const norm = Math.hypot(vx, vy) || 1;
        vx /= norm;
        vy /= norm;
        const tip = { x: p.x + vx * leaf, y: p.y + vy * leaf };
        const mid = { x: p.x + vx * leaf * 0.5, y: p.y + vy * leaf * 0.5 - leaf * 0.1 };
        leaflets += `M${pt(p)}Q${pt(mid)} ${pt(tip)}`;
        reach(tip);
      }
    }
  }
  const nuts = [
    { x: crown.x - 0.22 * k, y: crown.y + 0.3 * k },
    { x: crown.x + 0.18 * k, y: crown.y + 0.34 * k },
    { x: crown.x - 0.02 * k, y: crown.y + 0.48 * k },
  ].map((nut) => ({ x: r1(nut.x), y: r1(nut.y), r: r1(Math.max(0.8, 0.17 * k)) }));
  return {
    z: spec.z,
    trunk,
    rim,
    crown: { x: r1(crown.x), y: r1(crown.y) },
    spines,
    leaflets,
    width: r1(Math.max(1, 0.1 * k)),
    nuts,
    base: { x: r1(base.x), y: r1(base.y) },
    top: r1(top),
    left: r1(minX),
    right: r1(maxX),
  };
}

/**
 * A palm a few pixels tall on the far islet: the same tree at its distance,
 * a leaning, curving trunk and six fronds drooping from its crown.
 */
function tinyPalm(x: number, groundY: number, height: number, lean: number, random: () => number): string {
  const cx = x + lean * height;
  const cy = groundY - height;
  let d = `M${r1(x)} ${r1(groundY)}Q${r1(x + lean * height * 0.15)} ${r1(groundY - height * 0.6)} ${r1(cx)} ${r1(cy)}`;
  const reach = height * 0.48;
  for (const angle of [-2.95, -2.35, -1.85, -1.3, -0.75, -0.2]) {
    const a = angle + (random() - 0.5) * 0.25;
    const side = Math.abs(Math.cos(a));
    const end = { x: cx + Math.cos(a) * reach, y: cy + Math.sin(a) * reach * 0.45 + reach * (0.2 + side * 0.5) };
    const ctrl = { x: cx + Math.cos(a) * reach * 0.55, y: cy + Math.sin(a) * reach * 0.65 - reach * 0.18 };
    d += `M${r1(cx)} ${r1(cy)}Q${r1(ctrl.x)} ${r1(ctrl.y)} ${r1(end.x)} ${r1(end.y)}`;
  }
  return d;
}

/** The islet's palms in two clumps (where on the islet, height, lean), and its bushes (where, size). */
const ISLET_PALMS = [
  { t: 0.28, height: 1, lean: 0.22 },
  { t: 0.335, height: 0.72, lean: -0.3 },
  { t: 0.58, height: 0.86, lean: -0.2 },
  { t: 0.625, height: 1.1, lean: 0.12 },
  { t: 0.68, height: 0.62, lean: 0.34 },
] as const;
const ISLET_BUSHES = [
  { t: 0.45, size: 0.5 },
  { t: 0.73, size: 0.38 },
  { t: 0.21, size: 0.32 },
] as const;

export function buildHorizon(layout: HorizonLayout): HorizonScene {
  const random = seeded(layout.seed);
  const { width: W, horizon: hy } = layout;

  const stars: HorizonScene["stars"] = [];
  for (let i = 0; i < layout.stars; i += 1) {
    const y = Math.pow(random(), 1.8) * hy * 0.5;
    const x = random() * W;
    const r = random() < 0.1 ? 1.4 : 0.8;
    const twinkle = random() < 0.4;
    stars.push({ x: r1(x), y: r1(y), r, o: r1((1 - y / (hy * 0.5)) * 0.8 * 100) / 100, twinkle, dur: r1(2 + random() * 4), delay: r1(-random() * 4) });
  }

  const { x: mx, y: my, r: mr } = layout.moon;
  // A thin crescent, lit on the side of the sun below it.
  const moon = `M${r1(mx)} ${r1(my - mr)}A${mr} ${mr} 0 1 0 ${r1(mx)} ${r1(my + mr)}A${r1(mr * 1.3)} ${r1(mr * 1.3)} 0 0 1 ${r1(mx)} ${r1(my - mr)}Z`;

  const clouds: HorizonScene["clouds"] = [
    { cx: 0.7, cy: 0.6, rx: 0.32, ry: 0.012, o: 0.95, dim: false },
    { cx: 0.52, cy: 0.67, rx: 0.22, ry: 0.008, o: 0.85, dim: false },
    { cx: 0.86, cy: 0.75, rx: 0.2, ry: 0.01, o: 0.9, dim: false },
    { cx: 0.3, cy: 0.5, rx: 0.3, ry: 0.012, o: 0.8, dim: true },
    { cx: 0.62, cy: 0.82, rx: 0.34, ry: 0.006, o: 0.75, dim: false },
    { cx: 0.2, cy: 0.78, rx: 0.18, ry: 0.007, o: 0.6, dim: false },
    { cx: 0.48, cy: 0.38, rx: 0.26, ry: 0.007, o: 0.6, dim: true },
  ].map((c) => ({ cx: r1(c.cx * W), cy: r1(c.cy * hy), rx: r1(c.rx * W), ry: r1(Math.max(1.5, c.ry * hy)), o: c.o, dim: c.dim }));

  // The city on the horizon, kilometres away: towers up to `tallest`, highest in the middle.
  const { from, to, tallest } = layout.city;
  let skyline = `M${r1(from - 30)} ${hy}`;
  let windows = "";
  const tops: number[] = [];
  for (let x = from; x < to; ) {
    const w = 6 + random() * 14;
    const h = 10 + Math.pow(random(), 2) * (tallest - 10);
    const mid = 1 - Math.abs((x - (from + to) / 2) / ((to - from) / 2));
    const hh = Math.min(tallest, h * (0.55 + mid * 0.7));
    tops.push(r1(hy - hh));
    skyline += `L${r1(x)} ${r1(hy - hh)}L${r1(x + w)} ${r1(hy - hh)}`;
    if (random() < 0.15) skyline += `L${r1(x + w / 2)} ${r1(hy - hh - 6 - random() * 8)}L${r1(x + w)} ${r1(hy - hh)}`;
    for (let wy = hy - hh + 4; wy < hy - 3; wy += 4) {
      for (let wx = x + 2; wx < x + w - 1; wx += 3) if (random() < 0.2) windows += `M${r1(wx)} ${r1(wy)}h1.2v1.4h-1.2z`;
    }
    x += w + random() * 3;
  }
  skyline += `L${r1(to + 30)} ${hy}Z`;

  // The islet: a low hump on the left of the sun, its palms at their size for its distance.
  const { from: ix0, to: ix1, height: ih, distance } = layout.islet;
  const hump = [
    { x: ix0, y: hy },
    { x: ix0 + (ix1 - ix0) * 0.2, y: hy - ih },
    { x: ix0 + (ix1 - ix0) * 0.75, y: hy - ih * 1.1 },
    { x: ix1, y: hy },
  ];
  const land = `M${pt(hump[0])}C${pt(hump[1])} ${pt(hump[2])} ${pt(hump[3])}Z`;
  // A point on the hump's outline, t from its left end to its right.
  const onHump = (t: number): Point => {
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return { x: w.reduce((sum, wi, i) => sum + wi * hump[i].x, 0), y: w.reduce((sum, wi, i) => sum + wi * hump[i].y, 0) };
  };
  const palmHeight = (layout.focal * 15) / distance;
  const isletPalms = ISLET_PALMS.map((palm) => {
    const foot = onHump(palm.t + (random() - 0.5) * 0.015);
    return tinyPalm(foot.x, foot.y + 0.8, palmHeight * palm.height, palm.lean, random);
  });
  // Each bush a few lumps sunk into the ground, never a pill on top of it.
  const bushes = ISLET_BUSHES.flatMap((bush) => {
    const foot = onHump(bush.t);
    const r = palmHeight * bush.size;
    return [
      { dx: -0.7, r: 0.65 },
      { dx: 0, r: 0.85 },
      { dx: 0.75, r: 0.55 },
    ].map((lump) => ({ cx: r1(foot.x + lump.dx * r), cy: r1(foot.y + r * lump.r * 0.45), rx: r1(r * lump.r), ry: r1(r * lump.r * 0.8) }));
  });

  // The sun's road on the water: short bright strokes, widening toward the camera.
  const glitter: HorizonScene["glitter"] = [];
  const sunR = layout.sun.r;
  for (let i = 0; i < 36; i += 1) {
    const t = i / 36;
    const y = hy + 3 + Math.pow(t, 1.6) * (layout.height - hy) * 0.75;
    const w = sunR * (0.5 + t * 1.4) * (0.3 + random() * 0.9);
    const x = layout.sun.x + (random() - 0.5) * sunR * (0.4 + t * 1.2) - w / 2;
    glitter.push({ x: r1(x), y: r1(y), w: r1(w), h: r1(1 + t * 2.4), o: r1(0.6 * (1 - t * 0.6) * 100) / 100, dur: r1(1.8 + random() * 2.5), delay: r1(-random() * 3) });
  }
  const swells: HorizonScene["swells"] = [];
  for (let i = 0; i < 16; i += 1) {
    const t = random();
    const y = hy + 6 + Math.pow(t, 1.4) * (layout.height - hy);
    swells.push({ x: r1(random() * W - 100), y: r1(y), w: r1(80 + random() * 300 * (0.3 + t)), h: r1(0.8 + t * 1.4), o: r1((0.06 + 0.14 * (1 - t)) * 100) / 100, dur: r1(3 + random() * 4), delay: r1(-random() * 5) });
  }

  const road = roadOf(layout);
  const lamps = lampsOf(layout);
  // Far first: the nearer palm is drawn over the farther one.
  const palms = [...layout.palms].sort((a, b) => b.z - a.z).map((spec) => palmOf(layout, spec, random));

  // The headland the palms stand on, at the right: its waterline curving away from the camera.
  const water = layout.shore.map((point) => project(layout, point.x, 0.2, point.z));
  const corner = { x: layout.width + 400, y: layout.height + 400 };
  let line = `M${pt(water[0])}`;
  for (let i = 1; i < water.length; i += 1) {
    const mid = { x: (water[i - 1].x + water[i].x) / 2, y: (water[i - 1].y + water[i].y) / 2 };
    line += `Q${pt(water[i - 1])} ${pt(mid)}`;
  }
  line += `L${pt(water[water.length - 1])}`;
  // Past its last point the coast runs straight on to its vanishing point on the horizon, and the
  // ground right of it reaches the horizon: land seen to its end, never a wall with a top edge.
  const [before, last] = layout.shore.slice(-2);
  const vanish = { x: layout.vp + (layout.focal * (last.x - before.x)) / (last.z - before.z), y: hy };
  const shoreLand = `${line}L${pt(vanish)}L${pt({ x: corner.x, y: hy })}L${pt(corner)}L${pt({ x: water[0].x, y: corner.y })}Z`;
  // Grass at each palm's foot: a few blades, as tall as a knee at that distance.
  let grass = "";
  for (const palm of palms) {
    const k = layout.focal / palm.z;
    for (let i = 0; i < 7; i += 1) {
      const x = palm.base.x + (i - 3) * 0.45 * k + (random() - 0.5) * 0.3 * k;
      const h = (0.5 + random() * 0.5) * k;
      const tilt = (i - 3) * 0.12 * k + (random() - 0.5) * 0.2 * k;
      grass += `M${r1(x - 0.07 * k)} ${r1(palm.base.y + 0.2 * k)}Q${r1(x + tilt * 0.3)} ${r1(palm.base.y - h * 0.6)} ${r1(x + tilt)} ${r1(palm.base.y - h)}L${r1(x + 0.07 * k)} ${r1(palm.base.y + 0.2 * k)}Z`;
    }
  }
  const shore = { land: shoreLand, sand: line, grass };

  const birds: HorizonScene["birds"] = [];
  const flock = [
    [0, 0, 1],
    [26, 10, 0.8],
    [48, -6, 0.9],
    [70, 14, 0.7],
    [-24, 16, 0.75],
    [92, 2, 0.6],
  ];
  for (const [dx, dy, size] of flock) {
    const s = size * layout.birds.scale;
    const x = layout.birds.x + dx;
    const y = layout.birds.y + dy;
    birds.push({
      d: `M${r1(x - 8 * s)} ${r1(y)}Q${r1(x - 4 * s)} ${r1(y - 4.5 * s)} ${r1(x)} ${r1(y)}Q${r1(x + 4 * s)} ${r1(y - 4.5 * s)} ${r1(x + 8 * s)} ${r1(y)}`,
      width: r1(1.6 * s),
      delay: r1(-random()),
    });
  }

  return {
    layout,
    stars,
    moon,
    clouds,
    city: { skyline, windows, tops },
    islet: { land, palms: isletPalms, bushes, tallest: r1(palmHeight * 1.1) },
    glitter,
    swells,
    road,
    lamps,
    palms,
    shore,
    birds,
  };
}
