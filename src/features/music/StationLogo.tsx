import { useId, useMemo } from "react";
import styles from "./StationLogo.module.css";
import { badgeMarkup } from "./stationBadges";
import type { LogoStyle } from "./stations";

type Props = { logo: LogoStyle; frequency?: string; className?: string };

/**
 * One round badge per station, our own illustrated marks and lockups drawn
 * in SVG (stationBadges.ts) with the colours of the `radio` tokens and the
 * faces of `radioFonts`. Decorative: the wheel names every station in text.
 */
export function StationLogo({ logo, frequency, className }: Props) {
  // Gradient, filter, mask and path ids must be unique per badge on the page.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // Our own markup, built from constants (never from input).
  const html = useMemo(() => ({ __html: badgeMarkup(logo, `b${id}`, frequency) }), [logo, id, frequency]);
  return (
    <svg
      className={[styles.logo, className].filter(Boolean).join(" ")}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={html}
    />
  );
}
