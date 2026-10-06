import { createRandom } from "@/features/hero/scene/world";
import type { Vec3 } from "../../frame";

/**
 * Where the army stop's props stand, in the board's ground frame: metres,
 * x along the board (right), y up from the ground, z out of the board's
 * face toward the road. Pure and deterministic (createRandom), so the
 * layout tests can check that nothing floats, nothing walks into the
 * board's legs and nothing grows tall enough to cross its foot copy.
 *
 * A sappers' roadside site: sandbag rings round the board's three legs
 * and a short low wall, an ammunition point (a stack of olive crates and
 * steel ammo cans), and the kit that builds the poster's bridge: Bailey
 * panels on timber bearers, a cable drum, two jerrycans, a pick and a
 * shovel left stuck in the bags.
 */

/** The board's legs (ArmySet's structure: posts at x -6, 0, 6, set back 0.55 m behind the face). */
export const LEGS = [-6, 0, 6] as const;
export const LEG_Z = -0.55;
/** A leg's footprint: the 0.36 m post and its 0.6 m stiffening plate across it. */
export const POST = { half: 0.18, plateHalf: 0.3 } as const;

/** A filled sandbag lying flat (a 50 x 30 cm hessian bag, three quarters full). */
export const BAG = { length: 0.56, width: 0.33, height: 0.16 } as const;
/** Lumpier or flatter: the bag shapes the instances share. */
export const BAG_VARIANTS = 3;
/** Each course sits a little into the one below: filled bags squash. */
const COURSE = BAG.height * 0.88;
/** A large wooden ammunition crate on its skids: 1 m long, 0.44 deep, 0.385 to the top of the lid. */
export const CRATE = { length: 1.0, depth: 0.44, height: 0.385, skid: 0.05, lid: 0.035 } as const;
/** A steel ammo can, the .50 calibre size. */
export const CAN = { length: 0.305, depth: 0.165, height: 0.19 } as const;
/** A 20-litre jerrycan, standing (its handles add 4 cm). */
export const JERRY = { width: 0.345, depth: 0.165, height: 0.47 } as const;
/** A wooden cable drum standing on its flanges, axis along z. */
export const DRUM = { radius: 0.45, width: 0.64, core: 0.36 } as const;
/** A Bailey panel lying flat: 10 ft by 4 ft 9 in, its chords 15 cm deep. */
export const PANEL = { length: 3.05, width: 1.45, depth: 0.15 } as const;
export const BEARER = { length: 1.7, size: 0.12 } as const;
/** The pick: a 0.9 m haft, a head 0.6 m across (point one side, chisel the other). */
export const PICK = { haft: 0.9, point: 0.3, chisel: 0.27 } as const;
/** The shovel: blade 0.22 x 0.28 m, an overall 1.05 m, its blade a third in the bag. */
export const SHOVEL = { blade: 0.28, width: 0.22, length: 1.05, buried: 0.12 } as const;

/** A placed piece: centre (for bags) or ground origin (for the kit), yaw about y, and small tilts. */
export type Placed = { p: Vec3; yaw: number; tilt?: number; roll?: number };
export type BagPlaced = Placed & { s: Vec3; tint: Vec3; variant: number; course: number };

export type ArmyProps = {
  bags: BagPlaced[];
  crates: (Placed & { variant: 0 | 1 })[];
  cans: Placed[];
  jerrycans: Placed[];
  bearers: Placed[];
  /** Panels lying flat on the bearers. */
  panels: Placed[];
  /** One more panel stood on its edge against the stack, its truss toward the road (the poster's girder, for real). */
  leaning: Placed;
  drum: Placed;
  /** The drum's cable, from its barrel down to the ground and in under the middle leg's bags. */
  cable: Vec3[];
  /** Head centre of the pick; its point is buried in a bag of the middle ring. */
  pick: Placed & { tip: Vec3; bag: number };
  /** The shovel's blade tip, buried in the wall's top course. */
  shovel: Placed & { bag: number };
};

/** Rotates a local offset by yaw (about y) after a tilt (about z) and a roll (about x): the props' Euler order YZX. */
export function orient(offset: Vec3, yaw: number, tilt = 0, roll = 0): Vec3 {
  let [x, y, z] = offset;
  // Roll about x.
  [y, z] = [y * Math.cos(roll) - z * Math.sin(roll), y * Math.sin(roll) + z * Math.cos(roll)];
  // Tilt about z.
  [x, y] = [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)];
  // Yaw about y (three's convention: +x turns toward -z).
  [x, z] = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
  return [x, y, z];
}

const HESSIAN: Vec3 = [1, 1, 1];
const DAMP: Vec3 = [0.4, 0.36, 0.34];
/** A few of the newer polypropylene bags, in olive. */
const OLIVE_BAG: Vec3 = [0.68, 0.76, 0.56];

function bagTint(random: () => number, course: number): Vec3 {
  const r = random();
  if (r < (course === 0 ? 0.3 : 0.12)) return DAMP;
  if (r > 0.9) return OLIVE_BAG;
  // Sun-bleached to sand-dusted: the hessian is never one colour.
  const k = 0.74 + random() * 0.22;
  return [k * HESSIAN[0], k * (0.97 + random() * 0.04), k * (0.94 + random() * 0.06)];
}

function bag(random: () => number, x: number, z: number, course: number, yaw: number): BagPlaced {
  const sy = 0.92 + random() * 0.14;
  const s: Vec3 = [0.94 + random() * 0.12, sy, 0.95 + random() * 0.1];
  const y = course * COURSE + (BAG.height / 2) * sy;
  // Half the bags lie the other way round, tied end to the left.
  const flip = random() < 0.5 ? Math.PI : 0;
  return {
    p: [x + (random() - 0.5) * 0.03, y, z + (random() - 0.5) * 0.03],
    yaw: yaw + flip + (random() - 0.5) * 0.12,
    tilt: (random() - 0.5) * 0.05,
    roll: (random() - 0.5) * 0.06,
    s,
    tint: bagTint(random, course),
    variant: Math.floor(random() * BAG_VARIANTS),
    course,
  };
}

/** The top of a bag (its centre plus half its height). */
export function bagTop(b: BagPlaced): number {
  return b.p[1] + (BAG.height / 2) * b.s[1];
}

/**
 * A ring of bags round a leg, laid tangent to it, each course turned half
 * a bag on the one below (a staggered bond) and stepped in a little (the
 * batter). On the low tier only the front arc, two courses.
 */
function ring(random: () => number, legX: number, high: boolean): BagPlaced[] {
  const out: BagPlaced[] = [];
  const courses = high ? 3 : 2;
  for (let c = 0; c < courses; c += 1) {
    const r = 0.68 - c * 0.035;
    const count = high ? 7 : 4;
    const step = high ? (Math.PI * 2) / count : (Math.PI * 1.15) / (count - 1);
    const start = high ? (c % 2) * (step / 2) + 0.3 : -0.08 * Math.PI + (c % 2) * (step / 2);
    const n = high || c % 2 === 0 ? count : count - 1;
    for (let i = 0; i < n; i += 1) {
      const a = start + i * step;
      const x = legX + Math.cos(a) * r;
      const z = LEG_Z + Math.sin(a) * r;
      // Long axis along the tangent: a yaw of -(a + 90 degrees) turns +x onto it.
      out.push(bag(random, x, z, c, -a - Math.PI / 2));
    }
  }
  return out;
}

/** The low wall's line: in front of the middle leg, toward the ammunition point; five stretchers long. */
export const WALL = { x0: -0.3, z: 1.55, stretchers: 5 } as const;
const STRETCH = BAG.length * 0.96;
/** The wall's length: its stretchers, each a little into the next. */
export const WALL_LENGTH = (WALL.stretchers - 1) * STRETCH + BAG.length;

/**
 * A short low wall in English bond: stretchers two deep, then a course of
 * headers across them, then stretchers again, each course stepped in and
 * turned half a bag on the one below. The low tier lays two courses of
 * single stretchers.
 */
function wall(random: () => number, high: boolean): BagPlaced[] {
  const out: BagPlaced[] = [];
  const { x0, z, stretchers: n } = WALL;
  const stretchers = (c: number, rows: number[]) => {
    const half = c % 2 === 1 || c === 2;
    for (const row of rows) {
      for (let i = 0; i < (half ? n - 1 : n); i += 1) {
        out.push(bag(random, x0 + BAG.length / 2 + (half ? STRETCH / 2 : 0) + i * STRETCH, z + row, c, 0));
      }
    }
  };
  if (!high) {
    stretchers(0, [0]);
    stretchers(1, [0]);
    return out;
  }
  const deep = BAG.width / 2 + 0.005;
  stretchers(0, [-deep, deep]);
  // Headers: bags laid across the wall, a bag's width apart, over the same length.
  const across = BAG.width * 0.98;
  const headers = Math.floor((WALL_LENGTH - BAG.width) / across + 1e-6) + 1;
  for (let i = 0; i < headers; i += 1) out.push(bag(random, x0 + BAG.width / 2 + i * across, z, 1, Math.PI / 2));
  stretchers(2, [-deep * 0.9, deep * 0.9]);
  return out;
}

/** The whole site, for a tier. */
export function armyProps(high: boolean): ArmyProps {
  const random = createRandom(1918);
  const rings = LEGS.flatMap((x) => ring(random, x, high));
  const walled = wall(random, high);
  const bags = [...rings, ...walled];

  // The ammunition point, beyond the wall's end: two crates side by side, one across them, one apart.
  const crates: ArmyProps["crates"] = [
    { p: [3.3, 0, 1.68], yaw: 0.06, variant: 0 },
    { p: [3.33, 0, 2.15], yaw: 0.03, variant: 1 },
    { p: [3.36, CRATE.height, 1.92], yaw: -0.14, variant: 0 },
    { p: [4.6, 0, 1.75], yaw: -0.5, variant: 1 },
  ];
  // Clear of the lorry track that runs past in front of the site (siteLayout's TRACK_LINE, 2.3 m out and beyond).
  const cans: Placed[] = high
    ? [
        { p: [4.56, CRATE.height, 1.76], yaw: -0.3 },
        { p: [2.45, 0, 2.08], yaw: 0.35 },
        { p: [2.05, 0, 2.18], yaw: 1.3 },
      ]
    : [{ p: [2.45, 0, 2.08], yaw: 0.35 }];

  // The bridge panels, stacked on three bearers, each laid by hand a little off the one below.
  const stack = { x: -4.85, z: 1.72 };
  const bearers: Placed[] = [-1.1, 0, 1.1].map((dx) => ({ p: [stack.x + dx, 0, stack.z], yaw: (random() - 0.5) * 0.06 }));
  const panels: Placed[] = Array.from({ length: high ? 3 : 2 }, (_, i) => ({
    p: [stack.x + (random() - 0.5) * 0.08, BEARER.size + i * PANEL.depth, stack.z + (random() - 0.5) * 0.06],
    yaw: (random() - 0.5) * 0.03,
  }));

  const top = panels[panels.length - 1];
  const leaning = leanPanel(top.p[1] + PANEL.depth, top.p[2] + PANEL.width / 2, top.p[0] + 0.05);

  const drum: Placed = { p: [-1.7, 0, 1.2], yaw: 0.08 };
  const r = 0.016;
  const cable: Vec3[] = [
    [drum.p[0] + DRUM.core * 0.94, DRUM.radius + 0.06, drum.p[2]],
    [drum.p[0] + DRUM.core + 0.12, 0.2, drum.p[2] - 0.02],
    [-1.05, r, 1.1],
    [-0.78, r, 0.8],
    [-0.7, r, 0.45],
    [-0.52, r, 0.12],
    [-0.38, r, -0.05],
  ];

  // Beside the drum, off the track's near rut.
  const jerrycans: Placed[] = [
    { p: [-2.35, 0, 1.95], yaw: 0.3 },
    { p: [-1.9, 0, 2.1], yaw: -0.25 },
  ];

  // The pick, its point driven into the top course of the middle ring, front left; head and haft
  // run along the ring (tangent to it), so nothing reaches back to the leg.
  const topCourse = high ? 2 : 1;
  const middleTop = rings
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.course === topCourse && Math.abs(b.p[0]) < 1.2);
  const pickBag = middleTop.reduce((best, cur) => {
    const angle = (b: BagPlaced) => Math.atan2(b.p[2] - LEG_Z, b.p[0]);
    const want = (150 * Math.PI) / 180;
    return Math.abs(angle(cur.b) - want) < Math.abs(angle(best.b) - want) ? cur : best;
  });
  const pickTilt = (40 * Math.PI) / 180;
  const pickYaw = Math.PI / 2 - Math.atan2(pickBag.b.p[2] - LEG_Z, pickBag.b.p[0]);
  const tipLocal: Vec3 = [-PICK.point, 0, 0];
  const tipOffset = orient(tipLocal, pickYaw, pickTilt);
  const tip: Vec3 = [pickBag.b.p[0], bagTop(pickBag.b) - 0.07, pickBag.b.p[2]];
  const pick = {
    p: [tip[0] - tipOffset[0], tip[1] - tipOffset[1], tip[2] - tipOffset[2]] as Vec3,
    yaw: pickYaw,
    tilt: pickTilt,
    tip,
    bag: pickBag.i,
  };

  // The shovel, blade down in the wall's top course, leaning back toward the board.
  const wallTop = walled.map((b, i) => ({ b, i: i + rings.length })).filter(({ b }) => b.course === (high ? 2 : 1));
  const shovelBag = wallTop.reduce((best, cur) => (Math.abs(cur.b.p[0] - 1.2) < Math.abs(best.b.p[0] - 1.2) ? cur : best));
  const shovel = {
    p: [shovelBag.b.p[0], bagTop(shovelBag.b) - SHOVEL.buried, shovelBag.b.p[2]] as Vec3,
    yaw: 0.35,
    // Leaning back (toward -z, the board) and a little sideways.
    tilt: 0.12,
    roll: -0.22,
    bag: shovelBag.i,
  };

  return { bags, crates, cans, jerrycans, bearers, panels, leaning, drum, cable, pick, shovel };
}

/** How far the leaning panel stands off the vertical. */
export const LEAN = (18 * Math.PI) / 180;

/**
 * A panel on its edge, leaning back by LEAN onto the top front edge of
 * the stack (at height `edgeY`, depth `edgeZ`): rolled so its width
 * stands up and its back face (the one that lay on the stack) touches
 * that edge, its lowest corner on the ground.
 */
export function leanPanel(edgeY: number, edgeZ: number, x: number): Placed {
  const c = Math.cos(LEAN);
  const s = Math.sin(LEAN);
  const half = PANEL.width / 2;
  const y = half * c + PANEL.depth * s;
  // Where the back face crosses the edge's height, in the panel's own width axis.
  const along = (edgeY - y + PANEL.depth * s) / c;
  const z = edgeZ + along * s + PANEL.depth * c;
  return { p: [x, y, z], yaw: 0, roll: -(Math.PI / 2 + LEAN) };
}


/** A footprint on the ground: centre, half sizes along its own x and z, and its yaw (board-local). */
export type Footprint = { x: number; z: number; hx: number; hz: number; yaw: number };

/**
 * Where the props cover the ground, board-local: every bag of the ground
 * course, every piece of kit standing on the ground, the panel stack with
 * the leaning panel's foot. The site keeps its scatter (stones, tufts)
 * out of them, and the test keeps the props off the track.
 */
export function propFootprints(props: ArmyProps): Footprint[] {
  const out: Footprint[] = [];
  const add = (p: Placed, hx: number, hz: number) => out.push({ x: p.p[0], z: p.p[2], hx, hz, yaw: p.yaw });
  for (const b of props.bags) if (b.course === 0) add(b, (BAG.length / 2) * b.s[0], (BAG.width / 2) * b.s[2]);
  for (const c of props.crates) if (c.p[1] === 0) add(c, CRATE.length / 2 + 0.07, CRATE.depth / 2);
  for (const c of props.cans) if (c.p[1] === 0) add(c, CAN.length / 2, CAN.depth / 2);
  for (const j of props.jerrycans) add(j, JERRY.width / 2, JERRY.depth / 2);
  add(props.drum, DRUM.radius, DRUM.width / 2 + 0.03);
  const mid = props.bearers[1];
  out.push({ x: mid.p[0], z: mid.p[2], hx: PANEL.length / 2 + 0.12, hz: BEARER.length / 2, yaw: 0 });
  // The leaning panel's shadow on the ground: its section's corners, rolled up onto the stack.
  const { p, roll = 0 } = props.leaning;
  const zs = [0, PANEL.depth].flatMap((y) => [-1, 1].map((sz) => p[2] + orient([0, y, (sz * PANEL.width) / 2], 0, 0, roll)[2]));
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  out.push({ x: p[0], z: (z0 + z1) / 2, hx: PANEL.length / 2 + 0.07, hz: (z1 - z0) / 2, yaw: 0 });
  return out;
}

/** Whether a board-local ground point lies within `margin` of a footprint. */
export function inFootprint(f: Footprint, x: number, z: number, margin = 0): boolean {
  const [lx, , lz] = orient([x - f.x, 0, z - f.z], -f.yaw);
  return Math.abs(lx) < f.hx + margin && Math.abs(lz) < f.hz + margin;
}
