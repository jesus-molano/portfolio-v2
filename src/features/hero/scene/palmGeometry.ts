import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom } from "./world";

const TRUNK_HEIGHT = 11;
const TRUNK_SEGMENTS = 7;
const FROND_COUNT = 9;
const FROND_LENGTH = 5.6;
const FROND_SEGMENTS = 22;

/**
 * Builds one low-poly palm silhouette: a leaning trunk and jagged drooping
 * fronds. Adds an `aSway` attribute (0 at the roots, 1 at the frond tips)
 * that the palm shader uses for wind.
 */
export function createPalmGeometry(seed = 7): BufferGeometry {
  const random = createRandom(seed);
  const parts: BufferGeometry[] = [];

  // Trunk: stacked, tapering cylinders following a gentle lean.
  const lean = new Vector3((random() - 0.5) * 1.6, 0, (random() - 0.5) * 0.6);
  const segmentHeight = TRUNK_HEIGHT / TRUNK_SEGMENTS;
  for (let i = 0; i < TRUNK_SEGMENTS; i += 1) {
    const t0 = i / TRUNK_SEGMENTS;
    const t1 = (i + 1) / TRUNK_SEGMENTS;
    const radiusBottom = 0.42 - t0 * 0.2;
    const radiusTop = 0.42 - t1 * 0.2;
    const segment = new CylinderGeometry(radiusTop, radiusBottom, segmentHeight, 7, 1);
    // Silhouette shader needs only positions; keep attributes identical for merging.
    segment.deleteAttribute("normal");
    segment.deleteAttribute("uv");
    const offset = lean.clone().multiplyScalar(t0 * t0);
    segment.translate(offset.x, segmentHeight / 2 + i * segmentHeight, offset.z);
    addSway(segment, (y) => Math.pow(y / TRUNK_HEIGHT, 2) * 0.35);
    parts.push(segment);
  }

  // Crown: fronds radiating from the trunk top.
  const crown = lean.clone().multiplyScalar(1).setY(TRUNK_HEIGHT);
  for (let i = 0; i < FROND_COUNT; i += 1) {
    const frond = createFrond(random);
    const yaw = (i / FROND_COUNT) * Math.PI * 2 + random() * 0.4;
    const pitch = 0.25 + random() * 0.55;
    const matrix = new Matrix4()
      .makeTranslation(crown.x, crown.y - 0.2, crown.z)
      .multiply(new Matrix4().makeRotationY(yaw))
      .multiply(new Matrix4().makeRotationZ(-pitch));
    frond.applyMatrix4(matrix);
    parts.push(frond);
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Palm geometry could not be merged");
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** A jagged leaf that rises, then droops, in local +X. */
function createFrond(random: () => number): BufferGeometry {
  const positions: number[] = [];
  const sway: number[] = [];
  const indices: number[] = [];
  const droop = 1.6 + random() * 1.2;

  for (let i = 0; i <= FROND_SEGMENTS; i += 1) {
    const t = i / FROND_SEGMENTS;
    const x = t * FROND_LENGTH;
    const y = 1.1 * t - droop * t * t;
    const base = 0.08 + 0.62 * Math.pow(Math.sin(t * Math.PI), 0.7);
    const jag = i % 2 === 0 ? 1 : 0.38;
    const halfWidth = base * jag;
    positions.push(x, y, -halfWidth, x, y, halfWidth);
    const s = 0.35 + t * 0.65;
    sway.push(s, s);
    if (i < FROND_SEGMENTS) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSway", new Float32BufferAttribute(sway, 1));
  geometry.setIndex(indices);
  return geometry;
}

function addSway(geometry: BufferGeometry, amount: (y: number) => number) {
  const position = geometry.getAttribute("position");
  const values = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    values[i] = amount(position.getY(i));
  }
  geometry.setAttribute("aSway", new BufferAttribute(values, 1));
}
