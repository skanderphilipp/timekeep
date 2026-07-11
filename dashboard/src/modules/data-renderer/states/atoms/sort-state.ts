import { atom } from "jotai";
import { makeAtomFamily } from "./atom-family";
import type { SortEntry } from "../../types";

export const tableSortStateFamily = makeAtomFamily((_instanceId: string) => atom<SortEntry[]>([]));
