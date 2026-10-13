import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAR_URL, DRIVER_URL, MODEL_PRELOADS, SUNGLASSES_URL, TRAFFIC_CAR, TRAFFIC_URLS } from "./modelUrls";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const MODELS = [CAR_URL, DRIVER_URL, SUNGLASSES_URL, ...TRAFFIC_URLS];

describe("the scenes' models", () => {
  it("are files in public/", () => {
    for (const url of MODELS) expect(existsSync(join(process.cwd(), "public", url)), url).toBe(true);
  });

  it("list every traffic car once, in the traffic's order", () => {
    expect(new Set(TRAFFIC_URLS).size).toBe(TRAFFIC_URLS.length);
    expect([...TRAFFIC_URLS].sort()).toEqual(Object.values(TRAFFIC_CAR).sort());
  });

  it("are named in a module the home page can import without three.js", () => {
    expect(source("src/features/hero/scene/modelUrls.ts")).not.toMatch(/^import\s/m);
  });
});

describe("the home page's model preloads", () => {
  it("name every model once: his car, the driver and the aviators first, the traffic at low priority", () => {
    expect(MODEL_PRELOADS.map((entry) => entry.url).sort()).toEqual([...MODELS].sort());
    for (const entry of MODEL_PRELOADS) {
      const traffic = (TRAFFIC_URLS as readonly string[]).includes(entry.url);
      expect(entry.fetchPriority, entry.url).toBe(traffic ? "low" : undefined);
    }
  });

  it("are asked for as three.js fetches (cors, same-origin credentials), by the page and never the layout", () => {
    const page = source("src/app/[lang]/page.tsx");
    expect(page).toMatch(/MODEL_PRELOADS\)\s*preload\(url, \{ as: "fetch", crossOrigin: "anonymous", fetchPriority \}\)/);
    // The 404 shares the layout and has no scene.
    expect(source("src/app/[lang]/layout.tsx")).not.toMatch(/MODEL_PRELOADS|modelUrls/);
  });
});
