/**
 * The radio, GTA style: genre stations, each a short playlist of licensed
 * instrumental tracks (public/music, LICENSE.txt there), and "radio off".
 * Every station is a nod to a film the narration quotes, or to the
 * setting; names stay as written in every language, taglines live in the
 * dictionaries (`radio.taglines`).
 *
 * A station without tracks is defined but stays off the wheel and out of
 * the credits: adding its first track (tools/audio/encode-track.sh, then
 * an entry in `tracks`) is all it takes to put it on air.
 *
 * Pure data and helpers: the store (radio.ts), the player (player.ts), the
 * wheel (RadioWheel.tsx) and the end credits (finale/EndCredits.tsx) read them.
 */
import type { RadioColor } from "@/design/tokens";

export type StationId = "k-calima" | "crockett" | "mr-wolf" | "leave-the-gun" | "love-daddy" | "babylon";

/** What the radio can be tuned to: a station, or off. */
export type TuneId = StationId | "off";

/** Which typographic logo the wheel draws for an entry (StationLogo.tsx). */
export type LogoStyle = "calima" | "crockett" | "wolf" | "deli" | "boombox" | "babylon" | "power";

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

const macleod = (title: string, sourceUrl: string): Credit => ({
  title,
  artist: "Kevin MacLeod",
  artistSite: "incompetech.com",
  sourceUrl,
  licence: "CC BY 4.0",
  licenceUrl: LICENCE_URLS["CC BY 4.0"],
});
const incompetech = (isrc: string) => `https://incompetech.com/music/royalty-free/index.html?isrc=${isrc}`;
const cc0 = (title: string, artist: string, sourceUrl: string): Credit => ({
  title,
  artist,
  sourceUrl,
  licence: "CC0 1.0",
  licenceUrl: LICENCE_URLS["CC0 1.0"],
});
const holizna = (title: string, sourceUrl: string): Credit => cc0(title, "HoliznaCC0", sourceUrl);
const pixabay = (title: string, artist: string, sourceUrl: string): Credit => ({
  title,
  artist,
  sourceUrl,
  licence: "Pixabay",
  licenceUrl: LICENCE_URLS.Pixabay,
});

/** In frequency order: clockwise around the wheel from radio off. */
export const STATIONS: readonly Station[] = [
  {
    // Classic and garage rock. Reservoir Dogs' K-Billy "Super Sounds of the
    // Seventies", and the calima: the warm Saharan haze over the Canaries.
    id: "k-calima",
    name: "K-CALIMA",
    frequency: 87.9,
    accent: "calima",
    logo: "calima",
    tracks: [
      {
        url: "/music/classic.mp3",
        duration: 148.21,
        credit: holizna("Classic", "https://freemusicarchive.org/music/holiznacc0/rock-montage/classic/"),
      },
      {
        url: "/music/plastic-sunrise.mp3",
        duration: 86.7,
        credit: pixabay(
          "Plastic Sunrise",
          "cinematic-soul",
          "https://pixabay.com/music/rock-background-rock-music-plastic-sunrise-587089/",
        ),
      },
      {
        url: "/music/gearhead.mp3",
        duration: 134.78,
        credit: macleod("Gearhead", "https://incompetech.filmmusic.io/song/3799-gearhead"),
      },
    ],
  },
  {
    // 80s synth. Sonny Crockett, Miami Vice: loafers, no socks.
    id: "crockett",
    name: "CROCKETT",
    frequency: 91.4,
    accent: "crockett",
    logo: "crockett",
    tracks: [
      { url: "/music/newer-wave.mp3", duration: 171.38, credit: macleod("Newer Wave", incompetech("USUAN2000024")) },
      {
        url: "/music/miami-nights.mp3",
        duration: 147.29,
        credit: macleod("Miami Nights - Extended Theme", incompetech("USUAN1700078")),
      },
      {
        url: "/music/nostalgia.mp3",
        duration: 85.85,
        credit: pixabay("Nostalgia", "alex-morgan", "https://pixabay.com/music/nostalgia-nostalgia-591320/"),
      },
      {
        url: "/music/neon-laser-horizon.mp3",
        duration: 162.65,
        credit: macleod("Neon Laser Horizon", incompetech("USUAN2000023")),
      },
      {
        url: "/music/retro-synths.mp3",
        duration: 185.85,
        credit: holizna("Retro Synths", "https://freemusicarchive.org/music/holiznacc0/power-pop/retro-synths/"),
      },
    ],
  },
  {
    // Hard rock. Pulp Fiction's Winston Wolf: "I solve problems", quoted in the hero.
    id: "mr-wolf",
    name: "MR. WOLF",
    frequency: 94.7,
    accent: "wolf",
    logo: "wolf",
    tracks: [
      {
        url: "/music/rock.mp3",
        duration: 117.78,
        credit: pixabay("Rock", "paulyudin", "https://pixabay.com/music/hard-rock-rock-490391/"),
      },
      { url: "/music/big-rock.mp3", duration: 224.42, credit: macleod("Big Rock", incompetech("USUAN1100305")) },
      { url: "/music/hotrock.mp3", duration: 201.99, credit: macleod("Hotrock", incompetech("USUAN1100201")) },
      {
        url: "/music/ready-aim-fire.mp3",
        duration: 212.12,
        credit: macleod("Ready Aim Fire", incompetech("USUAN1500002")),
      },
    ],
  },
  {
    // Funk. The Godfather: "Leave the gun. Take the cannoli."
    id: "leave-the-gun",
    name: "LEAVE THE GUN",
    frequency: 99.2,
    accent: "gun",
    logo: "deli",
    tracks: [
      {
        url: "/music/joyful-rhythm-walk.mp3",
        duration: 133.85,
        credit: pixabay(
          "Joyful Rhythm Walk Funk",
          "lightbeatsmusic",
          "https://pixabay.com/music/funk-joyful-rhythm-walk-funk-513936/",
        ),
      },
      {
        url: "/music/funk.mp3",
        duration: 126.1,
        credit: pixabay("Funk", "prettyjohn1", "https://pixabay.com/music/funk-funk-503900/"),
      },
      {
        url: "/music/retrofuture-nasty.mp3",
        duration: 202.21,
        credit: macleod("RetroFuture Nasty", incompetech("USUAN1200042")),
      },
    ],
  },
  {
    // 90s hip-hop beats. Mister Señor Love Daddy, the DJ of Do the Right Thing.
    id: "love-daddy",
    name: "LOVE DADDY",
    frequency: 102.5,
    accent: "daddy",
    logo: "boombox",
    tracks: [
      {
        url: "/music/old-school-groove.mp3",
        duration: 127.12,
        credit: pixabay(
          "Boom Bap Old School Groove",
          "alex-morgan",
          "https://pixabay.com/music/electronic-boom-bap-old-school-groove-573879/",
        ),
      },
      { url: "/music/griphop.mp3", duration: 203.73, credit: macleod("Griphop", incompetech("USUAN1100413")) },
      {
        url: "/music/boom-bap.mp3",
        duration: 151.74,
        credit: pixabay("Boom Bap", "soundsurfer", "https://pixabay.com/music/old-school-hip-hop-boom-bap-592994/"),
      },
      {
        url: "/music/basic-implosion.mp3",
        duration: 184.89,
        credit: macleod("Basic Implosion", incompetech("USUAN1600032")),
      },
    ],
  },
  {
    // Disco and boogie. The Babylon Club in Scarface.
    id: "babylon",
    name: "BABYLON",
    frequency: 105.1,
    accent: "babylon",
    logo: "babylon",
    tracks: [
      {
        url: "/music/disco-music.mp3",
        duration: 123.81,
        credit: pixabay("Disco Music", "paulyudin", "https://pixabay.com/music/disco-disco-disco-music-595944/"),
      },
      {
        url: "/music/disco-con-tutti.mp3",
        duration: 218.99,
        credit: macleod("Disco con Tutti", incompetech("USUAN1200091")),
      },
      {
        url: "/music/disco.mp3",
        duration: 94.48,
        credit: pixabay("Disco", "atlasaudio", "https://pixabay.com/music/disco-disco-518074/"),
      },
      {
        url: "/music/gotta-keep-on-movin.mp3",
        duration: 131.53,
        // FreePD (freepd.com) published it; the link is the composer's own page for the track.
        credit: cc0(
          "Gotta Keep On Movin'",
          "Bryan Teoh",
          "https://bryan-teoh.squarespace.com/sleepfacingwest/2020/9/16/gl038-gotta-keep-on-movin",
        ),
      },
      {
        url: "/music/nu-disco.mp3",
        duration: 148.07,
        credit: pixabay("Nu Disco", "aurec", "https://pixabay.com/music/disco-nu-disco-590512/"),
      },
    ],
  },
];

export const OFF: OffEntry = { id: "off", accent: "off", logo: "power" };

/** The station "enter with music" plays the first time, from its first track. */
export const DEFAULT_STATION_ID: StationId = "babylon";

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

/** "87.9" */
export function formatFrequency(frequency: number): string {
  return frequency.toFixed(1);
}

/**
 * Joins phrases into what a screen reader says, one sentence each: a full
 * stop between them unless the phrase already ends in one ("Wake up! Wake
 * up!" stays as written, not "Wake up!.").
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
