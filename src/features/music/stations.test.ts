import { describe, expect, it } from "vitest";
import {
  aimedSector,
  angleOf,
  DEFAULT_STATION_ID,
  findEntry,
  findStation,
  formatFrequency,
  isTuneId,
  joinSentences,
  LICENCE_URLS,
  liveOffset,
  livePosition,
  nextIndex,
  nextTrack,
  parseMemory,
  playlistLength,
  previousIndex,
  type Station,
  stationCredits,
  STATIONS,
  sectorAt,
  sectorCentre,
  stepIndex,
  trailOrigin,
  visibleStations,
  WHEEL,
  WHEEL_START,
  wheelEntries,
  wheelIndex,
} from "./stations";

/** The lineup with these stations taken off air (no tracks yet). */
function withoutTracks(...ids: Station["id"][]): Station[] {
  return STATIONS.map((entry) => (ids.includes(entry.id) ? { ...entry, tracks: [] } : entry));
}

/** A station with tracks of these durations. */
function station(id: Station["id"], durations: number[]): Station {
  return {
    ...STATIONS.find((entry) => entry.id === id)!,
    tracks: durations.map((duration, i) => ({
      url: `/music/${id}-${i}.mp3`,
      duration,
      credit: { title: `T${i}`, artist: "A", sourceUrl: "https://example.com", licence: "CC0 1.0", licenceUrl: "" },
    })),
  };
}

describe("the lineup", () => {
  it("has six genre stations by frequency, K-CALIMA first", () => {
    expect(STATIONS.map((entry) => entry.name)).toEqual([
      "K-CALIMA",
      "CROCKETT",
      "MR. WOLF",
      "LEAVE THE GUN",
      "LOVE DADDY",
      "BABYLON",
    ]);
    const frequencies = STATIONS.map((entry) => entry.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => a - b));
    expect(new Set(STATIONS.map((entry) => entry.accent)).size).toBe(STATIONS.length);
  });

  it("defaults to BABYLON 105.1, whose playlist opens with Disco Music", () => {
    expect(DEFAULT_STATION_ID).toBe("babylon");
    const babylon = findStation(DEFAULT_STATION_ID)!;
    expect(formatFrequency(babylon.frequency)).toBe("105.1");
    expect(babylon.tracks[0].credit.title).toBe("Disco Music");
    expect(babylon.tracks[0].url).toBe("/music/disco-music.mp3");
  });

  it("gives every track its own file, a measured duration and a full credit", () => {
    const tracks = STATIONS.flatMap((entry) => entry.tracks);
    expect(new Set(tracks.map((track) => track.url)).size).toBe(tracks.length);
    for (const { url, duration, credit } of tracks) {
      expect(url).toMatch(/^\/music\/[a-z0-9-]+\.mp3$/);
      // Cut to about 3:45 at most.
      expect(duration).toBeGreaterThan(60);
      expect(duration).toBeLessThanOrEqual(230);
      expect(credit.title && credit.artist && credit.sourceUrl).toBeTruthy();
      expect(credit.licenceUrl).toBe(LICENCE_URLS[credit.licence]);
    }
  });

  it("plays the playlists agreed with the owner, in order", () => {
    const playlists = Object.fromEntries(
      STATIONS.map((entry) => [entry.id, entry.tracks.map((track) => track.credit.title)]),
    );
    expect(playlists).toEqual({
      "k-calima": ["Classic", "Plastic Sunrise", "Gearhead"],
      crockett: ["Newer Wave", "Miami Nights - Extended Theme", "Nostalgia", "Neon Laser Horizon", "Retro Synths"],
      "mr-wolf": ["Rock", "Big Rock", "Hotrock", "Ready Aim Fire"],
      "leave-the-gun": ["Joyful Rhythm Walk Funk", "Funk", "RetroFuture Nasty"],
      "love-daddy": ["Boom Bap Old School Groove", "Griphop", "Boom Bap", "Basic Implosion"],
      babylon: ["Disco Music", "Disco con Tutti", "Disco", "Gotta Keep On Movin'", "Nu Disco"],
    });
  });

  it("names Kevin MacLeod's site, as his CC BY credit asks", () => {
    for (const credit of STATIONS.flatMap((entry) => entry.tracks.map((track) => track.credit))) {
      if (credit.artist === "Kevin MacLeod") {
        expect(credit.artistSite).toBe("incompetech.com");
        expect(credit.licence).toBe("CC BY 4.0");
      }
    }
  });
});

describe("visibleStations", () => {
  it("puts all six stations on air, each with a playlist", () => {
    expect(visibleStations().map((entry) => entry.id)).toEqual([
      "k-calima",
      "crockett",
      "mr-wolf",
      "leave-the-gun",
      "love-daddy",
      "babylon",
    ]);
  });

  it("keeps a station without tracks off the air", () => {
    const lineup = withoutTracks("love-daddy", "babylon");
    expect(visibleStations(lineup).map((entry) => entry.id)).toEqual([
      "k-calima",
      "crockett",
      "mr-wolf",
      "leave-the-gun",
    ]);
    expect(findStation("babylon", lineup)).toBeNull();
  });

  it("puts a station on air as soon as it has a track", () => {
    const lineup = withoutTracks("love-daddy").map((entry) =>
      entry.id === "love-daddy" ? station("love-daddy", [180]) : entry,
    );
    expect(findStation("love-daddy", withoutTracks("love-daddy"))).toBeNull();
    expect(findStation("love-daddy", lineup)?.name).toBe("LOVE DADDY");
  });
});

describe("the wheel", () => {
  it("puts radio off at the bottom and the stations on air clockwise by frequency", () => {
    expect(WHEEL[0].id).toBe("off");
    expect(sectorCentre(0, WHEEL.length)).toBe(180);
    expect(WHEEL.slice(1)).toEqual(visibleStations());
    expect(WHEEL).toHaveLength(7);
  });

  it("closes up when a station goes off air", () => {
    const wheel = wheelEntries(withoutTracks("love-daddy", "babylon"));
    expect(wheel.map((entry) => entry.id)).toEqual(["off", "k-calima", "crockett", "mr-wolf", "leave-the-gun"]);
    expect(wheel[sectorAt(angleOf(1, 1), wheel.length)].id).toBe("leave-the-gun");
  });

  it("finds entries and indices, and falls back to radio off", () => {
    expect(wheelIndex("off")).toBe(0);
    expect(wheelIndex("leave-the-gun")).toBe(4);
    expect(wheelIndex("babylon")).toBe(6);
    const short = wheelEntries(withoutTracks("babylon"));
    expect(wheelIndex("babylon", short)).toBe(0);
    expect(findEntry("babylon", short).id).toBe("off");
    expect(isTuneId("mr-wolf")).toBe(true);
    expect(isTuneId("babylon")).toBe(true);
    expect(isTuneId("off")).toBe(true);
    expect(isTuneId("omerta")).toBe(false);
    expect(isTuneId("flash-fm")).toBe(false);
    expect(isTuneId(null)).toBe(false);
  });
});

describe("angleOf", () => {
  it("measures clockwise from 12 o'clock in screen coordinates", () => {
    expect(angleOf(0, -1)).toBe(0);
    expect(angleOf(1, 0)).toBe(90);
    expect(angleOf(0, 1)).toBe(180);
    expect(angleOf(-1, 0)).toBe(270);
    expect(angleOf(1, -1)).toBeCloseTo(45, 10);
  });
});

describe("sectorAt", () => {
  it("returns the sector whose centre is nearest", () => {
    // Four sectors with sector 0 at the top.
    expect(sectorAt(0, 4, 0)).toBe(0);
    expect(sectorAt(44, 4, 0)).toBe(0);
    expect(sectorAt(46, 4, 0)).toBe(1);
    expect(sectorAt(180, 4, 0)).toBe(2);
    expect(sectorAt(316, 4, 0)).toBe(0);
    expect(sectorAt(-30, 4, 0)).toBe(0);
    expect(sectorAt(720 + 90, 4, 0)).toBe(1);
  });

  it("maps every sector centre back to its sector, for any number of entries", () => {
    for (const count of [2, 3, 5, 7, 9]) {
      for (let i = 0; i < count; i++) expect(sectorAt(sectorCentre(i, count), count)).toBe(i);
    }
  });

  it("reads the radio wheel like a dial: off below, 87.9 lower left, the top station lower right", () => {
    const count = WHEEL.length;
    expect(WHEEL[sectorAt(180, count)].id).toBe("off");
    expect(WHEEL[sectorAt(angleOf(-1, 1), count)].id).toBe("k-calima");
    expect(WHEEL[sectorAt(angleOf(1, 1), count)].id).toBe("babylon");
    expect(WHEEL_START).toBe(180);
  });
});

describe("aimedSector", () => {
  it("picks nothing inside the dead zone", () => {
    expect(aimedSector(0, 0, 5, 24)).toBeNull();
    expect(aimedSector(10, -10, 5, 24)).toBeNull();
  });

  it("picks the sector the pointer moved toward beyond the dead zone", () => {
    expect(WHEEL[aimedSector(0, 80, WHEEL.length, 24)!].id).toBe("off");
    expect(WHEEL[aimedSector(-80, 0, WHEEL.length, 24)!].id).toBe("crockett");
    expect(WHEEL[aimedSector(-20, -80, WHEEL.length, 24)!].id).toBe("mr-wolf");
    expect(WHEEL[aimedSector(20, -80, WHEEL.length, 24)!].id).toBe("leave-the-gun");
    expect(WHEEL[aimedSector(80, 0, WHEEL.length, 24)!].id).toBe("love-daddy");
  });
});

describe("trailOrigin", () => {
  it("keeps the origin while the pointer stays within reach", () => {
    const origin = { x: 10, y: 10 };
    expect(trailOrigin(origin, { x: 40, y: 10 }, 50)).toBe(origin);
  });

  it("drags the origin so the aim never reaches further than `reach`", () => {
    const next = trailOrigin({ x: 0, y: 0 }, { x: 300, y: 0 }, 100);
    expect(next.x).toBeCloseTo(200, 10);
    expect(next.y).toBeCloseTo(0, 10);
    const diagonal = trailOrigin({ x: 0, y: 0 }, { x: 300, y: 400 }, 100);
    expect(Math.hypot(300 - diagonal.x, 400 - diagonal.y)).toBeCloseTo(100, 10);
  });
});

describe("next and previous", () => {
  it("wraps both ways around the wheel, for the keyboard", () => {
    expect(nextIndex(4, 5)).toBe(0);
    expect(previousIndex(0, 5)).toBe(4);
    expect(nextIndex(2, 7)).toBe(3);
    expect(previousIndex(0, 7)).toBe(6);
    expect(stepIndex(1, -10, 7)).toBe(5);
  });

  it("plays the playlist in order and starts again after the last track", () => {
    expect(nextTrack(0, 3)).toBe(1);
    expect(nextTrack(2, 3)).toBe(0);
    expect(nextTrack(0, 1)).toBe(0);
    expect(nextTrack(0, 0)).toBe(0);
  });
});

describe("liveOffset", () => {
  it("is where a broadcast that started at the epoch would be now", () => {
    expect(liveOffset(0, 120)).toBe(0);
    expect(liveOffset(125, 120)).toBe(5);
    expect(liveOffset(1_760_000_000.5, 149.24)).toBeCloseTo(1_760_000_000.5 % 149.24, 6);
  });

  it("stays in [0, duration) for any time, before the epoch too", () => {
    for (const now of [-1, -500.25, 0.001, 1e10]) {
      const offset = liveOffset(now, 201.64);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(201.64);
    }
  });

  it("starts at 0:00 when the duration is unknown", () => {
    expect(liveOffset(1000, 0)).toBe(0);
    expect(liveOffset(1000, Number.NaN)).toBe(0);
    expect(liveOffset(1000, Number.POSITIVE_INFINITY)).toBe(0);
    expect(liveOffset(Number.NaN, 100)).toBe(0);
  });
});

describe("livePosition", () => {
  const tracks = [{ duration: 100 }, { duration: 50 }, { duration: 30 }];

  it("adds up the playlist", () => {
    expect(playlistLength(tracks)).toBe(180);
    expect(playlistLength([])).toBe(0);
  });

  it("finds the track on air and the second into it", () => {
    expect(livePosition(tracks, 0)).toEqual({ index: 0, offset: 0 });
    expect(livePosition(tracks, 99.5)).toEqual({ index: 0, offset: 99.5 });
    expect(livePosition(tracks, 100)).toEqual({ index: 1, offset: 0 });
    expect(livePosition(tracks, 160)).toEqual({ index: 2, offset: 10 });
  });

  it("loops the playlist, before its start too", () => {
    expect(livePosition(tracks, 180)).toEqual({ index: 0, offset: 0 });
    expect(livePosition(tracks, 180 * 1000 + 120)).toEqual({ index: 1, offset: 20 });
    expect(livePosition(tracks, -10)).toEqual({ index: 2, offset: 20 });
  });

  it("lands every station somewhere real at any time of day", () => {
    const now = 1_791_000_000.25;
    for (const entry of visibleStations()) {
      const { index, offset } = livePosition(entry.tracks, now);
      expect(index).toBeLessThan(entry.tracks.length);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(entry.tracks[index].duration);
    }
  });

  it("sits at the start without tracks or durations", () => {
    expect(livePosition([], 1234)).toEqual({ index: 0, offset: 0 });
    expect(livePosition([{ duration: 0 }, { duration: Number.NaN }], 50)).toEqual({ index: 0, offset: 0 });
  });
});

describe("parseMemory", () => {
  it("knows no station on a first visit, with the radio on", () => {
    expect(parseMemory(null, null)).toEqual({ station: null, on: true });
  });

  it("remembers the last station and whether the radio was turned off", () => {
    expect(parseMemory("mr-wolf", "on")).toEqual({ station: "mr-wolf", on: true });
    expect(parseMemory("crockett", "off")).toEqual({ station: "crockett", on: false });
  });

  it("forgets stations that are gone or not on air", () => {
    expect(parseMemory("funny-how", null)).toEqual({ station: null, on: true });
    expect(parseMemory("babylon", "on", withoutTracks("babylon"))).toEqual({ station: null, on: true });
    expect(parseMemory("off", "off")).toEqual({ station: null, on: false });
  });
});

describe("stationCredits", () => {
  it("credits every track on air, by station", () => {
    const credits = stationCredits();
    expect(credits.map((entry) => entry.station.id)).toEqual(visibleStations().map((entry) => entry.id));
    expect(credits.flatMap((entry) => entry.credits)).toHaveLength(24);
    expect(credits[0].credits.map((credit) => credit.title)).toEqual(["Classic", "Plastic Sunrise", "Gearhead"]);
  });

  it("leaves out the stations off air", () => {
    const credits = stationCredits(withoutTracks("love-daddy"));
    expect(credits.map((entry) => entry.station.id)).not.toContain("love-daddy");
    const loveDaddy = findStation("love-daddy")!.tracks.length;
    expect(credits.flatMap((entry) => entry.credits)).toHaveLength(24 - loveDaddy);
  });
});

describe("joinSentences", () => {
  it("puts a full stop between phrases", () => {
    expect(joinSentences(["K-CALIMA 87.9", "Super sounds of the sunset"])).toBe("K-CALIMA 87.9. Super sounds of the sunset");
  });

  it("keeps a phrase's own ending and adds none after the last", () => {
    expect(joinSentences(["LOVE DADDY 102.5", "Wake up! Wake up!", "Now playing: Griphop, Kevin MacLeod"])).toBe(
      "LOVE DADDY 102.5. Wake up! Wake up! Now playing: Griphop, Kevin MacLeod",
    );
    expect(joinSentences(["MR. WOLF 94.7", "I solve problems. Loudly."])).toBe("MR. WOLF 94.7. I solve problems. Loudly.");
    expect(joinSentences(["¿Qué?", "Nada"])).toBe("¿Qué? Nada");
  });

  it("skips empty phrases", () => {
    expect(joinSentences(["BABYLON 105.1", "", "  "])).toBe("BABYLON 105.1");
  });
});
