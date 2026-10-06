"use client";

import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { getSceneLoading, subscribeSceneLoading } from "@/features/hero/sceneLoading";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Dictionary } from "@/i18n/dictionaries";
import { getRadio, getServerRadio, openWheel, resumeRemembered, subscribeRadio } from "./radio";
import styles from "./RadioButton.module.css";
import { findEntry, formatFrequency, isStation } from "./stations";

type Props = { dict: Dictionary["radio"] };

const GESTURES = ["pointerdown", "keydown", "touchend"] as const;
/** "seen" once the visitor was shown how to open the wheel. */
const HINT_KEY = "va-radio-hint";
/**
 * Once the hero has settled (its first line read and the visitor at rest,
 * see sceneLoading), the callout waits for a quiet moment that lasts: a
 * line playing, nothing on screen asking her for anything. It never shares
 * the screen with a prompt: when the hero asks her again, it goes. It is
 * the hero's alone (`data-side-hint`): it shows only while the hero runs
 * down past it, since past the hero (Skip, a deep link, scrolling on) it
 * would cover the next section's chapter card, so it goes, and comes back
 * in the hero until it has been seen.
 */
const HINT_DELAY_MS = 800;
/** Up this long at most, and seen once it has been up this long in all. */
const HINT_MS = 7000;
const HINT_SEEN_MS = 2500;

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "seen";
  } catch {
    return false;
  }
}

function markHintSeen() {
  try {
    localStorage.setItem(HINT_KEY, "seen");
  } catch {
    // Blocked storage: the hint may show again on the next visit.
  }
}

/**
 * The music button in the page controls: shows the station on air
 * ("87.9 K-CALIMA", the frequency alone on phones) and opens the radio
 * wheel. Browsers only allow sound after a gesture, so on pages without the
 * loading screen the remembered station starts on the first click, tap or
 * key press, unless the visitor turned the radio off. Once per visitor, a
 * small callout says how to open the wheel, while the button glows: after
 * the hero's first line, in a quiet moment (a line playing, no prompt up,
 * so never two instructions at once), while the hero is on screen behind
 * it and its film is not over, below the hero's dash and camera readout
 * so it never covers them (on tall screens the dash takes the sky under
 * the page controls, and the callout hangs below it). A tap or click on the
 * callout opens the wheel too: on touch screens it says "tap here".
 */
export function RadioButton({ dict }: Props) {
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  /**
   * The hero has settled, asks her for nothing right now, is up behind the
   * callout and its film is not over: past it (Skip lands on THE USUAL
   * SUSPECTS, a deep link, scrolling on) the callout would hang over the
   * next section's chapter card.
   */
  const calm = useSyncExternalStore(
    subscribeSceneLoading,
    () => {
      const scene = getSceneLoading();
      return scene.settled && scene.quiet && scene.onScreen && scene.onStage;
    },
    () => false,
  );
  /** How long the callout has been up so far (ms), over its appearances. */
  const shownMs = useRef(0);
  const touch = useMediaQuery("(pointer: coarse)");
  const button = useRef<HTMLButtonElement>(null);
  const [callout, setCallout] = useState(false);
  const open = radio.wheel !== null;
  const entry = findEntry(radio.tuned);
  const gesture = touch ? dict.gestureTouch : dict.gesture;
  /** On touch the button (or the callout itself) is the obvious way in. */
  const calloutText = touch ? dict.calloutTouch : dict.gesture;

  /** In the same render as the hero asking her again: the callout never shares a frame with a prompt. */
  const showCallout = callout && calm && !open;

  useEffect(() => {
    const remove = () => GESTURES.forEach((name) => window.removeEventListener(name, onGesture, true));
    function onGesture(event: Event) {
      if (button.current?.contains(event.target as Node)) return;
      // The loading screen's own buttons decide there.
      if (event.target instanceof Element && event.target.closest("[data-loader]")) return;
      remove();
      resumeRemembered();
    }
    GESTURES.forEach((name) => window.addEventListener(name, onGesture, { capture: true, passive: true }));
    return remove;
  }, []);

  useEffect(() => {
    if (!calm || hintSeen()) return;
    let shownAt = Number.NaN;
    const show = window.setTimeout(() => {
      shownAt = performance.now();
      setCallout(true);
    }, HINT_DELAY_MS);
    const hide = window.setTimeout(
      () => {
        setCallout(false);
        markHintSeen();
      },
      HINT_DELAY_MS + Math.max(0, HINT_MS - shownMs.current),
    );
    return () => {
      // The hero asks her something again: the callout steps aside, and comes back at the next quiet
      // moment until it has been up HINT_SEEN_MS in all.
      window.clearTimeout(show);
      window.clearTimeout(hide);
      setCallout(false);
      if (!Number.isNaN(shownAt)) shownMs.current += performance.now() - shownAt;
      if (shownMs.current >= HINT_SEEN_MS) markHintSeen();
    };
  }, [calm]);

  // Whoever opened the wheel knows the way: the hint is done.
  useEffect(() => {
    if (open) markHintSeen();
  }, [open]);

  return (
    <span className={styles.wrap} data-calling={showCallout}>
      <Button
        ref={button}
        className={styles.button}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby="radio-gesture"
        title={gesture}
        data-playing={radio.playing}
        style={isStation(entry) ? ({ "--station": `var(--va-radio-${entry.accent})` } as CSSProperties) : undefined}
        onClick={() => openWheel("browse", "button", button.current)}
      >
        <span className={styles.bars} data-playing={radio.playing} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        {isStation(entry) ? (
          <>
            <span className="sr-only">{dict.label}: </span>
            <span className={styles.frequency}>{formatFrequency(entry.frequency)}</span>
            <span className={styles.name}>{entry.name}</span>
          </>
        ) : (
          <>
            {/* "Radio off" / "Apagar" name the wheel's choice; the button states the radio's state. */}
            <span aria-hidden="true">{dict.label}</span>
            <span className="sr-only">{dict.offState}</span>
          </>
        )}
      </Button>
      <span id="radio-gesture" hidden>
        {gesture}
      </span>
      {/* The button is the control for keyboards and screen readers; the tag only adds a bigger target. */}
      <span
        className={styles.callout}
        data-side-hint
        data-visible={showCallout}
        aria-hidden="true"
        onClick={() => openWheel("browse", "button", button.current)}
      >
        {calloutText}
      </span>
    </span>
  );
}
