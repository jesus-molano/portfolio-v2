import { describe, expect, it } from "vitest";
import {
  aimedSector,
  angleOf,
  DEFAULT_STATION_ID,
  findEntry,
  findStation,
  formatFrequency,
  holizna,
  incompetech,
  isTuneId,
  joinSentences,
  LICENCE_URLS,
  liveOffset,
  macleod,
  livePosition,
  nextIndex,
  nextTrack,
  parseMemory,
  pixabay,
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
  it("has six genre stations by frequency, BOBSLED first", () => {
    expect(STATIONS.map((entry) => entry.name)).toEqual([
      "BOBSLED",
      "RAHEEM",
      "MANERO",
      "ONE LOUDER",
      "WITNESS ME",
      "TOFU",
    ]);
    expect(STATIONS.map((entry) => formatFrequency(entry.frequency))).toEqual([
      "88.3",
      "92.9",
      "97.7",
      "101.1",
      "104.5",
      "107.6",
    ]);
    const frequencies = STATIONS.map((entry) => entry.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => a - b));
    expect(new Set(STATIONS.map((entry) => entry.accent)).size).toBe(STATIONS.length);
  });

  it("defaults to MANERO 97.7, whose playlist opens with Honeyed Sunbeams", () => {
    expect(DEFAULT_STATION_ID).toBe("manero");
    const manero = findStation(DEFAULT_STATION_ID)!;
    expect(formatFrequency(manero.frequency)).toBe("97.7");
    expect(manero.tracks[0].credit.title).toBe("Honeyed Sunbeams");
    expect(manero.tracks[0].url).toBe("/music/honeyed-sunbeams.mp3");
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
      bobsled: ["Reggae Island Vibes", "Rasta Vibes", "Don't Worry About a Thing"],
      raheem: ["West Coast Beat", "Miraculous", "Vlog Vlogs Music Background"],
      manero: ["Honeyed Sunbeams", "Funky Disco", "Afrobeat Disco", "Funk Music", "Celebrity"],
      "one-louder": ["The Sound of Metal 3", "The Sound of Metal 4", "Thrash Metal"],
      "witness-me": ["Rock", "Heatwave", "Punk Rock Rebellion Fast Energy", "Punk Rock"],
      tofu: ["Walk of Dr. Livesey", "Phonk"],
    });
  });

  it("credits every Pixabay track with its page, whose address ends in the track's ID", () => {
    for (const credit of STATIONS.flatMap((entry) => entry.tracks.map((track) => track.credit))) {
      expect(credit.licence).toBe("Pixabay");
      expect(credit.sourceUrl).toMatch(/^https:\/\/pixabay\.com\/music\/[a-z0-9-]+-\d{6}\/$/);
    }
  });

  it("names Kevin MacLeod's site, as his CC BY credit asks", () => {
    const credit = macleod("Gearhead", incompetech("USUAN1100221"));
    expect(credit.artistSite).toBe("incompetech.com");
    expect(credit.licence).toBe("CC BY 4.0");
    expect(credit.licenceUrl).toBe(LICENCE_URLS["CC BY 4.0"]);
    expect(holizna("Classic", "https://example.com").licence).toBe("CC0 1.0");
    expect(pixabay("Phonk", "sigmamusicart", "https://example.com").licenceUrl).toBe(LICENCE_URLS.Pixabay);
  });
});

describe("visibleStations", () => {
  it("puts all six stations on air, each with a playlist", () => {
    expect(visibleStations().map((entry) => entry.id)).toEqual([
      "bobsled",
      "raheem",
      "manero",
      "one-louder",
      "witness-me",
      "tofu",
    ]);
  });

  it("keeps a station without tracks off the air", () => {
    const lineup = withoutTracks("witness-me", "tofu");
    expect(visibleStations(lineup).map((entry) => entry.id)).toEqual([
      "bobsled",
      "raheem",
      "manero",
      "one-louder",
    ]);
    expect(findStation("tofu", lineup)).toBeNull();
  });

  it("puts a station on air as soon as it has a track", () => {
    const lineup = withoutTracks("witness-me").map((entry) =>
      entry.id === "witness-me" ? station("witness-me", [180]) : entry,
    );
    expect(findStation("witness-me", withoutTracks("witness-me"))).toBeNull();
    expect(findStation("witness-me", lineup)?.name).toBe("WITNESS ME");
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
    const wheel = wheelEntries(withoutTracks("witness-me", "tofu"));
    expect(wheel.map((entry) => entry.id)).toEqual(["off", "bobsled", "raheem", "manero", "one-louder"]);
    expect(wheel[sectorAt(angleOf(1, 1), wheel.length)].id).toBe("one-louder");
  });

  it("finds entries and indices, and falls back to radio off", () => {
    expect(wheelIndex("off")).toBe(0);
    expect(wheelIndex("one-louder")).toBe(4);
    expect(wheelIndex("tofu")).toBe(6);
    const short = wheelEntries(withoutTracks("tofu"));
    expect(wheelIndex("tofu", short)).toBe(0);
    expect(findEntry("tofu", short).id).toBe("off");
    expect(isTuneId("manero")).toBe(true);
    expect(isTuneId("tofu")).toBe(true);
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

  it("reads the radio wheel like a dial: off below, 88.3 lower left, the top station lower right", () => {
    const count = WHEEL.length;
    expect(WHEEL[sectorAt(180, count)].id).toBe("off");
    expect(WHEEL[sectorAt(angleOf(-1, 1), count)].id).toBe("bobsled");
    expect(WHEEL[sectorAt(angleOf(1, 1), count)].id).toBe("tofu");
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
    expect(WHEEL[aimedSector(-80, 0, WHEEL.length, 24)!].id).toBe("raheem");
    expect(WHEEL[aimedSector(-20, -80, WHEEL.length, 24)!].id).toBe("manero");
    expect(WHEEL[aimedSector(20, -80, WHEEL.length, 24)!].id).toBe("one-louder");
    expect(WHEEL[aimedSector(80, 0, WHEEL.length, 24)!].id).toBe("witness-me");
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
    expect(parseMemory("manero", "on")).toEqual({ station: "manero", on: true });
    expect(parseMemory("raheem", "off")).toEqual({ station: "raheem", on: false });
  });

  it("forgets stations that are gone or not on air", () => {
    expect(parseMemory("funny-how", null)).toEqual({ station: null, on: true });
    expect(parseMemory("tofu", "on", withoutTracks("tofu"))).toEqual({ station: null, on: true });
    expect(parseMemory("off", "off")).toEqual({ station: null, on: false });
  });
});

describe("stationCredits", () => {
  it("credits every track on air, by station", () => {
    const credits = stationCredits();
    expect(credits.map((entry) => entry.station.id)).toEqual(visibleStations().map((entry) => entry.id));
    expect(credits.flatMap((entry) => entry.credits)).toHaveLength(20);
    expect(credits[0].credits.map((credit) => credit.title)).toEqual([
      "Reggae Island Vibes",
      "Rasta Vibes",
      "Don't Worry About a Thing",
    ]);
  });

  it("leaves out the stations off air", () => {
    const credits = stationCredits(withoutTracks("witness-me"));
    expect(credits.map((entry) => entry.station.id)).not.toContain("witness-me");
    const witnessMe = findStation("witness-me")!.tracks.length;
    expect(credits.flatMap((entry) => entry.credits)).toHaveLength(20 - witnessMe);
  });
});

describe("joinSentences", () => {
  it("puts a full stop between phrases", () => {
    expect(joinSentences(["BOBSLED 88.3", "Feel the rhythm, feel the rhyme"])).toBe(
      "BOBSLED 88.3. Feel the rhythm, feel the rhyme",
    );
  });

  it("keeps a phrase's own ending and adds none after the last", () => {
    expect(joinSentences(["WITNESS ME 104.5", "Witness me!", "Now playing: Punk Rock, alexgrohl"])).toBe(
      "WITNESS ME 104.5. Witness me! Now playing: Punk Rock, alexgrohl",
    );
    expect(joinSentences(["TOFU 107.6", "Tofu delivered by dawn. Sideways."])).toBe(
      "TOFU 107.6. Tofu delivered by dawn. Sideways.",
    );
    expect(joinSentences(["¿Qué?", "Nada"])).toBe("¿Qué? Nada");
  });

  it("skips empty phrases", () => {
    expect(joinSentences(["MANERO 97.7", "", "  "])).toBe("MANERO 97.7");
  });
});
