import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * GLSL pow() is undefined (NaN on most GPUs) for a negative base. One NaN
 * pixel is enough: the bloom mipmap blur spreads it over the whole frame and
 * the frame flashes black. This happened with the horizon haze, whose UV can
 * leave [0, 1] by a hair at the plane edge.
 *
 * Rule: the base of every pow() is one guard call that covers the whole base
 * (max, clamp, abs, smoothstep), or a name whose definition in the same file
 * is such a call.
 */
const GUARDS = ["max", "clamp", "abs", "smoothstep"];

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Index of the parenthesis that closes the one at `open`, or -1. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

function powBases(text: string): string[] {
  const source = stripComments(text);
  const bases: string[] = [];
  const pattern = /\bpow\(/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === "(") depth++;
      else if (char === ")") depth--;
      else if (char === "," && depth === 0) break;
    }
    bases.push(source.slice(match.index + match[0].length, end).trim());
  }
  return bases;
}

/** True when `expression` is exactly one guard call, nothing before or after. */
function isWholeGuard(expression: string): boolean {
  const call = /^(\w+)\s*\(/.exec(expression);
  if (!call || !GUARDS.includes(call[1])) return false;
  return closingParen(expression, call[0].length - 1) === expression.length - 1;
}

function isSafeBase(base: string, text: string): boolean {
  if (isWholeGuard(base)) return true;
  if (!/^[A-Za-z_]\w*$/.test(base)) return false;
  const definition = new RegExp(`\\b(?:float|vec[234])\\s+${base}\\s*=\\s*([^;]+);`).exec(
    stripComments(text),
  );
  return definition !== null && isWholeGuard(definition[1].trim());
}

const directory = __dirname;
const shaderFiles = readdirSync(directory).filter(
  (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

describe("shader sources", () => {
  it("finds the shader modules", () => {
    expect(shaderFiles.length).toBeGreaterThan(5);
  });

  it.each(shaderFiles)("%s never calls pow() with an unguarded base", (file) => {
    const source = readFileSync(join(directory, file), "utf8");
    const unsafe = powBases(source).filter((base) => !isSafeBase(base, source));
    expect(unsafe).toEqual([]);
  });

  it("rejects the bases that caused the black frames and their variants", () => {
    const source = `
      float across = (vWorld.x - uSunX) / width;
      float v = clamp(1.0 - vUv.y, 0.0, 1.0);
      float a = pow(1.0 - vUv.y, 2.2);
      float b = pow((x - 0.3) * 14.0, 2.0);
      float c = pow(abs(x) - 0.5, 2.0);
      float d = pow(max(a, b) - 1.0, 2.0);
      float e = pow(across, 2.0);
      float f = pow(v, 2.2); // pow(comment, 1.0)
      float g = pow(max(0.0, s), 10.0);
    `;
    const verdicts = powBases(source).map((base) => [base, isSafeBase(base, source)]);
    expect(verdicts).toEqual([
      ["1.0 - vUv.y", false],
      ["(x - 0.3) * 14.0", false],
      ["abs(x) - 0.5", false],
      ["max(a, b) - 1.0", false],
      ["across", false],
      ["v", true],
      ["max(0.0, s)", true],
    ]);
  });
});
