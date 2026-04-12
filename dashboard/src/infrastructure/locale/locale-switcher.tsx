import { useCallback } from "react";
import { IconLanguage } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  type AppLocale,
  switchLocale,
  getLocaleConfig,
  LOCALE_CONFIG,
} from "@/infrastructure/locale/locale";
import { useLocale } from "./use-locale";
import { Button } from "@/components/ui/button";

import styles from "./locale-switcher.module.scss";

export function LocaleSwitcher() {
  const { _ } = useLingui();
  const currentLocale = useLocale();
  const currentConfig = getLocaleConfig(currentLocale);

  const handleSelect = useCallback((locale: AppLocale) => {
    switchLocale(locale);
  }, []);

  // Single locale → no dropdown needed
  if (LOCALE_CONFIG.length <= 1) return null;

  // 2 locales → toggle button (existing behavior)
  if (LOCALE_CONFIG.length === 2) {
    const other = LOCALE_CONFIG.find((c) => c.code !== currentLocale)!;
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={<IconLanguage size={16} />}
        onClick={() => handleSelect(other.code)}
        aria-label={_(msg`Switch language`) + ` (${currentConfig?.nativeLabel ?? currentLocale})`}
        title={other.nativeLabel}
      >
        {currentLocale.toUpperCase()}
      </Button>
    );
  }

  // 3+ locales → dropdown picker
  return (
    <div data-slot="locale-switcher" className={styles.picker}>
      <select
        className={styles.select}
        value={currentLocale}
        onChange={(e) => handleSelect(e.target.value as AppLocale)}
        aria-label={_(msg`Switch language`)}
      >
        {LOCALE_CONFIG.map((config) => (
          <option key={config.code} value={config.code}>
            {config.nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
