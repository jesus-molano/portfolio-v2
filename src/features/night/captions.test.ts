import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STOPS } from "@/features/work/stops";
import { CAPTION_SPAN, PHONE_CAPTIONS } from "./captions";
import * as direction from "./direction";

describe("the stops' captions on a phone (captions.ts)", () => {
  it("say a side for every stop", () => {
    expect(PHONE_CAPTIONS).toHaveLength(STOPS.length);
  });

  it("are the sides the camera's direction frames for", () => {
    PHONE_CAPTIONS.forEach((side, stop) => expect(direction.DIRECTION[stop].phoneCaptions ?? null).toBe(side));
    expect(direction.CAPTION_SPAN).toBe(CAPTION_SPAN);
  });

  it("import nothing, so the work stage never brings three.js into the page's first bundle", () => {
    expect(readFileSync(join(process.cwd(), "src/features/night/captions.ts"), "utf8")).not.toMatch(/^import\s/m);
  });
});
