#!/usr/bin/env node
/**
 * The page's heat, in the browser: what each section costs while she only
 * reads, and whether going down into the career city and back leaks. On a
 * running server (a production build measures what a phone pays: `pnpm
 * build && pnpm start -p 3100`; a dev server adds React's development
 * work) it walks a phone (390 x 844 at 3x, an iPhone's user agent) through
 * the page and prints one line of numbers per stop, then PASS or FAIL per
 * check.
 *
 *   node tools/capture/perf.mjs [--url http://localhost:3000/en]
 *     [--device phone|desktop] [--only menu,hero,cover,rest,radio,layers,leak]
 *     [--cycles 8] [--win 5000] [--out perf.json]
 *
 * Every WebGL context is counted from the inside (an init script wraps
 * getContext and the draw calls): a canvas "renders" in an animation frame
 * in which it drew. CDP gives the rest: Performance.getMetrics (script,
 * task, style recalcs and layouts per second), LayerTree (composited
 * layers), HeapProfiler (garbage collected before each heap reading).
 *
 * Checks:
 * - menu: behind the start menu, once ready, the hero's canvas stops
 *   drawing after a few seconds, and the loader's own frame loop stops once
 *   its load line is full (no style writes on the screen).
 * - cover: no canvas draws under opaque night: the hero at the end of its
 *   drive (a strip of it over THE CREW) and the night canvas under STATS.
 * - rest: at the cinema and the credits, at rest, the page runs one frame
 *   loop at most (the scroll's), and little script.
 * - radio: with the radio on at the credits, the music button's bars cost
 *   no layout; the radio off, its AudioContext sleeps within a second and
 *   stays asleep through her taps and keys, and it sleeps while the tab is
 *   hidden.
 * - leak: down into the career city and back up past the hero, `--cycles`
 *   times: the JS heap stays flat and no WebGL context outlives its canvas.
 *
 * WebGL runs on SwiftShader, so absolute frame rates are a CPU's; the
 * counts (frames drawn, loops alive, contexts kept) are the device's.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000/en" },
    device: { type: "string", default: "phone" },
    only: { type: "string", default: "" },
    cycles: { type: "string", default: "8" },
    win: { type: "string", default: "5000" },
    out: { type: "string", default: "" },
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
const ONLY = values.only ? values.only.split(",") : null;
const run = (name) => !ONLY || ONLY.includes(name);
const WIN = Number(values.win);
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const verdicts = [];
const report = (name, ok, detail) => {
  verdicts.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`);
};

/**
 * Injected before any page script: the page's animation frames (distinct
 * rAF timestamps) and rAF callbacks, and per WebGL context the frames it drew
 * in, its draws, and whether its context is still alive (a WeakRef, read
 * after a garbage collection). Also the AudioContexts the page makes.
 */
const PROBE = () => {
  const W = window;
  const gp = { tick: 0, rafCalls: 0, timeouts: 0, contexts: [], audio: [] };
  W.__perf = gp;
  const raf = W.requestAnimationFrame.bind(W);
  let lastStamp = -1;
  W.requestAnimationFrame = (callback) => {
    gp.rafCalls += 1;
    return raf((t) => {
      if (t !== lastStamp) {
        lastStamp = t;
        gp.tick += 1;
      }
      return callback(t);
    });
  };
  const timeout = W.setTimeout.bind(W);
  W.setTimeout = (...args) => {
    gp.timeouts += 1;
    return timeout(...args);
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = getContext.call(this, type, attrs);
    if (!ctx || !/webgl/.test(type) || ctx.__perf) return ctx;
    ctx.__perf = true;
    const host = this.closest?.("[data-scene]") ? "hero" : this.closest?.("section")?.id || "?";
    const rec = { id: gp.contexts.length, host, frames: 0, draws: 0, lastTick: -1, ref: new WeakRef(ctx), canvas: new WeakRef(this) };
    gp.contexts.push(rec);
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const draw = ctx[name];
      if (!draw) continue;
      ctx[name] = function (...args) {
        if (rec.lastTick !== gp.tick) {
          rec.lastTick = gp.tick;
          rec.frames += 1;
        }
        rec.draws += 1;
        return draw.apply(this, args);
      };
    }
    return ctx;
  };
  const Audio = W.AudioContext;
  if (Audio) {
    W.AudioContext = class extends Audio {
      constructor(...args) {
        super(...args);
        gp.audio.push(this);
      }
    };
  }
  W.__perfSnap = () => ({
    t: performance.now(),
    tick: gp.tick,
    rafCalls: gp.rafCalls,
    timeouts: gp.timeouts,
    contexts: gp.contexts.map((r) => {
      const canvas = r.canvas.deref();
      return { id: r.id, host: canvas?.closest?.("[data-scene]") ? "hero" : canvas?.closest?.("section")?.id || r.host, frames: r.frames, draws: r.draws, alive: !!r.ref.deref(), connected: !!canvas?.isConnected };
    }),
    audio: gp.audio.map((context) => context.state),
  });
};

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required",
    "--js-flags=--expose-gc",
  ],
});

async function session({ music = false, enter = true } = {}) {
  const context = await browser.newContext({ ...DEVICES[values.device], reducedMotion: "no-preference" });
  await context.addInitScript(PROBE);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.goto(values.url, { waitUntil: "load" });
  await page.waitForSelector('[data-loader][data-phase="ready"]', { timeout: 300_000 });
  if (enter) {
    await page.locator(`[data-loader] [data-enter="${music ? "music" : "silent"}"]`).click();
    await page.waitForSelector("[data-loader]", { state: "detached", timeout: 30_000 });
  }
  return { context, page, cdp, errors, close: () => context.close() };
}

async function metrics(cdp) {
  const { metrics: list } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

/** One window of `ms` at rest (or while `during` runs): what the page spent. */
async function measure(s, name, { ms = WIN, during } = {}) {
  const a = await s.page.evaluate(() => window.__perfSnap());
  const ma = await metrics(s.cdp);
  if (during) await during();
  else await sleep(ms);
  const b = await s.page.evaluate(() => window.__perfSnap());
  const mb = await metrics(s.cdp);
  const secs = (b.t - a.t) / 1000;
  const ticks = b.tick - a.tick;
  const per = (key) => +(((mb[key] - ma[key]) * 1000) / secs).toFixed(1);
  const count = (key) => +((mb[key] - ma[key]) / secs).toFixed(1);
  const canvases = {};
  for (const cb of b.contexts) {
    if (!cb.connected) continue;
    const ca = a.contexts.find((c) => c.id === cb.id) ?? { frames: 0, draws: 0 };
    const frames = cb.frames - ca.frames;
    canvases[cb.host] = { framesPerTick: ticks ? +(frames / ticks).toFixed(2) : 0, drawsPerFrame: frames ? +((cb.draws - ca.draws) / frames).toFixed(0) : 0 };
  }
  const row = {
    name,
    secs: +secs.toFixed(1),
    ticksPerSec: +(ticks / secs).toFixed(1),
    rafCallsPerSec: +((b.rafCalls - a.rafCalls) / secs).toFixed(1),
    timeoutsPerSec: +((b.timeouts - a.timeouts) / secs).toFixed(2),
    taskMsPerSec: per("TaskDuration"),
    scriptMsPerSec: per("ScriptDuration"),
    styleRecalcsPerSec: count("RecalcStyleCount"),
    layoutsPerSec: count("LayoutCount"),
    heapMB: +(mb.JSHeapUsedSize / 1e6).toFixed(1),
    canvases,
  };
  results.push(row);
  console.log(JSON.stringify(row));
  return row;
}

/** Moves the page as a link would (PageEntry takes the fragment through goTo). */
async function land(page, hash, settle = 3000) {
  await page.evaluate((h) => (window.location.hash = h), hash);
  await sleep(settle);
}

async function layers(s) {
  await s.cdp.send("LayerTree.enable");
  let latest = null;
  const onChange = (event) => {
    if (event.layers) latest = event.layers;
  };
  s.cdp.on("LayerTree.layerTreeDidChange", onChange);
  await s.page.evaluate(() => window.scrollBy(0, 1));
  await sleep(600);
  await s.page.evaluate(() => window.scrollBy(0, -1));
  await sleep(600);
  s.cdp.off("LayerTree.layerTreeDidChange", onChange);
  await s.cdp.send("LayerTree.disable");
  return latest?.length ?? null;
}

async function heap(s) {
  await s.cdp.send("HeapProfiler.enable");
  for (let i = 0; i < 3; i += 1) await s.cdp.send("HeapProfiler.collectGarbage");
  const m = await metrics(s.cdp);
  const snap = await s.page.evaluate(() => window.__perfSnap());
  return {
    heapMB: +(m.JSHeapUsedSize / 1e6).toFixed(2),
    nodes: m.Nodes,
    listeners: m.JSEventListeners,
    contextsAlive: snap.contexts.filter((c) => c.alive).length,
    contextsConnected: snap.contexts.filter((c) => c.connected).length,
  };
}

const hostShare = (row, host) => row.canvases[host]?.framesPerTick ?? 0;

if (run("menu")) {
  const s = await session({ enter: false });
  await sleep(4500);
  // The loader's drawing loop writes --p and --fill on the screen's own elements: count those writes.
  await s.page.evaluate(() => {
    window.__perfLoaderWrites = 0;
    new MutationObserver((records) => (window.__perfLoaderWrites += records.length)).observe(document.querySelector("[data-loader]"), {
      attributes: true,
      attributeFilter: ["style"],
      subtree: true,
    });
  });
  const row = await measure(s, "menu ready (the start menu up, its load line full)");
  const writes = await s.page.evaluate(() => window.__perfLoaderWrites);
  report("menu: the hero's canvas rests behind the start menu", hostShare(row, "hero") < 0.05, { framesPerTick: hostShare(row, "hero") });
  report("menu: the loader's frame loop has stopped (no style writes)", writes === 0, { writes, rafCallsPerSec: row.rafCallsPerSec });
  await s.page.locator('[data-loader] [data-enter="silent"]').click();
  await s.page.waitForSelector("[data-loader]", { state: "detached", timeout: 30_000 });
  await sleep(600);
  // SwiftShader may take seconds over the first frames at a phone's 3x: a long window.
  const entered = await measure(s, "entered (the title forming)", { ms: 10_000 });
  report("menu: the hero draws every frame once she has entered", hostShare(entered, "hero") > 0.9, { framesPerTick: hostShare(entered, "hero") });
  await s.close();
}

if (run("hero")) {
  const s = await session();
  await sleep(2500);
  await measure(s, "hero title idle");
  await s.page.keyboard.press("Space");
  await sleep(800);
  await measure(s, "hero card reading");
  await measure(s, "hero driving (W held)", {
    during: async () => {
      await s.page.keyboard.down("KeyW");
      await sleep(WIN);
      await s.page.keyboard.up("KeyW");
    },
  });
  await s.close();
}

if (run("cover")) {
  const s = await session();
  await sleep(1500);
  // Skip: THE CREW at the top, the hero's walls open, its film at its end (night).
  await s.page.keyboard.press("End");
  // Skip's glide, at SwiftShader's few frames a second.
  await sleep(5000);
  const skipped = await measure(s, "after Skip (THE CREW at the top)");
  report("cover: the hero rests once Skip has left it", hostShare(skipped, "hero") < 0.05, { framesPerTick: hostShare(skipped, "hero") });
  // A strip of the hero's night over THE CREW.
  await s.page.mouse.move(195, 400);
  await s.page.mouse.wheel(0, -300);
  await sleep(2500);
  const strip = await s.page.evaluate(() => {
    const hero = document.querySelector("section[aria-labelledby='hero-title']");
    const fade = hero?.querySelector("[data-fade]");
    return { heroBottom: Math.round(hero.getBoundingClientRect().bottom), fade: fade ? Number(getComputedStyle(fade).opacity) : null };
  });
  const row = await measure(s, `hero strip over THE CREW (${strip.heroBottom}px, night ${strip.fade})`);
  report("cover: the hero draws nothing under its opaque night", hostShare(row, "hero") < 0.05, { ...strip, framesPerTick: hostShare(row, "hero") });
  await land(s.page, "#work", 6000);
  await measure(s, "career city top (#work)");
  await land(s.page, "#stats", 4000);
  const stats = await measure(s, "STATS (#stats), the city's closed iris above");
  report("cover: the night canvas draws nothing under STATS", hostShare(stats, "work") < 0.05, { framesPerTick: hostShare(stats, "work") });
  await s.close();
}

if (run("rest")) {
  const s = await session();
  await sleep(1500);
  await land(s.page, "#projects");
  const projects = await measure(s, "cinema at rest (#projects)");
  await land(s.page, "#contact");
  const contact = await measure(s, "credits at rest (#contact)");
  for (const row of [projects, contact]) {
    report(`rest: one frame loop at most at ${row.name}`, row.rafCallsPerSec <= 70, { rafCallsPerSec: row.rafCallsPerSec, scriptMsPerSec: row.scriptMsPerSec });
  }
  await s.close();
}

if (run("radio")) {
  const s = await session({ music: true });
  await sleep(1500);
  await land(s.page, "#contact");
  const playing = await s.page.evaluate(() => window.__perfSnap().audio);
  const row = await measure(s, `credits with the radio on (audio ${playing.join(",")})`);
  report("radio: the playing radio's button costs no layout", row.layoutsPerSec < 5, { layoutsPerSec: row.layoutsPerSec, styleRecalcsPerSec: row.styleRecalcsPerSec });
  // Radio off from STATS's settings (the switch tunes the radio's own store).
  await land(s.page, "#stats-settings", 3000);
  await s.page.locator('#stats-settings-audio [role="switch"], [aria-labelledby="stats-settings-radio"]').first().click();
  await sleep(1500);
  const after = await s.page.evaluate(() => window.__perfSnap().audio);
  report("radio: off, its AudioContext sleeps", after.every((state) => state !== "running"), { states: after });
  // Her next taps and keys (every swipe ends in a touchend) leave it asleep while the radio is off.
  await s.page.evaluate(() => {
    for (const type of ["pointerdown", "pointerup", "touchend", "keydown"]) document.body.dispatchEvent(new Event(type, { bubbles: true }));
  });
  await sleep(1000);
  const tapped = await s.page.evaluate(() => window.__perfSnap().audio);
  report("radio: off, her taps and keys leave it asleep", tapped.every((state) => state !== "running"), { states: tapped });
  await s.close();
  // Hidden while playing.
  const h = await session({ music: true });
  await sleep(2500);
  await h.page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sleep(1500);
  const hidden = await h.page.evaluate(() => window.__perfSnap().audio);
  report("radio: hidden, its AudioContext sleeps", hidden.length > 0 && hidden.every((state) => state !== "running"), { states: hidden });
  await h.close();
}

if (run("layers")) {
  const s = await session();
  await sleep(1500);
  await land(s.page, "#suspects");
  const suspects = await layers(s);
  await land(s.page, "#stats");
  const stats = await layers(s);
  console.log(JSON.stringify({ name: "layers", suspects, stats }));
  results.push({ name: "layers", suspects, stats });
  report("layers: no layer for a bulb out of sight", suspects !== null && suspects < 120, { suspects, stats });
  await s.close();
}

if (run("leak")) {
  const s = await session();
  await sleep(1500);
  const cycle = async () => {
    await land(s.page, "#work-heuristik", 9000);
    await land(s.page, "#credits", 1500);
    // Back to the top, far from the city (six screens): the night is released.
    await s.page.evaluate(() => history.replaceState(null, "", window.location.pathname));
    await s.page.keyboard.press("Home");
    await sleep(3500);
  };
  await cycle();
  const first = await heap(s);
  const rows = [first];
  console.log(JSON.stringify({ cycle: 1, ...first }));
  const cycles = Number(values.cycles);
  for (let i = 2; i <= cycles; i += 1) {
    await cycle();
    const h = await heap(s);
    rows.push(h);
    console.log(JSON.stringify({ cycle: i, ...h }));
  }
  const last = rows[rows.length - 1];
  // From the third pass on: the first ones still compile and cache code (the heap's own warm-up).
  const from = rows[Math.min(2, rows.length - 1)];
  // The median of every pairwise slope (Theil-Sen): one pass read while the night was still up (its
  // context and its heap not yet released) neither hides a leak nor fakes one.
  const tail = rows.slice(rows.indexOf(from));
  const slopes = [];
  for (let i = 0; i < tail.length; i += 1) for (let j = i + 1; j < tail.length; j += 1) slopes.push((tail[j].heapMB - tail[i].heapMB) / (j - i));
  slopes.sort((a, b) => a - b);
  const growth = slopes.length ? slopes[Math.floor((slopes.length - 1) / 2)] : 0;
  results.push({ name: "leak", rows, growthMBPerCycle: +growth.toFixed(3) });
  report("leak: the JS heap stays flat over the city's rebuilds", growth < 0.35, { growthMBPerCycle: +growth.toFixed(3), from: from.heapMB, last: last.heapMB, first: first.heapMB });
  report("leak: no WebGL context outlives its canvas", last.contextsAlive <= last.contextsConnected + 1, last);
  await s.close();
}

await browser.close();
if (values.out) await writeFile(values.out, JSON.stringify({ url: values.url, device: values.device, results, verdicts }, null, 2));
const failed = verdicts.filter((v) => !v.ok).length;
console.log(failed ? `FAIL ${failed} of ${verdicts.length}` : `PASS ${verdicts.length} checks`);
process.exit(failed ? 1 : 0);
