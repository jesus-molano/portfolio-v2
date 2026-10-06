import { describe, expect, it } from "vitest";
import { BAG, BEARER, CAN, CRATE, JERRY, type Placed, armyProps, orient, propFootprints } from "./propsLayout";
import { groundUnder, settledProps } from "./settle";
import { BOOM, BOOTH, CABINET, FENCE, HEDGEHOGS, SIGN, groundAt, local, rutAt, stones, toLocal, tufts } from "./siteLayout";

/** Board-local ground points over a footprint, every quarter of its half sizes. */
function samples(f: { x: number; z: number; hx: number; hz: number; yaw: number }): [number, number][] {
  const out: [number, number][] = [];
  for (let a = -1; a <= 1; a += 0.25)
    for (let b = -1; b <= 1; b += 0.25) {
      const [dx, , dz] = orient([a * f.hx, 0, b * f.hz], f.yaw);
      out.push([f.x + dx, f.z + dz]);
    }
  return out;
}

describe.each([true, false])("the army props on the site's ground (high tier: %s)", (high) => {
  const flat = armyProps(high);
  const props = settledProps(high);
  const feet = propFootprints(flat);

  it("keeps every prop off the lorry track's ruts", () => {
    for (const f of feet) {
      for (const [x, z] of samples(f)) {
        const p = local(x, z);
        expect(rutAt(p[0], p[2]).rut, `${f.x.toFixed(2)}, ${f.z.toFixed(2)}`).toBeLessThan(0.1);
      }
    }
  });

  it("rests every piece on the apron: never over a hollow, never sunk out of sight", () => {
    const check = (item: Placed, base: number, hx: number, hz: number) => {
      const { low, high: top } = groundUnder(item, hx, hz);
      expect(base).toBeLessThanOrEqual(low + 1e-9);
      expect(top - base).toBeLessThan(0.03);
    };
    for (const b of props.bags.filter((b) => b.course === 0)) check(b, b.p[1] - (BAG.height / 2) * b.s[1], (BAG.length / 2) * 0.8, (BAG.width / 2) * 0.8);
    props.crates.forEach((c, i) => {
      if (flat.crates[i].p[1] === 0) check(c, c.p[1], CRATE.length / 2, CRATE.depth / 2);
    });
    props.cans.forEach((c, i) => {
      if (flat.cans[i].p[1] === 0) check(c, c.p[1], CAN.length / 2, CAN.depth / 2);
    });
    for (const j of props.jerrycans) check(j, j.p[1], JERRY.width / 2, JERRY.depth / 2);
    for (const b of props.bearers) check(b, b.p[1], BEARER.size / 2, BEARER.length / 2);
  });

  it("keeps what is stacked on what is under it", () => {
    props.crates.forEach((c, i) => {
      if (flat.crates[i].p[1] === 0) return;
      const under = props.crates.filter((o, j) => flat.crates[j].p[1] === 0 && Math.hypot(o.p[0] - c.p[0], o.p[2] - c.p[2]) < CRATE.length * 0.75);
      expect(c.p[1]).toBeCloseTo(Math.max(...under.map((o) => o.p[1])) + CRATE.height, 9);
    });
    // The panels on their bearers, the pick and the shovel in their bags, all lifted as one.
    props.panels.forEach((p, i) => expect(p.p[1] - flat.panels[i].p[1]).toBeCloseTo(props.bearers[0].p[1], 9));
    expect(props.leaning.p[1] - flat.leaning.p[1]).toBeCloseTo(props.bearers[0].p[1], 9);
    expect(props.pick.p[1] - flat.pick.p[1]).toBeCloseTo(props.bags[props.pick.bag].p[1] - flat.bags[props.pick.bag].p[1], 9);
    expect(props.shovel.p[1] - flat.shovel.p[1]).toBeCloseTo(props.bags[props.shovel.bag].p[1] - flat.bags[props.shovel.bag].p[1], 9);
  });

  it("lays the drum's cable on the gravel, not under it", () => {
    const r = flat.cable[flat.cable.length - 1][1];
    for (const p of props.cable.slice(2)) {
      const q = local(p[0], p[2]);
      expect(p[1]).toBeCloseTo(groundAt(q[0], q[2]) + r, 9);
    }
  });
});

describe("the site's scatter and furniture round the props", () => {
  const feet = propFootprints(armyProps(true));
  const covered = (x: number, z: number, margin: number) => {
    const [lx, lz] = toLocal(x, z);
    return feet.some((f) => inside(f, lx, lz, margin));
  };
  const inside = (f: (typeof feet)[number], x: number, z: number, margin: number) => {
    const [lx, , lz] = orient([x - f.x, 0, z - f.z], -f.yaw);
    return Math.abs(lx) < f.hx + margin && Math.abs(lz) < f.hz + margin;
  };

  it("drops no stone or tuft into a prop", () => {
    for (const s of [...stones(260), ...tufts(90)]) expect(covered(s.p[0], s.p[2], 0.05)).toBe(false);
  });

  it("keeps the props clear of the cabinet, the sign, the fence, the hedgehogs and the checkpoint", () => {
    const points: [number, number, number][] = [
      [CABINET.at[0], CABINET.at[2], 0.5],
      [SIGN.at[0], SIGN.at[1], 0.6],
      [BOOTH.at[0], BOOTH.at[1], 1.2],
      [BOOM.post[0], BOOM.post[1], 0.4],
      [BOOM.rest[0], BOOM.rest[1], 0.4],
      ...HEDGEHOGS.map((h) => [h.at[0], h.at[1], 1.2] as [number, number, number]),
    ];
    for (const [x, z, r] of points) expect(covered(x, z, r)).toBe(false);
    for (const f of feet) expect(f.z - Math.max(f.hx, f.hz)).toBeGreaterThan(FENCE.z + 0.6);
  });
});
