"use client";

import { useEffect } from "react";
import { getHeroEnd } from "@/features/hero/heroEnd";
import { getSceneLoading, subscribeSceneLoading } from "@/features/hero/sceneLoading";
import { idFromHash } from "@/lib/hash";

/**
 * Where the page starts once she is in, after the loading screen has gone
 * and given the page back (it keeps <main> inert until then):
 *
 * - A link to a section after the hero (/en#contact, /es#projects) lands
 *   there. The browser's own jump cannot: the loading screen starts the
 *   page at the top, and the hero holds the scroll for its film. The film
 *   is cut to its end (as Skip does), the page goes to the section and the
 *   section takes the focus. A later change of the fragment (an in-page
 *   link) does the same.
 * - Otherwise the keyboard starts from the top of the page. The loading
 *   screen took the focus with it, and the browser would carry on from
 *   where it was, after the page controls: the first Tab went to the
 *   hero's Skip, past "Skip to content", the radio and the languages.
 */
export function PageEntry() {
  useEffect(() => {
    const main = document.getElementById("main");

    const goToHash = (): boolean => {
      const id = idFromHash(window.location.hash);
      const target = id ? document.getElementById(id) : null;
      const hero = getHeroEnd();
      if (!target || !hero || hero.section.contains(target)) return false;
      if (!(hero.section.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      hero.cut();
      // The scroll-padding keeps it clear of the page controls.
      target.scrollIntoView({ block: "start" });
      if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      return true;
    };

    const startAtTop = () => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const body = document.body;
      body.setAttribute("tabindex", "-1");
      body.focus({ preventScroll: true });
      body.addEventListener("blur", () => body.removeAttribute("tabindex"), { once: true });
    };

    let entered = false;
    let frame = 0;
    const land = () => {
      if (main?.inert) {
        frame = requestAnimationFrame(land);
        return;
      }
      if (!goToHash()) startAtTop();
    };
    const onLoading = () => {
      if (entered || !getSceneLoading().entered) return;
      entered = true;
      frame = requestAnimationFrame(land);
    };
    const onHashChange = () => {
      goToHash();
    };

    const unsubscribe = subscribeSceneLoading(onLoading);
    onLoading();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
  return null;
}
