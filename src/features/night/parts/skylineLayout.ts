import { createRandom } from "@/features/hero/scene/world";
import type { Vec3 } from "../frame";
import { type Occupancy, type PaneLook, pickPane } from "../sets/art/windows";

/** A pane of the window atlas: centre, size, and how it shows its room (see parts/Windows). */
export type SkylinePane = { p: Vec3; s: readonly [number, number] } & PaneLook;

export type SkylineSpec = {
  seed: number;
  count: number;
  /** Where the blocks stand (x and z ranges) and how tall they are. */
  x: [number, number];
  z: [number, number];
  height: [number, number];
  /** Share of window cells lit. */
  lit: number;
  /** Boxes the skyline keeps clear of (the landmark, the board). */
  clear?: { x: [number, number]; z: [number, number] }[];
};

type Block = { x: number; z: number; w: number; d: number; h: number };
/** A roof part: like a block, standing on `y`. */
type RoofPart = Block & { y: number };

/**
 * Deterministic blocks, their roofline (a parapet cap, a setback on the tall
 * ones, plant rooms and water tanks) and their lit windows on the front
 * faces (toward +z), each a painted room from the block's own mix: homes
 * or offices, never a flat lit rectangle.
 */
export function buildSkyline(spec: SkylineSpec): { blocks: Block[]; roofs: RoofPart[]; windows: SkylinePane[] } {
  const random = createRandom(spec.seed);
  const blocks: Block[] = [];
  const roofs: RoofPart[] = [];
  const windows: SkylinePane[] = [];
  let guard = 0;
  while (blocks.length < spec.count && guard++ < spec.count * 20) {
    const w = 8 + random() * 16;
    const d = 8 + random() * 14;
    const x = spec.x[0] + random() * (spec.x[1] - spec.x[0]);
    const z = spec.z[0] + random() * (spec.z[1] - spec.z[0]);
    const h = spec.height[0] + random() * random() * (spec.height[1] - spec.height[0]);
    const blocked = spec.clear?.some(
      (c) => x + w / 2 > c.x[0] && x - w / 2 < c.x[1] && z + d / 2 > c.z[0] && z - d / 2 < c.z[1],
    );
    if (blocked) continue;
    blocks.push({ x, z, w, d, h });
    // The roofline: a cap, a setback on a tall block, a plant room or a tank.
    roofs.push({ x, z, w: w + 0.5, d: d + 0.5, y: h - 0.3, h: 0.75 });
    let top = h + 0.45;
    if (h > 30 && random() < 0.55) {
      const sh = 3 + random() * 6;
      roofs.push({ x, z: z - d * 0.1, w: w * (0.55 + random() * 0.2), d: d * (0.55 + random() * 0.2), y: top, h: sh });
      top += sh;
    }
    if (random() < 0.6) roofs.push({ x: x + (random() - 0.5) * w * 0.4, z: z - d * 0.15, w: 2 + random() * 3, d: 2 + random() * 3, y: top, h: 1.6 + random() * 1.4 });
    if (random() < 0.35) roofs.push({ x: x + (random() - 0.5) * w * 0.5, z: z - d * 0.2, w: 1.6, d: 1.6, y: top, h: 2.6 });
    // Windows: a home or an office block, its floors and bays, some rooms lit.
    const occupancy: Occupancy = random() < 0.55 ? "office" : "home";
    const cols = Math.max(2, Math.floor(w / 3));
    const pw = (w / cols) * (occupancy === "office" ? 0.78 : 0.55);
    for (let y = 3; y < h - 2; y += 3.2) {
      for (let i = 0; i < cols; i += 1) {
        if (random() > spec.lit) continue;
        windows.push({
          p: [x - w / 2 + (i + 0.5) * (w / cols), y, z + d / 2 + 0.15],
          s: [pw, 1.6],
          ...pickPane(random, occupancy, 1),
        });
      }
    }
  }
  return { blocks, roofs, windows };
}

