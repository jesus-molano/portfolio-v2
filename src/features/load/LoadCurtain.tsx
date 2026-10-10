"use client";

import { type CSSProperties, useEffect, useRef, useSyncExternalStore } from "react";
import type { LoaderTip } from "@/features/loader/tips";
import { getRadio, getServerRadio, subscribeRadio } from "@/features/music/radio";
import { findEntry, formatFrequency, isStation } from "@/features/music/stations";
import type { Dictionary } from "@/i18n/dictionaries";
import { createCurtainController } from "./curtainController";
import styles from "./LoadCurtain.module.css";
import { registerLoadCurtain } from "./loadHold";
import { completeLabel, SAVES } from "./saves";
import type { SlotWords } from "./slotWords";

type Props = {
  dict: Dictionary["load"];
  words: SlotWords;
  /** The start menu's tips and their labels: one shows on a load that takes a while. */
  tips: readonly LoaderTip[];
  labels: { tip: string; trivia: string };
};

/**
 * LOAD GAME's load screen: night over the whole screen while a save loads
 * (curtainController.ts runs it, loadCurtain.ts holds its rules). It shows
 * the save she loads, as its slot did (its picture, "Save 04", the chapter
 * card's word and ribbon, how far into the story), the radio she loads
 * with, a tip if it takes a while, "Still loading" and the way in now
 * after 2.5 s, and a bar along the bottom edge that fills as the place
 * comes in (never full before it has).
 *
 * In the page from the first paint, idle: hidden, inert and out of the
 * accessibility tree; every save's words are in it, stacked in one cell,
 * and a load only switches attributes (no layout shift, nothing
 * rendered in the click). While it holds it is a modal dialog with the
 * focus, named "Loading game" and the save's word, busy; its live region
 * says "Still loading" once. Rendered before <main>, after the
 * start menu, and above it (`--va-z-load`): a save chosen there loads
 * under this same screen.
 */
export function LoadCurtain({ dict, words, tips, labels }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const thumb = useRef<HTMLImageElement>(null);
  const tipLabel = useRef<HTMLSpanElement>(null);
  const tipText = useRef<HTMLParagraphElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const goNow = useRef<HTMLButtonElement>(null);
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  const entry = findEntry(radio.tuned);
  const station = isStation(entry) ? `${entry.name} ${formatFrequency(entry.frequency)}` : dict.radioOff;

  useEffect(() => {
    const parts = {
      root: root.current,
      live: live.current,
      thumb: thumb.current,
      tipLabel: tipLabel.current,
      tipText: tipText.current,
      bar: bar.current,
      goNow: goNow.current,
    };
    if (Object.values(parts).some((part) => part === null)) return;
    const controller = createCurtainController(parts as { [K in keyof typeof parts]: NonNullable<(typeof parts)[K]> }, {
      slow: dict.slow,
      tips,
      labels,
    });
    const unregister = registerLoadCurtain(controller.begin);
    return () => {
      unregister();
      controller.dispose();
    };
  }, [dict.slow, tips, labels]);

  return (
    <>
      <div
        ref={root}
        className={styles.curtain}
        data-load-curtain
        data-state="idle"
        data-slot=""
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-curtain-kicker"
        aria-describedby="load-curtain-status"
        aria-hidden="true"
        inert
        tabIndex={-1}
      >
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.panel}>
          <p id="load-curtain-kicker" className={styles.kicker}>
            {dict.loading}
          </p>
          <div className={styles.save}>
            <div className={styles.thumb}>
              {/* The slot's own picture, already in the cache: set in the click, never waited for. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- a picture the menu already loaded, swapped in the click */}
              <img ref={thumb} alt="" width={320} height={180} decoding="async" data-thumb />
            </div>
            <div className={styles.texts}>
              {SAVES.map((save, i) => {
                const { word, ribbon } = words[save.id];
                const tag = save.tag ? dict.tags[save.tag] : null;
                return (
                  <div key={save.id} className={styles.slotText} data-for={save.id}>
                    <span className={styles.meta}>
                      <span className={styles.number}>
                        {dict.slot} {String(i + 1).padStart(2, "0")}
                      </span>
                      {tag ? <span className={styles.tag}>{tag}</span> : null}
                    </span>
                    <span id={`load-curtain-word-${save.id}`} className={styles.word}>
                      {word}
                    </span>
                    <span className={styles.ribbon}>{ribbon}</span>
                    <span className={styles.complete}>
                      <i style={{ "--complete": `${save.complete}%` } as CSSProperties} aria-hidden="true" />
                      {completeLabel(dict.complete, save.complete)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className={styles.radio} data-on={isStation(entry) ? "" : undefined}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d={isStation(entry) ? "M2 10v4M6 6v8M10 3v11M14 8v6" : "M2 8h12"} />
            </svg>
            {dict.radio} · {station}
          </p>
          <div className={styles.tip}>
            <span ref={tipLabel} className={styles.tipLabel} />
            <p ref={tipText} className={styles.tipText} />
          </div>
        </div>
        <div className={styles.foot}>
          <p id="load-curtain-status" className={styles.status}>
            <span data-when="hold">
              {dict.loading}
              <span className={styles.dots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </span>
            <span data-when="slow">{dict.slow}</span>
          </p>
          <button ref={goNow} type="button" className={styles.goNow} data-go-now>
            {dict.goNow}
          </button>
        </div>
        <div
          ref={bar}
          className={styles.bar}
          role="progressbar"
          aria-label={dict.loading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <i className={styles.fill} />
        </div>
        {/* Inside the dialog: a screen reader hears nothing outside an aria-modal one. */}
        <p ref={live} className="sr-only" role="status" data-load-live />
      </div>
    </>
  );
}
