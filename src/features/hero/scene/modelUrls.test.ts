import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAR_URL, DRIVER_URL, MODEL_PRELOADS, SUNGLASSES_URL, TRAFFIC_CAR, TRAFFIC_URLS } from "./modelUrls";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const MODELS = [CAR_URL, DRIVER_URL, SUNGLASSES_URL, ...TRAFFIC_URLS];

/** A model's file in public/ and the version its address carries. */
function parts(url: string): { file: string; version: string | undefined } {
  const [path, query = ""] = url.split("?");
  return { file: join(process.cwd(), "public", path), version: new URLSearchParams(query).get("v") ?? undefined };
}

describe("the scenes' models", () => {
  it("are files in public/", () => {
    for (const url of MODELS) expect(existsSync(parts(url).file), url).toBe(true);
  });

  it("carry the start of their file's SHA-256 as a version, so a rebuilt model is a new address", () => {
    for (const url of MODELS) {
      const { file, version } = parts(url);
      const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10);
      // next.config.ts lets the browser keep /models a year: a file replaced under an old version is never fetched again.
      expect(version, `${url}: put ?v=${hash} in modelUrls.ts`).toBe(hash);
    }
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
  it("name every model once: his car, the driver and the aviators first, then the traffic", () => {
    expect([...MODEL_PRELOADS].sort()).toEqual([...MODELS].sort());
    expect(new Set(MODEL_PRELOADS).size).toBe(MODEL_PRELOADS.length);
    expect(new Set(MODEL_PRELOADS.slice(0, 3))).toEqual(new Set([CAR_URL, DRIVER_URL, SUNGLASSES_URL]));
  });

  it("are asked for as three.js fetches (cors, same-origin credentials), at low priority, by the page and never the layout", () => {
    const page = source("src/app/[lang]/page.tsx");
    // Low: at the browser's own priority the models went ahead of the page's async scripts, and hydration waited.
    expect(page).toMatch(/for \(const url of MODEL_PRELOADS\)\s*preload\(url, \{ as: "fetch", crossOrigin: "anonymous", fetchPriority: "low" \}\)/);
    // The 404 shares the layout and has no scene.
    expect(source("src/app/[lang]/layout.tsx")).not.toMatch(/MODEL_PRELOADS|modelUrls/);
  });
});
