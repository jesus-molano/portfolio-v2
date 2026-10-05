import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
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
        ...stats.saves.slots.map((slot) => slot.place),
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
    expect(html).toMatch(/<img[^>]*src="\/stats\/portrait\.svg"[^>]*loading="lazy"/);
  });
});
