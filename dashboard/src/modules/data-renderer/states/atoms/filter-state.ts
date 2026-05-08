import { atom } from "jotai";
import { makeAtomFamily } from "./atom-family";
import type { FilterEntry } from "../../types";

export const tableFilterStateFamily = makeAtomFamily((_instanceId: string) =>
  atom<FilterEntry[]>([]),
);
