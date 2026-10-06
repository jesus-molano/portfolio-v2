import type { CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./Hero.module.css";
import type { InputSource } from "./scroll/heroProgress";
import { type DashFrame, speedCells } from "./scroll/dash";
import { LIMITER } from "./scroll/throttle";

type Props = {
  /** Words of the dash. */
  osd: Dictionary["hero"]["osd"];
  /** The way on, in her last input's words (common.cues). */
  cues: Pick<Dictionary["common"]["cues"], "next" | "nextTouch" | "nextClick" | "nextPedal" | "nextKey">;
  /** The stage's placement of the dash (the career city's corner), added to its own. */
  className?: string;
};

/**
 * The dash (scroll/dash.ts), an F1 wheel display, not a tape deck: fifteen
 * shift lights for her throttle, the car's speed, one word for what the car
 * does, and the pit limiter's 80 sign while an unread line holds it.
 * Decorative: the screen-reader help says the same in text. No gear letter:
 * a "D" read as the WASD key to gamers. A phone has none (Hero.module.css,
 * DASH_MEDIA.phone). The hero and the career city both show it; each steps
 * it (`stepDash`) and draws it with `createDashPainter`.
 */
export function Dash({ osd, cues, className }: Props) {
  return (
    <div className={className ? `${styles.dash} ${className}` : styles.dash} data-osd data-vis="off" data-show="hidden" aria-hidden="true">
      <div className={styles.strip} data-strip>
        {[0, 1, 2].map((group) => (
          <span key={group} className={styles.group}>
            {[0, 1, 2, 3, 4].map((light) => (
              <i key={light} className={styles.led} style={{ "--i": group * 5 + light } as CSSProperties} />
            ))}
          </span>
        ))}
        <span className={styles.flare} />
      </div>
      <span className={styles.speed} data-speed>
        <b className={styles.digit} />
        <b className={styles.digit} />
        <b className={styles.digit} />
      </span>
      <span className={styles.side}>
        <span className={styles.unit}>{osd.unit}</span>
        <span className={styles.status}>
          <span data-w="drive">{osd.drive}</span>
          <span data-w="floored">{osd.floored}</span>
          <span data-w="reverse">{osd.reverse}</span>
          <span data-w="limiter">{osd.limiter}</span>
          <span data-w="clear">{osd.clear}</span>
          {/* The car waits for her: the way on, in her last input's words. */}
          <span data-w="prompt">
            <span className={`${styles.glyph} ${styles.forTouch}`} data-g="up" />
            <span className={`${styles.mouse} ${styles.forWheel}`} data-g="wheel" />
            <span className={`${styles.mouse} ${styles.forClick}`} data-g="click" />
            <span className={`${styles.pg} ${styles.forPedal}`} data-g="pedal" />
            <span className={styles.forWheel}>{cues.next}</span>
            <span className={styles.forTouch}>{cues.nextTouch}</span>
            <span className={styles.forClick}>{cues.nextClick}</span>
            <span className={styles.forPedal}>{cues.nextPedal}</span>
            <kbd className={`${styles.keycap} ${styles.forKey}`} data-pedal-key>
              W
            </kbd>
            <kbd className={`${styles.keycap} ${styles.forKey}`}>{cues.nextKey}</kbd>
          </span>
        </span>
        <span className={styles.sign}>
          <span>{LIMITER.kmh}</span>
        </span>
      </span>
    </div>
  );
}

type Attr = (element: HTMLElement | null, name: string, value: string | boolean | null) => void;
type Set = (element: HTMLElement | null, property: string, value: string) => void;

export type DashExtra = {
  /** The card's reading bar (0..1), in its 1/50 steps: the limit sign's ring. */
  ring: number;
  /** The car's speed, km/h. */
  speed: number;
  /** Her turn, and the reminder's parity (the dash asks again). */
  turn: boolean;
  remind: "1" | "2" | null;
  /**
   * Her last input, for the way on's words: set by a stage whose own root
   * does not carry it (the career city); the hero's stage carries it.
   */
  input?: InputSource | null;
};

/**
 * Draws a dash from its frame: attributes and custom properties only, and
 * only what changed (the stage's own setters dedupe). Nothing on a phone,
 * which has none.
 */
export function createDashPainter(dash: HTMLElement | null) {
  const strip = dash?.querySelector<HTMLElement>("[data-strip]") ?? null;
  const cells = Array.from(dash?.querySelector("[data-speed]")?.children ?? []) as HTMLElement[];
  const drawnCells = ["", "", ""];
  let shownSpeed = -1;
  return {
    paint(frame: DashFrame, extra: DashExtra, phone: boolean, attr: Attr, set: Set) {
      if (!dash) return;
      attr(dash, "data-vis", frame.vis);
      if (phone) return;
      attr(dash, "data-show", frame.show);
      attr(dash, "data-pulse", frame.pulse);
      attr(dash, "data-lim", frame.lim === "off" ? null : frame.lim);
      attr(dash, "data-release", frame.release);
      attr(dash, "data-boot", frame.boot);
      attr(dash, "data-remind", frame.show === "prompt" && extra.turn ? extra.remind : null);
      if (extra.input !== undefined) attr(dash, "data-input", extra.input ?? "wheel");
      set(strip, "--lit", String(frame.lit));
      set(strip, "--kick", (Math.round(frame.kick * 20) / 20).toFixed(2));
      // The limit sign's ring is the line's reading bar, drawn from the same value.
      if (frame.lim !== "off") set(dash, "--lim", extra.ring.toFixed(2));
      if (extra.speed !== shownSpeed) {
        shownSpeed = extra.speed;
        const next = speedCells(extra.speed);
        for (let i = 0; i < cells.length; i += 1) {
          if (next[i] === drawnCells[i]) continue;
          drawnCells[i] = next[i];
          cells[i].textContent = next[i];
        }
      }
    },
  };
}
