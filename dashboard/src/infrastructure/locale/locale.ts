/**
 * Locale detection and activation — mirrors Reaktly's initialI18nActivate pattern.
 *
 * Priority: URL param → localStorage → browser preference → fallback (SOURCE_LOCALE)
 *
 * ## Adding a new language
 *
 * Add one entry to `LOCALE_CONFIG` below, then run:
 *   lingui extract    → generates the .po template
 *   translate the .po → fill msgstr entries
 *   lingui compile    → compiles to JS
 *
 * That's it. Detection, switching, RTL, and the locale picker UI
 * all derive from this single config.
 */
import { i18n } from "@lingui/core";

// ── Locale Configuration (single source of truth) ──────────────────────────

export type LocaleConfig = {
  /** ISO 639-1 language code (also used as the catalog directory name). */
  code: string;
  /** Human-readable label in the language itself (e.g., "Français" not "French"). */
  nativeLabel: string;
  /** Text direction: "ltr" or "rtl". */
  direction: "ltr" | "rtl";
  /**
   * Browser locale prefixes that should resolve to this locale.
   * The first match wins. Used for auto-detection from navigator.language.
   * @example ["fr", "fr-FR", "fr-CA"] for French
   */
  browserPrefixes: string[];
};

/**
 * All supported locales.
 *
 * ADD NEW LANGUAGES HERE — everything else is derived automatically.
 */
export const LOCALE_CONFIG: LocaleConfig[] = [
  {
    code: "en",
    nativeLabel: "English",
    direction: "ltr",
    browserPrefixes: ["en"],
  },
  {
    code: "ar",
    nativeLabel: "العربية",
    direction: "rtl",
    browserPrefixes: ["ar"],
  },
  {
    code: "fr",
    nativeLabel: "Français",
    direction: "ltr",
    browserPrefixes: ["fr", "fr-FR", "fr-CA", "fr-BE", "fr-CH"],
  },
];

// ── Derived values ─────────────────────────────────────────────────────────

export const SOURCE_LOCALE = LOCALE_CONFIG[0].code;

export type AppLocale = (typeof LOCALE_CONFIG)[number]["code"];

/** Record of locale code → config for O(1) lookup. */
const LOCALE_MAP: Record<string, LocaleConfig> = Object.fromEntries(
  LOCALE_CONFIG.map((c) => [c.code, c]),
);

/** Set of valid locale codes for fast membership checks. */
export const VALID_LOCALES = new Set(Object.keys(LOCALE_MAP));

/** Map of browser prefix → locale code for auto-detection. */
const BROWSER_PREFIX_MAP: Map<string, string> = new Map();
for (const config of LOCALE_CONFIG) {
  for (const prefix of config.browserPrefixes) {
    BROWSER_PREFIX_MAP.set(prefix.toLowerCase(), config.code);
  }
}

export function getLocaleConfig(locale: string): LocaleConfig | undefined {
  return LOCALE_MAP[locale];
}

export function getLocaleDirection(locale: string): "ltr" | "rtl" {
  return LOCALE_MAP[locale]?.direction ?? "ltr";
}

// ── Detection ──────────────────────────────────────────────────────────────

function normalizeLocale(raw: string): string {
  const normalized = raw.toLowerCase().replace("_", "-");

  // Exact match
  if (LOCALE_MAP[normalized]) return normalized;

  // Browser prefix match (e.g., "fr-FR" → "fr")
  const prefix = normalized.split("-")[0];
  const mapped = BROWSER_PREFIX_MAP.get(normalized) ?? BROWSER_PREFIX_MAP.get(prefix);
  if (mapped) return mapped;

  return normalized;
}

function isValidLocale(locale: string): locale is AppLocale {
  return VALID_LOCALES.has(locale);
}

export async function detectAndActivateLocale(): Promise<AppLocale> {
  // 1. URL param (?locale=ar)
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get("locale");

  // 2. localStorage
  const storageLocale = localStorage.getItem("ao-locale");

  // 3. Navigator
  const navLocale = typeof navigator !== "undefined" ? navigator.language : undefined;

  let locale: AppLocale = SOURCE_LOCALE;

  if (urlLocale) {
    const normalized = normalizeLocale(urlLocale);
    if (isValidLocale(normalized)) locale = normalized;
    try { localStorage.setItem("ao-locale", locale); } catch { /* noop */ }
  } else if (storageLocale) {
    const normalized = normalizeLocale(storageLocale);
    if (isValidLocale(normalized)) locale = normalized;
  } else if (navLocale) {
    const normalized = normalizeLocale(navLocale);
    if (isValidLocale(normalized)) locale = normalized;
  }

  await activateLocale(locale);
  return locale;
}

// ── Activation ─────────────────────────────────────────────────────────────

export async function activateLocale(locale: AppLocale): Promise<void> {
  const { messages } = await import(`../../locales/${locale}.po`);
  i18n.load({ [locale]: messages });
  i18n.activate(locale);

  const config = getLocaleConfig(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = config?.direction ?? "ltr";
}

export function switchLocale(locale: AppLocale): void {
  localStorage.setItem("ao-locale", locale);
  activateLocale(locale);
}
