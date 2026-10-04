"use client";

import { useLenis } from "lenis/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import {
  getSceneLoading,
  getServerSceneLoading,
  markEntered,
  subscribeSceneLoading,
} from "@/features/hero/sceneLoading";
import { requestMusic } from "@/features/music/musicControl";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./LoadingScreen.module.css";

type Props = { dict: Dictionary["loader"] };
type Phase = "loading" | "ready" | "leaving" | "gone";

/** Long enough to read one tip, short enough not to annoy. */
const MIN_VISIBLE_MS = 1600;
/** If the scene never reports ready, let the visitor in anyway. */
const FAILSAFE_MS = 20000;
const TIP_MS = 4500;
const LEAVE_MS = 700;
/** Keys that move focus or modify others never count as "any key". */
const IGNORED_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "Enter", " "]);

/**
 * Centred loading screen: "Loading…" over a progress bar and a rotating tip
 * in the narrator's voice, then "Loaded!" with two ways in, with music or
 * without; any other key enters with music. The click or key press is the
 * gesture browsers need before they play sound.
 *
 * Accessibility: a modal dialog labelled by its title and described by the
 * tip; the page behind is inert; text meets WCAG AA contrast on the dark
 * background; no motion with prefers-reduced-motion. Without JavaScript it
 * is hidden (see NO_JS_STYLE in the layout).
 */
export function LoadingScreen({ dict }: Props) {
  const { progress, ready } = useSyncExternalStore(
    subscribeSceneLoading,
    getSceneLoading,
    getServerSceneLoading,
  );
  const reducedMotion = usePrefersReducedMotion();
  const lenis = useLenis();
  const [phase, setPhase] = useState<Phase>("loading");
  /** The phase as of the last render, for event handlers. */
  const phaseRef = useRef<Phase>("loading");
  const [tip, setTip] = useState(0);
  const shownAt = useRef(0);
  const dialog = useRef<HTMLDivElement>(null);
  const withMusic = useRef<HTMLButtonElement>(null);

  // Start at the top of the drive.
  useEffect(() => {
    shownAt.current = performance.now();
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    dialog.current?.focus();
  }, []);

  // While the screen is up, the page behind is inert and does not scroll.
  useEffect(() => {
    phaseRef.current = phase;
    const root = document.documentElement;
    const behind = [document.getElementById("main"), document.querySelector("[data-page-controls]")];
    if (phase === "gone") {
      delete root.dataset.loading;
      behind.forEach((element) => element?.removeAttribute("inert"));
      lenis?.start();
      return;
    }
    root.dataset.loading = "";
    behind.forEach((element) => element?.setAttribute("inert", ""));
    lenis?.stop();
  }, [phase, lenis]);

  // Ready once the scene is, but never before one tip could be read.
  useEffect(() => {
    if (!ready || phase !== "loading") return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current));
    const timer = setTimeout(() => setPhase("ready"), wait);
    return () => clearTimeout(timer);
  }, [ready, phase]);

  useEffect(() => {
    const timer = setTimeout(() => setPhase((p) => (p === "loading" ? "ready" : p)), FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "gone" || phase === "leaving") return;
    const timer = setInterval(() => setTip((i) => (i + 1) % dict.tips.length), TIP_MS);
    return () => clearInterval(timer);
  }, [phase, dict.tips.length]);

  const enter = useCallback((music: boolean) => {
    if (phaseRef.current !== "ready") return;
    phaseRef.current = "leaving";
    // Inside the click or key press: the browser allows audio.play() here.
    requestMusic(music);
    markEntered();
    setPhase("leaving");
  }, []);

  // Loaded: focus the main choice; any other key enters with music. Enter and
  // Space are left to the focused button, Tab moves between the two.
  useEffect(() => {
    if (phase !== "ready") return;
    withMusic.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (IGNORED_KEYS.has(event.key) || event.repeat) return;
      enter(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, enter]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("gone"), reducedMotion ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion]);

  if (phase === "gone") return null;

  const loading = phase === "loading";

  return (
    <div
      ref={dialog}
      className={styles.loader}
      data-loader
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="loader-title"
      aria-describedby="loader-tip"
      tabIndex={-1}
    >
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.stack}>
        {/* Once loaded, the two ways in are the whole screen; the dialog
            keeps its name for screen readers. */}
        <h2 id="loader-title" className={loading ? styles.title : "sr-only"}>
          {loading ? (
            <>
              {dict.loading}
              <span className={styles.dots} aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </>
          ) : (
            dict.choose
          )}
        </h2>

        {loading ? (
          <div className={styles.progress}>
            <div
              className={styles.track}
              role="progressbar"
              aria-label={dict.loading}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className={styles.fill} style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
            <span className={styles.percent} aria-hidden="true">
              {progress}%
            </span>
          </div>
        ) : (
          <div className={styles.choices}>
            {/* Any key enters with music, so the hint sits under that button. */}
            <div className={styles.option}>
              <Button
                ref={withMusic}
                variant="solid"
                size="lg"
                aria-describedby="loader-hint"
                onClick={() => enter(true)}
              >
                {dict.withMusic}
              </Button>
              <p id="loader-hint" className={styles.hint}>
                {dict.hint}
              </p>
            </div>
            <div className={styles.option}>
              <Button variant="ghost" size="md" onClick={() => enter(false)}>
                {dict.withoutMusic}
              </Button>
            </div>
          </div>
        )}

        <p id="loader-tip" className={styles.tip}>
          <span className={styles.tipLabel}>{dict.tipLabel}</span>
          <span key={tip} className={styles.tipText}>
            {dict.tips[tip]}
          </span>
        </p>

        <p className="sr-only" role="status">
          {loading ? dict.loading : dict.ready}
        </p>
      </div>
    </div>
  );
}
