import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from "three";
import { describe, expect, it, vi } from "vitest";
import { cloneOwned } from "./cloneBare";

function cached() {
  const map = new Texture();
  const material = new MeshStandardMaterial({ map, roughness: 0.4 });
  const uniforms = { uPaint: { value: 1 } };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = () => undefined;
  const geometry = new BoxGeometry();
  const root = new Group();
  root.userData.live = { keep: true };
  root.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
  return { root, map, material, geometry, uniforms };
}

describe("cloneOwned", () => {
  it("gives the copy geometries, materials and textures of its own over the same data", () => {
    const { root, map, material, geometry, uniforms } = cached();
    const { object } = cloneOwned(root);
    const [a, b] = object.children as Mesh[];
    expect(a.geometry).not.toBe(geometry);
    expect(a.geometry).toBe(b.geometry);
    // The data is shared, not copied.
    expect(a.geometry.attributes.position).toBe(geometry.attributes.position);
    expect(a.geometry.index).toBe(geometry.index);
    expect(a.geometry.groups).toEqual(geometry.groups);
    const own = a.material as MeshStandardMaterial;
    expect(own).not.toBe(material);
    expect((b.material as MeshStandardMaterial[])[0]).toBe(own);
    expect(own.roughness).toBe(0.4);
    // The hero's shader hook and live uniforms come along by reference.
    expect(own.onBeforeCompile).toBe(material.onBeforeCompile);
    expect(own.userData.uniforms).toBe(uniforms);
    expect(own.map).not.toBe(map);
    expect(own.map?.source).toBe(map.source);
    // The cached scene keeps its own userData and resources.
    expect(root.userData.live).toEqual({ keep: true });
    expect((root.children[0] as Mesh).material).toBe(material);
  });

  it("disposes only its own copies", () => {
    const { root, map, material, geometry } = cached();
    const owned = cloneOwned(root);
    const original = vi.fn();
    for (const resource of [map, material, geometry]) resource.addEventListener("dispose", original);
    const mesh = owned.object.children[0] as Mesh;
    const own = mesh.material as MeshStandardMaterial;
    const copies = vi.fn();
    for (const resource of [own.map!, own, mesh.geometry]) resource.addEventListener("dispose", copies);
    owned.dispose();
    expect(copies).toHaveBeenCalledTimes(3);
    expect(original).not.toHaveBeenCalled();
  });
});
