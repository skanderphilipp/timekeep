import { atom } from "jotai";
import { makeAtomFamily } from "./atom-family";

export const tableColumnVisibilityStateFamily = makeAtomFamily((_instanceId: string) =>
  atom<Map<string, boolean>>(new Map()),
);
