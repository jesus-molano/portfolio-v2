import { describe, expect, it } from "vitest";
import { toSet } from "../../boardFrame";
import type { Vec3 } from "../../frame";
import {
  BAG,
  BEARER,
  CAN,
  CRATE,
  DRUM,
  JERRY,
  LEAN,
  LEGS,
  LEG_Z,
  PANEL,
  PICK,
  POST,
  type Placed,
  armyProps,
  bagTop,
  leanPanel,
  orient,
} from "./propsLayout";

/** ArmySet's board frame (centre, yaw), on the ground. */
const FRAME = { centre: [11, 0, -13] as Vec3, yaw: -Math.PI / 9, w: 16, h: 7 };
/** The far kerb of the road (ArmySet's kerbs.far) and the guard rail behind it. */
const RAIL_Z = -5.9;
/** The catwalk under the board's face (board bottom 3.5 m less the 1.15 m drop). */
const CATWALK_Y = 7 - 3.5 - 1.15;

type Rect = { x: number; z: number; hx: number; hz: number; yaw: number };

/** The corners of a footprint rectangle (half sizes along its own x and z) turned by its yaw. */
function corners(r: Rect): [number, number][] {
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) => {
    const [x, , z] = orient([sx * r.hx, 0, sz * r.hz], r.yaw);
    return [r.x + x, r.z + z];
  });
}

/** Separating-axis test for two turned rectangles on the ground. */
function overlap(a: Rect, b: Rect): boolean {
  const pa = corners(a);
  const pb = corners(b);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 4; i += 1) {
      const [x0, z0] = poly[i];
      const [x1, z1] = poly[(i + 1) % 4];
      const n = [z1 - z0, x0 - x1];
      const project = (p: [number, number][]) => p.map(([x, z]) => x * n[0] + z * n[1]);
      const ra = project(pa);
      const rb = project(pb);
      if (Math.max(...ra) <= Math.min(...rb) || Math.max(...rb) <= Math.min(...ra)) return false;
    }
  }
  return true;
}

const foot = (p: Placed, hx: number, hz: number): Rect => ({ x: p.p[0], z: p.p[2], hx, hz, yaw: p.yaw });
const legs: Rect[] = LEGS.map((x) => ({ x, z: LEG_Z, hx: POST.half, hz: POST.plateHalf, yaw: 0 }));

describe.each([true, false])("army props (high tier: %s)", (high) => {
  const props = armyProps(high);

  it("is deterministic", () => {
    expect(armyProps(high)).toEqual(props);
  });

  it("lays every bag on the ground or on the course below, flat side down", () => {
    for (const b of props.bags) {
      const bottom = b.p[1] - (BAG.height / 2) * b.s[1];
      expect(bottom).toBeGreaterThanOrEqual(-1e-9);
      if (b.course === 0) expect(bottom).toBeLessThan(1e-6);
      else {
        // Something of the course below under it.
        const below = props.bags.filter((o) => o.course === b.course - 1 && Math.hypot(o.p[0] - b.p[0], o.p[2] - b.p[2]) < BAG.length * 0.75);
        expect(below.length).toBeGreaterThan(0);
        expect(bottom).toBeLessThan(Math.max(...below.map(bagTop)));
      }
    }
  });

  it("keeps the bags off the board's legs and the bags of one course from piling into each other", () => {
    for (const b of props.bags) {
      const r = foot(b, (BAG.length / 2) * b.s[0] * 0.8, (BAG.width / 2) * b.s[2] * 0.9);
      for (const leg of legs) expect(overlap(r, leg)).toBe(false);
    }
    for (let i = 0; i < props.bags.length; i += 1) {
      for (let j = i + 1; j < props.bags.length; j += 1) {
        const a = props.bags[i];
        const b = props.bags[j];
        if (a.course !== b.course) continue;
        // Their bellies (the middle of each bag) never share ground; the soft ends may touch.
        expect(overlap(foot(a, BAG.length * 0.3, BAG.width * 0.38), foot(b, BAG.length * 0.3, BAG.width * 0.38))).toBe(false);
      }
    }
  });

  it("stands the kit apart: no two pieces, no piece and a sandbag, no piece and a leg share ground", () => {
    const kit: [string, Rect][] = [
      ...props.crates.filter((c) => c.p[1] === 0).map((c, i) => [`crate${i}`, foot(c, CRATE.length / 2 + 0.07, CRATE.depth / 2)] as [string, Rect]),
      ...props.cans.filter((c) => c.p[1] === 0).map((c, i) => [`can${i}`, foot(c, CAN.length / 2 + 0.01, CAN.depth / 2)] as [string, Rect]),
      ...props.jerrycans.map((c, i) => [`jerrycan${i}`, foot(c, JERRY.width / 2, JERRY.depth / 2)] as [string, Rect]),
      ["drum", foot(props.drum, DRUM.radius, DRUM.width / 2 + 0.03)],
      ["stack", { x: props.bearers[1].p[0], z: props.bearers[1].p[2], hx: PANEL.length / 2 + 0.12, hz: BEARER.length / 2, yaw: 0 }],
      ["leaning", { x: props.leaning.p[0], z: props.leaning.p[2] + 0.2, hx: PANEL.length / 2 + 0.07, hz: 0.25, yaw: 0 }],
    ];
    for (let i = 0; i < kit.length; i += 1) {
      for (let j = i + 1; j < kit.length; j += 1) {
        if (kit[i][0] === "stack" && kit[j][0] === "leaning") continue;
        expect(overlap(kit[i][1], kit[j][1]), `${kit[i][0]} / ${kit[j][0]}`).toBe(false);
      }
      for (const leg of legs) expect(overlap(kit[i][1], leg), kit[i][0]).toBe(false);
      for (const b of props.bags) expect(overlap(kit[i][1], foot(b, BAG.length / 2, BAG.width / 2)), kit[i][0]).toBe(false);
    }
  });

  it("stacks crates and cans on what is under them", () => {
    for (const c of [...props.crates, ...props.cans]) {
      if (c.p[1] === 0) continue;
      expect(c.p[1]).toBeCloseTo(CRATE.height);
      const under = props.crates.filter((o) => o.p[1] === 0 && Math.hypot(o.p[0] - c.p[0], o.p[2] - c.p[2]) < CRATE.depth);
      expect(under.length).toBeGreaterThan(0);
    }
    for (const [i, panel] of props.panels.entries()) expect(panel.p[1]).toBeCloseTo(BEARER.size + i * PANEL.depth);
  });

  it("leans the standing panel on the stack's top edge with its lowest corner on the ground", () => {
    const top = props.panels[props.panels.length - 1];
    const edge: Vec3 = [0, top.p[1] + PANEL.depth, top.p[2] + PANEL.width / 2];
    const { p, roll } = props.leaning;
    // Lowest corner: the far chord's back edge.
    const low = orient([0, PANEL.depth, -PANEL.width / 2], 0, 0, roll);
    expect(p[1] + low[1]).toBeCloseTo(0, 6);
    // The back face passes through the stack's edge.
    const back = orient([0, 1, 0], 0, 0, roll);
    const zAxis = orient([0, 0, 1], 0, 0, roll);
    const rel: Vec3 = [0, edge[1] - p[1], edge[2] - p[2]];
    expect(rel[1] * back[1] + rel[2] * back[2]).toBeCloseTo(PANEL.depth, 6);
    const along = rel[1] * zAxis[1] + rel[2] * zAxis[2];
    expect(Math.abs(along)).toBeLessThan(PANEL.width / 2);
    expect(zAxis[1]).toBeCloseTo(Math.cos(LEAN));
    // It stands clear of the bearers' ends.
    const front = orient([0, 0, -PANEL.width / 2], 0, 0, roll);
    expect(p[2] + front[2]).toBeGreaterThan(props.bearers[0].p[2] + BEARER.length / 2);
    expect(leanPanel(edge[1], edge[2], 0).p[1]).toBeCloseTo(p[1]);
  });

  it("drives the pick's point and the shovel's blade into a top bag, and only into it", () => {
    const pickBag = props.bags[props.pick.bag];
    const { tip } = props.pick;
    expect(tip[1]).toBeLessThan(bagTop(pickBag));
    expect(tip[1]).toBeGreaterThan(pickBag.p[1] - BAG.height / 2);
    expect(Math.hypot(tip[0] - pickBag.p[0], tip[2] - pickBag.p[2])).toBeLessThan(BAG.width / 2);
    const tipFromHead = orient([-PICK.point, 0, 0], props.pick.yaw, props.pick.tilt);
    expect(props.pick.p[0] + tipFromHead[0]).toBeCloseTo(tip[0]);
    // The haft leans along the ring, away from the leg.
    const haftEnd = orient([0, PICK.haft, 0], props.pick.yaw, props.pick.tilt);
    const end: Vec3 = [props.pick.p[0] + haftEnd[0], props.pick.p[1] + haftEnd[1], props.pick.p[2] + haftEnd[2]];
    expect(Math.hypot(end[0], end[2] - LEG_Z)).toBeGreaterThan(POST.plateHalf + 0.2);
    expect(end[1]).toBeGreaterThan(bagTop(pickBag));
    const shovelBag = props.bags[props.shovel.bag];
    expect(props.shovel.p[1]).toBeLessThan(bagTop(shovelBag));
    expect(props.shovel.p[1]).toBeGreaterThan(shovelBag.p[1] - BAG.height / 2);
  });

  it("keeps everything low, under the catwalk and the board's foot copy", () => {
    expect(Math.max(...props.bags.map(bagTop))).toBeLessThan(0.6);
    expect(CRATE.height * 2 + CAN.height).toBeLessThan(1.2);
    expect(props.leaning.p[1] + orient([0, 0, PANEL.width / 2], 0, 0, props.leaning.roll)[1]).toBeLessThan(CATWALK_Y - 0.6);
    const haftEnd = orient([0, PICK.haft, 0], props.pick.yaw, props.pick.tilt);
    expect(props.pick.p[1] + haftEnd[1]).toBeLessThan(CATWALK_Y - 0.6);
  });

  it("keeps the whole site on the lot, behind the guard rail", () => {
    const points: Vec3[] = [
      ...props.bags.map((b) => b.p),
      ...props.crates.flatMap((c) => corners(foot(c, CRATE.length / 2, CRATE.depth / 2)).map(([x, z]) => [x, 0, z] as Vec3)),
      ...props.jerrycans.map((j) => j.p),
      props.drum.p,
      [props.leaning.p[0] - PANEL.length / 2, 0, props.leaning.p[2] + 0.3],
      [props.leaning.p[0] + PANEL.length / 2, 0, props.leaning.p[2] + 0.3],
      ...props.cable,
    ];
    for (const p of points) expect(toSet(FRAME, p)[2]).toBeLessThan(RAIL_Z - 2);
  });

  it("runs the drum's cable on the ground from the drum to the middle leg's bags", () => {
    const { cable, drum } = props;
    expect(Math.hypot(cable[0][0] - drum.p[0], cable[0][2] - drum.p[2])).toBeLessThan(DRUM.radius);
    for (const p of cable.slice(2)) expect(p[1]).toBeCloseTo(0.016);
    const last = cable[cable.length - 1];
    expect(Math.hypot(last[0], last[2] - LEG_Z)).toBeLessThan(0.8);
  });
});

describe("army props, per tier", () => {
  it("lays fewer bags and less kit on the low tier", () => {
    const high = armyProps(true);
    const low = armyProps(false);
    expect(low.bags.length).toBeLessThan(high.bags.length * 0.6);
    expect(low.cans.length).toBeLessThan(high.cans.length);
    expect(low.panels.length).toBeLessThan(high.panels.length);
  });

  it("damps some bags, more of them on the ground course", () => {
    const { bags } = armyProps(true);
    const damp = (b: (typeof bags)[number]) => b.tint[0] < 0.5;
    expect(bags.filter(damp).length).toBeGreaterThan(3);
    expect(bags.filter((b) => b.course === 0 && damp(b)).length).toBeGreaterThan(bags.filter((b) => b.course === 2 && damp(b)).length);
  });
});
