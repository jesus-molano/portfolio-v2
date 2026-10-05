import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAREER } from "@/features/career/career";
import { STATIONS } from "@/features/music/stations";
import { CULPRIT } from "@/features/suspects/lineup";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  BUILT_WITH,
  CAR_CREDIT,
  CAST_CULPRIT,
  CAT_BASE_CREDIT,
  CC0_ASSETS,
  creditList,
  musicCredits,
  RELIEF_CREDIT,
  TOOLKIT,
  trackByline,
  TYPEFACES,
} from "./credits";
import { EndCredits } from "./EndCredits";
import { FEATURES } from "./links";

const LOCALES = [
  ["en", en],
  ["es", es],
] as const;

/** The credits as the server renders them. */
function renderCredits(locale: string, dict: typeof en) {
  return renderToStaticMarkup(createElement(EndCredits, { dict: dict.credits, newTab: dict.common.newTab, locale }));
}

describe("the asset credits", () => {
  it("credit the CC BY 3.0 car with its source, its licence and the note that it was modified", () => {
    expect(CAR_CREDIT.sourceUrl).toBe("https://poly.pizza/m/dggOiBLYyuR");
    expect(CAR_CREDIT.licence).toBe("CC BY 3.0");
    expect(CAR_CREDIT.licenceUrl).toBe("https://creativecommons.org/licenses/by/3.0/");
    expect(CAR_CREDIT.modified).toBe(true);
    for (const [locale, dict] of LOCALES) {
      expect(dict.credits.assets.car, locale).toContain("Convertible");
      expect(dict.credits.assets.modified, locale).toBeTruthy();
    }
  });

  it("credit the CC0 traffic and the driver's MakeHuman body", () => {
    expect(CC0_ASSETS.map((asset) => asset.maker)).toEqual(["Quaternius", "MakeHuman · MPFB 2"]);
    for (const [, dict] of LOCALES) for (const asset of CC0_ASSETS) expect(dict.credits.assets[asset.role]).toBeTruthy();
  });

  it("credit the cats' Apache-2.0 base and say plainly it is a modified version, made for the site", () => {
    expect(CAT_BASE_CREDIT.licence).toBe("Apache-2.0");
    expect(CAT_BASE_CREDIT.modified).toBe(true);
    expect(en.credits.assets.catsModified).toMatch(/^a modified version, .*fur, eyes and markings/);
    expect(es.credits.assets.catsModified).toMatch(/^versión modificada, .*pelo, ojos y manchas/);
    // Nobody is left wondering who "we" are.
    expect(en.credits.assets.catsModified).not.toMatch(/\b(we|our|us)\b/i);
    expect(es.credits.assets.catsModified).not.toMatch(/\b(propios|nuestr[oa]s?|hemos)\b/i);
  });

  it("credit the map's relief: SRTM, GMTED2010 and ETOPO1, public domain (public/stats/LICENSE.txt)", () => {
    expect([...RELIEF_CREDIT.datasets]).toEqual(["SRTM", "GMTED2010", "ETOPO1"]);
    expect([...RELIEF_CREDIT.makers]).toEqual(["NASA", "USGS", "NOAA"]);
    expect(RELIEF_CREDIT.sourceUrl).toBe("https://registry.opendata.aws/terrain-tiles/");
    expect(en.credits.assets.publicDomain).toBe("public domain");
    expect(es.credits.assets.publicDomain).toBe("dominio público");
  });

  it("head them as props and sets, in film-credit words", () => {
    expect(en.credits.assets.title).toBe("PROPS AND SETS");
    expect(es.credits.assets.title).toBe("ATREZO Y DECORADOS");
  });
});

describe("the music credits", () => {
  const tracks = musicCredits().flatMap(({ credits }) => credits);

  it("credit every track on air, by station, nothing else", () => {
    const onAir = STATIONS.flatMap((station) => station.tracks.map((track) => track.credit));
    expect(tracks).toEqual(onAir);
    expect(tracks.length).toBeGreaterThan(0);
  });

  it("credit every CC BY 4.0 track in its author's format: title, author (site), licence", () => {
    const ccBy = tracks.filter((credit) => credit.licence === "CC BY 4.0");
    expect(ccBy.length).toBeGreaterThan(0);
    for (const credit of ccBy) {
      expect(trackByline(credit, "by")).toBe("Kevin MacLeod (incompetech.com)");
      expect(credit.sourceUrl).toMatch(/^https:\/\/(incompetech\.com|incompetech\.filmmusic\.io)\//);
      expect(credit.licenceUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
    }
    expect(en.credits.music.licences["CC BY 4.0"]).toBe("Licensed under Creative Commons: By Attribution 4.0 License");
    // The licence's official Spanish name, in lower case after the comma that leads to it.
    expect(es.credits.music.licences["CC BY 4.0"]).toBe("con licencia Creative Commons: Atribución 4.0 Internacional");
  });

  it("name the other artists after the dictionary's 'by'", () => {
    expect(trackByline({ artist: "HoliznaCC0" }, "de")).toBe("de HoliznaCC0");
  });

  it("have a licence name for every licence in both languages", () => {
    for (const [locale, dict] of LOCALES) {
      for (const credit of tracks) expect(dict.credits.music.licences[credit.licence], locale).toBeTruthy();
    }
  });
});

describe("what the credits leave to the other sections", () => {
  it("name no job and no side project: STATS, the career city and the cinema tell them", () => {
    for (const [locale, dict] of LOCALES) {
      const html = renderCredits(locale, dict);
      for (const job of CAREER) expect(html, `${locale} ${job.id}`).not.toContain(job.name[locale]);
      for (const feature of FEATURES) expect(html, `${locale} ${feature.repo}`).not.toContain(feature.repo);
      expect(html, locale).not.toMatch(/\bLIVE\b/);
    }
  });
});

describe("the roll's order", () => {
  it("brings the contact before the fine print: title, cast, the tickets, then the licences, then the end", () => {
    for (const [locale, dict] of LOCALES) {
      const html = renderCredits(locale, dict);
      const order = [
        'id="credits-title"',
        'id="credits-cast"',
        'id="contact"',
        "github.com/jesus-molano",
        'id="credits-assets"',
        'id="credits-music"',
        'id="credits-type"',
        'id="credits-toolkit"',
        'id="credits-built"',
        `>${dict.credits.end}<`,
        dict.credits.last,
      ].map((marker) => [marker, html.indexOf(marker)] as const);
      for (const [marker, at] of order) expect(at, `${locale} ${marker}`).toBeGreaterThan(0);
      expect(order.map(([, at]) => at), locale).toEqual(order.map(([, at]) => at).sort((a, b) => a - b));
    }
  });
});

describe("the cast and the rest", () => {
  it("casts the driver as himself and bills the culprit, Dante; Odin is never named (the owner's call)", () => {
    expect(en.credits.cast).toMatchObject({ driver: "The driver", himself: "Himself", culprit: "The culprit" });
    expect(es.credits.cast).toMatchObject({ driver: "El conductor", himself: "Él mismo", culprit: "El culpable" });
    expect(CAST_CULPRIT).toBe("Dante");
    expect(CAST_CULPRIT.toLowerCase()).toBe(CULPRIT);
    expect(JSON.stringify([en.credits, es.credits, CAST_CULPRIT])).not.toMatch(/Odin/i);
  });

  it("names him twice at most: written and directed by, and the copyright (the marquee bills him too)", () => {
    for (const [locale, dict] of LOCALES) {
      const html = renderCredits(locale, dict);
      expect(html.split("Jesús Molano").length - 1, locale).toBeLessThanOrEqual(2);
    }
  });

  it("keeps one list of his toolkit and one of what the site is built with, no name in both, no Vue or Nuxt", () => {
    for (const list of [TOOLKIT, BUILT_WITH]) expect(new Set(list).size).toBe(list.length);
    expect(TOOLKIT.filter((name) => (BUILT_WITH as readonly string[]).includes(name))).toEqual([]);
    // What only this site uses stays in BUILT_WITH.
    for (const name of ["Three.js", "React Three Fiber", "GSAP"]) expect(BUILT_WITH).toContain(name);
    for (const list of [TOOLKIT, BUILT_WITH]) {
      expect(list).not.toContain("Vue");
      expect(list).not.toContain("Nuxt");
    }
    expect(en.credits.toolkit).toBe("HIS TOOLKIT");
    expect(es.credits.toolkit).toBe("SU CAJA DE HERRAMIENTAS");
  });

  it("credits every typeface once", () => {
    const faces = [...TYPEFACES.site, ...TYPEFACES.radio, ...TYPEFACES.posters];
    expect(new Set(faces).size).toBe(faces.length);
    expect(faces).toContain("Bebas Neue");
  });
});

describe("creditList", () => {
  it("joins with a dot that never starts a line (no-break space before it)", () => {
    expect(creditList(["React", "Next.js", "Git"])).toBe("React\u00a0· Next.js\u00a0· Git");
    expect(creditList(["Kira"])).toBe("Kira");
    expect(creditList([])).toBe("");
  });
});
