"use client";

import { useLenis } from "lenis/react";
import { type MouseEvent, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { LoaderTip } from "@/features/loader/tips";
import { entryStation, getRadio, getServerRadio, readMemory, subscribeRadio, tune } from "@/features/music/radio";
import { findStation, formatFrequency } from "@/features/music/stations";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { goTo, pushFragment, pushTop } from "@/lib/navigate";
import { reveal } from "@/lib/reveal";
import { LoadCurtain } from "./LoadCurtain";
import { beginLoad } from "./loadHold";
import { LoadMenu } from "./LoadMenu";
import { closeLoadMenu, isLoadMenuOpen, isLoadMenuOpenOnServer, subscribeLoadMenu, takeLoadOpener } from "./loadMenuStore";
import { currentSave, type Save, SAVES, saveHref } from "./saves";
import type { SlotWords } from "./slotWords";

/** The station a slot would load with: the one on air, or else the one she last tuned to. */
function stationLabel(id: string): string {
  const station = findStation(id);
  return station ? `${station.name} ${formatFrequency(station.frequency)}` : "";
}

/** The slot she is in: the last part whose top has come up past the middle of the screen. */
function whereNow(): number {
  const tops = SAVES.map((save, i) => {
    if (i === 0) return 0;
    const element = document.getElementById(save.section);
    return element ? element.getBoundingClientRect().top + window.scrollY : Number.NaN;
  });
  return currentSave(tops, window.scrollY, window.innerHeight);
}

type Props = {
  dict: Dictionary["load"];
  words: SlotWords;
  lang: Locale;
  /** The start menu's tips, for a load that takes a while. */
  tips: readonly LoaderTip[];
  labels: { tip: string; trivia: string };
};

/**
 * The page's LOAD GAME, opened from the page controls (LoadButton.tsx):
 * the save slots over the page, from anywhere in it, and the load screen
 * every load goes through (LoadCurtain.tsx, the start menu's too). The
 * switch shows the radio as it is (on, with the station on air, or off)
 * and she can flip it before she loads; nothing changes until she does.
 *
 * A slot, in her click: the radio on or off inside the gesture (the
 * browser's rule for sound), a history entry as an in-page link leaves
 * (Back returns to where she was; the prologue's names no section), then
 * the load: the page jumps there under the load screen in that same
 * task, and the screen lifts once the place is drawn (its pictures in,
 * the hero's or the city's canvas drawn there), the focus on it.
 *
 * Lenis stands still while the menu is open, so nothing behind moves or
 * hears her keys (the hero and the city ignore them while it is
 * stopped); the load screen holds the page on its own. Rendered before
 * <main>: focus in either never counts as having left the hero forward
 * (which opens its walls).
 */
export function LoadGame({ dict, words, lang, tips, labels }: Props) {
  const open = useSyncExternalStore(subscribeLoadMenu, isLoadMenuOpen, isLoadMenuOpenOnServer);
  const radio = useSyncExternalStore(subscribeRadio, getRadio, getServerRadio);
  const lenis = useLenis();
  /** The switch, as she set it in this opening: null follows the radio. */
  const [wish, setWish] = useState<boolean | null>(null);
  const [here, setHere] = useState(0);
  const [opened, setOpened] = useState(false);

  // Opening: where she is, from where the parts stand on the page now (the hero is the top), in
  // the render that opens it, so the focus starts on that slot; and the switch follows the radio.
  if (open !== opened) {
    setOpened(open);
    if (open) {
      setWish(null);
      setHere(whereNow());
    }
  }

  /** Tuned to a station (its sound may have failed: then loading with the radio on plays it again). */
  const tunedOn = radio.tuned !== "off";
  const on = wish ?? tunedOn;
  const station = tunedOn ? radio.tuned : entryStation(readMemory());

  // While it is open the page stands still.
  useEffect(() => {
    if (!open || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  const onClose = useCallback((loaded: boolean) => {
    closeLoadMenu();
    const opener = takeLoadOpener();
    if (!loaded && opener?.isConnected) opener.focus({ preventScroll: true });
  }, []);

  const onLoad = (save: Save, event: MouseEvent<HTMLAnchorElement>, picture: string) => {
    // Every slot is ours, never PageEntry's link: the page moves under the load screen.
    event.preventDefault();
    // Inside her click or key: the browser allows sound here.
    if (on && !radio.playing) tune(station);
    else if (!on && tunedOn) tune("off");
    closeLoadMenu();
    // The menu's Lenis comes back now, so the jump below moves it with the page.
    lenis?.start();
    if (save.id === "hero") {
      if (window.location.hash || window.scrollY > 1) pushTop();
    } else if (window.location.hash !== saveHref(save)) pushFragment(saveHref(save));
    if (beginLoad(save, { mode: "page", via: event.detail > 0 ? "pointer" : "key", picture })) return;
    // No load screen to take it: the jump alone, as a link's.
    const target = save.id === "hero" ? null : document.getElementById(save.target);
    if (target) {
      const shown = reveal(target);
      goTo(shown.view, { focus: shown.focus });
    } else goTo(0, { focus: document.getElementById("hero-title") ?? document.getElementById("main") });
  };

  return (
    <>
      <LoadMenu
        dict={dict}
        words={words}
        lang={lang}
        where="page"
        open={open}
        onClose={onClose}
        radio={{ on, station: stationLabel(station) }}
        onRadio={setWish}
        onLoad={onLoad}
        current={here}
        initial={here}
      />
      <LoadCurtain dict={dict} words={words} tips={tips} labels={labels} />
    </>
  );
}
