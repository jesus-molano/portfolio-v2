"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./MusicToggle.module.css";
import { subscribeMusicRequests } from "./musicControl";
import { createPlayer, type Player } from "./player";

type Props = { label: string };

/** "off" once the visitor turned the music off; read and written per visitor only. */
const STORAGE_KEY = "va-music";
const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

function savePreference(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

function musicWanted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Top-right music switch. Browsers only allow sound after a user gesture, so
 * the music starts on the visitor's first click, tap or key press (unless
 * they turned it off on an earlier visit), and the button turns it on or off.
 */
export function MusicToggle({ label }: Props) {
  const [playing, setPlaying] = useState(false);
  const player = useRef<Player | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  /** Set once the visitor uses the button: the automatic start no longer applies. */
  const decided = useRef(false);

  const start = useCallback(async () => {
    player.current ??= createPlayer();
    if (!player.current) return;
    setPlaying(true);
    try {
      await player.current.start();
    } catch {
      // Blocked by the browser or the file failed to load: show it as off.
      setPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    player.current?.stop();
    setPlaying(false);
  }, []);

  // The loading screen asks explicitly: "enter with music" or "without".
  useEffect(
    () =>
      subscribeMusicRequests((on) => {
        decided.current = true;
        savePreference(on);
        if (on) void start();
        else stop();
      }),
    [start, stop],
  );

  useEffect(() => {
    if (!musicWanted()) return;
    const remove = () => GESTURES.forEach((name) => window.removeEventListener(name, onGesture, true));
    function onGesture(event: Event) {
      if (decided.current || button.current?.contains(event.target as Node)) return;
      // Gestures on the loading screen do not count: its buttons decide.
      if (event.target instanceof Element && event.target.closest("[data-loader]")) return;
      remove();
      void start();
    }
    GESTURES.forEach((name) => window.addEventListener(name, onGesture, { capture: true, passive: true }));
    return remove;
  }, [start]);

  useEffect(() => {
    const onVisibility = () => player.current?.setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => () => player.current?.dispose(), []);

  const toggle = () => {
    decided.current = true;
    if (playing) {
      stop();
      savePreference(false);
    } else {
      void start();
      savePreference(true);
    }
  };

  return (
    <Button ref={button} aria-pressed={playing} onClick={toggle}>
      <span className={styles.bars} data-playing={playing} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      {label}
    </Button>
  );
}
