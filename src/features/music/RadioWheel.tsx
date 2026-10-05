"use client";

import { useLenis } from "lenis/react";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getSceneLoading, subscribeSceneLoading } from "@/features/hero/sceneLoading";
import { scrollInput } from "@/features/hero/scroll/heroProgress";
import { SLOW_MOTION, timeScale } from "@/features/hero/scene/timeScale";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  closeWheel,
  getRadio,
  getServerRadio,
  openWheel,
  type WheelState,
  selectStation,
  setWheelMode,
  subscribeRadio,
  takeOpener,
  tune,
} from "./radio";
import styles from "./RadioWheel.module.css";
import { StationLogo } from "./StationLogo";
import {
  aimedSector,
  angleOf,
  type Credit,
  formatFrequency,
  isStation,
  joinSentences,
  nextIndex,
  previousIndex,
  sectorCentre,
  trailOrigin,
  WHEEL,
  WHEEL_START,
  type WheelEntry,
} from "./stations";
import { holdArmed, holdCancelled, holdMayStart, TOUCH_HOLD } from "./touchHold";
import { ringSectorPath, sectorArcPath, unwrapAngle, WHEEL_LAYOUT } from "./wheelGeometry";

type Props = { dict: Dictionary["radio"] };

const COUNT = WHEEL.length;
/** Pixels the pointer travels before it aims at a station. */
const DEAD_ZONE = 26;
/** The virtual stick's reach: past it, the aim origin trails the pointer. */
const REACH = 90;
/** Taps this soon after a long-press opened the wheel are the same finger lifting. */
const TOUCH_GRACE_MS = 350;
/**
 * Windows shows the context menu on the right button's release, after the
 * wheel has closed and whatever lies under the pointer gets the event:
 * the menu that follows an aim is swallowed for this long.
 */
const AIM_MENU_GRACE_MS = 400;
/** Mouse-wheel travel (px) per station. */
const WHEEL_STEP = 60;
/** Elements a right-click or a long-press must leave alone. */
const INTERACTIVE = "a, button, input, textarea, select, label, summary, [contenteditable], [role='button']";
/** Ring wedges, in the SVG's units (the wheel is 200 across). */
const RING = { inner: WHEEL_LAYOUT.inner * 200, outer: WHEEL_LAYOUT.outer * 200 } as const;
const WEDGES = WHEEL.map((_, i) => ringSectorPath(i, COUNT, RING.inner, RING.outer, WHEEL_LAYOUT.gap, WHEEL_START));
/** The lit rim of the station on air, just inside each wedge's outer edge. */
const RIMS = WHEEL.map((_, i) => sectorArcPath(i, COUNT, RING.outer - 1.6, WHEEL_LAYOUT.gap + 1.2, WHEEL_START));
/** Where the selected wedge's glow starts: dark at the centre disc, lit at the rim. */
const GLOW_FROM = RING.inner / RING.outer;
/** The badges' size and orbit, as fractions of the wheel (RadioWheel.module.css). */
const LAYOUT_STYLE = { "--badge-k": WHEEL_LAYOUT.badge, "--orbit-k": WHEEL_LAYOUT.orbit } as CSSProperties;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(target.type);
}

/** True when (x, y) lies on the visitor's text selection. */
function onSelection(x: number, y: number): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    for (const rect of selection.getRangeAt(i).getClientRects()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
    }
  }
  return false;
}

/** The hero scene, and nothing interactive or selected on top of it. */
function onRadioSurface(event: MouseEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!target.closest("[data-radio-surface]") || target.closest(INTERACTIVE)) return false;
  return !onSelection(event.clientX, event.clientY);
}

function isLoading(): boolean {
  return document.documentElement.hasAttribute("data-loading");
}

/** What a screen reader hears for an entry; `playing` is the track on air if it is the current station. */
function stationLabel(entry: WheelEntry, dict: Props["dict"], playing: Credit | null): string {
  if (!isStation(entry)) return dict.off;
  return joinSentences([
    `${entry.name} ${formatFrequency(entry.frequency)}`,
    dict.taglines[entry.id],
    playing ? `${dict.nowPlaying}: ${playing.title}, ${playing.artist}` : "",
  ]);
}

/**
 * The radio wheel, GTA style: a ring of station badges around a centre that
 * shows the station under the pointer. Opens by holding the right mouse
 * button over the hero scene (aim, let go to tune; a quick click leaves it
 * open), by holding or pressing Q, by a long-press on the scene (held still,
 * opened on release, see touchHold.ts: it never steals a swipe), or from the
 * music button. While it is open the scene behind dims, the drive goes
 * into slow motion (not under reduced motion) and the wheel keeps every
 * scroll and swipe to itself.
 *
 * Accessibility: a modal dialog with a radio group (the current station is
 * checked); focus moves in and returns to the opener; arrows browse, Enter
 * or Space tunes, Esc closes; the page behind is inert.
 */
export function RadioWheel({ dict }: Props) {
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  const entered = useSyncExternalStore(
    subscribeSceneLoading,
    () => getSceneLoading().entered,
    () => false,
  );
  const reducedMotion = usePrefersReducedMotion();
  const coarse = useMediaQuery("(pointer: coarse)");
  const lenis = useLenis();
  const open = radio.wheel !== null;
  // While it fades out, the wheel keeps showing what it showed last.
  const [last, setLast] = useState<WheelState | null>(null);
  if (radio.wheel && radio.wheel !== last) setLast(radio.wheel);
  const wheel = radio.wheel ?? last;

  const overlay = useRef<HTMLDivElement>(null);
  const dial = useRef<HTMLDivElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  /** The needle's angle, unwrapped so it always turns the short way. */
  const needle = useRef(0);
  /** The visitor aimed (or browsed) while holding: letting go tunes. */
  const aimed = useRef(false);
  /**
   * Hover selects only after the mouse has really moved since the wheel opened:
   * the wheel appearing under a resting cursor fires pointerenter too, and that
   * must not move the selection off the station on air (often onto Radio off).
   */
  const hoverArmed = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const touchOpenedAt = useRef(-Infinity);
  const scroll = useRef(0);
  /** The page's Lenis, for the long-press: a press on a page still in motion is stopping a scroll. */
  const lenisRef = useRef(lenis);
  /** A finger down on the empty backdrop: a tap closes the wheel, a swipe does not. */
  const backdropTouch = useRef<{ id: number; x: number; y: number } | null>(null);
  /** Where a held finger has armed the long-press: a ring says "lift to open the radio". */
  const [armedAt, setArmedAt] = useState<{ x: number; y: number } | null>(null);
  /** Mounted once the visitor is in (the logos' fonts load then), or on first use. */
  const mounted = entered || open;

  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  // The open/close side effects: inert page, no scroll, slow motion, focus.
  useEffect(() => {
    if (!open) return;
    const layer = overlay.current;
    const behind = [
      document.querySelector(".skip-link"),
      document.getElementById("main"),
      document.querySelector("[data-page-controls]"),
    ];
    const start = getRadio().wheel?.selected ?? 0;
    aimed.current = false;
    hoverArmed.current = false;
    scroll.current = 0;
    pointNeedle(sectorCentre(start, COUNT));
    radios.current[start]?.focus({ preventScroll: true });
    behind.forEach((element) => element?.setAttribute("inert", ""));
    lenis?.stop();
    if (!reducedMotion) timeScale.target = SLOW_MOTION;
    return () => {
      behind.forEach((element) => element?.removeAttribute("inert"));
      lenis?.start();
      timeScale.target = 1;
      const back = takeOpener();
      if (back?.isConnected) back.focus({ preventScroll: true });
      else if (layer?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    };
  }, [open, lenis, reducedMotion]);

  // While open, the wheel keeps scrolls and swipes to itself: the mouse
  // wheel browses the stations and nothing reaches the page behind (the
  // hero would take them for driving). React's wheel listener is passive,
  // so this one is native.
  useEffect(() => {
    const layer = overlay.current;
    if (!open || !layer) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.ctrlKey) return;
      scroll.current += event.deltaY;
      if (Math.abs(scroll.current) < WHEEL_STEP) return;
      const step = scroll.current > 0 ? 1 : -1;
      scroll.current = 0;
      aimed.current = true;
      const current = getRadio().wheel?.selected ?? 0;
      select(step > 0 ? nextIndex(current, COUNT) : previousIndex(current, COUNT), { focus: true });
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    };
    layer.addEventListener("wheel", onWheel, { passive: false });
    layer.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      layer.removeEventListener("wheel", onWheel);
      layer.removeEventListener("touchmove", onTouchMove);
    };
    // select only touches refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pointNeedle(angle: number) {
    needle.current = unwrapAngle(needle.current, angle);
    dial.current?.style.setProperty("--needle", `${needle.current.toFixed(2)}deg`);
  }

  function select(index: number, { focus = false } = {}) {
    selectStation(index);
    pointNeedle(sectorCentre(index, COUNT));
    if (focus) radios.current[index]?.focus({ preventScroll: true });
  }

  function choose(index: number) {
    tune(WHEEL[index].id);
    closeWheel();
  }

  /** Let go of the right button or Q: tune to what was aimed at, or stay open. */
  function finishAim() {
    const current = getRadio().wheel;
    if (!current || current.mode !== "aim") return;
    if (aimed.current) choose(current.selected);
    else setWheelMode("browse");
  }

  // Global gestures: right-button hold and long-press over the scene, Q.
  // Handlers read the store directly, so they are installed once.
  useEffect(() => {
    let pointer: { x: number; y: number } | null = null;
    /** A finger held on the scene: it may become the long-press that opens the wheel. */
    let press: { id: number; x: number; y: number; at: number; inputAt: number; moved: number; timer: number } | null =
      null;
    let holdingQ = false;
    /** When the right button last let go of an aim. */
    let aimReleasedAt = -Infinity;

    const cancelPress = () => {
      if (press) window.clearTimeout(press.timer);
      press = null;
      setArmedAt(null);
    };

    /**
     * The held finger's state, for the touchHold rules, as of `at` (an
     * event's own timeStamp, or now). The press is timed by the events'
     * own times, so a slow frame that runs the release handler late never
     * turns a tap into a long-press.
     */
    const holdOf = (current: NonNullable<typeof press>, at = performance.now()) => ({
      heldMs: at - current.at,
      moved: current.moved,
      scrolled: scrollInput.at > current.inputAt,
    });

    const startAim = (at: { x: number; y: number } | null) => {
      origin.current = at;
      aimed.current = false;
    };

    const aim = (x: number, y: number) => {
      if (!origin.current) origin.current = { x, y };
      origin.current = trailOrigin(origin.current, { x, y }, REACH);
      const dx = x - origin.current.x;
      const dy = y - origin.current.y;
      const index = aimedSector(dx, dy, COUNT, DEAD_ZONE);
      if (index === null) return;
      aimed.current = true;
      // Focus follows the aim, so a screen reader names each station on the way.
      if (index !== getRadio().wheel?.selected) radios.current[index]?.focus({ preventScroll: true });
      selectStation(index);
      pointNeedle(angleOf(dx, dy));
    };

    const onPointerDown = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (isLoading()) return;
      const current = getRadio().wheel;
      if (event.pointerType !== "touch" && event.button === 2) {
        if (current) {
          // A right press inside the open wheel aims again.
          startAim(pointer);
          openWheel("aim", "pointer");
          return;
        }
        if (!onRadioSurface(event)) return;
        startAim(pointer);
        openWheel("aim", "pointer");
        return;
      }
      if (event.pointerType === "touch" && event.isPrimary && !current && onRadioSurface(event)) {
        cancelPress();
        // The event's own time (performance.now()'s clock), not when this handler got to run.
        const at = event.timeStamp;
        // A finger landing on a page in motion is stopping a scroll, not asking for the radio.
        if (!holdMayStart({ sinceScrollMs: at - scrollInput.at, scrolling: Boolean(lenisRef.current?.isScrolling) })) return;
        const next = { id: event.pointerId, x: event.clientX, y: event.clientY, at, inputAt: scrollInput.at, moved: 0, timer: 0 };
        // Held still long enough: a ring under the finger says lifting opens the radio.
        next.timer = window.setTimeout(() => {
          if (press !== next || !holdArmed(holdOf(next)) || getRadio().wheel || isLoading()) return;
          setArmedAt({ x: next.x, y: next.y });
          navigator.vibrate?.(8);
        }, TOUCH_HOLD.armMs);
        press = next;
      }
    };

    // The press that opened (or re-aims) the wheel must not move the focus
    // out of it, as a mouse press on the page would.
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 2 && getRadio().wheel) event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (press && event.pointerId === press.id) {
        // Any real movement makes it a swipe: the hold is off.
        press.moved = Math.max(press.moved, Math.hypot(event.clientX - press.x, event.clientY - press.y));
        if (holdCancelled(holdOf(press))) cancelPress();
      }
      const current = getRadio().wheel;
      if (current?.mode === "aim" && event.pointerType !== "touch") aim(event.clientX, event.clientY);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (press && event.pointerId === press.id) {
        // The wheel opens as the still, held finger lifts: never under a finger that went on to swipe.
        const opens = holdArmed(holdOf(press, event.timeStamp)) && !getRadio().wheel && !isLoading();
        cancelPress();
        if (opens) {
          touchOpenedAt.current = performance.now();
          openWheel("browse", "touch");
        }
      }
      const current = getRadio().wheel;
      if (event.button === 2 && current?.mode === "aim" && current.via === "pointer") {
        aimReleasedAt = performance.now();
        finishAim();
      }
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (press && event.pointerId === press.id) cancelPress();
    };

    // The context menu stays away from the scene and the open wheel only.
    const onContextMenu = (event: MouseEvent) => {
      if (isLoading()) return;
      const target = event.target;
      const inWheel = target instanceof Node && overlay.current?.contains(target);
      const afterAim = performance.now() - aimReleasedAt < AIM_MENU_GRACE_MS;
      if (inWheel || afterAim || onRadioSurface(event)) event.preventDefault();
    };

    const isQ = (event: KeyboardEvent) => event.key === "q" || event.key === "Q";

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isQ(event) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.defaultPrevented || isLoading() || isTyping(event.target)) return;
      if (event.repeat) return;
      if (getRadio().wheel) {
        // Q again closes, like Esc.
        if (!holdingQ) closeWheel();
        return;
      }
      holdingQ = true;
      startAim(pointer);
      openWheel("aim", "key");
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!isQ(event) || !holdingQ) return;
      holdingQ = false;
      if (getRadio().wheel?.via === "key") finishAim();
    };

    // Switching windows mid-hold loses the key-up: keep the wheel open to browse.
    const onBlur = () => {
      holdingQ = false;
      cancelPress();
      setWheelMode("browse");
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      cancelPress();
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
    // pointNeedle and finishAim only touch refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  const selected = wheel?.selected ?? 0;
  const entry = WHEEL[selected];
  const mode = wheel?.mode ?? "browse";
  const touch = wheel?.via === "touch" || coarse;
  const hint =
    mode === "aim" ? (wheel?.via === "key" ? dict.hintAimKey : dict.hintAim) : touch ? dict.hintTouch : dict.hintBrowse;
  const live = entry.id === radio.tuned;
  /** The track on air, shown for the current station. */
  const onAir = (station: WheelEntry) =>
    isStation(station) && station.id === radio.tuned ? (station.tracks[radio.track]?.credit ?? null) : null;
  const playing = onAir(entry);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: nextIndex(selected, COUNT),
      ArrowDown: nextIndex(selected, COUNT),
      ArrowLeft: previousIndex(selected, COUNT),
      ArrowUp: previousIndex(selected, COUNT),
      Home: 0,
      End: COUNT - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      aimed.current = true;
      select(moves[event.key], { focus: true });
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeWheel();
      return;
    }
    // Two stops (the station group and the close button): Tab cycles them.
    if (event.key === "Tab") {
      const stops = [radios.current[selected], closeButton.current];
      const at = stops.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      stops[(at + (event.shiftKey ? stops.length - 1 : 1)) % stops.length]?.focus();
    }
  };

  /** Pointer taps on a badge or a wedge; keyboard clicks have detail 0. */
  const onPick = (index: number, detail: number) => {
    if (detail > 0 && performance.now() - touchOpenedAt.current < TOUCH_GRACE_MS) return;
    choose(index);
  };

  const onHover = (index: number) => (event: ReactPointerEvent) => {
    if (event.pointerType === "touch" || mode === "aim" || !hoverArmed.current) return;
    select(index, { focus: true });
  };

  /**
   * A click on the empty backdrop closes the wheel. A finger closes it only
   * with a tap: one that swipes across the backdrop is not asking to leave,
   * and the swipe stays in the wheel instead of scrolling the page.
   */
  const onBackdrop = (event: ReactPointerEvent) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    if (performance.now() - touchOpenedAt.current < TOUCH_GRACE_MS) return;
    if (event.pointerType === "touch") {
      backdropTouch.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    closeWheel();
  };

  const onBackdropUp = (event: ReactPointerEvent) => {
    const down = backdropTouch.current;
    backdropTouch.current = null;
    if (!down || down.id !== event.pointerId || event.target !== event.currentTarget) return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) < TOUCH_HOLD.slop) closeWheel();
  };

  return (
    <>
      {/* A held finger has armed the long-press: lifting it opens the radio. */}
      <div
        className={styles.holdRing}
        data-armed={armedAt !== null}
        style={armedAt ? ({ "--x": `${armedAt.x}px`, "--y": `${armedAt.y}px` } as CSSProperties) : undefined}
        aria-hidden="true"
      />
      <div
        ref={overlay}
        className={styles.overlay}
        data-open={open}
        data-mode={mode}
        inert={!open}
        onPointerDown={onBackdrop}
        onPointerUp={onBackdropUp}
        onPointerMove={(event) => {
          if (event.movementX !== 0 || event.movementY !== 0) hoverArmed.current = true;
        }}
      >
        <div
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="radio-title"
          aria-describedby="radio-hint"
          onKeyDown={onKeyDown}
          onPointerDown={onBackdrop}
          onPointerUp={onBackdropUp}
          onMouseDown={(event) => {
            // A press on the centre or the hint must not take the focus out of the dialog.
            if (event.target instanceof Element && !event.target.closest("button")) event.preventDefault();
          }}
        >
          <h2 id="radio-title" className="sr-only">
            {dict.label}
          </h2>

          <div
            ref={dial}
            className={styles.wheel}
            data-count={COUNT}
            style={{ ...LAYOUT_STYLE, "--accent": `var(--va-radio-${entry.accent})` } as CSSProperties}
          >
            <svg className={styles.ring} viewBox="-100 -100 200 200" aria-hidden="true">
              <defs>
                {/* The selected wedge glows in its station's colour, brightest at the rim. */}
                {WHEEL.map((station) => (
                  <radialGradient
                    key={station.id}
                    id={`radio-glow-${station.id}`}
                    gradientUnits="userSpaceOnUse"
                    cx="0"
                    cy="0"
                    r={RING.outer}
                  >
                    <stop
                      offset={GLOW_FROM}
                      style={{ stopColor: `var(--va-radio-${station.accent})`, stopOpacity: 0.1 }}
                    />
                    <stop offset="1" style={{ stopColor: `var(--va-radio-${station.accent})`, stopOpacity: 0.62 }} />
                  </radialGradient>
                ))}
              </defs>
              <circle className={styles.ringTrack} r="99" />
              {WEDGES.map((d, i) => (
                <path
                  key={WHEEL[i].id}
                  d={d}
                  className={styles.wedge}
                  data-selected={i === selected}
                  style={
                    {
                      "--wedge": `var(--va-radio-${WHEEL[i].accent})`,
                      fill: i === selected ? `url(#radio-glow-${WHEEL[i].id})` : undefined,
                    } as CSSProperties
                  }
                  onPointerEnter={onHover(i)}
                  onClick={(event) => onPick(i, event.detail)}
                />
              ))}
              {/* The station on air: its rim is lit, and breathes while it plays. */}
              {WHEEL.map((station, i) =>
                station.id === radio.tuned && isStation(station) ? (
                  <path
                    key={station.id}
                    d={RIMS[i]}
                    className={styles.rim}
                    data-playing={radio.playing}
                    style={{ "--wedge": `var(--va-radio-${station.accent})` } as CSSProperties}
                  />
                ) : null,
              )}
              <circle className={styles.ringInner} r={RING.inner - 3} />
            </svg>

            <div className={styles.needle} aria-hidden="true" />

            <div role="radiogroup" aria-labelledby="radio-title" className={styles.stations}>
              {WHEEL.map((station, i) => (
                <button
                  key={station.id}
                  ref={(element) => {
                    radios.current[i] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={station.id === radio.tuned}
                  aria-label={stationLabel(station, dict, onAir(station))}
                  tabIndex={i === selected ? 0 : -1}
                  className={styles.station}
                  data-selected={i === selected}
                  data-current={station.id === radio.tuned}
                  style={
                    {
                      "--angle": `${sectorCentre(i, COUNT)}deg`,
                      "--station": `var(--va-radio-${station.accent})`,
                    } as CSSProperties
                  }
                  onPointerEnter={onHover(i)}
                  onFocus={() => {
                    if (i !== getRadio().wheel?.selected) select(i);
                  }}
                  onClick={(event) => onPick(i, event.detail)}
                >
                  <StationLogo
                    logo={station.logo}
                    frequency={isStation(station) ? formatFrequency(station.frequency) : undefined}
                  />
                </button>
              ))}
            </div>

            {/* What the pointer is on. Screen readers get the same from the radio labels. */}
            <div className={styles.centre} aria-hidden="true">
              <p className={styles.frequency}>
                {isStation(entry) ? (
                  <>
                    {formatFrequency(entry.frequency)}
                    <span className={styles.band}>FM</span>
                  </>
                ) : (
                  // An empty dial: no station.
                  <>
                    --.-
                    <span className={styles.band}>FM</span>
                  </>
                )}
              </p>
              <p className={styles.name}>{isStation(entry) ? entry.name : dict.off}</p>
              {isStation(entry) ? <p className={styles.tagline}>{dict.taglines[entry.id]}</p> : null}
              {playing ? (
                <p className={styles.track}>
                  <span className={styles.trackLabel}>{dict.nowPlaying}</span>
                  <span className={styles.trackTitle}>{playing.title}</span>
                  <span className={styles.trackArtist}>{playing.artist}</span>
                </p>
              ) : null}
              {isStation(entry) ? (
                <p className={styles.status} data-live={live}>
                  {live ? dict.onAir : dict.tune}
                </p>
              ) : null}
            </div>
          </div>

          <p id="radio-hint" className={styles.hint}>
            {hint}
          </p>

          <button ref={closeButton} type="button" className={styles.close} onClick={() => closeWheel()}>
            <span aria-hidden="true" className={styles.closeIcon} />
            <span className="sr-only">{dict.close}</span>
          </button>
        </div>
      </div>
    </>
  );
}
