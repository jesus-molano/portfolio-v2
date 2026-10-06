/**
 * The radio, GTA style: genre stations, each a short playlist of licensed
 * tracks, instrumental or sung (public/music, LICENSE.txt there), and
 * "radio off". Every station is a nod to a film; names stay as written in
 * every language, taglines live in the dictionaries (`radio.taglines`).
 *
 * A station without tracks is defined but stays off the wheel and out of
 * the credits: adding its first track (tools/audio/encode-track.sh, then
 * an entry in `tracks`) is all it takes to put it on air.
 *
 * Pure data and helpers: the store (radio.ts), the player (player.ts), the
 * wheel (RadioWheel.tsx) and the end credits (finale/EndCredits.tsx) read them.
 */
import type { RadioColor } from "@/design/tokens";

export type StationId = "bobsled" | "raheem" | "manero" | "one-louder" | "witness-me" | "tofu";

/** What the radio can be tuned to: a station, or off. */
export type TuneId = StationId | "off";

/** Which typographic logo the wheel draws for an entry (StationLogo.tsx). */
export type LogoStyle = "bobsled" | "raheem" | "manero" | "louder" | "witness" | "tofu" | "power";

export type Licence = "CC BY 4.0" | "CC0 1.0" | "Pixabay";

export type Credit = {
  title: string;
  artist: string;
  /** Shown after the artist, as the author asks: "Kevin MacLeod (incompetech.com)". */
  artistSite?: string;
  /** The track's own page. */
  sourceUrl: string;
  licence: Licence;
  licenceUrl: string;
};

export type Track = {
  /** "/music/<slug>.mp3" */
  url: string;
  /**
   * Seconds, of the encoded file (encode-track.sh prints it): places the
   * broadcast in the playlist before any file loads.
   */
  duration: number;
  credit: Credit;
};

export type Station = {
  id: StationId;
  name: string;
  /** MHz, FM. */
  frequency: number;
  /** Token key in `radio` (design/tokens.ts): `--va-radio-<accent>`. */
  accent: RadioColor;
  logo: LogoStyle;
  /** Played in order, then again from the first. Empty: not on air yet. */
  tracks: readonly Track[];
};

/** Radio off. Its name is the dictionary's `radio.off`. */
export type OffEntry = {
  id: "off";
  accent: RadioColor;
  logo: "power";
};

export type WheelEntry = Station | OffEntry;

export const LICENCE_URLS: Record<Licence, string> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  Pixabay: "https://pixabay.com/service/terms/",
};

/*
 * Credit builders for a new track, in each author's own format (the
 * stations on air today are all Pixabay; the others stay for the next one).
 */
export const macleod = (title: string, sourceUrl: string): Credit => ({
  title,
  artist: "Kevin MacLeod",
  artistSite: "incompetech.com",
  sourceUrl,
  licence: "CC BY 4.0",
  licenceUrl: LICENCE_URLS["CC BY 4.0"],
});
export const incompetech = (isrc: string) => `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`;
export const cc0 = (title: string, artist: string, sourceUrl: string): Credit => ({
  title,
  artist,
  sourceUrl,
  licence: "CC0 1.0",
  licenceUrl: LICENCE_URLS["CC0 1.0"],
});
export const holizna = (title: string, sourceUrl: string): Credit => cc0(title, "HoliznaCC0", sourceUrl);
export const pixabay = (title: string, artist: string, sourceUrl: string): Credit => ({
  title,
  artist,
  sourceUrl,
  licence: "Pixabay",
  licenceUrl: LICENCE_URLS.Pixabay,
});

/** In frequency order: clockwise around the wheel from radio off. */
export const STATIONS: readonly Station[] = [
  {
    // Reggae. Cool Runnings: the Jamaican bobsleigh team's "feel the rhythm,
    // feel the rhyme".
    id: "bobsled",
    name: "BOBSLED",
    frequency: 88.3,
    accent: "bobsled",
    logo: "bobsled",
    tracks: [
      {
        url: "/music/reggae-island-vibes.mp3",
        duration: 171.77,
        credit: pixabay("Reggae Island Vibes", "alex-morgan", "https://pixabay.com/music/reggae-reggae-island-vibes-537451/"),
      },
      {
        url: "/music/rasta-vibes.mp3",
        duration: 226.02,
        credit: pixabay("Rasta Vibes", "theboysbeats", "https://pixabay.com/music/reggae-the-boy-s-beats-bob-marley-tribute-rasta-vibes-282399/"),
      },
      {
        url: "/music/dont-worry-about-a-thing.mp3",
        duration: 222.63,
        credit: pixabay("Don't Worry About a Thing", "theboysbeats", "https://pixabay.com/music/reggae-the-boy-s-beats-bob-marley-tribute-dont-worry-about-a-thing-282396/"),
      },
    ],
  },
  {
    // Hip-hop beats. Do the Right Thing: Radio Raheem, his boombox and its
    // twenty D batteries.
    id: "raheem",
    name: "RAHEEM",
    frequency: 92.9,
    accent: "raheem",
    logo: "raheem",
    tracks: [
      {
        url: "/music/west-coast-beat.mp3",
        duration: 167.61,
        credit: pixabay("West Coast Beat", "sunset", "https://pixabay.com/music/beats-west-coast-beat-571783/"),
      },
      {
        url: "/music/miraculous.mp3",
        duration: 190.55,
        credit: pixabay("Miraculous", "YellowBirdBeats", "https://pixabay.com/music/beats-west-coast-x-gangsta-x-dr-dre-x-old-school-miraculous-292172/"),
      },
      {
        url: "/music/vlog-music-background.mp3",
        duration: 70.61,
        credit: pixabay("Vlog Vlogs Music Background", "sigmamusicart", "https://pixabay.com/music/beats-vlog-vlogs-music-background-368632/"),
      },
    ],
  },
  {
    // Disco and funk. Saturday Night Fever: Tony Manero, ".7" for '77, and
    // "watch the hair".
    id: "manero",
    name: "MANERO",
    frequency: 97.7,
    accent: "manero",
    logo: "manero",
    tracks: [
      {
        url: "/music/honeyed-sunbeams.mp3",
        duration: 124.98,
        credit: pixabay("Honeyed Sunbeams", "9jackjack8", "https://pixabay.com/music/dance-honeyed-sunbeams-disco-funk-music-455872/"),
      },
      {
        url: "/music/funky-disco.mp3",
        duration: 102.66,
        credit: pixabay("Funky Disco", "nesterouk", "https://pixabay.com/music/funk-funky-disco-155292/"),
      },
      {
        url: "/music/afrobeat-disco.mp3",
        duration: 173.92,
        credit: pixabay("Afrobeat Disco", "arnaud136", "https://pixabay.com/music/afrobeat-afrobeat-disco-352032/"),
      },
      {
        url: "/music/funk-music.mp3",
        duration: 110.2,
        credit: pixabay("Funk Music", "sigmamusicart", "https://pixabay.com/music/funk-funk-funk-music-157134/"),
      },
      {
        url: "/music/celebrity.mp3",
        duration: 125.88,
        credit: pixabay("Celebrity", "mickeyscat", "https://pixabay.com/music/funk-celebrity-614075/"),
      },
    ],
  },
  {
    // Metal. This Is Spinal Tap: "these go to eleven", one louder; 101.1 is
    // all ones.
    id: "one-louder",
    name: "ONE LOUDER",
    frequency: 101.1,
    accent: "louder",
    logo: "louder",
    tracks: [
      {
        url: "/music/sound-of-metal-3.mp3",
        duration: 205.26,
        credit: pixabay("The Sound of Metal 3", "chrispixer", "https://pixabay.com/music/metal-the-sound-of-metal-3-224768/"),
      },
      {
        url: "/music/sound-of-metal-4.mp3",
        duration: 161.96,
        credit: pixabay("The Sound of Metal 4", "chrispixer", "https://pixabay.com/music/metal-the-sound-of-metal-4-224767/"),
      },
      {
        url: "/music/thrash-metal.mp3",
        duration: 180.66,
        credit: pixabay("Thrash Metal", "alex-morgan", "https://pixabay.com/music/metal-thrash-metal-591343/"),
      },
    ],
  },
  {
    // Rock and punk. Mad Max: Fury Road, the War Boys' cry, "shiny and chrome".
    id: "witness-me",
    name: "WITNESS ME",
    frequency: 104.5,
    accent: "witness",
    logo: "witness",
    tracks: [
      {
        url: "/music/nastelbom-rock.mp3",
        duration: 101.65,
        credit: pixabay("Rock", "nastelbom", "https://pixabay.com/music/rock-rock-501708/"),
      },
      {
        url: "/music/punk-rock-heatwave.mp3",
        duration: 135.02,
        credit: pixabay("Heatwave", "vibemode", "https://pixabay.com/music/rock-punk-rock-heatwave-545931/"),
      },
      {
        url: "/music/punk-rock-rebellion.mp3",
        duration: 108.14,
        credit: pixabay("Punk Rock Rebellion Fast Energy", "echoes_of_lumen", "https://pixabay.com/music/rock-punk-rock-rebellion-fast-energy-589273/"),
      },
      {
        url: "/music/punk-rock.mp3",
        duration: 112.54,
        credit: pixabay("Punk Rock", "alexgrohl", "https://pixabay.com/music/rock-punk-rock-478794/"),
      },
    ],
  },
  {
    // Drift phonk. Initial D: the tofu delivered down the mountain before dawn.
    id: "tofu",
    name: "TOFU",
    frequency: 107.6,
    accent: "tofu",
    logo: "tofu",
    tracks: [
      {
        url: "/music/walk-of-dr-livesey.mp3",
        duration: 92.95,
        credit: pixabay("Walk of Dr. Livesey", "sigmamusicart", "https://pixabay.com/music/upbeat-phonk-walk-of-dr-livesey-258266/"),
      },
      {
        url: "/music/phonk.mp3",
        duration: 87.62,
        credit: pixabay("Phonk", "sigmamusicart", "https://pixabay.com/music/upbeat-phonk-253422/"),
      },
    ],
  },
];

export const OFF: OffEntry = { id: "off", accent: "off", logo: "power" };

/** The station "enter with music" plays the first time, from its first track. */
export const DEFAULT_STATION_ID: StationId = "manero";

/** Where the wheel's first entry (radio off) sits: degrees clockwise from 12 o'clock, so the bottom. */
export const WHEEL_START = 180;

/** The stations on air: those with at least one track. */
export function visibleStations(stations: readonly Station[] = STATIONS): Station[] {
  return stations.filter((station) => station.tracks.length > 0);
}

/** Around the wheel, clockwise from the bottom: radio off, then the stations on air by frequency. */
export function wheelEntries(stations: readonly Station[] = STATIONS): WheelEntry[] {
  return [OFF, ...visibleStations(stations)];
}

export const WHEEL: readonly WheelEntry[] = wheelEntries();

export function isStation(entry: WheelEntry): entry is Station {
  return entry.id !== "off";
}

/** A station on air (it has tracks), by id. */
export function findStation(id: unknown, stations: readonly Station[] = STATIONS): Station | null {
  return visibleStations(stations).find((station) => station.id === id) ?? null;
}

export function isTuneId(value: unknown): value is TuneId {
  return value === "off" || findStation(value) !== null;
}

export function findEntry(id: TuneId, wheel: readonly WheelEntry[] = WHEEL): WheelEntry {
  return wheel.find((entry) => entry.id === id) ?? OFF;
}

export function wheelIndex(id: TuneId, wheel: readonly WheelEntry[] = WHEEL): number {
  return Math.max(0, wheel.findIndex((entry) => entry.id === id));
}

/** "88.3" */
export function formatFrequency(frequency: number): string {
  return frequency.toFixed(1);
}

/**
 * Joins phrases into what a screen reader says, one sentence each: a full
 * stop between them unless the phrase already ends in one ("Ours goes to
 * eleven." stays as written, not "Ours goes to eleven..").
 */
export function joinSentences(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, i, all) => (i < all.length - 1 && !/[.!?…]$/.test(part) ? `${part}.` : part))
    .join(" ");
}

function wrapDegrees(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Centre of sector `index`, in degrees clockwise from 12 o'clock. */
export function sectorCentre(index: number, count: number, start = WHEEL_START): number {
  return wrapDegrees(start + (index * 360) / count);
}

/**
 * Direction of a screen vector (x right, y down) in degrees clockwise from
 * 12 o'clock, in [0, 360).
 */
export function angleOf(dx: number, dy: number): number {
  return wrapDegrees((Math.atan2(dx, -dy) * 180) / Math.PI);
}

/** The sector of `count` around a wheel whose sector 0 is centred on `start`. */
export function sectorAt(angle: number, count: number, start = WHEEL_START): number {
  const step = 360 / count;
  return Math.floor(wrapDegrees(angle - start + step / 2) / step) % count;
}

/**
 * The sector a pointer aims at, from where the aim started: null inside the
 * dead zone, so a press and release without moving picks nothing.
 */
export function aimedSector(
  dx: number,
  dy: number,
  count: number,
  deadZone: number,
  start = WHEEL_START,
): number | null {
  if (Math.hypot(dx, dy) <= deadZone) return null;
  return sectorAt(angleOf(dx, dy), count, start);
}

/**
 * A virtual stick: the aim origin trails the pointer so the aim never
 * reaches further than `reach`. Turning back toward another sector then
 * takes a short move, however far the pointer went first.
 */
export function trailOrigin(
  origin: { x: number; y: number },
  pointer: { x: number; y: number },
  reach: number,
): { x: number; y: number } {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length <= reach) return origin;
  const k = (length - reach) / length;
  return { x: origin.x + dx * k, y: origin.y + dy * k };
}

/** Index `delta` steps around a wheel of `count`, wrapping both ways. */
export function stepIndex(index: number, delta: number, count: number): number {
  return (((index + delta) % count) + count) % count;
}

/** The next entry clockwise (arrow right or down). */
export function nextIndex(index: number, count: number): number {
  return stepIndex(index, 1, count);
}

/** The previous entry (arrow left or up). */
export function previousIndex(index: number, count: number): number {
  return stepIndex(index, -1, count);
}

/** The track after `index` in a playlist of `count`: the first again after the last. */
export function nextTrack(index: number, count: number): number {
  return count > 0 ? stepIndex(index, 1, count) : 0;
}

/**
 * Where a looping broadcast of `duration` seconds is `nowSeconds` after it
 * started, in [0, duration): every visitor hears the same broadcast, as if
 * it had been on air all along.
 */
export function liveOffset(nowSeconds: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(nowSeconds)) return 0;
  return ((nowSeconds % duration) + duration) % duration;
}

/** Seconds of the whole playlist, once through. */
export function playlistLength(tracks: readonly Pick<Track, "duration">[]): number {
  return tracks.reduce((sum, track) => sum + (track.duration > 0 ? track.duration : 0), 0);
}

export type BroadcastPosition = {
  /** The track on air. */
  index: number;
  /** Seconds into it. */
  offset: number;
};

/**
 * Which track a station is playing `elapsed` seconds after its broadcast
 * started, and how far into it: tuning in lands mid-song, like GTA. The
 * playlist loops; a station without tracks (or durations) sits at 0:00 of
 * its first.
 */
export function livePosition(tracks: readonly Pick<Track, "duration">[], elapsed: number): BroadcastPosition {
  let offset = liveOffset(elapsed, playlistLength(tracks));
  for (let index = 0; index < tracks.length; index++) {
    const duration = tracks[index].duration > 0 ? tracks[index].duration : 0;
    if (offset < duration) return { index, offset };
    offset -= duration;
  }
  return { index: 0, offset: 0 };
}

export type RadioMemory = {
  /** The last station the visitor tuned to, if it is still on air; null the first time. */
  station: StationId | null;
  /** False once the visitor turned the radio off (radio off or "without music"). */
  on: boolean;
};

/**
 * Reads what this visitor chose before, from the raw stored values (null
 * when absent or unreadable). `music` is "on" or "off"; anything else
 * counts as on, as it did before the radio had stations.
 */
export function parseMemory(
  station: string | null,
  music: string | null,
  stations: readonly Station[] = STATIONS,
): RadioMemory {
  return { station: findStation(station, stations)?.id ?? null, on: music !== "off" };
}

/** The credits of every track on air, by station, for the credits section. */
export function stationCredits(stations: readonly Station[] = STATIONS): { station: Station; credits: Credit[] }[] {
  return visibleStations(stations).map((station) => ({
    station,
    credits: station.tracks.map((track) => track.credit),
  }));
}
