"use client";

import { useState } from "react";
import styles from "./Suspects.module.css";

type Props = {
  /** "Nº 03": read by eye only, like every other plate's number. */
  number: string;
  name: string;
  alias: string;
  /** The verdict: "Culpable", "Guilty". */
  stamp: string;
};

/** Ties the plate's button to its stamp; there is one culprit on the page. */
const STAMP_ID = "suspects-verdict";

/**
 * The culprit's plate (lineup.ts, CULPRIT): the same letter-board plate as
 * the others, but a button with the verdict hidden on it. Nothing shows at
 * first sight. Pointer hover and keyboard focus bring the stamp up (CSS,
 * so it works before hydration and without script); a click or a tap pins
 * it, and aria-expanded says so to a screen reader, which then finds the
 * stamp right after the plate. Under reduced motion it simply appears.
 */
export function CulpritPlate({ number, name, alias, stamp }: Props) {
  const [pinned, setPinned] = useState(false);
  return (
    <div className={styles.culprit}>
      <button
        type="button"
        className={`${styles.plate} ${styles.plateButton}`}
        aria-expanded={pinned}
        aria-controls={STAMP_ID}
        onClick={() => setPinned((shown) => !shown)}
      >
        <span className={styles.number} aria-hidden="true">
          {number}
        </span>
        <span className={styles.name}>{name}</span>
        <span className="sr-only">, </span>
        <span className={styles.alias}>{alias}</span>
      </button>
      <span id={STAMP_ID} className={styles.stamp}>
        {stamp}
      </span>
    </div>
  );
}
