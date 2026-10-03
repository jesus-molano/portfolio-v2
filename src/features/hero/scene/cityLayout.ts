import { Color } from "three";
import { palette } from "@/design/tokens";
import { createRandom, world } from "./world";

/** An axis-aligned block, origin at its bottom center. */
export type Block = { x: number; y: number; z: number; w: number; h: number; d: number };

/** A lit window: position, yaw (0 faces +z, ±PI/2 faces ±x) and color. */
export type Window = { x: number; y: number; z: number; yaw: number; color: Color };

/** A neon strip: a thin emissive block. */
export type Strip = Block & { color: Color };

export type CityLayout = { blocks: Block[]; windows: Window[]; strips: Strip[] };

const AVENUE_HALF_WIDTH = 16;
const WINDOW_W = 0.7;
const WINDOW_H = 1.0;
const FLOOR_H = 2.3;
const BAY_W = 1.7;

/**
 * Deterministic art-deco skyline: stacked tiers with setbacks, cornices,
 * antennas, neon edge strips and window grids with lit "floors".
 * Everything is expressed as instances of three shared geometries.
 */
export function buildCity(
  buildingCount: number,
  windowBudget: number,
  stripBudget: number,
): CityLayout {
  const random = createRandom(2024);
  const { zNear, zFar, halfWidth } = world.skyline;
  const blocks: Block[] = [];
  const windows: Window[] = [];
  const strips: Strip[] = [];

  // Dusk: a few early lights, warm, with the odd pink or cool one.
  const warm = new Color("#ffe6b3");
  const cyan = new Color("#bff4ff");
  const pink = new Color(palette.pink);
  const white = new Color("#fff8ea");
  const windowPalette = [warm, warm, warm, white, pink, cyan];
  const stripPalette = [pink, new Color(palette.magenta), new Color("#ffb6e0")];

  for (let i = 0; i < buildingCount; i += 1) {
    // Keep the avenue clear so the sun stays framed at the end of the road.
    const side = random() < 0.5 ? -1 : 1;
    const x = side * (AVENUE_HALF_WIDTH + random() * (halfWidth - AVENUE_HALF_WIDTH));
    const z = zNear + random() * (zFar - zNear);
    const centerBias = 1 - Math.min(1, Math.abs(x) / halfWidth);

    const w = 6 + random() * 9;
    const d = 6 + random() * 6;
    const baseH = 8 + random() * 16 + centerBias * centerBias * random() * 26;

    // Tier 1: the body.
    blocks.push({ x, y: 0, z, w, h: baseH, d });
    let topY = baseH;
    let topW = w;
    let topD = d;

    // Cornice on the body for the deco look.
    if (random() < 0.45) {
      blocks.push({ x, y: topY, z, w: w * 1.12, h: 0.9, d: d * 1.12 });
      topY += 0.9;
    }

    // Setback tiers.
    const tiers = random() < 0.65 ? (random() < 0.4 ? 2 : 1) : 0;
    for (let t = 0; t < tiers; t += 1) {
      const tw = topW * (0.55 + random() * 0.25);
      const td = topD * (0.55 + random() * 0.25);
      const th = 4 + random() * 10 * (1 - t * 0.4);
      blocks.push({ x, y: topY, z, w: tw, h: th, d: td });
      topY += th;
      topW = tw;
      topD = td;
    }

    // Antenna or spire.
    if (random() < 0.4) {
      const ah = 3 + random() * 9;
      blocks.push({ x, y: topY, z, w: 0.35, h: ah, d: 0.35 });
      if (random() < 0.5) {
        blocks.push({ x, y: topY + ah * 0.6, z, w: 1.6, h: 0.2, d: 0.2 });
      }
    }

    // Neon strips on tall bodies: two vertical edges and the top edge.
    if (baseH > 18 && random() < 0.55 && strips.length < stripBudget) {
      const color = stripPalette[Math.floor(random() * stripPalette.length)];
      const zFront = z + d / 2 + 0.08;
      strips.push({ x: x - w / 2, y: 0.5, z: zFront, w: 0.16, h: baseH - 0.5, d: 0.16, color });
      strips.push({ x: x + w / 2, y: 0.5, z: zFront, w: 0.16, h: baseH - 0.5, d: 0.16, color });
      if (random() < 0.6) {
        strips.push({ x, y: baseH - 0.3, z: zFront, w: w + 0.16, h: 0.16, d: 0.16, color });
      }
    }

    // Window grids on the front face and on the face that looks at the avenue.
    const faces: Array<{ yaw: number; cx: number; cz: number; width: number }> = [
      { yaw: 0, cx: x, cz: z + d / 2 + 0.06, width: w },
      { yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, cx: x - side * (w / 2 + 0.06), cz: z, width: d },
    ];
    const cols = Math.max(1, Math.floor(w / BAY_W));
    const rows = Math.max(1, Math.floor((baseH - 1.5) / FLOOR_H));
    const litFloors = new Set<number>();
    for (let r = 0; r < rows; r += 1) if (random() < 0.22) litFloors.add(r);

    for (const face of faces) {
      const faceCols = face.yaw === 0 ? cols : Math.max(1, Math.floor(face.width / BAY_W));
      for (let r = 0; r < rows; r += 1) {
        const floorLit = litFloors.has(r);
        for (let c = 0; c < faceCols; c += 1) {
          const lit = floorLit ? random() < 0.75 : random() < 0.12;
          if (!lit || windows.length >= windowBudget) continue;
          const offset = -face.width / 2 + (c + 0.5) * (face.width / faceCols);
          const y = 1.6 + r * FLOOR_H;
          const color = windowPalette[Math.floor(random() * windowPalette.length)];
          if (face.yaw === 0) {
            windows.push({ x: face.cx + offset, y, z: face.cz, yaw: 0, color });
          } else {
            windows.push({ x: face.cx, y, z: face.cz + offset, yaw: face.yaw, color });
          }
        }
      }
    }
  }

  return { blocks, windows, strips };
}

export const windowSize = { w: WINDOW_W, h: WINDOW_H };
