import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The page's client code reaches three.js only through the scenes'
 * dynamic imports (HeroCanvas, NightCanvas): a static import of a module
 * that builds a three.js object as it loads (a shot's camera, the drive's
 * scratch matrices, the night camera) put three.js in the page's first
 * bundle, parsed and run before hydration, for a stage that only wanted a
 * number from it (scene/shotTiming.ts, scene/driveState.ts, lib/random.ts
 * and night/captions.ts hold those numbers now). This walks the static
 * imports (`import type` aside) from every client component outside the
 * scenes, the way the bundler does.
 */
const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const THREE = /^(three(\/.*)?|@react-three\/.*|postprocessing)$/;
/** Only ever loaded through a dynamic import: the scenes, and the night but its canvas. */
const SCENES = [join(SRC, "features/hero/scene") + "/", join(SRC, "features/night") + "/"];
const NIGHT_CANVAS = join(SRC, "features/night/NightCanvas.tsx");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The modules a file imports for their values (not `import type`, not `import()`). */
function imports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']/g)) {
    const [, typeOnly, clause, spec] = match;
    if (typeOnly) continue;
    const named = clause.match(/\{([^}]*)\}/);
    const rest = clause.replace(/\{[^}]*\}/, "").replace(/,/g, "").trim();
    if (named && !rest) {
      const names = named[1]
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      if (names.length > 0 && names.every((name) => name.startsWith("type "))) continue;
    }
    found.push(spec);
  }
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) found.push(match[1]);
  return found;
}

function threeChains(entries: string[]): string[] {
  const parent = new Map<string, string | null>(entries.map((entry) => [entry, null]));
  const queue = [...entries];
  const chains: string[] = [];
  const chain = (file: string | null) => {
    const steps: string[] = [];
    for (let at = file; at; at = parent.get(at) ?? null) steps.unshift(relative(ROOT, at));
    return steps.join(" -> ");
  };
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (!/\.tsx?$/.test(file)) continue;
    for (const spec of imports(file)) {
      if (THREE.test(spec)) {
        chains.push(`${chain(file)} -> ${spec}`);
        continue;
      }
      const next = resolveImport(file, spec);
      if (next && !parent.has(next)) {
        parent.set(next, file);
        queue.push(next);
      }
    }
  }
  return chains;
}

describe("the page's first bundle", () => {
  it("brings in no three.js: every client component outside the scenes stays clear of it", () => {
    const clients = files(SRC).filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !/\.test\.tsx?$/.test(file) &&
        (file === NIGHT_CANVAS || !SCENES.some((scene) => file.startsWith(scene))) &&
        /^\s*["']use client["']/.test(readFileSync(file, "utf8")),
    );
    // The stages, the select, the loader and the finale are among them.
    expect(clients.map((file) => relative(SRC, file))).toEqual(
      expect.arrayContaining(["features/hero/HeroStage.tsx", "features/work/WorkStage.tsx", "features/hero/HeroCanvas.tsx", "features/night/NightCanvas.tsx"]),
    );
    expect(threeChains(clients)).toEqual([]);
  });
});
