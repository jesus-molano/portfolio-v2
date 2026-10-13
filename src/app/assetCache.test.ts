import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

/** The Cache-Control each public folder is served with (next.config.ts). */
async function policies(): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  return Object.fromEntries(
    rules.map((rule) => [rule.source, rule.headers.find((header) => header.key === "Cache-Control")?.value ?? ""]),
  );
}

describe("how long the browser keeps public/'s files", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the models a year, since their addresses carry their content's hash (modelUrls.test.ts)", async () => {
    expect((await policies())["/models/:path*"]).toBe("public, max-age=31536000, immutable");
  });

  it("asks again on every visit for the pictures whose layout is in the page's code", async () => {
    const served = await policies();
    // plates.json, the line-up's manifest and statsLayout.ts place the DOM over these pictures.
    for (const folder of ["finale", "interlude", "stats"]) expect(served[`/${folder}/:path*`], folder).toBe("public, no-cache");
  });

  it("keeps the rest a day, and never serves a stale copy while it checks behind it", async () => {
    const served = await policies();
    for (const folder of ["music", "load"]) expect(served[`/${folder}/:path*`], folder).toBe("public, max-age=86400");
    // A week of stale-while-revalidate showed the old plate under the new plates.json for a whole visit.
    for (const value of Object.values(served)) expect(value).not.toMatch(/stale/);
  });

  it("keeps nothing in development, so a file rebuilt there shows on the next reload", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await policies()).toEqual({});
  });
});
