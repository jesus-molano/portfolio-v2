"use client";

import { useEffect } from "react";
import { getSceneLoading, subscribeSceneLoading } from "@/features/hero/sceneLoading";
import { idFromHash } from "@/lib/hash";
import { focusInPlace, fragmentTarget, goTo, placeOf, pushFragment } from "@/lib/navigate";
import { reveal } from "@/lib/reveal";

/**
 * Where the page goes when a URL fragment says so, and where it starts
 * once she is in, after the loading screen has gone and given the page
 * back (it keeps <main> inert until then).
 *
 * - A link to a section (/en#contact, /es#projects) lands there. The
 *   browser's own jump cannot: the loading screen starts the page at the
 *   top, and the hero holds the scroll for its film. A target in a closed
 *   tab (STATS's #stats-map, #stats-settings) opens its tab first; the page goes there
 *   through lib/navigate.ts, which opens the hero's walls on the way past
 *   it and moves Lenis with the page; the target takes the focus. A later
 *   change of the fragment (the address bar) does the same.
 * - An in-page link (a STATS mission, the cinema's box office, the skip
 *   link) goes the same way instead of the browser's own jump, which left
 *   Lenis behind: one notch after a link took her to the cinema, the page flew back
 *   up to the hero's end. The address still names the target, with a new
 *   history entry, as the browser's jump would leave it, and the entry she
 *   left remembers where she was: Back returns there, Forward to the
 *   target (lib/navigate.ts pushFragment).
 * - Otherwise the keyboard starts from the top of the page. The loading
 *   screen took the focus with it, and the browser would carry on from
 *   where it was, after the page controls: the first Tab went to the
 *   hero's Skip, past "Skip to content", the radio and the languages.
 */
/** A hashchange this soon after a popstate (ms) with the same fragment is that Back's own. */
const POP_MS = 5000;

export function PageEntry() {
  useEffect(() => {
    const main = document.getElementById("main");

    /** Lands on the element a fragment names; false if it names none. */
    const land = (id: string | null): boolean => {
      const target = id ? document.getElementById(id) : null;
      if (!target) return false;
      // A target in a closed tab opens it first (lib/reveal.ts), and may be seen from its section.
      const { view, focus } = reveal(target);
      goTo(view, { focus });
      return true;
    };

    const startAtTop = () => {
      if (document.activeElement && document.activeElement !== document.body) return;
      focusInPlace(document.body);
    };

    let entered = false;
    let frame = 0;
    const arrive = () => {
      if (main?.inert) {
        frame = requestAnimationFrame(arrive);
        return;
      }
      if (!land(idFromHash(window.location.hash))) startAtTop();
    };
    const onLoading = () => {
      if (entered || !getSceneLoading().entered) return;
      entered = true;
      frame = requestAnimationFrame(arrive);
    };
    /**
     * Back and Forward: the page goes where the entry remembers it was
     * (an in-page link wrote it, pushFragment), or to the section its
     * address names, or the top; through goTo, so Lenis goes along and the
     * hero's walls open on the way past. The browser's own restoration is
     * off: it moved the page natively, behind Lenis' back, and the
     * hashchange that follows Back jumped on to the named section's top.
     */
    let path = window.location.pathname;
    let popped: { hash: string; at: number } | null = null;
    const onPopState = (event: PopStateEvent) => {
      // Another page (the other language): the router's.
      if (window.location.pathname !== path) {
        path = window.location.pathname;
        return;
      }
      popped = { hash: window.location.hash, at: performance.now() };
      const y = placeOf(event.state);
      if (y !== null) goTo(y, { focus: null });
      else if (!land(idFromHash(window.location.hash))) goTo(0, { focus: null });
    };
    const onHashChange = () => {
      // The hashchange of a Back already handled.
      const pop = popped;
      popped = null;
      if (pop && pop.hash === window.location.hash && performance.now() - pop.at < POP_MS) return;
      land(idFromHash(window.location.hash));
    };
    // On the window, after React's own handlers: a link that does its own
    // thing (the STATS tabs, back to top) has prevented the default by then.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const id = fragmentTarget(link.href, window.location.href);
      if (!id || !document.getElementById(id)) return;
      event.preventDefault();
      if (link.hash !== window.location.hash) pushFragment(link.hash);
      land(id);
    };

    const unsubscribe = subscribeSceneLoading(onLoading);
    onLoading();
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("click", onClick);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      window.history.scrollRestoration = restoration;
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
