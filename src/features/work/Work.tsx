import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { SERVICE_RECORD_ID, STOPS } from "./stops";
import styles from "./Work.module.css";
import { WorkStage } from "./WorkStage";
import { stageHeightVh, workTimeline } from "./workTimeline";

type Props = { work: Dictionary["work"]; common: Dictionary["common"]; pedal: Dictionary["hero"]["pedal"]; osd: Dictionary["hero"]["osd"]; locale: Locale };

/**
 * Without JavaScript there is no film: the stops show as plates, as under
 * reduced motion (Work.module.css), with their chips as plain links.
 */
const NO_JS_STYLE = [
  "[data-work-stage]{height:auto;padding:6rem 0 4rem}",
  "[data-work-sticky]{display:none}",
  "[data-title]{position:static;height:auto;margin:0 0 3rem}",
  "[data-work-stops]{position:static;display:grid;gap:3rem;width:min(46rem,calc(100% - 2.5rem));margin:0 auto;pointer-events:auto}",
  "[data-work-item]{position:static;height:auto}",
  "[data-plate]{position:static;width:auto;height:auto;overflow:visible;clip-path:none;white-space:normal}",
  "[data-chip]{opacity:1;pointer-events:auto}",
].join("");

/** The same height in both languages: the longer script sets it. */
const STAGE_VH = stageHeightVh([workTimeline(en.work), workTimeline(es.work)]);

/**
 * The career as a night drive (`#work`): a pinned stage like the hero's,
 * over five real articles, one per stop, each placed at its stretch of the
 * scroll. The articles carry the text (heading, place and years, what he
 * did, what he says) and the stop's one control, so keyboard and
 * screen-reader users, crawlers and reduced motion get the whole career.
 */
export function Work({ work, common, pedal, osd, locale }: Props) {
  const timeline = workTimeline(work);
  const style = { "--stage-h": `calc(${STAGE_VH} * var(--va-lvh))` } as CSSProperties;

  return (
    <section
      id="work"
      className={styles.work}
      aria-labelledby="work-title"
      aria-describedby="work-help"
      style={style}
    >
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: NO_JS_STYLE }} />
      </noscript>
      <WorkStage work={work} cues={common.cues} pedal={pedal} osd={osd} locale={locale}>
        <ol className={styles.stops} data-work-stops>
          {STOPS.map((stop, i) => {
            const copy = work.stops[stop.id];
            const range = timeline.stops[i];
            const cards = timeline.cards.filter((card) => card.stop === i);
            const place = {
              "--from": range.from.toFixed(5),
              "--to": range.to.toFixed(5),
            } as CSSProperties;
            const live = stop.years[1] === null;
            return (
              <li key={stop.id} className={styles.stopItem} style={place} data-work-item>
                <article id={stop.anchor} className={styles.stop} aria-labelledby={`${stop.anchor}-h`} data-stop>
                  <div className={styles.plate} data-plate>
                    <p className={styles.plateIndex} aria-hidden="true">
                      {work.stop} {String(stop.index).padStart(2, "0")}/{String(STOPS.length).padStart(2, "0")}
                    </p>
                    <h3 id={`${stop.anchor}-h`} className={styles.stopHeading}>
                      {copy.h3}
                    </h3>
                    <p className={styles.plateSuper}>
                      {stop.years[0]}–{stop.years[1] ?? ""}
                      {live ? (
                        <>
                          {" "}
                          <span className={styles.liveDot} aria-hidden="true" /> <span lang="en">{work.live}</span>
                        </>
                      ) : null}
                    </p>
                    <p className={styles.mirror}>{copy.mirror}</p>
                    <ol className={styles.transcript} aria-label={work.transcript}>
                      {cards.map((card) => (
                        <li key={card.id}>
                          <span className={styles.plateSpeaker}>{work.speaker}:</span> {card.text}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className={styles.chipSlot}>
                    {stop.href ? (
                      <a
                        className={styles.chip}
                        href={stop.href[locale]}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${copy.chipName} ${common.newTab}`}
                        data-chip
                      >
                        {copy.chip}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.chip}
                        popoverTarget={SERVICE_RECORD_ID}
                        aria-label={copy.chipName}
                        data-chip
                      >
                        {copy.chip}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>

        {/* The army's board opens its own record, not an external page. */}
        <div id={SERVICE_RECORD_ID} className={styles.record} popover="auto" aria-labelledby="service-record-title">
          <p id="service-record-title" className={styles.recordTitle}>
            {work.record.title}
          </p>
          <dl className={styles.recordRows}>
            {work.record.rows.map((row) => (
              <div key={row.label} className={styles.recordRow}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className={styles.recordClose}
            popoverTarget={SERVICE_RECORD_ID}
            popoverTargetAction="hide"
          >
            {work.record.close}
          </button>
        </div>
      </WorkStage>
    </section>
  );
}
