import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { CAR_CREDIT, CAT_BASE_CREDIT, OFL_URL, RELIEF_CREDIT } from "./credits";
import { FEATURES, GITHUB_PROFILE, LINKEDIN_PROFILE, POSTER_SIZES, POSTER_WIDTHS, posterSrc, posterSrcSet } from "./links";
import { Projects } from "./Projects";

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
  CAT_BASE_CREDIT.sourceUrl,
  CAT_BASE_CREDIT.licenceUrl,
  RELIEF_CREDIT.sourceUrl,
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

  it("makes the painted box office a plain link to the contact, named as its sign reads", () => {
    const art = readFileSync(path.join(ROOT, "tools/art/finale/cinema.mjs"), "utf8");
    const [, signEn, signEs] = art.match(/booth: \{ en: "([^"]+)", es: "([^"]+)" \}/) ?? [];
    for (const [locale, dict, painted] of [
      ["en", en, signEn],
      ["es", es, signEs],
    ] as const) {
      expect(dict.projects.boxOffice.sign.toUpperCase(), locale).toBe(painted);
      const html = renderToStaticMarkup(createElement(Projects, { dict: dict.projects, newTab: dict.common.newTab, locale }));
      const booth = html.match(/<a[^>]*href="#contact"[^>]*>(.*?)<\/a>/)?.[1] ?? "";
      expect(booth, locale).toContain(`${dict.projects.boxOffice.sign}: `);
      expect(booth, locale).toContain(dict.projects.boxOffice.contact);
      // A same-page link: no new tab, no external address.
      expect(html.match(/<a[^>]*href="#contact"[^>]*>/)?.[0], locale).not.toMatch(/target=/);
    }
  });

  it("bills the show as free admission: the code is open, and 'off the clock' is STATS's", () => {
    expect(en.projects.marquee.rows[1]).toBe("FREE ADMISSION");
    expect(es.projects.marquee.rows[1]).toBe("ENTRADA LIBRE");
    for (const dict of [en, es]) expect(JSON.stringify(dict.projects)).not.toMatch(/fuera de horario|off the clock|after hours/i);
  });

  it("has a poster's copy for every feature, in both languages", () => {
    for (const dict of [en, es]) {
      expect(Object.keys(dict.projects.posters).sort()).toEqual(FEATURES.map((feature) => feature.id).sort());
    }
  });

  it("describes each poster's link with its genre and the words that are only in the image", () => {
    for (const [locale, dict] of [
      ["en", en],
      ["es", es],
    ] as const) {
      const html = renderToStaticMarkup(createElement(Projects, { dict: dict.projects, newTab: dict.common.newTab, locale }));
      for (const feature of FEATURES) {
        const link = html.match(new RegExp(`<a[^>]*data-feature="${feature.id}"[^>]*>`))?.[0] ?? "";
        const ids = link.match(/aria-describedby="([^"]+)"/)?.[1].split(" ") ?? [];
        const description = ids.map((id) => textOf(html, id)).join(" ");
        const copy = dict.projects.posters[feature.id];
        // The genre as a sentence, then the poster's words and the caption, each after a space.
        const said = [`${copy.genre}.`, copy.tagline.join(" "), copy.sub, copy.oneLiner].map(escapeHtml).join(" ");
        expect(description, `${locale} ${feature.id}`).toBe(said);
      }
    }
  });
});

/** Text as React writes it into HTML. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/** The text inside the span with this id, nested spans included, its tags stripped (and React's text separators). */
function textOf(html: string, id: string): string {
  const start = html.indexOf(`<span id="${id}"`);
  expect(start, id).toBeGreaterThanOrEqual(0);
  const tag = /<(\/?)span\b[^>]*>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index + match[0].length).replace(/<[^>]+>/g, "");
  }
  throw new Error(`unclosed span #${id}`);
}
