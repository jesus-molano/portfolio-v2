/**
 * Headless Chromium for the art generators (tools/art), with Google Fonts
 * answered from a local cache in .art-cache/fonts, so a second run works
 * offline and every run sees the same font files.
 *
 * The faces are only needed to bake the art: the generated images ship,
 * the fonts do not. Fetching them needs the same hosts as `pnpm build`
 * (fonts.googleapis.com and fonts.gstatic.com).
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const CACHE = path.join(ROOT, ".art-cache/fonts");
/** A fixed desktop Chrome user agent: Google Fonts answers it with woff2. */
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Sandboxes often ship a global Playwright instead of a local one.
    return import(process.env.PLAYWRIGHT_GLOBAL ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
  }
}

function cached(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, crypto.createHash("sha1").update(url).digest("hex"));
  if (!fs.existsSync(file)) execFileSync("curl", ["-sSfL", "-A", UA, "-o", file, url]);
  return fs.readFileSync(file);
}

/** A Google Fonts CSS URL for the given families ("Bebas Neue", "Cinzel:wght@800;900", ...). */
export function fontUrl(families) {
  const query = families.map((family) => `family=${family.replace(/ /g, "+")}`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=block`;
}

/**
 * Opens one browser for a batch of renders. `fn(render)` gets a function
 * that rasterises an HTML document at a size and returns PNG bytes, after
 * every font in it has loaded.
 */
export async function withRenderer(fn) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
      const url = route.request().url();
      const type = url.includes("googleapis") ? "text/css" : "font/woff2";
      await route.fulfill({ status: 200, body: cached(url), headers: { "content-type": type, "access-control-allow-origin": "*" } });
    });
    page.on("pageerror", (error) => console.error("pageerror:", error.message));
    const render = async (html, width, height) => {
      await page.setViewportSize({ width, height });
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      return page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height }, omitBackground: true });
    };
    return await fn(render, page);
  } finally {
    await browser.close();
  }
}
