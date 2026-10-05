import type { CSSProperties } from "react";
import { cq, fitMarquee, marqueeTiles, PLATES, stripBulbs, type PlateName, type Tile } from "./finaleLayout";
import styles from "./Marquee.module.css";

/**
 * The cinema's changeable letters and bulbs, laid on a plate's blank board
 * (finaleLayout.ts). Presentational and hook-free, so the server renders
 * the still rows and the client the one that re-letters (ProjectsMarquee).
 * Everything here is decoration: aria-hidden, the headings carry the words.
 */

export type Vars = CSSProperties & Record<`--${string}`, string | number>;

/**
 * Portrait screens get the tall plates (and the cases in a list); the same
 * query is in the CSS modules and in the plates' <picture> sources.
 */
export const TALL_MEDIA = "(max-aspect-ratio: 5/6), (max-width: 640px)";

/** A plate in each layout: wide for landscape screens, tall for portrait ones. */
export type PlatePair = { wide: PlateName; tall: PlateName };

/** Stable identity of a tile: its slot and its letter, so a letter that stays is not hung again. */
export function tileKey(tile: Tile, slot: number): string {
  return `${slot}:${tile.glyph}`;
}

/**
 * Where one marquee row sits on each plate, and its letter size: the row's
 * box is one em tall, its top 0.8 em above the rail's baseline (Bebas
 * Neue's baseline at line-height 1), so the letters stand on the rail.
 */
export function rowVars(plates: PlatePair, index: number, sizes: { wide: number[]; tall: number[] }): Vars {
  const vars: Vars = {};
  for (const [layout, name] of Object.entries(plates) as ["wide" | "tall", PlateName][]) {
    const plate = PLATES[name];
    const row = plate.rows[index];
    const size = sizes[layout][index];
    const p = layout === "wide" ? "w" : "t";
    vars[`--${p}-x`] = cq(plate, plate.board.x);
    vars[`--${p}-w`] = cq(plate, plate.board.w);
    vars[`--${p}-y`] = cq(plate, row.base - 0.8 * size);
    vars[`--${p}-fs`] = cq(plate, size);
  }
  return vars;
}

/** Letter sizes for each row of a marquee on both plates. */
export function marqueeSizes(plates: PlatePair, rows: readonly (readonly string[])[], uniform: boolean) {
  return {
    wide: fitMarquee(PLATES[plates.wide], rows, uniform),
    tall: fitMarquee(PLATES[plates.tall], rows, uniform),
  };
}

export function MarqueeRow({
  tiles,
  style,
  fresh,
  className,
}: {
  tiles: readonly Tile[];
  style: Vars;
  /** Keys of the tiles just hung (they drop into the rail one after another). */
  fresh?: ReadonlySet<string>;
  className?: string;
}) {
  return (
    <span className={className ? `${styles.row} ${className}` : styles.row} style={style}>
      {tiles.map((tile, slot) => {
        const key = tileKey(tile, slot);
        return (
          <span
            key={key}
            className={styles.tile}
            data-blank={tile.glyph === "" || undefined}
            data-tape={tile.tape || undefined}
            data-fresh={fresh?.has(key) || undefined}
            style={{ "--adv": tile.advance, "--tilt": `${tile.tilt}deg`, "--drop": tile.drop, "--slot": slot } as Vars}
          >
            {tile.glyph}
          </span>
        );
      })}
    </span>
  );
}

/** The tiles of a marquee's rows, seeded per row (`base + index`). */
export function rowsTiles(rows: readonly string[], base = 0): Tile[][] {
  return rows.map((text, i) => marqueeTiles(text, base + i));
}

/**
 * The two bulb strips along the marquee's top and bottom edges. They chase
 * slowly, one bulb in four, the lower strip two steps behind the upper.
 */
export function BulbStrips({ plates }: { plates: PlatePair }) {
  const wide = PLATES[plates.wide], tall = PLATES[plates.tall];
  return wide.strips.map((strip, i) => {
    const other = tall.strips[i] ?? strip;
    const style: Vars = {
      "--w-x": cq(wide, strip.x0),
      "--w-w": cq(wide, strip.x1 - strip.x0),
      "--w-y": cq(wide, strip.y),
      "--w-r": cq(wide, strip.r),
      "--t-x": cq(tall, other.x0),
      "--t-w": cq(tall, other.x1 - other.x0),
      "--t-y": cq(tall, other.y),
      "--t-r": cq(tall, other.r),
    };
    return (
      <span key={i} className={styles.strip} style={style}>
        {stripBulbs(strip.n, i * 2).map((bulb, k) => (
          <span key={k} className={styles.stripBulb} style={{ "--at": bulb.x, "--phase": bulb.phase } as Vars} />
        ))}
      </span>
    );
  });
}
