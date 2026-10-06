"use client";

import { type CSSProperties, useEffect, useId, useSyncExternalStore } from "react";
import { type Locale, localeNames, locales } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  canSetVolume,
  getRadio,
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
import styles from "./StatsSettings.module.css";
import { PANEL_IDS } from "./statsTabs";

type SettingsDict = Dictionary["stats"]["settings"];

const STATIONS = visibleStations();
const noSubscription = () => () => {};

/**
 * SETTINGS, the pause menu's last tab: real settings, GTA style, in four
 * blocks. AUDIO tunes the radio the music button and the wheel use (its
 * store, radio.ts): on or off, the station, and her volume (remembered,
 * like the station). CONTROLS is the reference of how to drive the site,
 * keyboard, mouse and touch, true to the code (hero/scroll/transport.ts,
 * the pedal, the radio wheel, the tabs' shoulder keys). DISPLAY sets the
 * film's subtitle size, in the hero and in the career city
 * (lib/subtitleSize.ts). LANGUAGE opens the other language on this very
 * tab. Every control is a native one (a switch button, radio buttons, a
 * range, links), labelled, so the keyboard and screen readers get them as
 * they are; the server HTML has them all, in their default state.
 */
export function StatsSettings({ dict, lang }: { dict: SettingsDict; lang: Locale }) {
  // Read back what she chose before: the volume and the subtitle size (the radio's station is read as it plays).
  useEffect(() => {
    restoreVolume();
    restoreSubtitleSize();
  }, []);

  return (
    <div className={styles.settings}>
      <div className={styles.column}>
        <Audio dict={dict.audio} />
        <Display dict={dict.display} />
        <Language dict={dict.language} lang={lang} />
      </div>
      <Controls dict={dict.controls} />
    </div>
  );
}

function Block({ id, title, className, children }: { id: string; title: string; className?: string; children: React.ReactNode }) {
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

function Audio({ dict }: { dict: SettingsDict["audio"] }) {
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  const remembered = useRememberedStation();
  const settable = useSyncExternalStore(noSubscription, canSetVolume, () => true);
  const on = radio.tuned !== "off";
  const selected = on ? radio.tuned : remembered;
  const volume = Math.round(radio.volume * 100);
  const name = useId();

  return (
    <Block id="stats-settings-audio" title={dict.title}>
      <div className={styles.row}>
        <span className={styles.label} id="stats-settings-radio">
          {dict.radio}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="stats-settings-radio"
          className={styles.switch}
          onClick={() => tune(on ? "off" : (remembered ?? DEFAULT_STATION_ID))}
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
                onChange={() => tune(station.id)}
              />
              <span className={styles.frequency}>{formatFrequency(station.frequency)}</span>
              <span className={styles.stationName}>{station.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="stats-settings-volume">
          {dict.volume}
        </label>
        <div className={styles.volume}>
          <input
            id="stats-settings-volume"
            className={styles.range}
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            disabled={!settable}
            aria-valuetext={`${volume} %`}
            aria-describedby={settable ? undefined : "stats-settings-volume-note"}
            style={{ "--level": `${volume}%` } as CSSProperties}
            onChange={(event) => setVolume(Number(event.currentTarget.value) / 100)}
          />
          <output className={styles.value} htmlFor="stats-settings-volume" aria-hidden="true">
            {volume}%
          </output>
        </div>
      </div>
      {settable ? null : (
        <p id="stats-settings-volume-note" className={styles.note}>
          {dict.fixedVolume}
        </p>
      )}
    </Block>
  );
}

function Display({ dict }: { dict: SettingsDict["display"] }) {
  const size = useSyncExternalStore(subscribeSubtitleSize, getSubtitleSize, () => "m" as SubtitleSize);
  const name = useId();
  return (
    <Block id="stats-settings-display" title={dict.title}>
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

function Language({ dict, lang }: { dict: SettingsDict["language"]; lang: Locale }) {
  return (
    <Block id="stats-settings-language" title={dict.title}>
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
              // The other language, on this same tab: the address names it, so she lands back here.
              <a className={styles.language} href={`/${locale}#${PANEL_IDS.settings}`} hrefLang={locale} lang={locale}>
                <span className={styles.languageCode} aria-hidden="true">
                  {locale}
                </span>
                {localeNames[locale]}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.note}>{dict.hint}</p>
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

function Controls({ dict }: { dict: SettingsDict["controls"] }) {
  const [action, keyboard, mouse, touch] = dict.columns;
  return (
    <Block id="stats-settings-controls" title={dict.title} className={styles.controlsBlock}>
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
          {dict.rows.map((row) => (
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
