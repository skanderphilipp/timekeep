import { atom } from "jotai";
import { makeAtomFamily } from "./atom-family";

export const tableLoadingStateFamily = makeAtomFamily((_instanceId: string) =>
  atom<boolean>(false),
);
