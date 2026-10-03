import { ExtrudeGeometry, Shape } from "three";

export const CAR = {
  length: 4.6,
  width: 1.9,
  wheelRadius: 0.36,
  wheelWidth: 0.28,
  /** Wheel centres (x, z). Rear is +z. */
  wheels: [
    [-0.92, 1.45],
    [0.92, 1.45],
    [-0.92, -1.45],
    [0.92, -1.45],
  ] as const,
} as const;

/**
 * Side profile of an eighties wedge convertible, extruded across its width.
 * Coordinates: x = car z (rear is +), y = height. Rotated into place below.
 */
export function createCarBodyGeometry(): ExtrudeGeometry {
  const s = new Shape();
  s.moveTo(2.25, 0.34);
  s.lineTo(2.3, 0.72);
  s.lineTo(2.22, 0.98);
  s.lineTo(1.1, 1.02);
  s.lineTo(0.6, 1.02);
  s.lineTo(0.52, 0.9); // cockpit sill
  s.lineTo(-0.3, 0.9);
  s.lineTo(-0.42, 1.0); // cowl
  s.lineTo(-1.5, 0.8);
  s.lineTo(-2.2, 0.64);
  s.lineTo(-2.3, 0.4);
  s.lineTo(-2.25, 0.34);
  s.closePath();

  const geometry = new ExtrudeGeometry(s, {
    depth: CAR.width - 0.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 4,
  });
  // Shape x -> world z (rear +z), extrusion depth -> world x, centred.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(CAR.width / 2 - 0.06, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}
