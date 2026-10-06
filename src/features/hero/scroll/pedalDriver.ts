/**
 * The pedal, driven: everything between the pedal's state (pedal.ts) and a
 * pinned stage, shared by every film the visitor drives. The pure frame
 * (`driveFrame`) says what one tick of a held pedal does; the driver
 * (`createPedalDriver`) holds it with a pointer, a key or a click and runs
 * that frame on the scroll's ticker (heroProgress.addDriveStep), so a held
 * pedal drives a stage exactly as it drives the hero: a press plays the
 * next line, holding pushes the scroll on through the same gate and walls,
 * going back suspends the push, and resting at the stage's very end goes
 * on once the way on has been read.
 *
 * The career city uses it (features/work/WorkStage.tsx); the stage tells
 * it what is on screen through a `PedalHost`.
 */
import type Lenis from "lenis";
import { ELASTIC } from "./elastic";
import { addDriveStep, type InputSource, recordPedal, scrollGate, scrollInput } from "./heroProgress";
import {
  keyLost,
  newPedal,
  PEDAL,
  type Pedal,
  pedalPush,
  pedalRate,
  pedalSpeed,
  type PedalVia,
  pressPedal,
  releasePedal,
  stepPedal,
  suspendPedal,
} from "./pedal";

/** A pointer holding the pedal that has sent nothing this long (ms) is checked: still captured, or let go. */
export const PEDAL_WATCHDOG_MS = 10_000;
/** A click on the pedal this long (ms) after a pointer pressed it is that press's own click, not a tap. */
export const PEDAL_CLICK_MS = 1000;

export type DriveInput = {
  /** The frame, seconds (already capped by the caller). */
  dt: number;
  /** A backward input of hers since the last frame. */
  back: boolean;
  /** Seconds since her last backward input. */
  sinceBack: number;
  /** Lenis stopped, or the stage still (reduced motion): the pedal holds but does not push. */
  frozen: boolean;
  /** The picture at the stage's very end, Lenis' target there and no line glide in flight. */
  atEnd: boolean;
  /** A line step's glide is still in flight: the push waits for it to land. */
  stepping: boolean;
};

export type DriveAction =
  /** Up: nothing to do (the plate springs back on its own). */
  | { kind: "up" }
  /** Down but no input: going back suspended it, or the stage is frozen. */
  | { kind: "suspended" }
  | { kind: "frozen" }
  /** Resting at the end: no input; `goOn` once it has rested PEDAL.endHold. */
  | { kind: "end"; goOn: boolean }
  /** Her foot is input; `push` false while a line glide is in flight. */
  | { kind: "drive"; level: number; push: boolean };

/** One held pedal's frame, pure: what it is and what the stage should do. `endHold` accumulates in `state`. */
export function driveFrame(p: Pedal, state: { endHold: number }, input: DriveInput): DriveAction {
  const level = stepPedal(p, input.dt);
  if (!p.down) {
    state.endHold = 0;
    return { kind: "up" };
  }
  if (suspendPedal(p, { back: input.back, sinceBack: input.sinceBack })) {
    state.endHold = 0;
    return { kind: "suspended" };
  }
  if (input.frozen) return { kind: "frozen" };
  if (input.atEnd) {
    state.endHold += input.dt;
    return { kind: "end", goOn: state.endHold >= PEDAL.endHold };
  }
  state.endHold = 0;
  return { kind: "drive", level, push: !input.stepping };
}

/** What a stage tells the driver. Called from events and from the scroll's ticker. */
export type PedalHost = {
  /** The pedal's button, for pointer capture; null when it is not rendered. */
  button(): HTMLElement | null;
  /** Whether the stage takes a press now (in it, entered, Lenis running, the radio closed, motion on). */
  canPress(): boolean;
  /** A new press: plays the next line (or goes on at the end). True when it knocked on an unread line's wall. */
  step(source: InputSource): boolean;
  /** Goes on past the stage's end (the held pedal rested there long enough). */
  goOn(source: InputSource): void;
  /** The stage's frame for the push, or null while it is not driving (off screen). */
  frame(): null | {
    /** Seconds the story's clocks may take a frame. */
    maxStep: number;
    /** The stage's end and its current wall, page px; the wall's index (-1 none). */
    end: number;
    wall: number;
    wallIndex: number;
    vh: number;
    /** The picture is at the stage's end. */
    atEnd: boolean;
    /** Her last backward input the stage itself saw (a rewind), performance.now(). */
    backAt: number;
    frozen: boolean;
  };
  /** Reads the page before Lenis moves (gate.ts lenisMissed). */
  readScroll(): void;
};

export type PedalDriver = {
  pedal: Pedal;
  /** The words her prompts speak while it is down. */
  source(): InputSource;
  /** Presses it (the button, W or Space). False when the stage takes no input. */
  press(via: PedalVia, at: number): boolean;
  /** Lets go: the push stops at once, the plate springs back. */
  letGo(at?: number): void;
  /** A key held as the pedal: its down (first press; true when it now holds the pedal) and its autorepeat heartbeat. */
  holdKey(event: KeyboardEvent): boolean;
  /** The code of the key holding it, if a key does. */
  heldKey(): string | null;
  /** A glide of `seconds` toward page px `to` has started (a line step): the push waits for it. */
  glide(to: number, seconds: number): void;
  /** Lets go when its holder may be gone: the wheel opened, a lost keyup, a silent pointer. */
  watch(now: number, holderGone: boolean): void;
  /** Removes its listeners and its drive step. */
  dispose(): void;
};

export function createPedalDriver(host: PedalHost): PedalDriver {
  const pedal = newPedal();
  const state = { endHold: 0 };
  let source: InputSource = "pedal";
  let pressBackAt = Number.NEGATIVE_INFINITY;
  let stepGlide: { to: number; until: number } | null = null;
  let keyHold: { code: string; key: string; at: number; repeating: boolean } | null = null;
  let pointerHold: number | null = null;
  let pointerHoldAt = Number.NEGATIVE_INFINITY;
  let pointerAt = Number.NEGATIVE_INFINITY;

  const buzz = (pattern: number | number[]) => {
    if (!navigator.userActivation?.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  };

  const letGo = (at = performance.now()) => {
    releasePedal(pedal, at);
    const id = pointerHold;
    keyHold = null;
    pointerHold = null;
    scrollInput.pedal = 0;
    const button = host.button();
    if (id !== null && button?.hasPointerCapture(id)) button.releasePointerCapture(id);
  };

  const press = (via: PedalVia, at: number): boolean => {
    if (!host.canPress()) return false;
    host.readScroll();
    const kind = pressPedal(pedal, via, at);
    if (kind === null) return true;
    source = via === "key" ? "key" : "pedal";
    pressBackAt = scrollInput.backwardAt;
    buzz(6);
    if (kind === "regrip") return true;
    if (host.step(source)) {
      // The press's knock is the arrival's: resting on that wall, the push does not knock again.
      pedal.contact = true;
      pedal.wall = host.frame()?.wallIndex ?? -1;
    }
    return true;
  };

  const stepping = (now: number, lenis: Lenis) =>
    stepGlide !== null && now < stepGlide.until && Math.abs(lenis.targetScroll - stepGlide.to) < 1;

  const off = addDriveStep((deltaMs, lenis) => {
    const frame = host.frame();
    if (!frame) {
      stepPedal(pedal, Math.max(0, deltaMs) / 1000);
      return;
    }
    const now = performance.now();
    const back = scrollInput.backwardAt > pressBackAt;
    if (back) pressBackAt = scrollInput.backwardAt;
    const glidingNow = stepping(now, lenis);
    const action = driveFrame(pedal, state, {
      dt: Math.min(Math.max(0, deltaMs) / 1000, frame.maxStep),
      back,
      sinceBack: (now - Math.max(pressBackAt, frame.backAt)) / 1000,
      frozen: frame.frozen || lenis.isStopped,
      atEnd: frame.atEnd && lenis.targetScroll >= frame.end - 0.5 && !glidingNow,
      stepping: glidingNow,
    });
    if (action.kind === "up" || action.kind === "frozen") return;
    if (action.kind === "suspended") {
      scrollInput.pedal = 0;
      return;
    }
    if (action.kind === "end") {
      scrollInput.pedal = 0;
      if (action.goOn) {
        state.endHold = 0;
        host.goOn(source);
      }
      return;
    }
    recordPedal(pedalRate(action.level), source, now);
    if (!action.push) return;
    host.readScroll();
    const { dest, knock } = pedalPush(pedal, {
      target: lenis.targetScroll,
      push: pedalSpeed(action.level) * frame.vh * pedalDt(deltaMs, frame.maxStep),
      max: Math.min(frame.wall, frame.end),
      dt: pedalDt(deltaMs, frame.maxStep),
      wall: frame.wallIndex,
    });
    // A knock is on a line's wall; the end of the stage is not a wall, the pedal just rests there.
    if (knock && frame.wall < frame.end) {
      scrollGate.pressure += ELASTIC.knock * frame.vh;
      scrollGate.pushedAt = now;
    }
    if (dest > lenis.targetScroll + 0.01) lenis.scrollTo(dest, { programmatic: false, lerp: PEDAL.lerp });
  });

  // The button: down presses it (primary button only) and keeps it, captured, until up or a cancel.
  const onDown = (event: PointerEvent) => {
    pointerAt = performance.now();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (pedal.down) return;
    if (!press(event.pointerType === "mouse" ? "mouse" : "touch", event.timeStamp) || !pedal.down) return;
    pointerHold = event.pointerId;
    pointerHoldAt = performance.now();
    try {
      host.button()?.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone: its up or cancel lets go.
    }
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerId === pointerHold) pointerHoldAt = performance.now();
  };
  const onUp = (event: PointerEvent) => {
    pointerAt = performance.now();
    if (event.pointerId === pointerHold) letGo(event.timeStamp);
  };
  const prevent = (event: Event) => event.preventDefault();
  // A click no pointer pressed (VoiceOver, Voice Control, Switch Control): a tap on the pedal.
  const onClick = (event: MouseEvent) => {
    if (event.detail !== 0 && performance.now() - pointerAt < PEDAL_CLICK_MS) return;
    if (pedal.down) return;
    const at = performance.now();
    if (press("mouse", at)) letGo(at);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (!keyHold) return;
    if (event.code !== keyHold.code && event.key !== keyHold.key) return;
    if (event.key === " " || event.key === "Spacebar") event.preventDefault();
    letGo(event.timeStamp);
  };
  const onAway = () => {
    if (pedal.down) letGo();
  };

  const button = host.button();
  button?.addEventListener("pointerdown", onDown);
  button?.addEventListener("pointermove", onMove);
  button?.addEventListener("pointerup", onUp);
  button?.addEventListener("pointercancel", onUp);
  button?.addEventListener("lostpointercapture", onUp);
  button?.addEventListener("mousedown", prevent);
  button?.addEventListener("contextmenu", prevent);
  button?.addEventListener("click", onClick);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onAway);
  window.addEventListener("pagehide", onAway);

  return {
    pedal,
    source: () => source,
    press,
    letGo,
    holdKey(event) {
      if (event.repeat) {
        if (keyHold && keyHold.code === event.code) {
          keyHold.at = performance.now();
          keyHold.repeating = true;
        }
        return keyHold !== null;
      }
      if (press("key", event.timeStamp) && pedal.via === "key") {
        keyHold = { code: event.code, key: event.key, at: performance.now(), repeating: false };
        return true;
      }
      return false;
    },
    heldKey: () => keyHold?.code ?? null,
    glide(to, seconds) {
      stepGlide = { to, until: performance.now() + seconds * 1000 };
    },
    watch(now, holderGone) {
      if (!pedal.down) return;
      if (holderGone) letGo(now);
      else if (keyHold && keyLost({ repeating: keyHold.repeating, sinceKeyMs: now - keyHold.at })) letGo(now);
      else if (pointerHold !== null && now - pointerHoldAt > PEDAL_WATCHDOG_MS && !host.button()?.hasPointerCapture(pointerHold)) {
        letGo(now);
      }
    },
    dispose() {
      if (pedal.down) letGo();
      off();
      button?.removeEventListener("pointerdown", onDown);
      button?.removeEventListener("pointermove", onMove);
      button?.removeEventListener("pointerup", onUp);
      button?.removeEventListener("pointercancel", onUp);
      button?.removeEventListener("lostpointercapture", onUp);
      button?.removeEventListener("mousedown", prevent);
      button?.removeEventListener("contextmenu", prevent);
      button?.removeEventListener("click", onClick);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onAway);
      window.removeEventListener("pagehide", onAway);
    },
  };
}

function pedalDt(deltaMs: number, maxStep: number): number {
  return Math.min(Math.max(0, deltaMs) / 1000, maxStep);
}
