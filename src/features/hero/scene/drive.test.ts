import { BoxGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { tyreBottomY } from "./carModel";
import {
  CAR_POSITION,
  placeStreamed,
  ROADSIDE,
  ROADSIDE_LENGTH,
  STREAM,
  STREAM_LENGTH,
  streamFade,
  wrapZ,
} from "./drive";
import { world } from "./world";

describe("wrapZ", () => {
  it("keeps a value inside the stream window unchanged", () => {
    expect(wrapZ(0)).toBeCloseTo(0);
    expect(wrapZ(STREAM.zFront)).toBeCloseTo(STREAM.zFront);
    expect(wrapZ(STREAM.zBack - 1)).toBeCloseTo(STREAM.zBack - 1);
  });

  it("wraps values behind the camera back to the far edge", () => {
    expect(wrapZ(STREAM.zBack + 5)).toBeCloseTo(STREAM.zFront + 5);
    expect(wrapZ(10 + STREAM_LENGTH * 3)).toBeCloseTo(10);
  });

  it("wraps values beyond the far edge forward", () => {
    expect(wrapZ(STREAM.zFront - 5)).toBeCloseTo(STREAM.zBack - 5);
  });

  it("stays in the window after hours of driving", () => {
    // 18 m/s for 10 hours.
    const z = wrapZ(-40 + 18 * 3600 * 10);
    expect(z).toBeGreaterThanOrEqual(STREAM.zFront);
    expect(z).toBeLessThan(STREAM.zBack);
  });
});

describe("streamFade", () => {
  it("is 0 at the far edge and 1 well inside the window", () => {
    expect(streamFade(STREAM.zFront)).toBe(0);
    expect(streamFade(0)).toBe(1);
  });

  it("never decreases as a prop comes closer", () => {
    let previous = 0;
    for (let z = STREAM.zFront; z <= STREAM.zFront + 60; z += 1) {
      const value = streamFade(z);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("CAR_POSITION", () => {
  it("puts the hero car's tyres on the road surface, not into it", () => {
    expect(tyreBottomY(CAR_POSITION.y)).toBeCloseTo(world.road.y, 4);
  });
});

describe("stream windows", () => {
  it("wrap inside the window they are given", () => {
    expect(wrapZ(ROADSIDE.zBack + 3, ROADSIDE)).toBeCloseTo(ROADSIDE.zFront + 3);
    expect(wrapZ(ROADSIDE.zFront - 3, ROADSIDE)).toBeCloseTo(ROADSIDE.zBack - 3);
    expect(wrapZ(12 + ROADSIDE_LENGTH * 7, ROADSIDE)).toBeCloseTo(12);
  });

  it("fade over a chosen distance from the window's own far edge", () => {
    expect(streamFade(ROADSIDE.zFront, ROADSIDE, 45)).toBe(0);
    expect(streamFade(ROADSIDE.zFront + 45, ROADSIDE, 45)).toBe(1);
    expect(streamFade(ROADSIDE.zFront + 22.5, ROADSIDE, 45)).toBeCloseTo(0.5);
  });
});

describe("placeStreamed", () => {
  const read = (mesh: InstancedMesh, index: number) => {
    const matrix = new Matrix4();
    mesh.getMatrixAt(index, matrix);
    const position = new Vector3();
    const scale = new Vector3();
    matrix.decompose(position, new Quaternion(), scale);
    return { position, scale };
  };

  it("keeps full size at the far edge without the grow-in, and writes the twins after the stream", () => {
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 2);
    const list = [{ x: 3, z0: ROADSIDE.zFront }];
    const fixed = [{ x: -3, z0: -170 }];
    placeStreamed(mesh, list, 0, { window: ROADSIDE, grow: false, fixed });
    const streamed = read(mesh, 0);
    expect(streamed.position.z).toBeCloseTo(ROADSIDE.zFront);
    expect(streamed.scale.x).toBeCloseTo(1);
    const twin = read(mesh, 1);
    expect(twin.position.x).toBeCloseTo(-3);
    expect(twin.position.z).toBeCloseTo(-170);
    expect(twin.scale.x).toBeCloseTo(1);
  });

  it("grows in from the far edge by default", () => {
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
    placeStreamed(mesh, [{ x: 0, z0: STREAM.zFront }], 0);
    expect(read(mesh, 0).scale.x).toBeLessThan(0.01);
  });
});
