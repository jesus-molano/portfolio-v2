"use client";

import { useLenis } from "lenis/react";
import {
  Fragment,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  type EnteredVia,
  getSceneLoading,
  getServerSceneLoading,
  markEntered,
  subscribeSceneLoading,
} from "@/features/hero/sceneLoading";
import { entryStation, readMemory, requestMusic } from "@/features/music/radio";
import { DEFAULT_STATION_ID, findStation, formatFrequency, STATIONS } from "@/features/music/stations";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./LoadingScreen.module.css";
import {
  eligible,
  entersOnKey,
  firstTip,
  isSlow,
  pad2,
  percentLabel,
  type TipViewer,
  tipDuration,
  tipOrder,
} from "./tips";

type Props = {
  dict: Dictionary["loader"];
  /** `hero.name`: the lockup, and the dialog's name. */
  name: string;
  /** `hero.role`: the kicker under the name. */
  role: string;
};
type Phase = "loading" | "ready" | "leaving" | "gone";

/** Long enough to read one tip, short enough not to annoy. */
const MIN_VISIBLE_MS = 1600;
/** If the scene loaded but never says ready, let the visitor in anyway. */
const FAILSAFE_MS = 20000;
const LEAVE_MS = 700;
/** How often the screen asks whether the wait has become slow. */
const SLOW_POLL_MS = 250;
const TOUCH_QUERY = "(pointer: coarse)";

const subscribeNothing = () => () => {};

/** False on the server and while hydrating, true after: from then on the client's own values apply. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** What "enter with music" starts, as "BABYLON 105.1": the station requestMusic plays. */
function useEntryStationLabel(): string {
  const id = useSyncExternalStore(
    subscribeNothing,
    () => entryStation(readMemory()),
    () => DEFAULT_STATION_ID,
  );
  const station = findStation(id) ?? findStation(DEFAULT_STATION_ID) ?? STATIONS[0];
  return `${station.name} ${formatFrequency(station.frequency)}`;
}

/**
 * Which of the server's first cards a tip is: `motion` (tips[0], hidden
 * under reduced motion), `still` (shown only under reduced motion) or
 * `all` (both at once).
 */
function serverFirst(index: number, stillFirst: number): "motion" | "still" | "all" | undefined {
  if (index === 0) return index === stillFirst ? "all" : "motion";
  return index === stillFirst ? "still" : undefined;
}

/**
 * The cold open: the drive painted as key art, his name as the game logo,
 * a tip card bottom left, an action slot bottom right and a thin progress
 * line on the bottom edge. The slot shows the progress while the city
 * loads, then the two ways in, with music or without; any printable key
 * enters with music. The click or key press is the gesture browsers need
 * before they play sound.
 *
 * No layout shift: every box is placed against the viewport and has a
 * fixed size; both states of the slot and every tip are in the DOM from
 * the first paint, stacked in one cell, and the phases only switch
 * opacity, visibility and inert. Device and motion choices are media
 * queries, so the server's HTML already paints the right first tip.
 *
 * A slow wait (`isSlow`) says so in the card and brings the choices early,
 * so she can enter while the scene catches up.
 *
 * Accessibility: a modal dialog named by the lockup and described by the
 * loading state; the page behind is inert; the bottom line is the
 * progressbar; one polite live region says "slow" and "ready", once each;
 * the tips pause on hover or focus and have a Next button. Without
 * JavaScript it is hidden (see NO_JS_STYLE in the layout).
 */
export function LoadingScreen({ dict, name, role }: Props) {
  const { progress, ready } = useSyncExternalStore(
    subscribeSceneLoading,
    getSceneLoading,
    getServerSceneLoading,
  );
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const touch = useMediaQuery(TOUCH_QUERY);
  const stationLabel = useEntryStationLabel();
  const lenis = useLenis();
  const [phase, setPhase] = useState<Phase>("loading");
  const [slow, setSlow] = useState(false);
  /** The phase and the slow flag as of the last render, for event handlers. */
  const phaseRef = useRef<Phase>("loading");
  const slowRef = useRef(false);
  const shownAt = useRef(0);
  const progressAt = useRef(0);
  const dialog = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  const withMusic = useRef<HTMLButtonElement>(null);

  // Tips: her own order once the client knows her device and motion
  // setting; until then the server's first card, which CSS picks.
  const tips = dict.tips;
  const order = useMemo(
    () => (hydrated ? tipOrder(tips, { touch, reducedMotion, random: Math.random }) : null),
    [hydrated, tips, touch, reducedMotion],
  );
  const [position, setPosition] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Time left on a held tip, so it carries on where it stopped. */
  const remaining = useRef<{ position: number; ms: number } | null>(null);
  const current = order ? order[position % order.length] : null;
  const shownTip = tips[current ?? 0];
  const seconds = tipDuration(shownTip.text);

  /** The two ways in are on offer: loaded, or tired of waiting. */
  const choosing = phase !== "loading" || slow;
  const slowNow = phase === "loading" && slow;
  const rotating = order !== null && !slowNow && phase !== "leaving";
  const held = hovered || focused;

  // Start at the top of the drive.
  useEffect(() => {
    shownAt.current = performance.now();
    progressAt.current = shownAt.current;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    dialog.current?.focus();
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
    slowRef.current = slow;
  }, [phase, slow]);

  // While the screen is up, the page behind is inert and does not scroll.
  // The scroll comes back as soon as she has chosen: input during the fade
  // out already drives the hero, so her first scroll is never swallowed.
  useEffect(() => {
    const root = document.documentElement;
    // The skip link too: an aria-modal dialog keeps Tab and Shift+Tab inside.
    const behind = [
      document.querySelector(".skip-link"),
      document.getElementById("main"),
      document.querySelector("[data-page-controls]"),
    ];
    if (phase === "gone") {
      delete root.dataset.loading;
      behind.forEach((element) => element?.removeAttribute("inert"));
      lenis?.start();
      return;
    }
    root.dataset.loading = "";
    behind.forEach((element) => element?.setAttribute("inert", ""));
    if (phase === "leaving") lenis?.start();
    else lenis?.stop();
  }, [phase, lenis]);

  // Ready once the scene is, but never before one tip could be read.
  useEffect(() => {
    if (!ready || phase !== "loading") return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current));
    const timer = setTimeout(() => setPhase("ready"), wait);
    return () => clearTimeout(timer);
  }, [ready, phase]);

  // A scene that loaded but never says ready still lets her in. A slow one
  // already has, and keeps saying it is slow until it is ready.
  useEffect(() => {
    const timer = setTimeout(
      () => setPhase((p) => (p === "loading" && !slowRef.current ? "ready" : p)),
      FAILSAFE_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    progressAt.current = performance.now();
  }, [progress]);

  // A slow wait offers the way in early, and keeps offering it.
  useEffect(() => {
    if (phase !== "loading" || slow) return;
    const timer = setInterval(() => {
      const now = performance.now();
      const latest = getSceneLoading().progress;
      if (isSlow({ sinceMountMs: now - shownAt.current, sinceProgressMs: now - progressAt.current, progress: latest })) {
        // At once, not on the next render: an overdue failsafe may run right after this.
        slowRef.current = true;
        setSlow(true);
      }
    }, SLOW_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, slow]);

  // The choices appear (slow or loaded): focus the main one, unless she is
  // already on one of them, or on Next once loaded: a key press meant for
  // the next tip must not enter the city with music (the live region says
  // it is ready). The slow note hides Next, so its focus moves on.
  useEffect(() => {
    if (!choosing || phase === "leaving") return;
    const active = document.activeElement;
    if (choices.current?.contains(active)) return;
    if (!slowNow && card.current?.contains(active)) return;
    withMusic.current?.focus({ focusVisible: true });
  }, [choosing, phase, slowNow]);

  // The tip on screen moves on after its reading time, unless hover or
  // focus holds it.
  useEffect(() => {
    if (!rotating || held) return;
    const left = remaining.current?.position === position ? remaining.current.ms : seconds * 1000;
    const started = performance.now();
    const timer = setTimeout(() => setPosition((p) => p + 1), left);
    return () => {
      clearTimeout(timer);
      remaining.current = { position, ms: Math.max(0, left - (performance.now() - started)) };
    };
  }, [rotating, held, position, seconds]);

  const enter = useCallback((music: boolean, via: EnteredVia) => {
    const now = phaseRef.current;
    if (now !== "ready" && !(now === "loading" && slowRef.current)) return;
    phaseRef.current = "leaving";
    // Inside the click or key press: the browser allows audio.play() here.
    requestMusic(music);
    markEntered(via);
    setPhase("leaving");
  }, []);

  // Any printable key enters with music. Enter and Space are left to the
  // focused button, Tab moves between the controls.
  useEffect(() => {
    if (!choosing || phase === "leaving") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !entersOnKey(event)) return;
      enter(true, "key");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choosing, phase, enter]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("gone"), reducedMotion ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion]);

  // The counter's total before the client knows her device: CSS picks one.
  const totals = useMemo(() => {
    const count = (viewer: TipViewer) => pad2(tips.filter((tip) => eligible(tip, viewer)).length);
    return {
      "data-pointer": count({ touch: false, reducedMotion: false }),
      "data-pointer-still": count({ touch: false, reducedMotion: true }),
      "data-touch": count({ touch: true, reducedMotion: false }),
      "data-touch-still": count({ touch: true, reducedMotion: true }),
    };
  }, [tips]);
  const stillFirst = firstTip(tips, true);

  if (phase === "gone") return null;

  const loaded = phase !== "loading";
  const shownProgress = loaded ? 100 : progress;
  const nextTip = (event: MouseEvent<HTMLButtonElement>) => {
    setPosition((p) => p + 1);
    // Safari does not focus a tapped button; focus holds the new tip until she moves on.
    event.currentTarget.focus();
  };
  const enterFrom = (music: boolean) => (event: MouseEvent<HTMLButtonElement>) =>
    enter(music, event.detail > 0 ? "pointer" : "key");

  return (
    <div
      ref={dialog}
      className={styles.loader}
      data-loader
      data-phase={phase}
      data-slow={slowNow ? "" : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="loader-title"
      aria-describedby="loader-state"
      tabIndex={-1}
    >
      <div className={styles.art} aria-hidden="true">
        <div className={styles.scrim} />
        <div className={styles.grain} />
      </div>

      {/* A div, not a header: inside the dialog a header would be a stray banner landmark. */}
      <div className={styles.lockup} data-box="lockup">
        <h2 id="loader-title" className={styles.name}>
          {name.split(" ").map((word, index) => (
            <Fragment key={index}>
              {index > 0 ? " " : null}
              <span className={styles.word}>{word}</span>
            </Fragment>
          ))}
        </h2>
        <p className={styles.kicker}>
          <span className={styles.dot} aria-hidden="true" />
          {role}
        </p>
      </div>

      <div
        ref={card}
        className={styles.card}
        data-box="card"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <div className={styles.head}>
          <p className={styles.labels}>
            <span className={styles.label} data-on={!slowNow && shownTip.kind === "tip" ? "" : undefined}>
              {dict.labels.tip}
            </span>
            <span className={styles.label} data-on={!slowNow && shownTip.kind === "trivia" ? "" : undefined}>
              {dict.labels.trivia}
            </span>
            <span className={styles.label} data-slow-label data-on={slowNow ? "" : undefined}>
              {dict.slowLabel}
            </span>
          </p>
          <span className={styles.counter} aria-hidden="true">
            {pad2(order ? (position % order.length) + 1 : 1)}
            {" / "}
            {order ? pad2(order.length) : <span className={styles.total} {...totals} />}
          </span>
          <button type="button" className={styles.next} aria-label={dict.nextTip} data-next onClick={nextTip}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        </div>
        <div className={styles.body} data-tips>
          {tips.map((tip, index) => (
            <p
              key={index}
              className={styles.text}
              data-on={current === index ? "" : undefined}
              data-first={current === null ? serverFirst(index, stillFirst) : undefined}
            >
              {tip.text}
            </p>
          ))}
          <p className={styles.text} data-slow-text data-on={slowNow ? "" : undefined}>
            {dict.slow}
          </p>
        </div>
        <div className={styles.timer} aria-hidden="true">
          <i
            key={position}
            data-running={order ? "" : undefined}
            data-held={!rotating || held ? "" : undefined}
            style={{ animationDuration: `${seconds}s` }}
          />
        </div>
      </div>

      <div className={styles.slot} data-box="slot">
        <div className={styles.status} aria-hidden="true" inert={choosing}>
          <span className={styles.statusLabel}>
            <span className={styles.dot} />
            {dict.loading}
          </span>
          <span className={styles.percent}>{percentLabel(shownProgress)}</span>
        </div>
        <div ref={choices} className={styles.choices} inert={!choosing}>
          <Button
            ref={withMusic}
            variant="solid"
            size="lg"
            className={styles.music}
            data-enter="music"
            aria-describedby={touch ? undefined : "loader-hint"}
            onClick={enterFrom(true)}
          >
            <span className={styles.musicLabel}>{dict.withMusic}</span>
            <span className={styles.station}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M2 10v4M6 6v8M10 3v11M14 8v6" />
              </svg>
              <span className={styles.stationName}>{stationLabel}</span>
            </span>
          </Button>
          <Button variant="ghost" size="md" className={styles.silent} data-enter="silent" onClick={enterFrom(false)}>
            {dict.withoutMusic}
          </Button>
          <p id="loader-hint" className={styles.hint}>
            {dict.hint}
          </p>
        </div>
      </div>

      <div
        className={styles.line}
        data-box="line"
        role="progressbar"
        aria-label={dict.loading}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shownProgress)}
      >
        <div className={styles.fill} style={{ transform: `scaleX(${shownProgress / 100})` }} />
      </div>

      <p id="loader-state" className="sr-only">
        {loaded ? dict.ready : dict.loading}
      </p>
      <p className="sr-only" role="status">
        {loaded ? dict.ready : slowNow ? dict.slow : ""}
      </p>
    </div>
  );
}
