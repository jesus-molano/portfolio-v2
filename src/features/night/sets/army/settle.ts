import type { Vec3 } from "../../frame";
import { type ArmyProps, BAG, BEARER, CAN, CRATE, DRUM, JERRY, LEGS, LEG_Z, PANEL, type Placed, armyProps, orient } from "./propsLayout";
import { groundAt, local } from "./siteLayout";

/**
 * The props on the site's ground. propsLayout lays them on a flat floor
 * (y 0, the board's ground frame); the site's apron is packed gravel a
 * few centimetres over the lot, rippled and rutted (siteLayout). Each
 * group of props that rests together (a sandbag ring, the wall, the
 * crates, the panel stack, every can and jerrycan) is lifted onto the
 * lowest ground under its footprint, so nothing floats over a hollow and
 * nothing sinks out of sight: the crates keep their skids, the cans their
 * feet, and the drum's cable lies on the gravel instead of under it.
 */

type Point = readonly [number, number];

/** The lowest ground under board-local points. */
function lowest(points: readonly Point[]): number {
  let low = Infinity;
  for (const [x, z] of points) {
    const p = local(x, z);
    low = Math.min(low, groundAt(p[0], p[2]));
  }
  return low;
}

/** A grid of points over a placed footprint, its corners and edges included. */
function footprint(p: Placed, hx: number, hz: number): Point[] {
  const out: Point[] = [];
  for (let a = -1; a <= 1; a += 0.25)
    for (let b = -1; b <= 1; b += 0.25) {
      const [x, , z] = orient([a * hx, 0, b * hz], p.yaw);
      out.push([p.p[0] + x, p.p[2] + z]);
    }
  return out;
}

const up = (p: Vec3, dy: number): Vec3 => [p[0], p[1] + dy, p[2]];
function lift<T extends Placed>(item: T, dy: number): T {
  return { ...item, p: up(item.p, dy) };
}

/** Which ring a bag belongs to (its leg's index), or -1 for the wall. */
function ringOf(p: Vec3): number {
  return LEGS.findIndex((x) => Math.hypot(p[0] - x, p[2] - LEG_Z) < 1.1);
}

/** The props for a tier, each group resting on the site's ground. */
export function settledProps(high: boolean): ArmyProps {
  const props = armyProps(high);
  // A ring, or the wall, rests on the lowest ground under any of its bags.
  const bagFeet = (group: number) =>
    props.bags.filter((b) => ringOf(b.p) === group).flatMap((b) => footprint(b, (BAG.length / 2) * b.s[0], (BAG.width / 2) * b.s[2]));
  const rings = LEGS.map((_, i) => lowest(bagFeet(i)));
  const wall = lowest(bagFeet(-1));
  const bagLift = (p: Vec3) => {
    const ring = ringOf(p);
    return ring >= 0 ? rings[ring] : wall;
  };

  // The ammunition point: the crates on the ground, and what stands on them takes the lift of what is under it.
  const ground = props.crates.filter((c) => c.p[1] === 0);
  const crateLift = new Map(ground.map((c) => [c, lowest(footprint(c, CRATE.length / 2, CRATE.depth / 2))] as const));
  const under = (p: Vec3) => {
    const below = ground.filter((c) => Math.hypot(c.p[0] - p[0], c.p[2] - p[2]) < CRATE.length * 0.75);
    return Math.max(...below.map((c) => crateLift.get(c) ?? 0));
  };
  const crates = props.crates.map((c) => lift(c, c.p[1] === 0 ? (crateLift.get(c) ?? 0) : under(c.p)));
  const cans = props.cans.map((c) => lift(c, c.p[1] === 0 ? lowest(footprint(c, CAN.length / 2, CAN.depth / 2)) : under(c.p)));
  const jerrycans = props.jerrycans.map((j) => lift(j, lowest(footprint(j, JERRY.width / 2, JERRY.depth / 2))));

  // The panel stack, its bearers and the panel leaning on it rest together.
  const mid = props.bearers[1];
  const stack = lowest([
    ...footprint({ p: mid.p, yaw: 0 }, PANEL.length / 2, BEARER.length / 2),
    [props.leaning.p[0] - PANEL.length / 2, props.leaning.p[2] + 0.3],
    [props.leaning.p[0] + PANEL.length / 2, props.leaning.p[2] + 0.3],
  ]);
  const drum = lowest(footprint(props.drum, DRUM.radius, DRUM.width / 2));

  // The cable: what lies on the ground follows the ground; what hangs off the drum moves with the drum.
  const r = props.cable[props.cable.length - 1][1];
  const cable = props.cable.map((p) => {
    if (p[1] > r + 1e-6) return up(p, drum);
    const q = local(p[0], p[2]);
    return up(p, groundAt(q[0], q[2]));
  });

  return {
    bags: props.bags.map((b) => lift(b, bagLift(b.p))),
    crates,
    cans,
    jerrycans,
    bearers: props.bearers.map((b) => lift(b, stack)),
    panels: props.panels.map((p) => lift(p, stack)),
    leaning: lift(props.leaning, stack),
    drum: lift(props.drum, drum),
    cable,
    pick: { ...lift(props.pick, bagLift(props.bags[props.pick.bag].p)), tip: up(props.pick.tip, bagLift(props.bags[props.pick.bag].p)) },
    shovel: lift(props.shovel, bagLift(props.bags[props.shovel.bag].p)),
  };
}

/** The ground under a bag's footprint, for the tests: the lowest and the highest point. */
export function groundUnder(p: Placed, hx: number, hz: number): { low: number; high: number } {
  const pts = footprint(p, hx, hz);
  let low = Infinity;
  let high = -Infinity;
  for (const [x, z] of pts) {
    const q = local(x, z);
    const g = groundAt(q[0], q[2]);
    low = Math.min(low, g);
    high = Math.max(high, g);
  }
  return { low, high };
}
