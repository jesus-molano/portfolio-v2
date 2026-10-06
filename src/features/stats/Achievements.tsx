import type { CSSProperties, ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { AchievementSky } from "./AchievementSky";
import {
  BRANCHES,
  FIELD,
  GROUPS,
  ROOT,
  SKY,
  type Achievement,
  type Branch,
  branchTally,
  detailAlign,
  edges,
  formatTally,
  isUnlocked,
  labelBox,
  onBranch,
  percent,
  type SkyPoint,
  tally,
} from "./achievements";
import styles from "./Achievements.module.css";
import { PANEL_ALIASES } from "./statsTabs";

type Copy = Dictionary["stats"]["achievements"];

const at = (point: SkyPoint): CSSProperties => {
  const { left, top } = percent(point);
  return { "--x": `${left}%`, "--y": `${top}%` } as CSSProperties;
};

/** Each branch's nebula: an ellipse round its stars, a little wider than they spread. */
const NEBULAE = (["sport", "games", "film", "series"] as const).map((id) => {
  const points = onBranch(id).map((item) => item.at);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { id, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 + 90, ry: (y1 - y0) / 2 + 70 };
});

/** The island's ridge along the foot of the sky, the Teide rising on the right: the player stands on it. */
const RIDGE =
  "M0 628 L60 624 L140 629 L230 621 L330 626 L430 624 L520 623 L600 624 L690 624 L780 623 L860 620 L930 612 L990 604 L1040 594 L1080 583 L1100 577 L1112 576 L1124 578 L1150 590 L1180 601 L1200 606 L1200 640 L0 640 Z";

/**
 * The ACHIEVEMENTS tab: the achievement tree, drawn as constellations in
 * the island's night sky. Every star is a real button in a nested list
 * (branch, then constellation, then star), in the server HTML; its name
 * reads "<title>, unlocked|locked, <line>". On a wide screen the stars sit
 * on the sky's plane (achievements.ts) over the links drawn in SVG; under
 * 1000 px each branch is a vertical list with its own spine.
 */
export function Achievements({ dict }: { dict: Copy }) {
  const all = tally();
  const links = edges();
  return (
    <div className={styles.tree}>
      {/* Old fragments that open this tab (#stats-favorites) land here, at the top of the panel. */}
      {Object.keys(PANEL_ALIASES).map((id) => (
        <span key={id} id={id} className={styles.alias} />
      ))}
      <div className={styles.head}>
        <h3 id="stats-achievements-title" className={styles.title}>
          {dict.title} <span className={styles.count}>· {formatTally(dict.count, all)}</span>
        </h3>
        <p className={styles.intro}>{dict.intro}</p>
        <p className={styles.legend} aria-hidden="true">
          <span className={styles.legendLit}>
            <i />
            {dict.status.unlocked}
          </span>
          <span className={styles.legendLocked}>
            <i>
              <Padlock />
            </i>
            {dict.status.locked}
          </span>
          <span className={styles.legendFavourite}>
            <i>
              <FavouriteStar />
            </i>
            {dict.favourite}
          </span>
        </p>
      </div>

      <AchievementSky className={styles.sky}>
        <svg className={styles.drawing} viewBox={`0 0 ${SKY.width} ${SKY.height}`} aria-hidden="true" focusable="false">
          {/* A faint nebula behind each constellation, in its colour. */}
          <defs>
            {NEBULAE.map(({ id }) => (
              <radialGradient key={id} id={`tree-nebula-${id}`} className={styles[`tint_${id}`]}>
                <stop offset="0" className={styles.nebulaCore} />
                <stop offset="1" className={styles.nebulaEdge} />
              </radialGradient>
            ))}
          </defs>
          {NEBULAE.map(({ id, cx, cy, rx, ry }) => (
            <ellipse key={id} className={styles.nebula} cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#tree-nebula-${id})`} />
          ))}
          <g className={styles.field}>
            {FIELD.map((star, i) => (
              <circle key={i} cx={star.x} cy={star.y} r={star.r} opacity={star.o} />
            ))}
          </g>
          {/* A star chart's rings round the player. */}
          <g className={styles.rings}>
            {[150, 300, 470].map((r) => (
              <circle key={r} cx={ROOT[0]} cy={ROOT[1]} r={r} />
            ))}
          </g>
          <path className={styles.ridge} d={RIDGE} />
          <g className={styles.links}>
            {links.map((edge) => (
              <line
                key={`${edge.from}-${edge.to}`}
                className={`${styles.link} ${styles[`tint_${edge.tint}`]}`}
                data-lit={edge.lit || undefined}
                x1={edge.a[0]}
                y1={edge.a[1]}
                x2={edge.b[0]}
                y2={edge.b[1]}
              />
            ))}
          </g>
          {/* The glow that travels out along the lit links, wave after wave from the player. */}
          <g className={styles.flows}>
            {links
              .filter((edge) => edge.lit)
              .map((edge) => (
                <line
                  key={`${edge.from}-${edge.to}`}
                  className={`${styles.flow} ${styles[`tint_${edge.tint}`]}`}
                  style={{ "--d": edge.depth } as CSSProperties}
                  pathLength={100}
                  x1={edge.a[0]}
                  y1={edge.a[1]}
                  x2={edge.b[0]}
                  y2={edge.b[1]}
                />
              ))}
          </g>
          {BRANCHES.map((branch) =>
            branch.hub ? <circle key={branch.id} className={`${styles.hubDot} ${styles[`tint_${branch.id}`]}`} cx={branch.hub[0]} cy={branch.hub[1]} r={4.5} /> : null,
          )}
        </svg>

        <span className={styles.player} style={at(ROOT)} aria-hidden="true">
          <i />
          <b>{dict.player}</b>
        </span>

        <ol className={styles.branches} aria-labelledby="stats-achievements-title">
          {BRANCHES.map((branch) => (
            <BranchItem key={branch.id} branch={branch} dict={dict} />
          ))}
        </ol>
      </AchievementSky>
    </div>
  );
}

function BranchItem({ branch, dict }: { branch: Branch; dict: Copy }) {
  const items = onBranch(branch.id);
  // Its count covers the stars it feeds too: Marvel, locked, counts in both FILM and SERIES.
  const count = branchTally(branch.id);
  const crossover = branch.id === "crossover";
  const tint = crossover ? "crossover" : branch.id;
  const groups = branch.id === "sport" ? GROUPS : [];
  const loose = items.filter((item) => !item.group);
  return (
    <li className={`${styles.branch} ${styles[`tint_${tint}`]}`} data-branch={branch.id}>
      <h4 className={styles.hub} style={branch.caption ? at(branch.caption) : undefined}>
        {crossover ? <Merge /> : null}
        <span className={styles.hubName}>{dict.branches[branch.id]}</span>{" "}
        <span className={styles.hubCount} aria-hidden="true">
          {count.unlocked}/{count.total}
        </span>
        <span className="sr-only">, {formatTally(dict.branchCount, count)}</span>
      </h4>
      {groups.length ? (
        <ol className={styles.groups}>
          {groups.map((group) => (
            <li key={group.id} className={styles.group}>
              <p className={styles.groupName} style={at(group.at)}>
                {dict.groups[group.id]}
              </p>
              <Stars items={items.filter((item) => item.group === group.id)} dict={dict} />
            </li>
          ))}
          <li className={`${styles.group} ${styles.groupLoose}`}>
            <Stars items={loose} dict={dict} />
          </li>
        </ol>
      ) : (
        <Stars items={items} dict={dict} />
      )}
    </li>
  );
}

function Stars({ items, dict }: { items: readonly Achievement[]; dict: Copy }) {
  return (
    <ol className={styles.stars}>
      {items.map((item, index) => (
        // A star that does not grow from the one listed before it starts a path of its own (a fork, on the narrow list).
        <Star key={item.id} item={item} dict={dict} fork={index > 0 && !item.from.includes(items[index - 1].id)} />
      ))}
    </ol>
  );
}

function Star({ item, dict, fork }: { item: Achievement; dict: Copy; fork: boolean }) {
  const { title, line } = dict.nodes[item.id];
  const unlocked = isUnlocked(item);
  const hard = item.lock === "max" || item.lock === "surrendered" ? dict.hardLocks[item.lock] : null;
  // Under its title: the hard lock's word, or FAVORITA / FAVOURITE on his two favourites.
  const tag = hard ?? (item.favourite ? dict.favourite : null);
  const down = item.at[1] < SKY.height / 2;
  // The details open on the title's side, lined up with the edge that keeps them in the sky (achievements.ts).
  const align = detailAlign(item, labelBox(item, title, tag));
  const status = unlocked ? dict.status.unlocked : dict.status.locked;
  /*
   * Its name, every word of it on screen too: "<title>, unlocked|locked,
   * [its tag,] <line>" (the title and the chips are blocks, and a screen
   * reader paused before every comma written between them).
   */
  const name = [title, status, tag, line].filter(Boolean).join(", ");
  return (
    <li
      className={styles.node}
      data-lock={item.lock}
      data-favourite={item.favourite ? "" : undefined}
      data-fork={fork ? "" : undefined}
      data-side={item.label}
      data-v={down ? "down" : "up"}
      data-align={align}
      style={at(item.at)}
    >
      <button type="button" className={styles.button} data-achievement={item.id} data-locked={unlocked ? undefined : ""} aria-label={name}>
        <span className={styles.star} aria-hidden="true">
          <StarMark lock={item.lock} favourite={item.favourite} />
        </span>
        <span className={styles.label}>
          <span className={styles.name}>
            {title}
          </span>
          {tag ? (
            <span className={styles.tag} aria-hidden="true">
              {item.favourite ? <span className={styles.tagStar}>★ </span> : null}
              {tag}
            </span>
          ) : null}
          <span className={styles.detail}>
            <span className={styles.chips}>
              <span className={styles.chip}>
                {status}
              </span>
              {tag ? (
                <span className={`${styles.chip} ${item.favourite ? styles.chipFavourite : styles.chipHard}`}>
                  {tag}
                </span>
              ) : null}
            </span>
            <span className={styles.line}>{line}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

/** Inside a star: nothing when it is lit (CSS draws the light), a gold star on a favourite, a padlock, three of them, or the white flag. */
function StarMark({ lock, favourite }: { lock: Achievement["lock"]; favourite?: true }): ReactNode {
  if (favourite) return <FavouriteStar />;
  if (lock === "none") return null;
  if (lock === "surrendered") return <Flag />;
  if (lock === "max") {
    return (
      <span className={styles.maxLock}>
        <svg className={styles.chain} viewBox="0 0 40 40" focusable="false">
          <path d="M3 9 L37 31 M3 31 L37 9" />
        </svg>
        <Padlock className={styles.lockA} />
        <Padlock className={styles.lockB} />
        <Padlock className={styles.lockC} />
      </span>
    );
  }
  return <Padlock className={styles.lockOne} />;
}

function Padlock({ className }: { className?: string }) {
  return (
    <svg className={`${styles.padlock} ${className ?? ""}`} viewBox="0 0 16 16" focusable="false">
      <path className={styles.shackle} d="M5 7V5.2a3 3 0 0 1 6 0V7" />
      <rect x="3.2" y="7" width="9.6" height="7" rx="1.6" />
      <path className={styles.keyhole} d="M8 9.6v1.8" />
    </svg>
  );
}

/** His favourites' mark: a five-pointed gold star over the light. */
function FavouriteStar() {
  return (
    <svg className={styles.favStar} viewBox="0 0 24 24" focusable="false">
      <path d="M12 1.6l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.7l-6.4 3.5L7 14.1l-5.3-5 7.2-.9z" />
    </svg>
  );
}

/** The white flag, on its pole, planted on the star he gave up on. */
function Flag() {
  return (
    <svg className={styles.flag} viewBox="0 0 24 32" focusable="false">
      <path className={styles.pole} d="M5 31V3" />
      <path className={styles.cloth} d="M5.6 4c3-1.6 5.2 1.2 8.4.2 2.2-.7 4-.6 6 .2v9.4c-2-.8-3.8-.9-6-.2-3.2 1-5.4-1.8-8.4-.2z" />
    </svg>
  );
}

/** On a narrow screen, over the crossover: FILM's and SERIES' lines meeting in one star. */
function Merge() {
  return (
    <svg className={styles.merge} viewBox="0 0 64 28" aria-hidden="true" focusable="false">
      <path className={styles.mergeFilm} d="M4 2 L32 24" />
      <path className={styles.mergeSeries} d="M60 2 L32 24" />
    </svg>
  );
}
