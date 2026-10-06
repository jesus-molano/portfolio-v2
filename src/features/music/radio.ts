/**
 * The radio's shared state: what it is tuned to, which track is on air,
 * whether it plays and whether the wheel is open. One store for the page, outside React: the
 * music button, the wheel and the loading screen change it, and read it
 * with useSyncExternalStore. Calls that start sound run synchronously, so
 * one made in a click or key handler reaches `audio.play()` inside that
 * user gesture.
 */
import { PAUSE_IDLE, pauseStep } from "./pauseMix";
import { createPlayer, type Player } from "./player";
import {
  DEFAULT_STATION_ID,
  findStation,
  parseMemory,
  type RadioMemory,
  type StationId,
  type TuneId,
  wheelIndex,
} from "./stations";

/**
 * How the wheel was opened. `aim`: a held right button or Q; letting go
 * tunes to the station aimed at. `browse`: it stays open for a click, a
 * tap or the keyboard.
 */
export type WheelMode = "aim" | "browse";
export type WheelVia = "pointer" | "key" | "touch" | "button";
export type WheelState = {
  mode: WheelMode;
  via: WheelVia;
  /** Index in WHEEL of the station under the pointer or the focus. */
  selected: number;
};

export type RadioState = {
  tuned: TuneId;
  /** Sound was asked for and has not failed. */
  playing: boolean;
  /** The track on air: its index in the tuned station's playlist. */
  track: number;
  wheel: WheelState | null;
  /** Her volume, 0 to 1 (STATS's settings); 1 until she sets it. */
  volume: number;
};

const INITIAL: RadioState = { tuned: "off", playing: false, track: 0, wheel: null, volume: 1 };

/** The last station tuned to (never "off"), per visitor. */
const STATION_KEY = "va-station";
/** "off" once the visitor turned the radio off; the key the site always used. */
const MUSIC_KEY = "va-music";
/** Her volume, 0 to 1, as a decimal string. */
const VOLUME_KEY = "va-volume";

/** A stored volume, or full volume when it is missing or not a number from 0 to 1. */
export function parseVolume(value: string | null): number {
  if (value === null || value.trim() === "") return 1;
  const volume = Number(value);
  return Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 1;
}

/** Volume steps of 5 % (the settings' slider), so a stored value reads back the same. */
export function roundVolume(volume: number): number {
  return Math.round(Math.min(1, Math.max(0, volume)) * 20) / 20;
}

let state = INITIAL;
const listeners = new Set<() => void>();
let player: Player | null = null;
/** Where focus goes back to when the wheel closes. */
let opener: HTMLElement | null = null;

function update(next: Partial<RadioState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function getRadio(): RadioState {
  return state;
}

/** Server render and hydration: the radio is off and the wheel closed. */
export function getServerRadio(): RadioState {
  return INITIAL;
}

export function subscribeRadio(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readMemory(): RadioMemory {
  try {
    return parseMemory(localStorage.getItem(STATION_KEY), localStorage.getItem(MUSIC_KEY));
  } catch {
    return parseMemory(null, null);
  }
}

function remember(id: TuneId) {
  try {
    localStorage.setItem(MUSIC_KEY, id === "off" ? "off" : "on");
    if (id !== "off") localStorage.setItem(STATION_KEY, id);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

/** The pause menu: on screen or not, and when it last made a sound (pauseMix.ts). */
let pause = PAUSE_IDLE;

function ensurePlayer(): Player | null {
  if (player) return player;
  // Her volume, before the first note.
  restoreVolume();
  player = createPlayer(
    {
      onTrack(id, index) {
        if (state.tuned === id) update({ track: index });
      },
      onError(id) {
        if (state.tuned === id) update({ playing: false });
      },
    },
    { volume: state.volume },
  );
  player?.setPaused(pause.paused);
  if (player) {
    document.addEventListener("visibilitychange", () => player?.setHidden(document.hidden));
  }
  return player;
}

/**
 * Tunes the radio to a station, or off. Call it from a user gesture: the
 * browser only allows sound then. A station plays live, mid-song, unless
 * `fromTop` starts its playlist over. `save: false` leaves the visitor's
 * remembered choice alone; `crackle: false` skips the tuning static.
 */
export function tune(id: TuneId, { save = true, crackle = true, fromTop = false } = {}) {
  const station = id === "off" ? null : findStation(id);
  const tuned = station ? station.id : "off";
  if (save) remember(tuned);
  if (tuned === state.tuned && !fromTop && (tuned === "off" || state.playing)) return;
  update({ tuned, playing: station !== null });
  const radio = ensurePlayer();
  if (!radio) return;
  radio.tune(station, { crackle, fromTop }).catch(() => {
    // Blocked by the browser or the file failed: show the station as silent.
    if (state.tuned === tuned) update({ playing: false });
  });
}

/**
 * The station "enter with music" starts: the one the visitor last tuned
 * to, or the first time BABYLON (DEFAULT_STATION_ID). The loading screen's
 * button names it and `requestMusic` plays it, both from here, so they
 * never disagree.
 */
export function entryStation(memory: RadioMemory): StationId {
  return memory.station ?? DEFAULT_STATION_ID;
}

/**
 * The loading screen's choice: "enter with music" plays `entryStation`,
 * live; the first time, from the top of its first track. "Without" turns
 * the radio off.
 */
export function requestMusic(on: boolean) {
  if (!on) {
    tune("off", { crackle: false });
    return;
  }
  const memory = readMemory();
  tune(entryStation(memory), { fromTop: memory.station === null });
}

/** First gesture on a page without the loading screen: the remembered station, unless turned off. */
export function resumeRemembered() {
  const memory = readMemory();
  if (!memory.on || state.tuned !== "off") return;
  if (memory.station) tune(memory.station, { save: false, crackle: false });
  else tune(DEFAULT_STATION_ID, { save: false, crackle: false, fromTop: true });
}

/** Her volume as she left it, read back on the client: by the settings tab and before the first note. */
export function restoreVolume() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(VOLUME_KEY);
  } catch {
    // Blocked storage: full volume.
  }
  const volume = parseVolume(stored);
  if (volume !== state.volume) {
    update({ volume });
    player?.setVolume(volume);
  }
}

/** Sets her volume (0 to 1, in 5 % steps) and remembers it. */
export function setVolume(volume: number) {
  const next = roundVolume(volume);
  try {
    localStorage.setItem(VOLUME_KEY, String(next));
  } catch {
    // Blocked storage: the volume lasts for this page.
  }
  if (next === state.volume) return;
  update({ volume: next });
  player?.setVolume(next);
}

/**
 * The pause menu (STATS) arrives on screen (`on`) or leaves it
 * (StatsTabs.tsx). The radio goes behind it, muffled and ducked, and comes
 * back as she leaves, with a blip each way; all of it only while the radio
 * plays, the sound she chose: with the radio off the pause is silent. A
 * station tuned while the menu is up starts behind it. `quiet` lets the
 * music back out without a blip (the menu taken off the page, not left).
 */
export function setPauseMenu(on: boolean, { quiet = false } = {}) {
  const step = pauseStep(pause, on, performance.now());
  pause = step.state;
  if (!step.changed) return;
  player?.setPaused(on);
  if (step.blip && state.playing && !quiet) player?.blip(step.blip);
}

let volumeSettable: boolean | undefined;

/**
 * Whether this browser lets a page set an <audio>'s volume: iOS keeps it at
 * 1 and leaves the volume to the device's buttons. Probed once: the
 * settings read it on every render (useSyncExternalStore's snapshot).
 */
export function canSetVolume(): boolean {
  if (volumeSettable !== undefined) return volumeSettable;
  if (typeof Audio === "undefined") return false;
  try {
    const probe = new Audio();
    probe.volume = 0.5;
    volumeSettable = Math.abs(probe.volume - 0.5) < 0.01;
  } catch {
    volumeSettable = false;
  }
  return volumeSettable;
}

/**
 * Opens the wheel on the current station. `from` gets the focus back when
 * it closes; by default, whatever had the focus.
 */
export function openWheel(mode: WheelMode, via: WheelVia, from?: HTMLElement | null) {
  if (state.wheel) {
    update({ wheel: { ...state.wheel, mode, via } });
    return;
  }
  const active = document.activeElement;
  opener = from ?? (active instanceof HTMLElement && active !== document.body ? active : null);
  update({ wheel: { mode, via, selected: wheelIndex(state.tuned) } });
}

export function setWheelMode(mode: WheelMode) {
  if (state.wheel && state.wheel.mode !== mode) update({ wheel: { ...state.wheel, mode } });
}

export function selectStation(index: number) {
  if (state.wheel && state.wheel.selected !== index) update({ wheel: { ...state.wheel, selected: index } });
}

export function closeWheel() {
  if (state.wheel) update({ wheel: null });
}

/** The element that opened the wheel, once: it gets the focus back after it closes. */
export function takeOpener(): HTMLElement | null {
  const back = opener;
  opener = null;
  return back;
}
