#!/usr/bin/env node
/**
 * The radio wheel's centre against its disc, in the browser: what
 * wheelGeometry.test.ts cannot measure. On a running dev server it enters
 * the site, opens the wheel with the RADIO button and selects every sector
 * in turn, in each language and at each screen size, and prints PASS or
 * FAIL per check.
 *
 *   node tools/capture/radiowheel.mjs [--url http://localhost:3000]
 *     [--lang es,en] [--sizes 360x640,640x360,...] [--json <file>]
 *     [--shots <dir>]
 *
 * The sizes default to the phones, upright and on their side, whose wheel
 * (400 px or less) sets its centre in CENTRE_TYPE (wheelGeometry.ts). A
 * tablet or a desktop (768x1024, 1440x900) takes the big wheel's type: on
 * it WITNESS ME's line box, over a two-line title on air, comes within
 * 4 px of the rim (its letters stay inside).
 *
 * Every sector is measured twice: selected (the arrows on a desktop, the
 * focus on a touch screen, where a tap tunes at once) and tuned, its
 * track on air shown; tuned, every track the station can have on air is
 * set into the centre in turn (the station's clock picks one), so the
 * longest title is measured whatever is playing.
 *
 * Checks, per size and language:
 * - margin: every line of text in the centre (each line box) and the
 *   status pill's border box stand wholly inside the centre disc, every
 *   corner at least 4 px inside its circle;
 * - words: no word is broken over two lines;
 * - name: one size for every station, never under 11 px;
 * - targets: every badge is at least 44 px across;
 * - radio off: its power symbol lights up (cream) on the selected sector
 *   and keeps the off colour when another one is selected.
 *
 * --json writes every measurement; --shots saves the centre of every
 * sector, selected and tuned (with the station's longest title), as PNGs.
 * WebGL is off: the wheel is DOM and SVG, and swiftshader is slow.
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    lang: { type: "string", default: "es,en" },
    sizes: { type: "string", default: "360x640,360x740,375x667,390x844,412x915,640x360,844x390" },
    json: { type: "string" },
    shots: { type: "string" },
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
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MARGIN = 4;
const MIN_NAME_PX = 11;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every track each station can have on air, read from stations.ts (title and artist, in its order). */
function tracksByStation() {
  const source = readFileSync(path.join(ROOT, "src/features/music/stations.ts"), "utf8");
  const blocks = source.split(/\n\s+id: "/).slice(1);
  const out = {};
  for (const block of blocks) {
    const id = block.slice(0, block.indexOf('"'));
    const credits = [...block.matchAll(/(?:pixabay|cc0)\(\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"/g)];
    const macleods = [...block.matchAll(/macleod\(\s*"((?:[^"\\]|\\.)*)"/g)];
    const tracks = [
      ...credits.map((m) => ({ title: m[1].replace(/\\(.)/g, "$1"), artist: m[2] })),
      ...macleods.map((m) => ({ title: m[1].replace(/\\(.)/g, "$1"), artist: "Kevin MacLeod" })),
    ];
    if (tracks.length) out[id] = tracks;
  }
  return out;
}

const TRACKS = tracksByStation();

/** A phone (touch, 3x), a tablet (touch, 2x) or a desktop (mouse, 1x), from its viewport. */
function device(size) {
  const [width, height] = size.split("x").map(Number);
  const viewport = { width, height };
  if (Math.min(width, height) < 600) return { kind: "phone", viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
  if (width < 1024) return { kind: "tablet", viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  return { kind: "desktop", viewport, deviceScaleFactor: 1 };
}

/** In the page: the centre's text and pill against the disc. */
function measureCentre() {
  const disc = document.querySelector("[data-radio-disc]").getBoundingClientRect();
  const cx = disc.left + disc.width / 2;
  const cy = disc.top + disc.height / 2;
  const radius = disc.width / 2;
  const centre = document.querySelector("[data-radio-centre]");
  let margin = Infinity;
  let worst = "";
  const broken = [];
  const corners = (box, what) => {
    for (const [x, y] of [
      [box.left, box.top],
      [box.right, box.top],
      [box.left, box.bottom],
      [box.right, box.bottom],
    ]) {
      const m = radius - Math.hypot(x - cx, y - cy);
      if (m < margin) {
        margin = m;
        worst = what;
      }
    }
  };
  const walker = document.createTreeWalker(centre, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim() || node.parentElement.getClientRects().length === 0) continue;
    const row = node.parentElement.closest("[data-row]")?.dataset.row ?? "?";
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const box of range.getClientRects()) if (box.width > 0.5) corners(box, `${row} "${node.textContent.trim()}"`);
    for (const word of node.textContent.matchAll(/\S+/g)) {
      const w = document.createRange();
      w.setStart(node, word.index);
      w.setEnd(node, word.index + word[0].length);
      const tops = new Set([...w.getClientRects()].filter((box) => box.width > 0.5).map((box) => Math.round(box.top)));
      if (tops.size > 1) broken.push(word[0]);
    }
  }
  const status = centre.querySelector('[data-row="status"]');
  if (status) corners(status.getBoundingClientRect(), "status pill");
  const name = centre.querySelector('[data-row="name"]');
  const style = getComputedStyle(name);
  const badges = [...document.querySelectorAll('[role="radio"]:not([data-selected="true"])')].map(
    (badge) => badge.getBoundingClientRect().width,
  );
  const off = document.querySelector('[role="radio"] linearGradient[id$="-p"] stop:last-child');
  const probe = document.createElement("i");
  probe.style.color = "var(--va-color-cream)";
  document.body.append(probe);
  const cream = getComputedStyle(probe).color;
  probe.remove();
  return {
    radius: +radius.toFixed(1),
    margin: +margin.toFixed(1),
    worst,
    broken,
    name: name.textContent,
    namePx: parseFloat(style.fontSize),
    nameLines: Math.round(name.getBoundingClientRect().height / parseFloat(style.lineHeight)),
    minBadge: +Math.min(...badges).toFixed(1),
    offStop: off ? getComputedStyle(off).stopColor : null,
    cream,
  };
}

async function enter(page, lang) {
  await page.goto(`${BASE}/${lang}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: 240_000 });
  await page.locator('[data-loader] [data-enter="music"]').click();
  await page.waitForSelector("[data-loader]", { state: "detached", timeout: 30_000 });
}

async function openWheel(page, kind) {
  const button = page.locator('button[aria-haspopup="dialog"]').first();
  if (kind === "desktop") await button.click();
  else await button.tap();
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { state: "visible" });
  await sleep(450);
}

async function closeWheel(page) {
  await page.keyboard.press("Escape");
  await sleep(200);
}

const selectedIndex = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[role="radio"]')].findIndex((b) => b.dataset.selected === "true"));

async function select(page, kind, index) {
  if (kind === "desktop") {
    // The keyboard: the arrows step the selection round the wheel.
    for (let guard = 0; guard < 10 && (await selectedIndex(page)) !== index; guard++) {
      await page.keyboard.press("ArrowRight");
      await sleep(60);
    }
  } else {
    await page.locator('[role="radio"]').nth(index).focus();
  }
  await sleep(160);
  if ((await selectedIndex(page)) !== index) throw new Error(`sector ${index} not selected`);
}

async function shot(page, file) {
  const clip = await page.evaluate(() => {
    const disc = document.querySelector("[data-radio-disc]").getBoundingClientRect();
    const pad = 8;
    return { x: disc.left - pad, y: disc.top - pad, width: disc.width + 2 * pad, height: disc.height + 2 * pad };
  });
  await page.screenshot({ path: file, clip });
}

const setTrack = (page, track) =>
  page.evaluate(({ title, artist }) => {
    const centre = document.querySelector("[data-radio-centre]");
    centre.querySelector('[data-row="title"]').textContent = title;
    centre.querySelector('[data-row="artist"]').textContent = artist;
  }, track);

const results = [];
const failures = [];
const errors = [];
const browser = await chromium.launch({ args: ["--disable-webgl", "--disable-3d-apis"] });
if (values.shots) await mkdir(values.shots, { recursive: true });

for (const size of values.sizes.split(",")) {
  const { kind, ...options } = device(size);
  for (const lang of values.lang.split(",")) {
    const context = await browser.newContext({ ...options, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const rows = [];
    try {
      await enter(page, lang);
      await openWheel(page, kind);
      const count = await page.locator('[role="radio"]').count();
      for (let i = 0; i < count; i++) {
        // Selected, not tuned.
        await select(page, kind, i);
        rows.push({ size, lang, sector: i, state: "selected", ...(await page.evaluate(measureCentre)) });
        if (values.shots) await shot(page, path.join(values.shots, `${size}-${lang}-${i}-selected.png`));
        // Tuned: a tap or a click tunes and closes; open again on it.
        const badge = page.locator('[role="radio"]').nth(i);
        if (kind === "desktop") await badge.click();
        else await badge.tap();
        await sleep(250);
        await openWheel(page, kind);
        const station = await page.evaluate(
          () => document.querySelector('[role="radio"][data-current="true"]')?.getAttribute("aria-label") ?? "",
        );
        const hasTrack = await page.locator('[data-radio-centre] [data-row="title"]').count();
        if (!hasTrack) {
          rows.push({ size, lang, sector: i, state: "tuned", ...(await page.evaluate(measureCentre)) });
          if (values.shots) await shot(page, path.join(values.shots, `${size}-${lang}-${i}-tuned.png`));
          continue;
        }
        const id = Object.keys(TRACKS).find((key) => station.toUpperCase().startsWith(stationName(key)));
        let worst = null;
        let longest = null;
        for (const track of TRACKS[id] ?? []) {
          await setTrack(page, track);
          const m = { ...(await page.evaluate(measureCentre)), track: track.title };
          if (!worst || m.margin < worst.margin) worst = { ...m, broken: [...(worst?.broken ?? []), ...m.broken] };
          else worst.broken.push(...m.broken);
          if (!longest || track.title.length > longest.title.length) longest = track;
        }
        rows.push({ size, lang, sector: i, state: "tuned", ...worst });
        if (values.shots && longest) {
          await setTrack(page, longest);
          await shot(page, path.join(values.shots, `${size}-${lang}-${i}-tuned.png`));
        }
        // Give React its own text back.
        await closeWheel(page);
        await openWheel(page, kind);
      }
    } catch (error) {
      errors.push(`${size} ${lang}: ${String(error).split("\n")[0]}`);
    }
    await context.close();
    results.push(...rows);
    report(size, lang, rows);
  }
}
await browser.close();

/** The station's name as the wheel spells it, from its id (bobsled → BOBSLED, one-louder → ONE LOUDER). */
function stationName(id) {
  return id.replace(/-/g, " ").toUpperCase();
}

function report(size, lang, rows) {
  if (!rows.length) return;
  const tag = `${size} ${lang}`;
  const min = rows.reduce((a, b) => (b.margin < a.margin ? b : a));
  const broken = rows.flatMap((r) => r.broken);
  const stationPx = new Set(rows.filter((r) => r.sector > 0).map((r) => r.namePx));
  const namePx = Math.min(...rows.map((r) => r.namePx));
  const badge = Math.min(...rows.map((r) => r.minBadge));
  const offSelected = rows.find((r) => r.sector === 0 && r.state === "selected");
  const offOther = rows.find((r) => r.sector === 1 && r.state === "selected");
  const lit = offSelected?.offStop;
  const cream = offSelected?.cream;
  const check = (ok, what) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${tag.padEnd(14)} ${what}`);
    if (!ok) failures.push(`${tag} ${what}`);
  };
  check(min.margin >= MARGIN, `margin ${min.margin} px (${min.name}, ${min.state}: ${min.worst}${min.track ? ` [${min.track}]` : ""})`);
  check(broken.length === 0, `words whole${broken.length ? `: ${broken.join(", ")}` : ""}`);
  check(stationPx.size === 1 && namePx >= MIN_NAME_PX, `name ${[...stationPx].join("/")} px for every station`);
  check(badge >= 44, `badges ${badge} px`);
  check(
    lit === cream && offOther?.offStop !== cream,
    `radio off lit when selected (${lit}), not otherwise (${offOther?.offStop})`,
  );
}

if (values.json) await writeFile(values.json, JSON.stringify(results, null, 1));
for (const error of errors) console.log(`FAIL ${error}`);
const failed = failures.length + errors.length > 0;
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
