import { ChapterCard, chapterVars } from "@/components/ChapterCard/ChapterCard";
import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Achievements } from "./Achievements";
import { StatsIcon } from "./icons";
import styles from "./Stats.module.css";
import { StatsSettings } from "./StatsSettings";
import { StatsPanel, StatsPortrait, StatsSection, StatsTabList } from "./StatsTabs";
import {
  CAREER_CITY_ON_PAGE,
  DOCK,
  FRAMES,
  HQ,
  MISSIONS,
  PLACES,
  blipPoint,
  toPercent,
  type CaptionSide,
  type LonLat,
  type MapPoint,
} from "./statsLayout";

type StatsDict = Dictionary["stats"];
type Props = { dict: StatsDict; lang: Locale };

const SIDE_CLASS: Record<CaptionSide, string> = {
  left: styles.left,
  right: styles.right,
  top: styles.top,
  bottom: styles.bottom,
  topLeft: styles.topLeft,
  topRight: styles.topRight,
  bottomLeft: styles.bottomLeft,
  bottomRight: styles.bottomRight,
};

/** CSS custom properties that place a point on both crops of the map (percentages). */
function placeAt(at: LonLat, inset = false): CSSProperties {
  const wide = toPercent(FRAMES.wide, blipPoint(FRAMES.wide, at, inset));
  const square = toPercent(FRAMES.square, blipPoint(FRAMES.square, at, inset));
  return { "--x": wide.left, "--y": wide.top, "--xs": square.left, "--ys": square.top } as CSSProperties;
}

function placeMapPoint(wide: MapPoint, square: MapPoint): CSSProperties {
  const w = toPercent(FRAMES.wide, wide);
  const s = toPercent(FRAMES.square, square);
  return { "--x": w.left, "--y": w.top, "--xs": s.left, "--ys": s.top } as CSSProperties;
}

/** The Gran Canaria box, as percentages of each crop. */
function insetBox(): CSSProperties {
  const box = (id: "wide" | "square") => {
    const { inset, width, height } = FRAMES[id];
    return [(inset.x / width) * 100, (inset.y / height) * 100, (inset.width / width) * 100, (inset.height / height) * 100];
  };
  const [x, y, w, h] = box("wide");
  const [xs, ys, ws, hs] = box("square");
  return { "--x": x, "--y": y, "--w": w, "--h": h, "--xs": xs, "--ys": ys, "--ws": ws, "--hs": hs } as CSSProperties;
}

function years(from: number, to: number | null): string {
  return to === null ? String(from) : `${from}–${to}`;
}

/**
 * STATS: the pause menu after the career city. The game is paused: its
 * chapter card says so (Pausa / Paused), the world behind the menu
 * freezes as it arrives and the radio goes behind it (StatsTabs.tsx).
 * One screen with four tabs, like a game's pause menu, the player profile
 * first:
 *
 * - STATS: the portrait with About me (how he works), the skills and the records.
 * - MAP: career geography only. The main missions say how each job was
 *   done, on site or remote; the map shows where: the army in Gran
 *   Canaria, PwC at the dock, the rest from home base.
 * - ACHIEVEMENTS: his achievement tree, the favourites and the goals,
 *   unlocked and locked, as constellations in the night sky (Achievements.tsx).
 * - SETTINGS: the radio, the controls, the subtitle size and the language,
 *   all of them working (StatsSettings.tsx).
 *
 * A server component: every word of every tab is DOM text in the server
 * HTML; the tabs, the settings and the pause are the client parts.
 */
export function Stats({ dict, lang }: Props) {
  return (
    <StatsSection className={styles.stats} labelledBy="stats-title" style={chapterVars(dict.chapter, lang)}>
      <ChapterCard id="stats-title" chapter={dict.chapter} lang={lang} />

      <div className={styles.screen}>
        <MenuBar dict={dict} />
        {/* After the heading, where heading navigation lands. */}
        <p className="sr-only">{dict.description}</p>

        <StatsPanel tab="sheet">
          <Sheet dict={dict} />
        </StatsPanel>
        <StatsPanel tab="map">
          <CareerMap dict={dict} />
        </StatsPanel>
        <StatsPanel tab="achievements">
          <Achievements dict={dict.achievements} />
        </StatsPanel>
        <StatsPanel tab="settings">
          <StatsSettings dict={dict.settings} lang={lang} />
        </StatsPanel>
      </div>
    </StatsSection>
  );
}

/**
 * The menu bar: the paused glyph and the in-game clock, and the tabs. The
 * card above says "Paused"; the bar does not again. The clock's colon
 * ticks while the game runs and stops as it pauses (Stats.module.css).
 */
function MenuBar({ dict }: { dict: StatsDict }) {
  const colon = dict.clock.lastIndexOf(":");
  return (
    <header className={styles.menu}>
      <div className={styles.who} aria-hidden="true">
        <span className={styles.pause}>
          <i />
          <i />
        </span>
        <span className={styles.clock}>
          {colon < 0 ? (
            dict.clock
          ) : (
            <>
              {dict.clock.slice(0, colon)}
              <span className={styles.clockTick}>:</span>
              {dict.clock.slice(colon + 1)}
            </>
          )}
        </span>
      </div>
      <StatsTabList label={dict.tabsLabel} names={dict.tabs} />
    </header>
  );
}

/** Tab 1, STATS: the player profile. */
function Sheet({ dict }: { dict: StatsDict }) {
  return (
    <div className={styles.sheet}>
      <figure className={styles.card}>
        <div className={styles.portraitBox}>
          <StatsPortrait className={styles.portrait} src="/stats/portrait.webp" avif="/stats/portrait.avif" alt={dict.player.alt} width={660} height={825} />
          <span className={styles.player2} aria-hidden="true">
            {dict.player.player2}
          </span>
        </div>
        {/*
          About me, headed like the panels beside it: the owner's call (his
          name over the bio was a second title, and the portrait's text
          alternative already names him).
        */}
        <figcaption className={styles.plate}>
          <h3 id="stats-about" className={styles.panelTitle}>
            {dict.player.title}
          </h3>
          <p className={styles.bio}>{dict.player.bio}</p>
        </figcaption>
      </figure>

      <div className={`${styles.panel} ${styles.skills}`}>
        <h3 id="stats-skills" className={styles.panelTitle}>
          {dict.bars.title}
        </h3>
        <dl className={styles.bars}>
          {dict.bars.items.map((bar) => (
            <div
              key={bar.id}
              className={`${styles.bar} ${bar.value > 100 ? styles.over : ""} ${bar.value === 0 ? styles.zero : ""}`}
              style={{ "--v": bar.value } as CSSProperties}
            >
              <dt className={styles.barLabel}>{bar.label}</dt>
              <dd className={styles.barValue}>{bar.value}%</dd>
              <dd className={styles.track} aria-hidden="true">
                <span className={styles.fill} />
                {bar.value > 100 ? (
                  <>
                    <i className={styles.crumb} />
                    <i className={styles.crumb} />
                    <i className={styles.crumb} />
                  </>
                ) : null}
              </dd>
              <dd className={styles.barCaption}>{bar.caption}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={`${styles.panel} ${styles.records}`}>
        <h3 id="stats-records" className={styles.panelTitle}>
          {dict.records.title}
        </h3>
        <ul className={styles.recordList}>
          {/* The value's glyphs (stars, ∞, ≈) are for the eye; screen readers get it in words. */}
          {dict.records.items.map((record) => (
            <li key={record.id} className={styles[`record_${record.id}`]}>
              <span className={styles.recordValue} aria-hidden="true">
                {record.value}
              </span>
              <span className="sr-only">{record.spoken} </span>
              <span className={styles.recordCaption}>{record.caption}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** How a job was done, in the owner's words, with the map's glyph for it. */
function Mode({ mode, dict }: { mode: "onSite" | "remote"; dict: StatsDict }) {
  return (
    <span className={`${styles.mode} ${mode === "remote" ? styles.modeRemote : styles.modeOnSite}`}>
      <StatsIcon id={mode === "remote" ? "hq" : "site"} className={styles.modeIcon} />
      {dict.missions.modes[mode]}
    </span>
  );
}

/** Tab 2, MAP: where he has worked and where he is. */
function CareerMap({ dict }: { dict: StatsDict }) {
  const { map, missions } = dict;
  const placeName = (id: string) => map.places[id as keyof typeof map.places];
  const pwc = MISSIONS.find((mission) => mission.id === "pwc")!;
  const army = MISSIONS.find((mission) => mission.inset)!;

  return (
    <div className={styles.mapLayout}>
      {/*
        The career index first: beside the map from 1280 px, above it
        below that, and on a phone before the map.
      */}
      <div className={`${styles.panel} ${styles.missionsPanel}`}>
        <h3 id="stats-missions" className={styles.panelTitle}>
          {missions.title} <span className={styles.count}>· {missions.count}</span>
        </h3>
        <div className={styles.progress} aria-hidden="true">
          {MISSIONS.map((mission) => (
            <i key={mission.id} className={mission.live ? styles.progressLive : styles.progressDone} />
          ))}
        </div>
        <ol className={styles.missions}>
          {MISSIONS.map((mission) => {
            const item = missions.items[mission.id];
            // A link to its stop in the career city once that is on the page; a plain row until then.
            const Row = CAREER_CITY_ON_PAGE ? "a" : "div";
            return (
              <li key={mission.id}>
                <Row
                  className={`${styles.missionRow} ${mission.live ? styles.missionRowLive : ""}`}
                  href={CAREER_CITY_ON_PAGE ? `#${mission.anchor}` : undefined}
                >
                  <span className={styles.missionBadge} aria-hidden="true">
                    {mission.number}
                  </span>
                  <span className={styles.missionText}>
                    <span className={styles.missionMeta}>
                      <span className={styles.years} aria-hidden={mission.live ? true : undefined}>
                        {years(mission.years[0], mission.years[1])}
                      </span>
                      <Mode mode={mission.mode} dict={dict} />
                    </span>
                    <span className={styles.missionName}>{item.name}</span>
                    <span className={styles.role}>{item.role}</span>
                  </span>
                  <span className={styles.status}>
                    {mission.live ? (
                      <span className={styles.statusLive} aria-hidden="true">
                        <i />
                        <span lang="en">{missions.live}</span>
                      </span>
                    ) : (
                      <span className={styles.statusDone} aria-hidden="true">
                        ✓
                      </span>
                    )}
                    <span className="sr-only">, {mission.live ? missions.liveText : missions.done}</span>
                  </span>
                </Row>
              </li>
            );
          })}
        </ol>
      </div>

      <figure className={styles.map} aria-labelledby="stats-map-title">
        <div className={styles.mapHead}>
          <h3 id="stats-map-title" className={styles.mapTitle}>
            {map.title}
          </h3>
          {/* The map's key: a badge on a place was done there; at home base, remote. */}
          <p className={styles.mapKey} aria-hidden="true">
            <span className={styles.keyOnSite}>
              <i className={styles.keyBadge} />
              {missions.modes.onSite}
            </span>
            <span className={styles.keyRemote}>
              <StatsIcon id="hq" className={styles.keyHq} />
              {missions.modes.remote}
            </span>
          </p>
        </div>
        <div className={styles.mapBox}>
          <div className={styles.frame}>
            <picture>
              {/* Static SVG art: next/image has nothing to optimise, and <picture> picks the crop. */}
              <source media="(max-width: 999.98px)" srcSet="/stats/map-square.svg" width={1100} height={1100} />
              <img className={styles.art} src="/stats/map.svg" alt="" width={1600} height={1100} loading="lazy" decoding="async" />
            </picture>

            {/* Decoration: the parody names, the compass, the scale and the on-site missions' badges. */}
            <div className={styles.decor} aria-hidden="true">
              {PLACES.map((place) =>
                place.label ? (
                  <span
                    key={place.id}
                    className={`${styles.label} ${styles[`label_${place.kind}`]} ${place.minor ? styles.minor : ""}`}
                    style={placeAt(place.label, place.inset)}
                  >
                    {placeName(place.id)}
                  </span>
                ) : null,
              )}
              <span className={styles.north} style={placeMapPoint(FRAMES.wide.compass, FRAMES.square.compass)}>
                {map.north}
              </span>
              <span className={styles.scale} style={placeMapPoint(FRAMES.wide.scaleBar, FRAMES.square.scaleBar)}>
                {map.scale}
              </span>
              {MISSIONS.map((mission) =>
                mission.at === "home" ? null : (
                  <span key={mission.id} className={styles.mission} style={placeAt(mission.at, mission.inset)}>
                    <span className={styles.missionNumber}>{mission.number}</span>
                    <span className={styles.tick}>✓</span>
                  </span>
                ),
              )}
              <span className={`${styles.pin} ${styles.pinHq}`} style={placeAt(HQ.at)}>
                <StatsIcon id="hq" />
              </span>
            </div>
          </div>

          {/* The places: captions on the map from 1000 px, a legend below it on narrower screens. */}
          <ol className={styles.places}>
            <li className={`${styles.place} ${SIDE_CLASS[HQ.side]} ${styles.hq}`} style={placeAt(HQ.at)}>
              <span className={styles.marker} aria-hidden="true">
                <StatsIcon id="hq" />
              </span>
              <span className={styles.caption}>
                <span className={styles.text}>{map.hq}</span>
              </span>
              {/* The jobs done remote: their badges, beside home base. */}
              <span className={styles.homeStack} aria-hidden="true">
                {MISSIONS.filter((mission) => mission.at === "home").map((mission) => (
                  <span key={mission.id} className={`${styles.mission} ${mission.live ? styles.missionLive : ""}`}>
                    <span className={styles.missionNumber}>{mission.number}</span>
                    {mission.live ? (
                      <span className={styles.liveTag} lang="en">
                        {missions.live}
                      </span>
                    ) : (
                      <span className={styles.tick}>✓</span>
                    )}
                  </span>
                ))}
              </span>
            </li>
            {/* The dock: PwC's badge is on the map; its name beside it (a legend row below 1000 px). */}
            <li className={`${styles.place} ${SIDE_CLASS[DOCK.side]} ${styles.dock}`} style={placeAt(DOCK.at)}>
              <span className={styles.key} aria-hidden="true">
                {pwc.number}
              </span>
              <span className={styles.caption}>
                <span className={styles.text}>{map.dock}</span>
              </span>
            </li>
            {/* Gran Canaria's box: the island and its city, named like the rest (mission 1 is on it; its badge leads the legend row). */}
            <li className={styles.inset} style={insetBox()}>
              <span className={styles.key} aria-hidden="true">
                {army.number}
              </span>
              <span className={styles.insetName}>{map.inset.name}</span>
              <span className={styles.insetCity}>{map.inset.city}</span>
            </li>
          </ol>
        </div>
        <figcaption className="sr-only">{map.label}</figcaption>
        <p className={styles.source}>{map.source}</p>
      </figure>
    </div>
  );
}
