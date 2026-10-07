"use client";

import { useLenis } from "lenis/react";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type EnteredVia,
  getSceneLoading,
  getServerSceneLoading,
  markEntered,
  subscribeSceneLoading,
} from "@/features/hero/sceneLoading";
import { getEntryChoice, getServerEntryChoice, requestMusic, subscribeRadio } from "@/features/music/radio";
import { findStation, formatFrequency, STATIONS } from "@/features/music/stations";
import { Settings } from "@/features/settings/Settings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { type Locale, localeNames, locales } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { goTo } from "@/lib/navigate";
import styles from "./LoadingScreen.module.css";
import { canChoose, itemState, longestEm, MENU_ITEMS, type MenuItem, menuMove, moveSelection } from "./menu";
import { smoothProgress } from "./smoothProgress";
import { eligible, firstTip, isSlow, pad2, percentLabel, type TipViewer, tipDuration, tipOrder } from "./tips";

type Props = {
  dict: Dictionary["loader"];
  /** The same settings as the pause menu's (STATS's SETTINGS tab). */
  settings: Dictionary["stats"]["settings"];
  lang: Locale;
  /** The picture behind the menu, drawn on the server (Horizon.tsx). */
  art?: ReactNode;
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
/** The start menu's settings were open when she switched language: they open again on the new page. */
const REOPEN_KEY = "va-start-settings";
/** The slab's room around its word: before it, and after it (past the word's slide to the right). */
const SLAB_BEFORE = 14;
const SLAB_AFTER = 40;

const subscribeNothing = () => () => {};

/** False on the server and while hydrating, true after: from then on the client's own values apply. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
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
 * The start menu: a game's main menu over the causeway at sunset. No name
 * and no role here (the hero shows them once she starts): three huge
 * items, NEW GAME (in with the radio: the station it will play, or radio
 * off, from the radio store), CONTINUE (in without music) and SETTINGS
 * (the pause menu's own settings, in a modal dialog); a game tip card;
 * the language; the load as a status line, a percentage riding a
 * progress line on the bottom edge, the sun sinking and the causeway's
 * lamps lighting toward the city.
 *
 * The menu: a list of real buttons. The selection is a painted slab that
 * slides to the item, and it is the keyboard focus: ↑ and ↓, W and S (by
 * their place, menu.ts) move the focus and the slab with it, a mouse over
 * an item does the same, Enter or Space (the button's own) or a tap
 * chooses. No other key starts anything. The two ways in wait for the
 * scene ("waiting for the city"); chosen too soon they shake and say so.
 * A slow wait (`isSlow`) offers them early ("go now"), in the menu's own
 * lines, the status line and the tip card. SETTINGS works at once: what
 * she sets there applies when she starts (radio.ts cueEntry; the volume
 * and the subtitle size are stored as she sets them).
 *
 * No layout shift: every box is placed against the viewport and has a
 * fixed size; every state of every line and every tip is in the DOM from
 * the first paint, stacked in one cell, and the phases only switch
 * opacity, visibility, transform and inert. Device and motion choices are
 * media queries, so the server's HTML already paints the right layout and
 * first tip. The slab is measured once the faces are in, and shown then.
 *
 * Accessibility: a modal dialog named "Main menu" and described by the
 * loading state; the page behind is inert; each item is a button named by
 * its word and described by its line (station, waiting, go now); the
 * bottom line is the progressbar; one polite live region says "slow",
 * "ready" and "not yet". The settings are a native modal dialog (focus
 * kept inside, Esc or Back return to the menu, on SETTINGS). Without
 * JavaScript the screen is hidden (see NO_JS_STYLE in the layout).
 */
export function LoadingScreen({ dict, settings, lang, art }: Props) {
  const { progress, ready } = useSyncExternalStore(subscribeSceneLoading, getSceneLoading, getServerSceneLoading);
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const touch = useMediaQuery(TOUCH_QUERY);
  const choice = useSyncExternalStore(subscribeRadio, getEntryChoice, getServerEntryChoice);
  const lenis = useLenis();
  const [phase, setPhase] = useState<Phase>("loading");
  const [slow, setSlow] = useState(false);
  const [selected, setSelected] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [live, setLive] = useState("");
  const [nudge, setNudge] = useState(0);
  /** Each word's width (px), measured once the faces are in: the slab's length. */
  const [widths, setWidths] = useState<number[] | null>(null);
  /** The phase and the slow flag as of the last render, for event handlers. */
  const phaseRef = useRef<Phase>("loading");
  const slowRef = useRef(false);
  const shownAt = useRef(0);
  const progressAt = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const words = useRef<(HTMLSpanElement | null)[]>([]);
  /** The load as drawn: it chases the reported one every frame (smoothProgress), so nothing jumps from step to step. */
  const shownP = useRef(0);
  /** What the per-frame drawing needs from the latest render. */
  const frame = useRef({ target: 0, done: false, reduced: false, selected: 0, waiting: false, slabWidth: 0, wordWidth: 0 });
  /** Starts the drawing loop again when it has come to rest (see the drawing loop). */
  const wake = useRef<(() => void) | null>(null);
  /** The first value of --p, written once by React (the server's paint); every frame writes it after. */
  const [initialP] = useState(0);

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

  const loaded = phase !== "loading";
  const slowNow = phase === "loading" && slow;
  // Not once she has entered: a tip timer re-armed behind the hero for the rest of the visit.
  const rotating = order !== null && !slowNow && phase !== "leaving" && phase !== "gone";
  const held = hovered || focused;
  const loading = { loaded, slow };

  // Start at the top of the drive, with the focus on NEW GAME.
  useEffect(() => {
    shownAt.current = performance.now();
    progressAt.current = shownAt.current;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    goTo(0, { focus: null });
    buttons.current[0]?.focus({ preventScroll: true });
    // Back from the other language with the settings open: open them again.
    let reopen = false;
    try {
      reopen = sessionStorage.getItem(REOPEN_KEY) === "1";
      sessionStorage.removeItem(REOPEN_KEY);
    } catch {
      // Blocked storage: the menu, as usual.
    }
    if (reopen && panel.current && !panel.current.open) {
      buttons.current[2]?.focus({ preventScroll: true });
      panel.current.showModal();
      setPanelOpen(true);
    }
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
    slowRef.current = slow;
  }, [phase, slow]);

  // While the screen is up, the page behind is inert and does not scroll.
  // The scroll comes back as soon as she has chosen: input during the fade
  // out already drives the hero, so her first scroll is never swallowed.
  useEffect(() => {
    const html = document.documentElement;
    // The skip link too: an aria-modal dialog keeps Tab and Shift+Tab inside.
    const behind = [
      document.querySelector(".skip-link"),
      document.getElementById("main"),
      document.querySelector("[data-page-controls]"),
    ];
    if (phase === "gone") {
      delete html.dataset.loading;
      behind.forEach((element) => element?.removeAttribute("inert"));
      lenis?.start();
      return;
    }
    html.dataset.loading = "";
    behind.forEach((element) => element?.setAttribute("inert", ""));
    if (phase === "leaving") lenis?.start();
    else lenis?.stop();
  }, [phase, lenis]);

  // Ready once the scene is, but never before one tip could be read.
  useEffect(() => {
    if (!ready || phase !== "loading") return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current));
    const timer = setTimeout(() => {
      setPhase("ready");
      setLive(dict.ready);
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, phase, dict.ready]);

  // A scene that loaded but never says ready still lets her in. A slow one
  // already has, and keeps saying it is slow until it is ready.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (phaseRef.current === "loading" && !slowRef.current) {
        setPhase("ready");
        setLive(dict.ready);
      }
    }, FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [dict.ready]);

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
        setLive(dict.slow);
      }
    }, SLOW_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, slow, dict.slow]);

  // The tip on screen moves on after its reading time, unless hover or
  // focus holds it.
  useEffect(() => {
    if (!rotating || held) return;
    const left = remaining.current?.position === position ? remaining.current.ms : seconds * 1000;
    const started = performance.now();
    const timer = setTimeout(() => setPosition((n) => n + 1), left);
    return () => {
      clearTimeout(timer);
      remaining.current = { position, ms: Math.max(0, left - (performance.now() - started)) };
    };
  }, [rotating, held, position, seconds]);

  // The slab's length: each word as drawn, once the faces are in and whenever the screen changes
  // (while the menu is up: once she has entered nothing reads it).
  const gone = phase === "gone";
  useLayoutEffect(() => {
    if (gone) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const next = words.current.map((word) => word?.offsetWidth ?? 0);
      setWidths((old) => (old && old.length === next.length && old.every((w, i) => w === next[i]) ? old : next));
    };
    // Only once the faces are in: a fallback face's width would be the wrong slab for a frame.
    if (document.fonts) document.fonts.ready.then(measure, measure);
    else measure();
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [lang, gone]);

  const enter = useCallback((music: boolean, via: EnteredVia) => {
    const now = phaseRef.current;
    if (now !== "ready" && !(now === "loading" && slowRef.current)) return;
    phaseRef.current = "leaving";
    // Inside the click or key press: the browser allows audio.play() here.
    requestMusic(music);
    markEntered(via);
    setPhase("leaving");
  }, []);

  const openPanel = useCallback(() => {
    const dialog = panel.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setPanelOpen(true);
  }, []);

  const choose = useCallback(
    (item: MenuItem, via: EnteredVia) => {
      if (item === "settings") {
        openPanel();
        return;
      }
      if (!canChoose(item, { loaded: phaseRef.current !== "loading", slow: slowRef.current })) {
        // Not yet: the slab shakes and the live region says why (a new string each time, so it is said again).
        setNudge((n) => n + 1);
        setLive((old) => (old === dict.notYet ? `${dict.notYet} ` : dict.notYet));
        return;
      }
      enter(item === "newGame", via);
    },
    [dict.notYet, enter, openPanel],
  );

  // The menu's keys: ↑ ↓, W S, Home and End move the focus, and the slab with it.
  useEffect(() => {
    if (phase === "leaving" || phase === "gone" || panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const move = menuMove(event);
      if (move) {
        event.preventDefault();
        const active = buttons.current.findIndex((button) => button === document.activeElement);
        // From outside the menu (the tip card, the languages), an arrow comes back to the selected item.
        const to = active >= 0 || move === "first" || move === "last" ? moveSelection(active >= 0 ? active : selected, move) : selected;
        buttons.current[to]?.focus({ preventScroll: true });
        setSelected(to);
        return;
      }
      // Enter or Space with nothing focused (the screen itself): the item the slab is on.
      if ((event.key === "Enter" || event.key === " ") && event.target === root.current && !event.repeat) {
        event.preventDefault();
        choose(MENU_ITEMS[selected], "key");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, panelOpen, selected, choose]);

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

  // What each frame draws from: kept in a ref, so the drawing loop reads the latest render.
  useEffect(() => {
    const wordWidth = widths?.[selected] ?? 0;
    frame.current = {
      target: (loaded ? 100 : progress) / 100,
      done: loaded || progress >= 100,
      reduced: reducedMotion,
      selected,
      waiting: itemState(MENU_ITEMS[selected], loading) === "wait",
      slabWidth: widths ? wordWidth + SLAB_BEFORE + SLAB_AFTER : 0,
      wordWidth,
    };
    // The drawing loop rests once the load as drawn has caught up; anything new wakes it.
    wake.current?.();
  });

  // Draw the load every frame from the smoothed value: the progress line, the percentage, the
  // horizon (--p on the screen) and, while the selected item waits, the slab and its letters'
  // fill (--fill on the word). Writes only custom properties: no layout, no shift.
  // Writes a value only when it changed, and stops once the load as drawn has reached its target
  // (the menu ready, nothing left to ease): a loop writing the same values every frame kept the
  // phone busy for as long as she read the tips. A render with new inputs wakes it.
  useEffect(() => {
    if (phase === "gone") return;
    let raf = 0;
    let last = performance.now();
    let writtenP = "";
    const writtenFill: string[] = [];
    const tick = (now: number) => {
      raf = 0;
      const f = frame.current;
      const dt = (now - last) / 1000;
      last = now;
      shownP.current = smoothProgress(shownP.current, f.target, dt, { done: f.done, reduced: f.reduced });
      const shown = shownP.current;
      const p = String(shown);
      if (p !== writtenP) {
        writtenP = p;
        root.current?.style.setProperty("--p", p);
      }
      words.current.forEach((word, i) => {
        if (!word) return;
        const fill = i === f.selected && f.waiting ? Math.max(0, Math.min(f.wordWidth, shown * f.slabWidth - SLAB_BEFORE)) : 0;
        const value = `${fill}px`;
        if (writtenFill[i] === value) return;
        writtenFill[i] = value;
        word.style.setProperty("--fill", value);
      });
      if (shown < Math.min(1, Math.max(0, f.target)) || phaseRef.current === "loading") raf = requestAnimationFrame(tick);
    };
    wake.current = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      wake.current = null;
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  if (phase === "gone") return null;

  const shownProgress = loaded ? 100 : progress;
  const station = findStation(choice.station) ?? STATIONS[0];
  const stationLabel = `${station.name} ${formatFrequency(station.frequency)}`;
  const nextTip = (event: MouseEvent<HTMLButtonElement>) => {
    setPosition((n) => n + 1);
    // Safari does not focus a tapped button; focus holds the new tip until she moves on.
    event.currentTarget.focus();
  };

  // The slab: on the selected item, as long as its word plus its margins; filled by the load while that item waits.
  const selectedItem = MENU_ITEMS[selected];
  const slabWidth = widths ? widths[selected] + SLAB_BEFORE + SLAB_AFTER : 0;
  const waitingHere = itemState(selectedItem, loading) === "wait";

  const describe = (item: MenuItem): string => {
    const state = itemState(item, loading);
    const tail = state === "wait" ? dict.menu.waiting : state === "early" ? dict.menu.early : "";
    const head =
      item === "newGame"
        ? choice.on
          ? `${dict.menu.withMusic}: ${stationLabel}`
          : dict.menu.radioOff
        : item === "continue"
          ? dict.menu.noMusic
          : dict.menu.settingsSub;
    return tail ? `${head}, ${tail}.` : `${head}.`;
  };

  return (
    <div
      ref={root}
      className={styles.loader}
      data-loader
      data-phase={phase}
      data-slow={slowNow ? "" : undefined}
      data-ready={loaded ? "" : undefined}
      data-measured={widths ? "" : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="loader-title"
      aria-describedby="loader-state"
      tabIndex={-1}
      style={{ "--p": initialP, "--longest": longestEm(MENU_ITEMS.map((item) => dict.menu[item])) } as CSSProperties}
    >
      <div className={styles.art} aria-hidden="true">
        {art}
        <div className={styles.vignette} />
        <div className={styles.grain} />
      </div>
      <div className={styles.scrim} aria-hidden="true" />

      <nav className={styles.langs} data-box="langs" aria-label={dict.language}>
        {locales.map((locale) =>
          locale === lang ? (
            <span key={locale} className={styles.lang} aria-current="true" lang={locale}>
              <span aria-hidden="true">{locale.toUpperCase()}</span>
              <span className="sr-only">{localeNames[locale]}</span>
            </span>
          ) : (
            <a key={locale} className={styles.lang} href={`/${locale}`} hrefLang={locale} lang={locale}>
              <span aria-hidden="true">{locale.toUpperCase()}</span>
              <span className="sr-only">{localeNames[locale]}</span>
            </a>
          ),
        )}
      </nav>

      <div className={styles.menu} data-box="menu">
        <h2 id="loader-title" className={styles.kicker}>
          {dict.title}
        </h2>
        <div className={styles.items}>
          <div
            key={nudge}
            className={styles.slab}
            aria-hidden="true"
            data-wait={waitingHere ? "" : undefined}
            data-nudge={nudge > 0 ? "" : undefined}
            style={{ "--sel": selected, "--slab-w": `${slabWidth}px` } as CSSProperties}
          >
            <i className={styles.slabBar}>
              <b className={styles.slabFill} />
            </i>
          </div>
          <ul className={styles.list}>
            {MENU_ITEMS.map((item, i) => {
              const state = itemState(item, loading);
              return (
                <li key={item} className={styles.row}>
                  <button
                    ref={(button) => {
                      buttons.current[i] = button;
                    }}
                    type="button"
                    className={styles.item}
                    data-item={item}
                    data-enter={item === "newGame" ? "music" : item === "continue" ? "silent" : "settings"}
                    data-state={state}
                    data-selected={selected === i ? "" : undefined}
                    aria-disabled={state === "wait" ? "true" : undefined}
                    aria-describedby={`loader-line-${item}`}
                    onFocus={() => setSelected(i)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") event.currentTarget.focus({ preventScroll: true });
                    }}
                    onClick={(event) => choose(item, event.detail > 0 ? "pointer" : "key")}
                  >
                    <span className={styles.index} aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                    <span
                      ref={(word) => {
                        words.current[i] = word;
                      }}
                      className={styles.word}
                    >
                      {dict.menu[item]}
                    </span>
                    <span className={styles.line} aria-hidden="true">
                      {item === "newGame" ? (
                        <span
                          className={styles.station}
                          data-off={choice.on ? undefined : ""}
                          data-pending={hydrated ? undefined : ""}
                          style={{ "--accent": `var(--va-radio-${choice.on ? station.accent : "off"})` } as CSSProperties}
                        >
                          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                            <path d={choice.on ? "M2 10v4M6 6v8M10 3v11M14 8v6" : "M2 8h12"} />
                          </svg>
                          {choice.on ? stationLabel : dict.menu.radioOff}
                        </span>
                      ) : (
                        <span className={styles.lead}>{item === "continue" ? dict.menu.noMusic : dict.menu.settingsSub}</span>
                      )}
                      {item === "settings" ? null : (
                        <span className={styles.states}>
                          <span data-when="wait">
                            {dict.menu.waiting}
                            <span className={styles.dots}>
                              <i />
                              <i />
                              <i />
                            </span>
                          </span>
                          <span data-when="early">{dict.menu.early}</span>
                          <span data-when="ready">{item === "newGame" && choice.on ? dict.menu.withMusic : ""}</span>
                        </span>
                      )}
                    </span>
                  </button>
                  <span id={`loader-line-${item}`} className="sr-only">
                    {describe(item)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p id="loader-hint" className={styles.legend} aria-hidden="true">
          <span className={styles.legendPart}>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {dict.keys.move}
          </span>
          <span className={styles.legendPart}>
            <kbd>{dict.keys.enter}</kbd>
            {dict.keys.choose}
          </span>
        </p>
      </div>

      <div
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
              <path d="M3 8h9M8.5 4 12 8l-3.5 4" />
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

      <div className={styles.status} data-box="status" aria-hidden="true">
        <span data-when="loading">{dict.loading}</span>
        <span data-when="ready">{dict.readyShort}</span>
        <span data-when="slow">{dict.slowLabel}</span>
      </div>
      <div className={styles.percent} aria-hidden="true">
        {percentLabel(shownProgress)}
      </div>
      <div
        className={styles.progress}
        data-box="line"
        role="progressbar"
        aria-label={dict.loading}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shownProgress)}
      >
        <div className={styles.fill} />
      </div>

      <p id="loader-state" className="sr-only">
        {loaded ? dict.ready : dict.loading}
      </p>
      <p className="sr-only" role="status">
        {live}
      </p>

      {/* Lenis is stopped while the menu is up, and a stopped Lenis cancels every
          wheel and touchmove it sees: `data-lenis-prevent` leaves the panel's own
          scrolling to the browser (on a phone it runs well below the screen). */}
      <dialog
        ref={panel}
        className={styles.panel}
        aria-labelledby="start-settings-title"
        data-settings
        data-lenis-prevent
        onClose={() => {
          setPanelOpen(false);
          setSelected(2);
          buttons.current[2]?.focus({ preventScroll: true });
        }}
      >
        <div className={styles.panelInner}>
          <div className={styles.panelTop}>
            <p className={styles.crumb}>
              <span className={styles.mark} aria-hidden="true" />
              {dict.title}
            </p>
            <button type="button" className={styles.back} data-back onClick={() => panel.current?.close()}>
              <kbd className={styles.escKey} aria-hidden="true">
                Esc
              </kbd>
              {dict.panel.back}
            </button>
          </div>
          <div className={styles.panelTitle}>
            <h2 id="start-settings-title">{dict.menu.settings}</h2>
            <p>{dict.panel.lead}</p>
          </div>
          <Settings
            dict={settings}
            lang={lang}
            where="start"
            onLanguage={() => {
              try {
                sessionStorage.setItem(REOPEN_KEY, "1");
              } catch {
                // Blocked storage: the new page opens on the menu.
              }
            }}
          />
          <p className={styles.panelFoot}>
            {dict.panel.saved}
            <span className={styles.escape}> · {dict.panel.escape}</span>
          </p>
        </div>
      </dialog>
    </div>
  );
}
