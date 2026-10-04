import styles from "./Control.module.css";

export type Segment = {
  key: string;
  /** Short visible text, for example "EN". */
  label: string;
  /** Full accessible name, for example "English". */
  name: string;
  href: string;
  current: boolean;
  /** Language of the target page, for language switches. */
  lang?: string;
};

type Props = { label: string; segments: Segment[] };

/**
 * Segmented navigation: one pill, the current option filled and marked with
 * `aria-current`, the others are links. Used for the language switch.
 */
export function SegmentedNav({ label, segments }: Props) {
  return (
    <nav aria-label={label} className={styles.segmented}>
      {segments.map((segment) =>
        segment.current ? (
          <span key={segment.key} className={styles.segment} aria-current="true" title={segment.name}>
            <span aria-hidden="true">{segment.label}</span>
            <span className="sr-only">{segment.name}</span>
          </span>
        ) : (
          <a
            key={segment.key}
            className={styles.segment}
            href={segment.href}
            hrefLang={segment.lang}
            lang={segment.lang}
            title={segment.name}
          >
            <span aria-hidden="true">{segment.label}</span>
            <span className="sr-only">{segment.name}</span>
          </a>
        ),
      )}
    </nav>
  );
}
