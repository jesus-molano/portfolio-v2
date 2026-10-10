"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./LoadMenu.module.css";
import { completeLabel, type Save, saveHref, SAVES, slotKey, slotMove, THUMB_SIZES, thumbSrcSet } from "./saves";
import type { SlotWords } from "./slotWords";

type Props = {
  dict: Dictionary["load"];
  words: SlotWords;
  lang: Locale;
  /** Where it opens: the start menu (before she enters) or the page controls. Prefixes its ids. */
  where: "start" | "page";
  open: boolean;
  /** Closed without loading (Esc, Back, the backdrop), or `loaded` once a slot was chosen. */
  onClose: (loaded: boolean) => void;
  /** What the switch shows: on or off, and the station she would load with. */
  radio: { on: boolean; station: string };
  onRadio: (on: boolean) => void;
  /**
   * A slot chosen: the dialog has closed already, in the click. The host
   * turns the radio on or off inside the gesture (the browser's rule for
   * sound) and loads the save under the load screen; `picture` is the
   * slot's picture as it showed (in the cache), for the load screen.
   */
  onLoad: (save: Save, event: MouseEvent<HTMLAnchorElement>, picture: string) => void;
  /** The slot she is in, marked "you are here" (the page controls' menu); null before she enters. */
  current: number | null;
  /** The slot the focus starts on. */
  initial: number;
  /** The city is still coming in: a slot says "not yet" instead of loading (the start menu). */
  waiting?: boolean;
  /** Said once the city is in while it is open (the start menu): the slots load now. */
  ready?: string;
};

/**
 * LOAD GAME / CARGAR PARTIDA: the page's parts as a game's save slots
 * (saves.ts), in a native modal dialog over the start menu or, from the
 * page controls, over the page. A radio switch on top says whether she
 * loads with the radio on, as it is now (the start menu's cue, or the
 * radio playing), and she can flip it; then each slot is a real link to
 * its part (`#suspects` ... `#contact`, the hero's the top of the page):
 * its picture, "Save 04", the chapter card's word and ribbon, how far
 * into the story it stands, and a tag on the quickest look at him and on
 * the contact.
 *
 * Keyboard: the slots are one tab stop (roving tabindex) between the
 * switch and Back; the arrows move through their grid (two columns on a
 * wide screen, one on a phone), Home and End go to the ends, Enter or
 * Space loads, Esc goes back. A mouse over a slot selects it, as in the
 * start menu. Nothing behind hears a key while it is open (the hero's
 * Esc skips the film; Q opens the radio): the dialog keeps every key to
 * itself, and its Esc reaches the page already taken, as the radio
 * wheel's does. It scrolls on its own where the screen is short
 * (`data-lenis-prevent`: a stopped Lenis cancels every wheel and
 * touchmove it sees).
 */
export function LoadMenu({ dict, words, lang, where, open, onClose, radio, onRadio, onLoad, current, initial, waiting = false, ready }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const slots = useRef<(HTMLAnchorElement | null)[]>([]);
  const loaded = useRef(false);
  const [active, setActive] = useState(initial);
  const [nudge, setNudge] = useState(0);
  const [live, setLive] = useState("");
  const id = useId();
  const titleId = `${where}-load-title${id}`;
  const radioId = `${where}-load-radio${id}`;
  const stationId = `${where}-load-station${id}`;

  // Open and close with the host's state; the focus starts on its slot.
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      loaded.current = false;
      setActive(initial);
      setLive("");
      setNudge(0);
      element.showModal();
      slots.current[initial]?.focus({ preventScroll: true });
      element.scrollTop = 0;
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, initial]);

  // The city comes in while it is open: said once, in its own live region (the start menu's is behind the modal).
  const wasWaiting = useRef(waiting);
  useEffect(() => {
    if (open && wasWaiting.current && !waiting && ready) setLive(ready);
    wasWaiting.current = waiting;
  }, [open, waiting, ready]);

  // The slot she is on stays in view where the dialog scrolls (a phone, a short window): the
  // dialog's own scroll, never the page's.
  useEffect(() => {
    const element = dialog.current;
    const slot = slots.current[active];
    if (!open || !element || !slot) return;
    const box = slot.getBoundingClientRect();
    const margin = 12;
    if (box.top < margin) element.scrollTop += box.top - margin;
    else if (box.bottom > element.clientHeight - margin) element.scrollTop += box.bottom - element.clientHeight + margin;
  }, [open, active]);

  const columns = () => {
    const template = list.current ? getComputedStyle(list.current).gridTemplateColumns : "";
    return Math.max(1, template.split(" ").filter(Boolean).length);
  };

  const select = (index: number) => {
    setActive(index);
    slots.current[index]?.focus({ preventScroll: true });
  };

  const close = () => {
    dialog.current?.close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      // Its own Esc: taken here (the native close would let it on to the page as a fresh key), so
      // the hero sees it prevented and neither skips the film now nor on an Esc right after.
      event.preventDefault();
      close();
      return;
    }
    // Every other key stays in the dialog: the page's own keys (the pedal, Q, the STATS tabs' [ ])
    // never act behind it.
    event.stopPropagation();
    // The Enter that opened it, held down: its autorepeat never loads the slot under the focus.
    if (event.key === "Enter" && event.repeat) {
      event.preventDefault();
      return;
    }
    const index = slots.current.findIndex((slot) => slot === document.activeElement);
    if (index < 0) return;
    const key = slotKey(event);
    if (key) {
      event.preventDefault();
      select(slotMove(index, key, columns()));
      return;
    }
    // Space loads, as Enter does, like the start menu's items.
    if ((event.key === " " || event.key === "Spacebar") && !event.repeat) {
      event.preventDefault();
      slots.current[index]?.click();
    }
  };

  const onSlotClick = (save: Save) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (waiting) {
      event.preventDefault();
      setNudge((n) => n + 1);
      // A new string each time, so it is said again.
      setLive((old) => (old === dict.notYet ? `${dict.notYet} ` : dict.notYet));
      return;
    }
    loaded.current = true;
    const picture = event.currentTarget.querySelector("img")?.currentSrc ?? "";
    close();
    onLoad(save, event, picture);
  };

  const onDialogClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    onClose(loaded.current);
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      data-load-menu={where}
      data-lenis-prevent
      onKeyDown={onKeyDown}
      onClose={onDialogClose}
      onCancel={(event) => {
        // A close request that is no Esc key (a phone's back gesture): back, not past the page.
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog itself, outside its box) goes back.
        if (event.target === event.currentTarget) close();
      }}
    >
      {/* Two names for one shake, so each "not yet" plays it again without remounting the box (and
          losing the focus on her slot). */}
      <div className={styles.box} data-nudge={nudge > 0 ? (nudge % 2 ? "a" : "b") : undefined}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {dict.title}
            <span className={styles.kicker}> · {dict.kicker}</span>
          </h2>
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-checked={radio.on}
            aria-labelledby={radioId}
            aria-describedby={stationId}
            data-radio-switch
            onClick={() => onRadio(!radio.on)}
          >
            <span id={radioId} className={styles.switchLabel}>
              {dict.radio}
            </span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.knob} />
            </span>
            <span id={stationId} className={styles.station}>
              {radio.on ? radio.station : dict.radioOff}
            </span>
          </button>
        </div>

        <ol ref={list} className={styles.slots}>
          {SAVES.map((save, i) => {
            const { word, ribbon } = words[save.id];
            const number = String(i + 1).padStart(2, "0");
            const complete = completeLabel(dict.complete, save.complete);
            const tag = save.tag ? dict.tags[save.tag] : null;
            const here = current === i;
            return (
              <li key={save.id} className={styles.item}>
                <a
                  ref={(slot) => {
                    slots.current[i] = slot;
                  }}
                  className={styles.slot}
                  href={saveHref(save)}
                  data-slot={save.id}
                  data-active={active === i ? "" : undefined}
                  tabIndex={active === i ? 0 : -1}
                  aria-current={here ? "location" : undefined}
                  aria-disabled={waiting ? "true" : undefined}
                  aria-label={[`${dict.slot} ${number}: ${word}`, ribbon, complete, tag].filter(Boolean).join(". ")}
                  onFocus={() => setActive(i)}
                  onPointerMove={(event) => {
                    // A mouse that really moves: not the hover the browser fakes when the dialog
                    // scrolls its slots under a still pointer (the tap that opened it, on a phone).
                    if (event.pointerType === "mouse" && (event.movementX || event.movementY) && active !== i) select(i);
                  }}
                  onClick={onSlotClick(save)}
                >
                  <span className={styles.thumb}>
                    <picture>
                      <source type="image/avif" srcSet={thumbSrcSet(save.id, lang, "avif")} sizes={THUMB_SIZES} />
                      <img
                        src={`${thumbSrcSet(save.id, lang, "webp").split(" ")[0]}`}
                        srcSet={thumbSrcSet(save.id, lang, "webp")}
                        sizes={THUMB_SIZES}
                        alt=""
                        width={320}
                        height={180}
                        loading="lazy"
                        decoding="async"
                      />
                    </picture>
                    {here ? <span className={styles.here}>{dict.here}</span> : null}
                  </span>
                  <span className={styles.text} aria-hidden="true">
                    <span className={styles.meta}>
                      <span className={styles.number}>
                        {dict.slot} {number}
                      </span>
                      {tag ? <span className={styles.tag}>{tag}</span> : null}
                    </span>
                    <span className={styles.word}>{word}</span>
                    <span className={styles.ribbon}>{ribbon}</span>
                    <span className={styles.progress}>
                      <i style={{ "--complete": `${save.complete}%` } as CSSProperties} />
                      {complete}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>

        <div className={styles.foot}>
          <p className={styles.legend} data-waiting={waiting ? "" : undefined}>
            <span className={styles.keys} data-when="ready" aria-hidden="true">
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>←</kbd>
              <kbd>→</kbd>
              {dict.keys.move}
              <span className={styles.dot}>·</span>
              <kbd>{dict.keys.enter}</kbd>
              {dict.keys.load}
            </span>
            <span className={styles.touch} data-when="ready" aria-hidden="true">
              {dict.touch}
            </span>
            <span className={styles.wait} data-when="waiting">
              {dict.waiting}
              <span className={styles.dots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </span>
          </p>
          <button type="button" className={styles.back} data-back onClick={close}>
            <kbd className={styles.esc} aria-hidden="true">
              Esc
            </kbd>
            {dict.back}
          </button>
        </div>
        <p className="sr-only" role="status">
          {live}
        </p>
      </div>
    </dialog>
  );
}
