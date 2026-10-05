#!/usr/bin/env node
/**
 * Visual QA: renders the hero at chosen scroll progress values and saves
 * one PNG per frame, so every change to the scene can be checked shot by
 * shot on desktop and mobile before anyone looks at it.
 *
 *   node tools/capture/capture.mjs [--url http://localhost:3000/en]
 *     [--progress 0.05,0.3,0.55,0.8,0.97] [--device desktop|mobile|both]
 *     [--out .captures] [--settle 1500]
 *
 * Needs the dev server running and Playwright's Chromium
 * (`pnpm exec playwright install chromium` on a new machine). WebGL runs on
 * SwiftShader when there is no GPU, so frames are slow but exact.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000/en" },
    progress: { type: "string", default: "0.02,0.14,0.3,0.45,0.6,0.75,0.88,0.97" },
    device: { type: "string", default: "both" },
    out: { type: "string", default: ".captures" },
    settle: { type: "string", default: "1800" },
    prefix: { type: "string", default: "" },
  },
});

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Sandboxes often ship a global Playwright instead of a local one.
    const globalRoot = process.env.PLAYWRIGHT_GLOBAL ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
    return import(globalRoot);
  }
}

const { chromium } = await loadPlaywright();
const progressValues = values.progress.split(",").map(Number);
const devices = values.device === "both" ? ["desktop", "mobile"] : [values.device];
const settle = Number(values.settle);
await mkdir(values.out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});

for (const name of devices) {
  const context = await browser.newContext({ ...DEVICES[name], reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error(`[${name}] page error:`, error.message));
  await page.goto(values.url, { waitUntil: "load" });

  // Enter without music once the loading screen offers the choice.
  await page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: 120_000 });
  await page.locator('[data-loader] [data-enter="silent"]').click();
  await page.waitForSelector("[data-loader]", { state: "detached", timeout: 10_000 });

  for (const progress of progressValues) {
    await page.evaluate((p) => {
      const stage = document.querySelector('section[aria-labelledby="hero-title"] > div');
      const top = stage.getBoundingClientRect().top + window.scrollY;
      const range = stage.offsetHeight - window.innerHeight;
      const y = top + p * range;
      const hook = window.__vaJump;
      // Dev hook: jump the film clock as well, so the frame does not wait for it.
      if (typeof hook === "function") hook(p);
      window.scrollTo(0, y);
      window.dispatchEvent(new Event("scroll"));
    }, progress);
    await page.waitForTimeout(settle);
    const file = path.join(values.out, `${values.prefix}${name}-p${progress.toFixed(3)}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await context.close();
}

await browser.close();
