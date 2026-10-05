import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MISSIONS } from "@/features/stats/statsLayout";
import { LoadingScreen } from "@/features/loader/LoadingScreen";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { HomeMain } from "./HomeMain";

/** The home page as the server renders it: the loading screen, then every section in <main>. */
async function renderHome(lang: (typeof locales)[number]): Promise<string> {
  const dict = await getDictionary(lang);
  return renderToStaticMarkup(
    createElement("body", null, createElement(LoadingScreen, { dict: dict.loader, name: dict.hero.name, role: dict.hero.role }), createElement(HomeMain, { dict, lang })),
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
