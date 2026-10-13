import { type BufferGeometry, InstancedBufferAttribute } from "three";

/**
 * The geometry's per-instance attribute `name`, of `count` items of `size`
 * floats, for the caller to fill and flag (`needsUpdate`): the one it has,
 * written in place while the count holds. A new attribute on every layout
 * left the old one's GL buffer behind, since three frees an attribute's
 * buffer only with its geometry, never once it is replaced. When the count
 * changes, the geometry lets go of every buffer first (they upload again on
 * the next draw).
 */
export function instancedAttribute(geometry: BufferGeometry, name: string, count: number, size: number): InstancedBufferAttribute {
  const current = geometry.getAttribute(name);
  if (current instanceof InstancedBufferAttribute && current.count === count && current.itemSize === size) return current;
  if (current) geometry.dispose();
  const made = new InstancedBufferAttribute(new Float32Array(count * size), size);
  geometry.setAttribute(name, made);
  return made;
}
