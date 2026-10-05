import { Fragment, type ReactNode } from "react";
import { formatFrequency } from "@/features/music/stations";
import type { Dictionary } from "@/i18n/dictionaries";
import { BackToTop } from "./BackToTop";
import {
  BUILT_WITH,
  CAR_CREDIT,
  CAREER,
  CAST_CATS,
  CC0_ASSETS,
  COPYRIGHT,
  creditList,
  DIRECTOR,
  EQUIPMENT,
  FILM_TITLE,
  musicCredits,
  OFL_URL,
  TYPEFACES,
  trackByline,
  yearsLabel,
} from "./credits";
import { cq, PLATES } from "./finaleLayout";
import { FEATURES, GITHUB_PROFILE, LINKEDIN_PROFILE, PROFILE_LABELS } from "./links";
import { marqueeSizes, MarqueeRow, rowsTiles, rowVars, type PlatePair, type Vars } from "./Marquee";
import marqueeStyles from "./Marquee.module.css";
import { PlatePicture } from "./PlatePicture";
import styles from "./Credits.module.css";

const DAWN: PlatePair = { wide: "dawn-wide", tall: "dawn-tall" };

type Props = {
  dict: Dictionary["credits"];
  newTab: string;
  locale: string;
};

/** Where the "held over" snipe is pasted: the marquee board's top-right corner, on both plates. */
function boardVars(): Vars {
  const vars: Vars = {};
  for (const [layout, name] of Object.entries(DAWN) as ["wide" | "tall", keyof typeof PLATES][]) {
    const plate = PLATES[name];
    const p = layout === "wide" ? "w" : "t";
    vars[`--${p}-bx`] = cq(plate, plate.board.x);
    vars[`--${p}-by`] = cq(plate, plate.board.y);
    vars[`--${p}-bw`] = cq(plate, plate.board.w);
    vars[`--${p}-bh`] = cq(plate, plate.board.h);
  }
  return vars;
}

function Pair({ role, children, note }: { role: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className={styles.pair}>
      <dt>{role}</dt>
      <dd>
        <span className={styles.name}>{children}</span>
        {note ? <span className={styles.note}>{note}</span> : null}
      </dd>
    </div>
  );
}

/**
 * Repository names as the roll lists them (creditList's dots), each kept on
 * one line: a wrap at a hyphen read "Expenses-Log- / App".
 */
function RepoList({ repos }: { repos: readonly string[] }) {
  return repos.map((repo, i) => (
    <Fragment key={repo}>
      {i > 0 ? "\u00a0· " : null}
      <span className={styles.repo}>{repo}</span>
    </Fragment>
  ));
}

/** A block of the roll under its h3 (a plain group: eight named regions would only crowd the landmarks). */
function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div className={styles.block}>
      <h3 id={id} className={styles.head}>
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * The end credits: the last show at The Afterglow, at dawn. The cinema's
 * marquee carries one name, and the credits roll over the frame as real
 * text that doubles as a plain CV (the career, the equipment), then the
 * cast, every licence credit the site owes (the car, the traffic, the
 * driver's body, every radio track, the typefaces), the two contact
 * tickets and the last line. On wide screens the
 * frame holds still while the roll scrolls over its right side; on portrait
 * screens the frame comes first and the roll follows. No animation runs on
 * its own: the roll is the page's own scroll.
 */
export function EndCredits({ dict, newTab, locale }: Props) {
  const rows = dict.marquee.rows;
  const sizes = marqueeSizes(DAWN, rows.map((row) => [row]), false);
  const tiles = rowsTiles(rows, 10);
  const opensNewTab = <span className="sr-only"> {newTab}</span>;
  const quote = (text: string) => `${dict.music.quotes[0]}${text}${dict.music.quotes[1]}`;

  return (
    <section id="credits" className={styles.credits} aria-labelledby="credits-title">
      <div className={styles.frame} aria-hidden="true">
        <div className={styles.stage}>
          <PlatePicture mood="dawn" locale={locale} className={styles.plate} />
          <div className={`${marqueeStyles.marquee} ${styles.marquee}`}>
            {tiles.map((row, i) => (
              <MarqueeRow key={i} tiles={row} style={rowVars(DAWN, i, sizes)} />
            ))}
          </div>
          <span className={styles.snipeBoard} style={boardVars()}>
            <span className={styles.snipe}>{dict.marquee.snipe}</span>
          </span>
        </div>
      </div>

      <div className={styles.roll}>
        <span className={styles.fadeTop} aria-hidden="true" />
        <h2 id="credits-title" className={styles.eyebrow}>
          {dict.title}
        </h2>
        <p className={styles.card}>
          <span className={styles.speaker}>{dict.speaker}:</span> {dict.opening}
        </p>

        <p className={styles.film}>{FILM_TITLE}</p>
        <p className={styles.byline}>{dict.byline}</p>
        <dl className={styles.pairs}>
          <Pair role={dict.written}>{DIRECTOR}</Pair>
        </dl>

        <Block id="credits-career" title={dict.career.title}>
          <dl className={styles.pairs}>
            {CAREER.map((entry) => {
              const years = yearsLabel(entry);
              return (
                <Pair
                  key={entry.id}
                  role={dict.career.roles[entry.id]}
                  note={
                    <>
                      {entry.place ? `${entry.place} · ` : null}
                      <span className={styles.years}>
                        {years.from} –{" "}
                        {years.live ? (
                          <>
                            <span lang="en" className={styles.live}>
                              {years.to}
                            </span>
                            <span className="sr-only"> ({dict.career.present})</span>
                          </>
                        ) : (
                          years.to
                        )}
                      </span>
                    </>
                  }
                >
                  {entry.company ?? dict.career.army}
                </Pair>
              );
            })}
          </dl>
        </Block>

        <Block id="credits-projects" title={dict.sideProjects}>
          <p className={styles.list}>
            <RepoList repos={FEATURES.map((feature) => feature.repo)} />
          </p>
        </Block>

        <Block id="credits-equipment" title={dict.equipment}>
          <p className={styles.list}>{creditList(EQUIPMENT)}</p>
        </Block>

        <Block id="credits-cast" title={dict.cast.title}>
          <dl className={styles.pairs}>
            <Pair role={dict.cast.driver}>{DIRECTOR}</Pair>
            <Pair role={dict.cast.suspects}>{creditList(CAST_CATS)}</Pair>
            {/*
             * TODO(cats package): when tools/blender/build_cats.py lands its
             * renders in public/interlude/, credit them here as rendered in
             * Blender (a note on this pair, or a line under it, with keys in
             * both dictionaries and a test). Not before: today the line-up
             * shows placeholder silhouettes drawn in code, so the credits
             * have no cat render to name. Odin stays unnamed either way.
             */}
          </dl>
        </Block>

        <Block id="credits-assets" title={dict.assets.title}>
          <dl className={styles.pairs}>
            {/* CC BY 3.0 asks for the source, the licence and a note of changes. */}
            <Pair
              role={<a href={CAR_CREDIT.sourceUrl}>{dict.assets.car}</a>}
              note={
                <>
                  <a href={CAR_CREDIT.licenceUrl} rel="license">
                    {CAR_CREDIT.licence}
                  </a>
                  {" · "}
                  {dict.assets.modified}
                </>
              }
            >
              {CAR_CREDIT.author}
            </Pair>
            {CC0_ASSETS.map((asset) => (
              <Pair key={asset.role} role={dict.assets[asset.role]}>
                {asset.maker} · {asset.licence}
              </Pair>
            ))}
            <Pair role={dict.assets.made}>{dict.assets.madeHere}</Pair>
          </dl>
        </Block>

        {/* CC BY 4.0 asks for the title, the author, the source, the licence
            and a note of changes for every track, in Kevin MacLeod's own
            format; CC0 and Pixabay ask for nothing, they are credited anyway. */}
        <Block id="credits-music" title={dict.music.title}>
          <p className={styles.aside}>{dict.music.edited}</p>
          <dl className={styles.pairs}>
            {musicCredits().map(({ station, credits }) => (
              <div key={station.id} className={`${styles.pair} ${styles.stationPair}`}>
                <dt>
                  <span className={styles.station} style={{ "--accent": `var(--va-radio-${station.accent})` } as Vars}>
                    {station.name} {formatFrequency(station.frequency)}
                  </span>
                </dt>
                <dd>
                  <ul className={styles.tracks}>
                    {credits.map((credit) => (
                      <li key={credit.sourceUrl}>
                        <a href={credit.sourceUrl}>{quote(credit.title)}</a> {trackByline(credit, dict.music.by)},{" "}
                        <a href={credit.licenceUrl} rel="license">
                          {dict.music.licences[credit.licence]}
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block id="credits-type" title={dict.type.title}>
          <dl className={styles.pairs}>
            <Pair role={dict.type.site}>{creditList(TYPEFACES.site)}</Pair>
            <Pair role={dict.type.radio}>{creditList(TYPEFACES.radio)}</Pair>
            <Pair role={dict.type.posters}>{creditList(TYPEFACES.posters)}</Pair>
            <Pair role={dict.type.licences} note={dict.type.apache}>
              <a href={OFL_URL} rel="license">
                SIL Open Font License
              </a>
            </Pair>
          </dl>
        </Block>

        <Block id="credits-built" title={dict.builtWith}>
          <p className={styles.list}>{creditList(BUILT_WITH)}</p>
        </Block>

        <p className={styles.aside}>{dict.notice}</p>
        <p className={styles.aside}>{dict.gag}</p>

        <section id="contact" className={styles.contact} aria-labelledby="contact-title">
          <h3 id="contact-title" className="sr-only">
            {dict.contact.title}
          </h3>
          <p className={styles.head} aria-hidden="true">
            {dict.thanks}
          </p>
          <ul className={styles.tickets}>
            {(
              [
                ["code", GITHUB_PROFILE, "GitHub", PROFILE_LABELS.github, "000214"],
                ["record", LINKEDIN_PROFILE, "LinkedIn", PROFILE_LABELS.linkedin, "000215"],
              ] as const
            ).map(([kind, href, name, label, serial]) => (
              <li key={kind}>
                <a className={styles.ticket} data-kind={kind} href={href} target="_blank" rel="me noopener noreferrer">
                  <span className={styles.stub} aria-hidden="true">
                    <span className={styles.admit}>{dict.contact.admit}</span>
                    <span className={styles.serial}>Nº {serial}</span>
                  </span>
                  <span className={styles.ticketMain}>
                    <span className={styles.ticketNote} aria-hidden="true">
                      {dict.contact.admit} · {dict.contact[kind]}
                    </span>
                    <span className={styles.ticketName}>
                      {name}
                      <span className={styles.ticketArrow} aria-hidden="true">
                        ↗
                      </span>
                    </span>
                    <span className={styles.ticketUrl}>{label}</span>
                    {opensNewTab}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className={styles.end}>{dict.end}</p>
        <p className={styles.copyright}>{COPYRIGHT}</p>
        <p className={`${styles.card} ${styles.last}`}>
          <span className={styles.speaker}>{dict.speaker}:</span> {dict.last}
        </p>
        <p className={styles.top}>
          <BackToTop label={dict.top} className={styles.topLink} />
        </p>
        <span className={styles.fadeBottom} aria-hidden="true" />
      </div>
    </section>
  );
}

