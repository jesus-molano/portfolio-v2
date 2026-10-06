"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { Color, Euler, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type { Vec3 } from "../frame";

/** A box instance: centre, size, an optional rotation (Euler, radians) and colour. */
export type BoxItem = { p: Vec3; s: Vec3; r?: Vec3; color?: string };

/**
 * Many boxes in one draw: posts, chords, sandbags, kerbs. The material is
 * the child element, so each use picks its own look.
 */
export function Boxes({ items, children, geometry }: { items: BoxItem[]; children: ReactNode; geometry?: ReactNode }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const p = new Vector3();
    const s = new Vector3();
    const c = new Color();
    items.forEach((item, i) => {
      q.setFromEuler(e.set(...(item.r ?? [0, 0, 0])));
      m.compose(p.set(...item.p), q, s.set(...item.s));
      target.setMatrixAt(i, m);
      if (item.color) target.setColorAt(i, c.set(item.color));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} frustumCulled={false}>
      {geometry ?? <boxGeometry args={[1, 1, 1]} />}
      {children}
    </instancedMesh>
  );
}
