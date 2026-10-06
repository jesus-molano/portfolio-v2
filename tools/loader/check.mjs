#!/usr/bin/env node
/**
 * Start menu (the loading screen) QA: layout shift, fit and frames.
 *
 *   node tools/loader/check.mjs [--url http://localhost:3000]
 *     [--only cls|fit|frames] [--out .captures/loader]
 *
 * Needs the dev server running and Playwright's Chromium, like
 * tools/capture. Three passes, in both languages:
 *
 * - cls: a buffered `layout-shift` observer from the first paint to the
 *   click, at 1440 x 900 and on a 390 x 844 phone. One run loads normally
 *   (loading, ready); one holds every .glb request, so the screen goes
 *   loading, slow, then ready once they are let through; both move the
 *   selection and open and close SETTINGS on the way. The total must be
 *   exactly 0, and the menu, the tip card, the status and the languages
 *   must keep the same box (to half a pixel) in every phase. Two more runs
 *   per device and language are returning visitors (a remembered station,
 *   the radio cued off in the other language), whose NEW GAME line the
 *   client changes after the server's first paint.
 * - fit: fifteen viewports, from 1920 x 1080 down to 360 x 640,
 *   667 x 375 on its side and 720 x 450 (1440 x 900 at 200 %). Every tip and the slow note must fit their
 *   card; every item's word (with its slab) and its line must fit the
 *   menu, its three rows the menu's box; the menu, card, status,
 *   languages and progress line must stay apart and inside the safe
 *   viewport; Next and the counter must stay inside the tip card; Next is clicked through every tip the visitor would see.
 * - frames: screenshots of loading, slow, ready, CONTINUE selected,
 *   SETTINGS open and leaving (350 ms in) on desktop and phone, and
 *   loading and ready with reduced motion. On the way it checks the
 *   menu's keys: NEW GAME has the focus from the start, ↓ and S and W
 *   move the focus and the slab, a way in chosen too soon says "not yet"
 *   and stays, SETTINGS opens a modal dialog and Esc brings the focus
 *   back to SETTINGS. Look at the frames before calling a change done.
 *   Leaving and reduced motion run without WebGL, so their frames are
 *   drawn on time.
 *
 * Every screenshot lands in --out. Exits 1 if any check fails.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    only: { type: "string", default: "" },
    out: { type: "string", default: ".captures/loader" },
    langs: { type: "string", default: "en,es" },
  },
});

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Sandboxes often ship a global Playwright instead of a local one.
    const globalRoot = process.env.PLAYWRIGHT_GLOBAL ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
    return import(globalRoot);
  }
}

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
/** [width, height, touch] */
const FIT = [
  [1280, 720, false],
  [1366, 650, false],
  [1440, 810, false],
  [1920, 1080, false],
  [960, 540, false],
  [768, 1024, true],
  [390, 693, true],
  [360, 640, true],
  [390, 844, true],
  [844, 390, true],
  [740, 360, true],
  // Beyond the brief's matrix: a small phone on its side, a tablet on its side, a small window.
  [667, 375, true],
  [1024, 768, true],
  [800, 600, false],
  // 1440 x 900 at 200 % zoom.
  [720, 450, false],
];
/** Returning visitors: what the client reads after hydration differs from the server's first paint. */
const RETURNING = [
  ["a remembered station", { local: { "va-station": "leave-the-gun", "va-music": "on" } }],
  ["the radio cued off in the other language", { session: { "va-cue": "off:babylon" } }],
];
const BOXES = ["menu", "card", "status", "langs"];
/** On SwiftShader, on a busy machine, the scene can take minutes to compile. */
const READY_TIMEOUT = 360_000;

const { chromium } = await loadPlaywright();
const langs = values.langs.split(",");
const passes = values.only ? values.only.split(",") : ["cls", "fit", "frames"];
await mkdir(values.out, { recursive: true });
// WebGL on SwiftShader when there is no GPU: slow, but the real scene loads behind the screen.
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
// The fit pass only measures the screen: without WebGL the scene gives up at once.
const flat = await chromium.launch({ args: ["--disable-3d-apis"] });
const failures = [];

function fail(message) {
  failures.push(message);
  console.log(`  FAIL ${message}`);
}

/** Two animation frames: whatever the DOM says now has been drawn. */
const drawn = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

// SwiftShader can take many seconds to draw a frame of the scene behind the screen.
async function shot(page, name) {
  await drawn(page);
  await page.screenshot({ path: path.join(values.out, `${name}.png`), timeout: READY_TIMEOUT });
}

/**
 * Runs in the page before anything else: sums every layout shift (with
 * or without recent input, buffered from the first paint) and records the
 * boxes whenever the phase changes.
 */
function observe(boxes) {
  const shifts = [];
  const records = [];
  window.__loaderCheck = { shifts, records };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      shifts.push({
        value: entry.value,
        at: Math.round(entry.startTime),
        sources: (entry.sources ?? []).map((source) => {
          const node = source.node;
          const name = node?.nodeType === 1 ? node : node?.parentElement;
          const label = name ? `${name.tagName.toLowerCase()}.${String(name.className).slice(0, 40)}` : "?";
          return `${label} ${JSON.stringify(source.previousRect)} -> ${JSON.stringify(source.currentRect)}`;
        }),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
  let last = "";
  const tick = () => {
    const loader = document.querySelector("[data-loader]");
    if (loader) {
      const state = `${loader.dataset.phase}${loader.hasAttribute("data-slow") ? "+slow" : ""}`;
      if (state !== last) {
        last = state;
        const rects = {};
        for (const box of boxes) {
          const r = loader.querySelector(`[data-box="${box}"]`)?.getBoundingClientRect();
          rects[box] = r ? [r.x, r.y, r.width, r.height] : null;
        }
        records.push({ state, at: Math.round(performance.now()), rects });
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function newPage(device, { reducedMotion = "no-preference", on = browser, storage } = {}) {
  const context = await on.newContext({ ...device, reducedMotion });
  if (storage) {
    await context.addInitScript(({ local = {}, session = {} }) => {
      for (const [key, value] of Object.entries(local)) localStorage.setItem(key, value);
      for (const [key, value] of Object.entries(session)) sessionStorage.setItem(key, value);
    }, storage);
  }
  const page = await context.newPage();
  page.on("pageerror", (error) => console.log(`  page error: ${error.message}`));
  await page.addInitScript(observe, BOXES);
  return { context, page };
}

const loaderState = (page) =>
  page.evaluate(() => {
    const loader = document.querySelector("[data-loader]");
    return loader ? `${loader.dataset.phase}${loader.hasAttribute("data-slow") ? "+slow" : ""}` : "gone";
  });

/** Checks the shifts and the boxes recorded so far. */
async function verifyStill(page, label) {
  const { shifts, records } = await page.evaluate(() => window.__loaderCheck);
  const total = shifts.reduce((sum, entry) => sum + entry.value, 0);
  const states = records.map((record) => record.state).join(" > ");
  console.log(`  ${label}: CLS ${total.toFixed(4)} over ${states}`);
  if (total !== 0) {
    fail(`${label}: layout shift ${total.toFixed(4)}`);
    for (const entry of shifts) console.log(`    ${entry.value.toFixed(5)} at ${entry.at} ms: ${entry.sources.join(" | ")}`);
  }
  const first = records[0];
  for (const record of records.slice(1)) {
    for (const box of BOXES) {
      const a = first.rects[box];
      const b = record.rects[box];
      if (!a || !b || a.some((value, i) => Math.abs(value - b[i]) > 0.5)) {
        fail(`${label}: ${box} moved from ${JSON.stringify(a)} (${first.state}) to ${JSON.stringify(b)} (${record.state})`);
      }
    }
  }
}

async function clsPass() {
  console.log("Layout shift");
  for (const [name, device] of [
    ["desktop", DESKTOP],
    ["phone", PHONE],
  ]) {
    for (const lang of langs) {
      // A normal load: loading, then ready, then the click.
      {
        const { context, page } = await newPage(device);
        await page.goto(`${values.url}/${lang}`, { waitUntil: "commit" });
        await page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: READY_TIMEOUT });
        await page.waitForTimeout(1200);
        // The slab slides, the settings open over the menu and close again: still nothing moves.
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForSelector("[data-loader] dialog[open]", { timeout: 5000 });
        await page.waitForTimeout(500);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        await verifyStill(page, `${name} ${lang} load`);
        await page.locator('[data-enter="silent"]').click();
        await page.waitForSelector("[data-loader]", { state: "detached", timeout: 10_000 });
        await context.close();
      }
      // A slow one: the models are held until the screen says so.
      {
        const { context, page } = await newPage(device);
        let release;
        const held = new Promise((resolve) => (release = resolve));
        await page.route("**/*.glb", async (route) => {
          await held;
          await route.continue().catch(() => {});
        });
        await page.goto(`${values.url}/${lang}`, { waitUntil: "commit" });
        await page.waitForSelector("[data-loader][data-slow]", { timeout: READY_TIMEOUT });
        const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-enter"));
        if (focused !== "music") fail(`${name} ${lang} slow: focus is on ${focused}, not on NEW GAME`);
        await page.waitForTimeout(600);
        release();
        await page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: READY_TIMEOUT });
        await page.waitForTimeout(1200);
        await verifyStill(page, `${name} ${lang} slow`);
        await context.close();
      }
      // Returning visitors: her station replaces the server's default without moving anything.
      for (const [who, storage] of RETURNING) {
        const { context, page } = await newPage(device, { storage });
        await page.goto(`${values.url}/${lang}`, { waitUntil: "commit" });
        await page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: READY_TIMEOUT });
        await page.waitForTimeout(1200);
        await verifyStill(page, `${name} ${lang} ${who}`);
        await context.close();
      }
    }
  }
}

/** Every rule the fit matrix holds, measured in the page. */
function measureFit() {
  const loader = document.querySelector("[data-loader]");
  const problems = [];
  const body = loader.querySelector("[data-tips]");
  const cell = body.getBoundingClientRect();
  let tallest = 0;
  body.querySelectorAll("p").forEach((p, index) => {
    // Every text sits at the top of the cell at its own height, hidden or not.
    const height = p.getBoundingClientRect().height;
    tallest = Math.max(tallest, height);
    if (height > cell.height + 0.5) {
      problems.push(`text ${index} needs ${height.toFixed(1)}px, the card has ${cell.height.toFixed(1)}px: "${p.textContent}"`);
    }
  });
  const vw = loader.clientWidth;
  const vh = loader.clientHeight;
  const rect = (name) => loader.querySelector(`[data-box="${name}"]`).getBoundingClientRect();
  const boxes = Object.fromEntries(["menu", "card", "status", "langs", "line"].map((name) => [name, rect(name)]));
  // The menu: each word, slid right on its slab (14 px) with the slab's 40 px after it, inside the
  // menu's box; each line inside its row; the three rows inside the box's height.
  const menu = boxes.menu;
  for (const button of loader.querySelectorAll("[data-item]")) {
    const word = button.children[1];
    const right = word.getBoundingClientRect().left + word.offsetWidth + 14 + 40;
    if (right > menu.right + 0.5) problems.push(`${word.textContent} and its slab end ${(right - menu.right).toFixed(1)}px past the menu`);
    const line = button.children[2];
    if (line.scrollWidth > line.clientWidth + 0.5) problems.push(`the line under ${word.textContent} is cut: "${line.textContent}"`);
    const r = button.getBoundingClientRect();
    if (r.bottom > menu.bottom + 0.5) problems.push(`${word.textContent} ends ${(r.bottom - menu.bottom).toFixed(1)}px below the menu`);
  }
  // The tip card's head (labels, counter, Next) stays inside the card: it clips what leaves it.
  const card = loader.querySelector('[data-box="card"]').getBoundingClientRect();
  for (const [what, element] of [["Next", loader.querySelector("[data-next]")], ["the counter", loader.querySelector("[data-next]")?.previousElementSibling]]) {
    const r = element?.getBoundingClientRect();
    if (r && (r.left < card.left - 0.5 || r.right > card.right + 0.5 || r.top < card.top - 0.5 || r.bottom > card.bottom + 0.5)) {
      problems.push(`${what} leaves the tip card: ${Math.round(r.left)}-${Math.round(r.right)} in ${Math.round(card.left)}-${Math.round(card.right)}`);
    }
  }
  const legend = loader.querySelector("#loader-hint");
  if (legend && legend.getBoundingClientRect().bottom > menu.bottom + 0.5) problems.push("the keys' legend ends below the menu");
  for (const [name, r] of Object.entries(boxes)) {
    if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) {
      problems.push(`${name} leaves the viewport: ${JSON.stringify(r)}`);
    }
  }
  const names = Object.keys(boxes);
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const a = boxes[names[i]];
      const b = boxes[names[j]];
      const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      if (overlap) problems.push(`${names[i]} overlaps ${names[j]}`);
    }
  }
  return { problems, cell: [cell.width, cell.height], tallest, word: parseFloat(getComputedStyle(loader.querySelector("[data-item] > span + span")).fontSize) };
}

async function fitPass() {
  console.log("Fit");
  for (const [width, height, touch] of FIT) {
    for (const lang of langs) {
      const device = { viewport: { width, height }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch };
      const { context, page } = await newPage(device, { on: flat });
      await page.goto(`${values.url}/${lang}`, { waitUntil: "commit" });
      await page.waitForSelector("[data-loader][data-measured] [data-tips] [data-on]", { timeout: 60_000 });
      const label = `${width}x${height} ${lang}`;
      const { problems, cell, tallest, word } = await page.evaluate(measureFit);
      // Next through every tip she would see, checking the one on screen.
      const total = Number((await page.locator("[data-loader] [data-box='card'] span[aria-hidden]").first().textContent()).split("/")[1]);
      const next = page.locator("[data-loader] [data-next]");
      for (let i = 0; i < total; i += 1) {
        if ((await loaderState(page)).includes("slow")) break;
        const on = page.locator("[data-loader] [data-tips] [data-on]");
        const over = await on.evaluate((p) => p.getBoundingClientRect().height - p.parentElement.getBoundingClientRect().height);
        if (over > 0.5) problems.push(`tip ${i + 1} overflows by ${over.toFixed(1)}px`);
        // A slow wait hides Next; the measure above has already checked every tip.
        if (!(await next.click({ timeout: 3000 }).then(() => true, () => false))) break;
      }
      await page.waitForTimeout(500);
      await shot(page, `fit-${width}x${height}-${lang}`);
      const size = cell.map((v) => Math.round(v)).join("x");
      console.log(`  ${label}: words ${word.toFixed(0)}px, tip cell ${size}, tallest text ${tallest.toFixed(1)}px, ${total} tips${problems.length ? "" : ", ok"}`);
      for (const problem of problems) fail(`${label}: ${problem}`);
      await context.close();
    }
  }
}

/** The menu while the city loads: the focus, the keys, a way in chosen too soon. */
async function checkMenu(page, label) {
  const state = () =>
    page.evaluate(() => ({
      focus: document.activeElement?.getAttribute("data-item") ?? document.activeElement?.tagName,
      selected: [...document.querySelectorAll("[data-loader] [data-item]")].findIndex((item) => item.hasAttribute("data-selected")),
      phase: document.querySelector("[data-loader]")?.dataset.phase,
      live: document.querySelector('[data-loader] [role="status"]')?.textContent ?? "",
    }));
  const first = await state();
  if (first.focus !== "newGame" || first.selected !== 0) fail(`${label}: the menu starts on ${first.focus} (slab on ${first.selected}), not NEW GAME`);
  // A printable key enters nothing any more; S and the arrows move the focus, the slab with it.
  await page.keyboard.press("a");
  await page.keyboard.press("s");
  const down = await state();
  if (down.focus !== "continue" || down.selected !== 1) fail(`${label}: S went to ${down.focus} (slab on ${down.selected}), not CONTINUE`);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const wrap = await state();
  if (wrap.focus !== "settings" || wrap.selected !== 2) fail(`${label}: ↑ from NEW GAME went to ${wrap.focus}, not round to SETTINGS`);
  await page.keyboard.press("w");
  await page.keyboard.press("w");
  // Chosen while the city loads: it stays, and says why. A machine so busy that the wait has
  // already turned slow offers the way in early, rightly: then there is nothing to try.
  if (await page.locator("[data-loader][data-slow]").count()) {
    console.log(`  ${label}: keys move the focus and the slab (the wait was already slow: "not yet" not tried)`);
    return;
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const early = await state();
  if (early.phase !== "loading" || !early.live.trim()) fail(`${label}: NEW GAME chosen too soon left the phase ${early.phase}, live "${early.live}"`);
  else console.log(`  ${label}: keys move the focus and the slab; too soon says "${early.live.trim()}"`);
}

async function framesPass() {
  console.log("Frames");
  for (const [name, device] of [
    ["desktop", DESKTOP],
    ["phone", PHONE],
  ]) {
    for (const lang of langs) {
      // Slow first: hold the models, show the slow note, then let them through.
      const { context, page } = await newPage(device);
      let release;
      const held = new Promise((resolve) => (release = resolve));
      await page.route("**/*.glb", async (route) => {
        await held;
        await route.continue().catch(() => {});
      });
      await page.goto(`${values.url}/${lang}`, { waitUntil: "commit" });
      await page.waitForSelector("[data-loader][data-measured] [data-tips] [data-on]", { timeout: 60_000 });
      await checkMenu(page, `${name} ${lang}`);
      await page.waitForTimeout(300);
      await shot(page, `${name}-${lang}-loading`);
      await page.waitForSelector("[data-loader][data-slow]", { timeout: READY_TIMEOUT });
      await page.waitForTimeout(800);
      await shot(page, `${name}-${lang}-slow`);
      release();
      await page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: READY_TIMEOUT });
      await page.waitForTimeout(1000);
      await shot(page, `${name}-${lang}-ready`);
      // CONTINUE selected, then SETTINGS open over the menu.
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(600);
      await shot(page, `${name}-${lang}-continue`);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForSelector("[data-loader] dialog[open]", { timeout: 5000 });
      await page.waitForTimeout(600);
      await shot(page, `${name}-${lang}-settings`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const back = await page.evaluate(() => ({
        open: Boolean(document.querySelector("[data-loader] dialog[open]")),
        focus: document.activeElement?.getAttribute("data-item"),
      }));
      if (back.open || back.focus !== "settings") fail(`${name} ${lang}: Esc left the settings ${back.open ? "open" : "closed"} with the focus on ${back.focus}, not on SETTINGS`);
      await context.close();

      // Leaving, 350 ms in. Without WebGL, so a frame is drawn on time (the
      // hero behind shows its CSS sky instead of the scene).
      const quick = await newPage(device, { on: flat });
      await quick.page.goto(`${values.url}/${lang}`, { waitUntil: "commit" });
      await quick.page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: READY_TIMEOUT });
      await quick.page.waitForTimeout(600);
      // The screen unmounts 700 ms after the click (LEAVE_MS), sooner than a
      // busy machine takes a screenshot: hold that one timer for this frame.
      await quick.page.evaluate(() => {
        const native = window.setTimeout;
        window.setTimeout = (handler, ms, ...rest) => native(handler, ms === 700 ? 60_000 : ms, ...rest);
      });
      await quick.page.locator('[data-enter="silent"]').click();
      // Freeze the fades exactly 350 ms in, whatever the machine's load.
      await quick.page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => {
              const loader = document.querySelector("[data-loader]");
              // Reading a style starts the transitions the click has just asked for.
              if (loader) loader.dataset.flushed = getComputedStyle(loader.firstElementChild).opacity;
              for (const animation of document.getAnimations()) {
                if (!loader?.contains(animation.effect?.target ?? null)) continue;
                animation.pause();
                if (animation instanceof CSSTransition) animation.currentTime = 350;
              }
              resolve();
            }),
          ),
      );
      await shot(quick.page, `${name}-${lang}-leaving`);
      if (!(await quick.page.locator('[data-loader][data-phase="leaving"]').count())) {
        fail(`${name} ${lang}: the screen had gone before the leaving frame`);
      }
      await quick.context.close();

      const still = await newPage(device, { reducedMotion: "reduce", on: flat });
      await still.page.goto(`${values.url}/${lang}`, { waitUntil: "commit" });
      await still.page.waitForSelector("[data-loader] [data-tips] [data-on]", { timeout: 60_000 });
      await shot(still.page, `${name}-${lang}-reduced-loading`);
      await still.page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: READY_TIMEOUT });
      await still.page.waitForTimeout(600);
      await shot(still.page, `${name}-${lang}-reduced-ready`);
      await still.context.close();
      console.log(`  ${name} ${lang}: loading, slow, ready, continue, settings, leaving, reduced motion`);
    }
  }
}

if (passes.includes("cls")) await clsPass();
if (passes.includes("fit")) await fitPass();
if (passes.includes("frames")) await framesPass();
await browser.close();
await flat.close();

console.log(failures.length ? `\n${failures.length} problem(s)` : "\nAll checks passed");
process.exit(failures.length ? 1 : 0);
