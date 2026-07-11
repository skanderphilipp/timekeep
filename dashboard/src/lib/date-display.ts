/**
 * Date display formatting utilities.
 *
 * Wraps date-fns for locale-aware display formatting:
 * - `formatDate` — format a date/time for display (e.g., "Jul 10, 2026 14:30")
 * - `formatRelative` — human-readable relative time (e.g., "2 hours ago")
 * - `formatShort` — short format (e.g., "10/07/2026")
 * - `formatTime` — time only (e.g., "14:30")
 *
 * Locale detection: reads from document.documentElement.lang or falls back to "en".
 * Use the `locale` parameter to override (e.g., for Arabic: "ar").
 *
 * Complements `temporal-polyfill` (in `lib/date.ts`) which handles data manipulation
 * (date arithmetic, comparisons, ISO parsing).
 */

import { format, formatDistanceToNow, type Locale } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { ar } from "date-fns/locale/ar";

// ── Locale map ────────────────────────────────────────────────────────────────

const locales: Record<string, Locale> = {
  en: enUS,
  ar,
};

/**
 * Resolves a locale string to a date-fns Locale.
 * Falls back to English if the locale is not supported.
 */
function resolveLocale(locale?: string): Locale {
  const lang = locale ?? (typeof document !== "undefined" ? document.documentElement.lang : "en");
  return locales[lang] ?? enUS;
}

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Format a date with a custom pattern.
 *
 * Common patterns:
 * - `"PP"` → Jul 10, 2026
 * - `"PPpp"` → Jul 10, 2026, 2:30 PM
 * - `"yyyy-MM-dd"` → 2026-07-10
 * - `"HH:mm"` → 14:30
 *
 * @see https://date-fns.org/docs/format
 */
export function formatDate(date: Date | number, pattern: string, locale?: string): string {
  return format(date, pattern, { locale: resolveLocale(locale) });
}

/**
 * Human-readable relative time.
 *
 * Examples: "less than a minute ago", "2 hours ago", "3 days ago".
 *
 * Uses date-fns `formatDistanceToNow` with `addSuffix: true`.
 */
export function formatRelative(date: Date | number, locale?: string): string {
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: resolveLocale(locale),
  });
}

/**
 * Short date format (numeric).
 *
 * Example: "10/07/2026" (en) or "١٠/٠٧/٢٠٢٦" (ar).
 */
export function formatShort(date: Date | number, locale?: string): string {
  return format(date, "P", { locale: resolveLocale(locale) });
}

/**
 * Time-only format.
 *
 * Example: "14:30" (24h).
 */
export function formatTime(date: Date | number, locale?: string): string {
  return format(date, "HH:mm", { locale: resolveLocale(locale) });
}

/**
 * Date + time format.
 *
 * Example: "Jul 10, 2026, 14:30".
 */
export function formatDateTime(date: Date | number, locale?: string): string {
  return format(date, "PPpp", { locale: resolveLocale(locale) });
}
