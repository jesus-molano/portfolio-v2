import { Euler, Quaternion, Vector3 } from "three";
import { createRandom } from "@/features/hero/scene/world";
import { type BoardFrame, toSet } from "../../boardFrame";
import type { Vec3 } from "../../frame";
import { armyProps, inFootprint, propFootprints } from "./propsLayout";

/**
 * The ground around the army's board, in the set's frame (the car's stop
 * point at the origin, the street along +x, the board at z < 0): a
 * sappers' roadside site at night. A packed-dirt and gravel apron under
 * the board with a vehicle track rutted into it, its kerb to the road,
 * stones, dry grass and the island's tabaiba scrub, floodlight cables
 * from a cabinet to the legs, a picket fence with concertina wire behind
 * the board, a short run of Czech hedgehogs far left, a warning sign by
 * the road, and the checkpoint: a boom barrier with its counterweight and
 * a sentry box. Pure and deterministic (createRandom), so a screenshot is
 * stable and the tests can check that nothing stands in the road, on the
 * track or inside anything else.
 */

/** The board's frame, the same as ArmySet's (the test checks the corners agree). */
export const SITE_FRAME: BoardFrame = { centre: [11, 7, -13], yaw: -Math.PI / 9, w: 16, h: 7 };

export type Vec2 = readonly [number, number];
export type Placed = { p: Vec3; s: Vec3; r?: Vec3; color?: string };

/** The road between its kerbs, and the street kerb's back face (Street.tsx: KERB depth 0.35). */
export const ROAD = { near: 1.9, far: -5.4, kerbBack: -5.75, kerbTop: 0.16 } as const;
/** The sandy lot's plane (ArmySet) and the apron's packed surface, 3 cm over it (its ruts 2 cm deep). */
export const LOT_Y = 0.03;
export const APRON_Y = 0.06;
/** The apron's box in the set: its grid and its painted texture cover exactly this. */
export const APRON = { x0: -2.8, x1: 24.4, z0: -21.2, z1: -4.75 } as const;
/** Where vehicles come in: packed gravel ramped over the kerb, x0..x1 along the street. */
export const RAMP = { x0: -0.7, x1: 2.3, top: 0.185, toe: -4.86 } as const;
/** The guard rail's gap (ArmySet's rail stops at x -2 and starts again at 26). */
export const RAIL_GAP = { x0: -2, x1: 26, z: -5.9 } as const;

/** Board-local x of the three legs, and their z (behind the face). */
export const LEGS_X = [-6, 0, 6] as const;
export const LEG_Z = -0.55;

/** A board-local ground point (x along the face, z out of it) in set xz. */
export function at2(x: number, z: number): Vec2 {
  const p = local(x, z);
  return [p[0], p[2]];
}

export function local(x: number, z: number, y = 0): Vec3 {
  const p = toSet(SITE_FRAME, [x, y - SITE_FRAME.centre[1], z]);
  return [p[0], y, p[2]];
}

/** Set xz to board-local xz. */
export function toLocal(x: number, z: number): Vec2 {
  const c = Math.cos(SITE_FRAME.yaw);
  const s = Math.sin(SITE_FRAME.yaw);
  const dx = x - SITE_FRAME.centre[0];
  const dz = z - SITE_FRAME.centre[2];
  return [dx * c - dz * s, dx * s + dz * c];
}

export const LEG_BASES: Vec2[] = LEGS_X.map((x) => at2(x, LEG_Z));

/* ------------------------------------------------------------ geometry */

function segmentDistance(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number } {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz || 1e-9;
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2));
  return { d: Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - abz * t), t };
}

/** Distance from p to a polyline, and how far along it (metres) the nearest point is. */
export function polylineDistance(p: Vec2, line: readonly Vec2[]): { d: number; along: number; side: number } {
  let best = { d: Infinity, along: 0, side: 0 };
  let run = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const { d, t } = segmentDistance(p, a, b);
    if (d < best.d) {
      const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      best = { d, along: run + t * len, side: Math.sign(cross) };
    }
    run += len;
  }
  return best;
}

export function polylineLength(line: readonly Vec2[]): number {
  let run = 0;
  for (let i = 0; i < line.length - 1; i += 1) run += Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
  return run;
}

/** Point and unit direction at a distance along a polyline. */
export function pointAlong(line: readonly Vec2[], at: number): { p: Vec2; dir: Vec2 } {
  let run = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (run + len >= at || i === line.length - 2) {
      const t = Math.min(1, Math.max(0, (at - run) / (len || 1e-9)));
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [(b[0] - a[0]) / (len || 1), (b[1] - a[1]) / (len || 1)] };
    }
    run += len;
  }
  return { p: line[0], dir: [1, 0] };
}

export function insidePolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Signed distance to the polygon's edge: positive inside. */
export function polygonDepth(p: Vec2, poly: readonly Vec2[]): number {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) d = Math.min(d, segmentDistance(p, poly[j], poly[i]).d);
  return insidePolygon(p, poly) ? d : -d;
}

/** A smooth, deterministic ripple (a few crossed sines), -1..1. */
export function ripple(x: number, z: number): number {
  return (
    0.45 * Math.sin(x * 1.7 + z * 0.6) +
    0.3 * Math.sin(x * -0.9 + z * 2.3 + 1.3) +
    0.25 * Math.sin(x * 3.9 - z * 3.1 + 0.4)
  );
}

/* --------------------------------------------------------------- apron */

/**
 * The apron's outline, clockwise from the kerb at the left: straight along
 * the kerb (it meets the kerb stones), out over the kerb where the ramp
 * is, then a ragged edge where the packed gravel thins out into the lot.
 */
function buildOutline(): Vec2[] {
  const random = createRandom(4417);
  const kerb = ROAD.kerbBack - 0.03;
  const back = (x: number) => at2(x, -3.4);
  // [point, ragged?] — the kerb edge stays straight.
  const corners: [Vec2, boolean][] = [
    [[-2.6, kerb], false],
    [[RAMP.x0 - 0.35, kerb], false],
    [[RAMP.x0, RAMP.toe], false],
    [[RAMP.x1, RAMP.toe], false],
    [[RAMP.x1 + 0.35, kerb], false],
    [[23.2, kerb], true],
    [[22.4, -8.6], true],
    [[21.0, -11.4], true],
    [back(8.2), true],
    [back(2), true],
    [back(-5), true],
    [back(-10.6), true],
    [[0.2, -19.0], true],
    [[-1.9, -15.4], true],
    [[-2.6, -10.5], true],
  ];
  const out: Vec2[] = [];
  for (let i = 0; i < corners.length; i += 1) {
    const [a, rough] = corners[i];
    const [b] = corners[(i + 1) % corners.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = rough ? Math.max(1, Math.round(len / 0.6)) : 1;
    // Outward normal of a clockwise ring (seen from above, +z toward the viewer): (dz, -dx).
    const nx = (b[1] - a[1]) / len;
    const nz = -(b[0] - a[0]) / len;
    let wobble = 0;
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      wobble = rough && k > 0 ? wobble * 0.55 + (random() - 0.5) * 0.7 : 0;
      out.push([a[0] + (b[0] - a[0]) * t + nx * wobble, a[1] + (b[1] - a[1]) * t + nz * wobble]);
    }
  }
  return out;
}

export const APRON_OUTLINE: readonly Vec2[] = buildOutline();

/**
 * The vehicle track: in over the ramp, round to the front of the board
 * (where a lorry stands to unload) and on toward the right, fading out.
 * Its two wheel ruts are `TRACK.gauge` apart.
 */
/** Chaikin's corner cutting: a smooth curve through a polyline's corners, ends kept. */
export function chaikin(line: readonly Vec2[], rounds: number): Vec2[] {
  let pts: Vec2[] = [...line];
  for (let r = 0; r < rounds; r += 1) {
    const next: Vec2[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

export const TRACK_LINE: readonly Vec2[] = chaikin([
  [0.8, -4.7],
  [1.2, -6.4],
  [2.6, -8.6],
  [5.0, -10.2],
  [8.4, -10.2],
  [11.8, -9.1],
  [14.6, -7.9],
  [17.0, -7.0],
], 3);
export const TRACK = { gauge: 1.7, width: 0.36, fade: 3.2 } as const;
export const TRACK_LENGTH = polylineLength(TRACK_LINE);

/** How deep the ruts are at a point, 0..1, and the pushed-up berm beside them, 0..1. */
export function rutAt(x: number, z: number): { rut: number; berm: number } {
  const { d, along } = polylineDistance([x, z], TRACK_LINE);
  const fade = Math.min(1, Math.max(0, (TRACK_LENGTH - along) / TRACK.fade));
  const off = Math.abs(d - TRACK.gauge / 2);
  const half = TRACK.width / 2;
  const rut = off < half ? 1 - (off / half) ** 2 : 0;
  const berm = off >= half && off < half * 2.2 ? Math.sin(((off - half) / (half * 1.2)) * Math.PI) : 0;
  return { rut: rut * fade, berm: berm * fade };
}

/** Damp ground: a puddle in the rut's low point, the road's runoff by the kerb, a drip patch under the board. */
export const DAMP: readonly { c: Vec2; r: Vec2; angle: number; wet: number }[] = [
  { c: [4.6, -9.95], r: [1.1, 0.42], angle: -0.5, wet: 1 },
  { c: [9.6, -6.55], r: [3.4, 0.8], angle: 0.04, wet: 0.7 },
  { c: [11.4, -12.6], r: [2.6, 1.3], angle: 0.35, wet: 0.55 },
  { c: [-0.4, -7.2], r: [1.6, 0.9], angle: 0.6, wet: 0.5 },
];

/** The apron's surface height at a point (it sits over the lot and over the kerb at the ramp). */
export function apronHeight(x: number, z: number): number {
  if (z > ROAD.kerbBack - 0.03 && x > RAMP.x0 - 0.4 && x < RAMP.x1 + 0.4) {
    // Over the kerb, then down onto the road; thinner toward the ramp's sides.
    const edge = Math.min(1, Math.max(0, Math.min(x - (RAMP.x0 - 0.4), RAMP.x1 + 0.4 - x) / 0.4));
    const top = APRON_Y + (RAMP.top - APRON_Y) * edge;
    if (z <= ROAD.far + 0.02) return top;
    const slope = Math.min(1, Math.max(0, (RAMP.toe - z) / (RAMP.toe - ROAD.far - 0.02)));
    return 0.008 + (top - 0.008) * slope;
  }
  const { rut, berm } = rutAt(x, z);
  const depth = polygonDepth([x, z], APRON_OUTLINE);
  // The ragged edge thins out to just over the lot.
  const thin = Math.min(1, Math.max(0, depth / 0.7));
  const h = Math.max(LOT_Y + 0.006, APRON_Y + 0.004 * ripple(x, z) - 0.02 * rut + 0.012 * berm);
  return LOT_Y + 0.005 + (h - LOT_Y - 0.005) * (z > ROAD.kerbBack - 0.6 ? 1 : thin);
}

/** The ground's height anywhere in the site: the apron where it is, else the lot. */
export function groundAt(x: number, z: number): number {
  if (x >= APRON.x0 && x <= APRON.x1 && z >= APRON.z0 && z <= APRON.z1 && polygonDepth([x, z], APRON_OUTLINE) > -0.05) {
    return apronHeight(x, z);
  }
  return LOT_Y;
}

/* ---------------------------------------------------------- the props */

/** The floodlights' cabinet, behind the board's left leg. */
export const CABINET = { at: local(-8.7, -1.9), yaw: SITE_FRAME.yaw, size: [0.6, 0.85, 0.3] as Vec3 } as const;

/**
 * Floodlight cables: one per leg, from the cabinet along the ground
 * behind the legs, then up the back of each leg to the catwalk. A fourth
 * runs from the cabinet off to the back, the site's feed. Points in the
 * set; the ground runs follow the apron's surface.
 */
export const CABLE_RADIUS = 0.022;
/**
 * Up each leg's back, beside its web plate and clear of the bracing's ends,
 * into a junction box on the leg (the floods' feed goes on inside the steel).
 */
export const CABLE_TOP = 2.82;
/** Board-local offset of the climb from the leg's centre: beside the web plate, behind the post and the braces. */
export const CLIMB: Vec2 = [0.13, LEG_Z - 0.25];
/** The junction box on each leg's back that the cable climbs into: board-local centre offset and size. */
export const JUNCTION = { x: 0.15, y: 2.88, z: LEG_Z - 0.18 - 0.065, size: [0.18, 0.26, 0.13] as Vec3 } as const;

export function cablePaths(): Vec3[][] {
  const random = createRandom(2203);
  const lift = (x: number, z: number) => groundAt(x, z) + CABLE_RADIUS * 0.9;
  const paths: Vec3[][] = [];
  const [cx, , cz] = CABINET.at;
  const [clx, clz] = toLocal(cx, cz);
  LEGS_X.forEach((legX, i) => {
    const pts: Vec2[] = [];
    // Out of the cabinet's foot, then along behind the legs, each cable a little apart.
    const lane = -1.45 + i * 0.09;
    pts.push([clx + 0.12 + i * 0.08, clz + 0.2]);
    pts.push([clx + 0.5 + i * 0.08, lane + 0.05]);
    const end = legX + CLIMB[0] + 0.5;
    const steps = Math.max(2, Math.round((end - (clx + 0.5)) / 1.4));
    for (let k = 1; k < steps; k += 1) {
      const t = k / steps;
      pts.push([clx + 0.5 + (end - clx - 0.5) * t, lane + (random() - 0.5) * 0.22]);
    }
    pts.push([end, lane * 0.7 + CLIMB[1] * 0.3]);
    const ground: Vec3[] = pts.map(([x, z]) => {
      const p = local(x, z);
      return [p[0], lift(p[0], p[2]), p[2]] as Vec3;
    });
    // The bend up onto the leg, and the climb.
    const foot = local(legX + CLIMB[0], CLIMB[1]);
    const footY = lift(foot[0], foot[2]);
    ground.push([foot[0], footY + 0.12, foot[2]]);
    ground.push([foot[0], 1.0, foot[2]]);
    ground.push([foot[0], CABLE_TOP, foot[2]]);
    paths.push(ground);
  });
  // The feed, off to the back of the site.
  const feed: Vec2[] = [
    [clx - 0.1, clz + 0.15],
    [clx - 0.6, clz - 0.7],
    [clx - 0.9, -3.0],
    [clx - 1.6, -3.9],
    [clx - 2.4, -4.4],
  ];
  paths.push(
    feed.map(([x, z]) => {
      const p = local(x, z);
      return [p[0], lift(p[0], p[2]), p[2]] as Vec3;
    }),
  );
  return paths;
}

/** The kerb stones along the lot's gap in the rail, clear of the ramp. */
export function kerbStones(): Placed[] {
  const random = createRandom(611);
  const items: Placed[] = [];
  const shades = ["#8d8598", "#7f7889", "#958c9a", "#76707f"];
  for (let x = RAIL_GAP.x0; x < RAIL_GAP.x1; x += 1) {
    if (x + 1 > RAMP.x0 - 0.3 && x < RAMP.x1 + 0.3) continue;
    const chipped = random() < 0.14;
    const len = chipped ? 0.62 + random() * 0.2 : 0.975;
    const dz = (random() - 0.5) * 0.012;
    items.push({
      p: [x + 0.012 + len / 2, (ROAD.kerbTop + 0.012) / 2, (ROAD.far + ROAD.kerbBack) / 2 + dz],
      s: [len, ROAD.kerbTop + 0.012 + (random() - 0.5) * 0.006, ROAD.far - ROAD.kerbBack + 0.022],
      r: [0, (random() - 0.5) * 0.012, 0],
      color: shades[Math.floor(random() * shades.length)],
    });
  }
  return items;
}

/** Board-local fence line behind the board: pickets every bay. */
export const FENCE = { z: -4.6, x0: -11.2, x1: 9.6, bay: 2.6, height: 1.25, coil: 0.46 } as const;

export function fencePickets(): Placed[] {
  const random = createRandom(73);
  const items: Placed[] = [];
  const count = Math.round((FENCE.x1 - FENCE.x0) / FENCE.bay);
  for (let i = 0; i <= count; i += 1) {
    const lx = FENCE.x0 + ((FENCE.x1 - FENCE.x0) * i) / count;
    const p = local(lx, FENCE.z + (random() - 0.5) * 0.1);
    const h = FENCE.height + (random() - 0.5) * 0.08;
    const lean: Vec3 = [(random() - 0.5) * 0.05, SITE_FRAME.yaw + Math.PI / 4, (random() - 0.5) * 0.05];
    // Driven 25 cm in: the box reaches below the lot.
    items.push({ p: [p[0], LOT_Y + h / 2 - 0.12, p[2]], s: [0.055, h + 0.25, 0.055], r: lean });
  }
  return items;
}

/** The picket tops, for the two straight barbed strands. */
export function fenceLine(): Vec3[] {
  return fencePickets().map((item) => item.p);
}

/**
 * Concertina wire along the fence's foot: a coil of loops, each a little
 * different, as line segments (one draw). Returns pairs of points.
 */
export function concertina(): Vec3[] {
  const random = createRandom(9001);
  const a = local(FENCE.x0, FENCE.z + 0.35);
  const b = local(FENCE.x1, FENCE.z + 0.35);
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const ux = (b[0] - a[0]) / len;
  const uz = (b[2] - a[2]) / len;
  const pitch = 0.2;
  const perLoop = 18;
  const loops = Math.floor(len / pitch);
  const out: Vec3[] = [];
  let prev: Vec3 | null = null;
  for (let l = 0; l < loops; l += 1) {
    const r = FENCE.coil * (0.92 + random() * 0.12);
    const lean = (l % 2 ? 1 : -1) * 0.06;
    for (let k = 0; k <= perLoop; k += 1) {
      const phi = (k / perLoop) * Math.PI * 2;
      const t = (l + k / perLoop) * pitch + Math.cos(phi) * lean;
      const across = Math.cos(phi) * r;
      const up = r + Math.sin(phi) * r + LOT_Y + 0.02;
      const point: Vec3 = [a[0] + ux * t - uz * across, up, a[2] + uz * t + ux * across];
      if (prev) out.push(prev, point);
      prev = point;
    }
  }
  return out;
}

/** Two barbed strands between the picket tops, sagging a little in each bay. */
export function barbedStrands(): Vec3[] {
  const tops = fencePickets().map((item) => ({ p: item.p, h: item.s[1] - 0.25 }));
  const out: Vec3[] = [];
  for (const share of [0.55, 0.95]) {
    for (let i = 0; i < tops.length - 1; i += 1) {
      const a = tops[i];
      const b = tops[i + 1];
      const steps = 6;
      for (let k = 0; k < steps; k += 1) {
        const at = (t: number): Vec3 => [
          a.p[0] + (b.p[0] - a.p[0]) * t,
          LOT_Y + (a.h + (b.h - a.h) * t) * share - 0.06 * Math.sin(Math.PI * t),
          a.p[2] + (b.p[2] - a.p[2]) * t,
        ];
        out.push(at(k / steps), at((k + 1) / steps));
      }
    }
  }
  return out;
}

/**
 * Czech hedgehogs, far left on the lot: three steel angles crossed at
 * right angles, standing on three ends. Each beam as a box.
 */
export const HEDGEHOG = { beam: 1.9, section: 0.13 } as const;
export const HEDGEHOGS: readonly { at: Vec2; yaw: number }[] = [
  { at: [-6.6, -9.4], yaw: 0.3 },
  { at: [-4.4, -11.3], yaw: 1.1 },
  { at: [-6.9, -12.9], yaw: 2.0 },
  { at: [-2.4, -13.6], yaw: 0.7 },
];

export function hedgehogBeams(): Placed[] {
  const items: Placed[] = [];
  // Turn the body diagonal (1,1,1) to straight up: the three beams then stand on three ends.
  const tilt = new Quaternion().setFromUnitVectors(new Vector3(1, 1, 1).normalize(), new Vector3(0, 1, 0));
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
  const half = HEDGEHOG.beam / 2;
  // The lowest end of a beam sits half a beam times cos(54.7°) under the crossing; the section adds a little.
  const rise = half * (1 / Math.sqrt(3)) + HEDGEHOG.section * 0.45;
  const e = new Euler();
  HEDGEHOGS.forEach(({ at, yaw }, i) => {
    const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw).multiply(tilt);
    const y = groundAt(at[0], at[1]) + rise - 0.03;
    axes.forEach((axis, k) => {
      // Each beam: a box long along x, turned onto its axis.
      const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), axis);
      const full = turn.clone().multiply(q);
      // An angle section: rolled 45° about its length so a corner, not a face, catches the light.
      full.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 4));
      e.setFromQuaternion(full);
      items.push({
        p: [at[0], y, at[1]],
        s: [HEDGEHOG.beam, HEDGEHOG.section, HEDGEHOG.section * 0.32],
        r: [e.x, e.y, e.z],
        color: ["#5a4440", "#4d3b3e", "#614a3f"][(i + k) % 3],
      });
    });
  });
  return items;
}

/** The warning sign by the road, left of the lot, turned to the oncoming car. */
export const SIGN = { at: [-3.9, -6.55] as Vec2, yaw: -0.42, plate: [0.9, 0.6] as Vec2, bottom: 1.05, post: 1.75 } as const;

/**
 * The checkpoint's boom: it pivots where ArmySet's barrier did (3, 1.05,
 * 2.3) and lifts the same way, over the same 40% of the leave beat. The
 * arm reaches 4.2 m across the lane, the counterweight 0.85 m back.
 */
export const BOOM = {
  pivot: [3, 1.05, 2.3] as Vec3,
  reach: 4.2,
  tail: 0.85,
  tube: 0.05,
  /** The post stands beside the arm (it swings past it), the rest fork under its tip. */
  post: [3.18, 2.3] as Vec2,
  rest: [3, -1.72] as Vec2,
  lift: (80 * Math.PI) / 180,
} as const;

/** The boom's angle at film position p: the first 40% of the leave beat, smoothstepped to 80°. */
export function boomAngle(p: number, leave: { from: number; to: number }): number {
  const u = Math.min(1, Math.max(0, (p - leave.from) / Math.max(1e-6, (leave.to - leave.from) * 0.4)));
  return BOOM.lift * u * u * (3 - 2 * u);
}

/** The sentry box beside the boom, on the near verge: footprint, height to the eaves. */
export const BOOTH = { at: [5.05, 3.55] as Vec2, size: 1.3, eaves: 2.25, roof: 0.42 } as const;

/* ------------------------------------------------- scatter: stones etc. */

const LEG_CLEAR = 1.7;

function nearLeg(x: number, z: number, r = LEG_CLEAR): boolean {
  return LEG_BASES.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < r);
}

function nearCable(x: number, z: number, paths: Vec3[][], r: number): boolean {
  return paths.some((path) => path.some((p, i) => i < path.length - 1 && Math.hypot(p[0] - x, p[2] - z) < r));
}

/** The ground the props cover (propsLayout, the high tier's: the low tier's is a part of it). */
const PROP_FEET = propFootprints(armyProps(true));

/** Whether a set point lies on (or within `margin` of) a prop's footprint. */
export function underProps(x: number, z: number, margin: number): boolean {
  const [lx, lz] = toLocal(x, z);
  return PROP_FEET.some((f) => inFootprint(f, lx, lz, margin));
}

function nearCabinet(x: number, z: number, r: number): boolean {
  return Math.hypot(x - CABINET.at[0], z - CABINET.at[2]) < r;
}

/** Stones on the apron (small gravel and cobbles) and basalt rocks along its ragged edge. */
export function stones(count: number): Placed[] {
  const random = createRandom(5150);
  const cables = cablePaths();
  const items: Placed[] = [];
  const tones = ["#4a4048", "#5c5058", "#6e5a4c", "#3b3340", "#7a6a5c", "#5a3f3a"];
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard += 1;
    const big = items.length % 7 === 0;
    const x = APRON.x0 + random() * (APRON.x1 - APRON.x0);
    const z = APRON.z0 + random() * (ROAD.kerbBack - 0.3 - APRON.z0);
    const depth = polygonDepth([x, z], APRON_OUTLINE);
    // Big ones keep to the ragged edge; small ones anywhere on it, thicker at the edge.
    if (big ? depth > 0.6 || depth < -0.9 : depth < -0.4 || (depth > 1.2 && random() < 0.55)) continue;
    if (z > ROAD.kerbBack - 0.4) continue;
    if (nearLeg(x, z) || nearCabinet(x, z, 0.8) || nearCable(x, z, cables, 0.3) || underProps(x, z, big ? 0.35 : 0.1)) continue;
    if (rutAt(x, z).rut > 0.2) continue;
    const size = big ? 0.22 + random() * 0.26 : 0.05 + random() * 0.11;
    const flat = 0.45 + random() * 0.35;
    items.push({
      p: [x, groundAt(x, z) + size * flat * 0.32, z],
      s: [size * (0.8 + random() * 0.4), size * flat, size * (0.8 + random() * 0.4)],
      r: [(random() - 0.5) * 0.4, random() * Math.PI * 2, (random() - 0.5) * 0.4],
      color: tones[Math.floor(random() * tones.length)],
    });
  }
  return items;
}

/** Dry grass tufts: along the apron's ragged edge, at the fence's foot and round the sign and the hedgehogs. */
export function tufts(count: number): Placed[] {
  const random = createRandom(808);
  const cables = cablePaths();
  const items: Placed[] = [];
  const seeds: Vec2[] = [
    ...HEDGEHOGS.map((h) => h.at),
    SIGN.at,
    ...[-10, -7, -3, 1, 4, 8].map((x) => at2(x, FENCE.z + 0.2)),
  ];
  let guard = 0;
  while (items.length < count && guard < count * 60) {
    guard += 1;
    let x: number;
    let z: number;
    if (random() < 0.35) {
      const [sx, sz] = seeds[Math.floor(random() * seeds.length)];
      x = sx + (random() - 0.5) * 2.4;
      z = sz + (random() - 0.5) * 2.4;
    } else {
      x = APRON.x0 - 1 + random() * (APRON.x1 - APRON.x0 + 2);
      z = APRON.z0 - 1 + random() * (ROAD.kerbBack - APRON.z0 + 0.6);
      const depth = polygonDepth([x, z], APRON_OUTLINE);
      if (depth > 0.5 || depth < -1.4) continue;
    }
    if (z > RAIL_GAP.z - 0.25) continue;
    if (nearLeg(x, z, 1.5) || nearCabinet(x, z, 0.7) || nearCable(x, z, cables, 0.25) || underProps(x, z, 0.25)) continue;
    if (rutAt(x, z).rut > 0.05 || rutAt(x, z).berm > 0.6) continue;
    if (HEDGEHOGS.some((h) => Math.hypot(h.at[0] - x, h.at[1] - z) < 0.35)) continue;
    if (Math.hypot(SIGN.at[0] - x, SIGN.at[1] - z) < 0.2) continue;
    const size = 0.3 + random() * 0.32;
    items.push({
      p: [x, groundAt(x, z) - 0.01, z],
      s: [size * (0.9 + random() * 0.5), size * (0.75 + random() * 0.5), size * (0.9 + random() * 0.5)],
      r: [0, random() * Math.PI, 0],
      color: ["#c9b98a", "#b5a271", "#d6c99c", "#a8946a"][Math.floor(random() * 4)],
    });
  }
  return items;
}

/**
 * Tabaiba: the island's low, rounded scrub, on the lot round the apron
 * (never on it), behind the fence and by the hedgehogs.
 */
export function scrub(count: number): Placed[] {
  const random = createRandom(31);
  const items: Placed[] = [];
  const zones: { c: Vec2; r: number }[] = [
    { c: at2(-12.8, -2.4), r: 2.2 },
    { c: at2(-4, -6.4), r: 3.4 },
    { c: at2(6, -6.2), r: 3.2 },
    { c: [23.6, -12.6], r: 1.8 },
    { c: [-5.4, -15.4], r: 2.2 },
    { c: [-1.2, -17.8], r: 1.6 },
  ];
  let guard = 0;
  while (items.length < count && guard < count * 60) {
    guard += 1;
    const zone = zones[items.length % zones.length];
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * zone.r;
    const x = zone.c[0] + Math.cos(a) * d;
    const z = zone.c[1] + Math.sin(a) * d;
    if (z > RAIL_GAP.z - 0.8) continue;
    if (polygonDepth([x, z], APRON_OUTLINE) > -0.4) continue;
    if (HEDGEHOGS.some((h) => Math.hypot(h.at[0] - x, h.at[1] - z) < 1.3)) continue;
    if (items.some((it) => Math.hypot(it.p[0] - x, it.p[2] - z) < (it.s[0] + 0.6) * 0.7)) continue;
    const w = 0.55 + random() * 0.8;
    const h = w * (0.45 + random() * 0.25);
    items.push({
      p: [x, LOT_Y + h * 0.32, z],
      s: [w, h, w * (0.8 + random() * 0.35)],
      r: [0, random() * Math.PI * 2, 0],
      color: ["#4c5a3e", "#56603f", "#45503a", "#5e5a44"][Math.floor(random() * 4)],
    });
  }
  return items;
}
