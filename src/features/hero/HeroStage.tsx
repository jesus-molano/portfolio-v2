"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import { Button } from "@/components/ui/Button";
import { motion } from "@/design/tokens";
import { getRadio } from "@/features/music/radio";
import { REDUCED_MOTION_QUERY, usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Dictionary } from "@/i18n/dictionaries";
import { focusInPlace, goTo, registerPassage } from "@/lib/navigate";
import { isOnScreen, lineBelow, lineRootMargin, ON_SCREEN_THRESHOLDS } from "@/lib/onScreen";
import styles from "./Hero.module.css";
import { HeroCanvas } from "./HeroCanvas";
import { HeroTitle } from "./HeroTitle";
import { Pedal } from "./Pedal";
import { fitWidth } from "./cardFit";
import { getSceneLoading, markOnScreen, markOnStage, markQuiet, markSettled } from "./sceneLoading";
import { titleIntro } from "./titleIntro";
import { decay, ELASTIC, rubberBand, touchStretchMax } from "./scroll/elastic";
import {
  heroFeedback,
  heroProgress,
  type InputSource,
  recordInput,
  recordPedal,
  resetInput,
  scrollDrive,
  scrollGate,
  scrollInput,
  STATIC_PROGRESS,
} from "./scroll/heroProgress";
import {
  DASH,
  dashLayout,
  type DashShow,
  dashShow,
  dashVisibility,
  easeRevs,
  limiterState,
  litLeds,
  speedCells,
  stripThrottle,
} from "./scroll/dash";
import { deepWait, type FeedbackInput, newFeedback, stepFeedback } from "./scroll/feedback";
import { GATE, gateAction, lenisMissed, type PageReading, pageScroll } from "./scroll/gate";
import {
  keyLost,
  newPedal,
  PEDAL,
  type PedalVia,
  pedalPush,
  pedalRate,
  pedalRibs,
  pedalSpeed,
  pedalVisibility,
  pressPedal,
  releasePedal,
  stepPedal,
  suspendPedal,
  teachDip,
} from "./scroll/pedal";
import {
  activeWindow,
  buildWalls,
  cardAt,
  cardWall,
  frontier,
  frontierIndex,
  heroTimeline,
  lineStep,
  newStory,
  openAll,
  openUpTo,
  playingBeat,
  readFill,
  settleTitle,
  stepStory,
  type Story,
  type StoryContext,
  STORY,
} from "./scroll/story";
import { fovKick, LIMITER, meterRate, paceFor, THROTTLE } from "./scroll/throttle";
import {
  CUE_LABELS,
  FIGHT,
  fightLevel,
  focusFromPointer,
  hintOpacity,
  isNotePush,
  isPictureTap,
  keyAction,
  PROMPT,
  type Prompt,
  promptFor,
  type PromptInput,
  pushingHard,
  REMINDERS,
  skipTapAllowed,
  speedKmh,
  type TargetKind,
  TEASES,
  teaseOffset,
} from "./scroll/transport";
import { drive } from "./scene/drive";
import { CUT_BAND, SHOT_COUNT, type ShotPick, shotIndexAt, stickyShot } from "./scene/shots";

gsap.registerPlugin(useGSAP);

type HeroCopy = Dictionary["hero"];

type Props = {
  name: string;
  role: string;
  tagline: string;
  /** Hints, cues and the screen-reader help for the scrubbed film. */
  intro: HeroCopy["intro"];
  /** Words of the dash. */
  osd: HeroCopy["osd"];
  /** The pedal's name, its tag and what it does. */
  pedal: HeroCopy["pedal"];
  skip: string;
  /** Accessible name of Skip; it contains the visible `skip`. */
  skipLabel: string;
  /** Prefix Skip shows when the visitor seems in a hurry. */
  skipHurry: string;
  sceneLabel: string;
  /** The camera readout's label ("CAM"), before the shot's number. */
  camera: string;
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
/** A click or tap at the end of the drive glides on into the next section over this long, seconds. */
const END_GLIDE = 1.2;
/** The picture moving back more than this many pixels in a frame is going back. */
const BACK_SLOP_PX = 1.5;
/** After the viewport changed and the film was put back in place (ms), a move of the page is not hers. */
const RESEAT_MS = 250;
/** The gate trimmed input this recently (ms): a wall is holding her. */
const HOLDING_MS = 300;
/** Reminder lift of a read card and attract lift of the title (px), attract slide of the bars (%). */
const REMINDER_LIFT = 8;
const TEASE_LIFT = 12;
const TEASE_BARS = 8;
/** Once the first line has been read and she has rested this long (s), the radio may offer itself. */
const SETTLE_IDLE = 1;
/**
 * Side hints (`data-side-hint`: the radio's callout) hang under the page
 * controls, and they are the hero's: they show only while the hero runs
 * down past their bottom edge and this gap (px), so the section after it,
 * whose chapter card comes up just under its top edge, starts below them.
 * A sliver of the hero's night at the top of the screen is not the hero
 * behind them.
 */
const SIDE_HINT_GAP = 8;
/** Switched to the still hero mid-film: the line she was on sits this far down the viewport. */
const STILL_PLACE = 0.3;
/** The still hero counts as on screen while its bottom is below this share of the viewport. */
const STILL_ON_STAGE = 0.5;
/** The still hero settles (side hints may come) once she has scrolled this share of a viewport past the title. */
const STILL_SETTLE = 0.6;
/** Back from the still hero, the film keeps her place through this many ms of re-runs. */
const RESUME_MS = 1500;
/** Keys that scroll the still page: pressing one, she moves on in the running script. */
const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);
/** A line asked for at the title (Space, a tap) plays once the name has formed, within this many ms. */
const TITLE_QUEUE_MS = 6000;
/** Longest real frame the feedback counts (s): a stall, not a frame. */
const MAX_REAL_STEP = 2;
/** The pedal's knock flash (ms), as long as the dash's "pushing on the limiter". */
const KNOCK_MS = 300;
/** A pedal held by a pointer that has sent nothing this long (ms) is checked: still captured, or let go. */
const PEDAL_WATCHDOG_MS = 10_000;
/** A click on the pedal this long (ms) after a pointer pressed it is that press's own click, not a tap. */
const PEDAL_CLICK_MS = 1000;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round3 = (value: number) => Math.round(value * 1000) / 1000;
/** A line's reading time as drawn, in 1/50 steps: the card's bar and the limit sign's ring read the same value. */
const readStep = (fill: number) => Math.round(fill * 50) / 50;

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
 * pointer (`clicked`, see focusFromPointer), directly or handed back by a
 * dialog however it was closed (a click, Esc), does not keep Space: after
 * opening the radio with the mouse, Space plays the next line instead of
 * opening the radio again. A control reached with the keyboard (Tab) keeps
 * it, even right after a click.
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
  skipPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

/**
 * The tall scrolling stage: a sticky viewport with the canvas, the title,
 * the letterbox bars, the HUD, the dash and the subtitles. The scroll
 * is the picture (scroll/story.ts): every element here is drawn from the
 * same film position, the scroll clamped to the story's frontier, so the
 * camera, the subtitles and the fades always agree and stop when the
 * visitor stops. Input held at a wall shows up as a card bounce, the
 * world's pace and the dash; once she stops, the car slows to a crawl
 * and one prompt says what to do next. Shots change with clean hard cuts.
 *
 * The frame reads no element geometry: the page's scroll offset, after
 * Lenis has written it (gate.ts), and the stage's geometry, measured only
 * when the viewport changes. The page is never left past the frontier.
 */
export function HeroStage({
  name,
  role,
  tagline,
  intro,
  osd,
  pedal: pedalCopy,
  skip,
  skipLabel,
  skipHurry,
  sceneLabel,
  camera,
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
  /** Which hero the last effect ran: the film or the still (reduced motion), to keep her place across a switch. */
  const ran = useRef<"film" | "still" | null>(null);
  /** In the still hero, the card of the running script she has scrolled to (-1: the title, the card count: past it). */
  const stillCard = useRef(-1);
  /**
   * The film position the still hero took over from mid-film. Until she
   * scrolls the running script herself, the film comes back exactly there
   * (the page's own adjustments, a re-layout or Lenis being rebuilt, are
   * not her moving on).
   */
  const stillPlace = useRef<number | null>(null);
  /**
   * Back from the still hero, the film position she resumes at, kept for a
   * moment: the effect runs again as Lenis is rebuilt for the new motion
   * setting, and must not read the still page's scroll as a film position.
   */
  const resume = useRef<{ p: number; until: number } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const lenis = useLenis();
  const [shot, setShot] = useState(0);

  const timeline = useMemo(() => heroTimeline(lines), [lines]);
  const walls = useMemo(() => buildWalls(timeline), [timeline]);
  const cardTexts = useMemo(() => lines.flat(), [lines]);
  /** The cards that open a line: the speaker is named once per line, for screen readers too. */
  const lineStarts = useMemo(() => {
    const starts = new Set<number>();
    let card = 0;
    for (const line of lines) {
      starts.add(card);
      card += line.length;
    }
    return starts;
  }, [lines]);

  // Whether the hero (the film, or the still and its running script) is up behind the side hints:
  // asked of the line of pixels under them, measured again when the viewport or a hint's box changes.
  useEffect(() => {
    const element = stage.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const hints = Array.from(document.querySelectorAll<HTMLElement>("[data-side-hint]"));
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      const line = lineBelow(
        hints.map((hint) => ({ top: hint.offsetTop, height: hint.offsetHeight })),
        SIDE_HINT_GAP,
      );
      observer = new IntersectionObserver(
        // One target: the newest entry is its state now.
        (entries) => markOnScreen(isOnScreen(entries[entries.length - 1])),
        { rootMargin: lineRootMargin(line, window.innerHeight), threshold: ON_SCREEN_THRESHOLDS },
      );
      observer.observe(element);
    };
    observe();
    // A hint's text changes with the input (touch or not) and wraps with its face loading.
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(observe);
    hints.forEach((hint) => resized?.observe(hint));
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      resized?.disconnect();
      observer?.disconnect();
    };
  }, []);

  useGSAP(
    () => {
      const root = stage.current;
      if (!root) return;
      const sticky = root.querySelector<HTMLElement>("[data-sticky]");
      const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));

      /** The hero's section: what a move past it opens (lib/navigate.ts). */
      const section = root.closest("section") ?? root;

      /**
       * Cuts to the end of the drive, like skipping a cutscene: the page
       * lands with the hero's last pixel just gone, so the section after it
       * (THE USUAL SUSPECTS, `#suspects`) starts at the top of the screen,
       * and that section takes the focus, so the keyboard carries on from
       * there instead of from the top of the page. anchors.test.ts checks
       * that the hero is followed by a section that can take it. Through
       * the page's one way of moving (lib/navigate.ts): Lenis and the page
       * land together, and the film's walls open on the way past.
       */
      const jumpToEnd = () => {
        const next = section.nextElementSibling;
        goTo(section.getBoundingClientRect().bottom + window.scrollY, { focus: next instanceof HTMLElement ? next : null });
      };

      if (reducedMotion) {
        // The still hero: one frame, then the script as running text. If the
        // film was playing (reduced motion switched on mid-film), she keeps
        // her place: the line she was on, now in the running script.
        const was = heroProgress.value;
        const fromFilm = ran.current === "film";
        ran.current = "still";
        heroProgress.value = heroProgress.target = STATIC_PROGRESS;
        scrollGate.maxScroll = Number.POSITIVE_INFINITY;
        setShot(shotIndexAt(STATIC_PROGRESS));
        actions.current = { skip: jumpToEnd, skipPointerDown: () => {}, skipPointerUp: () => {} };
        // Side hints wait for a quiet moment: once she has scrolled the
        // still title away (nothing covers the name) and rests there.
        let settle = 0;
        const maybeSettle = () => {
          const loading = getSceneLoading();
          if (!loading.entered || loading.settled) return;
          window.clearTimeout(settle);
          if (window.scrollY >= STILL_SETTLE * window.innerHeight) settle = window.setTimeout(markSettled, SETTLE_IDLE * 1000);
        };
        const place = () => {
          // Past the fade: where Skip lands, the hero's section just gone.
          if (was >= STORY.fadeFrom) return section.getBoundingClientRect().bottom + window.scrollY;
          const card = was > STORY.titleOut ? cardAt(was, timeline) : -1;
          if (card < 0) return 0;
          return Math.max(0, cards[card].getBoundingClientRect().top + window.scrollY - STILL_PLACE * window.innerHeight);
        };
        const keepPlace = () => {
          goTo(place(), { focus: null });
        };
        let settleFrame = 0;
        // A re-run in the still hero (Lenis rebuilt) keeps the place it took over.
        if (fromFilm) stillPlace.current = was > 0 ? was : null;
        const movedOn = (event: Event) => {
          if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) return;
          stillPlace.current = null;
        };
        // A still asks for nothing: side hints may come once she has settled.
        markQuiet(true);
        if (fromFilm && was > 0) {
          keepPlace();
          // Lenis is rebuilt for reduced motion a moment later; put her back once it has.
          settleFrame = window.requestAnimationFrame(() => {
            settleFrame = window.requestAnimationFrame(keepPlace);
          });
        }
        // Where she reads in the running script, should the film come back.
        let readFrame = 0;
        // Past the hero's middle, the next section takes the screen: side hints keep off it.
        const onStage = () => root.getBoundingClientRect().bottom > STILL_ON_STAGE * window.innerHeight;
        markOnStage(onStage());
        // The first card on the last text line that has reached the reading line: never past a line she has not read.
        const track = () => {
          readFrame = 0;
          markOnStage(onStage());
          const line = STILL_PLACE * window.innerHeight + 1;
          // Past the running script: the film comes back at its end.
          if (root.getBoundingClientRect().bottom <= line) {
            stillCard.current = cards.length;
            return;
          }
          let card = -1;
          let top = Number.NEGATIVE_INFINITY;
          for (let i = 0; i < cards.length; i += 1) {
            const at = cards[i].getBoundingClientRect().top;
            if (at <= line && at > top + 1) {
              card = i;
              top = at;
            }
          }
          stillCard.current = card;
        };
        const onScroll = () => {
          if (!readFrame) readFrame = window.requestAnimationFrame(track);
          maybeSettle();
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("wheel", movedOn, { passive: true });
        window.addEventListener("touchmove", movedOn, { passive: true });
        window.addEventListener("keydown", movedOn);
        return () => {
          window.removeEventListener("wheel", movedOn);
          window.removeEventListener("touchmove", movedOn);
          window.removeEventListener("keydown", movedOn);
          window.clearTimeout(settle);
          window.cancelAnimationFrame(settleFrame);
          window.cancelAnimationFrame(readFrame);
          window.removeEventListener("scroll", onScroll);
          actions.current = null;
        };
      }

      /** Reduced motion switched on: the CSS has already laid out the still hero; the film stops writing at once. */
      const stillQuery = window.matchMedia(REDUCED_MOTION_QUERY);

      /**
       * The pinned stage on the page, measured when the viewport changes,
       * never in the frame. The film runs from the stage's top to where the
       * sticky viewport unpins (the stage's height less the viewport's own),
       * so p = 1 is exactly the unpin, whatever the address bar does.
       */
      const geom = { top: 0, range: 1, vh: window.innerHeight };
      /** Where the dash sits (dash.ts DASH_MEDIA, the same queries as the CSS). */
      let layout = dashLayout((query) => window.matchMedia(query).matches);
      /**
       * Each card is one block around its whole line, balanced; a wrapped
       * block would keep the full width of the band, so it is set to its
       * widest line (cardFit.ts). Measured with the viewport and once the
       * fonts have arrived, never in the frame.
       */
      const cardText = cards.map((card) => card.querySelector<HTMLElement>("[data-card-text]"));
      const fitCards = () => {
        for (const text of cardText) text?.style.removeProperty("--fit");
        const widths = cardText.map((text) => {
          if (!text) return 0;
          const range = document.createRange();
          range.selectNodeContents(text);
          return fitWidth(range.getClientRects());
        });
        cardText.forEach((text, i) => {
          if (text && widths[i] > 0) text.style.setProperty("--fit", `${widths[i]}px`);
        });
      };
      const measure = () => {
        const rect = root.getBoundingClientRect();
        geom.top = rect.top + window.scrollY;
        geom.range = Math.max(1, rect.height - (sticky?.offsetHeight ?? window.innerHeight));
        geom.vh = window.innerHeight;
        layout = dashLayout((query) => window.matchMedia(query).matches);
        fitCards();
      };
      measure();
      let disposed = false;
      document.fonts?.ready.then(() => {
        if (!disposed) fitCards();
      });
      /** Scroll position (px) of a film position, and back. */
      const scrollFor = (p: number) => geom.top + p * geom.range;
      const progressFor = (y: number) => (y - geom.top) / geom.range;
      /**
       * Where the page is (gate.ts): its own offset, read after Lenis wrote
       * it this tick, drawn from Lenis' sub-pixel value while the two
       * agree. If Lenis missed a native move of the page, it starts again
       * from the page, so its next glide sets off from where she is.
       */
      const reading: PageReading = { page: 0, lenis: 0, gliding: false };
      const readScroll = () => {
        reading.page = window.scrollY;
        if (!lenis) return reading.page;
        reading.lenis = lenis.scroll;
        reading.gliding = lenis.isScrolling === "smooth";
        if (lenisMissed(reading)) lenis.animatedScroll = lenis.targetScroll = reading.page;
        return pageScroll(reading);
      };

      // Where the page already is: a re-run must never pull the visitor back
      // to the title, so the story is kept, or opened up to the scroll.
      // Back from the still hero, the film picks up at the line she had
      // scrolled to in the running script.
      const fromStill = ran.current === "still";
      ran.current = "film";
      if (fromStill) {
        const card = stillCard.current;
        const kept = stillPlace.current;
        stillPlace.current = null;
        resume.current = {
          // Not scrolled since the film gave way: exactly where she was; else the line she reads, or the end.
          p: kept !== null
            ? kept
            : card >= cards.length
              ? 1
              : card >= 0
                ? activeWindow(timeline.beats[card]).from + STORY.wallInset
                : 0,
          until: performance.now() + RESUME_MS,
        };
      }
      const resuming = resume.current !== null && performance.now() < resume.current.until;
      const pNow = resuming && resume.current ? resume.current.p : clamp01(progressFor(window.scrollY));
      const key = walls.map((wall) => `${wall.kind}:${wall.from.toFixed(5)}:${wall.to.toFixed(5)}`).join("|");
      if (kept.current?.key !== key) {
        kept.current = { key, story: newStory(walls, timeline.beats.length) };
        if (pNow > 0) openUpTo(walls, kept.current.story, pNow);
      } else if (resuming && pNow > 0) {
        // She read the script as text up to there.
        openUpTo(walls, kept.current.story, pNow);
      }
      const story = kept.current.story;
      resetInput();
      heroProgress.value = heroProgress.target = pNow;
      // Lenis still has the still page's (shorter) limit: goTo measures it first, or it would clamp the jump.
      if (resuming) goTo(scrollFor(pNow), { focus: null });

      let reseatAt = Number.NEGATIVE_INFINITY;
      /**
       * The viewport changed (a rotation, a resized window, the address
       * bar): the stage changed height, so the same pixel scroll is another
       * film position. The film keeps its place instead, and the gate does
       * not take the move for a jump of hers.
       */
      const remeasure = () => {
        if (stillQuery.matches) return;
        // The film's place: the scroll, never past the frontier.
        const p = Math.min(heroProgress.target, frontier(walls, story));
        const before = { top: geom.top, range: geom.range };
        measure();
        if (Math.abs(before.top - geom.top) < 0.5 && Math.abs(before.range - geom.range) < 0.5) return;
        if (!lenis || !(p > 0 && p < 1)) return;
        // Lenis measures its own limit later (debounced): goTo measures it now, so the new position is not clamped to the old one.
        goTo(scrollFor(p), { focus: null });
        reseatAt = performance.now();
      };
      const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => remeasure());
      resizeObserver?.observe(root);
      if (sticky) resizeObserver?.observe(sticky);

      /** The first frame after the tab comes back counts no time: nothing was seen meanwhile. */
      let wasHidden = false;
      const onVisibility = () => {
        if (document.visibilityState === "visible") return;
        wasHidden = true;
        // A hidden tab lets go of the pedal: nothing drives while she is away.
        if (pedal.down) letGo();
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
        dash: q("[data-osd]"),
        strip: q("[data-strip]"),
        cells: Array.from(q("[data-speed]")?.children ?? []) as HTMLElement[],
        reel: Array.from(root.querySelectorAll<HTMLElement>("[data-reel-fill]")),
        skip: q("[data-skip]"),
        live: q("[data-live]"),
        pedal: q("[data-pedal]"),
        /** The W keycaps (the pedal's hinge, the dash's prompt): the layout's own letter for that key. */
        keyCaps: Array.from(root.querySelectorAll<HTMLElement>("[data-pedal-key]")),
        cards,
      };
      const { set, clear } = styleSetter();
      const { attr, clear: clearAttrs } = attrSetter();

      // The frame's working state, allocated once: a frame allocates nothing
      // but the strings of what changed.
      const feedback = newFeedback();
      const storyCtx: StoryContext = { rewinding: false, visible: true, introDone: false, introProgress: 0 };
      const fbInput: FeedbackInput = {
        started: false,
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
      const promptInput: PromptInput = {
        started: false,
        sinceStart: 0,
        p: 0,
        card: false,
        rewinding: false,
        idle: 0,
        turn: false,
      };
      const pick: ShotPick = { shot: 0, p: 0 };
      /** The last cards of the first two lines: once they are read, the radio may offer itself. */
      const settleWalls = [0, 1].map((line) =>
        cardWall(walls, Math.min(cards.length - 1, lines.slice(0, line + 1).reduce((n, l) => n + l.length, 0) - 1)),
      );

      let currentShot = -1;
      let started = pNow > 0;
      let startedAt = Number.NEGATIVE_INFINITY;
      /** When the title's beat finished (the name formed and held): "you have the wheel" counts from then. */
      let titleDoneAt = story.done[0] ? Number.NEGATIVE_INFINITY : Number.NaN;
      /** A line asked for at the title, and the input that asked: it plays once the name has formed. */
      let queuedAt = Number.NaN;
      let queuedInput = Number.NaN;
      /** The title's own fade where she rests mid-dissolve (story.settleTitle). */
      let titleSettle = 0;
      /** The last push that counts for the hold note (transport.isNotePush), performance.now(). */
      let notePushAt = Number.NEGATIVE_INFINITY;
      let quiet = getSceneLoading().quiet;
      let lastP = pNow;
      /** performance.now() when the picture last moved back (a fling still coasting counts). */
      let backAt = Number.NEGATIVE_INFINITY;
      let pushFlash = 0;
      let lastPushedAt = scrollGate.pushedAt;
      let pressureAfter = 0;
      let lastActive = -1;
      let readyCard = -1;
      let readyCount = 0;
      let readyParity: "1" | "2" | null = null;
      let cueLabel = false;
      let lastIdle = Number.POSITIVE_INFINITY;
      let reminderIdx = 0;
      let reminderAt = Number.NEGATIVE_INFINITY;
      let remindParity: "1" | "2" | null = null;
      let fight = 0;
      const skipState = {
        visible: false,
        shownAt: Number.NEGATIVE_INFINITY,
        until: Number.NEGATIVE_INFINITY,
        shows: 0,
        lastAt: Number.NEGATIVE_INFINITY,
        down: null as null | { type: string; x: number; y: number; at: number },
      };
      // The pedal (scroll/pedal.ts): her foot, who holds it down, and the line step it waits for.
      const pedal = newPedal();
      /** The words her prompts speak while it is down: the button's ("pedal"), or the keyboard's for W and Space. */
      let pedalSource: InputSource = "pedal";
      /** A line step's glide in flight: a press is that glide, and the pedal pushes once it has landed. */
      let stepGlide: { to: number; until: number } | null = null;
      /** The key holding it (W or Space) and its autorepeat, the heartbeat that says the keyup was not lost. */
      let keyHold: { code: string; key: string; at: number; repeating: boolean } | null = null;
      /**
       * A key still held when the drive went on into the next section: its autorepeat is swallowed
       * until it comes up, so a Space held to the end never scrolls on past the line-up.
       */
      let spentKey: string | null = null;
      /** The pointer holding it, and when it last sent anything (the watchdog). */
      let pointerHold: number | null = null;
      let pointerHoldAt = Number.NEGATIVE_INFINITY;
      /** The last pointer press or release on the pedal: a click right after it is that pointer's own. */
      let pedalPointerAt = Number.NEGATIVE_INFINITY;
      /** Her last backward input the pedal has seen: a newer one suspends its push (pedal.ts suspendPedal). */
      let pressBackAt = Number.NEGATIVE_INFINITY;
      /** Seconds the held pedal has rested at the very end of the drive (PEDAL.endHold). */
      let endHold = 0;
      const drawnPedal = { lv: Number.NaN };
      let teaseIdx = 0;
      let teaseAt = Number.NEGATIVE_INFINITY;
      let blinkParity: "1" | "2" | null = null;
      let lastPrompt: Prompt | null = null;
      let popParity: "1" | "2" | null = null;
      let shownSpeed = -1;
      // The dash (scroll/dash.ts).
      /** The strip's revs (her throttle, eased), and the flare of her last input (1, decaying). */
      let revs = 0;
      let kick = 0;
      let lastStepAt = scrollInput.stepAt;
      let lastKnockAt = scrollGate.pushedAt;
      /** The wall of the unread line the limiter holds for; -1 when none. */
      let limitWall = -1;
      /** ALL CLEAR shows until then, and its warm sweep plays until then (performance.now()). */
      let clearUntil = Number.NEGATIVE_INFINITY;
      let sweepUntil = Number.NEGATIVE_INFINITY;
      let releaseParity: "1" | "2" | null = null;
      let bootUntil = Number.NaN;
      let show: DashShow = "hidden";
      let showParity: "1" | "2" | null = null;
      let onStage = getSceneLoading().onStage;
      const drawnCells = ["", "", ""];
      const flip = (parity: "1" | "2" | null) => (parity === "1" ? "2" : "1");
      /** What the last frame drew, so a resting card or reel segment costs nothing. */
      const drawnOpacity = el.cards.map(() => -1);
      const drawnY = el.cards.map(() => Number.NaN);
      const drawnFill = el.reel.map(() => -1);
      const drawn = {
        titleO: Number.NaN,
        titleY: Number.NaN,
        titleLift: Number.NaN,
        bars: Number.NaN,
        hint: Number.NaN,
        night: Number.NaN,
        noteY: Number.NaN,
        read: Number.NaN,
        push: Number.NaN,
        lit: Number.NaN,
        kick: Number.NaN,
        lim: Number.NaN,
      };

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
       * Keeps the page at the frontier (gate.ts). Her wheel, touch and keys
       * are trimmed before they scroll (SmoothScroll, onKey), so they never
       * pass it; a glide aimed past it turns into it; and a page that is
       * past it, whatever moved it there (the scrollbar, find in page, an
       * anchor, a programmatic scroll, an event the browser would not let
       * the page cancel), goes back to it in this frame. A push or a jump
       * of hers counts as pressure, and a jump of a viewport or more offers
       * Skip at once. `scroll` is this frame's page scroll, read before
       * anything was written.
       */
      const gate = (fr: number, now: number, scroll: number) => {
        scrollGate.maxScroll = Number.isFinite(fr) ? scrollFor(fr) : Number.POSITIVE_INFINITY;
        if (!lenis || lenis.isStopped) return;
        const max = scrollGate.maxScroll;
        const action = gateAction({ scroll, lenisTarget: lenis.targetScroll, gliding: lenis.isScrolling === "smooth", max });
        if (action === "none") return;
        // Just after the viewport changed and the film was put back in place, the page settling is not her.
        const hers = now - reseatAt >= RESEAT_MS;
        if (action === "into") {
          if (hers) {
            scrollGate.pressure += Math.min(lenis.targetScroll - max, GATE.overshootCap);
            scrollGate.pushedAt = now;
          }
          lenis.scrollTo(max, { programmatic: false, lerp: motion.touchLerp, force: true });
          return;
        }
        const over = scroll - max;
        if (hers) {
          scrollGate.pressure += Math.min(over, GATE.overshootCap);
          scrollGate.pushedAt = now;
          // A jump of a whole viewport: she clearly wants to move on.
          if (over >= FIGHT.jumpVh * geom.vh) expandSkip(now, true);
        }
        // Back to the wall now. Lenis first stands where the page is: its
        // scrollTo returns early when asked for its own target, which may
        // be the wall while the page is not (lenisContract.test.ts).
        lenis.animatedScroll = lenis.targetScroll = scroll;
        lenis.scrollTo(max, { immediate: true, force: true });
      };

      /** Lets go of the pedal: its push stops at once, and the plate springs back. */
      const letGo = (at = performance.now()) => {
        releasePedal(pedal, at);
        const id = pointerHold;
        keyHold = null;
        pointerHold = null;
        scrollInput.pedal = 0;
        if (id !== null && el.pedal?.hasPointerCapture(id)) el.pedal.releasePointerCapture(id);
      };

      /** A buzz under the thumb (Android; iOS has no web haptics), only once she has interacted with the page. */
      const buzz = (pattern: number | number[]) => {
        if (!navigator.userActivation?.hasBeenActive) return;
        navigator.vibrate?.(pattern);
      };

      /** One frame of the story and everything drawn from it. Reads first, then writes. */
      const update = (deltaMs: number) => {
        // Reduced motion just switched on: the CSS shows the still hero, and
        // the film must not touch the page before React hands over to it.
        if (stillQuery.matches) return;
        const now = performance.now();
        const scroll = readScroll();
        // The story's reading clocks take at most STORY.maxStep a frame; the feedback runs on real time.
        let realDt = Math.min(Math.max(0, deltaMs) / 1000, MAX_REAL_STEP);
        const visible = document.visibilityState === "visible";
        if (visible && wasHidden) {
          wasHidden = false;
          realDt = 0;
        }
        const dt = Math.min(realDt, STORY.maxStep);
        const loading = getSceneLoading();
        const sinceEntered = loading.entered ? (now - loading.enteredAt) / 1000 : -1;
        const vh = geom.vh;
        const wheelOpen = getRadio().wheel !== null;
        // The pedal lets go whenever its holder may be gone: the radio wheel opened (it holds the
        // scroll), a key whose autorepeat went silent (its keyup was lost), a pointer silent for long
        // that is no longer captured.
        if (pedal.down) {
          if (wheelOpen || !lenis || lenis.isStopped) letGo(now);
          else if (keyHold && keyLost({ repeating: keyHold.repeating, sinceKeyMs: now - keyHold.at })) letGo(now);
          else if (pointerHold !== null && now - pointerHoldAt > PEDAL_WATCHDOG_MS && !el.pedal?.hasPointerCapture(pointerHold)) {
            letGo(now);
          }
        }

        heroProgress.target = clamp01(progressFor(scroll));
        const fr = frontier(walls, story);
        const pStory = clamp01(Math.min(heroProgress.target, fr));
        // The picture keeps its shot within a hair of a cut, so a resting finger never strobes.
        stickyShot(pStory, currentShot, CUT_BAND, pick);
        const p = pick.p;
        heroProgress.value = p;
        // Going back, by input or a fling still coasting: no card comes up.
        // A sub-pixel dip (the page put back in place after a rotation) is not going back.
        const movedBack = (lastP - p) * geom.range > BACK_SLOP_PX;
        if (movedBack) backAt = now;
        const lastBack = Math.max(scrollInput.backwardAt, backAt);
        const rewinding = now - lastBack < STORY.rewindHide * 1000;
        const pictureSpeed = realDt > 0 ? Math.abs(p - lastP) / realDt : 0;
        lastP = p;

        storyCtx.rewinding = rewinding;
        storyCtx.visible = visible;
        storyCtx.introDone = titleIntro.done || sinceEntered > INTRO_FAILSAFE;
        storyCtx.introProgress = titleIntro.progress();
        const active = stepStory(walls, story, timeline, pStory, dt, storyCtx);
        const k = frontierIndex(story);
        // A line still playing at the picture: she waits for it, not it for her.
        const beat = playingBeat(walls, story, pStory, active);
        if (Number.isNaN(titleDoneAt) && story.done[0]) titleDoneAt = now;

        // The first forward input: the drive starts and the title hurries up.
        if (!started && loading.entered && scrollInput.forwardAt >= loading.enteredAt) {
          started = true;
          startedAt = now;
          titleIntro.hurry();
        }
        // "You have the wheel" holds while the name forms and holds, then counts its own beat.
        const sinceStart = started && story.done[0] ? (now - Math.max(startedAt, titleDoneAt)) / 1000 : 0;

        // Held input: a bounce under the wheel, a stretch under the finger.
        const touchMode = scrollGate.touching || scrollInput.source === "touch";
        const added = Math.max(0, scrollGate.pressure - pressureAfter);
        if (!scrollGate.touching) {
          scrollGate.pressure = decay(
            scrollGate.pressure,
            realDt,
            scrollInput.source === "touch" ? ELASTIC.releaseTau : ELASTIC.wheelTau,
          );
          if (scrollGate.pressure < 0.05) scrollGate.pressure = 0;
        }
        pressureAfter = scrollGate.pressure;
        if (scrollGate.pushedAt !== lastPushedAt) {
          lastPushedAt = scrollGate.pushedAt;
          pushFlash = 1;
        } else {
          pushFlash = decay(pushFlash, realDt, ELASTIC.pushTau);
        }
        const nudge = touchMode
          ? rubberBand(scrollGate.pressure, touchStretchMax(vh))
          : rubberBand(Math.max(0, scrollGate.pressure - ELASTIC.wheelDeadZone), ELASTIC.wheelMax);

        const idle = (now - scrollInput.at) / 1000;
        // The idle title screen teases the drive a few times: the car revs.
        if (!started && sinceEntered >= 0 && teaseIdx < TEASES.length && sinceEntered >= TEASES[teaseIdx]) {
          teaseIdx += 1;
          teaseAt = now;
          blinkParity = flip(blinkParity);
        }
        if (sinceEntered >= BLINK_AT && blinkParity === null) blinkParity = "1";
        const tease = teaseOffset((now - teaseAt) / 1000);

        // The pit limiter (scroll/dash.ts): an unread line up holds the car
        // at 80 km/h until it has been read. The frame its wall opens, the
        // dash says ALL CLEAR and the cap lifts for that long, so a car
        // still pushed leaves the pit lane. A rewind never opens a wall.
        const rate = meterRate(scrollInput.meter, now / 1000);
        // Her foot on the pedal: its demand drives the strip and the world's pace, never the
        // scolding (the note and Skip's patience read the meter alone).
        const foot = pedal.down ? scrollInput.pedal : 0;
        const holding = scrollGate.pressure > 0 && now - scrollGate.pushedAt < HOLDING_MS;
        const unreadCard = beat === "card";
        if (unreadCard) {
          limitWall = k;
        } else if (limitWall >= 0 && story.done[limitWall]) {
          limitWall = -1;
          clearUntil = now + DASH.clearHold * 1000;
          sweepUntil = now + DASH.releaseSweep * 1000;
          releaseParity = flip(releaseParity);
          if (pedal.down) buzz([6, 40, 6]);
        }
        const clearing = now < clearUntil;
        const limiter = limiterState({ unreadCard, holding, sinceInput: idle });

        // The dash, the pace and the hold note (scroll/feedback.ts): the
        // world surges with her push, cruises while a line plays (capped by
        // the limiter) and, once it is her turn, brakes to a crawl and
        // waits for her.
        fbInput.started = started;
        fbInput.p = p;
        fbInput.sinceInput = idle;
        fbInput.sinceBackward = (now - lastBack) / 1000;
        fbInput.pictureSpeed = pictureSpeed;
        fbInput.playing = beat !== null;
        fbInput.meterRate = Math.max(rate, foot);
        fbInput.sinceEntered = sinceEntered;
        fbInput.teasing = tease > 0;
        // A frame pushes for the note only if the held input grew in it, fast enough: a fling's
        // momentum tails off under that, and a thumb resting on the glass adds nothing.
        if (isNotePush(added / vh, realDt)) notePushAt = scrollGate.pushedAt;
        fbInput.sincePush = (now - notePushAt) / 1000;
        fbInput.held = added / vh;
        fbInput.touch = touchMode;
        fbInput.unreadCard = unreadCard ? active : -1;
        fbInput.limited = unreadCard && !clearing;
        stepFeedback(feedback, fbInput, realDt);
        const nextMode = feedback.mode;
        const pace = feedback.pace;
        heroFeedback.pace = pace;
        heroFeedback.fovKick = fovKick(pace);
        const deep = deepWait(feedback);
        // Her turn: the transport says WAITING (the dash asks with her gesture), and only then do the marker and the cues ask for more.
        const turn = nextMode === "waiting";

        // A read card that waits for her: the marker bobs, labelled at first.
        const fill = active >= 0 ? readFill(walls, story, active) : 0;
        const ready = active >= 0 && fill >= 1 && turn;
        if (ready && readyCard !== active) {
          readyCard = active;
          readyCount += 1;
          readyParity = flip(readyParity);
          cueLabel = readyCount <= CUE_LABELS;
        } else if (!ready) {
          readyCard = -1;
          cueLabel = false;
        }

        // One prompt says what to do next wherever the picture rests.
        promptInput.started = started;
        promptInput.sinceStart = sinceStart;
        promptInput.p = p;
        promptInput.card = active >= 0;
        promptInput.rewinding = rewinding;
        promptInput.idle = idle;
        promptInput.turn = turn;
        const prompt = promptFor(promptInput);
        const hint = hintOpacity(promptInput);
        const hintPrompt =
          (prompt === "hint" || prompt === "ack" || prompt === "onward") && (started || sinceEntered >= HINT_AT)
            ? prompt
            : null;
        // She has the wheel but the name is still forming or holding: the answer says why nothing moves yet.
        const naming = started && !story.done[0];
        if (hintPrompt !== lastPrompt) {
          if (hintPrompt) popParity = flip(popParity);
          lastPrompt = hintPrompt;
        }

        // A long wait escalates gently: the marker or the cue asks again,
        // the card lifts, and the car crawls lower (feedback.ts).
        if (idle < lastIdle) reminderIdx = 0;
        lastIdle = idle;
        const restFor = turn ? feedback.waitingFor : prompt === "end" ? idle - STORY.endIdle : -1;
        if (restFor >= 0 && reminderIdx < REMINDERS.length && restFor >= REMINDERS[reminderIdx]) {
          reminderIdx += 1;
          reminderAt = now;
          remindParity = flip(remindParity);
          if (ready) {
            readyParity = flip(readyParity);
            cueLabel = true;
          }
        }
        const reminderLift = ready ? REMINDER_LIFT * teaseOffset((now - reminderAt) / 1000) : 0;

        // Pushing at full throttle for long, Skip offers itself. Her demand, not the pace: the limiter caps that at a card.
        const demand = paceFor(rate);
        fight = fightLevel(fight, pushingHard({ demand, holding, wall: k }), realDt);
        if (fight >= FIGHT.expandAt) expandSkip(now);

        // Skip shows with the hint, so there is always a way out, until the fade.
        const skipVisible = (started || sinceEntered >= HINT_AT) && p < STORY.fadeFrom;
        if (skipVisible && !skipState.visible) skipState.shownAt = now;
        skipState.visible = skipVisible;
        if (!skipVisible) skipState.until = Number.NEGATIVE_INFINITY;
        const skipExpanded = now < skipState.until;
        const speed = speedKmh(pace, drive.speed);

        // The dash: what it shows, where, and her throttle on the strip.
        const titleOut = clamp01(p / STORY.titleOut);
        const vis = dashVisibility({ layout, started, sinceEntered, titleOut, p });
        const nextShow = dashShow({ p, started, mode: nextMode, limiter, clearing });
        const lim = nextShow === "limiter" ? limiter : "off";
        // Before her first input the strip blips with each tease, as the car revs.
        // Her throttle: her input's, or her foot on the pedal, whichever is further down.
        // A push suspended by going back is no throttle: the strip shows her foot only while it drives.
        const shownFoot = pedal.suspended ? 0 : pedal.shown;
        revs = easeRevs(revs, Math.min(1, stripThrottle(rate, shownFoot) + (started ? 0 : DASH.teaseRevs * tease)), realDt);
        const lit = nextShow === "reverse" ? 0 : lim === "hit" ? DASH.limiterLeds : litLeds(revs, lim !== "off");
        // Every input of hers flares the strip in the next frame: a forward event (a held pedal is
        // one, its press), and a push held at a wall.
        if (scrollInput.stepAt !== lastStepAt || scrollGate.pushedAt !== lastKnockAt) {
          lastStepAt = scrollInput.stepAt;
          lastKnockAt = scrollGate.pushedAt;
          kick = 1;
        } else {
          kick = decay(kick, realDt, DASH.kickTau);
        }
        if (vis !== "off" && Number.isNaN(bootUntil)) bootUntil = now + DASH.boot * 1000;
        const nowOnStage = p < 1;
        if (nowOnStage !== onStage) {
          onStage = nowOnStage;
          markOnStage(onStage);
        }

        // The first line read and a quiet moment (or the intro skipped): side hints may come.
        if (
          loading.entered &&
          !loading.settled &&
          (k < 0 || story.done[settleWalls[1]] || (story.done[settleWalls[0]] && idle >= SETTLE_IDLE))
        ) {
          markSettled();
        }

        // Resting mid-dissolve, the title finishes its fade instead of hanging there as a ghost.
        titleSettle = settleTitle(titleSettle, p, movedBack, turn, realDt);

        // Nothing asks her for anything: side hints (the radio's) may show. Behind her, the hero asks nothing.
        const asking =
          hintPrompt !== null || prompt !== null || ready || feedback.hold.visible || skipExpanded || !started;
        const nowQuiet = p >= 1 || !asking;
        if (nowQuiet !== quiet) {
          quiet = nowQuiet;
          markQuiet(quiet);
        }

        // ---- draw: writes only from here on, and only what changed ----
        const titleO = round3((1 - titleOut) * (1 - titleSettle));
        if (titleO !== drawn.titleO) {
          drawn.titleO = titleO;
          set(title.current, "opacity", titleO.toFixed(3));
        }
        // The title lifts a little into the sky as it fades, and gives under a push.
        const titleY = round2(-8 * titleOut);
        const titleLift = round2(-((k === 0 ? nudge : 0) + TEASE_LIFT * tease));
        if (titleY !== drawn.titleY || titleLift !== drawn.titleLift) {
          drawn.titleY = titleY;
          drawn.titleLift = titleLift;
          set(title.current, "transform", `translate3d(0, ${titleY.toFixed(2)}%, 0) translateY(${titleLift.toFixed(2)}px)`);
        }
        const bars = round3(clamp01(p / STORY.barsOut + (TEASE_BARS / 100) * tease));
        if (bars !== drawn.bars) {
          drawn.bars = bars;
          set(el.barTop, "transform", `translate3d(0, ${(-100 * bars).toFixed(2)}%, 0)`);
          set(el.barBottom, "transform", `translate3d(0, ${(100 * bars).toFixed(2)}%, 0)`);
          set(el.hint, "--bars", bars.toFixed(3));
        }
        const hintO = round3(hint);
        if (hintO !== drawn.hint) {
          drawn.hint = hintO;
          set(el.hint, "opacity", hintO.toFixed(3));
        }
        attr(el.hint, "data-prompt", hintPrompt);
        attr(el.hint, "data-naming", naming);
        attr(el.hint, "data-pop", hintPrompt ? popParity : null);
        attr(el.hint, "data-blink", started ? null : blinkParity);
        const night = clamp01((p - STORY.fadeFrom) / (1 - STORY.fadeFrom));
        const nightO = round3(night * night);
        if (nightO !== drawn.night) {
          drawn.night = nightO;
          set(el.fade, "opacity", nightO.toFixed(3));
        }

        for (let i = 0; i < el.cards.length; i += 1) {
          const card = el.cards[i];
          const isActive = i === active;
          const opacity = round3(story.opacity[i]);
          if (opacity !== drawnOpacity[i]) {
            drawnOpacity[i] = opacity;
            set(card, "opacity", opacity.toFixed(3));
          }
          if (opacity > 0 || isActive) {
            // Rises in from below, drifts up on the way out; the active card gives under a push.
            const y = round2(
              isActive ? STORY.cardRise * (1 - opacity) - nudge - reminderLift : -STORY.cardRise * (1 - opacity),
            );
            if (y !== drawnY[i]) {
              drawnY[i] = y;
              set(card, "transform", `translate3d(0, ${y.toFixed(2)}px, 0)`);
            }
          }
          attr(card, "data-active", isActive);
        }
        if (active !== lastActive) {
          if (lastActive >= 0) {
            attr(el.cards[lastActive], "data-ready", null);
            attr(el.cards[lastActive], "data-cue-label", false);
            attr(el.cards[lastActive], "data-read", false);
          }
          drawn.read = drawn.push = Number.NaN;
          if (active >= 0) {
            // One layout read per card change: the hold note sits above the card.
            set(el.holdNote, "--va-card-h", `${el.cards[active].offsetHeight}px`);
            // Keyboard users hear the line they stepped to.
            // His name once per line, as in the script: the cards after a line's first are its words alone.
            if (scrollInput.source === "key" && el.live) {
              el.live.textContent = lineStarts.has(active) ? `${speaker}: ${cardTexts[active]}` : cardTexts[active];
            }
          }
          lastActive = active;
        }
        if (active >= 0) {
          const card = el.cards[active];
          const read = readStep(fill);
          if (read !== drawn.read) {
            drawn.read = read;
            set(card, "--read", read.toFixed(2));
          }
          const push = round2(pushFlash);
          if (push !== drawn.push) {
            drawn.push = push;
            set(card, "--push", push.toFixed(2));
          }
          attr(card, "data-ready", ready ? readyParity : null);
          attr(card, "data-cue-label", ready && cueLabel);
          // Read: the bar turns from the limiter's cyan to ALL CLEAR's sodium.
          attr(card, "data-read", fill >= 1);
        }
        // Rewinding flicks through the cards: hide them instead.
        attr(el.captions, "data-rewinding", rewinding);
        attr(el.cue, "data-visible", prompt === "between");
        // A card coming up takes the cue's place at once: never both on screen.
        attr(el.cue, "data-gone", active >= 0);
        attr(el.cue, "data-remind", prompt === "between" ? remindParity : null);
        attr(el.holdNote, "data-visible", feedback.hold.visible);
        // The note rides on the card it talks about, stretch and all.
        const noteY = round2(-(nudge + reminderLift));
        if (noteY !== drawn.noteY) {
          drawn.noteY = noteY;
          set(el.holdNote, "transform", `translate3d(-50%, ${noteY.toFixed(2)}px, 0)`);
        }
        attr(el.endCue, "data-visible", prompt === "end");

        const dash = el.dash;
        attr(dash, "data-vis", vis);
        attr(dash, "data-show", nextShow);
        if (nextShow !== show) {
          show = nextShow;
          showParity = flip(showParity);
        }
        attr(dash, "data-pulse", showParity);
        attr(dash, "data-lim", lim === "off" ? null : lim);
        attr(dash, "data-release", now < sweepUntil ? releaseParity : null);
        attr(dash, "data-boot", now < bootUntil);
        attr(dash, "data-remind", nextShow === "prompt" && turn ? remindParity : null);
        // The transport's own mode, for tools/capture/scrollux.mjs: what the dash shows is data-show.
        attr(dash, "data-mode", nextMode);
        if (lit !== drawn.lit) {
          drawn.lit = lit;
          set(el.strip, "--lit", String(lit));
        }
        const kickStep = Math.round(kick * 20) / 20;
        if (kickStep !== drawn.kick) {
          drawn.kick = kickStep;
          set(el.strip, "--kick", kickStep.toFixed(2));
        }
        // The limit sign's ring is the line's reading bar, drawn from the same value.
        if (lim !== "off") {
          const ring = readStep(fill);
          if (ring !== drawn.lim) {
            drawn.lim = ring;
            set(dash, "--lim", ring.toFixed(2));
          }
        }
        if (speed !== shownSpeed) {
          shownSpeed = speed;
          const cells = speedCells(speed);
          for (let i = 0; i < el.cells.length; i += 1) {
            if (cells[i] === drawnCells[i]) continue;
            drawnCells[i] = cells[i];
            el.cells[i].textContent = cells[i];
          }
        }
        for (let i = 0; i < el.reel.length; i += 1) {
          const segment = round3(clamp01(p * SHOT_COUNT - i));
          if (segment === drawnFill[i]) continue;
          drawnFill[i] = segment;
          set(el.reel[i], "--fill", segment.toFixed(3));
        }
        attr(el.skip, "data-visible", skipVisible);
        attr(el.skip, "data-expanded", skipExpanded);

        // The pedal: her foot on the plate (--lv), lit like the strip, and what the dash says in its
        // own words: the limiter's cyan and gate, a knock, ALL CLEAR's sweep, her turn's pink rib,
        // the tag on a long wait. Before her first input it dips with each tease, as the car revs.
        // Once the page has left the hero, the pedal goes: it never floats alone over the next section.
        const pedalVis = pedalVisibility({ started, sinceEntered, p, reduced: false, wheelOpen, past: scroll > scrollFor(1) + 1 });
        const teach = started || pedal.down ? 0 : teachDip((now - teaseAt) / 1000);
        const lv = Math.round(Math.max(pedal.shown, teach) * 20) / 20;
        if (lv !== drawnPedal.lv) {
          drawnPedal.lv = lv;
          set(el.pedal, "--lv", lv.toFixed(2));
        }
        const pedalFloored = pedal.down && nextShow === "floored";
        const pedalState =
          pedalVis === "hidden" ? "hidden" : pedalFloored ? "floored" : pedal.down ? "down" : teach > 0 ? "teach" : "idle";
        attr(el.pedal, "data-vis", pedalVis);
        attr(el.pedal, "data-state", pedalState);
        attr(el.pedal, "data-down", pedal.down);
        attr(el.pedal, "data-lim", pedal.down && lim !== "off");
        attr(el.pedal, "data-knock", lim !== "off" && now - scrollGate.pushedAt < KNOCK_MS);
        attr(el.pedal, "data-clear", pedal.down && nextShow === "clear");
        attr(el.pedal, "data-turn", turn && !pedal.down);
        // HOLD offers the pedal on a long wait to one who has not just used it (her prompts already
        // name it then), and never beside "In a hurry?", which opens toward it on a narrow phone.
        attr(el.pedal, "data-tag", turn && deep && !pedal.down && scrollInput.source !== "pedal" && !skipExpanded);
        attr(el.pedal, "data-reverse", nextShow === "reverse");
        attr(root, "data-started", started);
        attr(root, "data-hurry", skipExpanded);
        attr(root, "data-input", scrollInput.source ?? (loading.enteredVia === "key" ? "key" : null));

        if (pick.shot !== currentShot) {
          currentShot = pick.shot;
          setShot(pick.shot);
        }

        // A line she asked for at the title plays once the name has formed, unless she has driven on since.
        if (!Number.isNaN(queuedAt) && story.done[0]) {
          if (scrollInput.eventAt === queuedInput && now - queuedAt < TITLE_QUEUE_MS) stepLine(1, null);
          queuedAt = queuedInput = Number.NaN;
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
              // The page's own offset this frame, and where Lenis heads.
              page: reading.page,
              lenisTarget: lenis ? lenis.targetScroll : null,
              lenisState: lenis ? String(lenis.isScrolling) : null,
              maxScroll: Number.isFinite(scrollGate.maxScroll) ? scrollGate.maxScroll : null,
              frontier: Number.isFinite(fr) ? fr : null,
              wall: k,
              active,
              beat,
              opacity: active >= 0 ? story.opacity[active] : 0,
              opacities: story.opacity.map((o) => o.toFixed(3)).join(","),
              read: fill,
              pace,
              speed,
              pressure: scrollGate.pressure,
              nudge,
              push: pushFlash,
              waiting: feedback.waitingFor,
              deep,
              rhythm: feedback.rhythm,
              mode: nextMode,
              // The dash.
              demand,
              revs,
              lit,
              lim,
              show: nextShow,
              vis,
              kick,
              clearing,
              limited: fbInput.limited === true,
              turnFor: feedback.turnFor,
              titleSettle,
              quiet,
              started,
              ready,
              cueLabel: ready && cueLabel,
              prompt,
              hintPrompt,
              naming,
              cue: prompt === "between",
              holdNote: feedback.hold.visible,
              holdSpan: feedback.hold.span,
              holdHeld: feedback.hold.held,
              endCue: prompt === "end",
              skip: skipVisible,
              skipExpanded,
              hint,
              hintOn: hintPrompt !== null,
              tease,
              rewinding,
              source: scrollInput.source,
              // The pedal.
              pedalDown: pedal.down,
              pedalLevel: pedal.level,
              pedalShown: pedal.shown,
              pedalContact: pedal.contact,
              pedalSuspended: pedal.suspended,
              pedalVia: pedal.via,
              pedalState,
              pedalRibs: pedalRibs(pedal.shown, lim !== "off"),
              foot,
              settled: loading.settled,
              inputAt: Number.isFinite(scrollInput.at) ? Math.round(scrollInput.at) : null,
            });
          }
        }
      };

      /**
       * The film's walls open: Skip, Esc and End, the way on at the end of
       * the drive, a link or a deep link to a later section (lib/navigate.ts
       * opens the passage on the way past), the focus moving below the hero.
       * She is past the hero for good: nothing pulls the page back to a wall
       * again, and the pedal lets go (nothing drives a film she has left).
       */
      const openWalls = () => {
        letGo();
        openAll(story);
        heroProgress.value = heroProgress.target = 1;
        scrollGate.maxScroll = Number.POSITIVE_INFINITY;
      };

      const skipToEnd = () => {
        openWalls();
        jumpToEnd();
      };

      /** A line step's glide: the pedal waits for it to land before it pushes on. */
      const glideTo = (target: number) => {
        const to = scrollFor(target);
        stepGlide = { to, until: performance.now() + LINE_GLIDE * 1000 };
        lenis?.scrollTo(to, { programmatic: false, duration: LINE_GLIDE, easing: easeOutCubic });
      };

      /**
       * Next or previous line (Space, PageDown, Shift+Space, PageUp, a tap,
       * a press of the pedal). `source` null replays a line she asked for
       * at the title, once the name has formed: no new input, no knock.
       * Returns whether the step knocked on an unread line.
       */
      const stepLine = (dir: 1 | -1, source: InputSource | null): boolean => {
        const now = performance.now();
        const fr = frontier(walls, story);
        // From where a glide already heads, so quick presses step line after line.
        const from = Math.min(fr, Math.max(heroProgress.value, lenis ? progressFor(lenis.targetScroll) : 0));
        const target = lineStep(dir, from, timeline, fr);
        if (source === null) {
          if (target !== null) glideTo(target);
          return false;
        }
        recordInput(dir * THROTTLE.keyStep * geom.vh, source, now, geom.vh);
        // At the title the line waits for the name to form, then plays (update).
        if (dir > 0 && frontierIndex(story) === 0) {
          queuedAt = now;
          queuedInput = scrollInput.eventAt;
        }
        let knocked = false;
        if (dir > 0 && (target === null || target < (lineStep(dir, from, timeline, Number.POSITIVE_INFINITY) ?? 1))) {
          // The next line waits for an unread card: the press knocks on it
          // (a bounce and a flash of its bar) and the picture creeps to its wall.
          scrollGate.pressure += ELASTIC.knock * geom.vh;
          scrollGate.pushedAt = now;
          knocked = true;
        }
        if (target !== null) glideTo(target);
        return knocked;
      };

      /** The page has left the hero: past the end of the drive, into the next section. */
      const pastHero = () => window.scrollY > scrollFor(1) + 1;

      /**
       * At the end of the drive, the way on: a glide into the next section
       * (THE USUAL SUSPECTS), as the end cue says. A tap or a click on the
       * picture, a press of the pedal (or the pedal held there through the
       * cue), W or Space. It lands like Skip: the pedal lets go and that
       * section takes the focus, so Space and the keyboard carry on from
       * there, never from the pedal left behind in the hero.
       */
      const goOn = (source: InputSource) => {
        if (!lenis || lenis.isStopped) return;
        recordInput(THROTTLE.keyStep * geom.vh, source, performance.now(), geom.vh);
        if (keyHold) spentKey = keyHold.code;
        if (pedal.down) letGo();
        endHold = 0;
        // Through the page's one way of moving (lib/navigate.ts), like Skip:
        // Lenis starts from where the page is, the walls open on the way past.
        goTo(section.getBoundingClientRect().bottom + window.scrollY, { glide: END_GLIDE, easing: easeOutCubic, focus: null });
        // The focus goes at once, not on arrival: a key pressed during the glide is the next section's.
        const next = section.nextElementSibling;
        if (next instanceof HTMLElement) focusInPlace(next);
      };

      /**
       * Presses the pedal (the button, W or Space; `at` is the event's own
       * time). A new press plays the next line exactly as Space or a tap
       * does, and knocks on an unread one (the push then rests there
       * without knocking again); at the end it glides on. A regrip just
       * carries on. Returns false when the film is not taking input.
       */
      const pressGas = (via: PedalVia, at: number): boolean => {
        if (stillQuery.matches || !getSceneLoading().entered || !lenis || lenis.isStopped || getRadio().wheel) return false;
        // Below the hero the pedal has gone with it: a click left on it (Space on a focused pedal) does nothing.
        if (pastHero()) return false;
        // Lenis steps on from the page, even after a native move it has not heard of yet (gate.ts).
        readScroll();
        const kind = pressPedal(pedal, via, at);
        if (kind === null) return true;
        pedalSource = via === "key" ? "key" : "pedal";
        pressBackAt = scrollInput.backwardAt;
        buzz(6);
        if (kind === "regrip") return true;
        if (heroProgress.value >= 0.999) goOn(pedalSource);
        else if (stepLine(1, pedalSource)) {
          // The press's knock is the arrival's: resting on that wall, the push does not knock again.
          pedal.contact = true;
          pedal.wall = frontierIndex(story);
        }
        return true;
      };

      /** Whether the glide of a line step is still in flight (another input took over if Lenis heads elsewhere). */
      const stepping = (now: number) =>
        stepGlide !== null && now < stepGlide.until && lenis !== undefined && Math.abs(lenis.targetScroll - stepGlide.to) < 1;

      /**
       * The pedal's frame, run by SmoothScroll right before lenis.raf: her
       * foot spools up, is input (so it is never her turn while it is down)
       * and, once the press's glide has landed, pushes the scroll on at up
       * to PEDAL.vFull screens a second, trimmed at the wall and at the end
       * of the hero. It knocks once when it meets the wall and then rests
       * there: resting is not pushing (no pressure, no note, no Skip offer).
       * Going back suspends the push (suspendPedal) and her foot is no
       * input meanwhile: the car coasts and, if the push waits for a new
       * press, her turn comes. Resting at the very end of the drive is no
       * input either: the way on comes up while she holds, and once it has
       * been read (PEDAL.endHold) the pedal still held goes on with it.
       */
      scrollDrive.step = (deltaMs, lenisNow) => {
        const now = performance.now();
        // A frame counts at most what the story's clocks count: after a stall the picture does not leap.
        const dt = Math.min(Math.max(0, deltaMs) / 1000, STORY.maxStep);
        const level = stepPedal(pedal, dt);
        if (!pedal.down) {
          endHold = 0;
          return;
        }
        const back = scrollInput.backwardAt > pressBackAt;
        if (back) pressBackAt = scrollInput.backwardAt;
        const sinceBack = (now - Math.max(pressBackAt, backAt)) / 1000;
        if (suspendPedal(pedal, { back, sinceBack })) {
          scrollInput.pedal = 0;
          endHold = 0;
          return;
        }
        if (lenisNow.isStopped || stillQuery.matches) return;
        const end = scrollFor(1);
        if (heroProgress.value >= 0.999 && lenisNow.targetScroll >= end - 0.5 && !stepping(now)) {
          scrollInput.pedal = 0;
          endHold += dt;
          if (endHold >= PEDAL.endHold) goOn(pedalSource);
          return;
        }
        endHold = 0;
        recordPedal(pedalRate(level), pedalSource, now);
        if (stepping(now)) return;
        // Her foot pushes on from the page, not from where Lenis last left it: a native move it missed
        // (the scrollbar, find in page) would otherwise send the page back there (gate.ts lenisMissed).
        readScroll();
        const wall = Math.min(scrollGate.maxScroll, end);
        const { dest, knock } = pedalPush(pedal, {
          target: lenisNow.targetScroll,
          push: pedalSpeed(level) * geom.vh * dt,
          max: wall,
          dt,
          wall: frontierIndex(story),
        });
        // A knock is on a line's wall; the end of the hero is not a wall, the pedal just rests there.
        if (knock && scrollGate.maxScroll < end) {
          scrollGate.pressure += ELASTIC.knock * geom.vh;
          scrollGate.pushedAt = now;
        }
        if (dest > lenisNow.targetScroll + 0.01) lenisNow.scrollTo(dest, { programmatic: false, lerp: PEDAL.lerp });
      };

      // The frame runs from here on (stepLine above replays a line queued at the title).
      const tick = (_time: number, deltaMs: number) => update(deltaMs);
      gsap.ticker.add(tick);
      update(0);

      const onKey = (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        if (spentKey !== null && event.code === spentKey && event.repeat) {
          event.preventDefault();
          return;
        }
        const loading = getSceneLoading();
        if (!loading.entered || event.timeStamp - loading.enteredAt < KEY_GUARD_MS) return;
        if (!lenis || lenis.isStopped || stillQuery.matches) return;
        const scroll = window.scrollY;
        // In the hero: pinned, or resting at its very end, where W, Space and PageDown glide on.
        const inHero = scroll >= geom.top - 1 && scroll <= geom.top + geom.range + 1;
        if (!inHero) return;
        const atEnd = heroProgress.value >= 0.999;
        const onPedal = event.target instanceof Element && el.pedal !== null && el.pedal.contains(event.target);
        const action = keyAction({
          key: event.key,
          code: event.code,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
          targetKind: onPedal ? "other" : targetKind(event.target, modality.clicked),
          onPedal,
        });
        if (!action) return;
        // W and Space are the pedal: down drives, up lets go. Their autorepeat is no new press, only
        // the heartbeat that says the key is still held (a silent one lost its keyup).
        const gas = action === "gas" || (action === "next" && (event.key === " " || event.key === "Spacebar"));
        if (gas && event.repeat) {
          event.preventDefault();
          if (keyHold && keyHold.code === event.code) {
            keyHold.at = performance.now();
            keyHold.repeating = true;
          }
          return;
        }
        if (atEnd && action !== "gas" && action !== "next") return;
        event.preventDefault();
        // Lenis steps on from the page, even after a native move it has not heard of yet (gate.ts).
        readScroll();
        if (gas) {
          if (pressGas("key", event.timeStamp) && pedal.via === "key") {
            keyHold = { code: event.code, key: event.key, at: performance.now(), repeating: false };
          } else if (atEnd) {
            // The press went on into the next section: held on, the key's autorepeat must not scroll past it.
            spentKey = event.code;
          }
          return;
        }
        if (atEnd) {
          goOn("key");
          return;
        }
        // Enter on the focused pedal is a tap on it: the plate dips, the next line plays. It never holds.
        if (onPedal && event.key === "Enter") {
          if (!event.repeat && pressGas("key", event.timeStamp)) letGo(event.timeStamp);
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

      /** W or Space up: she lets go. (Space up on the focused pedal must not click it as well.) */
      const onKeyUp = (event: KeyboardEvent) => {
        if (event.code === spentKey) spentKey = null;
        if (!keyHold) return;
        if (event.code !== keyHold.code && event.key !== keyHold.key) return;
        if (event.key === " " || event.key === "Spacebar") event.preventDefault();
        letGo(event.timeStamp);
      };
      /** The window lost the keyboard or the page went away: a held pedal's release would never come. */
      const onWindowBlur = () => {
        if (pedal.down) letGo();
      };
      const onPageHide = () => {
        if (pedal.down) letGo();
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
          // The events' own times: a slow frame that runs the handlers late never turns a tap into a hold.
          at: event.timeStamp,
          button: event.button,
          type: event.pointerType,
          lastInput: scrollInput.at,
        };
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!press || event.pointerId !== press.id) return;
        const down = press;
        press = null;
        if (!getSceneLoading().entered || stillQuery.matches) return;
        const tap = isPictureTap({
          dx: event.clientX - down.x,
          dy: event.clientY - down.y,
          ms: event.timeStamp - down.at,
          sinceScroll: down.at - down.lastInput,
          button: down.button,
        });
        if (!tap) return;
        // Lenis steps on from the page, even after a native move it has not heard of yet (gate.ts).
        readScroll();
        // A mouse click is answered in its own words ("click to keep driving"); a pen or a finger is a tap.
        const source: InputSource = down.type === "mouse" ? "click" : "touch";
        if (heroProgress.value < 1) {
          stepLine(1, source);
          return;
        }
        // At the end of the drive the next one glides on into THE USUAL SUSPECTS, as the end cue says.
        goOn(source);
      };

      /**
       * The pedal under a finger or the mouse: down presses it (primary
       * button only), and it stays down, captured, wherever the pointer
       * slides, until up, a cancel (the home indicator, an alert) or a lost
       * capture. The mouse never focuses it, so Space is not "kept" on it.
       */
      const onPedalDown = (event: PointerEvent) => {
        pedalPointerAt = performance.now();
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (pedal.down) return;
        if (!pressGas(event.pointerType === "mouse" ? "mouse" : "touch", event.timeStamp) || !pedal.down) return;
        pointerHold = event.pointerId;
        pointerHoldAt = performance.now();
        try {
          el.pedal?.setPointerCapture(event.pointerId);
        } catch {
          // The pointer is already gone: its up or cancel lets go.
        }
      };
      const onPedalMove = (event: PointerEvent) => {
        if (event.pointerId === pointerHold) pointerHoldAt = performance.now();
      };
      const onPedalUp = (event: PointerEvent) => {
        pedalPointerAt = performance.now();
        if (event.pointerId === pointerHold) letGo(event.timeStamp);
      };
      const onPedalMouseDown = (event: Event) => event.preventDefault();
      const onPedalMenu = (event: Event) => event.preventDefault();
      /**
       * A click no pointer pressed (VoiceOver, Voice Control, Switch Control): a tap on the pedal. The
       * click that ends a press or a hold of the mouse comes right after its pointerup, and is not one.
       */
      const onPedalClick = (event: globalThis.MouseEvent) => {
        if (event.detail !== 0 && performance.now() - pedalPointerAt < PEDAL_CLICK_MS) return;
        if (pedal.down) return;
        const at = performance.now();
        if (pressGas("mouse", at)) letGo(at);
      };

      /**
       * How the focus last moved, for targetKind: the control a pointer
       * focused, directly or handed back to it later by a dialog (closed
       * by a click or by Esc), is `clicked`. A key pressed since the last
       * pointer press or release makes a new focus the keyboard's, and a
       * Tab makes every control the keyboard's again (focusFromPointer).
       */
      const modality = {
        pointerAt: Number.NEGATIVE_INFINITY,
        keyAt: Number.NEGATIVE_INFINITY,
        tabAt: Number.NEGATIVE_INFINITY,
        clicked: null as Element | null,
        /** When the pointer last focused each control: focus handed back to it stays the pointer's. */
        owned: new WeakMap<Element, number>(),
      };
      const onAnyPointer = () => {
        modality.pointerAt = performance.now();
      };
      const onAnyKey = (event: KeyboardEvent) => {
        modality.keyAt = performance.now();
        if (event.key === "Tab") modality.tabAt = modality.keyAt;
      };

      /** Focus moving past the hero (Tab into the next section) opens the walls instead of being pulled back. */
      const onFocusIn = (event: FocusEvent) => {
        const target = event.target;
        const now = performance.now();
        const pointer =
          target instanceof Element &&
          focusFromPointer({
            focusAt: now,
            pointerAt: modality.pointerAt,
            keyAt: modality.keyAt,
            tabAt: modality.tabAt,
            ownedAt: modality.owned.get(target),
          });
        if (pointer) modality.owned.set(target, now);
        modality.clicked = pointer ? target : null;
        if (!(target instanceof Node) || root.contains(target)) return;
        // Focus left the hero: whatever held the pedal is elsewhere now.
        if (pedal.down) letGo(now);
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
        // A second finger (a thumb already on the pedal) gets no click from the browser: its lift is the tap.
        skipPointerUp: (event) => {
          if (event.pointerType !== "touch" || event.isPrimary) return;
          const down = skipState.down;
          skipState.down = null;
          if (!down) return;
          const now = performance.now();
          const allowed = skipTapAllowed({
            pointerType: down.type,
            sinceTouchEnd: now - scrollGate.touchEndAt,
            sinceShown: now - skipState.shownAt,
            moved: Math.hypot(event.clientX - down.x, event.clientY - down.y),
            ms: now - down.at,
          });
          if (allowed) skipToEnd();
        },
      };

      // A link, a deep link or Skip taking the page past the hero opens its walls first (lib/navigate.ts).
      const unregisterPassage = registerPassage({ section, open: openWalls });
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onWindowBlur);
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("resize", remeasure);
      document.addEventListener("visibilitychange", onVisibility);
      root.addEventListener("pointerdown", onPointerDown);
      root.addEventListener("pointerup", onPointerUp);
      const pedalEl = el.pedal;
      pedalEl?.addEventListener("pointerdown", onPedalDown);
      pedalEl?.addEventListener("pointermove", onPedalMove);
      pedalEl?.addEventListener("pointerup", onPedalUp);
      pedalEl?.addEventListener("pointercancel", onPedalUp);
      pedalEl?.addEventListener("lostpointercapture", onPedalUp);
      pedalEl?.addEventListener("mousedown", onPedalMouseDown);
      pedalEl?.addEventListener("contextmenu", onPedalMenu);
      pedalEl?.addEventListener("click", onPedalClick);
      // The W keycaps show the layout's own letter at W's place (Z on AZERTY), where the browser says.
      const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } })
        .keyboard;
      keyboard
        ?.getLayoutMap?.()
        .then((map) => {
          const letter = map.get("KeyW");
          if (disposed || !letter) return;
          for (const cap of el.keyCaps) cap.textContent = letter.toUpperCase();
        })
        .catch(() => {});
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("pointerdown", onAnyPointer, true);
      document.addEventListener("pointerup", onAnyPointer, true);
      document.addEventListener("keydown", onAnyKey, true);

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
          goTo(scrollFor(value), { focus: null });
          update(0);
        };
      }

      return () => {
        disposed = true;
        for (const text of cardText) text?.style.removeProperty("--fit");
        unregisterPassage();
        gsap.ticker.remove(tick);
        letGo();
        scrollDrive.step = null;
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onWindowBlur);
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("resize", remeasure);
        document.removeEventListener("visibilitychange", onVisibility);
        resizeObserver?.disconnect();
        root.removeEventListener("pointerdown", onPointerDown);
        root.removeEventListener("pointerup", onPointerUp);
        pedalEl?.removeEventListener("pointerdown", onPedalDown);
        pedalEl?.removeEventListener("pointermove", onPedalMove);
        pedalEl?.removeEventListener("pointerup", onPedalUp);
        pedalEl?.removeEventListener("pointercancel", onPedalUp);
        pedalEl?.removeEventListener("lostpointercapture", onPedalUp);
        pedalEl?.removeEventListener("mousedown", onPedalMouseDown);
        pedalEl?.removeEventListener("contextmenu", onPedalMenu);
        pedalEl?.removeEventListener("click", onPedalClick);
        for (const cap of el.keyCaps) cap.textContent = "W";
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("pointerdown", onAnyPointer, true);
        document.removeEventListener("pointerup", onAnyPointer, true);
        document.removeEventListener("keydown", onAnyKey, true);
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

        {/* Decoration, like the dash: the screen-reader help says what the film is. */}
        <p className={styles.hudCamera} data-hud aria-hidden="true">
          {camera} {String(shot + 1).padStart(2, "0")}/{String(SHOT_COUNT).padStart(2, "0")}
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

        <ul className={styles.subtitles} data-captions>
          {lines.map((cards, lineIndex) => (
            <li key={cards.join(" ")} className={styles.line}>
              {cards.map((card, cardIndex) => (
                <span key={`${lineIndex}-${cardIndex}`} className={styles.subtitle} data-card>
                  {/* One block around the whole line, balanced, as wide as its widest line (cardFit.ts). */}
                  <span className={styles.subtitleText} data-card-text>
                    {/* Every card shows who speaks; a screen reader hears his name once per line. */}
                    <span className={styles.speaker} aria-hidden={cardIndex > 0 ? true : undefined}>
                      {speaker}:
                    </span>{" "}
                    {card}
                  </span>
                  {/* Under the block: the way on in her input's words, once the line is read and she waits.
                      The reading bar fills in the same place before it (::after). */}
                  <span className={styles.cueTail} aria-hidden="true">
                    <span className={styles.cueArrow}>
                      <span className={`${styles.glyph} ${styles.forDown}`} data-g="down" />
                      <span className={`${styles.glyph} ${styles.forTouch}`} data-g="up" />
                      <span className={`${styles.mouse} ${styles.forClick}`} data-g="click" />
                      <span className={`${styles.pg} ${styles.forPedal}`} data-g="pedal" />
                    </span>
                    <span className={styles.cueLabel}>
                      <span className={styles.forWheel}>{intro.next}</span>
                      <span className={styles.forTouch}>{intro.nextTouch}</span>
                      <span className={styles.forKey}>{intro.nextKey}</span>
                      <span className={styles.forClick}>{intro.nextClick}</span>
                      <span className={styles.forPedal}>{intro.nextPedal}</span>
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
          <span className={`${styles.glyph} ${styles.cueGlyph} ${styles.forDown}`} data-g="down" />
          <span className={`${styles.glyph} ${styles.cueGlyph} ${styles.forTouch}`} data-g="up" />
          <span className={`${styles.mouse} ${styles.cueGlyph} ${styles.forClick}`} data-g="click" />
          <span className={`${styles.pg} ${styles.cueGlyph} ${styles.forPedal}`} data-g="pedal" />
          <span className={styles.forWheel}>{intro.keepGoing}</span>
          <span className={styles.forTouch}>{intro.keepGoingTouch}</span>
          <span className={styles.forKey}>{intro.keepGoingKey}</span>
          <span className={styles.forClick}>{intro.keepGoingClick}</span>
          <span className={styles.forPedal}>{intro.keepGoingPedal}</span>
        </p>

        <div className={styles.hint} data-hint aria-hidden="true">
          <div className={styles.hintBox}>
            <p className={styles.hintLine1}>
              <span className={styles.forWheel}>{intro.hint}</span>
              <span className={styles.forTouch}>{intro.hintTouch}</span>
              <span className={styles.forKey}>{intro.hintKey}</span>
              <span className={`${styles.glyph} ${styles.hintGlyph} ${styles.forDown}`} data-g="down" />
              {/* On a phone the ask names the pedal first: its glyph, the pedal's own shape. */}
              <span className={`${styles.pg} ${styles.hintGlyph} ${styles.forTouch}`} data-g="pedal" />
            </p>
            {/* Her first input answered in place: the drive is hers now. */}
            <p className={styles.hintAck}>{intro.ack}</p>
            {/* Resting on the title once the wheel is hers: on, never "take the wheel" again. */}
            <p className={styles.hintOnward}>
              <span className={styles.forWheel}>{intro.keepGoing}</span>
              <span className={styles.forTouch}>{intro.keepGoingTouch}</span>
              <span className={styles.forKey}>{intro.keepGoingKey}</span>
              <span className={styles.forClick}>{intro.keepGoingClick}</span>
              <span className={styles.forPedal}>{intro.keepGoingPedal}</span>
              <span className={`${styles.glyph} ${styles.hintGlyph} ${styles.forDown}`} data-g="down" />
              <span className={`${styles.glyph} ${styles.hintGlyph} ${styles.forTouch}`} data-g="up" />
              <span className={`${styles.mouse} ${styles.hintGlyph} ${styles.forClick}`} data-g="click" />
              <span className={`${styles.pg} ${styles.hintGlyph} ${styles.forPedal}`} data-g="pedal" />
            </p>
            <p className={styles.hintLine2}>{intro.model}</p>
            {/* Under "you have the wheel" while the name still forms and holds: why the road waits. */}
            <p className={styles.hintArriving}>{intro.arriving}</p>
            <p className={styles.hintStill}>
              <span className={`${styles.glyph} ${styles.hintGlyph}`} data-g="down" />
              {intro.still}
            </p>
          </div>
        </div>

        {/* The dash (scroll/dash.ts), an F1 wheel display, not a tape deck: fifteen shift lights for her
            throttle, the car's speed, one word for what the car does, and the pit limiter's 80 sign while an
            unread line holds it. Decorative: the screen-reader help says the same in text. No gear letter: a
            "D" read as the WASD key to gamers. */}
        <div className={styles.dash} data-osd data-vis="off" data-show="hidden" aria-hidden="true">
          <div className={styles.strip} data-strip>
            {[0, 1, 2].map((group) => (
              <span key={group} className={styles.group}>
                {[0, 1, 2, 3, 4].map((light) => (
                  <i key={light} className={styles.led} style={{ "--i": group * 5 + light } as CSSProperties} />
                ))}
              </span>
            ))}
            <span className={styles.flare} />
          </div>
          <span className={styles.speed} data-speed>
            <b className={styles.digit} />
            <b className={styles.digit} />
            <b className={styles.digit} />
          </span>
          <span className={styles.side}>
            <span className={styles.unit}>{osd.unit}</span>
            <span className={styles.status}>
              <span data-w="drive">{osd.drive}</span>
              <span data-w="floored">{osd.floored}</span>
              <span data-w="reverse">{osd.reverse}</span>
              <span data-w="limiter">{osd.limiter}</span>
              <span data-w="clear">{osd.clear}</span>
              {/* The car waits for her: the way on, in her last input's words. */}
              <span data-w="prompt">
                <span className={`${styles.glyph} ${styles.forTouch}`} data-g="up" />
                <span className={`${styles.mouse} ${styles.forWheel}`} data-g="wheel" />
                <span className={`${styles.mouse} ${styles.forClick}`} data-g="click" />
                <span className={`${styles.pg} ${styles.forPedal}`} data-g="pedal" />
                <span className={styles.forWheel}>{intro.next}</span>
                <span className={styles.forTouch}>{intro.nextTouch}</span>
                <span className={styles.forClick}>{intro.nextClick}</span>
                <span className={styles.forPedal}>{intro.nextPedal}</span>
                <kbd className={`${styles.keycap} ${styles.forKey}`} data-pedal-key>
                  W
                </kbd>
                <kbd className={`${styles.keycap} ${styles.forKey}`}>{intro.nextKey}</kbd>
              </span>
            </span>
            <span className={styles.sign}>
              <span>{LIMITER.kmh}</span>
            </span>
          </span>
        </div>

        {/* Before the pedal, which stays over it: at the end the way on still names it. */}
        <div className={styles.fade} data-fade aria-hidden="true" />

        <div className={styles.skip} data-skip data-hud>
          <Button
            variant="ghost"
            size="sm"
            className={styles.skipButton}
            aria-label={skipLabel}
            aria-keyshortcuts="Escape End"
            onPointerDown={(event) => actions.current?.skipPointerDown(event)}
            onPointerUp={(event) => actions.current?.skipPointerUp(event)}
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

        {/* The pedal (scroll/pedal.ts): hold to drive, a press for the next line. After Skip in tab order. */}
        <Pedal label={pedalCopy.label} tag={pedalCopy.tag} help={pedalCopy.help} />

        <p className="sr-only" aria-live="polite" data-live />

        {/* Over the fade, so it reads from the first frame of the night. */}
        <p className={styles.endCue} data-end-cue aria-hidden="true">
          <span className={`${styles.glyph} ${styles.cueGlyph} ${styles.forDown}`} data-g="down" />
          <span className={`${styles.glyph} ${styles.cueGlyph} ${styles.forTouch}`} data-g="up" />
          <span className={`${styles.mouse} ${styles.cueGlyph} ${styles.forClick}`} data-g="click" />
          <span className={`${styles.pg} ${styles.cueGlyph} ${styles.forPedal}`} data-g="pedal" />
          <span className={styles.notClick}>{intro.end}</span>
          <span className={styles.forClick}>{intro.endClick}</span>
          <span className={styles.forPedal}>{intro.endPedal}</span>
        </p>
      </div>
    </div>
  );
}
