import type { ReactNode } from "react";
import type { IconId } from "./statsLayout";

/**
 * The map's pictograms: our own 24 x 24 line drawings in currentColor, so
 * the CSS colours them from the tokens. No game's icons, no brand marks.
 */
const PATHS: Record<IconId, ReactNode> = {
  // A chequered flag on its pole.
  pit: (
    <>
      <path d="M5.5 21V3.5" />
      <path d="M5.5 4.5h13v9h-13" />
      <path d="M5.5 4.5h4.3v3h-4.3zM14.1 4.5h4.4v3h-4.4zM9.8 7.5h4.3v3H9.8zM5.5 10.5h4.3v3H5.5zM14.1 10.5h4.4v3h-4.4z" fill="currentColor" stroke="none" />
    </>
  ),
  // A cardboard box, taped.
  box: (
    <>
      <path d="M3.5 8.5L12 4.5l8.5 4v9L12 21.5l-8.5-4z" />
      <path d="M3.5 8.5L12 12.5l8.5-4M12 12.5v9" />
      <path d="M7.8 6.5l8.4 4" strokeOpacity=".6" />
    </>
  ),
  // A slice with no olives on it.
  pizza: (
    <>
      <path d="M12 21.5L3.8 6.8c5-3.2 11.4-3.2 16.4 0z" />
      <path d="M5.4 9.6c4.2-2.4 9-2.4 13.2 0" />
      <circle cx="10" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="12.6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.4" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  // An amphitheatre: a ring of arches.
  arena: (
    <>
      <path d="M3 9.5c0-2.2 4-3.8 9-3.8s9 1.6 9 3.8v7.5c0 2.2-4 3.8-9 3.8s-9-1.6-9-3.8z" />
      <path d="M3 9.5c0 2.2 4 3.8 9 3.8s9-1.6 9-3.8" />
      <path d="M6.2 13.4v4.2M9.4 14v4.4M12.6 14.1v4.4M15.8 13.8v4.3M18.6 13v3.9" />
    </>
  ),
  // A car under the brushes, in a lather.
  carWash: (
    <>
      <path d="M3.5 18v-3.4l2.2-4.6h12.6l2.2 4.6V18z" />
      <path d="M6.4 18v1.8M17.6 18v1.8M3.5 14.6h17" />
      <circle cx="8" cy="5.6" r="1.6" />
      <circle cx="12.6" cy="4" r="2" />
      <circle cx="16.6" cy="6.4" r="1.3" />
    </>
  ),
  // The scales.
  law: (
    <>
      <path d="M12 3.5v16.5M7 20h10M5 7h14" />
      <path d="M5 7l-2.6 6.2M5 7l2.6 6.2M19 7l-2.6 6.2M19 7l2.6 6.2" />
      <path d="M2.2 13.2c.6 2.6 4.9 2.6 5.6 0zM16.2 13.2c.6 2.6 4.9 2.6 5.6 0z" />
    </>
  ),
  // A horseshoe, for luck at the bookmaker's.
  betting: (
    <>
      <path d="M7.2 20.2C3.7 16.4 3.6 9.3 7.6 5.9c2.4-2 6.4-2 8.8 0 4 3.4 3.9 10.5.4 14.3" strokeWidth="3" />
      <path d="M6.6 9.8h.01M5.9 13.8h.01M17.4 9.8h.01M18.1 13.8h.01" strokeWidth="2.4" stroke="var(--va-color-night)" />
    </>
  ),
  // A phone booth, ringing.
  booth: (
    <>
      <path d="M7 3.5h10v18H7z" />
      <path d="M6 3.5h12M9.4 6.5h5.2v6.5H9.4z" />
      <path d="M9.6 16.2c1.4 1.2 3.4 1.2 4.8 0" />
      <path d="M2.6 6.8c-.8 1.6-.8 3.4 0 5M21.4 6.8c.8 1.6.8 3.4 0 5" strokeOpacity=".7" />
    </>
  ),
  // The player.
  you: <path d="M12 2.8l7.4 17.6L12 16.6l-7.4 3.8z" fill="currentColor" strokeLinejoin="round" />,
  // Home base: a house with an antenna.
  hq: (
    <>
      <path d="M4 11.8L12 5.2l8 6.6" />
      <path d="M6.2 10.2v9.6h11.6v-9.6M10.4 19.8v-4.6h3.2v4.6" />
      <path d="M12 5.2V2.4M9.4 3.4a3.6 3.6 0 0 1 5.2 0" strokeOpacity=".8" />
    </>
  ),
};

export function StatsIcon({ id, className }: { id: IconId; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[id]}
    </svg>
  );
}
