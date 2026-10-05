import { afterEach, describe, expect, it, vi } from "vitest";
import { locales } from "@/i18n/config";
import robots from "./robots";
import sitemap from "./sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("robots.txt and the sitemap", () => {
  it("lets every crawler in and points at the sitemap on the site's own address", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: "https://example.com/sitemap.xml" });
  });

  it("lists the page once per language, each with every language as its alternate", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "portfolio-v2-sage-six-74.vercel.app");
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(
      locales.map((locale) => `https://portfolio-v2-sage-six-74.vercel.app/${locale}`),
    );
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual([...locales, "x-default"].sort());
    }
  });
});
