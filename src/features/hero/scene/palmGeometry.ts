import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { createRandom } from "./world";

/**
 * Procedural palm built for a silhouette read: a curved, ringed trunk, a
 * crown of pinnate fronds whose leaflets hang in a V from the rachis, a few
 * dead fronds hanging under the crown and a coconut cluster. Base at y = 0,
 * real size in metres.
 *
 * Attributes for the palm shader (all in [0, 1]):
 * - aSway: how far the wind moves the vertex (trunk base 0, frond tips 1);
 * - aShade: dark trunk base to lighter frond tips (silhouette gradient);
 * - aFlutter: leaflet tips flutter, rachis and trunk do not.
 */
export type PalmShape = {
  seed: number;
  /** Trunk height in metres. */
  height: number;
  /** Horizontal offset of the crown from the base, in metres. */
  bend: number;
  fronds: number;
  /** Rachis length of an average frond, in metres. */
  frondLength: number;
};

/** A palm that stays put (city promenade): base position, yaw, scale and shape index. */
export type StaticPalm = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  variant: number;
};

/** Four silhouettes: tall and straight, tall and leaning, medium, short and full. */
export const PALM_SHAPES: readonly PalmShape[] = [
  { seed: 11, height: 12.5, bend: 0.8, fronds: 16, frondLength: 4.2 },
  { seed: 23, height: 11.5, bend: 2.6, fronds: 15, frondLength: 4.0 },
  { seed: 37, height: 9.5, bend: 1.4, fronds: 17, frondLength: 3.8 },
  { seed: 51, height: 8.0, bend: 0.5, fronds: 18, frondLength: 3.6 },
];

const TRUNK_SIDES = 7;
const TRUNK_SEGMENTS = 26;
const RACHIS_SEGMENTS = 12;
const LEAFLETS_PER_SIDE = 28;
const DEAD_FRONDS = 3;

type Vertex = { p: Vector3; sway: number; shade: number; flutter: number };

class TriangleSoup {
  positions: number[] = [];
  sway: number[] = [];
  shade: number[] = [];
  flutter: number[] = [];

  tri(a: Vertex, b: Vertex, c: Vertex) {
    for (const v of [a, b, c]) {
      this.positions.push(v.p.x, v.p.y, v.p.z);
      this.sway.push(v.sway);
      this.shade.push(v.shade);
      this.flutter.push(v.flutter);
    }
  }

  quad(a: Vertex, b: Vertex, c: Vertex, d: Vertex) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  toGeometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute("aSway", new BufferAttribute(new Float32Array(this.sway), 1));
    geometry.setAttribute("aShade", new BufferAttribute(new Float32Array(this.shade), 1));
    geometry.setAttribute("aFlutter", new BufferAttribute(new Float32Array(this.flutter), 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

const UP = new Vector3(0, 1, 0);

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Point on the trunk spine at t in [0, 1]: the lean grows toward the top. */
function spine(shape: PalmShape, heading: Vector3, t: number) {
  return new Vector3(0, t * shape.height, 0).addScaledVector(heading, shape.bend * Math.pow(t, 1.7));
}

function addTrunk(soup: TriangleSoup, shape: PalmShape, heading: Vector3) {
  const rings: Vertex[][] = [];
  for (let s = 0; s <= TRUNK_SEGMENTS; s++) {
    const t = s / TRUNK_SEGMENTS;
    const centre = spine(shape, heading, t);
    // Taper, a flared foot and the leaf-scar rings of a real trunk.
    const ringPhase = (t * shape.height) / 0.42;
    const ridge = 1 + 0.07 * (ringPhase - Math.floor(ringPhase));
    const radius = (0.34 + (0.17 - 0.34) * t + 0.16 * (1 - smoothstep(0, 0.08, t))) * ridge;
    const ring: Vertex[] = [];
    for (let k = 0; k < TRUNK_SIDES; k++) {
      const angle = (k / TRUNK_SIDES) * Math.PI * 2;
      const p = centre.clone().add(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      ring.push({ p, sway: 0.3 * t * t, shade: 0.45 * t, flutter: 0 });
    }
    rings.push(ring);
  }
  for (let s = 0; s < TRUNK_SEGMENTS; s++) {
    for (let k = 0; k < TRUNK_SIDES; k++) {
      const next = (k + 1) % TRUNK_SIDES;
      soup.quad(rings[s][k], rings[s][next], rings[s + 1][next], rings[s + 1][k]);
    }
  }
}

/** Crownshaft bulb and coconuts just under the fronds. */
function addCrown(soup: TriangleSoup, top: Vector3, random: () => number) {
  const sway = 0.3;
  const bulb = [
    { y: -0.55, r: 0.2 },
    { y: -0.1, r: 0.32 },
    { y: 0.35, r: 0.22 },
    { y: 0.6, r: 0.05 },
  ];
  const rings = bulb.map(({ y, r }) =>
    Array.from({ length: TRUNK_SIDES }, (_, k) => {
      const angle = (k / TRUNK_SIDES) * Math.PI * 2;
      const p = top.clone().add(new Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
      return { p, sway, shade: 0.5, flutter: 0 };
    }),
  );
  for (let s = 0; s < rings.length - 1; s++) {
    for (let k = 0; k < TRUNK_SIDES; k++) {
      const next = (k + 1) % TRUNK_SIDES;
      soup.quad(rings[s][k], rings[s][next], rings[s + 1][next], rings[s + 1][k]);
    }
  }
  // Coconuts: small octahedra in a ring under the crown.
  const count = 4 + Math.floor(random() * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + random() * 0.4;
    const centre = top.clone().add(new Vector3(Math.cos(angle) * 0.3, -0.35 - random() * 0.15, Math.sin(angle) * 0.3));
    const r = 0.13;
    const tips = [
      new Vector3(r, 0, 0),
      new Vector3(0, 0, r),
      new Vector3(-r, 0, 0),
      new Vector3(0, 0, -r),
    ].map((d) => ({ p: centre.clone().add(d), sway, shade: 0.4, flutter: 0 }));
    const north = { p: centre.clone().add(new Vector3(0, r, 0)), sway, shade: 0.4, flutter: 0 };
    const south = { p: centre.clone().add(new Vector3(0, -r, 0)), sway, shade: 0.4, flutter: 0 };
    for (let k = 0; k < 4; k++) {
      soup.tri(tips[k], tips[(k + 1) % 4], north);
      soup.tri(tips[(k + 1) % 4], tips[k], south);
    }
  }
}

type FrondOptions = {
  azimuth: number;
  /** Initial pitch of the rachis in radians (positive rises). */
  pitch: number;
  /** Total downward curve along the rachis, in radians. */
  droop: number;
  length: number;
  /** Leaflet hang below the frond plane, in radians (the V of the frond). */
  hang: number;
  shade: number;
};

function addFrond(soup: TriangleSoup, top: Vector3, options: FrondOptions, random: () => number) {
  const heading = new Vector3(Math.cos(options.azimuth), 0, Math.sin(options.azimuth));
  // Rachis polyline with its local frame at every point.
  const points: Array<{ p: Vector3; dir: Vector3; side: Vector3; up: Vector3; t: number }> = [];
  let pitch = options.pitch;
  const p = top.clone().addScaledVector(heading, 0.15);
  const step = options.length / RACHIS_SEGMENTS;
  for (let k = 0; k <= RACHIS_SEGMENTS; k++) {
    const dir = heading.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch)).normalize();
    const side = new Vector3().crossVectors(dir, UP).normalize();
    const up = new Vector3().crossVectors(side, dir).normalize();
    points.push({ p: p.clone(), dir, side, up, t: k / RACHIS_SEGMENTS });
    p.addScaledVector(dir, step);
    pitch -= options.droop / RACHIS_SEGMENTS;
  }
  const sway = (t: number) => 0.35 + 0.65 * t;
  const shade = (t: number) => options.shade * (0.6 + 0.4 * t);

  // Rachis: a thin ribbon facing up.
  for (let k = 0; k < RACHIS_SEGMENTS; k++) {
    const a = points[k];
    const b = points[k + 1];
    const wa = 0.05 * (1 - a.t * 0.7);
    const wb = 0.05 * (1 - b.t * 0.7);
    soup.quad(
      { p: a.p.clone().addScaledVector(a.side, -wa), sway: sway(a.t), shade: shade(a.t), flutter: 0 },
      { p: a.p.clone().addScaledVector(a.side, wa), sway: sway(a.t), shade: shade(a.t), flutter: 0 },
      { p: b.p.clone().addScaledVector(b.side, wb), sway: sway(b.t), shade: shade(b.t), flutter: 0 },
      { p: b.p.clone().addScaledVector(b.side, -wb), sway: sway(b.t), shade: shade(b.t), flutter: 0 },
    );
  }

  // Leaflets: thin triangles on both sides, longest near the middle of the
  // frond, angled toward the tip and hanging below the frond plane.
  const maxLeaflet = options.length * 0.27;
  for (let j = 0; j < LEAFLETS_PER_SIDE; j++) {
    const t = 0.06 + (j / (LEAFLETS_PER_SIDE - 1)) * 0.92;
    const f = t * RACHIS_SEGMENTS;
    const k = Math.min(RACHIS_SEGMENTS - 1, Math.floor(f));
    const a = points[k];
    const b = points[k + 1];
    const mix = f - k;
    const base = a.p.clone().lerp(b.p, mix);
    const dir = a.dir.clone().lerp(b.dir, mix).normalize();
    const side = a.side.clone().lerp(b.side, mix).normalize();
    const up = a.up.clone().lerp(b.up, mix).normalize();
    const profile = Math.pow(4 * t * (1 - t), 0.6) * 0.85 + 0.15 * (1 - t);
    for (const sign of [-1, 1]) {
      if (random() < 0.06) continue; // wind-torn gaps
      const length = maxLeaflet * profile * (0.85 + random() * 0.3);
      const hang = options.hang + 0.35 * t + (random() - 0.5) * 0.25;
      const out = side
        .clone()
        .multiplyScalar(sign)
        .addScaledVector(dir, 0.6)
        .addScaledVector(up, -Math.tan(Math.min(1.2, hang)))
        .normalize();
      out.y -= 0.2 * t;
      out.normalize();
      const width = 0.09 * (1 - 0.5 * t);
      const tip = base.clone().addScaledVector(out, length);
      soup.tri(
        { p: base.clone().addScaledVector(dir, -width / 2), sway: sway(t), shade: shade(t), flutter: 0.3 * t },
        { p: base.clone().addScaledVector(dir, width / 2), sway: sway(t), shade: shade(t), flutter: 0.3 * t },
        { p: tip, sway: sway(t), shade: Math.min(1, shade(t) * 1.08), flutter: 1 },
      );
    }
  }
}

/** Builds one palm. Deterministic for a given shape. */
export function buildPalm(shape: PalmShape): BufferGeometry {
  const random = createRandom(shape.seed);
  const soup = new TriangleSoup();
  const leanAngle = random() * Math.PI * 2;
  const heading = new Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle));
  addTrunk(soup, shape, heading);
  const top = spine(shape, heading, 1);
  addCrown(soup, top, random);

  // Live fronds on a golden-angle spiral: the first rise, the last droop.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < shape.fronds; i++) {
    const order = i / (shape.fronds - 1);
    addFrond(
      soup,
      top,
      {
        azimuth: i * golden + (random() - 0.5) * 0.3,
        pitch: 0.85 - order * 1.15 + (random() - 0.5) * 0.15,
        droop: 0.8 + order * 0.6 + random() * 0.3,
        length: shape.frondLength * (0.85 + random() * 0.3) * (0.8 + 0.2 * order),
        hang: 0.4 + random() * 0.15,
        shade: 1,
      },
      random,
    );
  }
  // Dead fronds hang down along the trunk.
  for (let i = 0; i < DEAD_FRONDS; i++) {
    addFrond(
      soup,
      top.clone().add(new Vector3(0, -0.35, 0)),
      {
        azimuth: random() * Math.PI * 2,
        pitch: -1.05 - random() * 0.2,
        droop: 0.2,
        length: shape.frondLength * 0.6,
        hang: 0.9,
        shade: 0.55,
      },
      random,
    );
  }
  return soup.toGeometry();
}
