#!/usr/bin/env node
/**
 * Scroll UX acceptance, the browser half: what the story and feedback
 * tests (src/features/hero/scroll/acceptance.test.ts) cannot see. Drives
 * the hero with a mouse wheel, keys and CDP touch on a running dev server
 * and prints PASS or FAIL per check.
 *
 *   node tools/capture/scrollux.mjs [--url http://localhost:3000]
 *     [--lang en|es|both] [--device desktop|mobile|both] [--only a,b,...]
 *     [--webgl]
 *
 * Checks: swipe (a thumb resting before a swipe never opens the radio; a
 * still long-press does; a thumb resting for a while, or beside a thumb
 * on the pedal, does not), arrows (one arrow per input type everywhere, the
 * dash's mouse for the wheel, no dash on a phone),
 * signals (never WAITING while a line plays or the note scolds; the note
 * only under sustained pushing, gone when she stops), rewind (the title
 * hint comes back, centred), wait (the long wait brakes and escalates),
 * radio (the open wheel keeps scrolls and swipes; aim, Q and the button
 * work),
 * reduced (reduced motion switched on mid-film keeps her place, and a
 * round trip without scrolling comes back exactly), focus (Tab right after
 * a click keeps Space and lands on THE USUAL SUSPECTS; the radio clicked
 * open and closed with Esc does not), blocks (every card one block,
 * balanced, fitted to its lines, its marker outside, 320 to 1440 px wide),
 * calm (a notch every 2.5 or 3.5 s: a steady car, and nothing asks for more
 * next to YOU DRIVE; the cue never shares the band with a
 * card), title (a tap while the name forms is answered and plays the
 * first line; a short swipe leaves no ghost of the title), titlewait (hard
 * input while the name forms says the name is still arriving, then "keep
 * driving", never "take the wheel" again), callout (the
 * radio's callout never shares the screen with a prompt; on a phone a tap
 * on it opens the wheel; after Skip, a little scroll back up never brings
 * it over THE CREW's card), trap (whatever moves the page past the frontier,
 * a jump Lenis misses, a programmatic scroll, find in page, a wheel burst
 * on a busy page, hard flings, it is back at the wall within a frame and
 * she drives on), stroke (a phone's drag that pauses on a pressure change
 * or a tremble stays gated; a thumb trembling while a line is read is
 * still; after a swipe back a thumb resting on the glass is rest, not
 * REVERSE), pinch (two fingers on the picture are the browser's zoom,
 * never a stroke, a tap or the radio), ends (Ctrl+End and Ctrl+Home, Cmd+Down and Cmd+Up, act as End
 * and Home in the hero), escape (Esc or End twice, or held, cut to THE
 * USUAL SUSPECTS and no further; Esc with the radio open only closes it),
 * navigate (the STATS booth, a STATS tab, back to top and a deep
 * link land with Lenis, the hero's walls open past it, and her next notch
 * or swipe goes on from there, even before the next frame; Back after a
 * link returns to where she was, Forward to where it went; back to top
 * clears the old #fragment), loader (no
 * "press any key" on a phone), pedal (a held
 * pedal drives within a frame of its press, under a thumb with no radio
 * ring, menu or selection, beside a second finger swiping without a jump,
 * under the mouse slid off it, under W held with its autorepeat; a tap of
 * Space plays one line and a hold drives on; blur, a lost keyup and the
 * radio let go; W held through a tap of S drives on; at the end it
 * stands over the night, a press glides into THE USUAL SUSPECTS (focus
 * there, Space scrolls on) and, held, the way on comes up and it goes on
 * there; under
 * reduced motion there is none), pedallayout (the pedal and its hit area,
 * Skip expanded, the longest card, the dash, the hint and the radio button
 * never overlap, 360 x 640 to 1440 x 900; a phone has no dash, a tablet
 * keeps it), statics (after Skip, the static
 * page follows wheel notches, trackpad bursts and keys on a desktop, and
 * swipes on a phone whose bars hide going down and come back going up,
 * the viewport and every viewport unit with them, under both motion modes:
 * no section moves in the page, no frame against her input or over a
 * screen, no scroll by script, no layout shift).
 *
 * WebGL is off by default: the checks read the DOM and its timing, and a
 * machine without a GPU renders the scene at a few frames a second
 * (`--webgl` turns it on). Needs Playwright's Chromium.
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    lang: { type: "string", default: "both" },
    device: { type: "string", default: "both" },
    only: { type: "string", default: "" },
    webgl: { type: "boolean", default: false },
  },
});

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const globalRoot = process.env.PLAYWRIGHT_GLOBAL ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
    return import(globalRoot);
  }
}
const { chromium } = await loadPlaywright();

const BASE = values.url.replace(/\/$/, "");
const LANGS = values.lang === "both" ? ["en", "es"] : [values.lang];
const DEVICES_WANTED = values.device === "both" ? ["desktop", "mobile"] : [values.device];
const ONLY = values.only ? values.only.split(",") : null;
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

/**
 * A fresh browser for every check, device and language: a run is some two
 * hundred sessions, and one browser carried through all of them grew slow
 * enough to add frames of input latency to the late timing checks.
 */
const launch = () =>
  chromium.launch({
    args: [
      "--autoplay-policy=no-user-gesture-required",
      ...(values.webgl ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--disable-3d-apis"]),
    ],
  });
let browser = null;

/** A fresh page, entered (without music), with the hero's probe on. */
async function session(device, lang, { reducedMotion = "no-preference", enter = true, hash = "", init = null } = {}) {
  const context = await browser.newContext({ ...DEVICES[device], reducedMotion });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${BASE}/${lang}${hash}`, { waitUntil: "load" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const cdp = await context.newCDPSession(page);
  if (device === "desktop") await page.mouse.move(720, 450);
  if (enter) {
    // Loaded, or slow enough that the loading screen offers the way in early.
    await page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: 240_000 });
    await page.locator('[data-loader] [data-enter="silent"]').click();
    await page.waitForSelector("[data-loader]", { state: "detached", timeout: 20_000 });
    await page.evaluate(() => (window.__vaProbe = []));
  }
  const close = () => context.close();
  return { page, cdp, errors, close };
}

/** A CDP touch stroke: down at (x, y0), `dy` px up over `ms`, lifted. */
async function stroke(cdp, { x = 195, y0 = 640, dy = 300, ms = 130 } = {}) {
  const steps = Math.max(2, Math.round(ms / 16));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - (dy * i) / steps }] });
    await sleep(ms / steps);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/**
 * Touch strokes sent at their own wall-clock times, without waiting for the
 * page between events, so a slow page cannot stretch a flick into a drag.
 * `strokes`: [{ at (ms), dy (px), ms, lift }]; resolves when all are sent.
 */
async function touchStrokes(cdp, strokes, { x = 195, y0 = 640 } = {}) {
  const points = [];
  for (const { at, dy, ms = 100, lift = true } of strokes) {
    points.push({ t: at, type: "touchStart", y: y0 });
    const steps = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= steps; i += 1) points.push({ t: at + (ms * i) / steps, type: "touchMove", y: y0 - (dy * i) / steps });
    if (lift) points.push({ t: at + ms + 8, type: "touchEnd" });
  }
  const start = Date.now();
  const sent = [];
  for (const point of points) {
    const wait = start + point.t - Date.now();
    if (wait > 0) await sleep(wait);
    sent.push(
      cdp
        .send("Input.dispatchTouchEvent", {
          type: point.type,
          touchPoints: point.type === "touchEnd" ? [] : [{ x, y: point.y }],
        })
        .catch(() => {}),
    );
  }
  await Promise.all(sent);
}

const probe = (page) => page.evaluate(() => window.__vaProbe?.at?.(-1) ?? null);

/**
 * Logs what every frame shows, from the DOM, into window.__frames: the
 * readout, the read card's marker, the cue, the title hint, the hold note,
 * a line's bar filling, the radio callout, the title's and the active
 * card's opacity.
 */
const startLog = (page) =>
  page.evaluate(() => {
    const log = (window.__frames = []);
    const shown = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.visibility !== "hidden" && Number(style.opacity) > 0.02;
    };
    const tick = () => {
      // The transport's mode is the stage's (a phone has no dash); the speed is the car's, from the probe.
      const stage = document.querySelector("[data-sticky]")?.parentElement;
      const card = document.querySelector("[data-card][data-active]");
      const hint = document.querySelector("[data-hint]");
      const cue = document.querySelector("[data-cue]");
      log.push({
        t: performance.now(),
        mode: stage?.getAttribute("data-mode"),
        speed: window.__vaProbe?.at?.(-1)?.speed ?? 0,
        dash: (() => {
          const dash = document.querySelector("[data-osd]");
          return Boolean(dash) && getComputedStyle(dash).display !== "none" && dash.getAttribute("data-vis") !== "off";
        })(),
        ready: !!document.querySelector("[data-card][data-ready]"),
        cue: cue?.hasAttribute("data-visible"),
        cueShown: shown(cue),
        hint: shown(hint) ? hint.getAttribute("data-prompt") : null,
        hold: document.querySelector("[data-hold-note]")?.hasAttribute("data-visible"),
        filling: !!card && !card.hasAttribute("data-ready") && Number(card.style.getPropertyValue("--read") || 0) < 1,
        callout: document.querySelector("[class*='callout']")?.getAttribute("data-visible") === "true",
        title: Number(document.getElementById("hero-title")?.parentElement?.style.opacity || 1),
        cardOpacity: card ? Number(card.style.opacity || 0) : 0,
        started: document.querySelector("[data-sticky]")?.parentElement?.hasAttribute("data-started"),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

/** A realistic tap: down and up 90 ms apart, without waiting for the page in between. */
async function tap(cdp, x = 195, y = 420) {
  const down = cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(90);
  const up = cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await Promise.all([down, up]);
}
const wheelOpen = (page) =>
  page.evaluate(() => document.querySelector("[role='dialog'][aria-modal='true']")?.parentElement?.getAttribute("data-open") === "true");
const push = async (s, device) => (device === "desktop" ? s.page.mouse.wheel(0, 100) : stroke(s.cdp, { dy: 220, ms: 120 }));

/** Drives calmly until card `card` is up. */
async function reachCard(s, device, card) {
  for (let i = 0; i < 80; i += 1) {
    const f = await probe(s.page);
    if (f && f.active >= card) return true;
    await push(s, device);
    await sleep(device === "desktop" ? 700 : 900);
  }
  return false;
}

/**
 * The statics check's recorder (an init script): every frame's scroll,
 * page height and section tops, her inputs and their direction, every
 * scroll the page is given by script (Lenis writing her own input from its
 * frame is hers), and every layout shift.
 */
function recordStatics() {
  const SECTIONS = ["suspects", "stats", "projects", "credits", "contact"];
  const rec = { on: false, frames: [], inputs: [], writes: [], shifts: [] };
  const where = () => (new Error().stack ?? "").split("\n").slice(2, 7).map((line) => line.trim().replace(/\(.*\//, "(")).join(" < ");
  const own = (stack) => /Lenis\.setScroll|Animate\.advance/.test(stack);
  const log = (fn) => {
    if (!rec.on) return;
    const stack = where();
    if (!own(stack)) rec.writes.push({ t: performance.now(), fn, y: window.scrollY, stack });
  };
  for (const [owner, name, label] of [
    [window, "scrollTo", "window.scrollTo"],
    [window, "scrollBy", "window.scrollBy"],
    [window, "scroll", "window.scroll"],
    [Element.prototype, "scrollTo", "element.scrollTo"],
    [Element.prototype, "scrollBy", "element.scrollBy"],
    [Element.prototype, "scrollIntoView", "element.scrollIntoView"],
  ]) {
    const original = owner[name];
    owner[name] = function (...args) {
      log(label);
      return original.apply(this, args);
    };
  }
  const scrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
  Object.defineProperty(Element.prototype, "scrollTop", {
    configurable: true,
    get() {
      return scrollTop.get.call(this);
    },
    set(value) {
      if (this === document.documentElement || this === document.body) log("scrollTop");
      scrollTop.set.call(this, value);
    },
  });
  try {
    new PerformanceObserver((list) => {
      if (!rec.on) return;
      for (const entry of list.getEntries()) {
        const sources = (entry.sources ?? []).map((source) => String(source.node?.id || source.node?.className || source.node?.nodeName).slice(0, 60));
        rec.shifts.push({ t: entry.startTime, value: entry.value, sources });
      }
    }).observe({ type: "layout-shift" });
  } catch {}
  const KEY_DIR = { PageDown: 1, ArrowDown: 1, " ": 1, PageUp: -1, ArrowUp: -1 };
  window.addEventListener("wheel", (e) => rec.on && e.deltaY !== 0 && rec.inputs.push({ t: performance.now(), dir: Math.sign(e.deltaY), kind: "wheel" }), { capture: true, passive: true });
  window.addEventListener("keydown", (e) => {
    const dir = (KEY_DIR[e.key] ?? 0) * (e.key === " " && e.shiftKey ? -1 : 1);
    if (rec.on && dir) rec.inputs.push({ t: performance.now(), dir, kind: "key" });
  }, { capture: true });
  let fingerY = null;
  window.addEventListener("touchstart", (e) => (fingerY = e.touches[0]?.clientY ?? null), { capture: true, passive: true });
  window.addEventListener("touchmove", (e) => {
    const now = e.touches[0]?.clientY;
    if (rec.on && fingerY !== null && now !== undefined && now !== fingerY) rec.inputs.push({ t: performance.now(), dir: now < fingerY ? 1 : -1, kind: "touch" });
    fingerY = now ?? fingerY;
  }, { capture: true, passive: true });
  window.addEventListener("resize", () => rec.on && rec.inputs.push({ t: performance.now(), dir: 0, kind: "resize", h: innerHeight }));
  const tick = () => {
    if (rec.on) {
      const tops = SECTIONS.map((id) => {
        const el = document.getElementById(id);
        return el ? Math.round((el.getBoundingClientRect().top + window.scrollY) * 10) / 10 : null;
      });
      rec.frames.push({ t: performance.now(), y: window.scrollY, h: document.documentElement.scrollHeight, ih: innerHeight, tops });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__statics = {
    start() {
      rec.on = true;
    },
    stop() {
      rec.on = false;
      return rec;
    },
  };
}

/**
 * The statics check's verdict on a recording: sections that moved in the
 * page or a page height that changed, frames against every input of the
 * moment (two frames of grace at a turn) or over a screen at once, scrolls
 * by script, and layout shifts (any value, input or not). `floor` is THE
 * USUAL SUSPECTS' top: the page stays below the hero.
 */
function staticsVerdict(log, floor) {
  const { frames, inputs, writes, shifts } = log;
  const moved = [];
  const against = [];
  const leaps = [];
  let below = true;
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1];
    const b = frames[i];
    if (a.h !== b.h) moved.push({ t: Math.round(b.t), height: [a.h, b.h], y: b.y });
    b.tops.forEach((top, n) => {
      if (top !== null && a.tops[n] !== null && Math.abs(top - a.tops[n]) > 0.5) moved.push({ t: Math.round(b.t), section: n, top: [a.tops[n], top], y: b.y });
    });
    if (b.y < floor - b.ih) below = false;
    const dy = b.y - a.y;
    if (Math.abs(dy) > b.ih) leaps.push({ t: Math.round(b.t), dy });
    if (Math.abs(dy) <= 2) continue;
    // Her input of the moment: the last one before this frame's grace, and any since.
    const recent = inputs.filter((e) => e.dir !== 0 && e.t <= b.t && e.t > a.t - 34);
    const before = inputs.filter((e) => e.dir !== 0 && e.t <= a.t - 34).at(-1);
    const dirs = new Set([...recent, ...(before ? [before] : [])].map((e) => e.dir));
    if (dirs.size === 0 || !dirs.has(Math.sign(dy))) against.push({ t: Math.round(b.t), dy: Math.round(dy), y: Math.round(b.y), dirs: [...dirs] });
  }
  const shift = shifts.reduce((sum, entry) => sum + entry.value, 0);
  const ok = frames.length > 100 && inputs.length > 10 && below && moved.length === 0 && against.length === 0 && leaps.length === 0 && writes.length === 0 && shift === 0;
  return {
    ok,
    detail: {
      frames: frames.length,
      inputs: inputs.length,
      resizes: inputs.filter((e) => e.kind === "resize").length,
      below,
      moved: moved.slice(0, 4),
      against: against.slice(0, 4),
      leaps: leaps.slice(0, 4),
      writes: writes.slice(0, 3),
      shift,
      shifts: shifts.slice(0, 3),
    },
  };
}

const CHECKS = {
  async swipe(device, lang) {
    if (device !== "mobile") return;
    for (const pause of [0, 450, 800]) {
      const s = await session(device, lang);
      await sleep(1500);
      const y0 = await s.page.evaluate(() => scrollY);
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 600 }] });
      await sleep(pause);
      for (let i = 1; i <= 9; i += 1) {
        await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: 600 - i * 33 }] });
        await sleep(16);
      }
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(900);
      const moved = (await s.page.evaluate(() => scrollY)) - y0;
      const opened = await wheelOpen(s.page);
      report(`${device} ${lang} swipe: a thumb resting ${pause} ms then swiping drives, never opens the radio`, !opened && moved > 50, { opened, moved });
      await s.close();
    }
    const s = await session(device, lang);
    await sleep(1500);
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 600 }] });
    await sleep(800);
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(600);
    report(`${device} ${lang} swipe: a still long-press, lifted, opens the radio`, await wheelOpen(s.page), {});
    await s.close();

    // A thumb resting on the picture while she reads (3.5 s, trembling a pixel), then lifted: no radio.
    const r = await session(device, lang);
    await sleep(1500);
    await r.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 600 }] });
    for (let t = 0; t < 3500; t += 100) {
      await sleep(100);
      await r.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: 600 + ((t / 100) % 2) }] });
    }
    const ring = await r.page.evaluate(() => document.querySelector("[data-armed='true']") !== null);
    await r.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(600);
    const restOpened = await wheelOpen(r.page);
    report(`${device} ${lang} swipe: a thumb resting on the picture for a while, then lifted, never opens the radio`, !restOpened && !ring, {
      opened: restOpened,
      ringStillUp: ring,
    });

    // A thumb still on the picture while the other holds the pedal, then both lift: no radio.
    const pedal = await r.page.evaluate(() => {
      const box = document.querySelector("[data-pedal]").getBoundingClientRect();
      return { x: box.right - box.width * 0.4, y: box.top + box.height * 0.5 };
    });
    await r.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 120, y: 500, id: 0 }] });
    await sleep(200);
    await r.cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 120, y: 500, id: 0 },
        { x: pedal.x, y: pedal.y, id: 1 },
      ],
    });
    await sleep(1000);
    await r.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(600);
    const withPedal = await wheelOpen(r.page);
    report(`${device} ${lang} swipe: a thumb still on the picture while the other holds the pedal never opens the radio`, !withPedal, {});
    await r.close();
  },

  async arrows(device, lang) {
    const s = await session(device, lang);
    await sleep(1800);
    const shown = (selector) =>
      s.page.evaluate((sel) => {
        const visible = (el) => {
          for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).display === "none") return false;
          return true;
        };
        const root = document.querySelector(sel);
        return root ? [...root.querySelectorAll("[data-g]")].filter(visible).map((g) => g.getAttribute("data-g")) : null;
      }, selector);
    const want = device === "mobile" ? "up" : "down";
    const hint = await shown("[data-hint] [class*='hintLine1']");
    await reachCard(s, device, 1);
    for (let i = 0; i < 30 && !(await s.page.evaluate(() => !!document.querySelector("[data-card][data-ready]"))); i += 1) await sleep(400);
    await sleep(1200);
    const marker = await shown("[data-card][data-ready] [class*='cueTail']");
    const readout = await shown("[data-osd]");
    await s.page.evaluate(() => window.__vaJump(0.97));
    await sleep(1500);
    const end = await shown("[data-end-cue]");
    const all = [marker, end];
    // The dash asks with the same gesture (the mouse's wheel for the wheel); a phone has no dash:
    // the marker under the card asks there.
    const dashWant = device === "mobile" ? "none" : "wheel";
    const dashOk = device === "mobile" ? readout?.length === 0 : readout?.length === 1 && readout[0] === dashWant;
    // The title's ask on a phone names the pedal first ("Hold the pedal or swipe up"): the pedal's glyph.
    const hintWant = device === "mobile" ? "pedal" : want;
    report(
      `${device} ${lang} arrows: the marker and the end cue point ${want}, the hint shows ${hintWant}, the dash asks with ${dashWant}`,
      all.every((g) => g?.length === 1 && g[0] === want) && hint?.length === 1 && hint[0] === hintWant && dashOk,
      { hint, marker, readout, end },
    );
    await s.close();
  },

  async signals(device, lang) {
    const s = await session(device, lang);
    await sleep(1500);
    await s.page.evaluate(() => {
      const log = (window.__frames = []);
      const tick = () => {
        const stage = document.querySelector("[data-sticky]")?.parentElement;
        const card = document.querySelector("[data-card][data-active]");
        log.push({
          t: performance.now(),
          mode: stage?.getAttribute("data-mode"),
          hold: document.querySelector("[data-hold-note]")?.hasAttribute("data-visible"),
          filling: !!card && !card.hasAttribute("data-ready") && Number(card.style.getPropertyValue("--read") || 0) < 1,
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await reachCard(s, device, 2);
    const t0 = await s.page.evaluate(() => performance.now());
    for (let i = 0; i < 2; i += 1) {
      if (device === "desktop") await s.page.mouse.wheel(0, 120);
      else await stroke(s.cdp, { dy: 350, ms: 150 });
      await sleep(350);
    }
    await sleep(1200);
    const t1 = await s.page.evaluate(() => performance.now());
    const until = Date.now() + 3000;
    while (Date.now() < until) {
      if (device === "desktop") {
        await s.page.mouse.wheel(0, 100);
        await sleep(60);
      } else {
        await stroke(s.cdp, { dy: 380, ms: 120 });
        await sleep(110);
      }
    }
    const stop = await s.page.evaluate(() => performance.now());
    await sleep(2500);
    const frames = await s.page.evaluate(() => window.__frames);
    const flicks = frames.filter((f) => f.t >= t0 && f.t < t1);
    const pushed = frames.filter((f) => f.t >= t1);
    const lastHold = [...pushed].reverse().find((f) => f.hold);
    const mixed = frames.filter((f) => f.mode === "waiting" && (f.hold || f.filling)).length;
    report(`${device} ${lang} signals: never WAITING while the note is up or a line's bar fills`, mixed === 0, { mixed });
    report(`${device} ${lang} signals: two flicks at an unread line never bring up the note`, !flicks.some((f) => f.hold), {});
    // It goes 0.32 s after her last push; on touch the episode bridges the lift between strokes (0.7 s).
    const goneMs = device === "desktop" ? 600 : 900;
    report(
      `${device} ${lang} signals: sustained pushing brings up the note, gone within ${goneMs / 1000} s of stopping`,
      pushed.some((f) => f.hold) && lastHold && lastHold.t - stop < goneMs,
      { shown: pushed.some((f) => f.hold), goneAfterMs: lastHold && Math.round(lastHold.t - stop) },
    );
    await s.close();
    if (device === "mobile") {
      // A thumb left on the glass after two quick flicks is no push; flicks that keep coming are.
      const r = await session(device, lang);
      await sleep(1500);
      await startLog(r.page);
      await reachCard(r, device, 2);
      // Onto a line that has just come up, so it plays for a while yet.
      const unread = async () => {
        for (let i = 0; i < 60; i += 1) {
          const f = await probe(r.page);
          if (f.beat === "card" && f.read < 0.15) return true;
          if (f.beat === "card") await sleep(300);
          else {
            await stroke(r.cdp, { dy: 220, ms: 120 });
            await sleep(250);
          }
        }
        return false;
      };
      await unread();
      // The strokes that got there are over (a push episode ends after 0.7 s on touch).
      await sleep(800);
      const t0 = await r.page.evaluate(() => performance.now());
      await touchStrokes(r.cdp, [
        { at: 0, dy: 600, ms: 110 },
        { at: 300, dy: 600, ms: 110, lift: false },
      ]);
      await sleep(3000);
      await r.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      const t1 = await r.page.evaluate(() => performance.now());
      const rested = (await r.page.evaluate(() => window.__frames)).filter((f) => f.t >= t0 && f.t <= t1);
      const restHeld = await r.page.evaluate((from) => Math.max(...window.__vaProbe.filter((f) => f.t >= from).map((f) => f.holdHeld)), t0);
      report(`${device} ${lang} signals: a thumb resting on the glass after two flicks never brings up the note`, !rested.some((f) => f.hold), {
        frames: rested.length,
        held: restHeld,
      });
      await sleep(1500);
      await unread();
      const t2 = await r.page.evaluate(() => performance.now());
      // A hard flick every 0.55 s for 3.3 s.
      await touchStrokes(r.cdp, Array.from({ length: 7 }, (_, i) => ({ at: i * 550, dy: 450, ms: 100 })));
      const flicked = (await r.page.evaluate(() => window.__frames)).filter((f) => f.t >= t2);
      const episode = await r.page.evaluate((from) => {
        const frames = window.__vaProbe.filter((f) => f.t >= from);
        return {
          span: Math.max(...frames.map((f) => f.holdSpan)),
          held: Math.max(...frames.map((f) => f.holdHeld)),
          unread: frames.filter((f) => f.beat === "card").length / Math.max(1, frames.length),
        };
      }, t2);
      report(`${device} ${lang} signals: hard flicks that keep coming at an unread line bring up the note`, flicked.some((f) => f.hold), {
        frames: flicked.length,
        ...episode,
      });
      await r.close();
    }
  },

  async rewind(device, lang) {
    const s = await session(device, lang);
    await sleep(1500);
    await reachCard(s, device, 1);
    for (let i = 0; i < 25; i += 1) {
      if (device === "desktop") await s.page.mouse.wheel(0, -200);
      else await stroke(s.cdp, { y0: 300, dy: -350, ms: 120 });
      await sleep(120);
    }
    await sleep(1800);
    const r = await s.page.evaluate(() => {
      const hint = document.querySelector("[data-hint]");
      const box = hint.querySelector("[class*='hintBox']").getBoundingClientRect();
      const bar = document.querySelector("[data-bar='bottom']").getBoundingClientRect();
      // Centred in the picture: the page reserves a scrollbar's gutter (scrollbar-gutter:
      // stable), which headless Chromium keeps blank, so innerWidth is not the picture's width.
      const picture = document.querySelector("[data-sticky]").getBoundingClientRect();
      return {
        prompt: hint.getAttribute("data-prompt"),
        opacity: Number(getComputedStyle(hint).opacity),
        centreOff: Math.abs((box.left + box.right) / 2 - (picture.left + picture.right) / 2),
        inBar: box.top >= bar.top - 1 && box.bottom <= innerHeight + 1,
        aboveBar: box.bottom <= bar.top + 1,
        cue: document.querySelector("[data-cue]").hasAttribute("data-visible"),
      };
    });
    const placed = device === "desktop" ? r.inBar : r.aboveBar;
    report(
      `${device} ${lang} rewind: back on the title, the hint says keep driving (never take the wheel), centred, clear of the bar's edge`,
      r.prompt === "onward" && r.opacity > 0.99 && r.centreOff < 2 && placed && !r.cue,
      r,
    );
    await s.close();
  },

  async wait(device, lang) {
    if (device !== "desktop") return;
    const s = await session(device, lang);
    await sleep(1500);
    await reachCard(s, device, 0);
    // Timed from WAITING itself, on the page's own frame clock: the car is at
    // its crawl 3.5 s into the wait and at its deep crawl 6 s into it, however
    // long the line took to be read and the page to get there.
    const from = await s.page.evaluate(() => performance.now());
    await sleep(17000);
    const frames = await s.page.evaluate((t0) => window.__vaProbe.filter((f) => f.t >= t0), from);
    const first = frames.find((f) => f.mode === "waiting");
    const at = (seconds) => first && frames.find((f) => f.t >= first.t + seconds * 1000);
    const crawl = at(3.5);
    const deep = at(6);
    const stayed = first ? frames.filter((f) => f.t >= first.t && f.t <= deep?.t).every((f) => f.mode === "waiting") : false;
    report(
      `${device} ${lang} wait: WAITING once the line is read, the car braking to a crawl, then lower`,
      Boolean(first && crawl && deep) && stayed && crawl.speed <= 14 && deep.deep && deep.speed <= 11,
      {
        waitingAfterMs: first && Math.round(first.t - from),
        speedAt3_5: crawl?.speed,
        speedAt6: deep?.speed,
        deep: deep?.deep,
        stayed,
      },
    );
    await s.close();
  },

  async radio(device, lang) {
    const s = await session(device, lang);
    await sleep(1500);
    await reachCard(s, device, 1);
    const info = () =>
      s.page.evaluate(() => ({
        open: document.querySelector("[role='dialog'][aria-modal='true']")?.parentElement?.getAttribute("data-open") === "true",
        selected: document.querySelector("[role='radio'][data-selected='true']")?.getAttribute("aria-label")?.split(".")[0],
        tuned: document.querySelector("[role='radio'][aria-checked='true']")?.getAttribute("aria-label")?.split(".")[0],
        y: Math.round(scrollY),
        inputAt: window.__vaProbe?.at?.(-1)?.inputAt ?? null,
      }));
    if (device === "desktop") {
      await s.page.mouse.move(720, 450);
      await s.page.mouse.down({ button: "right" });
      await sleep(250);
      const aiming = await info();
      await s.page.mouse.move(720, 300, { steps: 6 });
      await sleep(200);
      const aimed = await info();
      await s.page.mouse.up({ button: "right" });
      await sleep(600);
      const released = await info();
      report(`${device} ${lang} radio: right-button hold, aim, release tunes and closes`, aiming.open && !released.open && released.tuned === aimed.selected, { aimed, released });
      await s.page.keyboard.press("q");
      await sleep(500);
      const before = await info();
      for (let i = 0; i < 4; i += 1) {
        await s.page.mouse.wheel(0, 120);
        await sleep(150);
      }
      await sleep(500);
      const after = await info();
      report(
        `${device} ${lang} radio: Q opens it; the mouse wheel browses the dial and never reaches the hero`,
        before.open && after.open && after.selected !== before.selected && after.y === before.y && after.inputAt === before.inputAt,
        { before, after },
      );
      await s.page.keyboard.press("Escape");
      await sleep(400);
    } else {
      await s.page.locator("[data-page-controls] button[aria-haspopup='dialog']").tap();
      await sleep(600);
      const before = await info();
      await stroke(s.cdp, { x: 195, y0: 500, dy: 200 });
      await sleep(150);
      await stroke(s.cdp, { x: 60, y0: 780, dy: 300 });
      await sleep(600);
      const after = await info();
      report(
        `${device} ${lang} radio: the music button opens it; swipes on it stay there`,
        before.open && after.open && after.y === before.y && after.inputAt === before.inputAt,
        { before, after },
      );
    }
    await s.close();
  },

  async reduced(device, lang) {
    const s = await session(device, lang);
    await sleep(1500);
    await reachCard(s, device, 4);
    await sleep(400);
    const active = (await probe(s.page)).active;
    await s.page.emulateMedia({ reducedMotion: "reduce" });
    await sleep(1500);
    const r = await s.page.evaluate((card) => {
      const rect = document.querySelectorAll("[data-card]")[card].getBoundingClientRect();
      return { y: Math.round(scrollY), top: Math.round(rect.top), inView: rect.top >= 0 && rect.bottom <= innerHeight };
    }, active);
    report(`${device} ${lang} reduced: switched on mid-film, the line she was on is in view`, r.y > 0 && r.inView, { active, ...r });
    const was = (await s.page.evaluate(() => window.__vaProbe.filter((f) => f.p > 0).at(-1)?.p)) ?? null;
    await s.page.emulateMedia({ reducedMotion: "no-preference" });
    await sleep(2500);
    const back = await probe(s.page);
    report(`${device} ${lang} reduced: switched back without scrolling, the film is exactly where it was`, was !== null && Math.abs(back.p - was) < 0.002, { was, back: back.p });
    await s.close();
  },

  async focus(device, lang) {
    if (device !== "desktop") return;
    const s = await session(device, lang);
    await sleep(2500);
    await s.page.mouse.click(720, 450);
    let focus = null;
    for (let i = 0; i < 4 && !/skip|saltar/i.test(focus ?? ""); i += 1) {
      await s.page.keyboard.press("Tab");
      focus = await s.page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    }
    await s.page.keyboard.press("Space");
    await sleep(800);
    const skipped = (await probe(s.page))?.p === 1;
    // Skip lands on THE USUAL SUSPECTS, at the top of the screen, and hands it the focus.
    const landed = await s.page.evaluate(() => {
      const next = document.getElementById("suspects");
      return { focused: document.activeElement === next, top: next ? Math.round(next.getBoundingClientRect().top) : null };
    });
    report(
      `${device} ${lang} focus: Skip reached with Tab right after a click keeps Space, and lands on THE USUAL SUSPECTS`,
      skipped && landed.focused && landed.top !== null && Math.abs(landed.top) <= 1,
      { focus, skipped, ...landed },
    );
    await s.close();

    // The radio button clicked open with the mouse and its wheel closed with Esc: Space plays the next line.
    const r = await session(device, lang);
    await sleep(1500);
    await reachCard(r, device, 1);
    await r.page.locator("[data-page-controls] button[aria-haspopup='dialog']").click();
    await sleep(600);
    const opened = await wheelOpen(r.page);
    await r.page.keyboard.press("Escape");
    await sleep(600);
    const closed = !(await wheelOpen(r.page));
    const focused = await r.page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup"));
    const before = await probe(r.page);
    await r.page.keyboard.press("Space");
    await sleep(900);
    const after = await probe(r.page);
    const reopened = await wheelOpen(r.page);
    report(
      `${device} ${lang} focus: the radio clicked open and closed with Esc does not keep Space; Space plays the next line`,
      opened && closed && focused === "dialog" && !reopened && after.source === "key" && after.inputAt !== before.inputAt,
      { opened, closed, focused, reopened, source: after.source },
    );
    await r.close();
  },

  async blocks(device, lang) {
    if (device !== "mobile") return;
    const s = await session(device, lang, { enter: false });
    const bad = [];
    for (const width of [320, 360, 375, 390, 414, 768, 1024, 1440]) {
      await s.page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
      // The blocks are fitted to their lines when the viewport changes.
      await sleep(400);
      bad.push(
        ...(await s.page.evaluate((width) => {
          const out = [];
          for (const card of document.querySelectorAll("[data-card]")) {
            card.style.opacity = "1";
            const text = card.querySelector("[data-card-text]");
            const boxes = text.getClientRects().length;
            // Lines from the words' own boxes: the last line never holds a word alone (balanced).
            const lines = [];
            const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              for (const match of n.data.matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(n, match.index);
                range.setEnd(n, match.index + match[0].length);
                const r = range.getBoundingClientRect();
                const mid = (r.top + r.bottom) / 2;
                const line = lines.find((l) => Math.abs(l.mid - mid) < 4);
                if (line) {
                  line.words += 1;
                  line.left = Math.min(line.left, r.left);
                  line.right = Math.max(line.right, r.right);
                } else lines.push({ mid, words: 1, left: r.left, right: r.right });
              }
            }
            const widest = Math.max(...lines.map((l) => l.right - l.left));
            const style = getComputedStyle(text);
            const content = text.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const words = lines.reduce((n, l) => n + l.words, 0);
            const orphan = lines.length > 1 && words > 2 && lines.at(-1).words < 2;
            // The block hugs its widest line (a few px for rounding), and the marker is never in the text.
            const loose = content - widest > 4;
            const inside = text.contains(card.querySelector("[class*='cueTail']"));
            if (boxes !== 1 || orphan || loose || inside) out.push({ width, card: text.textContent.slice(0, 30), boxes, orphan, slack: Math.round(content - widest), inside });
            card.style.opacity = "";
          }
          return out;
        }, width)),
      );
    }
    report(`${device} ${lang} blocks: every card one block, balanced, fitted to its lines, its marker outside, 320 to 1440 px wide`, bad.length === 0, bad.slice(0, 4));
    await s.close();
  },

  async calm(device, lang) {
    for (const beat of device === "desktop" ? [2.5, 3.5] : [3.5]) {
      const s = await session(device, lang);
      await sleep(1500);
      await startLog(s.page);
      const t0 = Date.now();
      while (Date.now() - t0 < 32000) {
        if (device === "desktop") await s.page.mouse.wheel(0, 100);
        else await stroke(s.cdp, { dy: 90, ms: 120 });
        await sleep(beat * 1000);
      }
      const frames = await s.page.evaluate(() => window.__frames);
      const late = frames.filter((f) => f.t - frames[0].t > 8000 && f.mode !== "hidden");
      let flips = 0;
      for (let i = 1; i < late.length; i += 1) if (late[i].mode !== late[i - 1].mode) flips += 1;
      const slowest = Math.min(...late.map((f) => f.speed));
      const changes = late
        .filter((f, i) => i > 0 && f.mode !== late[i - 1].mode)
        .map((f) => `${Math.round(f.t - frames[0].t)}:${f.mode}`);
      const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
      report(`${device} ${lang} calm: a notch every ${beat} s keeps the car and the readout steady`, flips <= 2 && slowest >= 45, {
        flips,
        slowest,
        changes,
        longestFrameMs: Math.round(Math.max(...gaps)),
      });
      const asks = frames.filter((f) => (f.ready || f.cue || (f.hint && f.hint !== "ack" && f.started)) && f.mode !== "waiting");
      const both = frames.filter((f) => f.cueShown && f.cardOpacity > 0.02);
      report(`${device} ${lang} calm ${beat} s: nothing asks for more next to YOU DRIVE; the cue never shares the band with a card`, asks.length === 0 && both.length === 0, { asks: asks.length, both: both.length });
      await s.close();
    }
  },

  async title(device, lang) {
    if (device !== "mobile") return;
    {
      const s = await session(device, lang);
      await startLog(s.page);
      await sleep(1400);
      const t0 = await s.page.evaluate(() => performance.now());
      await tap(s.cdp);
      await sleep(7000);
      const frames = await s.page.evaluate(() => window.__frames);
      const after = frames.filter((f) => f.t > t0);
      const ack = after.find((f) => f.hint === "ack");
      const card = await s.page.evaluate(() => window.__vaProbe.find((f) => f.active === 0)?.t ?? null);
      const opened = await wheelOpen(s.page);
      report(
        `${device} ${lang} title: a tap while the name forms is answered at once and plays the first line once it has`,
        !!ack && ack.t - t0 < 400 && card !== null && card - t0 < 6000 && !opened,
        { ackMs: ack && Math.round(ack.t - t0), cardMs: card && Math.round(card - t0), opened },
      );
      await s.close();
    }
    {
      const s = await session(device, lang);
      await sleep(4500);
      await stroke(s.cdp, { dy: 250, ms: 120 });
      await sleep(4500);
      const f = await probe(s.page);
      const title = await s.page.evaluate(() => Number(document.getElementById("hero-title").parentElement.style.opacity || 1));
      report(
        `${device} ${lang} title: a short swipe that rests mid-dissolve leaves no ghost of the title`,
        f.p > 0.03 && f.p < 0.1 && title === 0,
        { p: f.p, title, mode: f.mode },
      );
      await s.close();
    }
  },

  async titlewait(device, lang) {
    // Hard input while the name still forms: answered at once, told why the road
    // waits, and never asked again to take the wheel she has. Early enough that
    // she rests on the title after, and at 2.5 s, as the name lands.
    for (const at of [1000, 2500]) {
      const s = await session(device, lang);
      await s.page.evaluate(() => {
        const log = (window.__hints = []);
        const visibleText = (root) => {
          const out = [];
          for (const line of root.querySelectorAll("p")) {
            let shown = true;
            for (let e = line; e && e !== root.parentElement; e = e.parentElement) if (getComputedStyle(e).display === "none") shown = false;
            if (!shown) continue;
            for (const span of line.childNodes) {
              if (span.nodeType === 1 && getComputedStyle(span).display === "none") continue;
              out.push(span.textContent.trim());
            }
          }
          return out.filter(Boolean).join(" / ");
        };
        const tick = () => {
          const hint = document.querySelector("[data-hint]");
          const stage = document.querySelector("[data-sticky]").parentElement;
          log.push({
            t: performance.now(),
            prompt: hint.getAttribute("data-prompt"),
            naming: hint.hasAttribute("data-naming"),
            shown: Number(getComputedStyle(hint).opacity) > 0.05 && hint.getAttribute("data-prompt") !== null,
            text: visibleText(hint),
            started: stage.hasAttribute("data-started"),
            mode: stage.getAttribute("data-mode"),
          });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await sleep(at);
      if (device === "desktop") {
        for (let i = 0; i < 3; i += 1) {
          await s.page.mouse.wheel(0, 300);
          await sleep(250);
        }
      } else {
        await touchStrokes(s.cdp, [0, 400, 800].map((t) => ({ at: t, dy: 500, ms: 90 })));
      }
      await sleep(9000);
      const log = await s.page.evaluate(() => window.__hints);
      const restP = (await probe(s.page)).p;
      const started = log.filter((f) => f.started);
      const takeAgain = started.filter((f) => f.shown && f.prompt === "hint");
      const arriving = started.filter((f) => f.shown && f.prompt === "ack" && f.naming);
      // "Still arriving" is owed only if the name was still forming or holding at her first
      // input (the first frame she had the wheel); on a slow machine the 2.5 s input can land after.
      const owed = started.length > 0 && started[0].naming;
      const onward = started.filter((f) => f.shown && f.prompt === "onward");
      const ask = lang === "en" ? /take the wheel/i : /toma el volante/i;
      const onTitle = restP < 0.06;
      const ok =
        started.length > 0 &&
        takeAgain.length === 0 &&
        (!owed || arriving.length > 0) &&
        (!onTitle || onward.length > 0) &&
        !onward.some((f) => ask.test(f.text));
      report(
        `${device} ${lang} titlewait (${at / 1000} s): the name still arriving is said (if it was), then keep driving, never take the wheel again`,
        ok,
        {
          takeAgain: takeAgain.length,
          owed,
          arriving: arriving[0]?.text,
          onward: onward[0]?.text,
          restP,
          states: log
            .map((f) => `${f.prompt}${f.naming ? "+naming" : ""}${f.shown ? "" : "(hidden)"} ${f.mode}`)
            .filter((x, i, all) => i === 0 || x !== all[i - 1])
            .join(" > "),
        },
      );
      await s.close();
    }
  },

  async callout(device, lang) {
    const s = await session(device, lang);
    await s.page.evaluate(() => localStorage.removeItem("va-radio-hint"));
    await sleep(1500);
    await startLog(s.page);
    let seen = false;
    for (let i = 0; i < 40 && !seen; i += 1) {
      await push(s, device);
      await sleep(device === "desktop" ? 1200 : 1500);
      seen = await s.page.evaluate(() => window.__frames.some((f) => f.callout));
    }
    const early = await s.page.evaluate(() => {
      const first = window.__frames.find((f) => f.callout);
      return first ? Math.round(first.t - window.__frames[0].t) : null;
    });
    // Up, it hangs clear of the HUD and of the dash, which stays up beside it.
    for (let i = 0; i < 12 && !(await s.page.evaluate(() => Number(getComputedStyle(document.querySelector("[class*='callout']")).opacity) > 0.9)); i += 1) await sleep(250);
    const hits = await s.page.evaluate(() => {
      const c = document.querySelector("[class*='callout']").getBoundingClientRect();
      return [...document.querySelectorAll("[data-hud], [class*='reel'], [data-osd][data-vis='on']")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && !(r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom);
      }).length;
    });
    const frames = await s.page.evaluate(() => window.__frames);
    const clash = frames.filter((f) => f.callout && (f.mode === "waiting" || f.ready || f.cue || f.hold || f.hint));
    report(
      `${device} ${lang} callout: after the first line, in a quiet moment, never next to a prompt, clear of the HUD`,
      seen && early > 6000 && clash.length <= 1 && hits === 0,
      { seen, firstMs: early, clash: clash.length, hits },
    );
    if (device === "mobile" && seen) {
      // Wait for it to be up, then tap it: the wheel opens, the film stays.
      for (let i = 0; i < 20 && !(await s.page.evaluate(() => Number(getComputedStyle(document.querySelector("[class*='callout']")).opacity) > 0.9)); i += 1) await sleep(250);
      const box = await s.page.evaluate(() => {
        const r = document.querySelector("[class*='callout']").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const before = await probe(s.page);
      if (box) await tap(s.cdp, box.x, box.y);
      await sleep(700);
      const after = await probe(s.page);
      const opened = await wheelOpen(s.page);
      report(`${device} ${lang} callout: a tap on "tap here" opens the radio, not the next line`, opened && Math.abs(after.p - before.p) < 0.002, { opened, before: before.p, after: after.p });
    }
    await s.close();

    // It is the hero's alone. After Skip, a little scroll back up leaves a strip of the hero's
    // night at the top, with THE CREW's card right under it: the film is over (p = 1), and the
    // callout stays away (sceneLoading.onStage), however much of that night shows. (Back in the
    // film, resting on a line she has read asks her to go on: a prompt, so no callout either;
    // that it comes in a quiet moment of the film is the first part of this check.)
    const k = await session(device, lang);
    await k.page.evaluate(() => localStorage.removeItem("va-radio-hint"));
    await sleep(1500);
    await k.page.locator("[data-skip]").click({ timeout: 10_000 });
    await sleep(1500);
    const night = Math.round(0.6 * DEVICES[device].viewport.height);
    const back = {};
    for (const px of [16, 80, 200, night]) {
      back[px] = await k.page.evaluate(async (by) => {
        const shown = [];
        let on = true;
        const tick = () => {
          shown.push(document.querySelector("[data-side-hint]")?.getAttribute("data-visible") === "true");
          if (on) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        // The scrollbar, as it were: the walls are open, so the page stays there.
        window.scrollTo(0, document.getElementById("suspects").getBoundingClientRect().top + scrollY - by);
        await new Promise((resolve) => setTimeout(resolve, 1600));
        on = false;
        return shown.some(Boolean);
      }, px);
    }
    report(
      `${device} ${lang} callout: after Skip, a strip of the hero's night back up (the film over) never brings it over THE CREW's card`,
      Object.values(back).every((shown) => !shown),
      back,
    );
    await k.close();
  },

  async trap(device, lang) {
    // The page is never left past the frontier, whatever moves it there, and
    // she can always drive on (gate.ts). Each way of moving the page natively
    // past the wall of an unread card; the probe's `page` is the page's own
    // offset, `maxScroll` the wall.
    const ways = {
      // Lenis drops the scroll event right after its own landing: a jump then is one it misses.
      async missed(s) {
        await s.page.evaluate(() => {
          const probe = window.__vaProbe;
          const push = probe.push.bind(probe);
          let last = null;
          let done = false;
          probe.push = (f) => {
            if (!done && last === "smooth" && f.lenisState === "false") {
              done = true;
              setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 0);
            }
            last = f.lenisState;
            return push(f);
          };
        });
        await s.page.mouse.wheel(0, 60);
      },
      async programmatic(s) {
        await s.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      },
      async find(s) {
        await s.page.evaluate(() => window.find("GitHub"));
      },
      // A free-spinning wheel: 40 notches sent while the page is busy for 2.5 s.
      async burst(s) {
        await s.page.evaluate(() => setTimeout(() => { const end = performance.now() + 2500; while (performance.now() < end); }, 0));
        await sleep(50);
        const sent = [];
        for (let i = 0; i < 40; i += 1) {
          sent.push(s.cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 450, deltaX: 0, deltaY: 100 }).catch(() => {}));
          await sleep(16);
        }
        await Promise.all(sent);
      },
      // Hard flings at the wall, the finger lifted at speed.
      async flings(s) {
        for (let i = 0; i < 6; i += 1) {
          await stroke(s.cdp, { dy: 500, ms: 60 });
          await sleep(200);
        }
      },
    };
    const names = device === "desktop" ? ["missed", "programmatic", "find", "burst"] : ["flings", "programmatic"];
    for (const name of names) {
      const s = await session(device, lang);
      await sleep(1500);
      await reachCard(s, device, 1);
      await s.page.evaluate(() => (window.__vaProbe.length = 0));
      await ways[name](s);
      await sleep(2500);
      const past = await s.page.evaluate(() => {
        let run = 0;
        let longest = 0;
        let frames = 0;
        for (const f of window.__vaProbe) {
          const over = f.maxScroll !== null && f.page > f.maxScroll + 4;
          if (over) frames += 1;
          run = over ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
        return { frames, longest };
      });
      const before = await probe(s.page);
      for (let i = 0; i < 4; i += 1) {
        await push(s, device);
        await sleep(device === "desktop" ? 900 : 1100);
      }
      const after = await probe(s.page);
      const inside = await s.page.evaluate(() => {
        const f = window.__vaProbe.at(-1);
        return f.maxScroll === null || f.page <= f.maxScroll + 4;
      });
      report(
        `${device} ${lang} trap (${name}): the page is back at the wall within a frame, and she drives on`,
        past.longest <= 1 && inside && (after.p > before.p || after.p === 1),
        { past, before: before.p, after: after.p, inside },
      );
      await s.close();
    }
  },

  async stroke(device, lang) {
    // A finger's stroke stays gated and a resting thumb is still (gate.ts
    // Stroke, SmoothScroll): moves with nothing vertical in them (a pressure
    // change, a tremble Chrome coalesced) never hand the stroke to the
    // browser's own scrolling, and a thumb trembling on the glass while a
    // line is read never reads as going back.
    if (device !== "mobile") return;
    const s = await session(device, lang);
    await sleep(1500);
    await s.page.evaluate(() => {
      const moves = (window.__moves = []);
      window.addEventListener("touchmove", (e) => moves.push(e.cancelable), { capture: true, passive: true });
    });
    /** Touch points [ms, type, y, force] at wall-clock times, without waiting for the page. */
    const script = async (points) => {
      const start = Date.now();
      const sent = [];
      for (const [t, type, y, force = 1] of points) {
        const wait = start + t - Date.now();
        if (wait > 0) await sleep(wait);
        const touchPoints = type === "touchEnd" ? [] : [{ x: 195, y, force, radiusX: 10, radiusY: 10 }];
        sent.push(s.cdp.send("Input.dispatchTouchEvent", { type, touchPoints }).catch(() => {}));
      }
      await Promise.all(sent);
    };
    /** Onto line `card` just after it came up, so it plays for a while yet. */
    const onto = async (card) => {
      await reachCard(s, device, card);
      for (let i = 0; i < 40; i += 1) {
        const f = await probe(s.page);
        if (f.active >= card && f.read > 0.03) return f;
        await sleep(100);
      }
      return probe(s.page);
    };
    const since = (t0) =>
      s.page.evaluate((t0) => {
        const frames = window.__vaProbe.filter((f) => f.t >= t0);
        return {
          frames: frames.length,
          past: frames.filter((f) => f.maxScroll !== null && f.page > f.maxScroll + 4).length,
          reverse: frames.filter((f) => f.mode === "reverse").length,
          hidden: frames.filter((f) => f.active < 0).length,
          read: frames.length ? frames.at(-1).read : null,
        };
      }, t0);

    // A thumb resting on the glass after a calm swipe, trembling by 1 px for 3 s.
    let start = await onto(1);
    let t0 = await s.page.evaluate(() => performance.now());
    const rest = [[0, "touchStart", 640]];
    for (let i = 1; i <= 9; i += 1) rest.push([i * 16, "touchMove", 640 - (60 * i) / 9]);
    for (let t = 160, k = 0; t < 3160; t += 16, k += 1) rest.push([t, "touchMove", 580 + (k % 2 ? 0.5 : -0.5)]);
    rest.push([3170, "touchEnd"]);
    await script(rest);
    let r = await since(t0 + 300);
    report(
      `${device} ${lang} stroke: a thumb trembling on the glass while a line is read is still (no REVERSE, the line stays up and is read)`,
      r.reverse === 0 && r.hidden === 0 && (r.read >= 1 || r.read >= start.read + 0.2),
      { ...r, readAtStart: start.read },
    );

    // A swipe back, then the thumb left on the glass, trembling and rolling 7 px back as its pad
    // flattens: rest, not REVERSE (gate.ts Stroke: it comes to rest and lands still again).
    start = await onto(2);
    t0 = await s.page.evaluate(() => performance.now());
    const back = [[0, "touchStart", 400]];
    for (let i = 1; i <= 9; i += 1) back.push([i * 16, "touchMove", 400 + (200 * i) / 9]);
    for (let t = 160, k = 0; t < 3160; t += 16, k += 1) back.push([t, "touchMove", 600 + Math.min(1, (t - 160) / 1500) * 7 + (k % 2 ? 1 : -1)]);
    back.push([3170, "touchEnd"]);
    await script(back);
    r = await since(t0 + 160 + 150 + 250 + 100);
    const restP = await s.page.evaluate((from) => {
      const frames = window.__vaProbe.filter((f) => f.t >= from && f.t <= from + 2400);
      return { swept: frames.length ? Math.max(...frames.map((f) => f.p)) - Math.min(...frames.map((f) => f.p)) : null, rewinding: frames.filter((f) => f.rewinding).length };
    }, t0 + 660);
    report(
      `${device} ${lang} stroke: after a swipe back, a thumb resting (trembling, rolling) on the glass is rest, not REVERSE`,
      r.frames > 0 && r.reverse === 0 && restP.rewinding === 0 && restP.swept !== null && restP.swept * 5 * 844 < 2,
      { ...r, ...restP, startActive: start.active },
    );

    // Zero moves mid-stroke: a drag that pauses on a pressure change, and one
    // that pauses on a tremble (coalesced moves), then drags on hard and flicks off.
    const drags = {
      pressure: () => {
        const p = [[0, "touchStart", 700]];
        for (let i = 1; i <= 6; i += 1) p.push([i * 16, "touchMove", 700 - i * 50]);
        p.push([130, "touchMove", 400, 0.6]);
        for (let i = 1; i <= 10; i += 1) p.push([130 + i * 16, "touchMove", 400 - i * 50, 0.6]);
        p.push([310, "touchEnd"]);
        return p;
      },
      tremble: () => {
        const p = [[0, "touchStart", 700]];
        for (let i = 1; i <= 5; i += 1) p.push([i * 16, "touchMove", 700 - i * 50]);
        let t = 90;
        for (let k = 0; k < 25; k += 1, t += 16) p.push([t, "touchMove", 450 + (k % 2 ? 3 : -3)]);
        for (let i = 1; i <= 8; i += 1) p.push([t + i * 14, "touchMove", 450 - i * 70]);
        p.push([t + 8 * 14 + 6, "touchEnd"]);
        return p;
      },
    };
    let card = Math.max(3, (await probe(s.page)).active + 1);
    for (const [name, make] of Object.entries(drags)) {
      start = await onto(card);
      await s.page.evaluate(() => (window.__moves.length = 0));
      t0 = await s.page.evaluate(() => performance.now());
      await script(make());
      await sleep(2000);
      r = await since(t0);
      const moves = await s.page.evaluate(() => ({ all: window.__moves.length, uncancelable: window.__moves.filter((c) => !c).length }));
      report(
        `${device} ${lang} stroke: a drag that pauses (${name}) stays gated: every move cancelable, never past the wall, never REVERSE`,
        moves.all > 0 && moves.uncancelable === 0 && r.past === 0 && r.reverse === 0,
        { ...moves, ...r },
      );
      card = Math.max(card, (await probe(s.page)).active) + 1;
    }
    await s.close();
  },

  async pinch(device, lang) {
    // Two fingers on the picture are the browser's pinch zoom, never a stroke: nothing cancels their
    // moves, the film and the page stay where they are, no line plays and the radio stays shut.
    if (device !== "mobile") return;
    const s = await session(device, lang);
    await sleep(1500);
    await reachCard(s, device, 1);
    for (let i = 0; i < 30 && !(await s.page.evaluate(() => !!document.querySelector("[data-card][data-ready]"))); i += 1) await sleep(400);
    await s.page.evaluate(() => {
      const log = (window.__pinch = { moves: 0, cancelled: 0 });
      // After Lenis' and the gate's own listeners: what they did to each move.
      window.addEventListener("touchmove", (e) => {
        log.moves += 1;
        if (e.defaultPrevented) log.cancelled += 1;
      });
    });
    const before = { ...(await probe(s.page)), y: await s.page.evaluate(() => scrollY), scale: await s.page.evaluate(() => visualViewport.scale) };
    const finger = (t, spread) => [
      { x: 195 - spread, y: 480 + t, id: 0 },
      { x: 195 + spread, y: 520 - t, id: 1 },
    ];
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger(0, 30)[0]] });
    await sleep(40);
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: finger(0, 30) });
    for (let i = 1; i <= 20; i += 1) {
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: finger(i * 2, 30 + i * 6) });
      await sleep(20);
    }
    await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(1500);
    const after = { ...(await probe(s.page)), y: await s.page.evaluate(() => scrollY), scale: await s.page.evaluate(() => visualViewport.scale) };
    const log = await s.page.evaluate(() => window.__pinch);
    const opened = await wheelOpen(s.page);
    report(
      `${device} ${lang} pinch: two fingers on the picture are the browser's zoom: no move cancelled, the film stays, no line, no radio`,
      log.moves > 0 && log.cancelled === 0 && Math.abs(after.p - before.p) < 1e-4 && after.active === before.active && !opened,
      { ...log, p: [before.p, after.p], active: [before.active, after.active], scale: [before.scale, after.scale], opened },
    );
    await s.close();
  },

  async ends(device, lang) {
    // Ctrl+End and Ctrl+Home (Cmd+Down and Cmd+Up on a Mac) are the page's
    // own animated jumps to its ends: in the hero they act as End (Skip) and
    // Home, so no frame shows the page past the wall on the way.
    if (device !== "desktop") return;
    const pastFrames = (s, t0) =>
      s.page.evaluate((t0) => window.__vaProbe.filter((f) => f.t >= t0 && f.maxScroll !== null && f.page > f.maxScroll + 4).length, t0);
    for (const [key, name] of [
      ["Control+End", "Ctrl+End"],
      ["Meta+ArrowDown", "Cmd+Down"],
    ]) {
      const s = await session(device, lang);
      await sleep(1500);
      await reachCard(s, device, 1);
      const t0 = await s.page.evaluate(() => performance.now());
      await s.page.keyboard.press(key);
      await sleep(1200);
      const past = await pastFrames(s, t0);
      const end = await s.page.evaluate(() => ({
        suspectsTop: Math.round(document.getElementById("suspects").getBoundingClientRect().top),
        focus: document.activeElement?.id,
        frontier: window.__vaProbe.at(-1).frontier,
      }));
      report(
        `${device} ${lang} ends: ${name} mid-film cuts to THE USUAL SUSPECTS like End, never showing the page past the wall`,
        past === 0 && Math.abs(end.suspectsTop) <= 1 && end.focus === "suspects" && end.frontier === null,
        { past, ...end },
      );
      await s.close();
    }
    for (const [key, name] of [
      ["Control+Home", "Ctrl+Home"],
      ["Meta+ArrowUp", "Cmd+Up"],
    ]) {
      const s = await session(device, lang);
      await sleep(1500);
      await reachCard(s, device, 2);
      const t0 = await s.page.evaluate(() => performance.now());
      await s.page.keyboard.press(key);
      await sleep(1500);
      const past = await pastFrames(s, t0);
      const y = await s.page.evaluate(() => Math.round(scrollY));
      report(`${device} ${lang} ends: ${name} mid-film glides back to the top of the hero like Home`, past === 0 && y <= 1, { past, y });
      await s.close();
    }
  },

  async escape(device, lang) {
    // Esc twice quickly (or End twice, or held) cuts to THE USUAL SUSPECTS and no further; Esc while
    // the radio is open only closes it, and an Esc right after that does not skip the film.
    if (device !== "desktop") return;
    const landed = (s) =>
      s.page.evaluate(() => ({
        suspectsTop: Math.round(document.getElementById("suspects").getBoundingClientRect().top),
        focus: document.activeElement?.id,
      }));
    for (const [name, press] of [
      ["Esc twice", async (s) => { await s.page.keyboard.press("Escape"); await sleep(90); await s.page.keyboard.press("Escape"); }],
      ["End twice", async (s) => { await s.page.keyboard.press("End"); await sleep(90); await s.page.keyboard.press("End"); }],
      ["Esc then End", async (s) => { await s.page.keyboard.press("Escape"); await sleep(150); await s.page.keyboard.press("End"); }],
      ["Esc held", async (s) => {
        await s.page.keyboard.down("Escape");
        for (let i = 0; i < 8; i += 1) { await sleep(40); await s.page.keyboard.down("Escape"); }
        await s.page.keyboard.up("Escape");
      }],
    ]) {
      const s = await session(device, lang);
      await sleep(1500);
      await reachCard(s, device, 1);
      await press(s);
      await sleep(1200);
      const r = await landed(s);
      report(`${device} ${lang} escape: ${name}, quickly, cuts to THE USUAL SUSPECTS and no further`, Math.abs(r.suspectsTop) <= 1 && r.focus === "suspects", r);
      await s.close();
    }
    const s = await session(device, lang);
    await sleep(1500);
    await reachCard(s, device, 1);
    const before = await probe(s.page);
    // Q pressed and let go opens the wheel to browse; the focus is in it.
    await s.page.keyboard.press("q");
    await sleep(500);
    const opened = await wheelOpen(s.page);
    await s.page.keyboard.press("Escape");
    await sleep(120);
    const closed = !(await wheelOpen(s.page));
    await s.page.keyboard.press("Escape");
    await sleep(1000);
    const after = await probe(s.page);
    const r = await landed(s);
    // Open again with the focus left outside it (on the page): Esc still only closes it.
    await s.page.keyboard.press("q");
    await sleep(500);
    await s.page.evaluate(() => document.activeElement?.blur());
    const reopened = await wheelOpen(s.page);
    await s.page.keyboard.press("Escape");
    await sleep(600);
    const outside = { closed: !(await wheelOpen(s.page)), p: (await probe(s.page)).p };
    report(
      `${device} ${lang} escape: Esc with the radio open only closes it, and an Esc right after does not skip the film`,
      opened && closed && after.p < 0.999 && Math.abs(after.p - before.p) < 0.02 && r.suspectsTop > 100 && reopened && outside.closed && outside.p < 0.999,
      { opened, closed, before: before.p, after: after.p, suspectsTop: r.suspectsTop, reopened, outside },
    );
    await s.close();
  },

  async navigate(device, lang) {
    // Every in-page move goes through one path (lib/navigate.ts): Lenis and
    // the page land together, and a page sent past the hero opens its walls,
    // so her next notch or swipe goes on from where she landed, never back
    // up to the hero's end.
    const W = DEVICES[device].viewport.width;
    const H = DEVICES[device].viewport.height;
    const notch = (s) => (device === "desktop" ? s.page.mouse.wheel(0, 100) : stroke(s.cdp, { dy: 80, ms: 90, y0: H * 0.7, x: W / 2 }));
    const top = (s, id) => s.page.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().top), id);
    /** Where an in-page link lands a section's top (lib/navigate.ts landingY): the page controls' scroll-padding plus its own scroll-margin (a chapter card above it). */
    const rest = (s, id) =>
      s.page.evaluate((id) => {
        const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        const margin = Number.parseFloat(getComputedStyle(document.getElementById(id)).scrollMarginTop) || 0;
        return Math.round(padding + margin);
      }, id);
    const state = (s) =>
      s.page.evaluate(() => {
        const f = window.__vaProbe.at(-1);
        return { y: Math.round(scrollY), frontier: f?.frontier ?? null, focus: document.activeElement?.id || document.activeElement?.tagName };
      });
    /** Her own input until `ready` holds (the page's own scrolling, never a native jump of the check). */
    const driveUntil = async (s, ready) => {
      for (let i = 0; i < 60 && !(await ready()); i += 1) {
        await notch(s);
        await sleep(device === "desktop" ? 250 : 450);
      }
      await sleep(900);
    };

    // The STATS booth (a link to #projects), reached by her own input after Skip.
    const s = await session(device, lang);
    await sleep(1200);
    if (device === "desktop") await s.page.mouse.move(W / 2, H / 2);
    await s.page.keyboard.press("End");
    await sleep(700);
    const booth = s.page.locator(device === "desktop" ? 'a[href="#projects"] [class*="marker"]' : 'a[href="#projects"]').first();
    await driveUntil(s, async () => {
      const box = await booth.boundingBox();
      return box !== null && box.y > 80 && box.y + box.height < H - 60;
    });
    const was = await s.page.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
    if (device === "desktop") await booth.click();
    else await booth.tap();
    await sleep(900);
    const landed = { projects: await top(s, "projects"), rest: await rest(s, "projects"), ...(await state(s)) };
    await notch(s);
    await sleep(1500);
    const after = { projects: await top(s, "projects"), ...(await state(s)) };
    report(
      `${device} ${lang} navigate: the booth lands on the cinema with the walls open, and her next ${device === "desktop" ? "notch" : "swipe"} goes on from there`,
      Math.abs(landed.projects - landed.rest) <= 2 &&
        landed.frontier === null &&
        landed.focus === "projects" &&
        after.y >= landed.y &&
        after.y - landed.y <= H,
      { landed, after },
    );

    // The browser's Back: where she was when she followed the booth, the address as it was; Forward:
    // the cinema again. Never a dead Back (lib/navigate.ts pushFragment, PageEntry's popstate).
    const linked = await s.page.evaluate(() => location.hash);
    await s.page.evaluate(() => history.back());
    await sleep(1200);
    const backed = { ...(await state(s)), hash: await s.page.evaluate(() => location.hash) };
    await notch(s);
    await sleep(1200);
    const backedOn = await state(s);
    await s.page.evaluate(() => history.forward());
    await sleep(1200);
    const forward = { projects: await top(s, "projects"), hash: await s.page.evaluate(() => location.hash) };
    report(
      `${device} ${lang} navigate: Back after the booth returns to where she was in STATS, her next ${device === "desktop" ? "notch" : "swipe"} goes on from there, and Forward goes back to the cinema`,
      linked === "#projects" &&
        Math.abs(backed.y - was.y) <= 2 &&
        backed.hash === was.hash &&
        backed.frontier === null &&
        backedOn.y >= backed.y &&
        backedOn.y - backed.y <= H &&
        Math.abs(forward.projects - landed.rest) <= 2 &&
        forward.hash === "#projects",
      { was, linked, backed, backedOn, forward },
    );

    // The cinema's booth (a link to the credits' #contact), then Back: the cinema again.
    // Where she is when she follows it: the booth in view, so the click itself moves nothing.
    await s.page.evaluate(() => document.querySelector('#projects a[href="#contact"]').scrollIntoView({ block: "center" }));
    await sleep(800);
    const cinemaY = await s.page.evaluate(() => Math.round(scrollY));
    const toCredits = s.page.locator('#projects a[href="#contact"]').first();
    if (device === "desktop") await toCredits.click();
    else await toCredits.tap();
    await sleep(900);
    const credits = { contact: await top(s, "contact"), hash: await s.page.evaluate(() => location.hash) };
    await s.page.evaluate(() => history.back());
    await sleep(1200);
    const cinemaAgain = { ...(await state(s)), hash: await s.page.evaluate(() => location.hash) };
    report(
      `${device} ${lang} navigate: the cinema's booth to the credits, then Back: the cinema again, where she was`,
      credits.hash === "#contact" && Math.abs(cinemaAgain.y - cinemaY) <= 2 && cinemaAgain.hash !== "#contact",
      { cinemaY, credits, cinemaAgain },
    );

    // Her next scroll before the page's next frame (a slow phone): a notch right after the click.
    await s.page.evaluate(() => {
      window.history.replaceState(null, "", window.location.pathname);
      document.getElementById("stats").scrollIntoView({ block: "start" });
    });
    await sleep(800);
    const raced = await s.page.evaluate(
      () =>
        new Promise((resolve) => {
          let sent = false;
          const send = () => {
            if (sent) return;
            sent = true;
            window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true }));
          };
          window.addEventListener("hashchange", send, { once: true });
          document.querySelector('a[href="#projects"]').click();
          setTimeout(send, 0);
          setTimeout(() => resolve(Math.round(document.getElementById("projects").getBoundingClientRect().top)), 1500);
        }),
    );
    report(`${device} ${lang} navigate: a notch before the next frame after the booth stays in the cinema`, raced <= 64 && raced >= -200, { projectsTop: raced });

    // A native move nobody routed (the scrollbar, find in page) and a notch in the same task, before
    // Lenis hears the scroll event: the notch goes on from where the page is.
    const native = await s.page.evaluate(
      () =>
        new Promise((resolve) => {
          const stats = document.getElementById("stats");
          const from = Math.round(scrollY);
          stats.scrollIntoView({ block: "start" });
          const to = Math.round(scrollY);
          window.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, deltaMode: 0, bubbles: true, cancelable: true }));
          setTimeout(() => resolve({ from, to, after: Math.round(scrollY) }), 1500);
        }),
    );
    report(
      `${device} ${lang} navigate: a native move and a notch before the next frame: the notch goes on from where the page is`,
      Math.abs(native.after - (native.to + 100)) <= 2,
      native,
    );

    // STATS's tabs: the STATS tab, then a notch.
    await s.page.evaluate(() => document.getElementById("stats").scrollIntoView({ block: "start" }));
    await sleep(800);
    const tab = s.page.locator('#stats [role="tab"]').nth(1);
    if (device === "desktop") await tab.click();
    else await tab.tap();
    await sleep(500);
    const tabbed = await state(s);
    await notch(s);
    await sleep(1500);
    const tabAfter = await state(s);
    report(
      `${device} ${lang} navigate: a STATS tab, then a ${device === "desktop" ? "notch" : "swipe"}: she stays in STATS`,
      tabAfter.y >= tabbed.y && tabAfter.y - tabbed.y <= H && (await s.page.evaluate(() => window.location.hash)) === "#stats-sheet",
      { tabbed, tabAfter },
    );

    // Back to top from the credits, then a notch: she stays at the top.
    await s.page.evaluate(() => document.getElementById("contact").scrollIntoView({ block: "end" }));
    await sleep(800);
    const back = s.page.locator('#credits a[href="#main"], #contact a[href="#main"]').last();
    if (device === "desktop") await back.click();
    else await back.tap();
    await sleep(2200);
    const atTop = { ...(await state(s)), url: await s.page.evaluate(() => location.pathname + location.search + location.hash) };
    await notch(s);
    await sleep(1500);
    const topAfter = await state(s);
    // The address names no section any more: a reload starts at the top, never in the cinema.
    report(
      `${device} ${lang} navigate: back to top lands at the top on the title, clears the old #fragment, and her next ${device === "desktop" ? "notch" : "swipe"} stays there`,
      atTop.y <= 1 && atTop.focus === "hero-title" && atTop.url === `/${lang}` && topAfter.y >= 0 && topAfter.y <= H / 2,
      { atTop, topAfter },
    );
    await s.close();

    // A deep link, then a notch.
    const d = await session(device, lang, { hash: "#contact" });
    await sleep(1200);
    const deep = {
      contact: await top(d, "contact"),
      rest: await rest(d, "contact"),
      limit: await d.page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
      ...(await state(d)),
    };
    await notch(d);
    await sleep(1500);
    const deepAfter = { contact: await top(d, "contact"), ...(await state(d)) };
    report(
      `${device} ${lang} navigate: /${lang}#contact lands on the contact with the walls open, and her next ${device === "desktop" ? "notch" : "swipe"} stays there`,
      // Where a link lands it (its scroll-margin clears the credits' fade), or as near as the foot of the page allows.
      deep.frontier === null &&
        deep.focus === "contact" &&
        (Math.abs(deep.contact - deep.rest) <= 2 || deep.y >= deep.limit - 1) &&
        deepAfter.y >= deep.y - 1 &&
        deepAfter.contact > -H,
      { deep, deepAfter },
    );
    await d.close();
  },

  async pedal(device, lang) {
    const box = (page) =>
      page.evaluate(() => {
        const r = document.querySelector("[data-pedal]").getBoundingClientRect();
        // The plate's middle: the button's hit area reaches 1.25em left and 1em up of it.
        return { x: r.right - r.width * 0.4, y: r.top + r.height * 0.5 };
      });
    const frameOf = (page) =>
      page.evaluate(() => {
        const f = window.__vaProbe.at(-1);
        return f && { p: f.p, down: f.pedalDown, target: f.lenisTarget, active: f.active, page: f.page, max: f.maxScroll, show: f.show };
      });
    /**
     * Frames from the press reaching the page (`pointerdown` dispatched) to the first probe frame
     * that answers it: the pedal down and the strip's flare. A frame already under way when the
     * press arrived cannot answer it; how long the press took to reach the page (its own
     * timeStamp to its dispatch: the input pipeline, and any long task of the page's) is `lag`.
     */
    const answer = (page) =>
      page.evaluate(() => {
        const { stamp, run } = window.__down;
        const after = window.__vaProbe.filter((f) => f.t >= Math.max(stamp, run) - 1);
        const i = after.findIndex((f) => f.pedalDown && f.kick >= 0.95);
        return i < 0 ? null : { frames: i + 1, ms: Math.round(after[i].t - stamp), lag: Math.round(run - stamp) };
      });
    const armDown = (page) =>
      page.evaluate(() => {
        window.__down = { stamp: Infinity, run: Infinity };
        window.addEventListener("pointerdown", (e) => (window.__down = { stamp: e.timeStamp, run: performance.now() }), { capture: true, once: true });
      });
    /** Answered in the next frame, and the press was never held up by the page for a frame and more. */
    const prompt = (fast) => fast !== null && fast.frames <= 2 && fast.lag < 34;

    if (device === "mobile") {
      // A thumb held on the pedal: it drives at once, no radio ring, no menu, no selection.
      const s = await session(device, lang);
      await sleep(1800);
      await s.page.evaluate(() => window.__vaJump(0.2));
      await sleep(2500);
      const at = await box(s.page);
      await armDown(s.page);
      await s.page.evaluate(() => (window.__vaProbe.length = 0));
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y, id: 0 }] });
      await sleep(1200);
      const menu = await s.page.evaluate(() => {
        const el = document.querySelector("[data-pedal]");
        const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
        el.dispatchEvent(event);
        return event.defaultPrevented;
      });
      const held = await frameOf(s.page);
      const ring = await s.page.evaluate(() => document.querySelector("[data-armed='true']") !== null);
      const selection = await s.page.evaluate(() => window.getSelection()?.isCollapsed ?? true);
      const fast = await answer(s.page);
      // A second finger swipes the picture while the thumb wiggles on the pedal: nothing jumps back.
      await s.page.evaluate(() => (window.__vaProbe.length = 0));
      for (let i = 0; i < 14; i += 1) {
        const wiggle = i % 2 ? 3 : -3;
        const second = i === 0 ? "touchStart" : "touchMove";
        await s.cdp.send("Input.dispatchTouchEvent", {
          type: second,
          touchPoints: [
            { x: at.x + wiggle, y: at.y, id: 0 },
            { x: 150, y: 600 - i * 24, id: 1 },
          ],
        });
        await sleep(16);
      }
      await sleep(300);
      const twoFingers = await s.page.evaluate(() => {
        let drops = 0;
        let back = 0;
        const frames = window.__vaProbe;
        for (let i = 1; i < frames.length; i += 1) {
          if (frames[i].lenisTarget < frames[i - 1].lenisTarget - 0.5) drops += 1;
          if (frames[i].p < frames[i - 1].p - 1e-6) back += 1;
        }
        return { drops, back, frames: frames.length, down: frames.at(-1)?.pedalDown };
      });
      const past = await s.page.evaluate(() => window.__vaProbe.filter((f) => f.maxScroll !== null && f.page > f.maxScroll + 4).length);
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(400);
      const after = await frameOf(s.page);
      await sleep(300);
      const settled = await frameOf(s.page);
      report(`${device} ${lang} pedal: a thumb on it drives within a frame, never arms the radio, no menu, no selection`,
        prompt(fast) && held.down && !ring && menu && selection,
        { fast, down: held.down, ring, menu, selection });
      report(`${device} ${lang} pedal: a second finger swiping beside the thumb never jumps the picture back`,
        twoFingers.drops === 0 && twoFingers.back === 0 && twoFingers.down && past === 0, { ...twoFingers, past });
      report(`${device} ${lang} pedal: lifting the thumb lets go, and the picture stops`,
        !after.down && Math.abs(settled.p - after.p) * 5 * 844 < 3, { after: after.p, settled: settled.p });
      // A tap at the very end glides on into THE USUAL SUSPECTS.
      await s.page.evaluate(() => window.__vaJump(1));
      await sleep(1200);
      // The way on names the pedal there, so the pedal stands over the fade to night, not under it.
      const night = await s.page.evaluate(() => {
        const pedal = document.querySelector("[data-pedal]");
        const fade = document.querySelector("[data-fade]");
        const z = (el) => Number(getComputedStyle(el).zIndex) || 0;
        const later = (fade.compareDocumentPosition(pedal) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        return {
          fade: Number(getComputedStyle(fade).opacity),
          shown: pedal.dataset.vis === "shown" && getComputedStyle(pedal).visibility === "visible",
          above: z(pedal) > z(fade) || (z(pedal) === z(fade) && later),
        };
      });
      report(`${device} ${lang} pedal: at the end of the drive it stands over the night, where the way on names it`,
        night.fade > 0.9 && night.shown && night.above, night);
      const end = await box(s.page);
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: end.x, y: end.y }] });
      await sleep(90);
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(2200);
      const cats = await s.page.evaluate(() => Math.round(document.getElementById("suspects").getBoundingClientRect().top));
      const gone = await s.page.evaluate(() => document.querySelector("[data-pedal]").dataset.vis);
      report(`${device} ${lang} pedal: a press at the end of the drive glides into THE USUAL SUSPECTS, and the pedal goes`,
        Math.abs(cats) <= 4 && gone === "hidden", { cats, gone });
      // Held to the end: the way on comes up under her thumb, then the pedal still held goes on.
      await s.page.evaluate(() => window.__vaJump(0.97));
      await sleep(800);
      const near = await box(s.page);
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: near.x, y: near.y, id: 0 }] });
      const log = [];
      const t0 = Date.now();
      while (Date.now() - t0 < 4500) {
        log.push(
          await s.page.evaluate(() => {
            const f = window.__vaProbe.at(-1);
            const cue = document.querySelector("[data-end-cue]");
            return {
              t: performance.now(),
              p: f.p,
              down: f.pedalDown,
              cue: cue.hasAttribute("data-visible"),
              cats: Math.round(document.getElementById("suspects").getBoundingClientRect().top),
            };
          }),
        );
        await sleep(100);
      }
      await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      const arrived = log.find((f) => f.p >= 0.999);
      const cue = log.find((f) => f.cue && f.down);
      report(`${device} ${lang} pedal: held to the end, the way on comes up under her thumb, then she goes on into THE USUAL SUSPECTS`,
        Boolean(arrived && cue) && cue.t - arrived.t < 1200 && Math.abs(log.at(-1).cats) <= 4,
        { arrived: Boolean(arrived), cueAfter: cue && arrived ? Math.round(cue.t - arrived.t) : null, cats: log.at(-1).cats });
      await s.close();
      const r = await session(device, lang, { reducedMotion: "reduce" });
      await sleep(1500);
      const shownStill = await r.page.evaluate(() => getComputedStyle(document.querySelector("[data-pedal]")).display !== "none");
      report(`${device} ${lang} pedal: there is no pedal under reduced motion`, !shownStill, {});
      await r.close();
      return;
    }

    // Desktop: the mouse held and slid off, W held with its autorepeat, Space tapped and held.
    const s = await session(device, lang);
    await sleep(1800);
    await s.page.evaluate(() => window.__vaJump(0.2));
    await sleep(2500);
    const at = await box(s.page);
    await s.page.mouse.move(at.x, at.y);
    await armDown(s.page);
    await s.page.evaluate(() => (window.__vaProbe.length = 0));
    await s.page.mouse.down();
    await sleep(300);
    await s.page.mouse.move(700, 300, { steps: 5 });
    await sleep(900);
    const slid = await frameOf(s.page);
    const fast = await answer(s.page);
    const focused = await s.page.evaluate(() => document.activeElement?.hasAttribute("data-pedal") ?? false);
    await s.page.mouse.up();
    await sleep(250);
    const up = await frameOf(s.page);
    report(`${device} ${lang} pedal: the mouse held on it drives within a frame, stays down slid off it, takes no focus`,
      prompt(fast) && slid.down && !focused, { fast, slid: slid.down, focused });
    report(`${device} ${lang} pedal: the mouse up lets go`, !up.down, {});

    // W held, with the autorepeat a held key sends: it drives; a lost keyup is caught.
    const holdW = async (ms, { up = true } = {}) => {
      await s.page.keyboard.down("w");
      const until = Date.now() + ms;
      while (Date.now() < until) {
        await sleep(33);
        await s.page.keyboard.down("w");
      }
      if (up) await s.page.keyboard.up("w");
    };
    await s.page.evaluate(() => window.__vaJump(0.2));
    await sleep(1500);
    const w0 = await frameOf(s.page);
    await holdW(2500, { up: false });
    const w1 = await frameOf(s.page);
    // The keyup never comes: the autorepeat stops and within 0.7 s the pedal lets go.
    await sleep(700);
    const lost = await frameOf(s.page);
    await s.page.keyboard.up("w");
    report(`${device} ${lang} pedal: W held drives on through its autorepeat, and a lost keyup is caught within 0.7 s`,
      w1.down && w1.p > w0.p + 0.01 && !lost.down, { from: w0.p, to: w1.p, lostDown: lost.down });
    // A window blur lets go.
    await s.page.keyboard.down("w");
    await sleep(400);
    const beforeBlur = await frameOf(s.page);
    await s.page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await sleep(100);
    const blurred = await frameOf(s.page);
    await s.page.keyboard.up("w");
    report(`${device} ${lang} pedal: a window blur lets go of a held W`, beforeBlur.down && !blurred.down, {});
    // Q while W is held: the radio opens and the pedal lets go.
    await sleep(600);
    await s.page.keyboard.down("w");
    await sleep(400);
    await s.page.keyboard.down("q");
    await sleep(300);
    const radio = await frameOf(s.page);
    const opened = await wheelOpen(s.page);
    await s.page.keyboard.up("q");
    await s.page.keyboard.up("w");
    await sleep(200);
    await s.page.keyboard.press("Escape");
    await sleep(600);
    report(`${device} ${lang} pedal: Q while W is held opens the radio and lets go of the pedal`, opened && !radio.down, { opened, down: radio.down });

    // Space: a tap plays exactly the next line; held, it drives on after it.
    const fromReadLine = async () => {
      await s.page.evaluate(() => window.__vaJump(0.2));
      await sleep(400);
      await s.page.mouse.wheel(0, 100);
      for (let i = 0; i < 40; i += 1) {
        const f = await s.page.evaluate(() => window.__vaProbe.at(-1));
        if (f.ready) break;
        await sleep(250);
      }
      return frameOf(s.page);
    };
    const t0 = await fromReadLine();
    await s.page.keyboard.press("Space");
    await sleep(2500);
    const tapped = await frameOf(s.page);
    const h0 = await fromReadLine();
    await s.page.keyboard.down("Space");
    const until = Date.now() + 2500;
    while (Date.now() < until) {
      await sleep(33);
      await s.page.keyboard.down("Space");
    }
    const holding = await frameOf(s.page);
    await s.page.keyboard.up("Space");
    report(`${device} ${lang} pedal: a tap of Space plays exactly the next line, a hold drives on after it`,
      tapped.active === t0.active + 1 && !tapped.down && holding.down && holding.p > h0.p + (tapped.p - t0.p) + 0.003,
      { tap: [t0.active, tapped.active, +(tapped.p - t0.p).toFixed(4)], hold: +(holding.p - h0.p).toFixed(4) });

    // W held through a tap of S: back, then on again; never FLAT OUT over a still picture.
    await s.page.evaluate(() => window.__vaJump(1));
    await sleep(200);
    await s.page.evaluate(() => window.__vaJump(0.4));
    await sleep(800);
    const series = [];
    await s.page.keyboard.down("w");
    const w0t = Date.now();
    let tappedS = false;
    while (Date.now() - w0t < 4000) {
      await s.page.keyboard.down("w");
      if (!tappedS && Date.now() - w0t > 1000) {
        await s.page.keyboard.press("s");
        tappedS = true;
      }
      series.push({ t: Date.now() - w0t, ...(await s.page.evaluate(() => { const f = window.__vaProbe.at(-1); return { p: f.p, suspended: f.pedalSuspended, show: f.show }; })) });
      await sleep(60);
    }
    await s.page.keyboard.up("w");
    const atS = series.find((f) => f.t > 1000);
    const low = Math.min(...series.filter((f) => f.t > 1000 && f.t < 2000).map((f) => f.p));
    const stillFloored = series.filter((f, i) => i > 0 && f.suspended && f.show === "floored" && Math.abs(f.p - series[i - 1].p) < 1e-5).length;
    report(`${device} ${lang} pedal: W held through a tap of S goes back, then drives on, never FLAT OUT over a still picture`,
      low < atS.p && series.at(-1).p > atS.p + 0.01 && stillFloored === 0, { atS: atS.p, low, end: series.at(-1).p, stillFloored });

    // Space on the focused pedal at the end: the glide lands on THE USUAL SUSPECTS with the focus there, and Space scrolls on.
    await s.page.evaluate(() => window.__vaJump(1));
    await sleep(1200);
    await s.page.evaluate(() => document.querySelector("[data-pedal]").focus());
    await s.page.keyboard.press("Space");
    await sleep(1800);
    const landed = await s.page.evaluate(() => ({ y: scrollY, cats: Math.round(document.getElementById("suspects").getBoundingClientRect().top), focus: document.activeElement?.id }));
    await s.page.keyboard.press("Space");
    await sleep(800);
    const on = await s.page.evaluate(() => scrollY);
    report(`${device} ${lang} pedal: Space on the focused pedal at the end lands on THE USUAL SUSPECTS with the focus, and Space scrolls on`,
      Math.abs(landed.cats) <= 4 && landed.focus === "suspects" && on > landed.y + 100, { ...landed, on });
    await s.close();
  },

  async pedallayout(device, lang) {
    const SIZES =
      device === "mobile"
        ? [
            ["360x640", { width: 360, height: 640 }],
            ["390x844", { width: 390, height: 844 }],
            ["430x932", { width: 430, height: 932 }],
            ["844x390", { width: 844, height: 390 }],
            // A tablet keeps its dash.
            ["768x1024", { width: 768, height: 1024 }],
          ]
        : [
            ["1024x768", { width: 1024, height: 768 }],
            ["1440x900", { width: 1440, height: 900 }],
          ];
    for (const [name, viewport] of SIZES) {
      const touch = device === "mobile";
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch });
      await context.addInitScript(() => {
        try {
          localStorage.setItem("va-radio-hint", "seen");
        } catch {}
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/${lang}`, { waitUntil: "load" });
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: 240_000 });
      await page.locator('[data-loader] [data-enter="silent"]').click();
      await page.waitForSelector("[data-loader]", { state: "detached", timeout: 20_000 });
      await page.evaluate(() => (window.__vaProbe = []));
      await sleep(1500);
      const boxes = async () =>
        page.evaluate(() => {
          const box = (el, pad) => {
            if (!el) return null;
            const st = getComputedStyle(el);
            if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) < 0.05) return null;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) return null;
            return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), pad };
          };
          const card = document.querySelector("[data-card][data-active]");
          return {
            pedal: box(document.querySelector("[data-pedal] [class*='pedalBody']")),
            hit: box(document.querySelector("[data-pedal]")),
            skip: box(document.querySelector("[data-skip] button")),
            block: box(card?.querySelector("[data-card-text]")),
            marker: box(card?.querySelector("[class*='cueTail']")),
            dash: box(document.querySelector("[data-osd]")),
            hint: box(document.querySelector("[data-hint] [class*='hintBox']")),
            radio: box(document.querySelector("header button, [class*='wrap'] button")),
          };
        });
      // The title, with its hint up and Skip offering itself.
      await page.evaluate(() => document.querySelector("[data-skip]")?.setAttribute("data-expanded", ""));
      await sleep(400);
      const title = await boxes();
      // The longest card, read, its marker labelled, Skip offering itself.
      const longest = await page.evaluate(() => {
        let best = { p: 0, len: 0 };
        for (let p = 0.1; p < 0.93; p += 0.004) {
          window.__vaJump(p);
          const card = document.querySelector("[data-card][data-active]");
          const len = card ? card.textContent.length : 0;
          if (len > best.len) best = { p, len };
        }
        return best;
      });
      await page.evaluate((p) => window.__vaJump(p), longest.p);
      for (let i = 0; i < 60 && !(await page.evaluate(() => window.__vaProbe.at(-1)?.ready)); i += 1) await sleep(250);
      await page.evaluate(() => {
        document.querySelector("[data-skip]")?.setAttribute("data-expanded", "");
        document.querySelector("[data-card][data-active]")?.setAttribute("data-cue-label", "");
      });
      await sleep(500);
      const card = await boxes();
      const hit = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
      const clashes = [];
      for (const [label, set, pairs] of [
        ["title", title, [["hit", "skip"], ["pedal", "hint"], ["hit", "hint"], ["skip", "hint"], ["pedal", "dash"], ["pedal", "radio"]]],
        [
          "card",
          card,
          [["hit", "skip"], ["hit", "block"], ["hit", "marker"], ["pedal", "dash"], ["skip", "block"], ["skip", "marker"], ["pedal", "radio"], ["dash", "block"]],
        ],
      ]) {
        for (const [a, b] of pairs) if (hit(set[a], set[b])) clashes.push(`${label}:${a}/${b}`);
      }
      const shown = title.pedal && card.pedal && card.block && card.marker && title.skip;
      // A phone has no dash at all (dash.ts DASH_MEDIA.phone); desktops and tablets show it once she drives.
      const layout = await page.evaluate(() => window.__vaProbe.at(-1)?.layout);
      const phone = touch && (viewport.width < 600 || viewport.height <= 500);
      const dashOk = phone ? layout === "phone" && card.dash === null && title.dash === null : layout !== "phone" && card.dash !== null;
      report(`${device} ${lang} pedallayout ${name}: the pedal, Skip, the card, its marker, the dash and the hint never overlap${phone ? "; no dash on a phone" : ""}`,
        clashes.length === 0 && Boolean(shown) && dashOk, { clashes, layout, dash: card.dash, card, title: { pedal: title.pedal, hint: title.hint, skip: title.skip } });
      await context.close();
    }
  },

  async statics(device, lang) {
    // The static page (THE USUAL SUSPECTS to the end credits) follows her
    // input and nothing else: wheel notches, trackpad bursts and keys on a
    // desktop, swipes on a phone whose bars hide as she scrolls down and
    // come back as she scrolls up (the viewport's height changing with them,
    // every viewport unit too, as browsers that resize their web view do).
    // No section moves in the page, the page never moves against her input
    // or a screen in one frame, nothing scrolls it by script, and nothing
    // shifts. Reduced motion too on a phone (the still hero above, the
    // browser's own scrolling).
    const W = DEVICES[device].viewport.width;
    const H = DEVICES[device].viewport.height;
    const SHOWN = H - 74;
    for (const reducedMotion of device === "mobile" ? ["no-preference", "reduce"] : ["no-preference"]) {
      // On a phone she enters with a tap: a click would leave a mouse over the page, hovering what scrolls under it.
      const s = await session(device, lang, { reducedMotion, init: recordStatics, enter: device === "desktop" });
      if (device === "mobile") {
        await s.page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: 240_000 });
        await s.page.locator('[data-loader] [data-enter="silent"]').tap();
        await s.page.waitForSelector("[data-loader]", { state: "detached", timeout: 20_000 });
      }
      await sleep(1200);
      if (device === "desktop") await s.page.mouse.move(W / 2, H / 2);
      if (reducedMotion === "reduce") {
        // The still hero: her own scrolling takes her below it; the check starts at THE USUAL SUSPECTS.
        await s.page.evaluate(() => window.scrollTo(0, document.getElementById("suspects").getBoundingClientRect().top + scrollY));
      } else {
        await s.page.keyboard.press("End");
      }
      await sleep(1500);
      const start = await s.page.evaluate(() => ({
        y: scrollY,
        suspects: document.getElementById("suspects").getBoundingClientRect().top + scrollY,
        max: document.documentElement.scrollHeight - innerHeight,
      }));
      await s.page.evaluate(() => window.__statics.start());
      const y = () => s.page.evaluate(() => scrollY);
      let bars = "hidden";
      /** The bars follow her direction: hidden going down, shown going up (a phone only). */
      const barsFor = async (dir) => {
        if (device !== "mobile") return;
        const want = dir > 0 ? "hidden" : "shown";
        if (want === bars) return;
        bars = want;
        await s.page.setViewportSize({ width: W, height: want === "hidden" ? H : SHOWN });
      };
      /** A swipe whose bars change once the page moves the new way, mid-stroke. */
      const swipe = async (dy, ms) => {
        const steps = Math.max(3, Math.round(ms / 16));
        const y0 = dy > 0 ? Math.round(SHOWN * 0.78) : Math.round(SHOWN * 0.22);
        await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W / 2, y: y0 }] });
        for (let i = 1; i <= steps; i += 1) {
          await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W / 2, y: y0 - (dy * i) / steps }] });
          if (i === 2) await barsFor(Math.sign(dy));
          await sleep(ms / steps);
        }
        await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      };
      const keys = { down: ["PageDown", "ArrowDown", "Space", "ArrowDown"], up: ["PageUp", "ArrowUp", "Shift+Space", "ArrowUp"] };
      let k = 0;
      /** One of her inputs, `dir` 1 down, -1 up, by turns a notch, a burst of a trackpad or a key. */
      const input = async (dir, i) => {
        if (device === "mobile") {
          await swipe(dir * (180 + (i % 3) * 70), i % 2 ? 110 : 220);
          await sleep(380 + (i % 3) * 140);
        } else if (i % 3 === 0) {
          for (let n = 0; n < 4; n += 1) {
            await s.page.mouse.wheel(0, dir * 100);
            await sleep(50 + ((n * 37) % 100));
          }
          await sleep(250);
        } else if (i % 3 === 1) {
          for (let n = 0; n < 24; n += 1) {
            await s.page.mouse.wheel(0, dir * (4 + (n % 5) * 3));
            await sleep(12);
          }
          await sleep(300);
        } else {
          await s.page.keyboard.press(keys[dir > 0 ? "down" : "up"][k++ % 4]);
          await sleep(450);
        }
      };
      // Down to the end credits and back up to THE USUAL SUSPECTS, twice, then short turns.
      for (let round = 0; round < 2; round += 1) {
        for (let i = 0; i < 80 && (await y()) < start.max - 1.2 * H; i += 1) await input(1, i);
        for (let i = 0; i < 80 && (await y()) > start.suspects + 1.2 * H; i += 1) await input(-1, i);
      }
      for (let i = 0; i < 6; i += 1) await input(i % 2 ? -1 : 1, i);
      await sleep(1500);
      const log = await s.page.evaluate(() => window.__statics.stop());
      const verdict = staticsVerdict(log, start.suspects);
      report(
        `${device} ${lang} statics${reducedMotion === "reduce" ? " (reduced motion)" : ""}: the static page follows her ${device === "desktop" ? "wheel, trackpad and keys" : "swipes while the bars come and go"}, with no jump, no scroll by script and no shift`,
        verdict.ok && s.errors.length === 0,
        { ...verdict.detail, errors: s.errors.slice(0, 3) },
      );
      await s.close();
    }
  },

  async loader(device, lang) {
    if (device !== "mobile") return;
    const s = await session(device, lang, { enter: false });
    await s.page.waitForSelector('[data-loader][data-phase="ready"], [data-loader][data-slow]', { timeout: 240_000 });
    // The loading screen keeps the hint's box (it never reflows) but hides it on a phone.
    const hint = await s.page.evaluate(() => {
      const el = document.getElementById("loader-hint");
      const style = getComputedStyle(el);
      return { display: style.display, visibility: style.visibility, height: el.getBoundingClientRect().height };
    });
    const hidden = hint.display === "none" || hint.visibility === "hidden" || hint.height === 0;
    report(`${device} ${lang} loader: a phone is not asked to press a key`, hidden, hint);
    await s.close();
  },
};

for (const [name, check] of Object.entries(CHECKS)) {
  if (ONLY && !ONLY.includes(name)) continue;
  for (const device of DEVICES_WANTED) {
    for (const lang of LANGS) {
      browser = await launch();
      try {
        await check(device, lang);
      } catch (error) {
        report(`${device} ${lang} ${name}: ran`, false, { error: String(error?.message ?? error).slice(0, 300) });
      } finally {
        await browser.close();
      }
    }
  }
}
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
