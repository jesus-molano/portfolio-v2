#!/usr/bin/env node
/**
 * The pause menu's pause, in the browser: what pauseMix.test.ts and the
 * player's tests cannot hear or see. On a running dev server it drives the
 * page into STATS and out of it with the wheel and prints PASS or FAIL per
 * check; with --frames it also saves a strip of the entrance.
 *
 *   node tools/capture/pause.mjs [--url http://localhost:3000] [--lang es|en]
 *     [--frames <dir>] [--device desktop|mobile|both]
 *
 * Checks:
 * - picture: STATS crossing the middle of the screen pauses the game (the
 *   pause sign punching in over the screen, the veil over the world, the
 *   menu settled, the glyph lit, the clock's colon still) and leaving
 *   resumes it; no layout shift on the way; once settled, nothing in
 *   STATS animates.
 * - landing: a fragment set on the open page (#stats-map,
 *   #stats-settings...) lands the section's top with the tab bar in view,
 *   below the page controls, as #stats does.
 * - sound: with the radio on, the decks play through a low-pass and a
 *   gain; paused, the cutoff is about 800 Hz and the gain about -10 dB,
 *   with a blip (two oscillators) each way; resumed, the filter is open
 *   and the gain 1 again. On SETTINGS the music is open (she sets her
 *   station and volume by ear), and muffled again on another tab.
 * - silent: with the radio off, the pause makes no sound and builds no
 *   AudioContext at all.
 * - reduced: under reduced motion the paused state holds at once, dimmed
 *   and still: no settle, no pulse, no ticking clock.
 *
 * WebGL is off (the night canvas falls back to its plates): the pause is
 * DOM and CSS, and swiftshader is slow.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    lang: { type: "string", default: "es" },
    frames: { type: "string" },
    device: { type: "string", default: "both" },
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
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const report = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` ${JSON.stringify(detail)}`}`);
};

/** Records the Web Audio nodes the page makes, and every layout shift. */
const PROBE = () => {
  const probe = { contexts: 0, filters: [], gains: [], sources: 0, oscillators: 0, shifts: [] };
  window.__pauseProbe = probe;
  const Context = window.AudioContext;
  if (Context) {
    window.AudioContext = class extends Context {
      constructor(...args) {
        super(...args);
        probe.contexts += 1;
      }
    };
    const base = Context.prototype;
    const wrap = (name, record) => {
      const original = base[name];
      base[name] = function (...args) {
        const node = original.apply(this, args);
        record(node);
        return node;
      };
    };
    wrap("createBiquadFilter", (node) => probe.filters.push(node));
    wrap("createGain", (node) => probe.gains.push(node));
    wrap("createMediaElementSource", () => (probe.sources += 1));
    wrap("createOscillator", () => (probe.oscillators += 1));
  }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const sources = (entry.sources ?? []).map((source) => {
        const node = source.node;
        const name = node instanceof Element ? `${node.tagName.toLowerCase()}.${String(node.className).slice(0, 40)}` : String(node?.nodeName);
        return { name, from: source.previousRect?.toJSON?.(), to: source.currentRect?.toJSON?.() };
      });
      probe.shifts.push({ value: entry.value, at: Math.round(entry.startTime), sources });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-3d-apis"] });

async function session(device, { music = false, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ ...DEVICES[device], reducedMotion });
  await context.addInitScript(PROBE);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${BASE}/${values.lang}`, { waitUntil: "load" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: 240_000 });
  await page.locator(`[data-loader] [data-enter="${music ? "music" : "silent"}"]`).click();
  await page.waitForSelector("[data-loader]", { state: "detached", timeout: 20_000 });
  await page.mouse.move(DEVICES[device].viewport.width / 2, DEVICES[device].viewport.height / 2);
  // In through the address, as a link would (PageEntry lands it with the hero's walls open).
  await page.evaluate(() => (window.location.hash = "#stats"));
  await page.waitForFunction(() => document.querySelector("#stats")?.hasAttribute("data-paused"), null, { timeout: 20_000 });
  await sleep(900);
  const cdp = device === "mobile" ? await context.newCDPSession(page) : null;
  return { page, cdp, errors, close: () => context.close() };
}

/** Where STATS's top is, as a share of the screen's height. */
const statsTop = (page) => page.evaluate(() => document.querySelector("#stats").getBoundingClientRect().top / window.innerHeight);

/**
 * Scrolls the page `dy` px down as she would: a notch of the wheel on a
 * desktop, a slow drag held still before it lifts (no fling) on a phone.
 */
async function scroll(s, dy) {
  if (!s.cdp) {
    await s.page.mouse.wheel(0, dy);
    return;
  }
  const x = 195;
  const y0 = dy > 0 ? 640 : 200;
  const steps = 16;
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - (dy * i) / steps }] });
    await sleep(16);
  }
  await sleep(180);
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Scrolls until STATS's top stands at `share` of the screen (from 0.5 up it is not paused). */
async function scrollTo(s, share) {
  for (let i = 0; i < 40; i++) {
    const top = await statsTop(s.page);
    const height = await s.page.evaluate(() => window.innerHeight);
    const delta = (share - top) * height;
    if (Math.abs(delta) < 12) return;
    await scroll(s, -Math.max(-240, Math.min(240, delta)));
    await sleep(320);
  }
}

/** What the screen shows of the pause now. */
const look = (page) =>
  page.evaluate(() => {
    const section = document.querySelector("#stats");
    const freeze = section.querySelector('[class*="freeze"]');
    const stinger = section.querySelector('[class*="stinger"]');
    const screen = section.querySelector('[class*="screen"]');
    const glyph = section.querySelector('[class*="pause"] i');
    const tick = section.querySelector('[class*="clockTick"]');
    const running = document
      .getAnimations()
      .filter((animation) => animation.playState === "running" && section.contains(animation.effect?.target ?? null));
    return {
      paused: section.getAttribute("data-paused"),
      veil: Number(getComputedStyle(freeze).opacity),
      veilVisible: getComputedStyle(freeze).visibility,
      // Up while its entrance runs: it ends hidden.
      stinger: stinger ? getComputedStyle(stinger).visibility === "visible" : null,
      screen: getComputedStyle(screen).transform,
      screenOpacity: Number(getComputedStyle(screen).opacity),
      glyph: Number(getComputedStyle(glyph).opacity),
      ticking: tick ? tick.getAnimations().some((animation) => animation.playState === "running") : null,
      running: running.map((animation) => animation.animationName ?? animation.transitionProperty ?? "?"),
    };
  });

const mix = (page) =>
  page.evaluate(() => {
    const probe = window.__pauseProbe;
    // The bus: the first low-pass made, and the gain after it (input, duck).
    const filter = probe.filters.find((node) => node.type === "lowpass");
    return {
      contexts: probe.contexts,
      sources: probe.sources,
      oscillators: probe.oscillators,
      cutoff: filter ? Math.round(filter.frequency.value) : null,
      gainDb: probe.gains[1] ? Math.round(20 * Math.log10(Math.max(1e-6, probe.gains[1].gain.value)) * 10) / 10 : null,
    };
  });

const devices = values.device === "both" ? ["desktop", "mobile"] : [values.device];

for (const device of devices) {
  // picture, and the frame strip of the entrance.
  {
    const s = await session(device);
    const { page } = s;
    await scrollTo(s, 0.62);
    await sleep(700);
    const before = await look(page);
    const shiftsBefore = await page.evaluate(() => window.__pauseProbe.shifts.length);
    const frames = [];
    const shoot = async (label) => {
      if (!values.frames) return;
      await mkdir(values.frames, { recursive: true });
      const file = path.join(values.frames, `${device}-${values.lang}-${frames.length + 1}-${label}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 72 });
      frames.push(file);
    };
    await shoot("running");
    const height = DEVICES[device].viewport.height;
    await scroll(s, Math.round(height * 0.22));
    await page.waitForFunction(() => document.querySelector("#stats").hasAttribute("data-paused"), null, { timeout: 5_000 });
    const arriving = await look(page);
    // The entrance, frame by frame: STATS's transitions and the glyph's
    // pulse held where they start, the scroll left to land, then shown at
    // set times after the pause began (a screenshot takes longer than the
    // move), and let go.
    if (values.frames) {
      const hold = (ms) =>
        page.evaluate((at) => {
          const section = document.querySelector("#stats");
          for (const animation of document.getAnimations()) {
            if (!section.contains(animation.effect?.target ?? null)) continue;
            animation.pause();
            animation.currentTime = at;
          }
        }, ms);
      await hold(0);
      await sleep(900);
      for (const at of [80, 200, 360, 700]) {
        await hold(at);
        await shoot(`${at}ms`);
      }
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          if (animation.playState !== "paused") continue;
          const end = animation.effect?.getComputedTiming().endTime ?? 0;
          if (Number.isFinite(end) && animation.currentTime >= end) animation.finish();
          else animation.play();
        }
      });
    }
    await sleep(1100);
    const during = await look(page);
    await scrollTo(s, 0.66);
    await sleep(600);
    const after = await look(page);
    const shifts = await page.evaluate((from) => window.__pauseProbe.shifts.slice(from), shiftsBefore);
    report(`${device} picture: running before the menu arrives`, !before.paused && before.veilVisible === "hidden" && before.glyph < 0.6 && before.ticking === true, before);
    report(`${device} picture: the pause sign punches in as the menu arrives`, arriving.stinger === true, arriving);
    report(
      `${device} picture: paused as it crosses the middle (veil, settled menu, lit glyph, clock stopped, the sign gone, nothing running)`,
      Boolean(during.paused) &&
        during.veil === 1 &&
        during.stinger === false &&
        during.screen === "none" &&
        during.screenOpacity === 1 &&
        during.glyph === 1 &&
        during.ticking === false &&
        during.running.length === 0,
      during,
    );
    report(`${device} picture: resumed as she leaves`, !after.paused && after.veilVisible === "hidden" && after.ticking === true, after);
    report(`${device} picture: no layout shift on the way`, shifts.reduce((sum, shift) => sum + shift.value, 0) === 0, shifts);
    report(`${device} picture: no page error`, s.errors.length === 0, s.errors);
    if (frames.length) console.log(frames.join("\n"));
    await s.close();
  }

  // sound and silence: the same on every device; once is enough.
  if (device === devices[0]) {
    const s = await session(device, { music: true });
    const { page } = s;
    await sleep(400);
    const inMenu = await mix(page);
    await scrollTo(s, 0.66);
    await sleep(700);
    const out = await mix(page);
    await scroll(s, Math.round(DEVICES[device].viewport.height * 0.3));
    await page.waitForFunction(() => document.querySelector("#stats").hasAttribute("data-paused"), null, { timeout: 5_000 });
    await sleep(700);
    const back = await mix(page);
    report(
      "sound: behind the menu, the radio is muffled (about 800 Hz) and ducked (about -10 dB), with a blip",
      inMenu.sources >= 1 && Math.abs(inMenu.cutoff - 800) < 20 && Math.abs(inMenu.gainDb + 10) < 0.6 && inMenu.oscillators >= 2,
      inMenu,
    );
    report("sound: leaving opens the filter and the gain again, with a blip", out.cutoff >= 18_000 && Math.abs(out.gainDb) < 0.2 && out.oscillators === inMenu.oscillators + 2, out);
    report("sound: back in, muffled again, with a blip", Math.abs(back.cutoff - 800) < 20 && back.oscillators === out.oscillators + 2, back);
    // SETTINGS: she hears what she sets.
    await page.evaluate(() => document.getElementById("stats-settings-tab").click());
    await sleep(700);
    const settings = await mix(page);
    await page.evaluate(() => document.getElementById("stats-map-tab").click());
    await sleep(700);
    const map = await mix(page);
    report("sound: on SETTINGS the music is open, quietly", settings.cutoff >= 18_000 && Math.abs(settings.gainDb) < 0.2 && settings.oscillators === back.oscillators, settings);
    report("sound: on another tab, muffled again, quietly", Math.abs(map.cutoff - 800) < 20 && map.oscillators === settings.oscillators, map);
    report("sound: no page error", s.errors.length === 0, s.errors);
    await s.close();

    const q = await session(device);
    await scrollTo(q, 0.66);
    await sleep(500);
    await scroll(q, Math.round(DEVICES[device].viewport.height * 0.3));
    await sleep(900);
    const quiet = await mix(q.page);
    report("silent: radio off, the pause makes no sound and builds no AudioContext", quiet.contexts === 0 && quiet.oscillators === 0, quiet);
    await q.close();
  }

  // landing: a fragment set on the open page lands the section's top, the tab bar in view.
  {
    const s = await session(device);
    const where = () =>
      s.page.evaluate(() => ({
        top: Math.round(document.querySelector("#stats").getBoundingClientRect().top),
        bar: Math.round(document.querySelector("#stats [role=tablist]").getBoundingClientRect().top),
      }));
    const home = await where();
    // #stats-favorites is the old name of #stats-achievements, kept for links shared before.
    for (const hash of ["#stats-settings", "#stats-map", "#projects", "#stats-achievements", "#projects", "#stats-favorites"]) {
      await s.page.evaluate((h) => (window.location.hash = h), hash);
      await sleep(1300);
      if (hash === "#projects") continue;
      const at = await where();
      report(`${device} landing: ${hash} lands like #stats`, Math.abs(at.top - home.top) <= 2 && at.bar > 0, { home, at });
    }
    await s.close();
  }

  // reduced motion: the paused state at once, still.
  {
    const s = await session(device, { reducedMotion: "reduce" });
    const state = await look(s.page);
    report(
      `${device} reduced: paused at once, dimmed and still`,
      Boolean(state.paused) && state.veil === 1 && state.screen === "none" && state.ticking === false && state.running.length === 0,
      state,
    );
    await s.close();
  }
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `${failed} FAIL` : `all ${results.length} PASS`);
process.exit(failed ? 1 : 0);
