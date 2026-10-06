import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  Euler,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Vec3 } from "../../frame";
import { KIT_ATLAS, type KitPart, uvRect } from "../art/armyProps";
import { BAG, BEARER, CAN, CRATE, DRUM, JERRY, PANEL, PICK, SHOVEL } from "./propsLayout";

/**
 * Geometry for the army stop's props: low-poly but shaped like the real
 * thing, each piece one merged buffer whose faces map into the kit atlas
 * (art/armyProps.ts), so every crate, can, panel or tool is one instanced
 * draw under one material. Origins sit on the ground (y 0) unless noted.
 */

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const signedPow = (t: number, k: number) => Math.sign(t) * Math.abs(t) ** k;

/**
 * A filled sandbag: a sphere pulled into a pillow (flat underside, a soft
 * belly, a squared top), its tied end (+x) choked at the neck and flopped
 * down into a flat ear, its sewn end (-x) pressed thin with dog-eared
 * corners. Centred on its middle, BAG.length x BAG.height x BAG.width; the
 * bottom is flat at -height/2. The sphere's seam lies on the underside,
 * its poles at the ends, so the hessian gathers into them. Ambient
 * occlusion in the vertex colours (dark underneath and at the neck).
 * Each variant has its own lumps and slump.
 */
export function sandbagGeometry(variant: number, high: boolean): BufferGeometry {
  const geometry = new SphereGeometry(1, high ? 18 : 12, high ? 12 : 8);
  // Poles from y onto -x/+x, the seam (phi 0) onto the underside.
  geometry.rotateZ(Math.PI / 2);
  const pos = geometry.getAttribute("position");
  const colors: number[] = [];
  const hl = BAG.length / 2;
  const hh = BAG.height / 2;
  const hw = BAG.width / 2;
  const phase = variant * 2.1 + 0.4;
  for (let i = 0; i < pos.count; i += 1) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const X = signedPow(px, 0.42);
    let Y = signedPow(py, 0.7);
    let Z = signedPow(pz, 0.5);
    // A soft belly, a squarer top.
    Z *= 1 + 0.07 * (1 - X * X);
    if (Y > 0) Y *= 0.9 - 0.08 * X * X;
    // The tied end: choked at the neck, then the gathered ear, flat and flopped down.
    // (The superellipse crowds the sphere's rings toward the ends: X 0.87, 0.94, 0.985 on the high tier.)
    const neck = smoothstep(0.78, 0.94, X);
    const ear = smoothstep(0.95, 1, X);
    Y *= 1 - 0.68 * neck + 0.1 * ear;
    Z *= 1 - 0.62 * neck + 1.05 * ear;
    let drop = -0.42 * neck;
    // The sewn end: pressed thin, its corners dog-eared out a little.
    const sewn = smoothstep(0.85, 1, -X);
    Y *= 1 - 0.8 * sewn;
    Z *= 1 + 0.1 * sewn;
    drop -= 0.18 * sewn;
    // Lumps of sand under the cloth.
    const lump = 0.08 * Math.sin(X * 7.3 + phase) * Math.cos(Z * 5.1 - phase) + 0.04 * Math.sin(X * 13 + Z * 9 + phase * 2);
    if (Y > 0) Y += lump;
    // The sand slumps to one side in some bags.
    Y += 0.06 * Math.sin(phase * 1.7) * Z * Math.max(Y, 0);
    const x = X * hl * 1.0;
    // The underside lies flat on whatever is below.
    const y = Math.max(-hh, (Y + drop) * hh);
    const z = Z * hw;
    pos.setXYZ(i, x, y, z);
    const ao = 0.5 + 0.5 * smoothstep(-hh, hh * 0.5, y);
    const neckShade = 1 - 0.28 * neck * (1 - ear) - 0.15 * sewn;
    const shade = ao * neckShade;
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------- atlas helpers */

type FaceParts = KitPart | [KitPart, KitPart, KitPart, KitPart, KitPart, KitPart];

/** Maps a geometry's uv (0..1) into atlas regions, per draw group (a box's faces: +x -x +y -y +z -z; a cylinder's: side, top, bottom). */
function mapUv(geometry: BufferGeometry, parts: KitPart | KitPart[]): BufferGeometry {
  const uv = geometry.getAttribute("uv");
  const list = Array.isArray(parts) ? parts : [parts];
  const owner = new Int32Array(uv.count).fill(0);
  const index = geometry.getIndex();
  if (index && geometry.groups.length > 1) {
    geometry.groups.forEach((group, g) => {
      for (let k = group.start; k < group.start + group.count; k += 1) owner[index.getX(k)] = Math.min(g, list.length - 1);
    });
  }
  for (let i = 0; i < uv.count; i += 1) {
    const r = uvRect(KIT_ATLAS[list[owner[i]]]);
    uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
  }
  geometry.clearGroups();
  return geometry;
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler();

/** A box at a centre, with an optional Euler rotation, its faces in the atlas. */
function box(size: Vec3, centre: Vec3, parts: FaceParts, rotation: Vec3 = [0, 0, 0]): BufferGeometry {
  const g = mapUv(new BoxGeometry(...size), parts);
  g.applyMatrix4(m4.compose(new Vector3(...centre), q.setFromEuler(e.set(...rotation)), new Vector3(1, 1, 1)));
  return g;
}

/** A cylinder along y (or turned by `rotation`), side and caps in the atlas. */
function cylinder(
  radii: [number, number],
  height: number,
  centre: Vec3,
  parts: KitPart | [KitPart, KitPart, KitPart],
  rotation: Vec3 = [0, 0, 0],
  segments = 10,
  open = false,
): BufferGeometry {
  const g = mapUv(new CylinderGeometry(radii[0], radii[1], height, segments, 1, open), parts);
  g.applyMatrix4(m4.compose(new Vector3(...centre), q.setFromEuler(e.set(...rotation)), new Vector3(1, 1, 1)));
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("army props: geometry merge failed");
  merged.computeBoundingSphere();
  return merged;
}

/* ------------------------------------------------------------ the crate */

/**
 * A large ammunition crate: the planked body (sides stencilled, ends with
 * the up arrows), a lid a hair proud of it, end cleats framing each end,
 * corner battens on the long sides, two skids, two hinges at the back,
 * two hasps at the front and a rope handle at each end. Length along x,
 * the stencilled front (variant's side) facing +z.
 */
export function crateGeometry(variant: 0 | 1, high: boolean): BufferGeometry {
  const { length, depth, skid, lid } = CRATE;
  const bodyH = CRATE.height - skid - lid;
  const bodyL = length - 0.08;
  const bodyY = skid + bodyH / 2;
  const front: KitPart = variant === 0 ? "sideA" : "sideB";
  const back: KitPart = variant === 0 ? "sideB" : "sideA";
  const parts: BufferGeometry[] = [
    box([bodyL, bodyH, depth - 0.02], [0, bodyY, 0], ["end", "end", "batten", "batten", front, back]),
    box([bodyL + 0.02, lid, depth], [0, skid + bodyH + lid / 2, 0], ["batten", "batten", "lid", "batten", "batten", "batten"]),
  ];
  // Skids, across the ends' cleats' length.
  for (const z of [-0.14, 0.14]) parts.push(box([length - 0.02, skid, 0.07], [0, skid / 2, z], "timber"));
  // End cleats: a frame on each end, 4 cm proud.
  for (const sx of [-1, 1]) {
    const x = sx * (bodyL / 2 + 0.02);
    parts.push(box([0.04, 0.05, depth], [x, skid + bodyH - 0.025 + lid, 0], "batten"));
    parts.push(box([0.04, 0.05, depth], [x, skid + 0.025, 0], "batten"));
    for (const sz of [-1, 1]) parts.push(box([0.04, bodyH + lid - 0.1, 0.05], [x, bodyY + lid / 2, sz * (depth / 2 - 0.025)], "batten"));
    // Corner battens on the long sides, 2 cm proud.
    if (high) for (const sz of [-1, 1]) parts.push(box([0.06, bodyH - 0.01, 0.02], [sx * (bodyL / 2 - 0.03), bodyY, sz * (depth / 2)], "batten"));
  }
  if (high) {
    // Hinges at the back, hasps and staples at the front.
    for (const x of [-0.27, 0.27]) {
      parts.push(cylinder([0.012, 0.012], 0.09, [x, skid + bodyH + 0.004, -depth / 2 - 0.008], "iron", [0, 0, Math.PI / 2], 6));
      parts.push(box([0.07, 0.006, 0.05], [x, skid + bodyH + lid + 0.003, -depth / 2 + 0.02], "iron"));
    }
    for (const x of [-0.3, 0.3]) {
      const face = (depth - 0.02) / 2;
      parts.push(box([0.045, 0.085, 0.01], [x, skid + bodyH - 0.01, face + 0.005], "iron"));
      parts.push(box([0.016, 0.03, 0.016], [x, skid + bodyH - 0.045, face + 0.018], "iron"));
    }
    // Rope handles: a loop hanging from two becket blocks on each end.
    for (const sx of [-1, 1]) {
      const x = sx * (bodyL / 2 + 0.06);
      const y = skid + bodyH * 0.72;
      for (const sz of [-1, 1]) parts.push(box([0.07, 0.05, 0.04], [sx * (bodyL / 2 + 0.035), y, sz * 0.085], "batten"));
      const loop = mapUv(new TorusGeometry(0.085, 0.011, 5, 10, Math.PI), "rope");
      loop.rotateZ(Math.PI);
      loop.rotateY(Math.PI / 2);
      // A rope hangs a little out from the end, not flat on it.
      loop.rotateZ(sx * 0.25);
      loop.translate(x, y - 0.005, 0);
      parts.push(loop);
    }
  }
  return merge(parts);
}

/* ---------------------------------------------------------- ammo can */

/** A steel ammo can: body, the lid with its lip, a folding handle on top, the latch lever on one end. */
export function canGeometry(high: boolean): BufferGeometry {
  const { length, depth, height } = CAN;
  const bodyH = height - 0.035;
  const parts: BufferGeometry[] = [
    box([length - 0.012, bodyH, depth - 0.01], [0, bodyH / 2, 0], ["canPlain", "canPlain", "canPlain", "canPlain", "canSide", "canSide"]),
    box([length, 0.035, depth], [0, bodyH + 0.0175, 0], "canPlain"),
  ];
  if (high) {
    parts.push(box([0.13, 0.01, 0.02], [0, height + 0.012, 0], "canPlain"));
    for (const x of [-0.06, 0.06]) parts.push(box([0.012, 0.014, 0.014], [x, height + 0.005, 0], "canPlain"));
    parts.push(box([0.016, 0.1, 0.05], [length / 2 + 0.002, bodyH - 0.03, 0], "canPlain", [0, 0, 0.08]));
  }
  return merge(parts);
}

/* ---------------------------------------------------------- jerrycan */

/** A 20-litre jerrycan: the pressed body, the three-handle bridge on top, the spout at the front corner. */
export function jerrycanGeometry(high: boolean): BufferGeometry {
  const { width, depth, height } = JERRY;
  const bodyH = height - 0.04;
  const parts: BufferGeometry[] = [
    box([width, bodyH, depth], [0, bodyH / 2, 0], ["jerryEdge", "jerryEdge", "jerryEdge", "jerryEdge", "jerryFace", "jerryFace"]),
  ];
  // The handle bridge: a bar along the top on four posts, three openings.
  parts.push(box([0.25, 0.018, 0.03], [-0.03, bodyH + 0.031, 0], "jerryEdge"));
  for (const x of [-0.155, -0.07, 0.015, 0.095]) parts.push(box([0.016, 0.03, 0.026], [x, bodyH + 0.012, 0], "jerryEdge"));
  if (high) {
    // The spout with its cap and lever.
    parts.push(cylinder([0.026, 0.03], 0.04, [width / 2 - 0.04, bodyH + 0.012, 0], "canPlain", [0, 0, -0.5], 8));
    parts.push(box([0.05, 0.012, 0.016], [width / 2 - 0.075, bodyH + 0.04, 0], "iron", [0, 0, 0.3]));
  }
  return merge(parts);
}

/* -------------------------------------------------------- cable drum */

/** A wooden cable drum on its flanges, axis along z: two plank discs and the barrel of wound cable. */
export function drumGeometry(high: boolean): BufferGeometry {
  const { radius, width, core } = DRUM;
  const t = 0.045;
  const segments = high ? 22 : 14;
  const parts: BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    parts.push(cylinder([radius, radius], t, [0, radius, sz * (width / 2 - t / 2)], ["timber", "flange", "flange"], [Math.PI / 2, 0, 0], segments));
  }
  parts.push(cylinder([core, core], width - 2 * t, [0, radius, 0], "cable", [Math.PI / 2, 0, 0], segments, true));
  if (high) {
    // The axle's bolt heads through both flanges.
    for (const sz of [-1, 1]) parts.push(cylinder([0.05, 0.05], 0.03, [0, radius, sz * (width / 2 + 0.012)], "iron", [Math.PI / 2, 0, 0], 6));
  }
  return merge(parts);
}

/** The drum's loose cable, as a tube through its points. */
export function cableGeometry(points: Vec3[], high: boolean): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  return mapUv(new TubeGeometry(curve, high ? 48 : 20, 0.016, 5, false), "iron");
}

/* ---------------------------------------------------- bridge panels */

/**
 * A Bailey-type panel lying flat: its two chords (the panel's long
 * edges), the end posts and middle post across, the inverted V of its
 * braces (the poster girder's own pattern), the male and female lugs at
 * the chord ends. Length along x, width along z, chords 0 to PANEL.depth
 * in y; posts and braces thinner, centred on the chords, so stacked
 * panels rest chord on chord.
 */
export function panelGeometry(high: boolean): BufferGeometry {
  const { length, width, depth } = PANEL;
  const parts: BufferGeometry[] = [];
  const chordW = 0.1;
  const zc = width / 2 - chordW / 2;
  const yc = depth / 2;
  const member = 0.08;
  for (const sz of [-1, 1]) {
    // Each chord a pair of channels back to back, with the gap between them.
    parts.push(box([length, depth, chordW * 0.42], [0, yc, sz * zc - chordW * 0.29], "steel"));
    parts.push(box([length, depth, chordW * 0.42], [0, yc, sz * zc + chordW * 0.29], "steel"));
  }
  const inner = width - 2 * chordW;
  for (const x of [-length / 2 + 0.05, 0, length / 2 - 0.05]) parts.push(box([0.1, member, inner], [x, yc, 0], "steel"));
  if (high) {
    const half = length / 2 - 0.05;
    const diag = Math.hypot(half, inner);
    const angle = Math.atan2(inner, half);
    // From each end's -z corner up to the middle of the +z chord.
    parts.push(box([diag, member * 0.8, 0.07], [-half / 2, yc, 0], "steel", [0, -angle, 0]));
    parts.push(box([diag, member * 0.8, 0.07], [half / 2, yc, 0], "steel", [0, angle, 0]));
    // Lugs: two plates out of one end of each chord, a jaw on the other.
    for (const sz of [-1, 1]) {
      parts.push(box([0.07, depth * 0.6, 0.06], [length / 2 + 0.035, yc, sz * zc], "steel"));
      parts.push(box([0.05, depth * 0.9, chordW * 1.05], [-length / 2 - 0.02, yc, sz * zc], "steel"));
    }
  }
  return merge(parts);
}

/** A timber bearer under the panels, along z. */
export function bearerGeometry(): BufferGeometry {
  return merge([box([BEARER.size, BEARER.size, BEARER.length], [0, BEARER.size / 2, 0], "timber")]);
}

/* ------------------------------------------------------------- tools */

/**
 * The pick: origin at the head's centre, the haft up +y, the head across
 * x (the point at -x, the chisel at +x), tapering to both ends.
 */
export function pickGeometry(): BufferGeometry {
  const { haft, point, chisel } = PICK;
  return merge([
    cylinder([0.019, 0.024], haft, [0, haft / 2 + 0.03, 0], "timber", [0, 0, 0], 7),
    cylinder([0.035, 0.035], 0.07, [0, 0.0, 0], "iron", [0, 0, 0], 7),
    // Point: a slim cone along -x, with a slight droop.
    cylinder([0.004, 0.026], point, [-point / 2, -0.01, 0], "iron", [0, 0, Math.PI / 2 + 0.06], 6),
    // Chisel: flattened, along +x.
    box([chisel, 0.022, 0.05], [chisel / 2, -0.008, 0], "iron", [0, 0, -0.06]),
  ]);
}

/**
 * The shovel: origin at the blade's tip, the blade up +y, then the
 * socket, the haft and a D grip on top. The blade is a shallow dish
 * (two halves turned a little toward the front).
 */
export function shovelGeometry(): BufferGeometry {
  const { blade, width, length } = SHOVEL;
  const parts: BufferGeometry[] = [];
  for (const sx of [-1, 1]) parts.push(box([width / 2, blade, 0.006], [(sx * width) / 4, blade / 2, 0.006], "iron", [0, sx * 0.18, 0]));
  parts.push(cylinder([0.022, 0.03], 0.12, [0, blade + 0.05, 0], "iron", [0, 0, 0], 7));
  const haft = length - blade - 0.16;
  parts.push(cylinder([0.018, 0.02], haft, [0, blade + 0.1 + haft / 2, 0], "timber", [0, 0, 0], 7));
  const grip = mapUv(new TorusGeometry(0.06, 0.012, 5, 10, Math.PI), "timber");
  grip.translate(0, length - 0.07, 0);
  parts.push(grip);
  parts.push(box([0.13, 0.024, 0.024], [0, length - 0.07, 0], "timber"));
  return merge(parts);
}
