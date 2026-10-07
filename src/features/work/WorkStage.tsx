"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useLenis } from "lenis/react";
import {
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { ChapterCard } from "@/components/ChapterCard/ChapterCard";
import { Button } from "@/components/ui/Button";
import { motion } from "@/design/tokens";
import { decay, ELASTIC, rubberBand, touchStretchMax } from "@/features/hero/scroll/elastic";
import { type FarRestInput, restsFarAway } from "@/features/hero/scroll/farRest";
import { lenisMissed, type PageReading, pageScroll } from "@/features/hero/scroll/gate";
import { type InputSource, recordInput, scrollGate, scrollInput } from "@/features/hero/scroll/heroProgress";
import { createPedalDriver } from "@/features/hero/scroll/pedalDriver";
import { STORY } from "@/features/hero/scroll/story";
import { isPictureTap, keyAction, speedKmh, type TargetKind } from "@/features/hero/scroll/transport";
import { createDashPainter, Dash } from "@/features/hero/Dash";
import { fitCards } from "@/features/hero/fitCards";
import { Pedal } from "@/features/hero/Pedal";
import { dashLayout, newDashState, stepDash, stepLimiter } from "@/features/hero/scroll/dash";
import { type FeedbackInput, newFeedback, stepFeedback } from "@/features/hero/scroll/feedback";
import { meterRate } from "@/features/hero/scroll/throttle";
import { getSceneLoading } from "@/features/hero/sceneLoading";
import { getRadio } from "@/features/music/radio";
import { DIRECTION } from "@/features/night/direction";
import { NightCanvas } from "@/features/night/NightCanvas";
import { type NightCoverInput, nightCovered } from "@/features/night/nightCover";
import { getNightReadiness, night, setNightCovered, subscribeNightReadiness } from "@/features/night/nightState";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { goTo, isNavigation, registerPassage } from "@/lib/navigate";
import { stableScreen } from "@/lib/screen";
import { SUBTITLES_EVENT } from "@/lib/subtitleSize";
import { tallestCards } from "./chipPlace";
import { newDipView, stepDipView } from "./dip";
import { openingAt } from "./opening";
import { DISARMED, insideQuad, quadClipPath, quadIsTargetable, quadUv, stepArm, type ArmEvent } from "./hotspot";
import { selectGate } from "@/features/suspects/selectWall";
import { stageGate } from "./stageGate";
import { STOPS } from "./stops";
import styles from "./Work.module.css";
import {
  activeCardAt,
  newStageStory,
  openAllWalls,
  openWallsUpTo,
  stageFrontier,
  stageFrontierIndex,
  stageLineStep,
  stageReadFill,
  stageWalls,
  stepStageStory,
} from "./workStory";
import { beatIndexAt, workTimeline } from "./workTimeline";

type Props = {
  work: Dictionary["work"];
  cues: Dictionary["common"]["cues"];
  /** The pedal's words: the hero's own (the same pedal drives both films). */
  pedal: Dictionary["hero"]["pedal"];
  /** The dash's words: the hero's own (the same dash, on every screen but a phone's). */
  osd: Dictionary["hero"]["osd"];
  locale: Locale;
  children: ReactNode;
};

/** Pixels a jump may pass the wall before the gate acts. */
const SLOP = 4;
/** Seconds a Space or a tap glides to the next line. */
const LINE_GLIDE = 0.55;
/** Seconds focus on a chip glides the story to its stop. */
const CHIP_GLIDE = 0.8;
/** Keys right after the visitor entered belong to the loading screen. */
const KEY_GUARD_MS = 250;
/** Armed boards ease in and out over this (s). */
const ARM_TAU = 0.09;
/** Idle seconds before a read card asks for more, and before the between-card cue shows. */
const READY_IDLE = 0.4;
const CUE_IDLE = 1;
/** The card wears the push for this long after the last held input (ms). */
const HOLDING_MS = 220;
/** How often the board's hit area follows a moving camera (ms). */
const HOTSPOT_MS = 100;
/** The pedal's knock flash (ms), as in the hero. */
const KNOCK_MS = 300;
/** How long a push held at a drive's wall rides it on (ms; see the ride in update). */
const RIDE_MS = 600;
/** Seconds the held pedal glides on into the next section at the end. */
const PEDAL_GOON_GLIDE = 0.9;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * A popover open over the stage (the army's service record) takes the keys:
 * Esc closes it, and nothing behind it drives, skips or steps a line. A
 * browser without `:popover-open` has no popovers open either.
 */
function popoverOpen(): boolean {
  try {
    return document.querySelector(":popover-open") !== null;
  } catch {
    return false;
  }
}

function targetKind(target: EventTarget | null): TargetKind {
  if (!(target instanceof Element)) return "other";
  if (target.closest("input, textarea, select, [contenteditable='true']")) return "text";
  const control = target.closest("button, [role='button'], a[href]");
  if (!control) return "other";
  return control.tagName === "A" ? "link" : "button";
}

/** Writes a style only when it changed (no layout reads). */
function styleSetter() {
  const last = new Map<HTMLElement, Map<string, string>>();
  return (el: HTMLElement | null, prop: string, value: string) => {
    if (!el) return;
    let props = last.get(el);
    if (!props) {
      props = new Map();
      last.set(el, props);
    }
    if (props.get(prop) === value) return;
    props.set(prop, value);
    if (prop.startsWith("--")) el.style.setProperty(prop, value);
    else (el.style as unknown as Record<string, string>)[prop] = value;
  };
}

function attrSetter() {
  const last = new Map<HTMLElement, Map<string, string | null>>();
  return (el: HTMLElement | null, name: string, value: string | boolean | null) => {
    if (!el) return;
    const next = value === true ? "" : value === false ? null : value;
    let names = last.get(el);
    if (!names) {
      names = new Map();
      last.set(el, names);
    }
    if (names.has(name) && names.get(name) === next) return;
    names.set(name, next);
    if (next === null) el.removeAttribute(name);
    else el.setAttribute(name, next);
  };
}

type DevWindow = Window & {
  __vaStage?: (at: number | string) => void;
  __vaArm?: (on?: boolean) => void;
  /** The stage's wall, read by tools/capture/scrollux.mjs (cityswipe). */
  __vaStageGate?: typeof stageGate;
  /** Set to [] to log the picture every frame (time, film position, stop): tools that measure the car's motion read it. */
  __vaStageProbe?: { t: number; p: number; stop: number }[];
};

/**
 * The work stage: the career as a night drive, pinned like the hero. The
 * page scroll is the picture, walls hold every card for its reading time
 * (workStory.ts) and every stop is a real article positioned at its stretch
 * of the scroll, so anchors, find in page and screen readers land on it.
 * Each stop's one control is its chip (the employer's site, or the army's
 * service record); the board in the scene arms on a pointer move or a
 * first tap and then opens the chip.
 */
export function WorkStage({ work, cues, pedal: pedalCopy, osd, locale, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const lenis = useLenis();
  const readiness = useSyncExternalStore(subscribeNightReadiness, getNightReadiness, () => "waiting" as const);
  const timeline = useMemo(() => workTimeline(work), [work]);
  const walls = useMemo(() => stageWalls(timeline), [timeline]);
  const kept = useRef<{ key: string; story: ReturnType<typeof newStageStory> } | null>(null);
  const actions = useRef<{ skip: () => void } | null>(null);

  useGSAP(
    () => {
      const stage = root.current;
      if (!stage) return;
      const sticky = stage.querySelector<HTMLElement>("[data-sticky]");
      if (reducedMotion) {
        stageGate.maxScroll = Number.POSITIVE_INFINITY;
        return;
      }

      const geom = { top: 0, range: 1, vh: stableScreen().large };
      /** Where the dash sits (hero/scroll/dash.ts DASH_MEDIA, the same queries as the CSS); a phone has none. */
      let layout = dashLayout((query) => window.matchMedia(query).matches);
      // Each card fitted to its widest line, as the hero's (hero/fitCards.ts): with the viewport, the fonts and the subtitle size.
      const cardText = Array.from(stage.querySelectorAll<HTMLElement>("[data-card-text]"));
      // And on a phone each stop's chip stands over its tallest card (chipPlace.ts), measured with them.
      const articles = Array.from(stage.querySelectorAll<HTMLElement>("[data-stop]"));
      const cardStops = timeline.cards.map((card) => card.stop);
      const fitLines = () => {
        fitCards(cardText);
        const tallest = tallestCards(
          cardText.map((text) => text.offsetHeight),
          cardStops,
          articles.length,
        );
        articles.forEach((article, i) => article.style.setProperty("--cards-h", `${tallest[i]}px`));
      };
      const measure = () => {
        layout = dashLayout((query) => window.matchMedia(query).matches);
        fitLines();
        // The screen the page is laid out with (lib/screen.ts): a phone's bars coming and going never change it.
        const { large } = stableScreen();
        const rect = stage.getBoundingClientRect();
        geom.top = rect.top + window.scrollY;
        // The film's length is the stage less one stable screen, so the bars never re-measure it.
        geom.range = Math.max(1, rect.height - large);
        geom.vh = large;
        // Where the film is pinned: a finger landing there is Lenis' stroke, as in the hero (gate.ts browserStroke).
        stageGate.pinFrom = geom.top;
        stageGate.pinTo = geom.top + geom.range;
      };
      measure();
      let fontsWaiting = true;
      document.fonts?.ready.then(() => {
        if (fontsWaiting) fitLines();
      });
      const scrollFor = (p: number) => geom.top + p * geom.range;
      const progressFor = (y: number) => (y - geom.top) / geom.range;
      // Where the page is, as the hero reads it (gate.ts): its own offset, drawn from Lenis' sub-pixel
      // value while the two agree, and Lenis started again from the page when it missed a native move,
      // so the picture is the page even under the browser's own fling.
      const reading: PageReading = { page: 0, lenis: 0, gliding: false };
      const readScroll = () => {
        reading.page = window.scrollY;
        if (!lenis) return reading.page;
        reading.lenis = lenis.scroll;
        reading.gliding = lenis.isScrolling === "smooth";
        if (lenisMissed(reading)) lenis.animatedScroll = lenis.targetScroll = reading.page;
        return pageScroll(reading);
      };
      const scrollNow = readScroll;

      const key = walls.map((w) => `${w.kind}:${w.from.toFixed(5)}`).join("|");
      if (kept.current?.key !== key) {
        kept.current = { key, story: newStageStory(walls, timeline.cards.length) };
        const pNow = progressFor(window.scrollY);
        if (pNow > 0) openWallsUpTo(walls, kept.current.story, Math.min(1, pNow));
      }
      const story = kept.current.story;

      const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
      resizeObserver?.observe(stage);

      const q = (selector: string) => stage.querySelector<HTMLElement>(selector);
      const el = {
        title: q("[data-title]"),
        barTop: q("[data-bar='top']"),
        barBottom: q("[data-bar='bottom']"),
        fade: q("[data-fade]"),
        dip: q("[data-dip]"),
        captions: q("[data-captions]"),
        cue: q("[data-cue]"),
        skip: q("[data-skip]"),
        live: q("[data-live]"),
        waking: q("[data-waking]"),
        hotspot: q("[data-hotspot]"),
        reticle: q("[data-reticle]"),
        reel: Array.from(stage.querySelectorAll<HTMLElement>("[data-reel-fill]")),
        cards: Array.from(stage.querySelectorAll<HTMLElement>("[data-card]")),
        supers: Array.from(stage.querySelectorAll<HTMLElement>("[data-super]")),
        supersRight: Array.from(stage.querySelectorAll<HTMLElement>("[data-super-right]")),
        articles: Array.from(stage.querySelectorAll<HTMLElement>("[data-stop]")),
        chips: Array.from(stage.querySelectorAll<HTMLElement>("[data-chip]")),
        pedal: q("[data-pedal]"),
        dash: q("[data-osd]"),
      };
      const set = styleSetter();
      const attr = attrSetter();

      let wasHidden = false;
      const onVisibility = () => {
        if (document.visibilityState !== "visible") wasHidden = true;
      };
      let lastP = 0;
      let backAt = Number.NEGATIVE_INFINITY;
      let lastActive = -1;
      let lastStop = -1;
      let arm = DISARMED;
      let quadPath = "";
      let quadPathAt = 0;
      /** The mouse's last place (client px; NaN before it moves): its place on the board is read again as the board moves under it. */
      let pointer = { x: Number.NaN, y: Number.NaN };
      /** A press that rides a held drive on to its next line; any input of hers since lets it go. */
      let carry: { to: number; at: number } | null = null;
      let lastPushedAt = scrollGate.pushedAt;
      let pushFlash = 0;
      const drawnOpacity = el.cards.map(() => -1);
      const titleBeat = timeline.beats[0];
      const openState = { titleOut: 0, sceneIn: 0, chrome: false };
      const view = newDipView();
      const endBeat = timeline.beats[timeline.beats.length - 1];

      const fire = (event: ArmEvent) => {
        const result = stepArm(arm, event);
        arm = result.state;
        night.armTarget = arm.armed ? 1 : 0;
        if (!arm.armed) {
          night.tapU = Number.NaN;
          night.tapV = Number.NaN;
        }
        if (result.action === "open") el.chips[night.stop]?.click();
      };

      /** Keeps the scroll at the frontier; a jump with no input is navigation and opens the walls. */
      const gate = (fr: number, scroll: number, now: number) => {
        stageGate.maxScroll = Number.isFinite(fr) ? scrollFor(fr) : Number.POSITIVE_INFINITY;
        if (!lenis || lenis.isStopped || !Number.isFinite(stageGate.maxScroll)) return;
        // The hero's wall and the character select's bind first: nothing here while either still holds the page.
        if (Math.min(scrollGate.maxScroll, selectGate.maxScroll) < stageGate.maxScroll) return;
        const max = stageGate.maxScroll;
        if (lenis.isScrolling === "smooth" && lenis.targetScroll > max + 1) {
          scrollGate.pressure += Math.min(lenis.targetScroll - max, geom.vh * 0.3);
          scrollGate.pushedAt = now;
          lenis.scrollTo(max, { programmatic: false, lerp: motion.touchLerp, force: true });
          return;
        }
        const over = scroll - max;
        if (over <= SLOP) return;
        // A finger's fling records no input as it glides: it is still hers, never a jump that opens walls.
        if (!isNavigation(scrollInput.at, now, scrollGate.touchEndAt)) {
          scrollGate.pressure += Math.min(over, geom.vh * 0.3);
          scrollGate.pushedAt = now;
          lenis.scrollTo(max, { immediate: true, force: true });
        } else {
          // The scrollbar, find in page, an anchor or a screen reader's cursor: open up to where it landed.
          const landed = progressFor(scroll);
          if (landed >= 1) openAllWalls(story);
          else openWallsUpTo(walls, story, landed);
          stageGate.maxScroll = Number.POSITIVE_INFINITY;
        }
      };

      // The dash (hero/scroll/dash.ts, drawn by hero/Dash.tsx), the hero's own: where it sits, its
      // state between frames and the transport's feedback that says what the car does.
      const dashState = newDashState(scrollInput.stepAt, scrollGate.pushedAt);
      const dashPainter = createDashPainter(el.dash);
      const feedback = newFeedback();
      const fbInput: FeedbackInput = {
        started: true,
        p: 0,
        sinceInput: Number.POSITIVE_INFINITY,
        sinceBackward: Number.POSITIVE_INFINITY,
        pictureSpeed: 0,
        pace: 1,
        playing: false,
        meterRate: 0,
        sinceEntered: -1,
        teasing: false,
        sincePush: Number.POSITIVE_INFINITY,
        held: 0,
        touch: false,
        unreadCard: -1,
      };

      /** The pedal (hero/scroll/pedalDriver.ts), created once the line step exists. */
      let driver: ReturnType<typeof createPedalDriver> | null = null;
      const drawnPedal = { lv: Number.NaN };

      /** What farRest.ts reads, filled each frame. */
      const farIn: FarRestInput = {
        wallsOpen: false,
        scroll: 0,
        top: 0,
        bottom: 0,
        vh: 1,
        pressure: 0,
        sincePush: 0,
        pedalDown: false,
        scrolling: false,
      };
      /** What nightCover.ts reads, filled each frame (the frame allocates nothing). */
      const coverIn: NightCoverInput = { ready: false, sceneIn: 0, endT: 0, dip: 0, warm: false };
      const update = (deltaMs: number) => {
        const now = performance.now();
        // The pedal lets go whenever its holder may be gone: the radio wheel opened, Lenis stopped, a lost keyup.
        driver?.watch(now, getRadio().wheel !== null || !lenis || lenis.isStopped);
        const scroll = scrollNow();
        // Far from the city with every wall open and nothing in flight (no dip settling either), the
        // frame has nothing to do (farRest.ts).
        farIn.wallsOpen = stageFrontierIndex(story) < 0;
        farIn.scroll = scroll;
        farIn.top = geom.top;
        farIn.bottom = geom.top + geom.range + geom.vh;
        farIn.vh = geom.vh;
        farIn.pressure = scrollGate.pressure;
        farIn.sincePush = now - scrollGate.pushedAt;
        farIn.pedalDown = driver?.pedal.down ?? false;
        farIn.scrolling = Boolean(lenis?.isScrolling);
        if (view.dip === 0 && restsFarAway(farIn)) return;
        let dt = Math.min(Math.max(0, deltaMs) / 1000, STORY.maxStep);
        const visible = document.visibilityState === "visible";
        if (visible && wasHidden) {
          wasHidden = false;
          dt = 0;
        }
        const ready = getNightReadiness() !== "waiting";
        const target = progressFor(scroll);
        const fr = stageFrontier(walls, story);
        const p = clamp01(Math.min(target, fr));
        if ((lastP - p) * geom.range > 1) backAt = now;
        // The feedback runs on real time (only the reading clocks are capped), as in the hero.
        const realDt = Math.min(Math.max(0, deltaMs) / 1000, 2);
        const pictureSpeed = realDt > 0 ? Math.abs(p - lastP) / realDt : 0;
        const rewinding = now - Math.max(scrollInput.backwardAt, backAt) < STORY.rewindHide * 1000;
        lastP = p;
        const inStage = target > -0.02 && target < 1.02;
        // Where the page is heading: a hold's wall plays only while her drive heads for it (workStory.ts).
        const reach = lenis ? progressFor(Math.max(lenis.targetScroll, scroll)) : target;
        const active = stepStageStory(walls, story, timeline, p, dt, {
          rewinding,
          running: visible && ready && inStage,
          reach,
        });
        const k = stageFrontierIndex(story);
        const beatIndex = beatIndexAt(timeline, p);
        const beat = timeline.beats[beatIndex];
        // The scene's stop and picture, and the dip over them (dip.ts): across a cut the set changes only
        // under night, and a fast pass still dissolves rather than cuts.
        stepDipView(view, timeline, p, Math.max(0, beat.stop), ready ? dt : 0);
        const stop = view.stop;
        night.p = view.p;
        if (process.env.NODE_ENV !== "production") (window as DevWindow).__vaStageProbe?.push({ t: now, p: view.p, stop: view.stop });
        if (stop !== night.stop || lastStop < 0) {
          night.stop = stop;
          fire({ type: "stopChanged" });
        }
        fire({ type: "tick", at: now });
        night.armed += (night.armTarget - night.armed) * (1 - Math.exp(-dt / ARM_TAU));

        // Held input: the active card gives a little under the push.
        if (scrollGate.pushedAt !== lastPushedAt) {
          lastPushedAt = scrollGate.pushedAt;
          pushFlash = 1;
        } else pushFlash = decay(pushFlash, dt, ELASTIC.pushTau);
        const holding = inStage && k >= 0 && now - scrollGate.pushedAt < HOLDING_MS;
        const touch = scrollGate.touching || scrollInput.source === "touch";
        const nudge = !holding
          ? 0
          : touch
            ? rubberBand(scrollGate.pressure, touchStretchMax(geom.vh))
            : rubberBand(Math.max(0, scrollGate.pressure - ELASTIC.wheelDeadZone), ELASTIC.wheelMax);
        const fill = active >= 0 ? stageReadFill(walls, story, active) : 0;
        const idle = (now - scrollInput.at) / 1000;

        // ---- draw ----
        // The title card on night, lifting away early in the bridge line (opening.ts): it scrolls up
        // with the page, and gone before it reaches the top band, it never sits on the route.
        const { titleOut, sceneIn, chrome: showChrome } = openingAt(timeline, p, openState);
        set(el.title, "opacity", (1 - titleOut).toFixed(3));
        set(el.title, "transform", `translate3d(0, ${(-14 * titleOut - (k === 0 ? nudge : 0)).toFixed(2)}px, 0)`);
        // Night covers the scene until it is ready and through the title; the iris closes it at the end.
        const opening = ready ? sceneIn : 0;
        const endT = clamp01((p - endBeat.start) / Math.max(1e-6, endBeat.end - endBeat.start));
        set(el.fade, "opacity", (1 - opening).toFixed(3));
        // The letterbox slides away as the drive starts, as in the hero.
        const bars = Math.round(easeOutCubic(opening) * 500) / 500;
        set(el.barTop, "transform", `translate3d(0, ${(-100 * bars).toFixed(1)}%, 0)`);
        set(el.barBottom, "transform", `translate3d(0, ${(100 * bars).toFixed(1)}%, 0)`);
        // The iris follows the tally only while it closes: before that the camera's life would restyle the cover every frame.
        if (endT > 0) {
          const [tx, ty] = night.tally;
          set(el.fade, "--ix", `${(((tx + 1) / 2) * 100).toFixed(2)}%`);
          set(el.fade, "--iy", `${(((1 - ty) / 2) * 100).toFixed(2)}%`);
          // Closed, the circle's soft edge goes below zero too: no pinpoint of the tally is left over the next section.
          set(el.fade, "--ir", `${(150 * (1 - easeOutCubic(endT)) - 1.6 * endT * endT).toFixed(2)}vmax`);
        }
        attr(el.fade, "data-iris", endT > 0 && opening >= 1);
        attr(el.waking, "data-visible", !ready && inStage);
        // Between two stops the picture dips to night and back (dip.ts): the cut happens under it.
        const dip = view.dip;
        set(el.dip, "opacity", dip.toFixed(3));
        // Under the closed iris or the opening's full cover the canvas stops drawing (nightCover.ts).
        coverIn.ready = getNightReadiness() === "ready";
        coverIn.sceneIn = opening;
        coverIn.endT = endT;
        coverIn.dip = dip;
        coverIn.warm = night.warm;
        setNightCovered(nightCovered(coverIn));

        el.cards.forEach((card, i) => {
          const opacity = story.opacity[i];
          if (opacity === 0 && drawnOpacity[i] === 0 && i !== active && i !== lastActive) return;
          drawnOpacity[i] = opacity;
          set(card, "opacity", opacity.toFixed(3));
          const y = i === active ? STORY.cardRise * (1 - opacity) - nudge : -STORY.cardRise * (1 - opacity);
          set(card, "transform", `translate3d(0, ${y.toFixed(2)}px, 0)`);
          attr(card, "data-active", i === active);
        });
        if (active !== lastActive) {
          if (lastActive >= 0) attr(el.cards[lastActive], "data-ready", null);
          if (active >= 0 && scrollInput.source === "key" && el.live) {
            el.live.textContent = `${work.speaker}: ${timeline.cards[active].text ?? ""}`;
          }
          lastActive = active;
        }
        if (active >= 0) {
          const card = el.cards[active];
          set(card, "--read", (Math.round(fill * 50) / 50).toFixed(2));
          set(card, "--push", pushFlash.toFixed(2));
          attr(card, "data-ready", fill >= 1 && idle >= READY_IDLE);
        }
        attr(el.captions, "data-rewinding", rewinding);
        // Between cards, once she has stopped, one cue says how to go on.
        const between = inStage && p > titleBeat.end && p < endBeat.start && active < 0 && idle >= CUE_IDLE;
        attr(el.cue, "data-visible", between && k >= 0);

        // The stop on screen: its super, its chip, its HUD line and its reel segment.
        if (stop !== lastStop) {
          el.supers.forEach((node, i) => attr(node, "data-active", i === stop));
          el.supersRight.forEach((node) => attr(node, "data-active", Number(node.dataset.superRight) === stop));
          el.articles.forEach((node, i) => attr(node, "data-active", i === stop));
          // On a phone the captions give the top left to a stop's art that holds it (direction.ts phoneCaptions):
          // the right-hand copies fade in and the left ones out, so nothing moves (no layout shift).
          attr(stage, "data-caption-side", DIRECTION[stop]?.phoneCaptions ?? null);
          lastStop = stop;
        }
        attr(stage, "data-chrome", showChrome);
        timeline.stops.forEach((range, i) => {
          const f = clamp01((p - range.from) / Math.max(1e-6, range.to - range.from));
          set(el.reel[i], "--fill", f.toFixed(3));
        });
        attr(el.skip, "data-visible", inStage && p < endBeat.start && k >= 0);

        // The hotspot over the active board, and the reticle on its corners.
        const targetable = showChrome && dip < 0.35 && night.quadOnScreen && quadIsTargetable(night.quad, night.facing);
        const path = targetable ? quadClipPath(night.quad) : "";
        // The camera never quite rests (its hand-held life): the hit area follows it ten times a second, not every frame.
        const toggled = Boolean(path) !== Boolean(quadPath);
        if (path !== quadPath && el.hotspot && (toggled || now - quadPathAt > HOTSPOT_MS)) {
          quadPath = path;
          quadPathAt = now;
          el.hotspot.style.clipPath = path || "none";
          attr(el.hotspot, "data-live", Boolean(path));
        }
        if (!targetable && arm.via === "pointer") fire({ type: "pointermove", overQuad: false, resting: false });
        // The board moves under a still mouse (the scroll, the camera's hand-held life): its place on it moves too.
        if (arm.via === "pointer" && Number.isFinite(night.pointerU) && Number.isFinite(pointer.x)) {
          [night.pointerU, night.pointerV] = quadUv(night.quad, (pointer.x / window.innerWidth) * 2 - 1, 1 - (pointer.y / window.innerHeight) * 2);
        }
        if (el.reticle) {
          const shown = targetable && night.armTarget > 0;
          const hint = targetable && touch && active >= 0;
          // Its corners move with the camera, by transform (percent of the frame, read in container units):
          // written only while it shows, and never laid out again.
          if (shown || hint) {
            night.quad.forEach(([x, y], i) => {
              set(el.reticle, `--c${i}x`, (((x + 1) / 2) * 100).toFixed(1));
              set(el.reticle, `--c${i}y`, (((1 - y) / 2) * 100).toFixed(1));
            });
          }
          attr(el.reticle, "data-visible", shown);
          attr(el.reticle, "data-hint", hint);
        }
        attr(stage, "data-input", scrollInput.source);
        attr(stage, "data-armed", night.armTarget > 0);

        // The pedal: shown while she drives the city, her foot on the plate, the limiter in its glow.
        if (driver && el.pedal) {
          const ped = driver.pedal;
          const lv = Math.round(ped.shown * 20) / 20;
          if (lv !== drawnPedal.lv) {
            drawnPedal.lv = lv;
            set(el.pedal, "--lv", lv.toFixed(2));
          }
          const limited = active >= 0 && fill < 1;
          attr(el.pedal, "data-vis", getSceneLoading().entered && inStage && p < endBeat.start + 0.002 ? "shown" : "hidden");
          attr(el.pedal, "data-state", ped.down ? "down" : "idle");
          attr(el.pedal, "data-down", ped.down);
          attr(el.pedal, "data-lim", ped.down && limited);
          attr(el.pedal, "data-knock", limited && now - scrollGate.pushedAt < KNOCK_MS);
          attr(el.pedal, "data-turn", !ped.down && ((active >= 0 && fill >= 1 && idle >= READY_IDLE) || (between && k >= 0)));
        }

        // The dash, as in the hero: the pit limiter while a line is unread, ALL CLEAR as its wall
        // opens, her throttle on the strip, the car's speed and what it does. Not on a phone.
        if (el.dash) {
          const unreadCard = active >= 0 && fill < 1;
          const limiterFrame = stepLimiter(dashState, {
            now,
            unreadCard,
            wall: k,
            wallDone: (wall) => story.done[wall] === true,
            holding,
            sinceInput: idle,
          });
          const rate = meterRate(scrollInput.meter, now / 1000);
          const ped = driver?.pedal;
          const foot = ped?.down ? scrollInput.pedal : 0;
          const loading = getSceneLoading();
          const sinceEntered = loading.entered ? (now - loading.enteredAt) / 1000 : -1;
          fbInput.p = p;
          fbInput.sinceInput = idle;
          fbInput.sinceBackward = (now - Math.max(scrollInput.backwardAt, backAt)) / 1000;
          fbInput.pictureSpeed = pictureSpeed;
          fbInput.playing = unreadCard;
          fbInput.meterRate = Math.max(rate, foot);
          fbInput.sinceEntered = sinceEntered;
          fbInput.touch = touch;
          fbInput.unreadCard = unreadCard ? active : -1;
          fbInput.limited = unreadCard && !limiterFrame.clearing;
          stepFeedback(feedback, fbInput, realDt);
          const dashFrame = stepDash(dashState, limiterFrame, {
            now,
            realDt,
            layout,
            started: true,
            sinceEntered,
            titleOut,
            // The dash goes with the drive: from the first stop to the iris.
            p: showChrome ? 0.5 : 1,
            mode: feedback.mode,
            rate,
            foot: ped && !ped.suspended ? ped.shown : 0,
            tease: 0,
            stepAt: scrollInput.stepAt,
            pushedAt: scrollGate.pushedAt,
          });
          dashPainter.paint(
            dashFrame,
            {
              ring: Math.round(fill * 50) / 50,
              speed: speedKmh(feedback.pace),
              turn: feedback.mode === "waiting",
              remind: null,
              input: scrollInput.source,
            },
            layout === "phone",
            attr,
            set,
          );
        }

        // A press riding a drive: the page follows the frontier as the drive plays, up to the next line.
        if (carry) {
          const frontierNow = stageFrontier(walls, story);
          if (scrollInput.at !== carry.at || rewinding || !lenis || lenis.isStopped || p >= carry.to - 0.0005) carry = null;
          else {
            const want = scrollFor(Math.min(carry.to, frontierNow));
            if (want > lenis.targetScroll + 0.5) lenis.scrollTo(want, { programmatic: false, lerp: motion.scrollLerp });
          }
        }

        // A push held at a drive between two stops (a held beat, not a line) rides it: for RIDE_MS after
        // her last input trimmed at its wall, the page follows the wall as it creeps, so notches or a
        // flick a moment apart drive the beat at its own pace instead of nudging it a step at a time.
        // Wheel and swipes only (a press has its carry; the pedal pushes for itself and stops as she lets
        // go), not under a finger (it holds the page where it is) nor going back.
        const front = k >= 0 ? walls[k] : undefined;
        if (
          front?.kind === "hold" &&
          (scrollInput.source === "wheel" || scrollInput.source === "touch") &&
          !driver?.pedal.down &&
          !carry &&
          inStage &&
          lenis &&
          !lenis.isStopped &&
          !scrollGate.touching &&
          !rewinding &&
          now - scrollGate.pushedAt < RIDE_MS &&
          scrollInput.at <= scrollGate.pushedAt + 1
        ) {
          const want = scrollFor(Math.min(1, stageFrontier(walls, story)));
          if (want > lenis.targetScroll + 0.5) lenis.scrollTo(want, { programmatic: false, lerp: motion.scrollLerp });
        }

        gate(stageFrontier(walls, story), scroll, now);
      };

      const tick = (_time: number, deltaMs: number) => update(deltaMs);
      gsap.ticker.add(tick);
      update(0);

      /**
       * Skip, Esc and End, and the held pedal at the end: the walls open and
       * the page lands on the next section (STATS) with its focus, as the
       * hero's Skip lands THE USUAL SUSPECTS; the pedal glides there.
       */
      const skipToEnd = (glide = 0) => {
        openAllWalls(story);
        stageGate.maxScroll = Number.POSITIVE_INFINITY;
        const next = stage.closest("section")?.nextElementSibling;
        if (next instanceof HTMLElement) {
          if (!next.hasAttribute("tabindex")) next.setAttribute("tabindex", "-1");
          goTo(next, glide > 0 ? { glide, easing: easeOutCubic } : {});
        } else goTo(scrollFor(1) + 1, { focus: null });
      };
      actions.current = { skip: skipToEnd };

      /** One line on or back, gliding; true when it knocked on an unread line's wall. */
      const stepLine = (dir: 1 | -1, source: InputSource): boolean => {
        const now = performance.now();
        readScroll();
        const fr = stageFrontier(walls, story);
        const from = Math.min(fr, Math.max(night.p, lenis ? progressFor(lenis.targetScroll) : 0));
        const to = stageLineStep(dir, from, timeline, fr);
        recordInput(dir * 0.12 * geom.vh, source, now, geom.vh);
        const line = dir > 0 ? (stageLineStep(dir, from, timeline, Number.POSITIVE_INFINITY) ?? 1) : 0;
        const short = dir > 0 && (to === null || to < line);
        const k = stageFrontierIndex(story);
        // A drive between two stops (a held beat, not a line) is no unread line: the press rides it
        // to the next line at the drive's own pace (update), instead of knocking at its wall.
        carry = short && k >= 0 && walls[k].kind === "hold" ? { to: line, at: scrollInput.at } : null;
        const knocked = short && carry === null;
        if (knocked) {
          scrollGate.pressure += ELASTIC.knock * geom.vh;
          scrollGate.pushedAt = now;
        }
        if (to === null) return knocked;
        lenis?.scrollTo(scrollFor(to), { programmatic: false, duration: LINE_GLIDE, easing: easeOutCubic });
        driver?.glide(scrollFor(to), LINE_GLIDE);
        return knocked;
      };

      const pinnedNow = () => {
        const scroll = scrollNow();
        return scroll >= geom.top - 1 && scroll < geom.top + geom.range + 1;
      };
      driver = createPedalDriver({
        button: () => el.pedal,
        canPress: () =>
          getSceneLoading().entered && lenis !== undefined && !lenis.isStopped && getRadio().wheel === null && pinnedNow(),
        step: (source) => {
          if (night.p >= 0.999) {
            skipToEnd(PEDAL_GOON_GLIDE);
            return false;
          }
          return stepLine(1, source);
        },
        goOn: () => skipToEnd(PEDAL_GOON_GLIDE),
        frame: () => {
          const target = progressFor(scrollNow());
          if (target < -0.02 || target > 1.02) return null;
          const end = scrollFor(1);
          return {
            maxStep: STORY.maxStep,
            end,
            wall: Math.min(stageGate.maxScroll, end),
            wallIndex: stageFrontierIndex(story),
            vh: geom.vh,
            atEnd: night.p >= 0.999,
            backAt,
            frozen: false,
          };
        },
        readScroll,
      });

      const onKey = (event: KeyboardEvent) => {
        if (event.defaultPrevented || !lenis || lenis.isStopped || popoverOpen()) return;
        const loading = getSceneLoading();
        if (!loading.entered || event.timeStamp - loading.enteredAt < KEY_GUARD_MS) return;
        const scroll = scrollNow();
        // Pinned, or resting at the very end, where the pedal still goes on.
        const pinned = scroll >= geom.top - 1 && scroll <= geom.top + geom.range + 1;
        if (!pinned) return;
        const onPedal = event.target instanceof Element && el.pedal !== null && el.pedal.contains(event.target);
        const action = keyAction({
          key: event.key,
          code: event.code,
          onPedal,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          targetKind: onPedal ? "other" : targetKind(event.target),
        });
        if (!action) return;
        // W and Space are the pedal, as in the hero: down drives, up lets go; their autorepeat is its
        // heartbeat. To the very end of the drive, so the browser's own Space never scrolls past it.
        const gas = action === "gas" || (action === "next" && (event.key === " " || event.key === "Spacebar"));
        if (gas) {
          event.preventDefault();
          driver?.holdKey(event);
          return;
        }
        // Every wall open: the page's own keys again.
        if (stageFrontierIndex(story) < 0) return;
        event.preventDefault();
        // Enter on the focused pedal is a tap on it.
        if (onPedal && event.key === "Enter") {
          if (!event.repeat && driver?.press("key", event.timeStamp)) driver.letGo(event.timeStamp);
          return;
        }
        const now = performance.now();
        const vh = geom.vh;
        switch (action) {
          case "next":
            stepLine(1, "key");
            break;
          case "prev":
            stepLine(-1, "key");
            break;
          case "down": {
            recordInput(0.12 * vh, "key", now, vh);
            const dest = Math.min(lenis.targetScroll + 0.12 * vh, stageGate.maxScroll);
            if (dest > lenis.targetScroll + 0.5) lenis.scrollTo(dest, { programmatic: false, lerp: motion.scrollLerp });
            else {
              scrollGate.pressure += 0.12 * vh;
              scrollGate.pushedAt = now;
            }
            break;
          }
          case "up":
            recordInput(-0.12 * vh, "key", now, vh);
            lenis.scrollTo(Math.max(geom.top, lenis.targetScroll - 0.12 * vh), {
              programmatic: false,
              lerp: motion.scrollLerp,
            });
            break;
          case "home":
            recordInput(-vh, "key", now, vh);
            lenis.scrollTo(geom.top, { programmatic: false, duration: 0.8, easing: easeOutCubic });
            break;
          case "skip":
            skipToEnd();
            break;
        }
      };

      /** A tap on the picture plays the next line; on a board it arms or opens. */
      let press: null | { id: number; x: number; y: number; at: number; button: number; type: string; last: number } =
        null;
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("button, a, [role='button'], [data-skip], [popover]")) {
          press = null;
          return;
        }
        press = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          at: performance.now(),
          button: event.button,
          type: event.pointerType,
          last: scrollInput.at,
        };
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!press || event.pointerId !== press.id) return;
        const down = press;
        press = null;
        const now = performance.now();
        const onBoard = Boolean(quadPath) && overBoard(event.clientX, event.clientY);
        if (onBoard) {
          if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10) return;
          fire({ type: "tap", pointerType: down.type, overQuad: true, heldMs: now - down.at, at: now });
          // Where it landed, for a light that settles there (Logixs' searchlight).
          if (arm.armed) [night.tapU, night.tapV] = boardUv(event.clientX, event.clientY);
          return;
        }
        if (!getSceneLoading().entered || night.p >= 1) return;
        const tap = isPictureTap({
          dx: event.clientX - down.x,
          dy: event.clientY - down.y,
          ms: now - down.at,
          sinceScroll: down.at - down.last,
          button: down.button,
        });
        // A mouse click is answered in its own words ("click to keep driving"); a pen or a finger is a tap.
        if (tap) stepLine(1, down.type === "mouse" ? "click" : "touch");
      };
      const overBoard = (clientX: number, clientY: number) => {
        const x = (clientX / window.innerWidth) * 2 - 1;
        const y = 1 - (clientY / window.innerHeight) * 2;
        return insideQuad(night.quad, x, y);
      };
      const boardUv = (clientX: number, clientY: number) =>
        quadUv(night.quad, (clientX / window.innerWidth) * 2 - 1, 1 - (clientY / window.innerHeight) * 2);

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        const resting = event.clientX === pointer.x && event.clientY === pointer.y;
        pointer = { x: event.clientX, y: event.clientY };
        const over = Boolean(quadPath) && overBoard(event.clientX, event.clientY);
        fire({ type: "pointermove", overQuad: over, resting });
        if (over) [night.pointerU, night.pointerV] = boardUv(event.clientX, event.clientY);
        else {
          night.pointerU = Number.NaN;
          night.pointerV = Number.NaN;
        }
      };
      const onPointerLeave = () => {
        night.pointerU = Number.NaN;
        night.pointerV = Number.NaN;
        if (arm.via === "pointer") fire({ type: "pointermove", overQuad: false, resting: false });
      };

      /** Focus on a chip arms its board and glides there; focus past the stage opens its walls. */
      const onFocusIn = (event: FocusEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const chip = target.closest<HTMLElement>("[data-chip]");
        if (chip && stage.contains(chip)) {
          const i = el.chips.indexOf(chip);
          const range = timeline.stops[i];
          if (!range) return;
          const firstCard = timeline.cards.find((card) => card.stop === i);
          const to = firstCard ? (firstCard.start + firstCard.end) / 2 : range.from;
          openWallsUpTo(walls, story, to);
          fire({ type: "focus", at: performance.now() });
          if (lenis && Math.abs(night.p - to) > 0.002) {
            lenis.scrollTo(scrollFor(to), { programmatic: false, duration: CHIP_GLIDE, easing: easeInOutCubic });
          }
          return;
        }
        if (stage.contains(target)) return;
        if (stage.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) {
          if (stageFrontierIndex(story) >= 0) openAllWalls(story);
        }
      };
      const onFocusOut = (event: FocusEvent) => {
        if (event.target instanceof Element && event.target.closest("[data-chip]")) fire({ type: "blur" });
      };

      // A link to a stop (the route, STATS' missions, a deep link) opens the walls up to it; one past the city opens them all.
      const unregisterPassage = registerPassage({
        key: "work",
        section: stage,
        open: () => {
          openAllWalls(story);
          stageGate.maxScroll = Number.POSITIVE_INFINITY;
        },
        openTo: (y) => {
          const landed = progressFor(y);
          if (landed >= 1) openAllWalls(story);
          else openWallsUpTo(walls, story, clamp01(landed));
          stageGate.maxScroll = Number.POSITIVE_INFINITY;
        },
      });

      const hotspot = el.hotspot;
      window.addEventListener("keydown", onKey);
      window.addEventListener("resize", measure);
      window.addEventListener(SUBTITLES_EVENT, fitLines);
      document.addEventListener("visibilitychange", onVisibility);
      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointerup", onPointerUp);
      sticky?.addEventListener("pointermove", onPointerMove);
      sticky?.addEventListener("pointerleave", onPointerLeave);
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("focusout", onFocusOut);

      if (process.env.NODE_ENV !== "production") {
        (window as DevWindow).__vaStage = (at) => {
          const p = typeof at === "number" ? clamp01(at) : clamp01(resolve(at));
          openWallsUpTo(walls, story, p);
          const card = activeCardAt(p, timeline);
          if (card >= 0) story.opacity[card] = 1;
          const y = scrollFor(p);
          stageGate.maxScroll = Number.POSITIVE_INFINITY;
          if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
          update(0);
          // The capture sees the shot itself, not the camera still gliding to it.
          night.snap = true;
        };
        (window as DevWindow).__vaStageGate = stageGate;
        (window as DevWindow).__vaArm = (on = true) => {
          arm = on ? { armed: true, armedAt: performance.now(), via: "focus" } : DISARMED;
          night.armTarget = on ? 1 : 0;
          night.armed = on ? 1 : 0;
        };
      }
      const resolve = (at: string) => {
        const [id, inside] = at.split("@");
        const beat = timeline.beats.find((b) => b.id === id);
        if (!beat) return Number(at) || 0;
        if (inside === undefined) return beat.kind === "card" ? (beat.start + beat.end) / 2 : beat.end - 1e-4;
        return beat.start + (beat.end - beat.start) * clamp01(Number(inside));
      };

      return () => {
        gsap.ticker.remove(tick);
        setNightCovered(false);
        driver?.dispose();
        driver = null;
        unregisterPassage();
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", measure);
        window.removeEventListener(SUBTITLES_EVENT, fitLines);
        fontsWaiting = false;
        document.removeEventListener("visibilitychange", onVisibility);
        resizeObserver?.disconnect();
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointerup", onPointerUp);
        sticky?.removeEventListener("pointermove", onPointerMove);
        sticky?.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("focusout", onFocusOut);
        if (hotspot) hotspot.style.clipPath = "none";
        stageGate.maxScroll = Number.POSITIVE_INFINITY;
        stageGate.pinFrom = Number.POSITIVE_INFINITY;
        stageGate.pinTo = Number.NEGATIVE_INFINITY;
        actions.current = null;
        delete (window as DevWindow).__vaStage;
        delete (window as DevWindow).__vaArm;
        delete (window as DevWindow).__vaStageGate;
      };
    },
    { scope: root, dependencies: [reducedMotion, timeline, walls, lenis], revertOnUpdate: true },
  );

  const onSkip = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    actions.current?.skip();
  };
  const stopSkipPress = (event: ReactPointerEvent) => event.stopPropagation();

  return (
    <div ref={root} className={styles.stage} data-ready={readiness} data-work-stage>
      {/* The chapter card, the section's heading: over the night at the film's start, over the plates without it. */}
      <div className={styles.chapterBand} data-title>
        <ChapterCard id="work-title" chapter={work.chapter} lang={locale} />
      </div>
      <p className="sr-only">
        {work.speaker}: {work.bridge}
      </p>
      <p id="work-help" className="sr-only">
        {reducedMotion ? work.helpStill : work.help}
      </p>
      <div className={styles.sticky} data-sticky data-radio-surface data-work-sticky>
        {reducedMotion ? null : <NightCanvas timeline={timeline} work={work} locale={locale} />}
        {/* The dip to night between two stops, over the picture and under the chrome. */}
        <div className={styles.dip} data-dip aria-hidden="true" />
        <div className={styles.sceneLabel} role="img" aria-label={work.sceneLabel} />
        <div className={`${styles.scrim} ${styles.scrimTop}`} aria-hidden="true" />
        <div className={`${styles.scrim} ${styles.scrimBottom}`} aria-hidden="true" />
        <div className={`${styles.bar} ${styles.barTop}`} data-bar="top" aria-hidden="true" />
        <div className={`${styles.bar} ${styles.barBottom}`} data-bar="bottom" aria-hidden="true" />

        {/* The hit area of the board on screen: its clip-path is the board's projected quad. */}
        <div className={styles.hotspot} data-hotspot aria-hidden="true" />
        <div className={styles.reticle} data-reticle aria-hidden="true">
          <span data-corner="0" />
          <span data-corner="1" />
          <span data-corner="2" />
          <span data-corner="3" />
        </div>

        <p className={styles.hud} aria-hidden="true">
          <span className={styles.hudTitle}>{work.eyebrow}</span>
        </p>
        {/* The same captions on the right, for a stop whose art holds the top left on a portrait screen
            (direction.ts phoneCaptions). A copy that fades in, never the left one moved: moving it was a layout shift. */}
        <p className={`${styles.hud} ${styles.hudRight}`} aria-hidden="true">
          <span className={styles.hudTitle}>{work.eyebrow}</span>
        </p>

        {/* The route: one link per stop, filling as the car gets there. */}
        <nav className={styles.reel} aria-label={work.reel}>
          {STOPS.map((stop) => (
            <a key={stop.id} className={styles.reelStop} href={`#${stop.anchor}`} aria-label={`${work.stop} ${stop.index}: ${work.stops[stop.id].h3}`}>
              <span className={styles.reelLabel} aria-hidden="true">
                {work.stop} {stop.index}
              </span>
              <span className={styles.reelSegment} aria-hidden="true">
                <span className={styles.reelFill} data-reel-fill />
              </span>
            </a>
          ))}
        </nav>

        <div className={styles.supers} aria-hidden="true">
          {STOPS.map((stop) => (
            <p key={stop.id} className={styles.super} data-super>
              {work.stop} {String(stop.index).padStart(2, "0")}/{String(STOPS.length).padStart(2, "0")} · {work.stops[stop.id].h3}
              <span className={styles.superLine}>{work.stops[stop.id].line}</span>
            </p>
          ))}
        </div>
        <div className={`${styles.supers} ${styles.supersRight}`} aria-hidden="true">
          {STOPS.map((stop, i) =>
            DIRECTION[i]?.phoneCaptions === "right" ? (
              <p key={stop.id} className={styles.super} data-super-right={i}>
                {work.stop} {String(stop.index).padStart(2, "0")}/{String(STOPS.length).padStart(2, "0")} · {work.stops[stop.id].h3}
                <span className={styles.superLine}>{work.stops[stop.id].line}</span>
              </p>
            ) : null,
          )}
        </div>

        <ul className={styles.subtitles} aria-hidden="true" data-captions>
          {timeline.cards.map((card) => (
            <li key={card.id} className={styles.subtitle} data-card>
              {/* The hero's card: one block around the whole line, balanced, as wide as its widest line (hero/fitCards.ts). */}
              <span className={styles.subtitleText} data-card-text>
                <span className={styles.speaker}>{work.speaker}:</span> {card.text}
              </span>
              {/* Under the block: the way on in her input's words, once the line is read and she waits.
                  The reading bar fills in the same place before it (::after). */}
              <span className={styles.cueTail}>
                <span className={styles.cueArrow} />
                <span className={styles.cueLabel}>
                  <span className={styles.forWheel}>{cues.next}</span>
                  <span className={styles.forTouch}>{cues.nextTouch}</span>
                  <span className={styles.forClick}>{cues.nextClick}</span>
                  <span className={styles.forPedal}>{cues.nextPedal}</span>
                  <span className={styles.forKey}>{cues.nextKey}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className={styles.cue} data-cue aria-hidden="true">
          <span className={styles.forWheel}>{cues.keepGoing}</span>
          <span className={styles.forTouch}>{cues.keepGoingTouch}</span>
          <span className={styles.forClick}>{cues.keepGoingClick}</span>
          <span className={styles.forPedal}>{cues.keepGoingPedal}</span>
          <span className={styles.forKey}>{cues.keepGoingKey}</span>
        </p>

        <div className={styles.skip} data-skip onPointerDown={stopSkipPress}>
          <Button
            variant="ghost"
            size="sm"
            className={styles.skipButton}
            aria-label={work.skipLabel}
            aria-keyshortcuts="Escape End"
            onClick={onSkip}
          >
            {cues.skip}
            <kbd className={styles.skipKey} aria-hidden="true">
              Esc
            </kbd>
          </Button>
        </div>

        {/* The hero's dash, the same display (none on a phone), in the city's corner. */}
        <Dash osd={osd} cues={cues} className={styles.cityDash} />

        {/* The hero's pedal, the same button: press for the next line, hold to drive. */}
        <Pedal label={pedalCopy.label} tag={pedalCopy.tag} help={pedalCopy.help} />

        <p className="sr-only" aria-live="polite" data-live />

        <div className={styles.fade} data-fade aria-hidden="true">
          <p className={styles.waking} data-waking>
            {work.waking}
          </p>
        </div>
      </div>

      {children}

    </div>
  );
}
