import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The night shaders follow the hero's rule (hero/shaders/shaders.test.ts)
 * in its strictest form: no pow() at all (squares are written x * x), so
 * no negative base can ever turn a pixel NaN and black out the bloom.
 */
const directory = __dirname;
const files = readdirSync(directory).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("night shader sources", () => {
  it("finds the shader modules", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files)("%s never calls pow()", (file) => {
    expect(code(readFileSync(join(directory, file), "utf8"))).not.toMatch(/\bpow\s*\(/);
  });

  it.each(files)("%s divides only by guarded lengths", (file) => {
    // Every division by a length goes through max(..., epsilon).
    const source = code(readFileSync(join(directory, file), "utf8"));
    expect(source).not.toMatch(/\/\s*length\(/);
  });
});
