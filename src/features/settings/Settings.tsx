"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useState, useSyncExternalStore } from "react";
import { type Locale, localeNames, locales } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  canSetVolume,
  cueEntry,
  getEntryChoice,
  getRadio,
  getServerEntryChoice,
  getServerRadio,
  readMemory,
  restoreVolume,
  setVolume,
  subscribeRadio,
  tune,
} from "@/features/music/radio";
import { DEFAULT_STATION_ID, formatFrequency, type StationId, visibleStations } from "@/features/music/stations";
import {
  getSubtitleSize,
  restoreSubtitleSize,
  SUBTITLE_SCALE,
  SUBTITLE_SIZES,
  setSubtitleSize,
  subscribeSubtitleSize,
  type SubtitleSize,
} from "@/lib/subtitleSize";
import { createRangeGuard } from "./rangeGuard";
import styles from "./Settings.module.css";

type SettingsDict = Dictionary["stats"]["settings"];

/**
 * Where the settings are open. `stats`: STATS's SETTINGS tab (the pause menu), in the
 * middle of the visit; the radio plays as she tunes it. `start`: the start
 * menu's SETTINGS, before she has entered; the radio is only cued (what
 * NEW GAME will play, radio.ts cueEntry), since nothing may sound before
 * she chooses to go in.
 */
export type SettingsPlace = "stats" | "start";

type Props = {
  dict: SettingsDict;
  lang: Locale;
  where: SettingsPlace;
  /** The start menu: the other language is about to open (it reopens the settings there). */
  onLanguage?: () => void;
};

const STATIONS = visibleStations();
const noSubscription = () => () => {};

/** Every id inside starts with this, so the two copies on the home page never share one. */
export function settingsIds(where: SettingsPlace): string {
  return where === "stats" ? "stats-settings" : "start-settings";
}

/**
 * The game's settings, GTA style, in four blocks; one component for the
 * pause menu (STATS's SETTINGS tab) and the start menu (the loading
 * screen's SETTINGS), so they are the same settings and both work from
 * the first visit. AUDIO tunes the radio the music button and the wheel
 * use (its store, radio.ts): on or off, the station, and her volume
 * (remembered, like the station). CONTROLS is the reference of how to
 * drive the site, keyboard, mouse and touch, true to the code
 * (hero/scroll/transport.ts, the pedal, the radio wheel, the tabs'
 * shoulder keys; a row marked `only: "stats"` is the pause menu's own).
 * DISPLAY sets the subtitle size, in the hero and in the career city
 * (lib/subtitleSize.ts). LANGUAGE opens the other language right there.
 * Every control is a native one (a switch button, radio buttons, a range,
 * links), labelled, so the keyboard and screen readers get them as they
 * are; the server HTML has them all, in their default state.
 */
export function Settings({ dict, lang, where, onLanguage }: Props) {
  // Read back what she chose before: the volume and the subtitle size (the radio's station is read as it plays).
  useEffect(() => {
    restoreVolume();
    restoreSubtitleSize();
  }, []);
  const ids = settingsIds(where);

  return (
    <div className={styles.settings}>
      <div className={styles.column}>
        <Audio dict={dict.audio} ids={ids} cue={where === "start"} />
        <Display dict={dict.display} ids={ids} />
        <Language dict={dict.language} ids={ids} lang={lang} where={where} onLanguage={onLanguage} />
      </div>
      <Controls dict={dict.controls} ids={ids} where={where} />
    </div>
  );
}

function Block({ id, title, className, children }: { id: string; title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`${styles.block} ${className ?? ""}`} aria-labelledby={id}>
      <h3 id={id} className={styles.blockTitle}>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The station she last tuned to (null the first time): what the radio comes back on. */
function useRememberedStation(): StationId | null {
  return useSyncExternalStore(
    subscribeRadio,
    () => readMemory().station,
    () => null,
  );
}

/** What the switch and the stations show: the radio as it plays, or (start menu) what NEW GAME will play. */
function useRadioChoice(cue: boolean): { on: boolean; selected: StationId | null; set: (on: boolean, station: StationId) => void } {
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  const remembered = useRememberedStation();
  const entry = useSyncExternalStore(subscribeRadio, getEntryChoice, getServerEntryChoice);
  if (cue) {
    return { on: entry.on, selected: entry.station, set: (on, station) => cueEntry({ on, station }) };
  }
  const on = radio.tuned !== "off";
  return {
    on,
    selected: on ? (radio.tuned as StationId) : remembered,
    set: (next, station) => tune(next ? station : "off"),
  };
}

function Audio({ dict, ids, cue }: { dict: SettingsDict["audio"]; ids: string; cue: boolean }) {
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  const { on, selected, set } = useRadioChoice(cue);
  const settable = useSyncExternalStore(noSubscription, canSetVolume, () => true);
  const volume = Math.round(radio.volume * 100);
  // A swipe that starts on the track scrolls the page and leaves the volume alone.
  const [guard] = useState(createRangeGuard);
  const name = useId();

  return (
    <Block id={`${ids}-audio`} title={dict.title}>
      <div className={styles.row}>
        <span className={styles.label} id={`${ids}-radio`}>
          {dict.radio}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${ids}-radio`}
          className={styles.switch}
          onClick={() => set(!on, selected ?? DEFAULT_STATION_ID)}
        >
          <span className={styles.switchTrack} aria-hidden="true">
            <span className={styles.switchKnob} />
          </span>
          <span className={styles.switchText} aria-hidden="true">
            {on ? dict.on : dict.off}
          </span>
        </button>
      </div>

      <fieldset className={styles.stations}>
        <legend className={styles.label}>{dict.station}</legend>
        <div className={styles.stationGrid} data-off={on ? undefined : ""}>
          {STATIONS.map((station) => (
            <label
              key={station.id}
              className={styles.station}
              style={{ "--accent": `var(--va-radio-${station.accent})` } as CSSProperties}
            >
              <input
                className={styles.stationInput}
                type="radio"
                name={name}
                value={station.id}
                checked={selected === station.id}
                onChange={() => set(true, station.id)}
              />
              <span className={styles.frequency}>{formatFrequency(station.frequency)}</span>
              <span className={styles.stationName}>{station.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.row}>
        <label className={styles.label} htmlFor={`${ids}-volume`}>
          {dict.volume}
        </label>
        <div className={styles.volume}>
          <input
            id={`${ids}-volume`}
            className={styles.range}
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            disabled={!settable}
            aria-valuetext={`${volume} %`}
            aria-describedby={settable ? undefined : `${ids}-volume-note`}
            style={{ "--level": `${volume}%` } as CSSProperties}
            onChange={(event) => setVolume(Number(event.currentTarget.value) / 100)}
            onPointerDown={(event) => guard.down(event.pointerType, volume)}
            onPointerUp={() => guard.up()}
            onPointerCancel={(event) => {
              const found = guard.cancel();
              if (found === null) return;
              event.currentTarget.value = String(found);
              setVolume(found / 100);
            }}
          />
          <output className={styles.value} htmlFor={`${ids}-volume`} aria-hidden="true">
            {volume}%
          </output>
        </div>
      </div>
      {settable ? null : (
        <p id={`${ids}-volume-note`} className={styles.note}>
          {dict.fixedVolume}
        </p>
      )}
    </Block>
  );
}

function Display({ dict, ids }: { dict: SettingsDict["display"]; ids: string }) {
  const size = useSyncExternalStore(subscribeSubtitleSize, getSubtitleSize, () => "m" as SubtitleSize);
  const name = useId();
  return (
    <Block id={`${ids}-display`} title={dict.title}>
      <fieldset className={styles.sizes}>
        <legend className={styles.label}>{dict.subtitles}</legend>
        <div className={styles.segmented}>
          {SUBTITLE_SIZES.map((option, i) => (
            <label key={option} className={styles.segment}>
              <input
                className={styles.segmentInput}
                type="radio"
                name={name}
                value={option}
                checked={size === option}
                onChange={() => setSubtitleSize(option)}
              />
              <span className={styles.segmentText}>{dict.sizes[i]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* What a card looks like at that size: the film's own block, speaker in pink. */}
      <p className={styles.sample} style={{ "--scale": SUBTITLE_SCALE[size] } as CSSProperties} aria-hidden="true">
        <span className={styles.sampleText}>
          <span className={styles.speaker}>{dict.sample.split(":")[0]}:</span>
          {dict.sample.slice(dict.sample.indexOf(":") + 1)}
        </span>
      </p>
    </Block>
  );
}

function Language({
  dict,
  ids,
  lang,
  where,
  onLanguage,
}: {
  dict: SettingsDict["language"];
  ids: string;
  lang: Locale;
  where: SettingsPlace;
  onLanguage?: () => void;
}) {
  return (
    <Block id={`${ids}-language`} title={dict.title}>
      <ul className={styles.languages}>
        {locales.map((locale) => (
          <li key={locale}>
            {locale === lang ? (
              <span className={`${styles.language} ${styles.languageOn}`} aria-current="true" lang={locale}>
                <span className={styles.languageCode} aria-hidden="true">
                  {locale}
                </span>
                {localeNames[locale]}
              </span>
            ) : (
              // The other language, right here: the pause menu's address names this tab, so she lands
              // back on it; the start menu reopens its settings there (onLanguage).
              <a
                className={styles.language}
                href={where === "stats" ? `/${locale}#${ids}` : `/${locale}`}
                hrefLang={locale}
                lang={locale}
                onClick={onLanguage}
              >
                <span className={styles.languageCode} aria-hidden="true">
                  {locale}
                </span>
                {localeNames[locale]}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.note}>{where === "stats" ? dict.hint : dict.hintStart}</p>
    </Block>
  );
}

function Keys({ combos, or }: { combos: readonly (readonly string[])[]; or: string }) {
  return (
    <span className={styles.keys}>
      {combos.map((combo, i) => (
        <span key={combo.join("+")} className={styles.combo}>
          {i > 0 ? <span className={styles.or}>{or}</span> : null}
          {combo.map((key) => (
            <kbd key={key} className={styles.keycap}>
              {key}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

function Controls({ dict, ids, where }: { dict: SettingsDict["controls"]; ids: string; where: SettingsPlace }) {
  const [action, keyboard, mouse, touch] = dict.columns;
  const rows = dict.rows.filter((row) => !("only" in row) || row.only === where);
  return (
    <Block id={`${ids}-controls`} title={dict.title} className={styles.controlsBlock}>
      <table className={styles.controls}>
        <thead>
          <tr>
            <th scope="col">{action}</th>
            <th scope="col">{keyboard}</th>
            <th scope="col">{mouse}</th>
            <th scope="col">{touch}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.action}>
              <th scope="row">{row.action}</th>
              <td>
                <span className={styles.cellLabel} aria-hidden="true">
                  {keyboard}
                </span>
                <Keys combos={row.keys} or={dict.or} />
              </td>
              <td>
                <span className={styles.cellLabel} aria-hidden="true">
                  {mouse}
                </span>
                {row.mouse}
              </td>
              <td>
                <span className={styles.cellLabel} aria-hidden="true">
                  {touch}
                </span>
                {row.touch}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Block>
  );
}
