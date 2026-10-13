import { BufferAttribute, InstancedBufferAttribute, PlaneGeometry } from "three";
import { describe, expect, it } from "vitest";
import { instancedAttribute } from "./instancedAttribute";

/** A plane that counts its dispose events: the renderer frees every buffer of a geometry on one. */
function plane() {
  const geometry = new PlaneGeometry(1, 1);
  const disposed = { count: 0 };
  geometry.addEventListener("dispose", () => {
    disposed.count += 1;
  });
  return { geometry, disposed };
}

describe("instancedAttribute", () => {
  it("adds the attribute the first time, zeroed, without disposing anything", () => {
    const { geometry, disposed } = plane();
    const cells = instancedAttribute(geometry, "aCell", 5, 1);
    expect(cells).toBeInstanceOf(InstancedBufferAttribute);
    expect(geometry.getAttribute("aCell")).toBe(cells);
    expect(cells.count).toBe(5);
    expect(cells.itemSize).toBe(1);
    expect(Array.from(cells.array)).toEqual([0, 0, 0, 0, 0]);
    expect(disposed.count).toBe(0);
  });

  it("hands back the same attribute while the count and size hold: written in place, no buffer left behind", () => {
    const { geometry, disposed } = plane();
    const looks = instancedAttribute(geometry, "aLook", 4, 3);
    looks.setX(0, 1);
    expect(instancedAttribute(geometry, "aLook", 4, 3)).toBe(looks);
    expect(looks.getX(0)).toBe(1);
    expect(disposed.count).toBe(0);
  });

  it("frees the geometry's buffers before it replaces an attribute of another count or size", () => {
    const { geometry, disposed } = plane();
    const first = instancedAttribute(geometry, "aCell", 3, 1);
    const longer = instancedAttribute(geometry, "aCell", 6, 1);
    expect(longer).not.toBe(first);
    expect(longer.count).toBe(6);
    expect(geometry.getAttribute("aCell")).toBe(longer);
    expect(disposed.count).toBe(1);
    const wider = instancedAttribute(geometry, "aCell", 6, 2);
    expect(wider.itemSize).toBe(2);
    expect(disposed.count).toBe(2);
    // The plane's own attributes stay: they upload again on the next draw.
    expect(geometry.getAttribute("position")).toBeInstanceOf(BufferAttribute);
  });

  it("replaces a plain attribute of that name with an instanced one", () => {
    const { geometry, disposed } = plane();
    geometry.setAttribute("aCell", new BufferAttribute(new Float32Array(3), 1));
    const cells = instancedAttribute(geometry, "aCell", 3, 1);
    expect(cells).toBeInstanceOf(InstancedBufferAttribute);
    expect(disposed.count).toBe(1);
  });
});
