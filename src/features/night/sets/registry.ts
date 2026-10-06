import { army } from "./ArmySet";
import { cloud } from "./CloudSet";
import { heuristik } from "./HeuristikSet";
import { logixs } from "./LogixsSet";
import { pwc } from "./PwcSet";
import type { NightSet } from "./types";

/** The five stops' sets, in the order of the drive (work/stops.ts). */
export const SETS: readonly NightSet[] = [
  army,
  pwc,
  cloud,
  logixs,
  heuristik,
];
