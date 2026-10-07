#!/usr/bin/env node
/**
 * STATS's SETTINGS tab under a finger, on phones: what the unit tests
 * cannot feel. On a running dev server it lands on #stats-settings, swipes
 * with real touch events (CDP, as scrollux does) and prints PASS or FAIL.
 *
 *   node tools/capture/settings-touch.mjs [--url http://localhost:3000]
 *     [--langs es,en]
 *
 * Checks, at 390 x 844 and 360 x 640:
 * - swipes: a swipe that starts on the station grid, the volume range or
 *   the subtitle sizes scrolls the page, forward and back (nothing in the
 *   tab keeps the finger), and flings run on through the tab.
 * - volume: none of those swipes changes the volume. Chrome jumps a
 *   range's thumb to the finger on pointerdown and only then hands a
 *   vertical swipe to the page (pointercancel); Settings.tsx gives the
 *   value back (`rangeGuard.ts`). A tap on the track still sets it.
 *
 * The start menu's own SETTINGS are scrolled by `tools/loader/check.mjs
 * --only scroll`. WebGL is off: the tab is DOM, and swiftshader is slow.
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    langs: { type: "string", default: "es,en" },
  },
});

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return import(process.env.PLAYWRIGHT_GLOBAL ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
  }
}

const { chromium } = await loadPlaywright();
const BASE = values.url.replace(/\/$/, "");
const PHONES = [
  [390, 844],
  [360, 640],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const report = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`);
};

const browser = await chromium.launch({ args: ["--disable-3d-apis"] });
for (const lang of values.langs.split(",")) {
  for (const [width, height] of PHONES) {
    const label = `${width} x ${height} ${lang}`;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    // PLAYER 1 already chosen (features/suspects/select.ts), so the line-up never holds the page.
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("va-player-one", "jesus");
      } catch {}
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.log(`  page error: ${error.message}`));
    await page.goto(`${BASE}/${lang}#stats-settings`, { waitUntil: "load", timeout: 120_000 });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: 240_000 });
    await page.locator('[data-loader] [data-enter="silent"]').tap();
    await page.waitForSelector("[data-loader]", { state: "detached", timeout: 60_000 });
    await sleep(2000);

    const cdp = await context.newCDPSession(page);
    const touchAt = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    /** A finger from (x, y0) moved by dy (up is positive) over ms, held still for hold ms before it lifts. */
    const swipe = async (x, y0, dy, ms, hold = 0) => {
      const steps = Math.max(2, Math.round(ms / 16));
      await touchAt("touchStart", x, y0);
      for (let i = 1; i <= steps; i++) {
        await touchAt("touchMove", x, y0 - (dy * i) / steps);
        await sleep(ms / steps);
      }
      if (hold) await sleep(hold);
      await touchAt("touchEnd");
    };
    const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
    const volume = () => page.evaluate(() => document.querySelector("#stats-settings input[type=range]")?.value);

    const targets = {
      stations: "#stats-settings [class*=stationGrid]",
      volume: "#stats-settings input[type=range]",
      sizes: "#stats-settings [class*=sizes]",
    };
    for (const [name, selector] of Object.entries(targets)) {
      const target = page.locator(selector).first();
      await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await sleep(800);
      const box = await target.boundingBox();
      const x = box.x + Math.min(box.width / 2, 60);
      const y = Math.min(height - 20, Math.max(20, box.y + box.height / 2));
      const before = { page: await scrollY(), volume: await volume() };
      await swipe(x, y, Math.min(250, y - 10), 350, 120);
      await sleep(700);
      const forward = (await scrollY()) - before.page;
      // Back from where the same spot of the target now is.
      const y2 = Math.min(height - 20, y - forward);
      await swipe(x, y2, -Math.min(200, height - 30 - y2), 350, 120);
      await sleep(700);
      const back = (await scrollY()) - before.page - forward;
      const after = await volume();
      report(`${label}: a swipe from the ${name} scrolls the page`, forward > 100 && back < -100, { forward, back });
      report(`${label}: a swipe from the ${name} leaves the volume`, after === before.volume, {
        before: before.volume,
        after,
      });
    }

    // A tap on the track still sets the volume.
    const range = page.locator("#stats-settings input[type=range]");
    await range.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await sleep(800);
    const track = await range.boundingBox();
    const was = await volume();
    const at = was === "40" ? 0.8 : 0.4;
    await touchAt("touchStart", track.x + track.width * at, track.y + track.height / 2);
    await sleep(40);
    await touchAt("touchEnd");
    await sleep(500);
    const tapped = await volume();
    report(`${label}: a tap on the track sets the volume`, tapped !== was, { was, tapped });

    const start = await scrollY();
    for (let i = 0; i < 4; i++) {
      await swipe(width / 2, height * 0.8, height * 0.5, 90);
      await sleep(300);
    }
    await sleep(1500);
    const flung = (await scrollY()) - start;
    report(`${label}: flings run on through the tab`, flung > height, { flung });
    await context.close();
  }
}
await browser.close();

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
