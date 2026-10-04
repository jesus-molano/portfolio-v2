/**
 * Plays the site soundtrack: "Funkeriffic" from FreePD, released under CC0
 * (public domain dedication; see public/music/LICENSE.txt). One looping
 * <audio> element; the file is only fetched the first time it plays.
 */

export const TRACK_URL = "/music/funkeriffic.mp3";

const VOLUME = 0.55;
const FADE_IN_MS = 1500;
const FADE_OUT_MS = 500;

/**
 * Volume `elapsed` ms into a linear fade from `from` to `target`. The
 * requestAnimationFrame timestamp is the start of the frame, so it can come
 * slightly before the moment the fade started: a negative elapsed time must
 * not push the volume below 0, which makes HTMLMediaElement throw.
 */
export function volumeAt(from: number, target: number, elapsed: number, ms: number): number {
  const t = ms > 0 ? Math.min(1, Math.max(0, elapsed / ms)) : 1;
  return Math.min(1, Math.max(0, from + (target - from) * t));
}

export type Player = {
  /** Starts or resumes with a fade in. Call it from a user gesture. */
  start(): Promise<void>;
  /** Fades out, then pauses. */
  stop(): void;
  /** Pauses while the tab is hidden, resumes when it is visible again. */
  setHidden(hidden: boolean): void;
  dispose(): void;
};

/** Null outside the browser. */
export function createPlayer(): Player | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  let audio: HTMLAudioElement | null = null;
  let frame = 0;
  let playing = false;

  const element = () => {
    if (!audio) {
      audio = new Audio(TRACK_URL);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
    }
    return audio;
  };

  /** Moves the volume to `target` over `ms`, then runs `done`. */
  const fade = (target: number, ms: number, done?: () => void) => {
    cancelAnimationFrame(frame);
    const media = element();
    const from = media.volume;
    const started = performance.now();
    const step = (now: number) => {
      media.volume = volumeAt(from, target, now - started, ms);
      if (now - started < ms) frame = requestAnimationFrame(step);
      else done?.();
    };
    frame = requestAnimationFrame(step);
  };

  return {
    async start() {
      const media = element();
      playing = true;
      await media.play();
      fade(VOLUME, FADE_IN_MS);
    },
    stop() {
      playing = false;
      if (!audio) return;
      fade(0, FADE_OUT_MS, () => {
        if (!playing) audio?.pause();
      });
    },
    setHidden(hidden) {
      if (!audio || !playing) return;
      if (hidden) audio.pause();
      else void audio.play();
    },
    dispose() {
      cancelAnimationFrame(frame);
      audio?.pause();
      audio?.removeAttribute("src");
      audio?.load();
      audio = null;
      playing = false;
    },
  };
}
