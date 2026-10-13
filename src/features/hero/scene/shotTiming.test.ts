import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as shots from "./shots";
import { CUT_BAND, SHOT_COUNT, shotIndexAt, stickyShot } from "./shotTiming";

describe("the film's cuts without three.js (shotTiming.ts)", () => {
  it("count every shot of the film", () => {
    expect(SHOT_COUNT).toBe(shots.SHOTS.length);
  });

  it("are the very cuts shots.ts gives the scene", () => {
    expect(shots.SHOT_COUNT).toBe(SHOT_COUNT);
    expect(shots.CUT_BAND).toBe(CUT_BAND);
    expect(shots.shotIndexAt).toBe(shotIndexAt);
    expect(shots.stickyShot).toBe(stickyShot);
  });

  it("import nothing, so the stage's frame never brings three.js into the page's first bundle", () => {
    expect(readFileSync(join(process.cwd(), "src/features/hero/scene/shotTiming.ts"), "utf8")).not.toMatch(/^import\s/m);
  });
});
