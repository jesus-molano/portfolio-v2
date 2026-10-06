import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tokensToCssVariables } from "@/design/tokens";

/*
 * Nothing laid out in the page flow at or above the static sections may
 * follow a phone's bars (lib/screen.ts): browsers that resize their web
 * view with them change every viewport unit, vh and svh included, and the
 * whole page below moved under her finger on every change of direction.
 * Those sections size with --va-svh and --va-lvh instead.
 */
const STATIC_CSS = [
  "src/features/suspects/Suspects.module.css",
  "src/features/stats/Stats.module.css",
  "src/features/finale/Projects.module.css",
  "src/features/finale/Credits.module.css",
  "src/features/finale/Marquee.module.css",
  "src/components/ChapterCard/ChapterCard.module.css",
];
const VIEWPORT_HEIGHT = /-?\d*\.?\d+(?:[sld]?vh|vmax|[sld]?vb)\b/g;

/** The CSS without its comments. */
function code(path: string): string {
  return readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("the page's heights hold through a phone's bars", () => {
  it.each(STATIC_CSS)("%s sizes nothing with a viewport height unit", (path) => {
    expect(code(path).match(VIEWPORT_HEIGHT) ?? []).toEqual([]);
  });

  it("the hero's stage is in stable screens", () => {
    const css = tokensToCssVariables();
    expect(css).toMatch(/--va-hero-scroll: calc\(\d+ \* var\(--va-lvh\)\);/);
    const hero = code("src/features/hero/Hero.module.css");
    expect(hero).toMatch(/\.stage \{[^}]*height: var\(--va-hero-scroll\);/);
  });

  it("the still hero's frame, in the flow under reduced motion, is in stable screens", () => {
    const hero = code("src/features/hero/Hero.module.css");
    const still = hero.slice(hero.indexOf("@media (prefers-reduced-motion: reduce)"));
    const sticky = still.slice(still.indexOf(".sticky {"), still.indexOf("}", still.indexOf(".sticky {")));
    expect(sticky).toContain("padding-top: calc(100 * var(--va-svh));");
    expect(sticky.match(VIEWPORT_HEIGHT) ?? []).toEqual([]);
  });
});
