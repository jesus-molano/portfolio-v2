import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FitLine } from "@/features/suspects/FitLine";
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

  it("scales his line to the officer too, from its own size", () => {
    // The line-up's last word is the hero's card (FitLine): [data-captions] on its row, [data-card] on the block.
    const hero = cardFont("features/hero/Hero.module.css");
    const suspects = css("features/suspects/Suspects.module.css");
    const caption = suspects.match(/\n\.caption \{[^}]*?--va-card-fs: ([^;]+);[^}]*?font-size: ([^;]+);/);
    expect(caption?.[1]).toBe(hero);
    expect(caption?.[2]).toBe("var(--va-card-fs)");
    // A phone's line is a little larger, and scales from there: no rule sets its size past the variable.
    expect(suspects).not.toMatch(/\.caption(Text)? \{[^}]*?\bfont-size: (?!var\(--va-card-fs\))/);
    expect(css("features/suspects/Suspects.tsx")).toMatch(/<p className=\{styles\.caption\} data-captions>/);
    // Its words come as children (createElement's third argument, which its props type cannot see).
    const Line = FitLine as (props: { className: string; children?: ReactNode }) => ReactNode;
    const card = renderToStaticMarkup(createElement(Line, { className: "card" }, "Jesús: el número 3."));
    expect(card).toMatch(/^<span class="card" data-card=/);
  });
});
