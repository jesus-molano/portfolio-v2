import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chapterName, shadeLayers } from "@/components/ChapterCard/chapterLayout";
import { MISSIONS } from "@/features/stats/statsLayout";
import { Horizon } from "@/features/loader/Horizon";
import { LoadingScreen } from "@/features/loader/LoadingScreen";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { HomeMain } from "./HomeMain";

/** The home page as the server renders it: the loading screen, then every section in <main>. */
async function renderHome(lang: (typeof locales)[number]): Promise<string> {
  const dict = await getDictionary(lang);
  return renderToStaticMarkup(
    createElement("body", null, createElement(LoadingScreen, { dict: dict.loader, settings: dict.stats.settings, lang, art: createElement(Horizon) }), createElement(HomeMain, { dict, lang })),
  );
}

const inPageTargets = (html: string) => [...html.matchAll(/\shref="#([^"]*)"/g)].map((match) => decodeURIComponent(match[1]));
const ids = (html: string) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

describe("in-page links", () => {
  for (const lang of locales) {
    it(`sends every href="#..." on /${lang} to an element that exists`, async () => {
      const html = await renderHome(lang);
      const present = ids(html);
      const targets = inPageTargets(html);
      // The skip link in the layout points at <main>, rendered here.
      expect(present.has("main")).toBe(true);
      expect(targets.length).toBeGreaterThan(0);
      expect(targets.filter((target) => !present.has(target))).toEqual([]);
    });
  }

  it("renders the sections in the film's order", async () => {
    const html = await renderHome("en");
    const order = ["suspects", "stats", "projects", "credits", "contact"].map((id) => html.indexOf(` id="${id}"`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.indexOf('aria-labelledby="hero-title"')).toBeLessThan(order[0]);
  });

  it("follows the hero with THE USUAL SUSPECTS, ready to take the focus when Skip, Esc or End cut there", async () => {
    for (const lang of locales) {
      const html = await renderHome(lang);
      // HeroStage's jumpToEnd scrolls to the hero section's bottom and focuses its next sibling.
      const heroClose = html.indexOf("</section>", html.indexOf('aria-labelledby="hero-title"'));
      const next = html.slice(heroClose + "</section>".length).match(/^<[^>]+>/)?.[0] ?? "";
      expect(next, lang).toMatch(/^<section\s/);
      expect(next, lang).toContain(' id="suspects"');
      expect(next, lang).toContain(' tabindex="-1"');
    }
  });

  it("heads each static section with its chapter card, under the heading ids its links and labels use", async () => {
    for (const lang of locales) {
      const html = await renderHome(lang);
      const dict = await getDictionary(lang);
      for (const section of ["suspects", "stats", "projects", "credits"] as const) {
        const open = html.match(new RegExp(`<section[^>]* id="${section}"[^>]*>`))?.[0] ?? "";
        expect(open, `${lang} #${section}`).toContain(`aria-labelledby="${section}-title"`);
        // One h2 per section, and it is the card: named "<word>. <ribbon>", its drawing hidden from assistive technology.
        const start = html.indexOf(open);
        const end = html.indexOf("</section>", html.indexOf(`id="${section}-title"`));
        const body = html.slice(start, end);
        expect(body.match(/<h2\b/g), `${lang} #${section}`).toHaveLength(1);
        const heading = body.match(/<h2([^>]*)>([\s\S]*?)<\/h2>/);
        const { word, ribbon } = dict[section].chapter;
        const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
        expect(heading?.[1]).toContain(` id="${section}-title"`);
        expect(heading?.[1]).toContain(` aria-label="${escaped(chapterName(word, ribbon))}"`);
        expect(heading?.[2]).toMatch(/^<svg[^>]*aria-hidden="true"/);
        // Its only text: the word as written and the ribbon in capitals, once each (the shades are <use> copies).
        const text = (heading?.[2] ?? "").match(/>([^<]+)</g)?.map((match) => match.slice(1, -1)) ?? [];
        expect(text, `${lang} #${section}`).toEqual([escaped(ribbon.toLocaleUpperCase(lang)), escaped(word)]);
        expect(heading?.[2].match(/<use\b/g)?.length, `${lang} #${section}`).toBe(2 * shadeLayers().length);
      }
    }
  });

  it("links the STATS missions only to career-city stops that are on the page", async () => {
    const html = await renderHome("en");
    const present = ids(html);
    const dict = await getDictionary("en");
    for (const mission of MISSIONS) {
      expect(html.includes(`href="#${mission.anchor}"`), mission.anchor).toBe(present.has(mission.anchor));
      // Linked or not, the row keeps its content.
      expect(html).toContain(dict.stats.missions.items[mission.id].name);
    }
  });
});
