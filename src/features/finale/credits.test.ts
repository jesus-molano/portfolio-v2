import { describe, expect, it } from "vitest";
import { STATIONS } from "@/features/music/stations";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import {
  BUILT_WITH,
  CAR_CREDIT,
  CAREER,
  CAST_CATS,
  CC0_ASSETS,
  creditList,
  EQUIPMENT,
  LIVE,
  musicCredits,
  trackByline,
  TYPEFACES,
  yearsLabel,
} from "./credits";

const LOCALES = [
  ["en", en],
  ["es", es],
] as const;

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

describe("the career", () => {
  it("runs newest first, from the army to Heuristik, without gaps in the years", () => {
    expect(CAREER.map((entry) => entry.id)).toEqual(["heuristik", "logixs", "cloud-district", "pwc", "army"]);
    for (let i = 1; i < CAREER.length; i++) expect(CAREER[i].from).toBeLessThanOrEqual(CAREER[i - 1].from);
  });

  it("puts a city only on the army: the civilian jobs name none, and never Madrid", () => {
    for (const entry of CAREER) {
      if (entry.id === "army") expect(entry.place).toBe("Las Palmas de Gran Canaria");
      else expect(entry.place, entry.id).toBeNull();
    }
    const everything = JSON.stringify([CAREER, en.credits, es.credits]);
    expect(everything).not.toMatch(/Madrid/);
  });

  it("tags Heuristik LIVE, in English, in every language, and nothing else", () => {
    expect(CAREER.filter((entry) => entry.to === "live").map((entry) => entry.id)).toEqual(["heuristik"]);
    expect(yearsLabel({ from: 2026, to: "live" })).toEqual({ from: "2026", to: LIVE, live: true });
    expect(yearsLabel({ from: 2018, to: 2021 })).toEqual({ from: "2018", to: "2021", live: false });
    expect(LIVE).toBe("LIVE");
  });

  it("has a role for every job in both languages; Heuristik's reads Frontend Engineer in both", () => {
    for (const [locale, dict] of LOCALES) {
      expect(Object.keys(dict.credits.career.roles).sort(), locale).toEqual(CAREER.map((entry) => entry.id).sort());
      expect(dict.credits.career.roles.heuristik).toBe("Frontend Engineer");
      expect(dict.credits.career.army, locale).toContain("Batallón de Zapadores XVI");
    }
  });
});

describe("the cast and the rest", () => {
  it("names the three usual suspects and never Odin (the owner's call)", () => {
    expect([...CAST_CATS]).toEqual(["Kira", "Tom", "Dante"]);
    expect(JSON.stringify([en.credits, es.credits, CAST_CATS])).not.toMatch(/Odin/i);
  });

  it("lists the equipment and the tools once each, Vue and Nuxt left out", () => {
    for (const list of [EQUIPMENT, BUILT_WITH]) expect(new Set(list).size).toBe(list.length);
    expect(EQUIPMENT).not.toContain("Vue");
    expect(EQUIPMENT).not.toContain("Nuxt");
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
