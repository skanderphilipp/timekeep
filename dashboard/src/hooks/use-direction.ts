import { useLingui } from "@lingui/react";
import { getLangDir } from "rtl-detect";

/**
 * Returns the text direction for the currently active locale.
 *
 * Uses Lingui's active locale and rtl-detect to determine direction.
 * Returns "ltr" or "rtl".
 */
export function useDirection(): "ltr" | "rtl" {
  const { i18n } = useLingui();
  const dir = getLangDir(i18n.locale);
  return dir === "rtl" ? "rtl" : "ltr";
}
