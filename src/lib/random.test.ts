import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as world from "@/features/hero/scene/world";
import { createRandom } from "./random";

describe("createRandom", () => {
  it("gives the same sequences as ever (every layout drawn with it stays where it was)", () => {
    const flock = createRandom(7);
    expect([flock(), flock(), flock()]).toEqual([0.011704753153026104, 0.06195825757458806, 0.97690763277933]);
    const other = createRandom(1234);
    expect([other(), other(), other()]).toEqual([0.07329497812315822, 0.7034119898453355, 0.9028560190927237]);
  });

  it("is the very function the scene's world hands out", () => {
    expect(world.createRandom).toBe(createRandom);
  });

  it("imports nothing, so a layout of the page's own never brings three.js into its first bundle", () => {
    expect(readFileSync(join(process.cwd(), "src/lib/random.ts"), "utf8")).not.toMatch(/^import\s/m);
  });
});
