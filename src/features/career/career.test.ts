import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { ARMY, CAREER, isLive, LIVE } from "./career";

const LOCALES = [
  ["en", en],
  ["es", es],
] as const;

describe("the career", () => {
  it("runs oldest first, from the army to Heuristik, numbered one to five, and the years never go back", () => {
    expect(CAREER.map((job) => job.id)).toEqual(["army", "pwc", "cloud-district", "logixs", "heuristik"]);
    expect(CAREER.map((job) => job.number)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < CAREER.length; i++) expect(CAREER[i].years[0]).toBeGreaterThanOrEqual(CAREER[i - 1].years[0]);
    for (const job of CAREER) expect(job.anchor).toBe(`work-${job.id}`);
  });

  it("keeps the years the owner gave", () => {
    expect(Object.fromEntries(CAREER.map((job) => [job.id, job.years]))).toEqual({
      army: [2018, 2021],
      pwc: [2023, 2024],
      "cloud-district": [2024, 2025],
      logixs: [2025, 2026],
      heuristik: [2026, null],
    });
  });

  it("puts a city only on the army: the civilian jobs name none, and never Madrid", () => {
    for (const job of CAREER) {
      if (job.id === "army") expect(job.place).toBe("Las Palmas de Gran Canaria");
      else expect(job.place, job.id).toBeNull();
    }
    const everything = JSON.stringify([CAREER, ARMY, en, es]);
    expect(everything).not.toMatch(/Madrid/i);
  });

  it("never says he works remotely, anywhere in the copy", () => {
    expect(JSON.stringify([en, es])).not.toMatch(/\bremot|teletrabajo/i);
  });

  it("tags Heuristik LIVE, in English, in every language, and nothing else", () => {
    expect(CAREER.filter(isLive).map((job) => job.id)).toEqual(["heuristik"]);
    expect(LIVE).toBe("LIVE");
    for (const [locale, dict] of LOCALES) expect(dict.stats.missions.live, locale).toBe(LIVE);
  });

  it("writes the roles in English in both languages, Heuristik's as Frontend Engineer; the army's in each", () => {
    for (const job of CAREER) {
      expect(job.role.en, job.id).toBeTruthy();
      expect(job.role.es, job.id).toBeTruthy();
      if (job.id !== "army") expect(job.role.es, job.id).toBe(job.role.en);
    }
    const role = (id: string) => CAREER.find((job) => job.id === id)!.role;
    expect(role("heuristik")).toEqual({ en: "Frontend Engineer", es: "Frontend Engineer" });
    expect(role("logixs").en).toBe("Full Stack Developer");
    expect(role("pwc").en).toBe("Frontend Developer");
    expect(role("cloud-district").en).toBe("Frontend Developer");
    expect(role("army")).toEqual({ en: "Combat engineer", es: "Zapador" });
    expect(ARMY.record).toEqual({ en: "Combat engineer", es: "Soldado zapador" });
  });

  it("names his unit in the army, in every language, and the employers as they write themselves", () => {
    const name = (id: string) => CAREER.find((job) => job.id === id)!.name;
    for (const [locale] of LOCALES) expect(name("army")[locale], locale).toBe("Batallón de Zapadores XVI");
    expect(name("pwc")).toEqual({ en: "PwC España", es: "PwC España" });
    expect(ARMY.service).toEqual({ en: "Spanish Army", es: "Ejército de Tierra" });
  });

  it("is what STATS says: the dictionaries' mission rows carry the same names and roles", () => {
    for (const [locale, dict] of LOCALES) {
      const items = dict.stats.missions.items;
      expect(Object.keys(items).sort(), locale).toEqual(CAREER.map((job) => job.id).sort());
      for (const job of CAREER) {
        expect(items[job.id], `${locale} ${job.id}`).toEqual({ name: job.name[locale], role: job.role[locale] });
      }
    }
  });
});
