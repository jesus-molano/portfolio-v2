import { BufferAttribute, BufferGeometry } from "three";

/**
 * One trivision prism: three side quads of a triangular prism (no caps:
 * the frame's lip hides the ends), its axis vertical. Face k looks out at
 * k × 120 degrees from +z toward +x, so turning the prism by -k × 120
 * degrees brings face k to the street. `aFace` tells the shader which row
 * of the atlas a quad shows; uv.x runs left to right across the face.
 */
export function buildPrism(faceWidth: number, height: number): BufferGeometry {
  const r = faceWidth / Math.sqrt(3);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const faces: number[] = [];
  const indices: number[] = [];
  for (let k = 0; k < 3; k += 1) {
    const phi = (k * 2 * Math.PI) / 3;
    const left = phi - Math.PI / 3;
    const right = phi + Math.PI / 3;
    const corners = [
      [Math.sin(left) * r, -height / 2, Math.cos(left) * r, 0, 0],
      [Math.sin(right) * r, -height / 2, Math.cos(right) * r, 1, 0],
      [Math.sin(right) * r, height / 2, Math.cos(right) * r, 1, 1],
      [Math.sin(left) * r, height / 2, Math.cos(left) * r, 0, 1],
    ];
    const base = positions.length / 3;
    for (const [x, y, z, u, v] of corners) {
      positions.push(x, y, z);
      normals.push(Math.sin(phi), 0, Math.cos(phi));
      uvs.push(u, v);
      faces.push(k);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setAttribute("aFace", new BufferAttribute(new Float32Array(faces), 1));
  geometry.setIndex(indices);
  return geometry;
}
