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
import { getRadio } from "@/features/music/radio";
import { idFromHash } from "@/lib/hash";
import { focusInPlace, goTo } from "@/lib/navigate";
import { REVEAL_EVENT, type RevealDetail } from "@/lib/reveal";
import styles from "./Stats.module.css";
import {
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
 * STATS's tabs, the only client code in the pause menu: the server
 * component (Stats.tsx) renders both panels' words, these switch them in
 * place. The server HTML is plain: two links over the two panels, so
 * without JS both panels stay on the page, one under the other (the
 * stacking in Stats.module.css only applies under `scripting: enabled`).
 * Once hydrated the links become WAI-ARIA tabs.
 *
 * - The tab bar: click, the arrows, Home and End; the selection follows
 *   the focus (roving tabindex), and the open panel takes the focus next.
 * - [ and ] step through the tabs like a pad's shoulder buttons while
 *   STATS is the section on screen (Q is the radio's).
 * - #stats opens MAP and #stats-sheet opens STATS (PageEntry asks through
 *   lib/reveal.ts before it lands); a switch writes the tab's fragment
 *   with replaceState, so the page does not move.
 * - The STATS portrait loads when the section comes near or its tab opens.
 */

type Motion = -1 | 0 | 1;
type TabsState = {
  tab: StatsTab;
  /** The way the last switch went (1: to the right), for the panel's entrance; 0: no entrance (load, deep link). */
  motion: Motion;
  /** The section is within a screen of the viewport. */
  near: boolean;
};

/** Where focus goes after a switch: the new tab (the keyboard was in the menu), the new panel, or nowhere. */
type FocusAfter = "tab" | "panel" | null;

type TabsContext = {
  tab: StatsTab;
  near: boolean;
  /** Hydrated: the links are tabs and switch in place. */
  enhanced: boolean;
  choose: (tab: StatsTab, focus: FocusAfter) => void;
};

const SERVER_STATE: TabsState = { tab: STATS_TABS[0], motion: 0, near: false };

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
      const next = focus === "tab" ? TAB_IDS[tab] : focus === "panel" ? PANEL_IDS[tab] : null;
      const nextElement = next ? document.getElementById(next) : null;
      if (nextElement) focusInPlace(nextElement);
    },
    [store],
  );

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    // A link to #stats or #stats-sheet opens its tab; PageEntry does the landing.
    const onHashChange = () => {
      const tab = tabForId(idFromHash(window.location.hash));
      if (tab) store.select(tab, false);
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
      if (target === section || target === panel) (event as CustomEvent<RevealDetail>).detail.view = section;
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

    let observer: IntersectionObserver | null = null;
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
    }

    window.addEventListener("hashchange", onHashChange);
    section.addEventListener(REVEAL_EVENT, onReveal);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      observer?.disconnect();
      window.removeEventListener("hashchange", onHashChange);
      section.removeEventListener(REVEAL_EVENT, onReveal);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [store, choose]);

  const context = useMemo<TabsContext>(
    () => ({ tab: state.tab, near: state.near, enhanced, choose }),
    [state.tab, state.near, enhanced, choose],
  );
  const motion = state.motion > 0 ? "next" : state.motion < 0 ? "prev" : undefined;

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
      >
        {children}
      </section>
    </Context>
  );
}

/**
 * The tab bar. Before hydration (and without JS) two links that jump to
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

/**
 * At the foot of the menu, the way to the other tab, like a pad's button
 * prompt: on a phone the map runs for screens, and the tab bar is far
 * above by its end. It opens that tab from its top. Only once hydrated.
 */
export function StatsOtherTab({ names }: { names: readonly string[] }) {
  const { tab, enhanced, choose } = use(Context);
  if (!enhanced) return null;
  const other = stepTab(tab, 1);
  const toRight = STATS_TABS.indexOf(other) > STATS_TABS.indexOf(tab);
  return (
    <a
      className={styles.otherTab}
      href={hashForTab(other)}
      onClick={(event) => {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        choose(other, "panel");
      }}
    >
      {toRight ? null : <span aria-hidden="true">◀ </span>}
      {names[STATS_TABS.indexOf(other)]}
      {toRight ? <span aria-hidden="true"> ▶</span> : null}
    </a>
  );
}

/** The STATS portrait: lazy, but fetched once the section is near or its tab opens, so it never shows up empty. */
export function StatsPortrait({ className, src, avif, alt, width, height }: { className: string; src: string; avif: string; alt: string; width: number; height: number }) {
  const { tab, near } = use(Context);
  return (
    <picture>
      <source srcSet={avif} type="image/avif" />
      <img
        className={className}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={near || tab === "sheet" ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}
