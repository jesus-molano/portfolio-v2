/**
 * The radio's shared state: what it is tuned to, which track is on air,
 * whether it plays and whether the wheel is open. One store for the page, outside React: the
 * music button, the wheel and the loading screen change it, and read it
 * with useSyncExternalStore. Calls that start sound run synchronously, so
 * one made in a click or key handler reaches `audio.play()` inside that
 * user gesture.
 */
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
};

const INITIAL: RadioState = { tuned: "off", playing: false, track: 0, wheel: null };

/** The last station tuned to (never "off"), per visitor. */
const STATION_KEY = "va-station";
/** "off" once the visitor turned the radio off; the key the site always used. */
const MUSIC_KEY = "va-music";

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

function ensurePlayer(): Player | null {
  if (player) return player;
  player = createPlayer({
    onTrack(id, index) {
      if (state.tuned === id) update({ track: index });
    },
    onError(id) {
      if (state.tuned === id) update({ playing: false });
    },
  });
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
