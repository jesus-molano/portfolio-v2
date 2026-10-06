import type { ReactNode } from "react";
import type { IconId } from "./statsLayout";

/**
 * The menu's pictograms (the map's and the work modes'): our own 24 x 24 line drawings in currentColor, so
 * the CSS colours them from the tokens. No game's icons, no brand marks.
 */
const PATHS: Record<IconId, ReactNode> = {
  // A job done on site: the ring of its badge on the map, as the map's key shows it.
  site: <circle cx="12" cy="12" r="7.2" strokeWidth="3.4" />,
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
