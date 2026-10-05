import type { Dictionary } from "@/i18n/dictionaries";
import { caseBulbs, posterInset, rectCq, PLATES } from "./finaleLayout";
import { POSTER_SIZES, posterSrc, posterSrcSet, type Feature } from "./links";
import type { Vars } from "./Marquee";
import styles from "./Projects.module.css";

/** The 34 bulbs round every case, the same for all four. */
const BULBS = caseBulbs();

type Props = {
  feature: Feature;
  /** Its place on the bill, left to right (its case on the plate). */
  index: number;
  copy: Dictionary["projects"]["posters"][keyof Dictionary["projects"]["posters"]];
  github: string;
  onGithub: string;
  newTab: string;
  locale: string;
};

/**
 * One feature on The Afterglow's bill: a single link to the repository that
 * is both the lit poster case on the facade and its caption under it (the
 * case is placed on the plate in cqw, the caption flows in the bill). On a
 * portrait screen the case hangs in the list beside its caption. Hover and
 * keyboard focus light the case: the bulbs chase, the poster lifts and
 * burns pink, and the marquee re-letters (ProjectsMarquee).
 */
export function PosterCase({ feature, index, copy, github, onGithub, newTab, locale }: Props) {
  const plate = PLATES["night-wide"];
  const slot = plate.cases[index];
  const frame = rectCq(plate, slot.frame);
  const pool = rectCq(plate, slot.pool);
  const inset = posterInset(slot);
  const id = `feature-${feature.id}`;
  const caseStyle: Vars = {
    "--x": frame.x,
    "--y": frame.y,
    "--w": frame.w,
    "--h": frame.h,
    "--pool-x": pool.x,
    "--pool-y": pool.y,
    "--pool-w": pool.w,
    "--pool-h": pool.h,
    "--poster-x": inset.x,
    "--poster-y": inset.y,
    "--poster-w": inset.w,
    "--poster-h": inset.h,
  };
  const image = (hot: boolean) => (
    <picture className={hot ? styles.hot : styles.poster}>
      <source type="image/avif" srcSet={posterSrcSet(feature, locale, "avif", hot)} sizes={POSTER_SIZES} />
      {/* Pre-encoded AVIF and WebP in two sizes (tools/art/encode.py): the image optimizer would only re-encode them. */}
      <img
        src={posterSrc(feature, locale, "webp", hot)}
        srcSet={posterSrcSet(feature, locale, "webp", hot)}
        sizes={POSTER_SIZES}
        alt=""
        width={432}
        height={640}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );

  return (
    <li className={styles.feature}>
      <a
        id={feature.anchor}
        className={styles.link}
        href={feature.href}
        target="_blank"
        rel="noopener noreferrer"
        data-feature={feature.id}
        aria-labelledby={`${id}-name ${id}-cta`}
        aria-describedby={`${id}-about`}
      >
        <span className={styles.case} style={caseStyle} aria-hidden="true">
          <span className={styles.pool} />
          <span className={styles.frame}>
            <span className={styles.glass}>
              {image(false)}
              {image(true)}
              <span className={styles.sheen} />
            </span>
            {BULBS.map((bulb, k) => (
              <span
                key={k}
                className={styles.bulb}
                style={{ "--bx": bulb.x, "--by": bulb.y, "--phase": bulb.phase } as Vars}
              />
            ))}
          </span>
        </span>
        <span className={styles.label}>
          <span className={styles.genre}>{copy.genre}</span>
          <span id={`${id}-name`} className={styles.repo}>
            {feature.repo}
          </span>
          <span id={`${id}-about`} className={styles.about}>
            <span className="sr-only">{copy.tagline.join(" ")} </span>
            {copy.oneLiner}
          </span>
          <span id={`${id}-cta`} className={styles.cta}>
            <span className="sr-only">{onGithub}</span>
            <span aria-hidden="true">
              {github} <span className={styles.arrow}>↗</span>
            </span>
            <span className="sr-only"> {newTab}</span>
          </span>
        </span>
      </a>
    </li>
  );
}
