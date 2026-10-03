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

const TRUNK_HEIGHT = 11.5;
const TRUNK_SEGMENTS = 9;
const FROND_COUNT = 12;
const FROND_LENGTH = 6.4;
const FROND_SEGMENTS = 34;

/**
 * Builds one palm silhouette: a leaning trunk with ringed bulges and a crown
 * of drooping fronds with jagged leaflets. Adds an `aSway` attribute (0 at
 * the roots, 1 at the frond tips) that the palm shader uses for wind.
 */
export function createPalmGeometry(seed = 7): BufferGeometry {
  const random = createRandom(seed);
  const parts: BufferGeometry[] = [];

  // Trunk: stacked, tapering cylinders following a gentle lean.
  const lean = new Vector3((random() - 0.5) * 2.2, 0, (random() - 0.5) * 0.8);
  const segmentHeight = TRUNK_HEIGHT / TRUNK_SEGMENTS;
  for (let i = 0; i < TRUNK_SEGMENTS; i += 1) {
    const t0 = i / TRUNK_SEGMENTS;
    const t1 = (i + 1) / TRUNK_SEGMENTS;
    const ring = i % 2 === 0 ? 1.08 : 0.94;
    const radiusBottom = (0.46 - t0 * 0.22) * ring;
    const radiusTop = (0.46 - t1 * 0.22) * (i % 2 === 0 ? 0.94 : 1.08);
    const segment = new CylinderGeometry(radiusTop, radiusBottom, segmentHeight, 8, 1);
    // Silhouette shader needs only positions; keep attributes identical for merging.
    segment.deleteAttribute("normal");
    segment.deleteAttribute("uv");
    const offset = lean.clone().multiplyScalar(t0 * t0);
    segment.translate(offset.x, segmentHeight / 2 + i * segmentHeight, offset.z);
    addSway(segment, (y) => Math.pow(y / TRUNK_HEIGHT, 2) * 0.35);
    parts.push(segment);
  }

  // Crown: fronds radiating from the trunk top, some upright, most drooping.
  const crown = lean.clone().setY(TRUNK_HEIGHT);
  for (let i = 0; i < FROND_COUNT; i += 1) {
    const upright = i % 4 === 0;
    const frond = createFrond(random, upright);
    const yaw = (i / FROND_COUNT) * Math.PI * 2 + random() * 0.5;
    // Angle above the horizontal at the base; the curve then droops the tip.
    const lift = upright ? 0.85 + random() * 0.4 : 0.15 + random() * 0.35;
    const matrix = new Matrix4()
      .makeTranslation(crown.x, crown.y - 0.3, crown.z)
      .multiply(new Matrix4().makeRotationY(yaw))
      .multiply(new Matrix4().makeRotationZ(lift));
    frond.applyMatrix4(matrix);
    parts.push(frond);
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Palm geometry could not be merged");
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** A leaf along local +X: a thin spine with jagged leaflets, rising then drooping. */
function createFrond(random: () => number, upright: boolean): BufferGeometry {
  const positions: number[] = [];
  const sway: number[] = [];
  const indices: number[] = [];
  const droop = upright ? 0.5 + random() * 0.4 : 1.8 + random() * 1.4;
  const length = FROND_LENGTH * (0.8 + random() * 0.35);

  for (let i = 0; i <= FROND_SEGMENTS; i += 1) {
    const t = i / FROND_SEGMENTS;
    const x = t * length;
    const y = 1.3 * t - droop * t * t;
    // Leaflets: alternate long and short to serrate the outline.
    const envelope = 0.12 + 1.05 * Math.pow(Math.sin(t * Math.PI), 0.55);
    const leaflet = i % 2 === 0 ? 1 : 0.42;
    const halfWidth = envelope * leaflet * (0.9 + random() * 0.2);
    // Leaflets droop too: the outer edge sits lower than the spine.
    const edgeDrop = halfWidth * 0.7;
    positions.push(x, y - edgeDrop, -halfWidth, x, y - edgeDrop, halfWidth);
    const s = 0.3 + t * 0.7;
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
