import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Euler, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  APRON,
  APRON_OUTLINE,
  APRON_Y,
  BOOM,
  BOOTH,
  CABINET,
  CABLE_RADIUS,
  CLIMB,
  FENCE,
  HEDGEHOG,
  JUNCTION,
  LEG_BASES,
  LEG_Z,
  LOT_Y,
  RAMP,
  ROAD,
  SIGN,
  SITE_FRAME,
  apronHeight,
  barbedStrands,
  boomAngle,
  cablePaths,
  concertina,
  fencePickets,
  groundAt,
  hedgehogBeams,
  kerbStones,
  polygonDepth,
  rutAt,
  scrub,
  stones,
  toLocal,
  tufts,
} from "./siteLayout";

const ARMY_SET = readFileSync(fileURLToPath(new URL("../ArmySet.tsx", import.meta.url)), "utf8");

/** The car's footprint at its stop line and as it rolls through (carPath: x from -30 to 8, about 4.5 x 1.9 m). */
const CAR = { halfWidth: 1.0, x0: -33, x1: 11 } as const;

function boxCorners(item: { p: readonly number[]; s: readonly number[]; r?: readonly number[] }): Vector3[] {
  const q = new Quaternion().setFromEuler(new Euler(...((item.r ?? [0, 0, 0]) as [number, number, number])));
  const out: Vector3[] = [];
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5])
        out.push(new Vector3(sx * item.s[0], sy * item.s[1], sz * item.s[2]).applyQuaternion(q).add(new Vector3(...(item.p as [number, number, number]))));
  return out;
}

describe("the army site's layout", () => {
  it("uses ArmySet's board frame", () => {
    const match = ARMY_SET.match(/const FRAME: BoardFrame = \{ centre: \[([^\]]+)\], yaw: -Math\.PI \/ (\d+), w: (\d+), h: (\d+) \}/);
    expect(match).not.toBeNull();
    const [, centre, yaw, w, h] = match as RegExpMatchArray;
    expect(centre.split(",").map(Number)).toEqual([...SITE_FRAME.centre]);
    expect(SITE_FRAME.yaw).toBeCloseTo(-Math.PI / Number(yaw), 12);
    expect([SITE_FRAME.w, SITE_FRAME.h]).toEqual([Number(w), Number(h)]);
  });

  it("is deterministic", () => {
    expect(stones(120)).toEqual(stones(120));
    expect(tufts(60)).toEqual(tufts(60));
    expect(scrub(12)).toEqual(scrub(12));
    expect(cablePaths()).toEqual(cablePaths());
    expect(concertina()).toEqual(concertina());
  });

  it("keeps the apron behind the kerb, except where the ramp crosses it", () => {
    for (const [x, z] of APRON_OUTLINE) {
      const onRamp = x >= RAMP.x0 - 0.4 && x <= RAMP.x1 + 0.4;
      expect(z).toBeLessThanOrEqual(onRamp ? RAMP.toe + 1e-9 : ROAD.kerbBack);
      expect(x).toBeGreaterThanOrEqual(APRON.x0);
      expect(x).toBeLessThanOrEqual(APRON.x1);
      expect(z).toBeGreaterThanOrEqual(APRON.z0);
    }
  });

  it("lays the apron over the lot (no z-fighting) and the ramp over the kerb", () => {
    for (let x = APRON.x0; x <= APRON.x1; x += 0.37) {
      for (let z = APRON.z0; z <= ROAD.kerbBack; z += 0.31) {
        if (polygonDepth([x, z], APRON_OUTLINE) < 0) continue;
        expect(apronHeight(x, z)).toBeGreaterThanOrEqual(LOT_Y + 0.004);
      }
    }
    for (let x = RAMP.x0; x <= RAMP.x1; x += 0.1) {
      for (let z = ROAD.kerbBack; z <= ROAD.far; z += 0.05) expect(apronHeight(x, z)).toBeGreaterThan(ROAD.kerbTop + 0.015);
      expect(apronHeight(x, RAMP.toe)).toBeGreaterThan(0.005);
    }
    expect(apronHeight(8, -14)).toBeCloseTo(APRON_Y, 1);
    expect(apronHeight(6.7, -10.2 + 0.85)).toBeLessThan(APRON_Y - 0.012);
  });

  it("ruts the track and keeps the scatter off it", () => {
    expect(rutAt(6.7, -10.2 + 0.85).rut).toBeGreaterThan(0.9);
    for (const t of [...stones(260), ...tufts(90)]) expect(rutAt(t.p[0], t.p[2]).rut).toBeLessThan(0.21);
  });

  it("puts nothing on the road or in the car's way", () => {
    const off = [...stones(260), ...tufts(90), ...scrub(18), ...fencePickets(), ...hedgehogBeams()];
    for (const item of off) expect(item.p[2]).toBeLessThan(ROAD.kerbBack);
    expect(SIGN.at[1]).toBeLessThan(ROAD.kerbBack - 0.5);
    for (const stone of kerbStones()) expect(stone.p[2]).toBeCloseTo((ROAD.far + ROAD.kerbBack) / 2, 1);
    // The sentry box stands on the near verge, behind the near kerb.
    expect(BOOTH.at[1] - BOOTH.size / 2).toBeGreaterThan(ROAD.near + 0.35 + 0.2);
    // The boom's post and counterweight on the verge, its rest fork clear of the car's lane.
    expect(BOOM.post[1]).toBeGreaterThan(ROAD.near + 0.35);
    expect(Math.abs(BOOM.rest[1])).toBeGreaterThan(CAR.halfWidth + 0.5);
    expect(BOOM.pivot[2] - BOOM.reach).toBeLessThan(-CAR.halfWidth - 0.6);
    // The booth clears the counterweight's swing and the post.
    expect(BOOTH.at[0] - BOOTH.size / 2).toBeGreaterThan(BOOM.post[0] + 0.3);
  });

  it("lifts the boom exactly as the old barrier did", () => {
    const leave = { from: 0.4, to: 0.5 };
    expect(boomAngle(0.39, leave)).toBe(0);
    expect(boomAngle(0.44, leave)).toBeCloseTo((80 * Math.PI) / 180, 12);
    expect(boomAngle(0.49, leave)).toBeCloseTo((80 * Math.PI) / 180, 12);
    const u = 0.5;
    expect(boomAngle(0.4 + 0.04 * u, leave)).toBeCloseTo(((80 * Math.PI) / 180) * u * u * (3 - 2 * u), 12);
  });

  it("swings the counterweight clear of the ground and the post", () => {
    // At full lift the tail points down and toward +z: its far end stays over the verge.
    const a = BOOM.lift;
    const endY = BOOM.pivot[1] - BOOM.tail * Math.sin(a) - 0.14 * Math.cos(a);
    expect(endY).toBeGreaterThan(ROAD.kerbTop + 0.02);
    // The arm runs in x = 3 ± tube, the post beside it.
    expect(BOOM.post[0] - 0.08).toBeGreaterThan(BOOM.pivot[0] + BOOM.tube + 0.03);
  });

  it("stands the hedgehogs on their ends", () => {
    const beams = hedgehogBeams();
    for (let i = 0; i < beams.length; i += 3) {
      const corners = beams.slice(i, i + 3).flatMap(boxCorners);
      const low = Math.min(...corners.map((c) => c.y));
      const ground = groundAt(beams[i].p[0], beams[i].p[2]);
      expect(low).toBeGreaterThan(ground - 0.06);
      expect(low).toBeLessThan(ground + 0.01);
      expect(Math.max(...corners.map((c) => c.y))).toBeLessThan(HEDGEHOG.beam * 0.75);
    }
  });

  it("keeps the perimeter behind the board, and low", () => {
    for (const picket of fencePickets()) {
      expect(toLocal(picket.p[0], picket.p[2])[1]).toBeLessThan(-4);
      expect(picket.p[1] + picket.s[1] / 2).toBeLessThan(1.4);
    }
    for (const p of [...concertina(), ...barbedStrands()]) {
      expect(p[1]).toBeGreaterThan(LOT_Y);
      expect(p[1]).toBeLessThan(FENCE.height + 0.05);
    }
  });

  it("runs the cables on the ground and up the legs without passing through the steel", () => {
    const paths = cablePaths();
    expect(paths).toHaveLength(4);
    for (const path of paths) {
      for (const p of path) {
        if (p[1] < 0.5) {
          expect(p[1]).toBeGreaterThanOrEqual(groundAt(p[0], p[2]) + CABLE_RADIUS * 0.8);
          expect(p[1]).toBeLessThan(groundAt(p[0], p[2]) + 0.2);
        }
        const [lx, lz] = toLocal(p[0], p[2]);
        // Never inside a post (0.36 square) or its web plate (0.1 x 0.6) or the braces' back face.
        for (const legX of [-6, 0, 6]) {
          const inPost = Math.abs(lx - legX) < 0.18 + CABLE_RADIUS && Math.abs(lz - LEG_Z) < 0.18 + CABLE_RADIUS;
          const inPlate = Math.abs(lx - legX) < 0.05 + CABLE_RADIUS && Math.abs(lz - LEG_Z) < 0.3 + CABLE_RADIUS;
          expect(inPost || inPlate).toBe(false);
        }
        expect(lz < -0.76 - CABLE_RADIUS || lz > -0.64 + CABLE_RADIUS || p[1] < 0.75).toBe(true);
      }
    }
    // Each climb ends inside its junction box.
    expect(CLIMB[1]).toBeGreaterThan(JUNCTION.z - JUNCTION.size[2] / 2 + CABLE_RADIUS);
    expect(CLIMB[1]).toBeLessThan(JUNCTION.z + JUNCTION.size[2] / 2 - CABLE_RADIUS);
  });

  it("keeps stones, tufts and scrub off the legs, the cabinet and each other's scrub", () => {
    for (const s of [...stones(260), ...tufts(90)]) {
      for (const [x, z] of LEG_BASES) expect(Math.hypot(s.p[0] - x, s.p[2] - z)).toBeGreaterThan(1.4);
      expect(Math.hypot(s.p[0] - CABINET.at[0], s.p[2] - CABINET.at[2])).toBeGreaterThan(0.6);
    }
    for (const bush of scrub(18)) expect(polygonDepth([bush.p[0], bush.p[2]], APRON_OUTLINE)).toBeLessThan(-0.4);
  });
});
