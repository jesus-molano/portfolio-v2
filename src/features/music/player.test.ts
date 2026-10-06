import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dbToGain, PAUSE_MIX } from "./pauseMix";
import { createPlayer, deckVolume, fillStatic, type Program, shouldPrefetch, staticEnvelope, volumeAt } from "./player";

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
  id: "bobsled",
  tracks: [
    { url: "/music/a.mp3", duration: 100, credit },
    { url: "/music/b.mp3", duration: 50, credit },
    { url: "/music/c.mp3", duration: 30, credit },
  ],
};
const OTHER: Program = { id: "raheem", tracks: [{ url: "/music/x.mp3", duration: 120, credit }] };

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
    expect(onTrack).toHaveBeenLastCalledWith("bobsled", 1);
    finishFades();
    expect(deck.volume).toBeCloseTo(0.65, 5);
  });

  it("starts from the top of the first track when asked, and keeps that clock", async () => {
    const onTrack = vi.fn();
    const player = createPlayer({ onTrack })!;
    await player.tune(STATION, { crackle: false, fromTop: true });
    expect(FakeAudio.all[0].src).toBe("/music/a.mp3");
    expect(FakeAudio.all[0].currentTime).toBe(0);
    expect(onTrack).toHaveBeenLastCalledWith("bobsled", 0);
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
    expect(onTrack).toHaveBeenLastCalledWith("bobsled", 1);
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
    expect(onTrack).toHaveBeenLastCalledWith("bobsled", 2);
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
    expect(onError).toHaveBeenCalledWith("bobsled");
  });
});

/** An AudioParam that records what is scheduled on it. */
class FakeParam {
  value: number;
  calls: { method: string; args: unknown[] }[] = [];
  constructor(value: number) {
    this.value = value;
  }
  cancelScheduledValues(...args: unknown[]) {
    this.calls.push({ method: "cancel", args });
  }
  setValueAtTime(value: number, at: number) {
    this.calls.push({ method: "set", args: [value, at] });
    this.value = value;
  }
  setValueCurveAtTime(curve: Float32Array, at: number, seconds: number) {
    this.calls.push({ method: "curve", args: [Array.from(curve), at, seconds] });
    this.value = curve[curve.length - 1];
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.calls.push({ method: "exp", args: [value, at] });
  }
  /** The last value scheduled. */
  get end() {
    return this.value;
  }
}

class FakeNode {
  outputs: unknown[] = [];
  connect<T>(node: T): T {
    this.outputs.push(node);
    return node;
  }
}

/** Just enough of AudioContext for the pause's bus and the blips. */
class FakeContext {
  static last: FakeContext | null = null;
  state: "running" | "suspended" = FakeContext.startState;
  static startState: "running" | "suspended" = "running";
  currentTime = 3;
  destination = new FakeNode();
  sources = new Map<FakeAudio, FakeNode>();
  gains: (FakeNode & { gain: FakeParam })[] = [];
  filters: (FakeNode & { type: string; frequency: FakeParam; Q: FakeParam })[] = [];
  oscillators: (FakeNode & { frequency: FakeParam })[] = [];
  private listeners: (() => void)[] = [];
  constructor() {
    FakeContext.last = this;
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  addEventListener(_type: string, listener: () => void) {
    this.listeners.push(listener);
  }
  run() {
    this.state = "running";
    this.listeners.forEach((listener) => listener());
  }
  createMediaElementSource(media: FakeAudio) {
    if (this.sources.has(media)) throw new Error("already routed");
    const node = new FakeNode();
    this.sources.set(media, node);
    return node;
  }
  createGain() {
    const node = Object.assign(new FakeNode(), { gain: new FakeParam(1) });
    this.gains.push(node);
    return node;
  }
  createBiquadFilter() {
    const node = Object.assign(new FakeNode(), { type: "lowpass", frequency: new FakeParam(350), Q: new FakeParam(1) });
    this.filters.push(node);
    return node;
  }
  createOscillator() {
    const node = Object.assign(new FakeNode(), { type: "sine", frequency: new FakeParam(440), start() {}, stop() {} });
    this.oscillators.push(node);
    return node;
  }
}

describe("the radio behind the pause menu", () => {
  const finishFades = () => vi.advanceTimersByTime(2_000);
  const ducked = 0.65 * dbToGain(PAUSE_MIX.duckDb);

  beforeEach(() => {
    FakeAudio.all = [];
    FakeContext.last = null;
    FakeContext.startState = "running";
    vi.stubGlobal("Audio", FakeAudio);
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "performance"] });
    vi.setSystemTime(new Date(1_010_000));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("without Web Audio", () => {
    beforeEach(() => vi.stubGlobal("window", {}));

    it("ducks the deck's own volume by about 10 dB, and brings it back", async () => {
      const player = createPlayer()!;
      await player.tune(STATION, { crackle: false });
      finishFades();
      const [deck] = FakeAudio.all;
      player.setPaused(true);
      finishFades();
      expect(deck.volume).toBeCloseTo(ducked, 5);
      player.setPaused(false);
      finishFades();
      expect(deck.volume).toBeCloseTo(0.65, 5);
    });

    it("tunes a station in behind the menu when it is already up", async () => {
      const player = createPlayer()!;
      player.setPaused(true);
      await player.tune(STATION, { crackle: false });
      finishFades();
      expect(FakeAudio.all[0].volume).toBeCloseTo(ducked, 5);
    });

    it("blips in silence: no Web Audio, no sound, no error", () => {
      const player = createPlayer()!;
      expect(() => player.blip("pause")).not.toThrow();
    });
  });

  describe("with Web Audio", () => {
    beforeEach(() => {
      vi.stubGlobal("window", { AudioContext: FakeContext, addEventListener() {}, removeEventListener() {} });
      vi.stubGlobal("navigator", {});
    });

    const bus = () => {
      const ctx = FakeContext.last!;
      // decks -> input gain -> low-pass -> duck gain -> speakers
      const [input, duck] = ctx.gains;
      const [filter] = ctx.filters;
      return { ctx, input, filter, duck };
    };

    it("plays the decks through a low-pass and a gain that do nothing while the game runs", async () => {
      const player = createPlayer()!;
      await player.tune(STATION, { crackle: false });
      finishFades();
      const { ctx, input, filter, duck } = bus();
      const [deck] = FakeAudio.all;
      expect(ctx.sources.get(deck)?.outputs).toEqual([input]);
      expect(input.outputs).toEqual([filter]);
      expect(filter.outputs).toEqual([duck]);
      expect(duck.outputs).toEqual([ctx.destination]);
      expect(filter.type).toBe("lowpass");
      expect(filter.frequency.value).toBe(PAUSE_MIX.open);
      expect(duck.gain.value).toBe(1);
      // Her level stays on the deck, as before.
      expect(deck.volume).toBeCloseTo(0.65, 5);
    });

    it("muffles and ducks on the bus as the menu arrives, the deck untouched, and eases back", async () => {
      const player = createPlayer()!;
      await player.tune(STATION, { crackle: false });
      finishFades();
      const { filter, duck } = bus();
      const [deck] = FakeAudio.all;
      player.setPaused(true);
      const curve = filter.frequency.calls.find((call) => call.method === "curve")!;
      const [points, , seconds] = curve.args as [number[], number, number];
      expect(points[0]).toBeCloseTo(PAUSE_MIX.open, 0);
      expect(points.at(-1)).toBeCloseTo(PAUSE_MIX.cutoff, 0);
      expect(seconds).toBeCloseTo(PAUSE_MIX.inMs / 1000, 5);
      expect(duck.gain.end).toBeCloseTo(dbToGain(PAUSE_MIX.duckDb), 5);
      finishFades();
      expect(deck.volume).toBeCloseTo(0.65, 5);
      // Halfway back out, she turns round: the new curve starts where the old one is.
      player.setPaused(false);
      vi.advanceTimersByTime(PAUSE_MIX.outMs / 2);
      player.setPaused(true);
      const last = filter.frequency.calls.filter((call) => call.method === "curve").at(-1)!;
      const [again] = last.args as [number[]];
      expect(again[0]).toBeGreaterThan(PAUSE_MIX.cutoff * 2);
      expect(again[0]).toBeLessThan(PAUSE_MIX.open / 2);
      expect(again.at(-1)).toBeCloseTo(PAUSE_MIX.cutoff, 0);
    });

    it("never routes a deck into a stopped context, which would mute it: it waits for it to run", async () => {
      FakeContext.startState = "suspended";
      const player = createPlayer()!;
      await player.tune(STATION, { crackle: false });
      finishFades();
      const { ctx } = bus();
      const [deck] = FakeAudio.all;
      expect(ctx.sources.size).toBe(0);
      // Meanwhile the pause ducks the deck itself.
      player.setPaused(true);
      finishFades();
      expect(deck.volume).toBeCloseTo(ducked, 5);
      ctx.run();
      expect(ctx.sources.has(deck)).toBe(true);
      // The bus takes the duck over: the deck goes back to her level.
      finishFades();
      expect(deck.volume).toBeCloseTo(0.65, 5);
      expect(bus().duck.gain.end).toBeCloseTo(dbToGain(PAUSE_MIX.duckDb), 5);
    });

    it("blips with oscillators straight to the speakers, at her volume, never through the muffle", async () => {
      const player = createPlayer({}, { volume: 0.5 })!;
      await player.tune(STATION, { crackle: false });
      const { ctx } = bus();
      player.blip("pause");
      expect(ctx.oscillators).toHaveLength(2);
      const tone = ctx.filters.at(-1)!;
      expect(tone.outputs).toEqual([ctx.destination]);
      // Muted, no blip at all.
      const silent = createPlayer({}, { volume: 0 })!;
      const before = FakeContext.last!.oscillators.length;
      silent.blip("resume");
      expect(FakeContext.last!.oscillators.length).toBe(before);
    });

    it("keeps the crossfade: a new station's deck joins the bus too", async () => {
      const player = createPlayer()!;
      await player.tune(STATION, { crackle: false });
      await player.tune(OTHER, { crackle: false });
      finishFades();
      const { ctx } = bus();
      expect(ctx.sources.size).toBe(2);
      expect(playing().map((deck) => deck.src)).toEqual(["/music/x.mp3"]);
    });
  });
});

const playing = () => FakeAudio.all.filter((deck) => !deck.paused);

describe("deckVolume", () => {
  it("plays the stations' one level at full volume, scaled by her volume and the pause menu's dip", () => {
    expect(deckVolume(1, 1)).toBe(0.65);
    expect(deckVolume(0.5, 1)).toBeCloseTo(0.325, 10);
    expect(deckVolume(1, 0.4)).toBeCloseTo(0.26, 10);
    expect(deckVolume(0, 1)).toBe(0);
  });

  it("never leaves 0 to the stations' level, whatever it is given", () => {
    expect(deckVolume(2, 1)).toBe(0.65);
    expect(deckVolume(-1, 1)).toBe(0);
    expect(deckVolume(Number.NaN, 1)).toBe(0.65);
  });
});
