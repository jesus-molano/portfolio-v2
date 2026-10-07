import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * CarDrive (CarNight.tsx) lands the car on the picture only on a dev jump
 * (night.snap) or as the frame loop wakes (night.woke, set by NightScene as
 * the stage comes back on screen). A long frame mid-drive is no waking:
 * carMotion integrates it. Snapping on any frame over 0.5 s jumped the car
 * its whole chase lag in one frame on a loaded phone, metres in sight.
 */
const carNight = readFileSync(new URL("./CarNight.tsx", import.meta.url), "utf8");
const scene = readFileSync(new URL("./NightScene.tsx", import.meta.url), "utf8");

describe("CarDrive", () => {
  it("snaps only on a jump or as the loop wakes, never on a long frame", () => {
    expect(carNight).toMatch(/snap:\s*night\.snap \|\| woke/);
    expect(carNight).not.toMatch(/delta\s*>/);
    expect(carNight).toMatch(/night\.woke = false/);
  });

  it("is woken by the stage coming back on screen", () => {
    expect(scene).toMatch(/if \(active\) night\.woke = true/);
  });
});
