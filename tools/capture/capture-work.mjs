#!/usr/bin/env node
/**
 * Visual QA for the work stage (#work): renders the night drive at chosen
 * beats and saves one PNG per frame and device.
 *
 *   node tools/capture/capture-work.mjs [--url http://localhost:3000/en]
 *     [--at title,army.card0,pwc.card1,cloud.pangea@0.8,heuristik.card1,end@0.6]
 *     [--device desktop|mobile|both] [--out .captures] [--settle 2500] [--armed]
 *
 * `--at` takes beat ids (a card is shot in the middle of its window, any
 * other beat at its end), `id@t` for a point inside a beat, or a film
 * position 0..1. `--armed` arms the board first (the hover state). Uses the
 * dev hooks __vaJump (the hero, run to its end) and __vaStage / __vaArm.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000/en" },
    at: { type: "string", default: "title,army.card0,pwc.card0,cloud.card0,logixs.card0,heuristik.crane@0.5,heuristik.card1" },
    device: { type: "string", default: "both" },
    out: { type: "string", default: ".captures" },
    settle: { type: "string", default: "2500" },
    prefix: { type: "string", default: "work-" },
    armed: { type: "boolean", default: false },
  },
});

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const globalRoot = process.env.PLAYWRIGHT_GLOBAL ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
    return import(globalRoot);
  }
}

const { chromium } = await loadPlaywright();
const ats = values.at.split(",");
const devices = values.device === "both" ? ["desktop", "mobile"] : [values.device];
const settle = Number(values.settle);
await mkdir(values.out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

for (const name of devices) {
  const context = await browser.newContext({ ...DEVICES[name], reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error(`[${name}] page error:`, error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") console.error(`[${name}] ${msg.type()}:`, msg.text().slice(0, 300));
  });
  await page.goto(values.url, { waitUntil: "load" });
  await page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: 180_000 });
  await page.locator('[data-loader] [data-enter="silent"]').click();
  await page.waitForSelector("[data-loader]", { state: "detached", timeout: 10_000 });
  // Run the hero to its end, then come into the work stage.
  await page.evaluate(() => window.__vaJump?.(1));
  await page.evaluate(() => document.querySelector("#work")?.scrollIntoView());
  await page.waitForFunction(() => typeof window.__vaStage === "function", null, { timeout: 30_000 });
  await page.waitForSelector('#work [data-ready="ready"], #work [data-ready="failed"]', { timeout: 180_000 });

  for (const at of ats) {
    await page.evaluate((target) => window.__vaStage(target), at);
    if (values.armed) await page.evaluate(() => window.__vaArm?.(true));
    await page.waitForTimeout(settle);
    await page.evaluate((target) => window.__vaStage(target), at);
    await page.waitForTimeout(400);
    const file = path.join(values.out, `${values.prefix}${name}-${at.replace(/[^\w.@-]/g, "_")}${values.armed ? "-armed" : ""}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await context.close();
}

await browser.close();
