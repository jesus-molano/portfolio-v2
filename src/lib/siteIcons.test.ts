import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { chapterCard, palette } from "@/design/tokens";
import manifest from "@/app/manifest";
import { generateMetadata } from "@/app/[lang]/layout";
import { locales } from "@/i18n/config";
import { MANIFEST_ICONS, SITE_ICONS } from "./siteIcons";
import { TAB_16, TAB_32, pixelPng } from "../../tools/art/favicon/build.mjs";

// The layout's faces are next/font's, which only the Next compiler can load.
vi.mock("next/font/google", () => {
  const face = () => ({ variable: "", className: "", style: {} });
  const names = ["Bebas_Neue", "Bowlby_One", "JetBrains_Mono", "Kanit", "Limelight", "Playfair_Display", "Shrikhand", "Space_Grotesk", "Special_Elite", "Unbounded", "Yellowtail"];
  return Object.fromEntries(names.map((name) => [name, face]));
});
vi.mock("next/font/local", () => ({ default: () => ({ variable: "", className: "", style: {} }) }));

const PUBLIC = path.resolve(__dirname, "../../public");
const file = (url: string) => fs.readFileSync(path.join(PUBLIC, url));

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(data: Buffer): [number, number] {
  expect(data.subarray(1, 4).toString("latin1")).toBe("PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

/** An .ico's entries: each one's size, and the size of the PNG inside it. */
function icoEntries(data: Buffer) {
  expect(data.readUInt16LE(2)).toBe(1);
  return Array.from({ length: data.readUInt16LE(4) }, (_, i) => {
    const at = 6 + 16 * i;
    const size = data.readUInt8(at) || 256;
    const image = data.subarray(data.readUInt32LE(at + 12), data.readUInt32LE(at + 12) + data.readUInt32LE(at + 8));
    return { size, png: pngSize(image), image };
  });
}

const sizesOf = (sizes: string | undefined) => (sizes ?? "").split(" ").map((s) => s.split("x").map(Number));

describe("the site's icons", () => {
  it("are listed by every locale's metadata, and by a path with no locale", async () => {
    for (const lang of [...locales, "xx"]) {
      const metadata = await generateMetadata({ params: Promise.resolve({ lang }) });
      expect(metadata.icons).toEqual(SITE_ICONS);
    }
    expect(SITE_ICONS.icon.map((icon) => icon.url)).toEqual(["/favicon.ico", "/favicon.svg"]);
    expect(SITE_ICONS.apple.map((icon) => icon.url)).toEqual(["/apple-touch-icon.png"]);
  });

  it("each exist at the sizes they claim", () => {
    const [ico] = SITE_ICONS.icon;
    expect(icoEntries(file(ico.url)).map((entry) => [entry.size, entry.png])).toEqual(
      sizesOf(ico.sizes).map(([w, h]) => [w, [w, h]]),
    );
    for (const icon of [...SITE_ICONS.apple, ...MANIFEST_ICONS.map(({ src, sizes, type }) => ({ url: src, sizes, type }))]) {
      expect(pngSize(file(icon.url))).toEqual(sizesOf(icon.sizes)[0]);
    }
  });

  it("give the tab its pixel drawings exactly: the .ico's 16 and 32 entries", () => {
    // Chrome takes the listed .ico's exact entry; a rebuilt drawing with a
    // stale .ico (or the other way round) fails here.
    const entries = icoEntries(file(SITE_ICONS.icon[0].url));
    expect(entries.find((entry) => entry.size === 16)?.image).toEqual(pixelPng(TAB_16));
    expect(entries.find((entry) => entry.size === 32)?.image).toEqual(pixelPng(TAB_32));
  });

  it("put both drawings in the tab's SVG, small, in the tokens' colours, with no text or raster", () => {
    const svg = file("/favicon.svg").toString("utf8");
    expect(svg.length).toBeLessThan(6144);
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toMatch(/<(image|text|script|foreignObject)\b/);
    // Its one style only switches the 16 for the 32 at larger sizes.
    expect(svg.match(/<style>(.*?)<\/style>/)?.[1]).toMatch(/^\.b\{display:none\}@media [^{]*\{\.a\{display:none\}\.b\{display:inline\}\}$/);
    const tokens = new Set([...Object.values(palette), ...Object.values(chapterCard)].map((v) => String(v).toLowerCase()));
    const colours = [...new Set(svg.match(/#[0-9a-f]{6}\b/gi) ?? [])].map((c) => c.toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    expect(colours.filter((c) => !tokens.has(c))).toEqual([]);
    // Both drawings are square, one letter a pixel (the letters are the tokens above).
    for (const grid of [TAB_16, TAB_32]) {
      expect(grid).toHaveLength(grid[0].length);
      expect(grid.every((row) => row.length === grid.length)).toBe(true);
    }
  });

  it("are in the web manifest", async () => {
    expect((await manifest()).icons).toEqual(MANIFEST_ICONS);
  });
});
