/**
 * The load screen at work (LoadCurtain.tsx draws it; its rules are
 * loadCurtain.ts, tested). `begin` runs in her click or key press: in that
 * one task the page jumps to the save under a screen of night, so no frame
 * ever shows the jump, and whatever the place needs starts loading there
 * (its lazy pictures are told to load now). Every 100 ms it asks whether
 * the place is drawn; it lifts once it is, or at a limit, and gives the
 * focus to the place.
 *
 * While it is up nothing behind it moves or hears her: it takes every key
 * that would scroll, play, drive or skip (prevented, so every page handler
 * leaves it), every wheel and touch on it (they never reach Lenis), and
 * `html[data-loading]` is set as under the start menu (the page locked,
 * the radio wheel and STATS's shoulder keys refused, the one-time
 * entrances held until it goes). It never stops or starts Lenis: with no
 * input reaching it, nothing drives it, and the page is where `goTo` put
 * it.
 */
import { facesIn, facesReady } from "@/components/ChapterCard/ChapterMotion";
import { getSceneLoading, heroFrames } from "@/features/hero/sceneLoading";
import { eligible, type LoaderTip } from "@/features/loader/tips";
import { getNightCovered, getNightReadiness, night } from "@/features/night/nightState";
import { focusInPlace, goTo, placeOf } from "@/lib/navigate";
import { reveal } from "@/lib/reveal";
import { idFromHash } from "@/lib/hash";
import {
  checkDone,
  curtainKey,
  heroDone,
  inBand,
  LOAD,
  loadProgress,
  loadVerdict,
  nightDone,
  type SlotScene,
  slotScene,
  stepVisibleClock,
  type VisibleClock,
} from "./loadCurtain";
import { endHold, type LoadOptions, startHold } from "./loadHold";
import type { Save } from "./saves";

export type CurtainParts = {
  root: HTMLElement;
  /** The polite live region, inside the root (it says "still loading" once). */
  live: HTMLElement;
  thumb: HTMLImageElement;
  tipLabel: HTMLElement;
  tipText: HTMLElement;
  bar: HTMLElement;
  goNow: HTMLButtonElement;
};

/** A pause in a wheel's events this long ends its glide. */
const WHEEL_PAUSE_MS = 150;

export type CurtainWords = {
  slow: string;
  tips: readonly LoaderTip[];
  labels: { tip: string; trivia: string };
};

type Settled = { done: boolean };

export function createCurtainController(parts: CurtainParts, words: CurtainWords) {
  const { root, live, thumb, tipLabel, tipText, bar, goNow } = parts;
  let state: "idle" | "hold" | "lift" = "idle";
  /** Each load's number: a timer or a frame of an earlier load does nothing. */
  let gen = 0;
  let scene: SlotScene = "none";
  let view: HTMLElement | number = 0;
  let focus: HTMLElement | null = null;
  let clock: VisibleClock = { ms: 0, last: 0 };
  let painted = 0;
  let okPolls = 0;
  let progress = 0;
  let wrote = "";
  let slowShown = false;
  let tipShown = false;
  let goNowAsked = false;
  let retargeted = false;
  /** The Back that retargeted it landed a remembered place (no section to focus), and when it came. */
  let byPlace = false;
  let poppedAt = Number.NEGATIVE_INFINITY;
  /** The key that loaded is still down: its autorepeat must not reach the place she lands on. */
  let spent = false;
  /**
   * When this load covered the page and when it lifted (performance.now()). An input she made while
   * it held but that the browser delivers only after the lift (a slow phone busy for seconds queues
   * it) is stale: it never moves the place she has just loaded (`fromHold`).
   */
  let heldFrom = Number.POSITIVE_INFINITY;
  let liftedAt = Number.POSITIVE_INFINITY;
  /** Fingers that landed while it held: their whole stroke is stale, however late it arrives. */
  const staleTouches = new Set<number>();
  /** A wheel's glide that began under the screen, and its last event's time. */
  let wheelChain = false;
  let lastWheel = Number.NEGATIVE_INFINITY;
  let heroAtJump = 0;
  let nightAtJump = 0;
  let poll = 0;
  let raf = 0;
  let idleTimer = 0;
  let ownsLoading = false;
  let inerted: HTMLElement[] = [];
  const images = new WeakMap<HTMLImageElement, Settled>();
  const cards = new WeakMap<HTMLElement, Settled>();

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** The pictures on her first screen: told to load now, settled once decoded (or failed). */
  const imagesReady = (main: HTMLElement, vh: number): { done: number; total: number } => {
    let done = 0;
    let total = 0;
    for (const img of main.querySelectorAll("img")) {
      if (img.closest("[data-load-skip], [data-swap]")) continue;
      if (!inBand(img.getBoundingClientRect(), vh)) continue;
      // Only pictures she will see: not hidden by opacity or visibility (a poster's lit state, a refusal render).
      const shown =
        typeof img.checkVisibility === "function"
          ? img.checkVisibility({ opacityProperty: true, visibilityProperty: true })
          : img.getClientRects().length > 0 && getComputedStyle(img).visibility === "visible";
      if (!shown) continue;
      let settled = images.get(img);
      if (!settled) {
        const entry: Settled = { done: false };
        settled = entry;
        images.set(img, entry);
        if (img.loading === "lazy") img.loading = "eager";
        img.fetchPriority = "high";
        const decoded = () => {
          img.decode().then(
            () => (entry.done = true),
            () => (entry.done = true),
          );
        };
        if (img.complete) decoded();
        else {
          img.addEventListener("load", decoded, { once: true });
          img.addEventListener("error", () => (entry.done = true), { once: true });
        }
      }
      total += 1;
      if (settled.done) done += 1;
    }
    return { done, total };
  };

  /** The chapter cards on her first screen: their faces in (a card never paints in a fallback face). */
  const cardsReady = (main: HTMLElement, vh: number): { done: number; total: number } => {
    let done = 0;
    let total = 0;
    for (const card of main.querySelectorAll<HTMLElement>("[data-chapter]")) {
      if (!inBand(card.getBoundingClientRect(), vh)) continue;
      let settled = cards.get(card);
      if (!settled) {
        const entry: Settled = { done: facesReady(card) };
        settled = entry;
        cards.set(card, entry);
        if (!entry.done) void facesIn(card).then(() => (entry.done = true));
      }
      total += 1;
      if (settled.done) done += 1;
    }
    return { done, total };
  };

  const stageOnScreen = (vh: number): boolean => {
    const stage = document.querySelector("[data-work-stage]");
    if (!stage) return false;
    const box = stage.getBoundingClientRect();
    return box.bottom > 0 && box.top < vh;
  };

  const writeProgress = (value: number) => {
    const text = value.toFixed(2);
    if (text === wrote) return;
    wrote = text;
    root.style.setProperty("--load-p", text);
    bar.setAttribute("aria-valuenow", String(Math.round(value * 100)));
  };

  const countFrames = (id: number) => {
    raf = requestAnimationFrame(() => {
      if (id !== gen) return;
      painted += 1;
      if (painted < LOAD.paintedFrames) countFrames(id);
      else raf = 0;
    });
  };

  const tick = () => {
    if (state !== "hold") return;
    const now = performance.now();
    clock = stepVisibleClock(clock, now, document.visibilityState === "visible");
    const t = clock.ms;
    const main = document.getElementById("main");
    const vh = window.innerHeight;
    let done = painted >= LOAD.paintedFrames ? 1 : 0;
    let total = 1;
    let all = done === 1;

    if (main) {
      const pics = imagesReady(main, vh);
      const faces = cardsReady(main, vh);
      done += pics.done + faces.done;
      total += pics.total + faces.total;
      all = all && checkDone(pics.done === pics.total, t, LOAD.imagesMs) && checkDone(faces.done === faces.total, t, LOAD.facesMs);
    }

    if (!retargeted && scene === "hero") {
      const hero = heroDone({
        ready: getSceneLoading().ready,
        frames: heroFrames.count,
        framesAtJump: heroAtJump,
        hasCanvas: document.querySelector("[data-scene] canvas") !== null,
      });
      total += 1;
      if (hero) done += 1;
      all = all && checkDone(hero, t, LOAD.heroMs);
    }

    // The city, wherever it is wanted: landed on, or mounting next to the save she loads.
    const city = nightDone({
      wanted: night.wanted,
      mounted: document.querySelector("[data-work-stage] canvas") !== null,
      onScreen: stageOnScreen(vh),
      readiness: getNightReadiness(),
      frames: night.frames,
      framesAtJump: nightAtJump,
      covered: getNightCovered(),
    });
    if (night.wanted || scene === "night") {
      total += 1;
      if (city) done += 1;
    }
    all = all && checkDone(city, t, LOAD.nightMs);

    okPolls = all ? okPolls + 1 : 0;
    progress = loadProgress(progress, done, total, all);
    writeProgress(progress);

    if (!tipShown && t >= LOAD.tipMs) {
      tipShown = true;
      root.toggleAttribute("data-tip", true);
    }
    if (!slowShown && t >= LOAD.slowMs) {
      slowShown = true;
      root.toggleAttribute("data-slow", true);
      live.textContent = words.slow;
    }

    if (loadVerdict({ visibleMs: t, painted, okPolls, goNow: goNowAsked }) === "lift") lift();
  };

  const pickTip = () => {
    const viewer = { touch: window.matchMedia("(pointer: coarse)").matches, reducedMotion: reduced() };
    const fit = words.tips.filter((tip) => eligible(tip, viewer));
    const tip = fit[Math.floor(Math.random() * fit.length)];
    tipLabel.textContent = tip ? words.labels[tip.kind] : "";
    tipText.textContent = tip?.text ?? "";
  };

  /** Lets go of the page: what this load took (data-loading, inert, the hold), never what others own. */
  const release = () => {
    if (ownsLoading) document.documentElement.removeAttribute("data-loading");
    ownsLoading = false;
    for (const element of inerted) element.inert = false;
    inerted = [];
    root.removeAttribute("aria-busy");
    // Out of the accessibility tree before the focus moves into the page; only its fade remains.
    root.setAttribute("aria-hidden", "true");
    root.inert = true;
    endHold();
  };

  const toIdle = () => {
    window.clearTimeout(idleTimer);
    if (state === "hold") return;
    state = "idle";
    root.dataset.state = "idle";
    root.dataset.slot = "";
    root.inert = true;
    root.setAttribute("aria-hidden", "true");
    root.removeAttribute("data-tip");
    root.removeAttribute("data-slow");
    root.style.removeProperty("--load-p");
    live.textContent = "";
    // Done with the key that loaded once it is up, or a second after: a lost keyup never blocks for long.
    window.setTimeout(() => {
      if (state === "idle") spent = false;
    }, 1000);
  };

  function lift() {
    if (state !== "hold") return;
    const id = gen;
    window.clearInterval(poll);
    poll = 0;
    // Whatever moved under it while it loaded (a picture that came in above, a tab that opened): land again.
    if (!retargeted) goTo(view, { focus: null });
    writeProgress(1);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (id !== gen) return;
        release();
        const named = retargeted && !byPlace ? document.getElementById(idFromHash(window.location.hash) ?? "") : null;
        const target = retargeted ? (named ? reveal(named).focus : document.body) : focus;
        if (target?.isConnected) focusInPlace(target);
        state = "lift";
        liftedAt = performance.now();
        root.dataset.state = "lift";
        if (reduced()) toIdle();
        else idleTimer = window.setTimeout(toIdle, LOAD.fadeMs + LOAD.idleFallbackMs);
      }),
    );
  }

  const begin = (save: Save, options: LoadOptions): boolean => {
    if (state !== "idle") return false;
    let where: HTMLElement | number;
    let focusOn: HTMLElement | null;
    if (save.id === "hero") {
      where = 0;
      focusOn = document.getElementById("hero-title") ?? document.getElementById("main");
    } else {
      const target = document.getElementById(save.target);
      if (!target) return false;
      // A target in a closed tab opens it first (STATS), and may be seen from its section.
      const shown = reveal(target);
      where = shown.view;
      focusOn = shown.focus;
    }
    gen += 1;
    scene = slotScene(save.id, reduced());
    view = where;
    focus = focusOn;
    retargeted = false;
    byPlace = false;
    goNowAsked = false;
    painted = 0;
    okPolls = 0;
    progress = 0;
    wrote = "";
    tipShown = false;
    slowShown = false;
    spent = options.via === "key";
    heldFrom = performance.now();
    liftedAt = Number.POSITIVE_INFINITY;
    staleTouches.clear();
    wheelChain = false;

    // The jump, in her gesture and under the screen drawn in this same task: Lenis and the page
    // together, the walls opened on the way past (lib/navigate.ts).
    goTo(where, { focus: null });
    heroAtJump = heroFrames.count;
    nightAtJump = night.frames;

    state = "hold";
    root.dataset.slot = save.id;
    root.dataset.state = "hold";
    root.inert = false;
    root.removeAttribute("aria-hidden");
    root.setAttribute("aria-busy", "true");
    root.setAttribute("aria-labelledby", `load-curtain-kicker load-curtain-word-${save.id}`);
    thumb.removeAttribute("data-thumb-in");
    if (options.picture) {
      thumb.onload = () => thumb.setAttribute("data-thumb-in", "");
      thumb.src = options.picture;
      if (thumb.complete && thumb.naturalWidth > 0) thumb.setAttribute("data-thumb-in", "");
    } else thumb.removeAttribute("src");
    pickTip();
    writeProgress(0);

    // The page locked behind it, as under the start menu (which owns these itself while it is up).
    const html = document.documentElement;
    ownsLoading = !html.hasAttribute("data-loading");
    if (ownsLoading) html.setAttribute("data-loading", "");
    inerted = [document.querySelector<HTMLElement>(".skip-link"), document.getElementById("main"), document.querySelector<HTMLElement>("[data-page-controls]")].filter(
      (element): element is HTMLElement => element !== null && !element.inert,
    );
    for (const element of inerted) element.inert = true;
    startHold({ ownsEntry: options.mode === "start" });
    focusInPlace(root);

    clock = { ms: 0, last: performance.now() };
    countFrames(gen);
    poll = window.setInterval(tick, LOAD.pollMs);
    return true;
  };

  // ---- Input: nothing behind hears her while it is up. ----

  /** Made while it held (her event's own time), and only now delivered. */
  const fromHold = (event: Event) => state !== "hold" && event.timeStamp >= heldFrom && event.timeStamp < liftedAt;

  const onKeyDown = (event: KeyboardEvent) => {
    if (fromHold(event)) {
      event.preventDefault();
      return;
    }
    if (state === "idle" && !spent) return;
    const verdict = curtainKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      repeat: event.repeat,
      onGoNow: event.target === goNow,
      holding: state === "hold",
      spent,
    });
    // Prevented, never stopped: every page handler leaves a prevented key, and the hero takes a
    // prevented Esc as a dialog's, so an Esc right after the lift does not skip the film either.
    if (verdict === "block") event.preventDefault();
  };
  const onKeyUp = () => {
    spent = false;
  };
  /** A wheel or a finger on the screen while it is up: theirs alone (Lenis listens on the window). */
  const swallow = (event: Event) => {
    if (state === "idle") return;
    event.stopPropagation();
    if (event.cancelable && (event.type === "wheel" || event.type === "touchmove")) event.preventDefault();
  };
  /**
   * After the lift, what she did while it held and the browser delivers late: a wheel, a stroke, a
   * tap. Stopped at the window before anyone hears it (Lenis, the stages, a link under her finger).
   */
  const dropStale = (event: Event) => {
    // A trackpad's or a wheel's glide that began under the screen keeps coming after the lift (the
    // momentum of a flick, a second or two): stale until it pauses.
    if (event.type === "wheel") {
      const gap = event.timeStamp - lastWheel;
      lastWheel = event.timeStamp;
      if (state === "hold") {
        wheelChain = true;
        return;
      }
      if (wheelChain && gap < WHEEL_PAUSE_MS) {
        event.stopImmediatePropagation();
        if (event.cancelable) event.preventDefault();
        return;
      }
      wheelChain = false;
    }
    // A finger that lands while it holds: its whole stroke is stale, however late its moves come.
    if (state === "hold") {
      if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
        for (const touch of Array.from(event.changedTouches)) {
          if (event.type === "touchstart") staleTouches.add(touch.identifier);
          else if (event.type === "touchend" || event.type === "touchcancel") staleTouches.delete(touch.identifier);
        }
      }
      return;
    }
    let stale = fromHold(event);
    if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
      const touches = Array.from(event.changedTouches);
      if (event.type === "touchstart" && stale) for (const touch of touches) staleTouches.add(touch.identifier);
      if (touches.some((touch) => staleTouches.has(touch.identifier))) stale = true;
      if (event.type === "touchend" || event.type === "touchcancel") for (const touch of touches) staleTouches.delete(touch.identifier);
    }
    if (!stale) return;
    event.stopImmediatePropagation();
    if (event.cancelable && !PASSIVE.has(event.type)) event.preventDefault();
  };
  const STALE = ["wheel", "touchstart", "touchmove", "touchend", "touchcancel", "pointerdown", "pointerup", "mousedown", "mouseup", "click"] as const;
  const PASSIVE = new Set<string>(["touchstart", "touchend", "touchcancel"]);

  /**
   * Back or a fragment while it loads: the page goes there (PageEntry), and the focus with it at the
   * lift, as PageEntry would give it: an entry that remembers a place lands there with no focus (the
   * body), any other on the section its address names.
   */
  const onRetarget = (event: Event) => {
    if (state !== "hold") return;
    retargeted = true;
    if (event.type === "popstate") {
      byPlace = placeOf((event as PopStateEvent).state) !== null;
      poppedAt = performance.now();
    } else if (performance.now() - poppedAt > 1000) byPlace = false;
  };
  const onVisibility = () => {
    // Time behind a hidden tab never counts: start the clock again from now.
    if (document.visibilityState === "visible") clock = { ms: clock.ms, last: performance.now() };
  };
  const onGoNow = () => {
    if (state === "hold") {
      goNowAsked = true;
      tick();
    }
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  // A finger's start and end stay passive (a non-passive one holds every scroll for script); a wheel, a
  // move and a click must be cancelled (the browser's own scroll, a link followed).
  for (const type of STALE) window.addEventListener(type, dropStale, { capture: true, passive: PASSIVE.has(type) });
  window.addEventListener("popstate", onRetarget);
  window.addEventListener("hashchange", onRetarget);
  document.addEventListener("visibilitychange", onVisibility);
  root.addEventListener("wheel", swallow, { passive: false });
  root.addEventListener("touchstart", swallow, { passive: true });
  root.addEventListener("touchmove", swallow, { passive: false });
  root.addEventListener("touchend", swallow, { passive: true });
  root.addEventListener("touchcancel", swallow, { passive: true });
  goNow.addEventListener("click", onGoNow);
  const onFaded = (event: TransitionEvent) => {
    if (event.target === root && state === "lift") toIdle();
  };
  root.addEventListener("transitionend", onFaded);

  const dispose = () => {
    gen += 1;
    window.clearInterval(poll);
    cancelAnimationFrame(raf);
    window.clearTimeout(idleTimer);
    if (state === "hold") release();
    state = "lift";
    toIdle();
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    for (const type of STALE) window.removeEventListener(type, dropStale, true);
    window.removeEventListener("popstate", onRetarget);
    window.removeEventListener("hashchange", onRetarget);
    document.removeEventListener("visibilitychange", onVisibility);
    root.removeEventListener("wheel", swallow);
    root.removeEventListener("touchstart", swallow);
    root.removeEventListener("touchmove", swallow);
    root.removeEventListener("touchend", swallow);
    root.removeEventListener("touchcancel", swallow);
    goNow.removeEventListener("click", onGoNow);
    root.removeEventListener("transitionend", onFaded);
    thumb.onload = null;
  };

  return { begin, dispose };
}
