import type { ReactNode } from "react";
import { ChapterCard, chapterVars } from "@/components/ChapterCard/ChapterCard";
import { formatFrequency } from "@/features/music/stations";
import type { Dictionary } from "@/i18n/dictionaries";
import { BackToTop } from "./BackToTop";
import {
  BUILT_WITH,
  CAR_CREDIT,
  CAT_BASE_CREDIT,
  CAST_CATS,
  CC0_ASSETS,
  COPYRIGHT,
  creditList,
  DIRECTOR,
  FILM_TITLE,
  musicCredits,
  OFL_URL,
  RELIEF_CREDIT,
  TOOLKIT,
  TYPEFACES,
  trackByline,
} from "./credits";
import { cq, PLATES } from "./finaleLayout";
import { GITHUB_PROFILE, LINKEDIN_PROFILE, PROFILE_LABELS } from "./links";
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

/**
 * The marquee board on both plates, in cqw of a container as wide as the
 * plate: where the "held over" snipe is pasted (its top-right corner), and
 * what the roll's chapter card keeps clear of.
 */
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
 * One credit of the fine print: its role over its name, its note and any
 * list, so two fit side by side in the roll (Credits.module.css, .cells).
 */
function Cell({ role, children, note, list }: { role: ReactNode; children?: ReactNode; note?: ReactNode; list?: ReactNode }) {
  return (
    <div className={styles.cell}>
      <dt>{role}</dt>
      <dd>
        {children ? <span className={styles.name}>{children}</span> : null}
        {note ? <span className={styles.note}>{note}</span> : null}
        {list}
      </dd>
    </div>
  );
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
 * text, the contact before the fine print: the title, the cast (the driver
 * plays himself, and each cat its alias from the character select), then THANKS FOR DRIVING BY
 * and the two contact tickets, then every licence credit the site owes
 * (the car, the traffic, the driver's body, the cats' base, the map's
 * relief, every radio track, the typefaces) with his toolkit and what the
 * site is built with, compact and still whole, and the last line. The
 * career and the side projects are not here: STATS, the career city and
 * the cinema tell them. On wide screens the frame holds still while the
 * roll scrolls over its right side; on portrait screens the frame comes
 * first and the roll follows. No animation runs on its own: the roll is
 * the page's own scroll.
 *
 * The roll opens on its chapter card, THAT'S A WRAP (the director's call,
 * before Jesús says "Roll credits"), as wide as the roll, in the slot the
 * small CREDITS eyebrow had: it grows up into the empty lead-in, so his
 * line rests exactly where it did.
 */
export function EndCredits({ dict, newTab, locale }: Props) {
  const rows = dict.marquee.rows;
  const sizes = marqueeSizes(DAWN, rows.map((row) => [row]), false);
  const tiles = rowsTiles(rows, 10);
  const opensNewTab = <span className="sr-only"> {newTab}</span>;
  const quote = (text: string) => `${dict.music.quotes[0]}${text}${dict.music.quotes[1]}`;

  return (
    <section id="credits" className={styles.credits} aria-labelledby="credits-title" style={boardVars()}>
      <div className={styles.frame} aria-hidden="true">
        <div className={styles.stage}>
          <PlatePicture mood="dawn" locale={locale} className={styles.plate} />
          <div className={`${marqueeStyles.marquee} ${styles.marquee}`}>
            {tiles.map((row, i) => (
              <MarqueeRow key={i} tiles={row} style={rowVars(DAWN, i, sizes)} />
            ))}
          </div>
          <span className={styles.snipeBoard}>
            <span className={styles.snipe}>{dict.marquee.snipe}</span>
          </span>
        </div>
      </div>

      <div className={styles.roll}>
        <span className={styles.fadeTop} aria-hidden="true" />
        <div className={styles.chapterSlot} style={chapterVars(dict.chapter, locale)}>
          <ChapterCard id="credits-title" chapter={dict.chapter} lang={locale} className={styles.chapter} />
        </div>
        <p className={styles.card}>
          <span className={styles.speaker}>{dict.speaker}:</span> {dict.opening}
        </p>

        <p className={styles.film}>{FILM_TITLE}</p>
        <dl className={styles.pairs}>
          <Pair role={dict.written}>{DIRECTOR}</Pair>
        </dl>

        <Block id="credits-cast" title={dict.cast.title}>
          <dl className={styles.pairs}>
            <Pair role={dict.cast.driver}>{dict.cast.himself}</Pair>
            {CAST_CATS.map((cat) => (
              <Pair key={cat.id} role={dict.cast.roles[cat.id]}>
                {cat.name}
              </Pair>
            ))}
          </dl>
        </Block>

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

        {/* The fine print: smaller, two credits to a row where the roll is wide enough, every word still on the page. */}
        <div className={styles.fine}>
          <Block id="credits-assets" title={dict.assets.title}>
            <dl className={styles.cells}>
              {/* CC BY 3.0 asks for the source, the licence and a note of changes. */}
              <Cell
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
              </Cell>
              {CC0_ASSETS.map((asset) => (
                <Cell key={asset.role} role={dict.assets[asset.role]}>
                  {asset.maker} · {asset.licence}
                </Cell>
              ))}
              {/* Apache-2.0: the licence travels with the renders (public/interlude/LICENSE.txt); changes noted. */}
              <Cell
                role={<a href={CAT_BASE_CREDIT.sourceUrl}>{dict.assets.cats}</a>}
                note={
                  <>
                    <a href={CAT_BASE_CREDIT.licenceUrl} rel="license">
                      {CAT_BASE_CREDIT.licence}
                    </a>
                    {" · "}
                    {dict.assets.catsModified}
                  </>
                }
              >
                {CAT_BASE_CREDIT.author}
              </Cell>
              {/* Public domain: nothing is owed, it is credited anyway (public/stats/LICENSE.txt). */}
              <Cell
                role={<a href={RELIEF_CREDIT.sourceUrl}>{dict.assets.relief}</a>}
                note={`${RELIEF_CREDIT.makers.join(" · ")} · ${dict.assets.publicDomain}`}
              >
                {RELIEF_CREDIT.datasets.join(" · ")}
              </Cell>
              <Cell role={dict.assets.made}>{dict.assets.madeHere}</Cell>
            </dl>
          </Block>

          {/* Pixabay and CC0 ask for nothing, every track is credited anyway
              (title, author, source, licence, a note of changes); a CC BY 4.0
              track would be credited in its author's own format. */}
          <Block id="credits-music" title={dict.music.title}>
            <p className={styles.aside}>{dict.music.edited}</p>
            <dl className={styles.cells}>
              {musicCredits().map(({ station, credits }) => (
                <Cell
                  key={station.id}
                  role={
                    <span className={styles.station} style={{ "--accent": `var(--va-radio-${station.accent})` } as Vars}>
                      {station.name} {formatFrequency(station.frequency)}
                    </span>
                  }
                  list={
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
                  }
                />
              ))}
            </dl>
          </Block>

          <Block id="credits-type" title={dict.type.title}>
            <dl className={styles.cells}>
              <Cell role={dict.type.site}>{creditList(TYPEFACES.site)}</Cell>
              <Cell role={dict.type.radio}>{creditList(TYPEFACES.radio)}</Cell>
              <Cell role={dict.type.posters}>{creditList(TYPEFACES.posters)}</Cell>
              <Cell role={dict.type.licences} note={dict.type.apache}>
                <a href={OFL_URL} rel="license">
                  SIL Open Font License
                </a>
              </Cell>
            </dl>
          </Block>

          {/* Side by side: no name is in both (credits.test.ts). */}
          <div className={styles.lists}>
            <Block id="credits-toolkit" title={dict.toolkit}>
              <p className={styles.list}>{creditList([...TOOLKIT, dict.toolkitMore])}</p>
            </Block>
            <Block id="credits-built" title={dict.builtWith}>
              <p className={styles.list}>{creditList(BUILT_WITH)}</p>
            </Block>
          </div>

          <p className={styles.aside}>{dict.notice}</p>
        </div>

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
