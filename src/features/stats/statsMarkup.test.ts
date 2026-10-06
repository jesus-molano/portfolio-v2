import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { FEATURES } from "@/features/finale/links";
import { getDictionary } from "@/i18n/dictionaries";
import { ACHIEVEMENTS, formatTally, tally } from "./achievements";
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
    it(`has every tab's words, STATS's, MAP's, ACHIEVEMENTS' and SETTINGS', on /${lang}`, async () => {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
      const words = [
        stats.player.title,
        stats.player.bio,
        ...stats.bars.items.flatMap((bar) => [bar.label, bar.caption]),
        ...stats.records.items.map((record) => record.caption),
        ...Object.values(stats.missions.items).map((item) => item.name),
        stats.missions.modes.onSite,
        stats.missions.modes.remote,
        stats.map.hq,
        stats.map.dock,
        ...Object.values(stats.achievements.nodes).flatMap((node) => [node.title, node.line]),
        ...Object.values(stats.achievements.branches),
        ...Object.values(stats.achievements.groups),
        stats.settings.audio.volume,
        ...stats.settings.controls.rows.map((row) => row.action),
        stats.settings.display.subtitles,
      ];
      for (const text of words) expect(html, text).toContain(escape(text));
      // In the menu's order: STATS's panel, then MAP's, ACHIEVEMENTS' and SETTINGS'.
      const at = ["stats-sheet", "stats-map", "stats-achievements", "stats-settings"].map((id) => html.indexOf(` id="${id}"`));
      expect(at[0]).toBeGreaterThan(0);
      for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]);
    });
  }

  it("heads the bio About me on the card, like the panels beside it, and names him in the portrait's text alternative", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
      const plate = html.slice(html.indexOf("<figcaption"), html.indexOf("</figcaption>"));
      // The owner's call: About me over the bio, not his name a second time as a title.
      const heading = plate.match(/<h3 id="stats-about" class="([^"]*)">([^<]*)<\/h3>/);
      expect(heading?.[2], lang).toBe(escape(stats.player.title));
      expect(stats.player.title, lang).toBe(lang === "en" ? "ABOUT ME" : "SOBRE MÍ");
      // In the panels' own heading style, as SKILLS and RECORDS are.
      const skills = html.match(/<h3 id="stats-skills" class="([^"]*)">/);
      expect(heading?.[1]).toBe(skills?.[1]);
      expect(plate.indexOf(escape(stats.player.bio))).toBeGreaterThan(plate.indexOf("</h3>"));
      expect(plate).not.toMatch(/Molano/i);
      // Whose profile it is: the portrait, before the plate, says.
      expect(stats.player.alt, lang).toMatch(/^Jesús\b/);
      expect(html).toContain(`alt="${escape(stats.player.alt)}"`);
    }
  });

  it("puts the main missions before the map, each saying how it was done", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
      const missions = html.indexOf(' id="stats-missions"');
      expect(missions).toBeGreaterThan(html.indexOf(' id="stats-map"'));
      expect(html.indexOf(' id="stats-map-title"')).toBeGreaterThan(missions);
      const list = html.slice(missions, html.indexOf("</ol>", missions));
      const modes = (text: string) => list.split(`>${escape(text)}</span>`).length - 1;
      expect(modes(stats.missions.modes.onSite), lang).toBe(2);
      expect(modes(stats.missions.modes.remote), lang).toBe(3);
    }
  });

  it("has no way out at its foot any more: no prompts, and no link on to the cinema", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
      expect(html).not.toContain('href="#projects"');
      expect(html).not.toMatch(/[▸▶◂◀▼]/);
    }
  });

  it("leaves the side projects to the cinema: no repo is named in STATS", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang })).toLowerCase();
      for (const feature of FEATURES) expect(html, feature.repo).not.toContain(feature.repo.toLowerCase());
    }
  });

  it("links the four panels with plain links until the tabs hydrate", async () => {
    const lang = "en";
    const { stats } = await getDictionary(lang);
    const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
    for (const href of ["#stats", "#stats-map", "#stats-achievements", "#stats-settings"]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toMatch(/role="tab(list|panel)?"/);
    expect(html).not.toContain("aria-selected");
  });

  it("keeps the map and the portrait lazy in the first HTML", async () => {
    const lang = "en";
    const { stats } = await getDictionary(lang);
    const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
    expect(html).toMatch(/<img[^>]*src="\/stats\/map\.svg"[^>]*loading="lazy"/);
    expect(html).toMatch(/<img[^>]*src="\/stats\/portrait\.webp"[^>]*loading="lazy"/);
  });

  it("gives every setting a name: the switch, the stations, the volume, the sizes and the languages", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
      expect(html).toMatch(/<button[^>]*role="switch"[^>]*aria-checked="false"[^>]*aria-labelledby="stats-settings-radio"/);
      expect(html).toMatch(/<label[^>]*for="stats-settings-volume"/);
      expect(html).toMatch(/<input[^>]*id="stats-settings-volume"[^>]*type="range"/);
      // Six stations and three sizes, each a radio button inside its labelled group.
      expect(html.match(/type="radio"/g)).toHaveLength(6 + 3);
      expect(html.match(/<legend/g)).toHaveLength(2);
      // The other language opens on this tab.
      const other = lang === "en" ? "es" : "en";
      expect(html).toContain(`href="/${other}#stats-settings"`);
      expect(html).toContain('aria-current="true"');
    }
  });

  it("writes every control's keys as key caps", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
      const caps = stats.settings.controls.rows.flatMap((row) => row.keys.flat());
      for (const key of caps) expect(html, key).toContain(`>${escape(key)}</kbd>`);
    }
  });

  it("draws the achievement tree as real buttons in a nested list, each saying what it is, whether it is unlocked and its line", async () => {
    for (const lang of locales) {
      const { stats } = await getDictionary(lang);
      const html = renderToStaticMarkup(createElement(Stats, { dict: stats, lang }));
      const { achievements } = stats;
      const panel = html.slice(html.indexOf(' id="stats-achievements"'), html.indexOf(' id="stats-settings"'));
      // The heading counts what the data holds.
      expect(panel).toContain(escape(formatTally(achievements.count, tally())));
      // One list of branches, each with its own list of stars; SPORT's constellations nest one deeper.
      expect(panel).toMatch(/<ol[^>]*aria-labelledby="stats-achievements-title"/);
      const buttons = [...panel.matchAll(/<button type="button"[^>]*data-achievement="([^"]+)"[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)];
      expect(buttons.map((match) => match[1]).sort(), lang).toEqual(ACHIEVEMENTS.map((item) => item.id).sort());
      for (const [, id, label, inner] of buttons) {
        const item = ACHIEVEMENTS.find((achievement) => achievement.id === id)!;
        const { title, line } = achievements.nodes[item.id];
        const status = item.lock === "none" ? achievements.status.unlocked : achievements.status.locked;
        const hard = item.lock === "max" || item.lock === "surrendered" ? achievements.hardLocks[item.lock] : null;
        const tag = hard ?? (item.favourite ? achievements.favourite : null);
        // What a screen reader hears, and every word of it is on the button for the eye too (label in name).
        expect(label, `${lang} ${id}`).toBe(escape([title, status, tag, line].filter(Boolean).join(", ")));
        for (const words of [title, status, tag, line]) if (words) expect(inner, `${lang} ${id}`).toContain(`>${escape(words)}<`);
      }
      // His favourites say so in their names: "El Padrino, desbloqueado, favorita, ...".
      expect(panel).toContain(`aria-label="${escape([achievements.nodes.godfather.title, achievements.status.unlocked, achievements.favourite].join(", "))}, `);
      // The links and the sky are drawing: hidden from screen readers.
      expect(panel).toMatch(/<svg[^>]*viewBox="0 0 1200 640"[^>]*aria-hidden="true"/);
      // The old fragment still has somewhere to land.
      expect(panel).toContain(' id="stats-favorites"');
    }
  });
});
