/**
 * THE USUAL SUSPECTS as a character select: the line-up's five slots, the
 * four cats who refuse to be picked, each in its own way, and Jesús, the
 * only one in the house who lets you pick him. Pure: CharacterSelect.tsx
 * applies it (the animations, the live region, the wall) and the tests
 * hold it.
 *
 * - Picking a cat (a click, a tap, Enter or Space on its button) never
 *   chooses it: it refuses for a moment (`REFUSALS`), and the slot keeps a
 *   lock on its plate for the rest of the visit (`tried`). Kira turns her
 *   back, Tom falls asleep, Odin ducks out of sight and the radar finds
 *   nothing, and Dante, the culprit, lashes out: a claw swipe tears the
 *   screen (claw.ts). Picking one again replays the refusal.
 * - Picking Jesús chooses him: PLAYER 1, the banner and the way on. The
 *   choice is remembered for the visit (sessionStorage, `PLAYER_KEY`), and
 *   with it the wall after the line-up opens (selectWall.ts).
 */
import { CAT_IDS, type CatId, PLAYER_ONE, SLOT_IDS, type SlotId } from "./lineup";

/** How each cat says no. */
export type RefusalKind = "turn" | "sleep" | "hide" | "claw";

/**
 * Each cat's refusal and how long it plays (ms), as in the approved
 * mockup: long enough to read its chip, short enough to try the next one.
 */
export const REFUSALS = {
  kira: { kind: "turn", ms: 2400 },
  tom: { kind: "sleep", ms: 2800 },
  dante: { kind: "claw", ms: 2600 },
  odin: { kind: "hide", ms: 2700 },
} as const satisfies Record<CatId, { kind: RefusalKind; ms: number }>;

/** Under reduced motion a refusal is a still state (her back, the closed eyes, the empty slot, the scratches): it stays a little longer. */
export const REDUCED_HOLD_MS = 2800;

/** Where the choice is remembered for the visit (sessionStorage). */
export const PLAYER_KEY = "va-player-one";

export type SelectState = {
  /** Jesús is PLAYER 1: the banner is up and the wall is open. */
  chosen: boolean;
  /** The cat refusing right now, and until when (ms, the caller's clock). */
  refusing: { id: CatId; until: number } | null;
  /** Every cat she has tried to pick this visit (a lock on its plate), in slot order. */
  tried: readonly CatId[];
};

export function newSelect(chosen = false): SelectState {
  return { chosen, refusing: null, tried: [] };
}

export type PickEffect =
  | { type: "refuse"; id: CatId; kind: RefusalKind; ms: number }
  | { type: "choose"; first: boolean };

/**
 * She picks the slot `id` at `now`: a cat refuses (replaying if it was
 * already refusing, the one refusing before it stops), Jesús is chosen.
 */
export function pick(state: SelectState, id: SlotId, now: number, reduced = false): { state: SelectState; effect: PickEffect } {
  if (id === PLAYER_ONE) {
    return { state: { ...state, chosen: true, refusing: null }, effect: { type: "choose", first: !state.chosen } };
  }
  const { kind, ms: playMs } = REFUSALS[id];
  const ms = reduced ? Math.max(playMs, REDUCED_HOLD_MS) : playMs;
  const tried = state.tried.includes(id) ? state.tried : CAT_IDS.filter((cat) => cat === id || state.tried.includes(cat));
  return {
    state: { ...state, refusing: { id, until: now + ms }, tried },
    effect: { type: "refuse", id, kind, ms },
  };
}

/** The refusal is over once its time has passed. */
export function settle(state: SelectState, now: number): SelectState {
  return state.refusing && now >= state.refusing.until ? { ...state, refusing: null } : state;
}

/**
 * Roving focus between the slots (one tab stop for the roster): the arrows
 * step (and wrap), Home and End go to the ends. Null for any other key.
 * The slots run left to right on a wide screen and two by two on a phone,
 * so left and right are the only directions: up and down keep scrolling
 * the page.
 */
export function rovingIndex(index: number, key: string, count = SLOT_IDS.length): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Whether what sessionStorage holds says she has chosen Jesús this visit. */
export function rememberedChoice(raw: string | null | undefined): boolean {
  return raw === PLAYER_ONE;
}
