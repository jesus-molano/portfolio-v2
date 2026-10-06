import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Dictionary } from "@/i18n/dictionaries";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { Stats } from "./Stats";
import { ACHIEVEMENTS } from "./achievements";
import { PLACES } from "./statsLayout";

/** Every string under a value, with its path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

describe("STATS copy", () => {
  it("has the same keys, lists and value types in English and Spanish", () => {
    expect(shape(es.stats)).toEqual(shape(en.stats));
  });

  it("keeps the parody place names the same in both languages, like street signs", () => {
    expect(es.stats.map.places).toEqual(en.stats.map.places);
    expect(es.stats.map.inset.city).toBe(en.stats.map.inset.city);
  });

  it("names every place the map uses", () => {
    const names = Object.keys(en.stats.map.places);
    for (const place of PLACES) expect(names).toContain(place.id);
  });

  it("keeps the favourites' winks on their stars, the owner's fixed lines among them", () => {
    const nodes = (dict: typeof en) => dict.stats.achievements.nodes;
    // Pulp Fiction (the owner swapped it in for Gladiator): its burger, never Mr. Wolf, an old radio station's name.
    expect(nodes(es).pulpFiction.line).toBe("Royale con queso.");
    expect(nodes(en).pulpFiction.line).toBe("Royale with cheese.");
    expect(nodes(es).skyrim.line).toBe("Eh, tú, al fin has despertado.");
    expect(nodes(en).skyrim.line).toBe("Hey, you. You're finally awake.");
    expect(nodes(es).godfather.line).toBe("Le haré una oferta que no podrá rechazar.");
    expect(nodes(en).godfather.line).toBe("I'm gonna make him an offer he can't refuse.");
    for (const dict of [en, es]) {
      expect(nodes(dict).devilMayCry.line).toMatch(/olive|aceituna/i);
      expect(nodes(dict).breakingBad.line).toMatch(/cash|efectivo/i);
      expect(nodes(dict).peakyBlinders.line).toMatch(/caps|gorra/i);
      expect(nodes(dict).metalGear.line).toMatch(/cardboard|cartón/i);
      expect(nodes(dict).matrix.line).toMatch(/booth|cabina/i);
    }
  });

  it("winks at no radio station in the tree, and keeps out what the owner took out", () => {
    // The owner: people may never open the radio, so the tree never leans on it. Every station's name, and the word.
    const stations = /BOBSLED|RAHEEM|MANERO|ONE LOUDER|WITNESS ME|\bTOFU\b|\bradio\b|emisora|station/i;
    // Not his: the old radio's winks (Mr. Wolf, the cannoli, Miami Vice, which he has not seen), Box 33 and
    // Gladiator, which he swapped for Pulp Fiction.
    const removed = /Wolfe?\b|Lobo|cannoli|Miami|Corrupción|Crockett|Box 33|Gladiator|Fuerza y honor|Strength and honour/i;
    for (const dict of [en, es]) {
      for (const [path, text] of strings(dict.stats.achievements)) {
        expect(stations.test(text), `${path}: ${text}`).toBe(false);
        expect(removed.test(text), `${path}: ${text}`).toBe(false);
      }
    }
    const ids: string[] = ACHIEVEMENTS.map((item) => item.id);
    for (const id of ["gladiator", "miamiVice", "box33"]) expect(ids).not.toContain(id);
  });

  it("puts no hobby on the map: no star's title or line is said under the map's keys", () => {
    for (const dict of [en, es]) {
      const map = JSON.stringify(dict.stats.map);
      for (const item of ACHIEVEMENTS) {
        const { title, line } = dict.stats.achievements.nodes[item.id];
        expect(map, line).not.toContain(line);
        expect(map, title).not.toContain(title);
      }
    }
  });

  it("says LIVE in English in both files, and nowhere outside the missions", () => {
    for (const dict of [en, es]) {
      expect(dict.stats.missions.live).toBe("LIVE");
      for (const [path, text] of strings(dict.stats)) {
        if (path.startsWith("missions.")) continue;
        expect(/\blive\b|en directo/i.test(text), path).toBe(false);
      }
    }
  });

  it("keeps the F1 stars to the owner's two: up at 4 for a race, and Alonso's 33rd, pending since 2013", () => {
    for (const dict of [en, es]) {
      const { f1Dawn, alonso33 } = dict.stats.achievements.nodes;
      expect(f1Dawn.title).toMatch(/\b4\b/);
      expect(f1Dawn.title).toMatch(/F1/);
      expect(f1Dawn.line).toMatch(/dormir|sleep/i);
      expect(alonso33.title).toMatch(/\b33(rd)?\b/);
      expect(alonso33.line).toMatch(/2013/);
    }
  });

  it("never places him in Madrid, says remote only in the missions' work-mode labels, and never shows an email", () => {
    for (const dict of [en, es]) {
      for (const [path, text] of strings(dict.stats)) {
        expect(/madrid|teletrabajo|home office|@/i.test(text), `${path}: ${text}`).toBe(false);
        if (path !== "missions.modes.remote") expect(/remot/i.test(text), `${path}: ${text}`).toBe(false);
      }
    }
  });

  it("gives him the owner's final bio under his name, word for word, in both languages", () => {
    expect(es.stats.player.bio).toBe(
      "Cuido la experiencia de usuario al detalle: interfaces fluidas, responsive de verdad y sin nada hecho en serie. Uso la IA como herramienta, no como piloto automático, siempre dentro de mi propia capa de seguridad, restricciones y configuración.",
    );
    expect(en.stats.player.bio).toBe(
      "I sweat the user experience: smooth interfaces, truly responsive, nothing mass-produced. I use AI as a tool, not an autopilot, always inside my own layer of security, restrictions and configuration.",
    );
    // The owner dropped the opening "who and where": the page already says both.
    for (const bio of [es.stats.player.bio, en.stats.player.bio]) {
      expect(/Frontend Engineer|Tenerife/i.test(bio), bio).toBe(false);
    }
  });

  it("says pause once: the chapter card, never a second PAUSED title in the menu", () => {
    for (const dict of [en, es]) {
      const pause = strings(dict.stats).filter(([, text]) => /\bpaused?\b|\bpausa\b/i.test(text));
      expect(pause.map(([path]) => path).filter((path) => path !== "description" && path !== "tabsLabel")).toEqual(["chapter.word"]);
    }
  });

  it("never counts the cats in a record, and draws no halo anywhere", () => {
    for (const [lang, dict] of [["en", en], ["es", es]] as const) {
      // The line-up shows the four of them; a count here only raised the question of the fourth.
      for (const record of dict.stats.records.items) {
        const text = `${record.value} ${record.spoken} ${record.caption}`;
        expect(text, record.id).not.toMatch(/\d\s*\+\s*\d|\bcats?\b|\bgat[oa]s?\b|odin/i);
      }
      // Dante's record is his wanted level: five stars, said in words to a screen reader.
      const wanted = dict.stats.records.items.find((record) => record.id === "wanted");
      expect(wanted?.value).toBe("★★★★★");
      expect(wanted?.caption).toMatch(/Dante/);
      for (const [path, text] of strings(dict.stats)) {
        expect(/halo|aureola|from above|desde arriba|keeping watch|vigilando/i.test(text), `${path}: ${text}`).toBe(false);
      }
      const html = renderToStaticMarkup(createElement(Stats, { dict: dict.stats as Dictionary["stats"], lang }));
      expect(html).not.toMatch(/halo|<svg[^>]*viewBox="0 0 40 12"/i);
    }
  });

  it("says each record's value in words for screen readers, and tells the sofa once", () => {
    for (const dict of [en, es]) {
      for (const record of dict.stats.records.items) expect(record.spoken, record.id).toMatch(/\p{L}/u);
      const sofa = strings(dict.stats).filter(([, text]) => /sofa|sofá/i.test(text));
      expect(sofa.map(([path]) => path)).toEqual(["bars.items[0].caption"]);
    }
  });

  it("shows Heuristik by its role only", () => {
    for (const dict of [en, es]) {
      expect(dict.stats.missions.items.heuristik).toEqual({ name: "Heuristik", role: "Frontend Engineer" });
    }
  });

  it("puts one bar past 100 % (appetite) and keeps the others within 0 to 100", () => {
    for (const dict of [en, es]) {
      const over = dict.stats.bars.items.filter((bar) => bar.value > 100).map((bar) => bar.id);
      expect(over).toEqual(["appetite"]);
      for (const bar of dict.stats.bars.items) expect(bar.value).toBeGreaterThanOrEqual(0);
    }
  });
});
