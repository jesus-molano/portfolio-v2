import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { FEATURES } from "@/features/finale/links";
import { getDictionary } from "@/i18n/dictionaries";
import { Stats } from "./Stats";

/** Text as React writes it into HTML. */
const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/**
 * The server HTML, which is what a visitor without JS gets: both tabs'
 * words, one panel after the other, and two plain links between them. The
 * tab roles only come with hydration (StatsTabs.tsx).
 */
describe("STATS in the server HTML", () => {
  for (const lang of locales) {
    it(`has both tabs' words, MAP's and STATS's, on /${lang}`, async () => {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats }));
      const words = [
        ...Object.values(stats.map.blips),
        ...Object.values(stats.missions.items).map((item) => item.name),
        ...stats.bars.items.flatMap((bar) => [bar.label, bar.caption]),
        ...stats.records.items.map((record) => record.caption),
        stats.player.name,
      ];
      for (const text of words) expect(html, text).toContain(escape(text));
      // MAP's panel, then STATS's.
      expect(html.indexOf(' id="stats-map"')).toBeGreaterThan(0);
      expect(html.indexOf(' id="stats-sheet"')).toBeGreaterThan(html.indexOf(' id="stats-map"'));
    });
  }

  it("puts the main missions before the map, and the map's way out (the booth) after them", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats }));
      const missions = html.indexOf(' id="stats-missions"');
      expect(missions).toBeGreaterThan(html.indexOf(' id="stats-map"'));
      expect(html.indexOf(' id="stats-map-title"')).toBeGreaterThan(missions);
      expect(html.indexOf('href="#projects"')).toBeGreaterThan(html.indexOf(' id="stats-map-title"'));
    }
  });

  it("makes the foot's way on a real link to the cinema, named by its visible label", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats }));
      const link = html.match(/<a[^>]*href="#projects"[^>]*>((?:(?!<\/a>).)*)<\/a>(?![\s\S]*href="#projects")/)?.[1] ?? "";
      expect(link).toContain(stats.hint);
      expect(link).toContain(`: ${escape(stats.hintTarget)}`);
      expect(html).not.toMatch(/<p[^>]*aria-hidden="true"[^>]*>[^<]*<span[^>]*>▼/);
    }
  });

  it("names the ringing booth by what it shows, its action and then where it leads (label in name)", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats }));
      const open = html.match(/<a[^>]*href="#projects"[^>]*>/)?.[0] ?? "";
      expect(open, lang).toContain("boothLink");
      // No aria-label: the link's own words are its name, so a voice command for the visible text finds it.
      expect(open, lang).not.toContain("aria-label");
      const booth = html.slice(html.indexOf(open), html.indexOf("</a>", html.indexOf(open)));
      const said = booth.replace(/<[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "");
      expect(said, lang).toContain(escape(stats.map.booth.caption));
      expect(said, lang).toContain(`${escape(stats.map.booth.action)}: ${escape(stats.hintTarget)}`);
    }
  });

  it("leaves the side projects to the cinema: no repo is named in STATS", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats })).toLowerCase();
      for (const feature of FEATURES) expect(html, feature.repo).not.toContain(feature.repo.toLowerCase());
    }
  });

  it("links the two panels with plain links until the tabs hydrate", async () => {
    const { stats } = await getDictionary("en");
    const html = renderToStaticMarkup(createElement(Stats, { dict: stats }));
    expect(html).toContain('href="#stats"');
    expect(html).toContain('href="#stats-sheet"');
    expect(html).not.toMatch(/role="tab(list|panel)?"/);
    expect(html).not.toContain("aria-selected");
  });

  it("keeps the map and the portrait lazy in the first HTML", async () => {
    const { stats } = await getDictionary("en");
    const html = renderToStaticMarkup(createElement(Stats, { dict: stats }));
    expect(html).toMatch(/<img[^>]*src="\/stats\/map\.svg"[^>]*loading="lazy"/);
    expect(html).toMatch(/<img[^>]*src="\/stats\/portrait\.webp"[^>]*loading="lazy"/);
  });
});
