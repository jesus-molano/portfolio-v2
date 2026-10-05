import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { CAR_CREDIT, OFL_URL } from "./credits";
import { FEATURES, GITHUB_PROFILE, LINKEDIN_PROFILE, POSTER_SIZES, POSTER_WIDTHS, posterSrc, posterSrcSet } from "./links";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../../..");

/** The finale's own sources, its art generators and its copy. */
function finaleTexts(): [string, string][] {
  const files = [
    ...readdirSync(HERE).map((name) => path.join(HERE, name)),
    ...readdirSync(path.join(ROOT, "tools/art/finale")).map((name) => path.join(ROOT, "tools/art/finale", name)),
  ].filter((file) => /\.(tsx?|css|mjs|json)$/.test(file) && !file.endsWith(".test.ts"));
  return [
    ...files.map((file): [string, string] => [path.relative(ROOT, file), readFileSync(file, "utf8")]),
    ["en.json projects/credits", JSON.stringify([en.projects, en.credits, en.common])],
    ["es.json projects/credits", JSON.stringify([es.projects, es.credits, es.common])],
  ];
}

/** Every external address the finale may link to. */
const ALLOWED = new Set([
  GITHUB_PROFILE,
  LINKEDIN_PROFILE,
  ...FEATURES.map((feature) => feature.href),
  CAR_CREDIT.sourceUrl,
  CAR_CREDIT.licenceUrl,
  OFL_URL,
]);

describe("the finale's links", () => {
  it("never shows an email address, anywhere", () => {
    for (const [name, text] of finaleTexts()) {
      expect(text, name).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(text, name).not.toMatch(/mailto:/i);
    }
  });

  it("links only to the allowed addresses (the music credits come from stations.ts)", () => {
    const urls = finaleTexts().flatMap(([, text]) => text.match(/https?:\/\/[^\s"'`)<>]+/g) ?? []);
    const external = urls.filter(
      (url) =>
        !url.startsWith("https://fonts.googleapis.com/") && // tools only: the faces the art is drawn in
        !url.startsWith("http://www.w3.org/"), // SVG's namespace
    );
    expect(external.length).toBeGreaterThan(0);
    for (const url of external) expect(ALLOWED.has(url) || url.startsWith(`${GITHUB_PROFILE}/`), url).toBe(true);
  });

  it("sends every feature to its repository under the profile, with its own anchor", () => {
    expect(FEATURES.map((feature) => feature.href)).toEqual([
      "https://github.com/jesus-molano/dotfiles",
      "https://github.com/jesus-molano/tessera-studio",
      "https://github.com/jesus-molano/project-atlas",
      "https://github.com/jesus-molano/Expenses-Log-App",
    ]);
    expect(FEATURES.map((feature) => feature.anchor)).toEqual([
      "project-dotfiles",
      "project-tessera-studio",
      "project-atlas",
      "project-expenses-log-app",
    ]);
    // atlas-habits is a different project, left out on purpose.
    expect(FEATURES.some((feature) => feature.repo === "atlas-habits")).toBe(false);
  });

  it("points at the posters the art tool writes, in both sizes", () => {
    expect(posterSrc(FEATURES[3], "es", "avif", true)).toBe("/finale/poster-expenses-log-app-es-hot.avif");
    expect(posterSrc(FEATURES[0], "en", "webp", false, true)).toBe("/finale/poster-dotfiles-en-216.webp");
    for (const feature of FEATURES) {
      for (const locale of ["en", "es"]) {
        for (const format of ["avif", "webp"] as const) {
          for (const hot of [false, true]) {
            for (const small of [false, true]) {
              const file = path.join(ROOT, "public", posterSrc(feature, locale, format, hot, small));
              expect(() => readFileSync(file), file).not.toThrow();
            }
          }
        }
      }
    }
  });

  it("offers the small poster for a 1x facade and the full one for a 2x phone", () => {
    expect(posterSrcSet(FEATURES[1], "en", "avif")).toBe(
      "/finale/poster-tessera-studio-en-216.avif 216w, /finale/poster-tessera-studio-en.avif 432w",
    );
    // The last size is the wide layout's: a case on the facade.
    expect(POSTER_SIZES.split(", ").at(-1)).toBe("7.6vw");
    expect(POSTER_WIDTHS.full).toBe(2 * POSTER_WIDTHS.small);
  });

  it("finds every plate the page asks for, in both languages and both formats", () => {
    for (const plate of ["night-wide", "night-tall", "dawn-wide", "dawn-tall"]) {
      for (const locale of ["en", "es"]) {
        for (const format of ["avif", "webp"]) {
          const file = path.join(ROOT, "public/finale", `${plate}-${locale}.${format}`);
          expect(() => readFileSync(file), file).not.toThrow();
        }
      }
    }
  });

  it("has a poster's copy for every feature, in both languages", () => {
    for (const dict of [en, es]) {
      expect(Object.keys(dict.projects.posters).sort()).toEqual(FEATURES.map((feature) => feature.id).sort());
    }
  });
});
