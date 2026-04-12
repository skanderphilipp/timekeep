import { useEffect, useState } from "react";
import { i18n } from "@lingui/core";

import { type AppLocale, SOURCE_LOCALE, VALID_LOCALES, LOCALE_CONFIG } from "./locale";

/**
 * Reactive hook tracking the currently active Lingui locale.
 *
 * Subscribes to `i18n.on('change')` — zero-latency updates without
 * MutationObserver or polling.
 */
export function useLocale(): AppLocale {
  const [locale, setLocale] = useState<AppLocale>(() => {
    const current = i18n.locale || SOURCE_LOCALE;
    return VALID_LOCALES.has(current as AppLocale) ? (current as AppLocale) : SOURCE_LOCALE;
  });

  useEffect(() => {
    const unsubscribe = i18n.on("change", () => {
      const next = i18n.locale || SOURCE_LOCALE;
      if (VALID_LOCALES.has(next as AppLocale)) {
        setLocale(next as AppLocale);
      }
    });
    return unsubscribe;
  }, []);

  return locale;
}

/**
 * Returns all available locales from the central config.
 * Use this to render locale pickers without hardcoding.
 */
export function useAvailableLocales() {
  return LOCALE_CONFIG;
}
