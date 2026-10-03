import { describe, expect, it } from "vitest";
import { hasLocale, negotiateLocale } from "./config";

describe("negotiateLocale", () => {
  it("falls back to the default locale without a header", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
  });

  it("picks the best supported language by quality", () => {
    expect(negotiateLocale("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
    expect(negotiateLocale("fr-FR,fr;q=0.9,es;q=0.5,en;q=0.8")).toBe("en");
  });

  it("matches the base language of regional tags, ignoring case", () => {
    expect(negotiateLocale("ES-MX")).toBe("es");
    expect(negotiateLocale("EN-GB,es;q=0.2")).toBe("en");
  });

  it("ignores languages with q=0 and malformed qualities", () => {
    expect(negotiateLocale("es;q=0,fr;q=0.8")).toBe("en");
    expect(negotiateLocale("es;q=abc,en;q=0.5")).toBe("en");
  });

  it("keeps header order when qualities tie", () => {
    expect(negotiateLocale("es,en")).toBe("es");
    expect(negotiateLocale("en,es")).toBe("en");
  });
});

describe("hasLocale", () => {
  it("accepts only the configured locales", () => {
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("es")).toBe(true);
    expect(hasLocale("EN")).toBe(false);
    expect(hasLocale("fr")).toBe(false);
  });
});
