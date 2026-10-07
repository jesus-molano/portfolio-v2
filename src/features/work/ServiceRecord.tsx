import type { Dictionary } from "@/i18n/dictionaries";
import { SERVICE_RECORD_ID } from "./stops";
import styles from "./Work.module.css";

type Props = { record: Dictionary["work"]["record"] };

/** The paper's noise and the stamps' ink, drawn once (the record is the page's only one). */
const GRAIN = {
  fibre: "va-record-fibre",
  foxing: "va-record-foxing",
  ink: "va-record-ink",
  wrinkle: "va-record-wrinkle",
} as const;

/**
 * The army's board opens its own record, not an external page: an old,
 * creased paper form in a popover. Every word is real text in the server
 * HTML (the form's fields as a description list, the stamps as short
 * paragraphs); the paper, its fibres and foxing, the folds, the dog-ear,
 * the staple and the coffee ring are drawn in CSS and one inline SVG,
 * hidden from screen readers. The field numbers are the form's print, not
 * content, so they are hidden too.
 */
export function ServiceRecord({ record }: Props) {
  return (
    <div
      id={SERVICE_RECORD_ID}
      className={styles.record}
      popover="auto"
      aria-labelledby="service-record-title"
      data-lenis-prevent
    >
      <div className={styles.recordSheet}>
        <div className={styles.recordPaper}>
          <svg className={styles.recordGrain} aria-hidden="true" focusable="false">
            <defs>
              {/* Wrinkles: a soft relief lit from the top left, so a handled sheet's crumples shade. */}
              <filter id={GRAIN.wrinkle} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                <feTurbulence type="turbulence" baseFrequency="0.011 0.009" numOctaves="4" seed="11" />
                <feDiffuseLighting className={styles.recordLight} surfaceScale="4" diffuseConstant="1.2">
                  <feDistantLight azimuth="235" elevation="55" />
                </feDiffuseLighting>
              </filter>
              {/* Fibres: fine noise, its brightest specks only, in the fibre colour. */}
              <filter id={GRAIN.fibre} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="1.1 0.7" numOctaves="2" seed="7" />
                <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 2.4 0 -1.25" />
                <feComposite in="SourceGraphic" operator="in" />
              </filter>
              {/* Foxing: large soft blotches where the paper has browned. */}
              <filter id={GRAIN.foxing} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="21" />
                <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -1.75" />
                <feComposite in="SourceGraphic" operator="in" />
              </filter>
              {/* A rubber stamp's uneven ink: the edges roughened, specks of paper left bare. */}
              <filter id={GRAIN.ink} x="-5%" y="-10%" width="110%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" result="rough" />
                <feColorMatrix
                  in="noise"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.2"
                  result="holes"
                />
                <feComposite in="rough" in2="holes" operator="in" />
              </filter>
            </defs>
            <rect className={styles.recordWrinkles} width="100%" height="100%" filter={`url(#${GRAIN.wrinkle})`} />
            <rect className={styles.recordFoxing} width="100%" height="100%" filter={`url(#${GRAIN.foxing})`} />
            <rect className={styles.recordFibre} width="100%" height="100%" filter={`url(#${GRAIN.fibre})`} />
          </svg>
          <span className={styles.recordCoffee} aria-hidden="true" />
          <span className={styles.recordStaple} aria-hidden="true" />

          <div className={styles.recordForm}>
            <p id="service-record-title" className={styles.recordTitle}>
              {record.title}
            </p>
            <p className={`${styles.recordStamp} ${styles.recordStampCopy}`}>{record.stamps.copy}</p>
            <dl className={styles.recordRows}>
              {record.rows.map((row, i) => (
                <div key={row.label} className={styles.recordRow}>
                  <dt>
                    <span className={styles.recordNumber} aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {row.label}
                  </dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div className={styles.recordRemarks}>
                <dt>{record.remarks.label}</dt>
                <dd>{record.remarks.value}</dd>
              </div>
            </dl>
            <div className={styles.recordFoot}>
              <button
                type="button"
                className={styles.recordClose}
                popoverTarget={SERVICE_RECORD_ID}
                popoverTargetAction="hide"
              >
                {record.close}
              </button>
              <p className={`${styles.recordStamp} ${styles.recordStampFiled}`}>{record.stamps.filed}</p>
            </div>
          </div>
          <span className={styles.recordCorner} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
