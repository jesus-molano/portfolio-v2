import { describe, expect, it } from "vitest";
import { absoluteUrl, LOCAL_SITE_URL, siteUrl } from "./siteUrl";

describe("siteUrl", () => {
  it("takes NEXT_PUBLIC_SITE_URL first, without a trailing slash", () => {
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.com/", VERCEL_PROJECT_PRODUCTION_URL: "other.vercel.app" }),
    ).toBe("https://example.com");
  });

  it("falls back to the production domain Vercel sets, over https", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "portfolio-v2-sage-six-74.vercel.app" })).toBe(
      "https://portfolio-v2-sage-six-74.vercel.app",
    );
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: " ", VERCEL_PROJECT_PRODUCTION_URL: "https://site.vercel.app/" })).toBe(
      "https://site.vercel.app",
    );
  });

  it("is the dev server when neither is set", () => {
    expect(siteUrl({})).toBe(LOCAL_SITE_URL);
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "" })).toBe(LOCAL_SITE_URL);
  });

  it("gives a URL that parses", () => {
    expect(() => new URL(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "site.vercel.app" }))).not.toThrow();
  });
});

describe("absoluteUrl", () => {
  it("joins the base and a path with exactly one slash", () => {
    expect(absoluteUrl("/en", "https://example.com")).toBe("https://example.com/en");
    expect(absoluteUrl("og/es.jpg", "https://example.com/")).toBe("https://example.com/og/es.jpg");
    expect(absoluteUrl("/sitemap.xml", "http://localhost:3000")).toBe("http://localhost:3000/sitemap.xml");
  });
});
