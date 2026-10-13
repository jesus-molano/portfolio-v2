import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as streamed from "./drive";
import { drive } from "./driveState";

describe("the drive's state without three.js (driveState.ts)", () => {
  it("is the one object the scene streams by: drive.ts hands out the same", () => {
    expect(streamed.drive).toBe(drive);
    expect(drive.speed).toBe(18);
  });

  it("imports nothing, so the stage's dash never brings three.js into the page's first bundle", () => {
    expect(readFileSync(join(process.cwd(), "src/features/hero/scene/driveState.ts"), "utf8")).not.toMatch(/^import\s/m);
  });
});
