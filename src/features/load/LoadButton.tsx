"use client";

import { usePathname } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import styles from "./LoadButton.module.css";
import { isLoadMenuOpen, isLoadMenuOpenOnServer, openLoadMenu, subscribeLoadMenu } from "./loadMenuStore";

/**
 * LOAD GAME in the page controls, left of the radio: opens the save slots
 * (LoadGame.tsx) from anywhere on the page. A floppy disk, and its words
 * on a wide screen; on a narrower one the disk alone, its name for screen
 * readers and as a tooltip. Only on the home page, whose parts the slots
 * load: the 404 shares the controls and has none of them.
 */
export function LoadButton({ dict, lang }: { dict: Dictionary["load"]; lang: Locale }) {
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  const open = useSyncExternalStore(subscribeLoadMenu, isLoadMenuOpen, isLoadMenuOpenOnServer);
  if (pathname !== `/${lang}`) return null;
  return (
    <Button
      ref={button}
      className={styles.button}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={dict.open}
      data-load-button
      onClick={() => openLoadMenu(button.current)}
    >
      <svg className={styles.disk} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M2.5 2.5h8.5l2.5 2.5v8.5h-11z M5 2.5v3.5h5v-3.5 M5 13.5v-4h6v4" />
      </svg>
      <span className={styles.label}>{dict.open}</span>
    </Button>
  );
}
