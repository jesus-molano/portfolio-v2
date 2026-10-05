"use client";

import { useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import { Button } from "@/components/ui/Button";
import { motion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Hero.module.css";
import { HeroCanvas } from "./HeroCanvas";
import { HeroTitle } from "./HeroTitle";
import { registerHeroEnd } from "./heroEnd";
import { getSceneLoading } from "./sceneLoading";
import { titleIntro } from "./titleIntro";
import { decay, ELASTIC, rubberBand, touchStretchMax } from "./scroll/elastic";
import {
  heroFeedback,
  heroProgress,
  type InputSource,
  recordInput,
  resetInput,
  scrollGate,
  scrollInput,
  STATIC_PROGRESS,
} from "./scroll/heroProgress";
import {
  buildWalls,
  frontier,
  frontierIndex,
  heroTimeline,
  lineStep,
  newStory,
  openAll,
  openUpTo,
  readFill,
  stepStory,
  type Story,
  STORY,
} from "./scroll/story";
import { easePace, fovKick, meterRate, paceTarget, THROTTLE } from "./scroll/throttle";
import {
  CUE_LABELS,
  driveWaits,
  FIGHT,
  fightLevel,
  hintOpacity,
  HOLD_NOTE,
  isPictureTap,
  keyAction,
  PROMPT,
  promptFor,
  type PromptInput,
  REMINDERS,
  skipTapAllowed,
  speedKmh,
  type TargetKind,
  TEASES,
  teaseOffset,
  transportMode,
  type TransportMode,
} from "./scroll/transport";
import { drive } from "./scene/drive";
import { SHOT_COUNT, shotIndexAt, stickyShot } from "./scene/shots";

gsap.registerPlugin(useGSAP);

type HeroCopy = Dictionary["hero"];

type Props = {
  name: string;
  role: string;
  tagline: string;
  /** Hints, cues and the screen-reader help for the scrubbed film. */
  intro: HeroCopy["intro"];
  /** Words of the dashboard readout. */
  osd: HeroCopy["osd"];
  skip: string;
  /** Accessible name of Skip; it contains the visible `skip`. */
  skipLabel: string;
  /** Prefix Skip shows when the visitor seems in a hurry. */
  skipHurry: string;
  sceneLabel: string;
  hud: { title: string; subtitle: string; camera: string };
  /** One label per shot, shown in the HUD. */
  shots: string[];
  /** Speaker name for the subtitles. */
  speaker: string;
  /** Script lines, in order; each line is one or more subtitle cards. */
  lines: string[][];
  /** Copy of the rooftop billboards in the city, one line per board. */
  billboards: string[];
};

/** Seconds after entering: the hint and Skip pop in, then the hint blinks like PRESS START. */
const HINT_AT = PROMPT.hintAt;
const BLINK_AT = 2.8;
/** If the title reveal never reports (a failed timeline), the title wall still opens. */
const INTRO_FAILSAFE = 5;
/** Key presses this soon after the one that entered the site are ignored (ms). */
const KEY_GUARD_MS = 100;
/** Glides of the line keys and Home, seconds. */
const LINE_GLIDE = 0.6;
const HOME_GLIDE = 0.8;
/** Held pixels one overshoot may add to the pressure. */
const OVERSHOOT_CAP = 400;
/** The picture moving back more than this many pixels in a frame is going back. */
const BACK_SLOP_PX = 1.5;
/** A native jump past the wall is set back beyond this many pixels. */
const SNAP_SLOP = 4;
/** After the viewport changed and the film was put back in place (ms), the gate lets the page settle. */
const RESEAT_MS = 250;
/** The gate trimmed input this recently (ms): a wall is holding her. */
const HOLDING_MS = 300;
/** Focus that lands this soon after a pointer press (ms) came from the pointer, not the keyboard. */
const POINTER_FOCUS_MS = 1000;
/** Reminder lift of a read card and attract lift of the title (px), attract slide of the bars (%). */
const REMINDER_LIFT = 8;
const TEASE_LIFT = 12;
const TEASE_BARS = 8;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Writes a style property only when it changed, to keep the frame cheap.
 * `clear` removes everything it wrote, so the CSS (for example the stacked
 * transcript under reduced motion) takes over again.
 */
function styleSetter() {
  const last = new Map<HTMLElement, Map<string, string>>();
  const set = (element: HTMLElement | null | undefined, property: string, value: string) => {
    if (!element) return;
    let props = last.get(element);
    if (!props) last.set(element, (props = new Map()));
    if (props.get(property) === value) return;
    props.set(property, value);
    element.style.setProperty(property, value);
  };
  const clear = () => {
    last.forEach((props, element) => props.forEach((_, property) => element.style.removeProperty(property)));
    last.clear();
  };
  return { set, clear };
}

/** The same for attributes: `true` sets an empty one, `false` or null removes it. */
function attrSetter() {
  const last = new Map<Element, Map<string, string | null>>();
  const attr = (element: Element | null | undefined, name: string, value: string | boolean | null) => {
    if (!element) return;
    const next = value === true ? "" : value === false ? null : value;
    let names = last.get(element);
    if (!names) last.set(element, (names = new Map()));
    if (names.has(name) && names.get(name) === next) return;
    names.set(name, next);
    if (next === null) element.removeAttribute(name);
    else element.setAttribute(name, next);
  };
  const clear = () => {
    last.forEach((names, element) => names.forEach((_, name) => element.removeAttribute(name)));
    last.clear();
  };
  return { attr, clear };
}

/**
 * What has focus, for the key map. A control that took the focus from a
 * pointer press (`clicked`), directly or handed back by a dialog the press
 * closed, does not keep Space: after using the radio with the mouse, Space
 * plays the next line instead of opening the radio again. A control
 * reached with the keyboard keeps it.
 */
function targetKind(target: EventTarget | null, clicked: Element | null): TargetKind {
  if (!(target instanceof Element)) return "other";
  if (target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return "text";
  const control = target.closest("button, [role='button'], a[href]");
  if (!control || control === clicked) return "other";
  return control.tagName === "A" ? "link" : "button";
}

type Probe = Record<string, number | string | boolean | null>;
type DevWindow = Window & { __vaJump?: (p: number) => void; __vaProbe?: Probe[] };

/** What the JSX hands to the running stage. */
type StageActions = {
  skip: (event?: MouseEvent<HTMLButtonElement>) => void;
  skipPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

/**
 * The tall scrolling stage: a sticky viewport with the canvas, the title,
 * the letterbox bars, the HUD, the readout and the subtitles. The scroll
 * is the picture (scroll/story.ts): every element here is drawn from the
 * same film position, the scroll clamped to the story's frontier, so the
 * camera, the subtitles and the fades always agree and stop when the
 * visitor stops. Input held at a wall shows up as a card bounce, the
 * world's pace and the readout; once she stops, the car slows to a crawl
 * and one prompt says what to do next. Shots change with clean hard cuts.
 *
 * The frame reads no layout: the scroll comes from Lenis, and the stage's
 * geometry is measured only when the viewport changes.
 */
export function HeroStage({
  name,
  role,
  tagline,
  intro,
  osd,
  skip,
  skipLabel,
  skipHurry,
  sceneLabel,
  hud,
  shots,
  speaker,
  lines,
  billboards,
}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const actions = useRef<StageActions | null>(null);
  /** The story outlives a re-run of the stage effect (a new Lenis, a hot reload). */
  const kept = useRef<{ key: string; story: Story } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const lenis = useLenis();
  const [shot, setShot] = useState(0);

  const timeline = useMemo(() => heroTimeline(lines), [lines]);
  const walls = useMemo(() => buildWalls(timeline), [timeline]);
  const cardTexts = useMemo(() => lines.flat(), [lines]);

  useGSAP(
    () => {
      const root = stage.current;
      if (!root) return;
      const sticky = root.querySelector<HTMLElement>("[data-sticky]");

      /**
       * Cuts to the end of the drive, like skipping a cutscene: the page
       * lands with the hero's last pixel just gone, so the section after it
       * (THE USUAL SUSPECTS, `#suspects`) starts at the top of the screen,
       * and that section takes the focus, so the keyboard carries on from
       * there instead of from the top of the page. anchors.test.ts checks
       * that the hero is followed by a section that can take it.
       */
      const jumpToEnd = () => {
        heroProgress.value = heroProgress.target = 1;
        scrollGate.maxScroll = Number.POSITIVE_INFINITY;
        const hero = root.closest("section") ?? root;
        const end = hero.getBoundingClientRect().bottom + window.scrollY;
        if (lenis) lenis.scrollTo(end, { immediate: true, force: true });
        else window.scrollTo(0, end);
        const next = hero.nextElementSibling;
        if (next instanceof HTMLElement) {
          if (!next.hasAttribute("tabindex")) next.setAttribute("tabindex", "-1");
          next.focus({ preventScroll: true });
        }
      };

      if (reducedMotion) {
        heroProgress.value = heroProgress.target = STATIC_PROGRESS;
        scrollGate.maxScroll = Number.POSITIVE_INFINITY;
        setShot(shotIndexAt(STATIC_PROGRESS));
        actions.current = { skip: jumpToEnd, skipPointerDown: () => {} };
        const unregister = registerHeroEnd({ section: root.closest("section") ?? root, cut: jumpToEnd });
        return () => {
          unregister();
          actions.current = null;
        };
      }

      /**
       * The pinned stage on the page, measured when the viewport changes,
       * never in the frame. The film runs from the stage's top to where the
       * sticky viewport unpins (the stage's height less the viewport's own),
       * so p = 1 is exactly the unpin, whatever the address bar does.
       */
      const geom = { top: 0, range: 1, vh: window.innerHeight };
      const measure = () => {
        const rect = root.getBoundingClientRect();
        geom.top = rect.top + window.scrollY;
        geom.range = Math.max(1, rect.height - (sticky?.offsetHeight ?? window.innerHeight));
        geom.vh = window.innerHeight;
      };
      measure();
      /** Scroll position (px) of a film position, and back. */
      const scrollFor = (p: number) => geom.top + p * geom.range;
      const progressFor = (y: number) => (y - geom.top) / geom.range;
      /** Where the page is, without a layout read: Lenis tracks native scrolls too. */
      const scrollNow = () => (lenis ? lenis.scroll : window.scrollY);

      // Where the page already is: a re-run must never pull the visitor back
      // to the title, so the story is kept, or opened up to the scroll.
      const pNow = clamp01(progressFor(window.scrollY));
      const key = walls.map((wall) => `${wall.kind}:${wall.from.toFixed(5)}:${wall.to.toFixed(5)}`).join("|");
      if (kept.current?.key !== key) {
        kept.current = { key, story: newStory(walls, timeline.beats.length) };
        if (pNow > 0) openUpTo(walls, kept.current.story, pNow);
      }
      const story = kept.current.story;
      resetInput();
      heroProgress.value = heroProgress.target = pNow;

      let reseatAt = Number.NEGATIVE_INFINITY;
      /**
       * The viewport changed (a rotation, a resized window, the address
       * bar): the stage changed height, so the same pixel scroll is another
       * film position. The film keeps its place instead, and the gate does
       * not take the move for a jump of hers.
       */
      const remeasure = () => {
        const p = heroProgress.target;
        const before = { top: geom.top, range: geom.range };
        measure();
        if (Math.abs(before.top - geom.top) < 0.5 && Math.abs(before.range - geom.range) < 0.5) return;
        if (!lenis || !(p > 0 && p < 1)) return;
        // Lenis measures its own limit later (debounced): the new position must not be clamped to the old one.
        lenis.resize();
        lenis.scrollTo(scrollFor(p), { immediate: true, force: true });
        reseatAt = performance.now();
      };
      const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => remeasure());
      resizeObserver?.observe(root);
      if (sticky) resizeObserver?.observe(sticky);

      /** The first frame after the tab comes back counts no time: nothing was seen meanwhile. */
      let wasHidden = false;
      const onVisibility = () => {
        if (document.visibilityState !== "visible") wasHidden = true;
      };

      const q = (selector: string) => root.querySelector<HTMLElement>(selector);
      const el = {
        hint: q("[data-hint]"),
        barTop: q("[data-bar='top']"),
        barBottom: q("[data-bar='bottom']"),
        fade: q("[data-fade]"),
        captions: q("[data-captions]"),
        cue: q("[data-cue]"),
        holdNote: q("[data-hold-note]"),
        endCue: q("[data-end-cue]"),
        osd: q("[data-osd]"),
        speed: q("[data-speed]"),
        reel: Array.from(root.querySelectorAll<HTMLElement>("[data-reel-fill]")),
        skip: q("[data-skip]"),
        live: q("[data-live]"),
        cards: Array.from(root.querySelectorAll<HTMLElement>("[data-card]")),
      };
      const { set, clear } = styleSetter();
      const { attr, clear: clearAttrs } = attrSetter();

      let currentShot = -1;
      let started = pNow > 0;
      let startedAt = Number.NEGATIVE_INFINITY;
      let lastP = pNow;
      /** performance.now() when the picture last moved back (a fling still coasting counts). */
      let backAt = Number.NEGATIVE_INFINITY;
      let pushFlash = 0;
      let lastPushedAt = scrollGate.pushedAt;
      let pressureAfter = 0;
      let heldRecent = 0;
      let pace = 1;
      let lastActive = -1;
      let readyCard = -1;
      let readyCount = 0;
      let readyParity = 0;
      let cueLabel = false;
      let reminderIdx = 0;
      let reminderAt = Number.NEGATIVE_INFINITY;
      let holdShows = 0;
      let holdWall = -1;
      let fight = 0;
      const skipState = {
        visible: false,
        shownAt: Number.NEGATIVE_INFINITY,
        until: Number.NEGATIVE_INFINITY,
        shows: 0,
        lastAt: Number.NEGATIVE_INFINITY,
        down: null as null | { type: string; x: number; y: number; at: number },
      };
      let teaseIdx = 0;
      let teaseAt = Number.NEGATIVE_INFINITY;
      let blinkParity = 0;
      let mode: TransportMode = "hidden";
      let pulseParity = 0;
      let shownSpeed = -1;
      /** What the last frame drew, so a resting card or reel segment costs nothing. */
      const drawnOpacity = el.cards.map(() => -1);
      const drawnFill = el.reel.map(() => -1);

      /** Offers Skip ("in a hurry?") for a while. */
      const expandSkip = (now: number, force = false) => {
        if (!skipState.visible || now < skipState.until) return;
        if (!force && (skipState.shows >= FIGHT.maxShows || now - skipState.lastAt < FIGHT.cooldown * 1000)) return;
        skipState.until = now + FIGHT.show * 1000;
        skipState.shows += 1;
        skipState.lastAt = now;
        fight = 0;
      };

      /**
       * Keeps the page scroll at the frontier. Wheel and touch moves are
       * trimmed in SmoothScroll; touch inertia aimed past the wall glides
       * into it here, and native jumps (scrollbar, find in page, anchors)
       * are set back. Both count as pressure. `scroll` is this frame's
       * scroll, read before anything was written.
       */
      const gate = (fr: number, now: number, scroll: number) => {
        scrollGate.maxScroll = Number.isFinite(fr) ? scrollFor(fr) : Number.POSITIVE_INFINITY;
        if (!lenis || lenis.isStopped || !Number.isFinite(scrollGate.maxScroll)) return;
        const max = scrollGate.maxScroll;
        if (lenis.isScrolling === "smooth" && lenis.targetScroll > max + 1) {
          scrollGate.pressure += Math.min(lenis.targetScroll - max, OVERSHOOT_CAP);
          scrollGate.pushedAt = now;
          lenis.scrollTo(max, { programmatic: false, lerp: motion.touchLerp, force: true });
          return;
        }
        // The viewport just changed and the film was put back in place: not a jump of hers.
        if (now - reseatAt < RESEAT_MS) return;
        const over = scroll - max;
        if (over > SNAP_SLOP) {
          scrollGate.pressure += Math.min(over, OVERSHOOT_CAP);
          scrollGate.pushedAt = now;
          // A jump of a whole viewport: she clearly wants to move on.
          if (over >= FIGHT.jumpVh * geom.vh) expandSkip(now, true);
          lenis.scrollTo(max, { immediate: true, force: true });
        }
      };

      /** One frame of the story and everything drawn from it. Reads first, then writes. */
      const update = (deltaMs: number) => {
        const now = performance.now();
        const scroll = scrollNow();
        let dt = Math.min(Math.max(0, deltaMs) / 1000, STORY.maxStep);
        const visible = document.visibilityState === "visible";
        if (visible && wasHidden) {
          wasHidden = false;
          dt = 0;
        }
        const loading = getSceneLoading();
        const sinceEntered = loading.entered ? (now - loading.enteredAt) / 1000 : -1;
        const vh = geom.vh;

        heroProgress.target = clamp01(progressFor(scroll));
        const fr = frontier(walls, story);
        const pStory = clamp01(Math.min(heroProgress.target, fr));
        // The picture keeps its shot within a hair of a cut, so a resting finger never strobes.
        const picture = stickyShot(pStory, currentShot);
        const p = picture.p;
        heroProgress.value = p;
        // Going back, by input or a fling still coasting: no card comes up.
        // A sub-pixel dip (the page put back in place after a rotation) is not going back.
        if ((lastP - p) * geom.range > BACK_SLOP_PX) backAt = now;
        const lastBack = Math.max(scrollInput.backwardAt, backAt);
        const rewinding = now - lastBack < STORY.rewindHide * 1000;
        const pictureSpeed = dt > 0 ? Math.abs(p - lastP) / dt : 0;
        lastP = p;

        const introDone = titleIntro.done || sinceEntered > INTRO_FAILSAFE;
        const active = stepStory(walls, story, timeline, pStory, dt, {
          rewinding,
          visible,
          introDone,
          introProgress: titleIntro.progress(),
        });
        const k = frontierIndex(story);

        // The first forward input: the drive starts and the title hurries up.
        if (!started && loading.entered && scrollInput.forwardAt >= loading.enteredAt) {
          started = true;
          startedAt = now;
          titleIntro.hurry();
        }
        const sinceStart = (now - startedAt) / 1000;

        // Held input: a bounce under the wheel, a stretch under the finger.
        const touchMode = scrollGate.touching || scrollInput.source === "touch";
        const added = Math.max(0, scrollGate.pressure - pressureAfter);
        if (!scrollGate.touching) {
          scrollGate.pressure = decay(
            scrollGate.pressure,
            dt,
            scrollInput.source === "touch" ? ELASTIC.releaseTau : ELASTIC.wheelTau,
          );
          if (scrollGate.pressure < 0.05) scrollGate.pressure = 0;
        }
        pressureAfter = scrollGate.pressure;
        heldRecent = decay(heldRecent, dt, HOLD_NOTE.tau) + added;
        if (scrollGate.pushedAt !== lastPushedAt) {
          lastPushedAt = scrollGate.pushedAt;
          pushFlash = 1;
        } else {
          pushFlash = decay(pushFlash, dt, ELASTIC.pushTau);
        }
        const nudge = touchMode
          ? rubberBand(scrollGate.pressure, touchStretchMax(vh))
          : rubberBand(Math.max(0, scrollGate.pressure - ELASTIC.wheelDeadZone), ELASTIC.wheelMax);

        // The readout, and the world: it surges with her push and, once she
        // has stopped, slows to a crawl and waits for her (DriveClock reads
        // the pace, CameraRig the kick).
        const idle = (now - scrollInput.at) / 1000;
        const nextMode = transportMode({
          started,
          p,
          sinceInput: idle,
          sinceBackward: (now - lastBack) / 1000,
          pictureSpeed,
          pace,
        });
        // The idle title screen teases the drive a few times: the car revs.
        if (!started && sinceEntered >= 0 && teaseIdx < TEASES.length && sinceEntered >= TEASES[teaseIdx]) {
          teaseIdx += 1;
          teaseAt = now;
          blinkParity = blinkParity === 1 ? 2 : 1;
        }
        if (sinceEntered >= BLINK_AT && blinkParity === 0) blinkParity = 1;
        const tease = teaseOffset((now - teaseAt) / 1000);
        const waiting = driveWaits({ mode: nextMode, started, sinceEntered, teasing: tease > 0 });
        pace = easePace(pace, paceTarget(meterRate(scrollInput.meter, now / 1000), waiting), dt);
        heroFeedback.pace = pace;
        heroFeedback.fovKick = fovKick(pace);

        // A read card that waits for her: the marker bobs, labelled at first.
        const fill = active >= 0 ? readFill(walls, story, active) : 0;
        const ready = active >= 0 && fill >= 1 && idle >= STORY.readyIdle;
        if (ready && readyCard !== active) {
          readyCard = active;
          readyCount += 1;
          readyParity = readyParity === 1 ? 2 : 1;
          reminderIdx = 0;
          reminderAt = Number.NEGATIVE_INFINITY;
          cueLabel = readyCount <= CUE_LABELS;
        } else if (!ready) {
          readyCard = -1;
          cueLabel = false;
        }
        if (ready && reminderIdx < REMINDERS.length && idle >= REMINDERS[reminderIdx]) {
          reminderIdx += 1;
          reminderAt = now;
          readyParity = readyParity === 1 ? 2 : 1;
          cueLabel = true;
        }
        const reminderLift = REMINDER_LIFT * teaseOffset((now - reminderAt) / 1000);

        // Pushing into an unread card: the note says why at once, the first
        // times; pushing at full throttle for long, Skip offers itself.
        const holding = scrollGate.pressure > 0 && now - scrollGate.pushedAt < HOLDING_MS;
        const unreadCard = k >= 0 && walls[k].kind === "card" && active === walls[k].card;
        if (
          unreadCard &&
          heldRecent >= HOLD_NOTE.share * vh &&
          holdWall !== k &&
          holdShows < HOLD_NOTE.maxShows
        ) {
          holdWall = k;
          holdShows += 1;
        }
        const holdNote = holdWall >= 0 && holdWall === k && unreadCard;
        fight = fightLevel(fight, pace >= THROTTLE.ff && holding && k >= 0, dt);
        if (fight >= FIGHT.expandAt) expandSkip(now);

        // Skip shows with the hint, so there is always a way out, until the fade.
        const skipVisible = (started || sinceEntered >= HINT_AT) && p < STORY.fadeFrom;
        if (skipVisible && !skipState.visible) skipState.shownAt = now;
        skipState.visible = skipVisible;
        if (!skipVisible) skipState.until = Number.NEGATIVE_INFINITY;
        const skipExpanded = now < skipState.until;

        // One prompt says what to do next wherever the picture rests.
        const promptInput: PromptInput = { started, sinceStart, p, card: active >= 0, rewinding, idle };
        const prompt = promptFor(promptInput);
        const hint = hintOpacity(promptInput);
        const speed = speedKmh(pace, drive.speed);

        // ---- draw: writes only from here on ----
        const titleOut = clamp01(p / STORY.titleOut);
        const titleNudge = k === 0 ? nudge : 0;
        set(title.current, "opacity", (1 - titleOut).toFixed(3));
        // The title lifts a little into the sky as it fades, and gives under a push.
        set(
          title.current,
          "transform",
          `translate3d(0, ${(-8 * titleOut).toFixed(2)}%, 0) translateY(${(-(titleNudge + TEASE_LIFT * tease)).toFixed(2)}px)`,
        );
        const bars = clamp01(p / STORY.barsOut + (TEASE_BARS / 100) * tease);
        set(el.barTop, "transform", `translate3d(0, ${(-100 * bars).toFixed(2)}%, 0)`);
        set(el.barBottom, "transform", `translate3d(0, ${(100 * bars).toFixed(2)}%, 0)`);
        set(el.hint, "--bars", bars.toFixed(3));
        set(el.hint, "opacity", hint.toFixed(3));
        attr(el.hint, "data-on", started || sinceEntered >= HINT_AT);
        attr(el.hint, "data-blink", blinkParity ? String(blinkParity) : null);
        const night = clamp01((p - STORY.fadeFrom) / (1 - STORY.fadeFrom));
        set(el.fade, "opacity", (night * night).toFixed(3));

        el.cards.forEach((card, i) => {
          const opacity = story.opacity[i];
          if (opacity === 0 && drawnOpacity[i] === 0 && i !== active && i !== lastActive) return;
          drawnOpacity[i] = opacity;
          set(card, "opacity", opacity.toFixed(3));
          if (opacity > 0 || i === active) {
            // Rises in from below, drifts up on the way out; the active card gives under a push.
            const y =
              i === active
                ? STORY.cardRise * (1 - opacity) - nudge - reminderLift
                : -STORY.cardRise * (1 - opacity);
            set(card, "transform", `translate3d(0, ${y.toFixed(2)}px, 0)`);
          }
          attr(card, "data-active", i === active);
        });
        if (active !== lastActive) {
          if (lastActive >= 0) {
            attr(el.cards[lastActive], "data-ready", null);
            attr(el.cards[lastActive], "data-cue-label", false);
          }
          if (active >= 0) {
            // One layout read per card change: the hold note sits above the card.
            set(el.holdNote, "--va-card-h", `${el.cards[active].offsetHeight}px`);
            // Keyboard users hear the line they stepped to.
            if (scrollInput.source === "key" && el.live) el.live.textContent = `${speaker}: ${cardTexts[active]}`;
          }
          lastActive = active;
        }
        if (active >= 0) {
          const card = el.cards[active];
          set(card, "--read", (Math.round(fill * 50) / 50).toFixed(2));
          set(card, "--push", pushFlash.toFixed(2));
          attr(card, "data-ready", ready ? String(readyParity) : null);
          attr(card, "data-cue-label", ready && cueLabel);
        }
        // Rewinding flicks through the cards: hide them instead.
        attr(el.captions, "data-rewinding", rewinding);
        attr(el.cue, "data-visible", prompt === "between");
        attr(el.holdNote, "data-visible", holdNote);
        // The note rides on the card it talks about, stretch and all.
        set(el.holdNote, "transform", `translate3d(-50%, ${(-(nudge + reminderLift)).toFixed(2)}px, 0)`);
        attr(el.endCue, "data-visible", prompt === "end");

        attr(el.osd, "data-mode", nextMode);
        if (nextMode !== mode) {
          mode = nextMode;
          pulseParity = pulseParity === 1 ? 2 : 1;
          attr(el.osd, "data-pulse", String(pulseParity));
        }
        if (speed !== shownSpeed && el.speed) {
          shownSpeed = speed;
          el.speed.textContent = String(speed);
        }
        el.reel.forEach((fillEl, i) => {
          const fill = clamp01(p * SHOT_COUNT - i);
          if (fill === drawnFill[i]) return;
          drawnFill[i] = fill;
          set(fillEl, "--fill", fill.toFixed(3));
        });
        attr(el.skip, "data-visible", skipVisible);
        attr(el.skip, "data-expanded", skipExpanded);
        attr(root, "data-started", started);
        attr(root, "data-hurry", skipExpanded);
        const source: InputSource | null = scrollInput.source ?? (loading.enteredVia === "key" ? "key" : null);
        attr(root, "data-input", source);

        if (picture.shot !== currentShot) {
          currentShot = picture.shot;
          setShot(picture.shot);
        }

        gate(frontier(walls, story), now, scroll);

        if (process.env.NODE_ENV !== "production") {
          const probe = (window as DevWindow).__vaProbe;
          if (Array.isArray(probe)) {
            probe.push({
              t: Math.round(now),
              // What this frame cost, ms (the probe itself excluded).
              cost: performance.now() - now,
              p,
              target: heroProgress.target,
              scroll,
              frontier: Number.isFinite(fr) ? fr : null,
              wall: k,
              active,
              opacity: active >= 0 ? story.opacity[active] : 0,
              opacities: story.opacity.map((o) => o.toFixed(3)).join(","),
              read: fill,
              pace,
              speed,
              pressure: scrollGate.pressure,
              nudge,
              push: pushFlash,
              waiting,
              mode: nextMode,
              started,
              ready,
              cueLabel: ready && cueLabel,
              prompt,
              cue: prompt === "between",
              holdNote,
              endCue: prompt === "end",
              skip: skipVisible,
              skipExpanded,
              hint,
              hintOn: started || sinceEntered >= HINT_AT,
              tease,
              rewinding,
              source: scrollInput.source,
              inputAt: Number.isFinite(scrollInput.at) ? Math.round(scrollInput.at) : null,
            });
          }
        }
      };

      const tick = (_time: number, deltaMs: number) => update(deltaMs);
      gsap.ticker.add(tick);
      update(0);

      const skipToEnd = () => {
        openAll(story);
        jumpToEnd();
      };

      /** Next or previous line (Space, PageDown, Shift+Space, PageUp, a tap). */
      const stepLine = (dir: 1 | -1, source: InputSource) => {
        const now = performance.now();
        const fr = frontier(walls, story);
        // From where a glide already heads, so quick presses step line after line.
        const from = Math.min(fr, Math.max(heroProgress.value, lenis ? progressFor(lenis.targetScroll) : 0));
        const target = lineStep(dir, from, timeline, fr);
        recordInput(dir * THROTTLE.keyStep * geom.vh, source, now, geom.vh);
        if (dir > 0 && (target === null || target < (lineStep(dir, from, timeline, Number.POSITIVE_INFINITY) ?? 1))) {
          // The next line waits for an unread card: the press knocks on it
          // (a bounce and a flash of its bar) and the picture creeps to its wall.
          scrollGate.pressure += ELASTIC.knock * geom.vh;
          scrollGate.pushedAt = now;
        }
        if (target === null) return;
        lenis?.scrollTo(scrollFor(target), { programmatic: false, duration: LINE_GLIDE, easing: easeOutCubic });
      };

      const onKey = (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        const loading = getSceneLoading();
        if (!loading.entered || event.timeStamp - loading.enteredAt < KEY_GUARD_MS) return;
        if (!lenis || lenis.isStopped) return;
        const scroll = scrollNow();
        const pinned = scroll >= geom.top - 1 && scroll < geom.top + geom.range - 1;
        if (!pinned || heroProgress.value >= 1) return;
        const action = keyAction({
          key: event.key,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          targetKind: targetKind(event.target, clickFocus.element),
        });
        if (!action) return;
        event.preventDefault();
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
            recordInput(THROTTLE.arrowStep * vh, "key", now, vh);
            const want = lenis.targetScroll + THROTTLE.arrowStep * vh;
            const dest = Math.min(want, scrollGate.maxScroll);
            if (want > dest) {
              scrollGate.pressure += want - dest;
              scrollGate.pushedAt = now;
            }
            if (dest > lenis.targetScroll + 0.5) {
              lenis.scrollTo(dest, { programmatic: false, lerp: motion.scrollLerp });
            }
            break;
          }
          case "up":
            recordInput(-THROTTLE.arrowStep * vh, "key", now, vh);
            lenis.scrollTo(Math.max(geom.top, lenis.targetScroll - THROTTLE.arrowStep * vh), {
              programmatic: false,
              lerp: motion.scrollLerp,
            });
            break;
          case "home":
            recordInput(-vh, "key", now, vh);
            lenis.scrollTo(geom.top, { programmatic: false, duration: HOME_GLIDE, easing: easeOutCubic });
            break;
          case "skip":
            skipToEnd();
            break;
        }
      };

      /** A tap or click on the picture plays the next line, like Space. */
      let press: null | {
        id: number;
        x: number;
        y: number;
        at: number;
        button: number;
        type: string;
        lastInput: number;
      } = null;
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("button, a, [role='button'], [data-hud], [data-skip]")) {
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
          lastInput: scrollInput.at,
        };
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!press || event.pointerId !== press.id) return;
        const down = press;
        press = null;
        if (!getSceneLoading().entered || heroProgress.value >= 1) return;
        const tap = isPictureTap({
          dx: event.clientX - down.x,
          dy: event.clientY - down.y,
          ms: performance.now() - down.at,
          sinceScroll: down.at - down.lastInput,
          button: down.button,
        });
        if (tap) stepLine(1, down.type === "touch" ? "touch" : "wheel");
      };

      /** The control the last pointer press focused (see targetKind). */
      const clickFocus = { element: null as Element | null, at: Number.NEGATIVE_INFINITY };
      const onAnyPointerDown = () => {
        clickFocus.at = performance.now();
      };

      /** Focus moving past the hero (Tab into the next section) opens the walls instead of being pulled back. */
      const onFocusIn = (event: FocusEvent) => {
        const target = event.target;
        // Focus that a pointer press moved, here or by closing a dialog
        // (the radio wheel hands it back to its button), is not the keyboard's.
        clickFocus.element =
          target instanceof Element && performance.now() - clickFocus.at < POINTER_FOCUS_MS ? target : null;
        if (!(target instanceof Node) || root.contains(target)) return;
        if (root.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) {
          if (frontierIndex(story) >= 0) openAll(story);
        }
      };

      actions.current = {
        skip: (event) => {
          const down = skipState.down;
          skipState.down = null;
          // A click with detail 0 comes from the keyboard: always allowed.
          if (event && event.detail > 0 && down) {
            const now = performance.now();
            const allowed = skipTapAllowed({
              pointerType: down.type,
              sinceTouchEnd: now - scrollGate.touchEndAt,
              sinceShown: now - skipState.shownAt,
              moved: Math.hypot(event.clientX - down.x, event.clientY - down.y),
              ms: now - down.at,
            });
            if (!allowed) return;
          }
          skipToEnd();
        },
        skipPointerDown: (event) => {
          skipState.down = { type: event.pointerType, x: event.clientX, y: event.clientY, at: performance.now() };
        },
      };

      // A deep link to a later section cuts the film like Skip (components/PageEntry.tsx).
      const unregisterEnd = registerHeroEnd({ section: root.closest("section") ?? root, cut: skipToEnd });
      window.addEventListener("keydown", onKey);
      window.addEventListener("resize", remeasure);
      document.addEventListener("visibilitychange", onVisibility);
      root.addEventListener("pointerdown", onPointerDown);
      root.addEventListener("pointerup", onPointerUp);
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("pointerdown", onAnyPointerDown, true);

      if (process.env.NODE_ENV !== "production") {
        // Dev only: jump the film (opening the story up to there), for
        // framing work and tools/capture.
        (window as DevWindow).__vaJump = (p: number) => {
          const value = clamp01(p);
          openUpTo(walls, story, value);
          titleIntro.complete();
          if (value > 0) scrollInput.forwardAt = Math.max(scrollInput.forwardAt, performance.now());
          heroProgress.value = heroProgress.target = value;
          const fr = frontier(walls, story);
          scrollGate.maxScroll = Number.isFinite(fr) ? scrollFor(fr) : Number.POSITIVE_INFINITY;
          // The scroll is the picture: the page goes there too.
          if (lenis) lenis.scrollTo(scrollFor(value), { immediate: true, force: true });
          else window.scrollTo(0, scrollFor(value));
          update(0);
        };
      }

      return () => {
        unregisterEnd();
        gsap.ticker.remove(tick);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", remeasure);
        document.removeEventListener("visibilitychange", onVisibility);
        resizeObserver?.disconnect();
        root.removeEventListener("pointerdown", onPointerDown);
        root.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("pointerdown", onAnyPointerDown, true);
        clear();
        clearAttrs();
        scrollGate.maxScroll = Number.POSITIVE_INFINITY;
        heroFeedback.pace = 1;
        heroFeedback.fovKick = 0;
        actions.current = null;
        delete (window as DevWindow).__vaJump;
      };
    },
    { scope: stage, dependencies: [reducedMotion, timeline, walls, lenis], revertOnUpdate: true },
  );

  const shotLabel = shots[shot] ?? shots[0];

  return (
    <div ref={stage} className={styles.stage}>
      <div className={styles.sticky} data-sticky>
        <HeroCanvas label={sceneLabel} billboards={billboards} />
        <div className={`${styles.bar} ${styles.barTop}`} data-bar="top" aria-hidden="true" />
        <div className={`${styles.bar} ${styles.barBottom}`} data-bar="bottom" aria-hidden="true" />

        <p className={styles.hud} data-hud>
          <span className={styles.hudTitle}>{hud.title}</span>
          <span className={styles.hudSubtitle}>{hud.subtitle}</span>
        </p>
        <p className={styles.hudCamera} data-hud aria-live="off">
          {hud.camera} {String(shot + 1).padStart(2, "0")}/{String(SHOT_COUNT).padStart(2, "0")}
          <span className={styles.hudShot}>{shotLabel}</span>
        </p>

        {/* Where she is in the five shots: a reel, not a buffer bar. */}
        <div className={styles.reel} aria-hidden="true">
          {shots.map((label) => (
            <span key={label} className={styles.reelSegment}>
              <span className={styles.reelFill} data-reel-fill />
            </span>
          ))}
        </div>

        <HeroTitle ref={title} name={name} role={role} tagline={tagline} />
        {/* What the hero is and how to drive it; under reduced motion, only that the script follows. */}
        <p id="hero-help" className="sr-only">
          <span className={styles.helpMotion}>{intro.help}</span>
          <span className={styles.helpStill}>{intro.helpStill}</span>
        </p>

        <ul className={styles.subtitles} aria-label={speaker} data-captions>
          {lines.map((cards, lineIndex) => (
            <li key={cards.join(" ")} className={styles.line}>
              {cards.map((card, cardIndex) => (
                <span key={`${lineIndex}-${cardIndex}`} className={styles.subtitle} data-card>
                  <span className={styles.subtitleText}>
                    <span className={styles.speaker}>{speaker}:</span> {card}
                    {/* The marker and its label never wrap apart. */}
                    <span className={styles.cueTail} aria-hidden="true">
                      <span className={styles.cueArrow} />
                      <span className={styles.cueLabel}>
                        <span className={styles.forWheel}>{intro.next}</span>
                        <span className={styles.forTouch}>{intro.nextTouch}</span>
                        <span className={styles.forKey}>{intro.nextKey}</span>
                      </span>
                    </span>
                  </span>
                </span>
              ))}
            </li>
          ))}
        </ul>

        <p className={styles.holdNote} data-hold-note aria-hidden="true">
          {intro.hold}
        </p>

        <p className={styles.cue} data-cue aria-hidden="true">
          <span className={`${styles.glyph} ${styles.cueGlyph} ${styles.notTouch}`} data-g="down" />
          <span className={`${styles.glyph} ${styles.cueGlyph} ${styles.forTouch}`} data-g="up" />
          <span className={styles.forWheel}>{intro.keepGoing}</span>
          <span className={styles.forTouch}>{intro.keepGoingTouch}</span>
          <span className={styles.forKey}>{intro.keepGoingKey}</span>
        </p>

        <div className={styles.hint} data-hint aria-hidden="true">
          <div className={styles.hintBox}>
            <p className={styles.hintLine1}>
              <span className={styles.forWheel}>{intro.hint}</span>
              <span className={styles.forTouch}>{intro.hintTouch}</span>
              <span className={styles.forKey}>{intro.hintKey}</span>
              <span className={`${styles.glyph} ${styles.hintGlyph} ${styles.notTouch}`} data-g="down" />
              <span className={`${styles.trail} ${styles.forTouch}`} />
            </p>
            {/* Her first input answered in place: the drive is hers now. */}
            <p className={styles.hintAck}>{intro.ack}</p>
            <p className={styles.hintLine2}>{intro.model}</p>
            <p className={styles.hintStill}>
              <span className={`${styles.glyph} ${styles.hintGlyph}`} data-g="down" />
              {intro.still}
            </p>
          </div>
        </div>

        {/* A dashboard readout, not a tape deck: what her input does to the car, and its speed.
            No gear letter: a "D" read as the WASD key to gamers. */}
        <p className={styles.osd} data-osd data-mode="hidden" aria-hidden="true">
          <span className={`${styles.glyph} ${styles.osdWait} ${styles.notTouch}`} data-g="down" />
          <span className={`${styles.glyph} ${styles.osdWait} ${styles.forTouch}`} data-g="up" />
          <span className={styles.osdWord}>
            <span data-word="drive">{osd.drive}</span>
            <span data-word="waiting">{osd.waiting}</span>
            <span data-word="floored">{osd.floored}</span>
            <span data-word="reverse">{osd.reverse}</span>
          </span>
          <span className={styles.osdSpeed}>
            <span className={styles.osdSpeedValue} data-speed />
            {osd.unit}
          </span>
        </p>

        <div className={styles.skip} data-skip data-hud>
          <Button
            variant="ghost"
            size="sm"
            className={styles.skipButton}
            aria-label={skipLabel}
            aria-keyshortcuts="Escape End"
            onPointerDown={(event) => actions.current?.skipPointerDown(event)}
            onClick={(event) => actions.current?.skip(event)}
          >
            <span className={styles.skipHurry} aria-hidden="true">
              {skipHurry}
            </span>
            {skip}
            <span className={styles.glyph} data-g="next" aria-hidden="true" />
            <kbd className={styles.skipKey} aria-hidden="true">
              Esc
            </kbd>
          </Button>
        </div>

        <p className="sr-only" aria-live="polite" data-live />

        <div className={styles.fade} data-fade aria-hidden="true" />
        {/* Over the fade, so it reads from the first frame of the night. */}
        <p className={styles.endCue} data-end-cue aria-hidden="true">
          <span className={`${styles.glyph} ${styles.cueGlyph}`} data-g="down" />
          {intro.end}
        </p>
      </div>
    </div>
  );
}
