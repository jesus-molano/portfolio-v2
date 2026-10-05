import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlayer, fillStatic, type Program, shouldPrefetch, staticEnvelope, volumeAt } from "./player";

describe("volumeAt", () => {
  it("interpolates linearly over the fade", () => {
    expect(volumeAt(0, 0.5, 0, 1000)).toBe(0);
    expect(volumeAt(0, 0.5, 500, 1000)).toBeCloseTo(0.25, 10);
    expect(volumeAt(0, 0.5, 1000, 1000)).toBe(0.5);
    expect(volumeAt(0.5, 0, 250, 1000)).toBeCloseTo(0.375, 10);
  });

  it("never leaves [0, 1] when the frame time comes before the start", () => {
    // Seen in the browser: a fade in with elapsed -0.4 ms gave -0.000147.
    expect(volumeAt(0, 0.55, -0.4, 1500)).toBe(0);
    expect(volumeAt(0.55, 0, 1600, 500)).toBe(0);
    expect(volumeAt(0.9, 1.4, 1000, 1000)).toBe(1);
  });

  it("jumps to the target for a zero-length fade", () => {
    expect(volumeAt(0.2, 0.55, 0, 0)).toBe(0.55);
  });
});

describe("staticEnvelope", () => {
  it("is silent at both ends and peaks right after the attack", () => {
    expect(staticEnvelope(0, 0.4)).toBe(0);
    expect(staticEnvelope(0.4, 0.4)).toBe(0);
    expect(staticEnvelope(0.015, 0.4)).toBeCloseTo(1, 10);
    expect(staticEnvelope(0.0075, 0.4)).toBeCloseTo(0.5, 10);
  });

  it("only decays after the attack", () => {
    let previous = staticEnvelope(0.015, 0.4);
    for (let t = 0.02; t < 0.4; t += 0.01) {
      const value = staticEnvelope(t, 0.4);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it("is silent for an empty burst", () => {
    expect(staticEnvelope(0.1, 0)).toBe(0);
    expect(staticEnvelope(0.1, Number.NaN)).toBe(0);
  });
});

/** Small seeded generator (LCG), so the static is the same on every run. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("fillStatic", () => {
  it("stays in [-1, 1], starts and ends silent, and is noisy in between", () => {
    const rate = 8000;
    const data = new Float32Array(Math.round(rate * 0.42));
    fillStatic(data, rate, seeded(7));
    expect(Math.max(...data)).toBeLessThanOrEqual(1);
    expect(Math.min(...data)).toBeGreaterThanOrEqual(-1);
    expect(data[0]).toBe(0);
    expect(Math.abs(data[data.length - 1])).toBeLessThan(0.001);
    const early = data.slice(Math.round(rate * 0.02), Math.round(rate * 0.1));
    const rms = Math.sqrt(early.reduce((sum, v) => sum + v * v, 0) / early.length);
    expect(rms).toBeGreaterThan(0.2);
  });

  it("is reproducible with the same generator", () => {
    const a = new Float32Array(400);
    const b = new Float32Array(400);
    fillStatic(a, 8000, seeded(3));
    fillStatic(b, 8000, seeded(3));
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("shouldPrefetch", () => {
  it("waits for the last 20 seconds of the track", () => {
    expect(shouldPrefetch(0, 180)).toBe(false);
    expect(shouldPrefetch(159.9, 180)).toBe(false);
    expect(shouldPrefetch(160, 180)).toBe(true);
    expect(shouldPrefetch(179.9, 180)).toBe(true);
    expect(shouldPrefetch(5, 30, 30)).toBe(true);
  });

  it("waits while the duration is unknown", () => {
    expect(shouldPrefetch(10, Number.NaN)).toBe(false);
    expect(shouldPrefetch(10, Number.POSITIVE_INFINITY)).toBe(false);
    expect(shouldPrefetch(10, 0)).toBe(false);
  });
});

/** Just enough of HTMLAudioElement for the player. */
class FakeAudio {
  static all: FakeAudio[] = [];
  preload = "";
  volume = 0;
  paused = true;
  currentTime = 0;
  duration = Number.NaN;
  /** Makes play() fail, like a missing file. */
  broken = false;
  private attributes = new Map<string, string>();
  private listeners = new Map<string, (() => void)[]>();

  constructor() {
    FakeAudio.all.push(this);
  }

  get src() {
    return this.attributes.get("src") ?? "";
  }

  set src(value: string) {
    this.attributes.set("src", value);
    this.duration = Number.NaN;
    this.currentTime = 0;
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  load() {}

  play() {
    if (this.broken) {
      this.emit("error");
      return Promise.reject(new Error("broken"));
    }
    this.paused = false;
    this.emit("playing");
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener());
  }
}

const credit = { title: "T", artist: "A", sourceUrl: "", licence: "CC0 1.0", licenceUrl: "" } as const;
const STATION: Program = {
  id: "k-calima",
  tracks: [
    { url: "/music/a.mp3", duration: 100, credit },
    { url: "/music/b.mp3", duration: 50, credit },
    { url: "/music/c.mp3", duration: 30, credit },
  ],
};
const OTHER: Program = { id: "crockett", tracks: [{ url: "/music/x.mp3", duration: 120, credit }] };

describe("createPlayer", () => {
  /** Runs the clock far enough ahead to finish every fade. */
  const finishFades = () => vi.advanceTimersByTime(2_000);
  const playing = () => FakeAudio.all.filter((deck) => !deck.paused);

  beforeEach(() => {
    FakeAudio.all = [];
    vi.stubGlobal("window", {});
    vi.stubGlobal("Audio", FakeAudio);
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "performance"] });
    // 1000 s into a 180 s playlist: 100 s in, track b, 0:00... plus 10 s.
    vi.setSystemTime(new Date(1_010_000));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tunes in where the broadcast is now, mid-song", async () => {
    const onTrack = vi.fn();
    const player = createPlayer({ onTrack })!;
    await player.tune(STATION, { crackle: false });
    // 1010 s % 180 s = 110 s: 10 s into the second track.
    const [deck] = FakeAudio.all;
    expect(deck.src).toBe("/music/b.mp3");
    expect(deck.currentTime).toBe(10);
    expect(deck.paused).toBe(false);
    expect(onTrack).toHaveBeenLastCalledWith("k-calima", 1);
    finishFades();
    expect(deck.volume).toBeCloseTo(0.65, 5);
  });

  it("starts from the top of the first track when asked, and keeps that clock", async () => {
    const onTrack = vi.fn();
    const player = createPlayer({ onTrack })!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    expect(FakeAudio.all[0].src).toBe("/music/a.mp3");
    expect(FakeAudio.all[0].currentTime).toBe(0);
    expect(onTrack).toHaveBeenLastCalledWith("k-calima", 0);
    // Away for 2 minutes, then back: 120 s into the restarted broadcast.
    await player.tune(OTHER, { crackle: false });
    vi.setSystemTime(new Date(1_010_000 + 120_000));
    await player.tune(STATION, { crackle: false });
    const deck = playing().find((candidate) => candidate.src === "/music/b.mp3")!;
    expect(deck.currentTime).toBeCloseTo(20, 5);
  });

  it("fetches only the track on air, then the next one in its last 20 seconds", async () => {
    const player = createPlayer()!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    const [deck] = FakeAudio.all;
    deck.duration = 100;
    deck.currentTime = 70;
    deck.emit("timeupdate");
    expect(FakeAudio.all.filter((candidate) => candidate.src)).toHaveLength(1);
    deck.currentTime = 81;
    deck.emit("timeupdate");
    const next = FakeAudio.all.find((candidate) => candidate.src === "/music/b.mp3")!;
    expect(next).toBeDefined();
    expect(next.paused).toBe(true);
  });

  it("moves to the next track when one ends, on the deck that preloaded it", async () => {
    const onTrack = vi.fn();
    const player = createPlayer({ onTrack })!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    finishFades();
    const [deck] = FakeAudio.all;
    deck.duration = 100;
    deck.currentTime = 95;
    deck.emit("timeupdate");
    deck.emit("ended");
    expect(playing().map((candidate) => candidate.src)).toEqual(["/music/b.mp3"]);
    expect(playing()[0].volume).toBeCloseTo(0.65, 5);
    expect(onTrack).toHaveBeenLastCalledWith("k-calima", 1);
  });

  it("loops the playlist after the last track", async () => {
    const onTrack = vi.fn();
    const player = createPlayer({ onTrack })!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    for (let i = 0; i < 3; i++) playing()[0].emit("ended");
    expect(playing().map((candidate) => candidate.src)).toEqual(["/music/a.mp3"]);
    expect(onTrack.mock.calls.map(([, index]) => index)).toEqual([0, 1, 2, 0]);
  });

  it("restarts a one-track station's own file", async () => {
    const player = createPlayer()!;
    await player.tune(OTHER, { crackle: false, fromTop: true });
    const [deck] = FakeAudio.all;
    deck.duration = 120;
    deck.currentTime = 110;
    deck.emit("timeupdate");
    deck.currentTime = 120;
    deck.emit("ended");
    expect(FakeAudio.all).toHaveLength(1);
    expect(deck.currentTime).toBe(0);
    expect(deck.paused).toBe(false);
  });

  it("crossfades to another station and drops the preloaded track", async () => {
    const player = createPlayer()!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    const [first] = FakeAudio.all;
    first.duration = 100;
    first.currentTime = 90;
    first.emit("timeupdate");
    await player.tune(OTHER, { crackle: false });
    finishFades();
    expect(playing().map((candidate) => candidate.src)).toEqual(["/music/x.mp3"]);
    expect(FakeAudio.all.some((candidate) => candidate.src === "/music/b.mp3")).toBe(false);
  });

  it("goes silent when turned off", async () => {
    const player = createPlayer()!;
    await player.tune(STATION, { crackle: false });
    await player.tune(null, { crackle: false });
    finishFades();
    expect(playing()).toHaveLength(0);
  });

  it("fades out on the clock, whatever the frame rate, then pauses", async () => {
    const player = createPlayer()!;
    await player.tune(STATION, { crackle: false });
    finishFades();
    const [deck] = FakeAudio.all;
    await player.tune(null, { crackle: false });
    vi.advanceTimersByTime(200);
    expect(deck.paused).toBe(false);
    expect(deck.volume).toBeGreaterThan(0);
    expect(deck.volume).toBeLessThan(0.65);
    vi.advanceTimersByTime(300);
    expect(deck.volume).toBe(0);
    expect(deck.paused).toBe(true);
  });

  it("pauses while hidden and comes back at the live position", async () => {
    const onTrack = vi.fn();
    const player = createPlayer({ onTrack })!;
    await player.tune(STATION, { crackle: false });
    const [deck] = FakeAudio.all;
    player.setHidden(true);
    expect(deck.paused).toBe(true);
    // 45 s later the broadcast is 5 s into the third track.
    vi.setSystemTime(new Date(1_010_000 + 45_000));
    player.setHidden(false);
    await Promise.resolve();
    expect(deck.src).toBe("/music/c.mp3");
    expect(deck.currentTime).toBeCloseTo(5, 5);
    expect(deck.paused).toBe(false);
    expect(onTrack).toHaveBeenLastCalledWith("k-calima", 2);
  });

  it("skips a track that fails to the next one", async () => {
    const onError = vi.fn();
    const player = createPlayer({ onError })!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    const [deck] = FakeAudio.all;
    deck.emit("error");
    expect(deck.src).toBe("/music/b.mp3");
    expect(deck.paused).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a station where no track plays, once round the playlist", async () => {
    const onError = vi.fn();
    const player = createPlayer({ onError })!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    const [deck] = FakeAudio.all;
    deck.broken = true;
    deck.emit("error");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("k-calima");
  });
});
