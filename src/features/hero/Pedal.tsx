"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import styles from "./Hero.module.css";

type Props = {
  /** Accessible name ("Hold to drive"); it starts with the tag's word. */
  label: string;
  /** The word beside it on a long wait ("Hold"). */
  tag: string;
  /** What it does, for screen readers. */
  help: string;
};

const RIBS = [0, 1, 2, 3, 4, 5];

/**
 * The pedal (scroll/pedal.ts): an original floor-hinged accelerator, a real
 * button in the thumb corner. Press it for the next line, hold it to keep
 * driving. HeroStage presses and releases it and draws its state (data-*
 * and --lv, her foot); this component only renders it and keeps a finger
 * on it out of the page's scroll: its touches are cancelled and stopped
 * here, natively (React's touch listeners are passive), so the phone shows
 * no magnifier, callout or menu under a held thumb and Lenis never takes
 * the thumb for a scroll stroke while a second finger swipes the picture.
 * Its six ribs are the dash's shift lights in miniature; the hinge becomes
 * a W keycap where there is a keyboard (Hero.module.css).
 */
export function Pedal({ label, tag, help }: Props) {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = button.current;
    if (!el) return;
    const hold = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    };
    const keep = (event: TouchEvent) => event.stopPropagation();
    el.addEventListener("touchstart", hold, { passive: false });
    el.addEventListener("touchmove", hold, { passive: false });
    el.addEventListener("touchend", keep);
    el.addEventListener("touchcancel", keep);
    return () => {
      el.removeEventListener("touchstart", hold);
      el.removeEventListener("touchmove", hold);
      el.removeEventListener("touchend", keep);
      el.removeEventListener("touchcancel", keep);
    };
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.pedal}
        data-pedal
        data-vis="hidden"
        aria-label={label}
        aria-describedby="hero-pedal-help"
        aria-keyshortcuts="W Space"
      >
        {/* The pedal itself; the button around it is its larger hit area, out toward the thumb. */}
        <span className={styles.pedalBody} aria-hidden="true">
          <span className={styles.pedalTag}>{tag}</span>
          <span className={styles.plateBox}>
            <span className={styles.plate}>
              {RIBS.map((rib) => (
                <i key={rib} className={styles.rib} style={{ "--r": rib } as CSSProperties} />
              ))}
              <span className={styles.gate} />
            </span>
          </span>
          <span className={styles.hinge}>
            <b className={styles.hingeKey} data-pedal-key>
              W
            </b>
          </span>
        </span>
      </button>
      <span id="hero-pedal-help" className={`sr-only ${styles.helpMotion}`}>
        {help}
      </span>
    </>
  );
}
