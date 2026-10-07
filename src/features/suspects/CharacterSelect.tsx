"use client";

import { type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLenis } from "lenis/react";
import type Lenis from "lenis";
import { motion } from "@/design/tokens";
import { decay, ELASTIC, rubberBand, touchStretchMax } from "@/features/hero/scroll/elastic";
import { scrollGate } from "@/features/hero/scroll/heroProgress";
import { stageGate } from "@/features/work/stageGate";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { registerPassage } from "@/lib/navigate";
import { stableScreen } from "@/lib/screen";
import manifest from "../../../public/interlude/manifest.json";
import { CLAW_TIMING, clawMarks, clawStart } from "./claw";
import {
  boardStyle,
  type CatId,
  chartMarks,
  isCatId,
  parseManifest,
  type Placement,
  placementStyle,
  placeLineup,
  placePlayer,
  placeSwap,
  plateNumber,
  PHONE_CHART,
  PLAYER_ONE,
  SLOT_IDS,
  type SlotId,
} from "./lineup";
import { newSelect, pick, PLAYER_KEY, REFUSALS, rememberedChoice, rovingIndex, settle } from "./select";
import {
  BAR_WINDOW_MS,
  CROWN_HEADROOM_REM,
  isStacked,
  keyAtWall,
  keyForward,
  PROMPT_MS,
  selectFrontier,
  selectGate,
  setSelectHeld,
  wallVerdict,
} from "./selectWall";
import { tryDante } from "./wanted";
import styles from "./Suspects.module.css";

type Props = { dict: Dictionary["suspects"]; lang: Locale };

/** Every figure on the chart, from the renders' manifest (checked at build time). */
const MANIFEST = parseManifest(manifest);
const LINEUP = placeLineup(MANIFEST);
const CATS = new Map(LINEUP.map((p) => [p.id, p]));
const PLAYER = placePlayer(MANIFEST);
/** The board's own lengths: his head and reach and the tallest cat's head, which `--cm` and the numerals are worked out from. */
const BOARD_STYLE = boardStyle(LINEUP, PLAYER) as CSSProperties;

/** Kira's back, Tom asleep and (if it was rendered) Dante's swipe, on their cat's slot and nudged with it on a phone. */
function swapFor(cat: CatId, src: "kira-back" | "tom-asleep" | "dante-swipe"): (Placement & { src: string }) | undefined {
  const p = placeSwap(MANIFEST, src);
  return p ? { ...p, phoneNudgeCm: CATS.get(cat)?.phoneNudgeCm ?? 0, src } : undefined;
}
const SWAPS: Partial<Record<CatId, Placement & { src: string }>> = {
  kira: swapFor("kira", "kira-back"),
  tom: swapFor("tom", "tom-asleep"),
  dante: swapFor("dante", "dante-swipe"),
};

/** Chart labels every 10 cm: the wall's, to its top, and each phone strip's, to its own. */
const MARKS = chartMarks();
const CAT_MARKS = chartMarks(PHONE_CHART.catTopCm);

/** What the wall asks of Lenis; `reset` (stand where the page is) is public at runtime, private in its types (lenisContract.test.ts). */
type Glider = Pick<Lenis, "scrollTo" | "animatedScroll" | "targetScroll" | "isStopped" | "isScrolling"> & { reset(): void };

/** The board's bounce lets go this long after her last push (ms). */
const HELD_MS = 90;

/** The remembered choice changes only by her own pick on this page: nothing to subscribe to. */
function subscribeNothing(): () => void {
  return () => {};
}

function readRemembered(): boolean {
  try {
    return rememberedChoice(window.sessionStorage.getItem(PLAYER_KEY));
  } catch {
    return false;
  }
}

/** "1,26 m" / "1.26 m": his real height on one knee, as his slot states it. */
function metres(cm: number, lang: Locale): string {
  return `${new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cm / 100)} m`;
}

/** An image's place on the chart as inline custom properties (lineup.ts placementStyle). */
function placed(p: Placement): CSSProperties {
  return { ...placementStyle(p), "--cat-ar": `${p.w} / ${p.h}` } as CSSProperties;
}

function Figure({ id, p, className, swap }: { id: string; p: Placement; className: string; swap?: boolean }) {
  return (
    <picture>
      <source type="image/avif" srcSet={`/interlude/${id}.avif`} />
      <img
        className={className}
        style={placed(p)}
        src={`/interlude/${id}.webp`}
        width={p.w}
        height={p.h}
        alt=""
        loading="lazy"
        decoding="async"
        data-swap={swap ? "" : undefined}
      />
    </picture>
  );
}

/** The plate's lock (a cat she has tried) and the chips' icons: small drawn glyphs, never a font's. */
function Lock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 12" aria-hidden="true" focusable="false">
      <rect x="1" y="5" width="8" height="6.4" rx="1" fill="currentColor" />
      <path d="M2.8 5V3.6a2.2 2.2 0 0 1 4.4 0V5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ChipIcon({ id }: { id: CatId }) {
  const common = { viewBox: "0 0 12 12", "aria-hidden": true, focusable: false, fill: "none", stroke: "currentColor" } as const;
  switch (id) {
    case "kira":
      return (
        <svg {...common} strokeWidth="1.5">
          <circle cx="6" cy="6" r="4.6" />
          <path d="M2.8 9.2 9.2 2.8" />
        </svg>
      );
    case "tom":
      return <Lock />;
    case "odin":
      return (
        <svg {...common} strokeWidth="1.2">
          <circle cx="6" cy="6" r="5" />
          <circle cx="6" cy="6" r="2.4" />
          <path d="M6 6 10.5 3.6" strokeWidth="1.4" />
        </svg>
      );
    default:
      return (
        <svg {...common} strokeWidth="1.3" strokeLinecap="round">
          <path d="M3 11 9 1M5.6 11.4 10.6 3M1 9 6.6 0.6" />
        </svg>
      );
  }
}

/**
 * THE USUAL SUSPECTS as a character select (select.ts): the line-up's
 * wall and chart, the four cats and Jesús on one knee, a real button each.
 * The cats refuse, each in its own way (Dante's claw swipe tears the
 * screen, claw.ts); Jesús is chosen, and the way on to the main story
 * appears. Until he is, the page stops at the select's foot
 * (selectWall.ts): the gate SmoothScroll trims to, the board's bounce and
 * the prompt, and every other move of hers pulled back; navigation (a
 * link, Skip, a deep link, Back, the focus moving on) opens it. The choice
 * is remembered for the visit.
 *
 * The server renders the select at rest, every word in it; without script
 * there is no wall, and the way on is a plain link.
 */
export function CharacterSelect({ dict, lang }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const lenis = useLenis();
  const [picked, setState] = useState(newSelect);
  /** The choice, remembered for the visit (sessionStorage): kept, without a replay. */
  const remembered = useSyncExternalStore(subscribeNothing, readRemembered, () => false);
  const state = useMemo(() => (remembered && !picked.chosen ? { ...picked, chosen: true } : picked), [picked, remembered]);
  /** A choice made on this page (the flash, the banner's slam) rather than kept from earlier in the visit (still). */
  const [fresh, setFresh] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const timers = useRef(new Map<string, number>());
  const wallWords = dict.wall;
  const wall = useRef({ closed: true, y: Number.POSITIVE_INFINITY, keyAt: Number.NEGATIVE_INFINITY, pushAt: Number.NEGATIVE_INFINITY, held: 0 });


  const announce = useCallback((text: string) => {
    const el = live.current;
    if (!el) return;
    // Cleared first, so the same refusal twice is said twice.
    el.textContent = "";
    window.setTimeout(() => {
      el.textContent = text;
    }, 30);
  }, []);

  const slotOf = (id: SlotId) => root.current?.querySelector<HTMLElement>(`[data-slot="${id}"]`) ?? null;

  /** Dante's claw swipe: three marks torn across the screen, and the page shakes (still marks under reduced motion). */
  const swipe = useCallback(
    (slot: HTMLElement) => {
      const svg = root.current?.parentElement?.querySelector<SVGSVGElement>("[data-claw]");
      const board = root.current;
      if (!svg || !board) return;
      // From his own head (the render on the chart), not the slot's tall stage.
      const figure = slot.querySelector<HTMLElement>("img") ?? slot.querySelector<HTMLElement>("[data-stage]") ?? slot;
      const box = figure.getBoundingClientRect();
      const W = window.innerWidth;
      const H = window.innerHeight;
      const phone = W < 700;
      const claw = clawMarks(W, H, clawStart(box, { width: W, height: H }, phone), phone);
      const ns = "http://www.w3.org/2000/svg";
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.replaceChildren();
      // Plain paths and the reveal's masks, no SVG filter (claw.ts: Safari drew them on the CPU, every frame).
      const defs = document.createElementNS(ns, "defs");
      defs.innerHTML = claw.marks
        .map(
          (mark, k) =>
            `<mask id="claw-reveal-${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path data-reveal d="${mark.center}" pathLength="1" fill="none" stroke="#fff" stroke-width="${(claw.width * 4).toFixed(1)}" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="${reducedMotion ? 0 : 1}"/></mask>`,
        )
        .join("");
      svg.appendChild(defs);
      claw.marks.forEach((mark, k) => {
        const g = document.createElementNS(ns, "g");
        g.setAttribute("mask", `url(#claw-reveal-${k})`);
        g.innerHTML =
          mark.glow.map((d) => `<path class="${styles.clawGlow}" d="${d}"/>`).join("") +
          `<path class="${styles.clawEdge}" d="${mark.edge}"/>` +
          `<path class="${styles.clawFlesh}" d="${mark.flesh}"/>` +
          `<path class="${styles.clawGash}" d="${mark.gash}"/>` +
          `<path class="${styles.clawCore}" d="${mark.core}"/>`;
        svg.appendChild(g);
      });
      const t = CLAW_TIMING;
      const lead = reducedMotion ? 0 : t.lead;
      const hold = reducedMotion ? t.reducedHold : t.hold;
      const total = lead + hold + t.out;
      svg.querySelectorAll<SVGPathElement>("[data-reveal]").forEach((reveal, k) => {
        if (reducedMotion) return;
        reveal.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: t.rake,
          delay: lead + k * t.stagger,
          easing: "cubic-bezier(.2,.75,.35,1)",
          fill: "both",
        });
      });
      svg.getAnimations().forEach((a) => a.cancel());
      svg.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: lead / total },
          { opacity: 1, offset: lead / total + 0.0001 },
          { opacity: 1, offset: (lead + hold) / total },
          { opacity: 0, offset: 1 },
        ],
        { duration: total, fill: "both" },
      );
      if (!reducedMotion) {
        board.getAnimations().forEach((a) => a.cancel());
        board.animate(
          [
            { transform: "none" },
            { transform: "translate(-9px, 5px) rotate(-.25deg)" },
            { transform: "translate(8px, -6px) rotate(.2deg)" },
            { transform: "translate(-7px, -3px)" },
            { transform: "translate(6px, 4px) rotate(.12deg)" },
            { transform: "translate(-4px, 2px)" },
            { transform: "translate(3px, -2px)" },
            { transform: "translate(-1px, 1px)" },
            { transform: "none" },
          ],
          { duration: t.shake, delay: lead, easing: "linear" },
        );
      }
    },
    [reducedMotion],
  );

  const flash = useCallback(
    (slot: HTMLElement) => {
      if (reducedMotion) return;
      const el = root.current?.parentElement?.querySelector<HTMLElement>("[data-flash]");
      if (!el) return;
      const box = (slot.querySelector<HTMLElement>("img") ?? slot.querySelector<HTMLElement>("[data-stage]") ?? slot).getBoundingClientRect();
      el.style.setProperty("--fx", `${((box.left + box.width / 2) / window.innerWidth) * 100}%`);
      el.style.setProperty("--fy", `${((box.top + box.height / 2) / window.innerHeight) * 100}%`);
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0 }], { duration: 460, easing: "ease-out" });
    },
    [reducedMotion],
  );

  const openWall = useCallback(() => {
    wall.current.closed = false;
    selectGate.maxScroll = Number.POSITIVE_INFINITY;
    setSelectHeld(false);
  }, []);

  const onPick = useCallback(
    (id: SlotId) => {
      const now = performance.now();
      const { state: next, effect } = pick(state, id, now, reducedMotion);
      setState(next);
      const slot = slotOf(id);
      if (effect.type === "choose") {
        try {
          window.sessionStorage.setItem(PLAYER_KEY, PLAYER_ONE);
        } catch {
          // Storage blocked: the choice holds for this page.
        }
        openWall();
        // A cat still refusing stops: its chip and its act never stand over the choice.
        for (const id of timers.current.values()) window.clearTimeout(id);
        timers.current.clear();
        for (const other of root.current?.querySelectorAll<HTMLElement>("[data-refusing]") ?? []) other.removeAttribute("data-refusing");
        if (effect.first) {
          setFresh(true);
          if (slot) flash(slot);
        }
        announce(dict.player1.live);
        return;
      }
      announce(dict.refusals[effect.id].live);
      if (!slot) return;
      // Replays from the start, the one before it stops.
      for (const other of root.current?.querySelectorAll<HTMLElement>("[data-refusing]") ?? []) {
        if (other !== slot) other.removeAttribute("data-refusing");
      }
      slot.removeAttribute("data-refusing");
      void slot.offsetWidth;
      slot.setAttribute("data-refusing", "");
      window.clearTimeout(timers.current.get(effect.id));
      timers.current.set(
        effect.id,
        window.setTimeout(() => {
          slot.removeAttribute("data-refusing");
          setState((s) => settle(s, performance.now()));
        }, effect.ms),
      );
      if (effect.kind === "claw") {
        tryDante();
        swipe(slot);
      }
    },
    [announce, dict, flash, openWall, reducedMotion, state, swipe],
  );

  // The refusals' renders wait unseen (opacity 0), and the browser decodes an
  // image only once it paints it: the first strike showed an empty slot for
  // a frame or two. Each is decoded as soon as it has loaded (they stay lazy).
  useEffect(() => {
    const images = [...(root.current?.querySelectorAll<HTMLImageElement>("img[data-swap]") ?? [])];
    const decode = (img: HTMLImageElement) => void img.decode().catch(() => undefined);
    for (const img of images) {
      if (img.complete && img.naturalWidth > 0) decode(img);
      else img.addEventListener("load", () => decode(img), { once: true });
    }
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending.values()) window.clearTimeout(id);
    };
  }, []);

  // The mouse moving onto a slot while the keyboard is in the roster takes the focus with it, as the
  // start menu does: one 1P cursor, never one on the focused slot and one on the hovered.
  const onPointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    const active = document.activeElement;
    if (active === event.currentTarget || !(active instanceof HTMLElement) || !active.matches("[data-pick]")) return;
    if (!root.current?.contains(active)) return;
    event.currentTarget.focus({ preventScroll: true });
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = rovingIndex(index, event.key);
    if (next === null || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    setFocusIndex(next);
    root.current?.querySelectorAll<HTMLButtonElement>("[data-pick]")[next]?.focus();
  };

  // ---------------------------------------------------------------- the wall

  useEffect(() => {
    const board = root.current;
    const section = board?.closest("section");
    if (!board || !section) return;
    const w = wall.current;
    w.closed = !state.chosen;
    if (state.chosen) selectGate.maxScroll = Number.POSITIVE_INFINITY;
    setSelectHeld(w.closed);
    return () => setSelectHeld(false);
  }, [state.chosen]);

  useEffect(() => {
    const board = root.current;
    const section = board?.closest("section");
    const prompt = section?.querySelector<HTMLElement>("[data-prompt]");
    if (!board || !section) return;
    const w = wall.current;
    let screen = stableScreen().small;
    let geometry = { top: 0, bottom: 0 };
    const measure = () => {
      screen = stableScreen().small;
      const box = section.getBoundingClientRect();
      geometry = { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY };
      const crown = section.querySelector<HTMLElement>("[data-crown]")?.getBoundingClientRect();
      const player = section.querySelector<HTMLElement>(`[data-slot="${PLAYER_ONE}"]`)?.getBoundingClientRect();
      const cats = [...section.querySelectorAll<HTMLElement>("[data-slot]")]
        .filter((slot) => slot.dataset.slot !== PLAYER_ONE)
        .map((slot) => slot.getBoundingClientRect());
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      w.y = selectFrontier(
        geometry,
        screen,
        crown && player ? { top: crown.top + window.scrollY, stacked: isStacked(player, cats) } : undefined,
        CROWN_HEADROOM_REM * rem,
      );
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(section);
    observer?.observe(document.body);
    window.addEventListener("resize", measure);

    // Her input, as the wall reads it: a recent wheel, finger, key or mouse press is hers, and so is
    // a page moved with a mouse button held (the scrollbar dragged), the step of a click on the
    // scrollbar's track (it animates on after the button is up) and a push the wall is still pulling
    // back (a native fling outlives every window). Anything else that moves the page is navigation.
    let inputAt = Number.NEGATIVE_INFINITY;
    let liftedAt = Number.NEGATIVE_INFINITY;
    let barAt = Number.NEGATIVE_INFINITY;
    let pulledAt = Number.NEGATIVE_INFINITY;
    let buttons = 0;
    const onInput = () => {
      inputAt = performance.now();
    };
    const onLift = () => {
      liftedAt = performance.now();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      buttons = event.buttons;
      inputAt = performance.now();
      // A press on the page's root, outside every element, is a press on the scrollbar.
      if (event.target === document.documentElement) barAt = inputAt;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse") buttons = event.buttons;
    };
    const onBlur = () => {
      buttons = 0;
    };

    const lenisNow = () => lenis as unknown as Glider | undefined;
    const push = (amount: number) => {
      const now = performance.now();
      w.held = Math.min(w.held + amount, 2000);
      w.pushAt = now;
    };
    const backToWall = () => {
      const l = lenisNow();
      l?.reset();
      window.scrollTo({ top: w.y, behavior: "instant" });
      if (l) l.animatedScroll = l.targetScroll = window.scrollY;
    };

    // Keys that would scroll past the wall glide to it instead, and are felt there.
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || !w.closed || !Number.isFinite(w.y)) return;
      const target = event.target instanceof Element ? event.target : null;
      const kind = target?.closest("input, textarea, select, [contenteditable='true']")
        ? "field"
        : target?.closest("button, a[href], summary, [role='button'], [role='tab']")
          ? "control"
          : "page";
      const amount = keyForward(event, kind, window.innerHeight);
      if (amount === null) return;
      inputAt = performance.now();
      w.keyAt = inputAt;
      // Only once the page is past the hero's film: the hero's own keys are the hero's.
      if (Number.isFinite(scrollGate.heroEnd) && window.scrollY < scrollGate.heroEnd - 1) return;
      const action = keyAtWall(window.scrollY, w.y, amount);
      if (action === "native") return;
      event.preventDefault();
      push(ELASTIC.knock * screen);
      if (action === "glide") {
        const l = lenisNow();
        if (l && !reducedMotion) l.scrollTo(w.y, { force: true });
        else backToWall();
      }
    };

    // The focus moving on past the select (Tab, a screen reader) is her moving on: the wall opens.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!w.closed || !(target instanceof Node) || section.contains(target)) return;
      if (section.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) openWall();
    };

    const unregister = registerPassage({ key: "select", section, open: openWall });

    let lastPressure = scrollGate.pressure;
    let lastPushedAt = scrollGate.pushedAt;
    let lastFrame = performance.now();
    let promptOn = false;
    let shift = 0;
    let lastScroll = window.scrollY;
    let raf = 0;
    const frame = () => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - lastFrame) / 1000);
      lastFrame = now;
      if (!w.closed) {
        selectGate.maxScroll = Number.POSITIVE_INFINITY;
      } else {
        selectGate.maxScroll = w.y;
        const scroll = window.scrollY;
        // The page still moving from a click on the scrollbar's track: still that click's step.
        if (Math.abs(scroll - lastScroll) > 0.5 && now - barAt < BAR_WINDOW_MS) barAt = now;
        const l = lenisNow();
        // The select's wall binds when it is the first one ahead (the hero's walls open, the city's further on).
        const binding = w.y <= Math.min(scrollGate.maxScroll, stageGate.maxScroll) + 0.5;
        if (binding && scrollGate.pushedAt !== lastPushedAt && scroll >= w.y - screen * 0.5) {
          push(Math.max(0, scrollGate.pressure - lastPressure) || ELASTIC.knock * screen * 0.5);
        }
        if (binding && l && !l.isStopped) {
          if (l.isScrolling === "smooth" && l.targetScroll > w.y + 1) {
            push(Math.min(l.targetScroll - w.y, screen * 0.3));
            l.scrollTo(w.y, { programmatic: false, lerp: motion.touchLerp, force: true });
          }
        }
        if (binding) {
          const verdict = wallVerdict({
            scroll,
            wall: w.y,
            now,
            lastInputAt: Math.max(inputAt, w.keyAt),
            liftedAt: Math.max(liftedAt, scrollGate.touchEndAt),
            pointerHeld: buttons !== 0,
            barAt,
            pulledAt,
          });
          if (verdict === "back") {
            pulledAt = now;
            push(Math.min(scroll - w.y, screen * 0.3));
            backToWall();
          } else if (verdict === "open") {
            openWall();
          }
        }
      }
      lastPressure = scrollGate.pressure;
      lastPushedAt = scrollGate.pushedAt;
      lastScroll = window.scrollY;

      // The board gives under her push and springs back, as the hero's card does.
      const touch = scrollGate.touching;
      if (!(touch && now - w.pushAt < HELD_MS)) w.held = decay(w.held, dt, touch ? ELASTIC.releaseTau : ELASTIC.wheelTau);
      if (w.held < 0.05) w.held = 0;
      const give =
        reducedMotion || !w.closed
          ? 0
          : touch
            ? rubberBand(w.held, touchStretchMax(screen))
            : rubberBand(Math.max(0, w.held - ELASTIC.wheelDeadZone), ELASTIC.wheelMax * 1.75);
      const rounded = Math.round(give * 10) / 10;
      if (rounded !== shift) {
        shift = rounded;
        board.style.translate = shift > 0.2 ? `0 ${-shift}px` : "";
      }
      const show = w.closed && now - w.pushAt < PROMPT_MS;
      if (show !== promptOn) {
        promptOn = show;
        // The prompt is drawn for the eye; a screen reader hears it once a push.
        if (show) announce(wallWords);
        prompt?.toggleAttribute("data-on", show);
        board.toggleAttribute("data-walled", show);
      }
      // Once the wall is open and the board has settled there is nothing left to do a frame.
      raf = w.closed || shift > 0 || promptOn ? window.requestAnimationFrame(frame) : 0;
    };
    raf = window.requestAnimationFrame(frame);

    window.addEventListener("wheel", onInput, { capture: true, passive: true });
    window.addEventListener("touchstart", onInput, { capture: true, passive: true });
    window.addEventListener("touchmove", onInput, { capture: true, passive: true });
    window.addEventListener("touchend", onLift, { capture: true, passive: true });
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      window.cancelAnimationFrame(raf);
      unregister();
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("wheel", onInput, true);
      window.removeEventListener("touchstart", onInput, true);
      window.removeEventListener("touchmove", onInput, true);
      window.removeEventListener("touchend", onLift, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      selectGate.maxScroll = Number.POSITIVE_INFINITY;
      board.style.translate = "";
    };
  }, [announce, lenis, openWall, reducedMotion, wallWords]);

  // ---------------------------------------------------------------- markup

  const slots = SLOT_IDS.map((id) => {
    if (id === PLAYER_ONE) {
      return { id, name: dict.player1.name, alias: dict.player1.alias, description: dict.player1.description, p: PLAYER as Placement };
    }
    const cat = dict.cats.find((c) => c.id === id);
    const p = CATS.get(id);
    return cat && p ? { id, name: cat.name, alias: cat.alias, description: cat.description, p } : null;
  }).filter((slot) => slot !== null);

  const chosen = state.chosen;
  return (
    <>
      <div
        ref={root}
        className={styles.board}
        style={BOARD_STYLE}
        data-board
        data-chosen={chosen ? (fresh ? "fresh" : "kept") : undefined}
      >
        {/* The wall's chart, to 140 cm (lineup.ts CHART): a line every 10 cm and every 5, labelled at both edges, read from the floor. */}
        <div className={styles.chart} aria-hidden="true">
          {MARKS.map((cm) => (
            <span key={cm} className={styles.mark} style={{ "--mark": cm } as CSSProperties}>
              <span>{cm}</span>
              <span>{cm}</span>
            </span>
          ))}
        </div>

        <header className={styles.head}>
          <p className={styles.slug}>
            <span className={styles.place}>{dict.place}</span> <span className={styles.associates}>{dict.associates}</span>
          </p>
          <h3 id="suspects-select" className={styles.title}>
            <span className={styles.titleMain}>{dict.title}</span>
            <span className={styles.titleSub}>
              <span className={styles.p1}>{dict.player}</span>
              <span className={styles.state}>
                <span data-when="waiting">{dict.waiting}</span>
                <span data-when="chosen">{dict.player1.name}</span>
              </span>
            </span>
          </h3>
        </header>

        <p className="sr-only">{dict.description}</p>

        <ul className={styles.roster} aria-labelledby="suspects-select">
          {slots.map(({ id, name, alias, description, p }, index) => {
            const cat = isCatId(id) ? id : null;
            const refusal = cat ? dict.refusals[cat] : null;
            const swap = cat ? SWAPS[cat] : undefined;
            const style = {
              ...placementStyle(p),
              "--dur": cat ? `${REFUSALS[cat].ms}ms` : "0ms",
            } as CSSProperties;
            return (
              <li
                key={id}
                className={styles.slot}
                data-slot={id}
                data-tried={cat && state.tried.includes(cat) ? "" : undefined}
                data-swipe={cat === "dante" && swap ? "" : undefined}
                style={style}
              >
                <button
                  type="button"
                  className={styles.pick}
                  data-pick
                  tabIndex={index === focusIndex ? 0 : -1}
                  aria-disabled={cat ? true : undefined}
                  aria-label={`${name}, ${alias}. ${refusal ? refusal.why : chosen ? dict.player1.chosen : dict.player1.why}`}
                  aria-describedby={`suspect-${id}-about`}
                  onClick={() => onPick(id)}
                  onKeyDown={onKeyDown(index)}
                  onFocus={() => setFocusIndex(index)}
                  onPointerEnter={onPointerEnter}
                >
                  <span className={styles.stage} data-stage aria-hidden="true">
                    <span className={styles.pool} />
                    {/* A phone's strip carries its own piece of the chart's numbers, at the same scale. */}
                    <span className={styles.ruler}>
                      {(id === PLAYER_ONE ? MARKS : CAT_MARKS).map((cm) => (
                        <span key={cm} style={{ "--mark": cm } as CSSProperties}>
                          {cm}
                        </span>
                      ))}
                    </span>
                    <span className={styles.numeral}>{index + 1}</span>
                    {id === PLAYER_ONE ? (
                      <>
                        <span className={styles.tick} data-crown>
                          <span>{metres(PLAYER.headTopCm, lang)}</span>
                        </span>
                        <span className={styles.selflag}>{dict.player1.selected}</span>
                      </>
                    ) : null}
                    {id === "odin" ? (
                      <>
                        <span className={styles.radar}>
                          <i />
                        </span>
                        <span className={styles.ghost} />
                      </>
                    ) : null}
                    <span className={styles.fig}>
                      <span className={styles.figIn}>
                        <Figure id={id} p={p} className={styles.cat} />
                        {swap ? <Figure id={swap.src} p={swap} className={styles.swap} swap /> : null}
                      </span>
                      {id === "tom" ? (
                        <span className={styles.zzz}>
                          <span>z</span>
                          <span>z</span>
                          <span>Z</span>
                        </span>
                      ) : null}
                    </span>
                    {cat && refusal ? (
                      <span className={styles.chip}>
                        <ChipIcon id={cat} />
                        <b>{refusal.status}</b>
                        <span>{refusal.reason}</span>
                      </span>
                    ) : null}
                    <span className={styles.cursor}>
                      <span className={styles.p1}>1P</span>
                    </span>
                  </span>
                  <span className={styles.plate}>
                    <span className={styles.number} aria-hidden="true">
                      {cat ? <Lock className={styles.lock} /> : null}
                      {dict.numberPrefix} {plateNumber(index)}
                    </span>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.alias}>{alias}</span>
                  </span>
                </button>
                <p id={`suspect-${id}-about`} className={styles.desc}>
                  {description}
                </p>
              </li>
            );
          })}
        </ul>

        <div className={styles.foot}>
          <p className={styles.legend} aria-hidden="true">
            <span className={styles.keysOnly}>
              <span className={styles.key}>←</span>
              <span className={styles.key}>→</span>
              {dict.legend.move}
            </span>
            <span className={styles.keysOnly}>
              <span className={styles.key}>{dict.legend.enter}</span>
              {dict.legend.pick}
            </span>
            <span className={styles.touchOnly}>{dict.legend.touch}</span>
          </p>
          {/* Until he is chosen, the way on is a locked stop for the keyboard: Tab never leaves the select unsaid. */}
          {chosen ? null : (
            <button
              type="button"
              className={styles.locked}
              aria-disabled="true"
              data-locked
              onClick={() => announce(dict.wall)}
            >
              <Lock className={styles.lockedIcon} />
              {dict.wall}
            </button>
          )}
          <div className={styles.after}>
            <p className={styles.banner} aria-hidden="true">
              <span className={styles.ribbon}>{dict.player1.name}</span>
              <span className={styles.kicker}>{dict.player}</span>
            </p>
            <p className={styles.wayOn}>
              <a href="#work" className={styles.wayLink}>
                {dict.wayOn}
                <span className={styles.wayGlyph} aria-hidden="true" />
              </a>
              <small aria-hidden="true">
                <span className={styles.keysOnly}>{dict.orScroll}</span>
                <span className={styles.touchOnly}>{dict.orSwipe}</span>
              </small>
            </p>
          </div>
        </div>

        <p ref={live} className="sr-only" aria-live="polite" data-live />
      </div>

      {/* Out of the board, so its shake and bounce never move them: the wall's prompt, the flash, the claw marks. */}
      <p className={styles.prompt} data-prompt aria-hidden="true">
        <span className={styles.promptGlyph} />
        {dict.wall}
      </p>
      <span className={styles.flash} data-flash aria-hidden="true" />
      <svg className={styles.claw} data-claw aria-hidden="true" focusable="false" />
    </>
  );
}
