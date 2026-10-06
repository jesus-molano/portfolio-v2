import { Color, Vector3 } from "three";
import type { Vec3 } from "./frame";

/** Uniforms of the analytic floods (shaders/board.ts), shared by every material of a board. */
export type FloodUniforms = {
  uFloodPos: { value: Vector3[] };
  uFloodDir: { value: Vector3[] };
  uFloodColor: { value: Color[] };
  uFloodLevel: { value: number[] };
  uFloodCos: { value: number[] };
};

/**
 * Four floods from their lamp heads toward their targets, with a cone
 * (degrees, outer and inner); one colour for all, or one each.
 */
export function createFloods(
  heads: Vec3[],
  targets: Vec3[],
  color: string | string[],
  cone: [number, number] = [38, 22],
): FloodUniforms {
  const pos = heads.map((h) => new Vector3(...h));
  const dir = heads.map((h, i) => new Vector3(...targets[i]).sub(new Vector3(...h)).normalize());
  return {
    uFloodPos: { value: pos },
    uFloodDir: { value: dir },
    uFloodColor: { value: heads.map((_, i) => new Color(Array.isArray(color) ? color[i] : color)) },
    uFloodLevel: { value: heads.map(() => 1) },
    uFloodCos: { value: [Math.cos((cone[0] * Math.PI) / 180), Math.cos((cone[1] * Math.PI) / 180)] },
  };
}
