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
 * still long-press does), arrows (one arrow per input type everywhere),
 * signals (never WAITING while a line plays or the note scolds; the note
 * only under sustained pushing, gone when she stops), rewind (the title
 * hint comes back, centred), wait (the long wait brakes and escalates),
 * radio (the open wheel keeps scrolls and swipes; aim, Q and the button
 * work),
 * reduced (reduced motion switched on mid-film keeps her place, and a
 * round trip without scrolling comes back exactly), focus (Tab right after
 * a click keeps Space and lands on THE USUAL SUSPECTS; the radio clicked
 * open and closed with Esc does not), pills (no caption line without text
 * at phone widths), calm (a notch every 2.5 or 3.5 s: a steady car, and nothing
 * asks for more next to YOU DRIVE; the cue never shares the band with a
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
 * still), ends (Ctrl+End and Ctrl+Home, Cmd+Down and Cmd+Up, act as End
 * and Home in the hero), navigate (the STATS booth, a STATS tab, back to top and a deep
 * link land with Lenis, the hero's walls open past it, and her next notch
 * or swipe goes on from there, even before the next frame), loader (no
 * "press any key" on a phone).
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

const browser = await chromium.launch({
  args: [
    "--autoplay-policy=no-user-gesture-required",
    ...(values.webgl ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--disable-3d-apis"]),
  ],
});

/** A fresh page, entered (without music), with the hero's probe on. */
async function session(device, lang, { reducedMotion = "no-preference", enter = true, hash = "" } = {}) {
  const context = await browser.newContext({ ...DEVICES[device], reducedMotion });
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
      const osd = document.querySelector("[data-osd]");
      const card = document.querySelector("[data-card][data-active]");
      const hint = document.querySelector("[data-hint]");
      const cue = document.querySelector("[data-cue]");
      log.push({
        t: performance.now(),
        mode: osd?.getAttribute("data-mode"),
        speed: Number(document.querySelector("[data-speed]")?.textContent ?? 0),
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
    const all = [hint, marker, readout, end];
    report(`${device} ${lang} arrows: the hint, the marker, WAITING and the end cue all point ${want}`, all.every((g) => g?.length === 1 && g[0] === want), { hint, marker, readout, end });
    await s.close();
  },

  async signals(device, lang) {
    const s = await session(device, lang);
    await sleep(1500);
    await s.page.evaluate(() => {
      const log = (window.__frames = []);
      const tick = () => {
        const osd = document.querySelector("[data-osd]");
        const card = document.querySelector("[data-card][data-active]");
        log.push({
          t: performance.now(),
          mode: osd?.getAttribute("data-mode"),
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

  async pills(device, lang) {
    if (device !== "mobile") return;
    const s = await session(device, lang, { enter: false });
    let empty = 0;
    for (const width of [320, 360, 375, 390, 414]) {
      await s.page.setViewportSize({ width, height: 844 });
      await sleep(200);
      empty += await s.page.evaluate(() => {
        let count = 0;
        const stage = document.querySelector("[data-sticky]").parentElement;
        for (const input of ["touch", "wheel"]) {
          stage.setAttribute("data-input", input);
          for (const ready of [false, true]) {
            for (const card of document.querySelectorAll("[data-card]")) {
              card.style.opacity = "1";
              if (ready) card.setAttribute("data-ready", "1");
              else card.removeAttribute("data-ready");
              card.toggleAttribute("data-cue-label", ready);
              const text = card.querySelector("[class*='subtitleText']");
              const centres = [];
              const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
              for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                if (getComputedStyle(n.parentElement).display === "none") continue;
                for (let k = 0; k < n.length; k += 1) {
                  if (!n.data[k].trim()) continue;
                  const range = document.createRange();
                  range.setStart(n, k);
                  range.setEnd(n, k + 1);
                  const r = range.getBoundingClientRect();
                  if (r.height > 0) centres.push((r.top + r.bottom) / 2);
                }
              }
              for (const f of text.getClientRects()) if (!centres.some((c) => c >= f.top && c <= f.bottom)) count += 1;
              card.style.opacity = "";
            }
          }
        }
        return count;
      });
    }
    report(`${device} ${lang} pills: no caption line without text, 320 to 414 px wide`, empty === 0, { empty });
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
            mode: document.querySelector("[data-osd]")?.getAttribute("data-mode"),
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
    // Up, it hangs clear of the HUD.
    for (let i = 0; i < 12 && !(await s.page.evaluate(() => Number(getComputedStyle(document.querySelector("[class*='callout']")).opacity) > 0.9)); i += 1) await sleep(250);
    const hits = await s.page.evaluate(() => {
      const c = document.querySelector("[class*='callout']").getBoundingClientRect();
      return [...document.querySelectorAll("[data-hud], [class*='reel']")].filter((e) => {
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
    // night at the top, with THE CREW's card right under it: the callout stays away. Further
    // back, the hero runs down past it and it comes.
    const k = await session(device, lang);
    await k.page.evaluate(() => localStorage.removeItem("va-radio-hint"));
    await sleep(1500);
    await k.page.locator("[data-skip]").click({ timeout: 10_000 });
    await sleep(1500);
    const back = {};
    for (const px of [16, 80, 200]) {
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
      `${device} ${lang} callout: after Skip, 16 or 80 px back up it stays off THE CREW's card; 200 px back, in the hero, it comes`,
      !back[16] && !back[80] && back[200],
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
    let card = 2;
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

  async navigate(device, lang) {
    // Every in-page move goes through one path (lib/navigate.ts): Lenis and
    // the page land together, and a page sent past the hero opens its walls,
    // so her next notch or swipe goes on from where she landed, never back
    // up to the hero's end.
    const W = DEVICES[device].viewport.width;
    const H = DEVICES[device].viewport.height;
    const notch = (s) => (device === "desktop" ? s.page.mouse.wheel(0, 100) : stroke(s.cdp, { dy: 80, ms: 90, y0: H * 0.7, x: W / 2 }));
    const top = (s, id) => s.page.evaluate((id) => Math.round(document.getElementById(id).getBoundingClientRect().top), id);
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
    if (device === "desktop") await booth.click();
    else await booth.tap();
    await sleep(900);
    const landed = { projects: await top(s, "projects"), ...(await state(s)) };
    await notch(s);
    await sleep(1500);
    const after = { projects: await top(s, "projects"), ...(await state(s)) };
    report(
      `${device} ${lang} navigate: the booth lands on the cinema with the walls open, and her next ${device === "desktop" ? "notch" : "swipe"} goes on from there`,
      Math.abs(landed.projects - 64) <= 2 &&
        landed.frontier === null &&
        landed.focus === "projects" &&
        after.y >= landed.y &&
        after.y - landed.y <= H,
      { landed, after },
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
    const atTop = await state(s);
    await notch(s);
    await sleep(1500);
    const topAfter = await state(s);
    report(
      `${device} ${lang} navigate: back to top lands at the top on the title, and her next ${device === "desktop" ? "notch" : "swipe"} stays there`,
      atTop.y <= 1 && atTop.focus === "hero-title" && topAfter.y >= 0 && topAfter.y <= H / 2,
      { atTop, topAfter },
    );
    await s.close();

    // A deep link, then a notch.
    const d = await session(device, lang, { hash: "#contact" });
    await sleep(1200);
    const deep = {
      contact: await top(d, "contact"),
      limit: await d.page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
      ...(await state(d)),
    };
    await notch(d);
    await sleep(1500);
    const deepAfter = { contact: await top(d, "contact"), ...(await state(d)) };
    report(
      `${device} ${lang} navigate: /${lang}#contact lands on the contact with the walls open, and her next ${device === "desktop" ? "notch" : "swipe"} stays there`,
      // At its top, or as near as the foot of the page allows.
      deep.frontier === null &&
        deep.focus === "contact" &&
        (deep.contact <= 64 || deep.y >= deep.limit - 1) &&
        deepAfter.y >= deep.y - 1 &&
        deepAfter.contact > -H,
      { deep, deepAfter },
    );
    await d.close();
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
      try {
        await check(device, lang);
      } catch (error) {
        report(`${device} ${lang} ${name}: ran`, false, { error: String(error?.message ?? error).slice(0, 300) });
      }
    }
  }
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
