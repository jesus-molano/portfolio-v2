import type { CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { StatsIcon } from "./icons";
import styles from "./Stats.module.css";
import { StatsOtherTab, StatsPanel, StatsPortrait, StatsSection, StatsTabList } from "./StatsTabs";
import {
  CAREER_CITY_ON_PAGE,
  FRAMES,
  HQ,
  MISSIONS,
  PLACES,
  PLAYER,
  SIDE_BLIPS,
  blipPoint,
  toPercent,
  type CaptionSide,
  type LonLat,
  type MapPoint,
} from "./statsLayout";

type StatsDict = Dictionary["stats"];
type Props = { dict: StatsDict };

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
 * STATS: the pause menu after the career city, one screen with two tabs,
 * MAP and STATS. The map is Tenerife at night under parody names, with the
 * career as main missions and the favourites as side activities; the sheet
 * is the character: portrait, skills and records. A server component:
 * every word of both tabs is DOM text in the server HTML, the map art is an
 * <img>. The tabs that switch them are the client part (StatsTabs.tsx).
 */
export function Stats({ dict }: Props) {
  const { map, missions } = dict;
  const placeName = (id: string) => map.places[id as keyof typeof map.places];
  const youAt = { ...placeAt(PLAYER.at), "--heading": `${PLAYER.heading}deg` } as CSSProperties;

  return (
    <StatsSection className={styles.stats} labelledBy="stats-title">
      <MenuBar dict={dict} />
      {/* After the heading, where heading navigation lands. */}
      <p className="sr-only">{dict.description}</p>

      {/* ── Tab 1: MAP ──────────────────────────────────────────────── */}
      <StatsPanel tab="map">
        <div className={styles.mapLayout}>
          {/*
            The career index first: beside the map from 1280 px, above it
            below that, and on a phone before the map and its way out.
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
                        <span className={styles.years} aria-hidden={mission.live ? true : undefined}>
                          {years(mission.years[0], mission.years[1])}
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
            <h3 id="stats-map-title" className={styles.mapTitle}>
              {map.title}
            </h3>
            <div className={styles.mapBox}>
              <div className={styles.frame}>
                <picture>
                  {/* Static SVG art: next/image has nothing to optimise, and <picture> picks the crop. */}
                  <source media="(max-width: 999.98px)" srcSet="/stats/map-square.svg" width={1100} height={1100} />
                  <img className={styles.art} src="/stats/map.svg" alt="" width={1600} height={1100} loading="lazy" decoding="async" />
                </picture>

                {/* Decoration: the parody names, the compass, the scale and the mission numbers. */}
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
                  {/* On a phone the map shows keys; the legend below carries the words. */}
                  {SIDE_BLIPS.map((blip) => (
                    <span key={blip.id} className={`${styles.pin} ${styles.pinSide}`} style={placeAt(blip.at)}>
                      {blip.key}
                    </span>
                  ))}
                  <span className={`${styles.pin} ${styles.pinYou}`} style={youAt}>
                    <StatsIcon id="you" className={styles.youArrow} />
                  </span>
                  <span className={`${styles.pin} ${styles.pinHq}`} style={placeAt(HQ.at)}>
                    <StatsIcon id="hq" />
                  </span>
                </div>
              </div>

              {/* The places: captions on the map from 1000 px, a keyed legend below it on narrower screens. */}
              <ol className={styles.places}>
                {SIDE_BLIPS.map((blip) => {
                  const content = (
                    <>
                      <span className={styles.marker} aria-hidden="true">
                        <StatsIcon id={blip.icon} />
                      </span>
                      <span className={styles.key} aria-hidden="true">
                        {blip.key}
                      </span>
                      <span className={styles.caption}>
                        {blip.id === "booth" ? (
                          <>
                            <span className={styles.text}>{map.booth.caption}</span>{" "}
                            <span className={styles.action}>
                              <span className={styles.text}>
                                {/* The name says the visible action, then where it leads (WCAG 2.5.3). */}
                                {map.booth.action}
                                <span className="sr-only">: {dict.hintTarget}</span>{" "}
                                <span aria-hidden="true">▼</span>
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className={styles.text}>{map.blips[blip.id]}</span>
                        )}
                        <span className={styles.where}> · {placeName(blip.place)}</span>
                      </span>
                    </>
                  );
                  return (
                    <li
                      key={blip.id}
                      className={`${styles.place} ${SIDE_CLASS[blip.side]} ${blip.id === "booth" ? styles.booth : ""}`}
                      style={placeAt(blip.at)}
                    >
                      {blip.id === "booth" ? (
                        <a className={styles.boothLink} href="#projects">
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
                <li className={`${styles.place} ${SIDE_CLASS[PLAYER.side]} ${styles.you}`} style={youAt}>
                  <span className={styles.marker} aria-hidden="true">
                    <StatsIcon id="you" className={styles.youArrow} />
                  </span>
                  <span className={styles.caption}>
                    <span className={styles.text}>{map.you}</span>
                  </span>
                </li>
                <li className={`${styles.place} ${SIDE_CLASS[HQ.side]} ${styles.hq}`} style={placeAt(HQ.at)}>
                  <span className={styles.marker} aria-hidden="true">
                    <StatsIcon id="hq" />
                  </span>
                  <span className={styles.caption}>
                    <span className={styles.text}>{map.hq}</span>
                  </span>
                  {/* The jobs done from home base: their badges, beside it. */}
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
                {/* Gran Canaria's box: the island and its city, named like the rest (mission 1 is on it). */}
                <li className={styles.inset} style={insetBox()}>
                  <span className={styles.insetName}>{map.inset.name}</span>
                  <span className={styles.insetCity}>{map.inset.city}</span>
                </li>
              </ol>
            </div>
            <figcaption className="sr-only">{map.label}</figcaption>
            <p className={styles.source}>{map.source}</p>
          </figure>
        </div>
      </StatsPanel>

      {/* ── Tab 2: STATS ────────────────────────────────────────────── */}
      <StatsPanel tab="sheet">
        <div className={styles.sheet}>
          <figure className={styles.card}>
            <StatsPortrait className={styles.portrait} src="/stats/portrait.webp" avif="/stats/portrait.avif" alt={dict.player.alt} width={660} height={825} />
            <span className={styles.player2} aria-hidden="true">
              {dict.player.player2}
            </span>
            <figcaption className={styles.plate}>
              <span className={styles.plateName}>{dict.player.name}</span>
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
      </StatsPanel>

      {/*
        The button prompts: the other tab, and on down the page to the
        cinema, the same way out as the booth (a plain same-page link:
        PageEntry lands it).
      */}
      <div className={styles.foot}>
        <StatsOtherTab names={dict.tabs} />
        <a className={styles.hint} href="#projects">
          <span className={styles.hintArrow} aria-hidden="true">
            ▼
          </span>{" "}
          {dict.hint}
          <span className="sr-only">: {dict.hintTarget}</span>
        </a>
      </div>
    </StatsSection>
  );
}

function MenuBar({ dict }: { dict: StatsDict }) {
  return (
    <header className={styles.menu}>
      <div className={styles.who}>
        <span className={styles.pause} aria-hidden="true">
          <i />
          <i />
        </span>
        <div>
          <h2 id="stats-title" className={styles.title}>
            {dict.title}
          </h2>
          <p className={styles.sub}>{dict.sub}</p>
        </div>
      </div>
      <StatsTabList label={dict.tabsLabel} names={dict.tabs} />
      <p className={styles.clock} aria-hidden="true">
        {dict.clock}
      </p>
    </header>
  );
}
