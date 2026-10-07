/**
 * Plays the radio (stations.ts; credits in public/music/LICENSE.txt). A
 * station is a playlist on a clock: tuning in lands where its broadcast is
 * now (livePosition), mid-song like GTA; each track runs into the next and
 * the playlist loops. Changing station crossfades two <audio> decks through
 * a short burst of tuning static made with Web Audio (no file).
 *
 * Only the track on air is fetched; the next one starts loading in the last
 * PREFETCH_SECONDS of it, on a deck of its own, so it starts without a gap.
 *
 * Behind the pause menu (pauseMix.ts) the music is muffled and ducked: the
 * decks play through one Web Audio bus, a low-pass filter and a gain,
 * built in the gesture that first tunes the radio. A deck joins the bus
 * only once the AudioContext runs (a media element routed into a stopped
 * context would go silent); until then, or without Web Audio, the pause
 * ducks the deck's own volume instead and nothing is filtered. The decks'
 * crossfades, her volume and the hidden tab's pause stay on the elements,
 * as before; the bus only shapes what comes out of them. The tracks are
 * same-origin files, so the graph hears them (a cross-origin file would
 * play silence through it).
 */
import { BLIP_LEVEL, type MixRamp, mixAt, mixTarget, PAUSE_BLIPS, rampCurve, rampTo } from "./pauseMix";
import { livePosition, nextTrack, type Station, type Track } from "./stations";

/** Every track is normalised to -16 LUFS, so one level suits them all: her volume at 100 %. */
const VOLUME = 0.65;

/** How fast her volume reaches the deck on air. */
const LEVEL_MS = 180;

/**
 * The level a deck on air plays at: the stations' one level, times her
 * volume (STATS's settings, 0 to 1) and a duck (1 when nothing ducks it:
 * the pause menu's, where the decks do not go through Web Audio).
 */
/** The events that carry a user activation, on which a stopped AudioContext may resume. */
const WAKE_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown"] as const;

export function deckVolume(volume: number, duck: number): number {
  const clamp = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1);
  return VOLUME * clamp(volume) * clamp(duck);
}
const FADE_IN_MS = 900;
const FADE_OUT_MS = 450;
/** Tuning static: length and peak level (linear, before the master). */
const STATIC_MS = 420;
const STATIC_LEVEL = 0.16;
/** The next track starts loading this many seconds before the end of the one on air. */
export const PREFETCH_SECONDS = 20;
/** Decks kept at most: on air, the next track, and two fading out. */
const MAX_DECKS = 4;
/**
 * Fades step on a timer, not on animation frames: the hero scene can hold
 * a frame for a long time on a slow GPU, and a fade-out must still finish
 * (and pause its deck) on time.
 */
const FADE_STEP_MS = 16;

/**
 * Volume `elapsed` ms into a linear fade from `from` to `target`. A clock
 * read can come slightly before the moment the fade started: a negative
 * elapsed time must not push the volume below 0, which makes
 * HTMLMediaElement throw.
 */
export function volumeAt(from: number, target: number, elapsed: number, ms: number): number {
  const t = ms > 0 ? Math.min(1, Math.max(0, elapsed / ms)) : 1;
  return Math.min(1, Math.max(0, from + (target - from) * t));
}

/**
 * Envelope of the tuning static at `t` seconds into a burst of `duration`:
 * a 15 ms attack, then a decay that reaches 0 at the end, so the burst
 * never clicks in or out.
 */
export function staticEnvelope(t: number, duration: number): number {
  if (!(duration > 0) || t <= 0 || t >= duration) return 0;
  const attack = Math.min(0.015, duration / 4);
  if (t < attack) return t / attack;
  const decay = 1 - (t - attack) / (duration - attack);
  return decay * decay;
}

/**
 * Fills `data` with radio static: white noise that crackles (random short
 * dips and pops) under `staticEnvelope`. `random` returns [0, 1), so tests
 * can pass a seeded generator.
 */
export function fillStatic(data: Float32Array, sampleRate: number, random: () => number) {
  const duration = data.length / sampleRate;
  /** Samples left in the current crackle segment, and its level. */
  let left = 0;
  let level = 1;
  for (let i = 0; i < data.length; i++) {
    if (left <= 0) {
      // Segments of 2 to 20 ms: mostly full noise, some dips, a few pops.
      left = Math.round(sampleRate * (0.002 + random() * 0.018));
      const roll = random();
      level = roll < 0.18 ? 0.25 : roll > 0.94 ? 1.6 : 1;
    }
    left--;
    const sample = (random() * 2 - 1) * level * staticEnvelope(i / sampleRate, duration);
    data[i] = Math.max(-1, Math.min(1, sample));
  }
}

/**
 * True once a track `currentTime` seconds into `duration` is close enough
 * to its end to fetch the next one. False while the duration is unknown.
 */
export function shouldPrefetch(currentTime: number, duration: number, lead = PREFETCH_SECONDS): boolean {
  return Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime) && duration - currentTime <= lead;
}

/** What the player needs of a station. */
export type Program = Pick<Station, "id" | "tracks">;

export type PlayerEvents = {
  /** A track of `station` went on air: on tuning in, and at every track change. */
  onTrack?(station: Program["id"], index: number): void;
  /** No track of `station` would play. */
  onError?(station: Program["id"]): void;
};

export type Player = {
  /**
   * Tunes to `station` (null: silence), crossfading from what plays now.
   * With `crackle`, a burst of static covers the change. With `fromTop`,
   * the station's broadcast starts over at its first track, for this page.
   * Call it from a user gesture; resolves once the station plays.
   */
  tune(station: Program | null, options?: { crackle?: boolean; fromTop?: boolean }): Promise<void>;
  /** Pauses while the tab is hidden; back on air, at the live position, when it shows. */
  setHidden(hidden: boolean): void;
  /** Her volume, 0 to 1 (STATS's settings). */
  setVolume(volume: number): void;
  /** The pause menu is on screen: the music goes behind it (muffled, ducked), and comes back. */
  setPaused(paused: boolean): void;
  /** The pause menu's blip as the game pauses or resumes, at her volume. */
  blip(kind: keyof typeof PAUSE_BLIPS): void;
  dispose(): void;
};

type AudioContextClass = typeof AudioContext;

/** Null outside the browser. */
export function createPlayer(events: PlayerEvents = {}, { volume = 1 } = {}): Player | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  const decks: HTMLAudioElement[] = [];
  const timers = new Map<HTMLAudioElement, ReturnType<typeof setTimeout>>();
  const fading = new Set<HTMLAudioElement>();
  /** The station on air, the deck it plays on and its track. */
  let live: { station: Program; deck: HTMLAudioElement; index: number } | null = null;
  /** The next track, loading on its own deck. */
  let queued: { deck: HTMLAudioElement; url: string } | null = null;
  /** When each station's broadcast started, in seconds since the epoch (0 unless restarted). */
  const epochs = new Map<Program["id"], number>();
  /** Tracks in a row that failed to play on the live station. */
  let failures = 0;
  let hidden = false;
  let context: AudioContext | null = null;
  let level = volume;
  /** The pause menu is on screen, and the mix's move toward it or away (pauseMix.ts). */
  let paused = false;
  let ramp: MixRamp | null = null;
  /** The pause's bus: decks -> input -> low-pass -> duck -> speakers. */
  let bus: { input: GainNode; filter: BiquadFilterNode; duck: GainNode } | null = null;
  /** Decks that play through the bus (an element joins a graph once, for good). */
  const routed = new WeakSet<HTMLAudioElement>();
  /** The pause's duck on the deck itself, for a deck the bus does not carry. */
  const ownDuck = (media: HTMLAudioElement | undefined) => (media && routed.has(media) ? 1 : mixTarget(paused).gain);
  /** What the deck on air plays at now. */
  const target = () => deckVolume(level, ownDuck(live?.deck));

  const elapsed = (station: Program) => Date.now() / 1000 - (epochs.get(station.id) ?? 0);

  /** Moves a deck's volume to `target` over `ms`, then runs `done`. */
  const fade = (media: HTMLAudioElement, target: number, ms: number, done?: () => void) => {
    clearTimeout(timers.get(media));
    const from = media.volume;
    const started = performance.now();
    const step = () => {
      const elapsed = performance.now() - started;
      media.volume = volumeAt(from, target, elapsed, ms);
      if (elapsed < ms) timers.set(media, setTimeout(step, FADE_STEP_MS));
      else {
        timers.delete(media);
        done?.();
      }
    };
    timers.set(media, setTimeout(step, FADE_STEP_MS));
  };

  const stopFade = (media: HTMLAudioElement) => {
    clearTimeout(timers.get(media));
    timers.delete(media);
    fading.delete(media);
  };

  /** Empties a deck, which also stops its download. */
  const unload = (media: HTMLAudioElement) => {
    stopFade(media);
    media.pause();
    media.removeAttribute("src");
    media.load();
  };

  /**
   * Puts the AudioContext to sleep once nothing can sound (no station on
   * air, nothing fading out): a running context kept the audio thread
   * mixing silence for the rest of the visit after the radio went off. Her
   * next tune, or her next gesture, wakes it (`wake`, `audio`).
   */
  const sleepIfSilent = () => {
    if (live || fading.size > 0 || !context || context.state !== "running") return;
    void context.suspend().catch(() => {});
  };

  const release = (media: HTMLAudioElement) => {
    fading.add(media);
    fade(media, 0, FADE_OUT_MS, () => {
      fading.delete(media);
      if (media === live?.deck) return;
      // Radio off: the deck lets its file go too (no download, no buffer held); switching, it waits paused.
      if (live) media.pause();
      else unload(media);
      sleepIfSilent();
    });
  };

  const dropQueue = () => {
    if (queued) unload(queued.deck);
    queued = null;
  };

  /** Points a deck at a track, `offset` seconds in. */
  const load = (media: HTMLAudioElement, track: Track, offset: number) => {
    if (media.getAttribute("src") !== track.url) media.src = track.url;
    try {
      // Before the file loads, this sets the position playback starts from.
      media.currentTime = offset;
    } catch {
      // Not seekable: it plays from the start.
    }
  };

  /** Plays the live deck and brings it up to full volume. */
  const onAir = async (media: HTMLAudioElement, ms: number) => {
    await media.play();
    if (live?.deck === media && !hidden) fade(media, target(), ms);
  };

  /** The next track of the live station: on the deck that preloaded it, or on the same one. */
  const advance = () => {
    if (!live) return;
    const { station } = live;
    const index = nextTrack(live.index, station.tracks.length);
    const track = station.tracks[index];
    let media = live.deck;
    if (queued && queued.url === track.url && queued.deck !== media) {
      const next = queued.deck;
      queued = null;
      media.pause();
      media = next;
      stopFade(media);
      media.volume = target();
    } else {
      dropQueue();
      load(media, track, 0);
    }
    live = { station, deck: media, index };
    events.onTrack?.(station.id, index);
    if (hidden) return;
    media.play().catch(() => {
      // Blocked or broken: the error handler moves on, or reports it.
    });
  };

  const onEnded = (media: HTMLAudioElement) => {
    if (media === live?.deck) advance();
  };

  const onTime = (media: HTMLAudioElement) => {
    if (!live || media !== live.deck || queued) return;
    if (!shouldPrefetch(media.currentTime, media.duration)) return;
    const { station, index } = live;
    const url = station.tracks[nextTrack(index, station.tracks.length)].url;
    // A one-track playlist starts its own file again.
    if (url === live.deck.getAttribute("src")) return;
    const next = freeDeck();
    next.volume = 0;
    next.src = url;
    queued = { deck: next, url };
  };

  const onPlaying = (media: HTMLAudioElement) => {
    if (media === live?.deck) failures = 0;
  };

  const onError = (media: HTMLAudioElement) => {
    if (queued?.deck === media) {
      // The next track failed to preload: it loads again when its turn comes.
      queued = null;
      return;
    }
    if (!live || media !== live.deck || !media.getAttribute("src")) return;
    failures++;
    if (failures < live.station.tracks.length) advance();
    else events.onError?.(live.station.id);
  };

  /** A deck that is neither on air, nor queued, nor fading out. */
  const freeDeck = (): HTMLAudioElement => {
    const free = decks.find((deck) => deck !== live?.deck && deck !== queued?.deck && !fading.has(deck));
    if (free) return free;
    if (decks.length >= MAX_DECKS) {
      // Switching faster than the fades: cut the oldest fade short.
      const oldest = decks.find((deck) => fading.has(deck))!;
      stopFade(oldest);
      oldest.pause();
      return oldest;
    }
    const deck = new Audio();
    deck.preload = "auto";
    deck.volume = 0;
    deck.addEventListener("ended", () => onEnded(deck));
    deck.addEventListener("timeupdate", () => onTime(deck));
    deck.addEventListener("playing", () => onPlaying(deck));
    deck.addEventListener("error", () => onError(deck));
    decks.push(deck);
    route(deck);
    return deck;
  };

  /** The page's one AudioContext, made on the first sound that needs it; null without Web Audio. */
  const audio = (): AudioContext | null => {
    const Context =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
    if (!Context) return null;
    context ??= new Context();
    if (context.state === "suspended") void context.resume().catch(() => {});
    return context;
  };

  /** Moves the bus's params along the current ramp, from where they are now. */
  const schedule = () => {
    if (!bus || !context || !ramp) return;
    const now = performance.now();
    const left = Math.max(0, ramp.start + ramp.ms - now);
    const rest: MixRamp = { from: mixAt(ramp, now), to: ramp.to, start: now, ms: left };
    const at = context.currentTime;
    for (const [param, key] of [
      [bus.duck.gain, "gain"],
      [bus.filter.frequency, "cutoff"],
    ] as const) {
      param.cancelScheduledValues(0);
      try {
        if (left > 0) param.setValueCurveAtTime(rampCurve(rest, key), at, left / 1000);
        else param.setValueAtTime(rest.to[key], at);
      } catch {
        param.value = rest.to[key];
      }
    }
  };

  /** Routes a deck into the bus, once the context runs; never into a stopped one, which would mute it. */
  const route = (media: HTMLAudioElement) => {
    if (!bus || !context || context.state !== "running" || routed.has(media)) return;
    try {
      context.createMediaElementSource(media).connect(bus.input);
      routed.add(media);
    } catch {
      // Already in a graph, or no media element source: it plays on its own, ducked by its volume.
    }
    // Its own duck comes off as the bus's takes over.
    if (media === live?.deck && !hidden && !fading.has(media)) fade(media, target(), LEVEL_MS);
  };

  /**
   * A context stopped by the browser (iOS after a call, a long hidden tab)
   * starts again on her next gesture: a key, a click, or a tap, which only
   * carries the activation on its way up (touchend, a touch's pointerup;
   * a touch's pointerdown does not, RadioButton.tsx lists the same).
   */
  const wake = () => {
    if (context && context.state !== "running" && !hidden) void context.resume().catch(() => {});
  };

  /** The pause's bus, built in the gesture that first tunes the radio. */
  const ensureBus = () => {
    if (bus) return;
    try {
      const ctx = audio();
      if (!ctx) return;
      // Playback, as an <audio> plays, not the ringer's: iOS's silent switch must not mute the radio once it runs through Web Audio.
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session?.type === "auto") session.type = "playback";
      const input = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.9;
      const duck = ctx.createGain();
      const mix = ramp ? mixAt(ramp, performance.now()) : mixTarget(false);
      filter.frequency.value = mix.cutoff;
      duck.gain.value = mix.gain;
      input.connect(filter).connect(duck).connect(ctx.destination);
      bus = { input, filter, duck };
      schedule();
      const routeAll = () => {
        if (ctx.state === "running") decks.forEach(route);
      };
      ctx.addEventListener("statechange", routeAll);
      routeAll();
      for (const type of WAKE_EVENTS) window.addEventListener(type, wake, true);
    } catch {
      bus = null;
    }
  };

  const crackle = () => {
    try {
      const ctx = audio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const seconds = STATIC_MS / 1000;
      const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
      fillStatic(buffer.getChannelData(0), ctx.sampleRate, Math.random);
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      // The band sweeps up, like a dial passing between stations.
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 0.8;
      band.frequency.setValueAtTime(600, now);
      band.frequency.exponentialRampToValueAtTime(3400, now + seconds);
      const level = ctx.createGain();
      level.gain.value = STATIC_LEVEL;
      // The static is the radio's too: behind the pause menu it is muffled with the music.
      const out = bus?.input ?? ctx.destination;
      noise.connect(band).connect(level).connect(out);
      // A faint heterodyne whistle gliding down under the noise.
      const whistle = ctx.createOscillator();
      whistle.frequency.setValueAtTime(2400, now);
      whistle.frequency.exponentialRampToValueAtTime(420, now + seconds);
      const whistleLevel = ctx.createGain();
      whistleLevel.gain.setValueAtTime(0.0001, now);
      whistleLevel.gain.exponentialRampToValueAtTime(STATIC_LEVEL * 0.12, now + 0.04);
      whistleLevel.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      whistle.connect(whistleLevel).connect(out);
      noise.start(now);
      whistle.start(now);
      whistle.stop(now + seconds);
    } catch {
      // No Web Audio: tune without the static.
    }
  };

  return {
    async tune(station, { crackle: withStatic = true, fromTop = false } = {}) {
      // Called in her gesture: the one moment a new AudioContext is sure to run (and a sleeping one wakes).
      if (station) {
        ensureBus();
        wake();
      }
      if (withStatic) crackle();
      const previous = live?.deck ?? null;
      if (!station || station.tracks.length === 0) {
        live = null;
        dropQueue();
        if (previous) release(previous);
        // Once the static and the fade are over, the context sleeps (sleepIfSilent).
        setTimeout(sleepIfSilent, Math.max(FADE_OUT_MS, STATIC_MS) + 100);
        return;
      }
      if (live?.station.id === station.id && !fromTop) {
        // Already on this station: make sure it plays.
        if (hidden) return;
        await onAir(live.deck, FADE_OUT_MS);
        return;
      }
      if (fromTop) epochs.set(station.id, Date.now() / 1000);
      dropQueue();
      const { index, offset } = livePosition(station.tracks, elapsed(station));
      const media = freeDeck();
      stopFade(media);
      media.volume = 0;
      live = { station, deck: media, index };
      failures = 0;
      if (previous) release(previous);
      load(media, station.tracks[index], offset);
      events.onTrack?.(station.id, index);
      if (hidden) return;
      await onAir(media, FADE_IN_MS);
    },
    setHidden(next) {
      hidden = next;
      if (next) {
        live?.deck.pause();
        // Nothing to hear while hidden: the audio thread sleeps too (wake() below, or her next gesture).
        if (context?.state === "running") void context.suspend().catch(() => {});
        return;
      }
      if (!live) return;
      const media = live.deck;
      // A context the browser stopped while hidden plays again (the bus carries the decks).
      wake();
      // Back on air where the broadcast is now, which may be a later track.
      const { station } = live;
      const { index, offset } = livePosition(station.tracks, elapsed(station));
      if (index !== live.index) {
        dropQueue();
        live = { station, deck: media, index };
        events.onTrack?.(station.id, index);
      }
      stopFade(media);
      media.volume = 0;
      load(media, station.tracks[index], offset);
      onAir(media, FADE_IN_MS).catch(() => {
        // Blocked: the music button still shows the station; the wheel plays it.
      });
    },
    setVolume(next) {
      level = next;
      if (live && !hidden && !fading.has(live.deck)) fade(live.deck, target(), LEVEL_MS);
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      ramp = rampTo(ramp, paused, performance.now());
      schedule();
      // A deck outside the bus ducks on its own volume, over the same time.
      if (live && !routed.has(live.deck) && !hidden && !fading.has(live.deck)) fade(live.deck, target(), ramp.ms);
    },
    blip(kind) {
      if (hidden) return;
      const peak = BLIP_LEVEL * Math.min(1, Math.max(0, level));
      if (!(peak > 0)) return;
      // Only on a running context: notes scheduled on a stopped one would sound late, whenever it resumes.
      if (!context || context.state !== "running") return;
      try {
        const ctx = context;
        const now = ctx.currentTime;
        // Triangles through a gentle low-pass: round, never a beep.
        const tone = ctx.createBiquadFilter();
        tone.type = "lowpass";
        tone.frequency.value = 2600;
        tone.connect(ctx.destination);
        PAUSE_BLIPS[kind].forEach(({ frequency, at, length, level: share }) => {
          const note = ctx.createOscillator();
          note.type = "triangle";
          note.frequency.setValueAtTime(frequency, now + at);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, now + at);
          gain.gain.exponentialRampToValueAtTime(peak * share, now + at + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
          note.connect(gain).connect(tone);
          note.start(now + at);
          note.stop(now + at + length + 0.02);
        });
      } catch {
        // No Web Audio: the pause is silent.
      }
    },
    dispose() {
      for (const type of WAKE_EVENTS) window.removeEventListener(type, wake, true);
      decks.forEach(unload);
      decks.length = 0;
      live = null;
      queued = null;
      void context?.close().catch(() => {});
      context = null;
      bus = null;
    },
  };
}
