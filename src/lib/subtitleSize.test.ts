import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSubtitleSize, SUBTITLE_SCALE, SUBTITLE_SIZES, subtitleAttributes } from "./subtitleSize";

const css = (file: string) => readFileSync(path.join(process.cwd(), "src", file), "utf8");

/** The font-size a stylesheet gives its `.subtitle` cards (the first rule). */
function cardFont(file: string): string {
  const rule = css(file).match(/\n\.subtitle \{[^}]*?font-size: ([^;]+);/);
  if (!rule) throw new Error(`no .subtitle font-size in ${file}`);
  return rule[1];
}

describe("the subtitle size", () => {
  it("is small, medium or large, medium by default and for anything it does not know", () => {
    expect(SUBTITLE_SIZES).toEqual(["s", "m", "l"]);
    expect(parseSubtitleSize("l")).toBe("l");
    expect(parseSubtitleSize("s")).toBe("s");
    for (const value of [null, undefined, "", "xl", "M"]) expect(parseSubtitleSize(value), String(value)).toBe("m");
  });

  it("leaves the cards alone at medium, and scales them a little either way", () => {
    expect(subtitleAttributes("m")).toEqual({ attribute: null, scale: null });
    expect(subtitleAttributes("l")).toEqual({ attribute: "l", scale: String(SUBTITLE_SCALE.l) });
    expect(SUBTITLE_SCALE.s).toBeLessThan(1);
    expect(SUBTITLE_SCALE.l).toBeGreaterThan(1);
    // Large stays a size, not a poster: a card is at most 64 characters on a band of 44rem.
    expect(SUBTITLE_SCALE.l).toBeLessThanOrEqual(1.25);
  });

  it("scales both stages' cards from their own size (globals.css mirrors it)", () => {
    const hero = cardFont("features/hero/Hero.module.css");
    const work = cardFont("features/work/Work.module.css");
    expect(work).toBe(hero);
    const globals = css("app/globals.css");
    expect(globals).toContain(`font-size: calc(var(--va-card-fs, ${hero}) * var(--va-subtitle-scale, 1));`);
    expect(globals).toMatch(/html\[data-subtitles\] \[data-captions\] \[data-card\]/);
  });
});
