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
/** After entering, once the title has had its moment. */
const HINT_DELAY_MS = 3500;
const HINT_MS = 7000;

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
 * small callout under it says how to open the wheel from the scene.
 */
export function RadioButton({ dict }: Props) {
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  const entered = useSyncExternalStore(
    subscribeSceneLoading,
    () => getSceneLoading().entered,
    () => false,
  );
  const touch = useMediaQuery("(pointer: coarse)");
  const button = useRef<HTMLButtonElement>(null);
  const [callout, setCallout] = useState(false);
  const open = radio.wheel !== null;
  const entry = findEntry(radio.tuned);
  const gesture = touch ? dict.gestureTouch : dict.gesture;

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
    if (!entered || hintSeen()) return;
    const show = window.setTimeout(() => setCallout(true), HINT_DELAY_MS);
    const hide = window.setTimeout(() => {
      setCallout(false);
      markHintSeen();
    }, HINT_DELAY_MS + HINT_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [entered]);

  // Whoever opened the wheel knows the way: the hint is done.
  useEffect(() => {
    if (open) markHintSeen();
  }, [open]);

  return (
    <span className={styles.wrap}>
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
      <span className={styles.callout} data-visible={callout && !open} aria-hidden="true">
        {gesture}
      </span>
    </span>
  );
}
