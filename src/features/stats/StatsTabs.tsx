"use client";

import {
  createContext,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { getRadio, setPauseMenu } from "@/features/music/radio";
import { idFromHash } from "@/lib/hash";
import { focusInPlace, goTo } from "@/lib/navigate";
import { REVEAL_EVENT, type RevealDetail } from "@/lib/reveal";
import styles from "./Stats.module.css";
import {
  PANEL_ALIASES,
  PANEL_IDS,
  STATS_ID,
  STATS_TABS,
  TAB_IDS,
  hashForTab,
  ownsShoulderKeys,
  shoulderStep,
  stepTab,
  tabForId,
  tabListKey,
  type StatsTab,
} from "./statsTabs";

/**
 * STATS's tabs and its pause, the pause menu's client code beside the
 * settings (StatsSettings.tsx): the server component (Stats.tsx) renders
 * every panel's words, these switch them in place. The server HTML is
 * plain: four links over the four panels, so without JS the panels stay on
 * the page, one under the other (the stacking in Stats.module.css only
 * applies under `scripting: enabled`). Once hydrated the links become
 * WAI-ARIA tabs.
 *
 * - The tab bar: click, the arrows, Home and End; the selection follows
 *   the focus (roving tabindex), and the open panel takes the focus next.
 * - [ and ] step through the tabs like a pad's shoulder buttons while
 *   STATS is the section on screen (Q is the radio's).
 * - #stats opens STATS, and #stats-map, #stats-achievements and
 *   #stats-settings their tabs (PageEntry asks through lib/reveal.ts
 *   before it lands; the old #stats-favorites opens ACHIEVEMENTS, whose
 *   place it was); a switch writes the tab's fragment with replaceState,
 *   so the page does not move.
 * - The game pauses as the menu arrives, like pressing pause in a game:
 *   while STATS crosses the middle of the screen (an IntersectionObserver
 *   on that line, never a scroll read per frame) a big pause sign punches
 *   in over the screen and gets out of the way (when the menu came up from
 *   below), the world behind the menu dims, the menu settles into place,
 *   its pause glyph pulses once and its clock stops ticking; leaving
 *   undoes it, quickly. All of it is CSS on data-paused (Stats.module.css):
 *   transitions and one-shot animations of opacity and transforms,
 *   nothing per frame once it has settled, no layout shift. Under reduced
 *   motion the paused state simply holds, dimmed and still. With the radio
 *   on, the music goes behind the menu, muffled and ducked, with a blip
 *   each way (radio.ts setPauseMenu), except on SETTINGS.
 * - The STATS portrait loads when the section comes near.
 */

type Motion = -1 | 0 | 1;
type TabsState = {
  tab: StatsTab;
  /** The way the last switch went (1: to the right), for the panel's entrance; 0: no entrance (load, deep link). */
  motion: Motion;
  /** The section is within a screen of the viewport. */
  near: boolean;
  /** STATS crosses the middle of the screen: the game is paused. */
  paused: boolean;
  /** Arrivals so far: each one replays the glyph's pulse (its parity picks the animation). */
  pauses: number;
  /** This pause came as the menu rose from below (scrolling down, a deep link): the pause sign punches in. */
  fromBelow: boolean;
  /** The pause is watched (hydrated, with an IntersectionObserver): until then the menu shows as it is, never half-settled. */
  live: boolean;
};

/** Where focus goes after a switch: the new tab (the keyboard was in the menu), or nowhere. */
type FocusAfter = "tab" | null;

type TabsContext = {
  tab: StatsTab;
  near: boolean;
  /** Hydrated: the links are tabs and switch in place. */
  enhanced: boolean;
  choose: (tab: StatsTab, focus: FocusAfter) => void;
};

const SERVER_STATE: TabsState = { tab: STATS_TABS[0], motion: 0, near: false, paused: false, pauses: 0, fromBelow: false, live: false };

const Context = createContext<TabsContext>({ tab: STATS_TABS[0], near: false, enhanced: false, choose: () => {} });

function createTabsStore() {
  let state: TabsState | null = null;
  const listeners = new Set<() => void>();
  // The first read in the browser opens the tab the address names.
  const get = (): TabsState => (state ??= { ...SERVER_STATE, tab: tabForId(idFromHash(window.location.hash)) ?? STATS_TABS[0] });
  const set = (next: Partial<TabsState>) => {
    state = { ...get(), ...next };
    listeners.forEach((listener) => listener());
  };
  return {
    get,
    getServer: () => SERVER_STATE,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(tab: StatsTab, animate: boolean): boolean {
      const from = get().tab;
      if (tab === from) return false;
      set({ tab, motion: animate ? (STATS_TABS.indexOf(tab) > STATS_TABS.indexOf(from) ? 1 : -1) : 0 });
      return true;
    },
    approach() {
      if (!get().near) set({ near: true });
    },
    watch(live: boolean) {
      if (get().live !== live) set({ live });
    },
    /** STATS arrives at the middle of the screen (true) or leaves it; `fromBelow`: its top came up to that line. */
    pause(on: boolean, fromBelow = false) {
      const { paused, pauses } = get();
      if (paused === on) return;
      set(on ? { paused: true, pauses: pauses + 1, fromBelow } : { paused: false });
    },
  };
}

const subscribeNothing = () => () => {};

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select") !== null);
}

/** A click the browser should keep: a new tab or window, a download, another button. */
function isModifiedClick(event: ReactMouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** The section (#stats) and the tabs' state, for the menu, the panels and the portrait inside it. */
export function StatsSection({
  className,
  labelledBy,
  style,
  children,
}: {
  className: string;
  labelledBy: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [store] = useState(createTabsStore);
  const state = useSyncExternalStore(store.subscribe, store.get, store.getServer);
  const enhanced = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const ref = useRef<HTMLElement>(null);

  const choose = useCallback(
    (tab: StatsTab, focus: FocusAfter) => {
      // Synchronous, so the new panel is on the page for the scroll and the focus below.
      const changed = flushSync(() => store.select(tab, true));
      // The address shares the open tab; replaceState fires no hashchange and moves nothing.
      if (changed) window.history.replaceState(window.history.state, "", hashForTab(tab));
      const section = ref.current;
      if (!section) return;
      // Switched with the tab bar out of view (from the foot of a long
      // panel, with a shoulder button): back to the section's top, so the
      // new tab starts there, under its name. Lenis goes with the page
      // (lib/navigate.ts): a native jump it missed would send her next
      // notch from where she was.
      const bar = section.querySelector("[role=tablist]")?.getBoundingClientRect();
      if (bar && (bar.top < 0 || bar.bottom > window.innerHeight)) goTo(section, { focus: null });
      const nextElement = focus === "tab" ? document.getElementById(TAB_IDS[tab]) : null;
      if (nextElement) focusInPlace(nextElement);
    },
    [store],
  );

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    /*
     * How far the open panel stands under the section's top as drawn now
     * (the menu's settle transform counts: the browser's own scroll to a
     * fragment, in the next frame, goes by the box it sees), so its
     * fragment lands the section's top (Stats.module.css .tabPanel).
     */
    const measureRise = () => {
      const panel = document.getElementById(PANEL_IDS[store.get().tab]);
      if (!panel) return;
      const rise = panel.getBoundingClientRect().top - section.getBoundingClientRect().top;
      section.style.setProperty("--panel-rise", `${Math.round(rise)}px`);
    };
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureRise);
    resized?.observe(section);

    // A link to a tab's fragment opens its tab, laid out at once for the browser's own scroll to it; PageEntry does the landing.
    const onHashChange = () => {
      const tab = tabForId(idFromHash(window.location.hash));
      if (!tab) return;
      flushSync(() => {
        store.select(tab, false);
      });
      measureRise();
    };

    // PageEntry is about to land on a target in here: open its tab now, and
    // land a tab panel from the section's top, with the tab bar in view.
    const onReveal = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const panel = target.closest<HTMLElement>("[data-tab-panel]");
      const tab = tabForId(target.id) ?? (panel ? tabForId(panel.id) : null);
      if (!tab) return;
      flushSync(() => {
        store.select(tab, false);
      });
      measureRise();
      const detail = (event as CustomEvent<RevealDetail>).detail;
      if (target === section || target === panel) detail.view = section;
      // An old fragment (#stats-favorites) lands like its panel, which takes the focus; the address names the tab as it is now.
      if (Object.hasOwn(PANEL_ALIASES, target.id) && panel) {
        detail.view = section;
        detail.focus = panel;
        window.history.replaceState(window.history.state, "", hashForTab(tab));
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const step = shoulderStep(event);
      if (!step || event.defaultPrevented || isTyping(event.target)) return;
      if (document.documentElement.hasAttribute("data-loading") || getRadio().wheel) return;
      const focusInside = section.contains(document.activeElement);
      if (!ownsShoulderKeys(section.getBoundingClientRect(), window.innerHeight, focusInside)) return;
      event.preventDefault();
      // Focus never stays in the panel that closes: it goes to the new tab.
      choose(stepTab(store.get().tab, step), focusInside ? "tab" : null);
    };

    /*
     * The page controls' language switch keeps her place in the menu, as
     * SETTINGS' own LANGUAGE links do: while the game is paused, a link to
     * the other language that names no place gets the open tab's fragment
     * for this one navigation (put back right after, for a click that
     * opened nothing here: a new tab, a cancelled one).
     */
    const onLanguage = (event: MouseEvent) => {
      const { paused, tab } = store.get();
      if (!paused || event.defaultPrevented) return;
      const link = event.target instanceof Element ? event.target.closest("a[hreflang]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.hash || link.origin !== window.location.origin) return;
      const href = link.getAttribute("href");
      if (href === null) return;
      link.hash = hashForTab(tab);
      window.setTimeout(() => link.setAttribute("href", href), 0);
    };

    let observer: IntersectionObserver | null = null;
    let middle: IntersectionObserver | null = null;
    let entry: MutationObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          store.approach();
          observer?.disconnect();
        },
        { rootMargin: "100% 0px" },
      );
      observer.observe(section);
      const waitForEntry = () => {
        if (entry) return;
        entry = new MutationObserver(() => {
          if (document.documentElement.hasAttribute("data-loading")) return;
          entry?.disconnect();
          entry = null;
          middle?.unobserve(section);
          middle?.observe(section);
        });
        entry.observe(document.documentElement, { attributes: true, attributeFilter: ["data-loading"] });
      };
      // The pause: STATS on the line across the middle of the screen (the section she is looking at).
      middle = new IntersectionObserver(
        (entries) => {
          const last = entries[entries.length - 1];
          const on = last.isIntersecting;
          // Under the loading screen nothing is paused yet: ask again once it has gone (a deep link to #stats).
          if (on && document.documentElement.hasAttribute("data-loading")) {
            waitForEntry();
            return;
          }
          // Its top on screen: the menu came up from below (not back up from the cinema, whose top would cut the sign).
          store.pause(on, last.boundingClientRect.top > 0);
        },
        { rootMargin: "-50% 0px -50% 0px" },
      );
      middle.observe(section);
      store.watch(true);
    }

    window.addEventListener("hashchange", onHashChange);
    section.addEventListener(REVEAL_EVENT, onReveal);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onLanguage, true);
    window.addEventListener("auxclick", onLanguage, true);
    return () => {
      observer?.disconnect();
      resized?.disconnect();
      middle?.disconnect();
      entry?.disconnect();
      store.pause(false);
      store.watch(false);
      setPauseMenu(false, { quiet: true });
      window.removeEventListener("hashchange", onHashChange);
      section.removeEventListener(REVEAL_EVENT, onReveal);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onLanguage, true);
      window.removeEventListener("auxclick", onLanguage, true);
    };
  }, [store, choose]);

  /*
   * The radio goes behind the menu while the game is paused, except on
   * SETTINGS: there she picks a station and sets her volume by ear, so she
   * hears exactly what she will get once she leaves. Arriving and leaving
   * blip; switching tabs inside the paused menu lets the music in or out
   * quietly.
   */
  const ducked = state.paused && state.tab !== "settings";
  const held = useRef(false);
  useEffect(() => {
    const arrival = held.current !== state.paused;
    held.current = state.paused;
    setPauseMenu(ducked, { quiet: !arrival });
  }, [ducked, state.paused]);

  const context = useMemo<TabsContext>(
    () => ({ tab: state.tab, near: state.near, enhanced, choose }),
    [state.tab, state.near, enhanced, choose],
  );
  const motion = state.motion > 0 ? "next" : state.motion < 0 ? "prev" : undefined;
  // Two names for the same pause, so each arrival pulses the glyph again.
  const pause = state.paused ? (state.pauses % 2 ? "a" : "b") : undefined;

  return (
    <Context value={context}>
      <section
        ref={ref}
        id={STATS_ID}
        className={className}
        style={style}
        aria-labelledby={labelledBy}
        data-loops
        data-motion={motion}
        data-paused={pause}
        data-pause-from-below={(state.paused && state.fromBelow) || undefined}
        data-pause-live={state.live || undefined}
      >
        {/*
         * The world behind the menu, dimmed while the game is paused: from a
         * screen above STATS down to its foot, fading out before the cinema.
         * Under everything in STATS (z-index -1), over everything before it.
         */}
        <div className={styles.freeze} data-paused={pause} aria-hidden="true" />
        {/* The pause sign that punches in as the menu arrives, once per arrival, then gets out of the way. */}
        <div className={styles.stinger} aria-hidden="true">
          <i />
          <i />
        </div>
        {children}
      </section>
    </Context>
  );
}

/**
 * The tab bar. Before hydration (and without JS) four links that jump to
 * the panels; then a tablist. The key caps either side are the shoulder
 * buttons, shown where there is a keyboard and a mouse.
 */
export function StatsTabList({ label, names }: { label: string; names: readonly string[] }) {
  const { tab, enhanced, choose } = use(Context);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = tabListKey(event.key, tab);
    if (!next) return;
    event.preventDefault();
    choose(next, "tab");
  };

  return (
    <div className={styles.tabs}>
      <kbd className={styles.keycap} aria-hidden="true">
        [
      </kbd>
      <nav className={styles.tabList} aria-label={label} role={enhanced ? "tablist" : undefined} onKeyDown={enhanced ? onKeyDown : undefined}>
        {STATS_TABS.map((id, i) => {
          const on = id === tab;
          return (
            <a
              key={id}
              id={TAB_IDS[id]}
              className={on ? `${styles.tab} ${styles.tabOn}` : styles.tab}
              href={hashForTab(id)}
              role={enhanced ? "tab" : undefined}
              aria-selected={enhanced ? on : undefined}
              aria-controls={enhanced ? PANEL_IDS[id] : undefined}
              tabIndex={enhanced && !on ? -1 : undefined}
              onClick={
                enhanced
                  ? (event) => {
                      if (isModifiedClick(event)) return;
                      event.preventDefault();
                      choose(id, null);
                    }
                  : undefined
              }
            >
              {names[i]}
            </a>
          );
        })}
      </nav>
      <kbd className={styles.keycap} aria-hidden="true">
        ]
      </kbd>
    </div>
  );
}

/** One tab's panel; without JS, simply the next block on the page. */
export function StatsPanel({ tab: id, children }: { tab: StatsTab; children: ReactNode }) {
  const { tab, enhanced } = use(Context);
  return (
    <div
      id={PANEL_IDS[id]}
      className={styles.tabPanel}
      data-tab-panel
      data-active={id === tab}
      role={enhanced ? "tabpanel" : undefined}
      aria-labelledby={enhanced ? TAB_IDS[id] : undefined}
      tabIndex={enhanced ? 0 : undefined}
    >
      {children}
    </div>
  );
}

/** The STATS portrait: lazy, but fetched once the section is near, so it never shows up empty. */
export function StatsPortrait({ className, src, avif, alt, width, height }: { className: string; src: string; avif: string; alt: string; width: number; height: number }) {
  const { near } = use(Context);
  return (
    <picture>
      <source srcSet={avif} type="image/avif" />
      <img
        className={className}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={near ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}
