import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

function request(path: string, acceptLanguage?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });
}

function location(response: Response | undefined) {
  return response?.headers.get("location");
}

describe("proxy", () => {
  it("redirects the root to the negotiated locale", () => {
    expect(location(proxy(request("/", "es-ES,es;q=0.9")))).toBe("http://localhost:3000/es");
    expect(location(proxy(request("/")))).toBe("http://localhost:3000/en");
  });

  it("leaves localized paths alone", () => {
    expect(proxy(request("/en"))).toBeUndefined();
    expect(proxy(request("/es/anything"))).toBeUndefined();
  });

  it("normalizes an upper-case locale prefix", () => {
    expect(location(proxy(request("/EN")))).toBe("http://localhost:3000/en");
    expect(location(proxy(request("/Es/foo")))).toBe("http://localhost:3000/es/foo");
  });

  it("prefixes unknown paths with the locale", () => {
    expect(location(proxy(request("/foo", "es")))).toBe("http://localhost:3000/es/foo");
  });

  it("matcher skips internals and assets but not look-alike paths", () => {
    const pattern = new RegExp(`^${config.matcher[0].replace(/^\/\(/, "/(")}$`);
    expect(pattern.test("/")).toBe(true);
    expect(pattern.test("/apiary")).toBe(true);
    expect(pattern.test("/api/health")).toBe(false);
    expect(pattern.test("/_next/static/chunk.js")).toBe(false);
    expect(pattern.test("/favicon.svg")).toBe(false);
  });
});
