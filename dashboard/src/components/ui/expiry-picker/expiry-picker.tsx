import { useCallback, useId, useMemo } from "react";
import { clsx } from "clsx";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { IconX } from "@tabler/icons-react";
import { addDays, format } from "date-fns";

import styles from "./expiry-picker.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ExpiryPreset = "never" | "30d" | "60d" | "90d" | "180d" | "365d" | "custom";

export type ExpiryValue = {
  /** Which preset is selected. */
  preset: ExpiryPreset;
  /** For "custom" preset: the exact date. */
  customDate: Date | null;
};

type ExpiryPickerProps = {
  label?: string;
  error?: string;
  helperText?: string;
  /** Current selection. */
  value: ExpiryValue;
  /** Called when selection changes. */
  onChange: (value: ExpiryValue) => void;
  /** Minimum allowed date. */
  minDate?: Date;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
};

/** Preset definitions with day counts. */
type PresetDef = {
  key: ExpiryPreset;
  days: number | null; // null = never expires
};

const PRESETS: PresetDef[] = [
  { key: "never", days: null },
  { key: "30d", days: 30 },
  { key: "60d", days: 60 },
  { key: "90d", days: 90 },
  { key: "180d", days: 180 },
  { key: "365d", days: 365 },
  { key: "custom", days: null },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function ExpiryPicker({
  label,
  error,
  helperText,
  value,
  onChange,
  minDate,
  disabled = false,
  fullWidth = false,
  className,
}: ExpiryPickerProps) {
  const { _ } = useLingui();
  const autoId = useId();
  const pickerId = autoId;
  const errorId = `${pickerId}-error`;
  const helperId = `${pickerId}-helper`;

  const tomorrow = useMemo(() => addDays(new Date(), 1), []);

  // Localized preset labels
  const presetLabels: Record<ExpiryPreset, string> = useMemo(
    () => ({
      never: _(msg`No expiry`),
      "30d": _(msg`30 days`),
      "60d": _(msg`60 days`),
      "90d": _(msg`90 days`),
      "180d": _(msg`180 days`),
      "365d": _(msg`365 days`),
      custom: _(msg`Custom date`),
    }),
    [_],
  );

  const handlePresetClick = useCallback(
    (preset: ExpiryPreset) => {
      if (preset === "custom") {
        // When switching to custom, default to tomorrow
        onChange({
          preset: "custom",
          customDate: value.customDate || tomorrow,
        });
      } else {
        onChange({ preset, customDate: null });
      }
    },
    [onChange, value.customDate, tomorrow],
  );

  const handleCustomDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateStr = e.target.value;
      if (dateStr) {
        const parsed = new Date(dateStr + "T00:00:00");
        if (!Number.isNaN(parsed.getTime())) {
          onChange({ preset: "custom", customDate: parsed });
        }
      }
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange({ preset: "never", customDate: null });
  }, [onChange]);

  // Display summary
  const displayText = useMemo(() => {
    if (value.preset === "never") {
      return _(msg`No expiration`);
    }
    if (value.preset === "custom" && value.customDate) {
      return format(value.customDate, "yyyy-MM-dd");
    }
    const def = PRESETS.find((p) => p.key === value.preset);
    if (def?.days) {
      const targetDate = addDays(new Date(), def.days);
      return `${_(msg`Expires`)} ${format(targetDate, "MMM d, yyyy")}`;
    }
    return "";
  }, [value, _]);

  const formatDateForInput = (date: Date | null): string => {
    if (!date) return "";
    return format(date, "yyyy-MM-dd");
  };

  return (
    <div
      data-slot="expiry-picker"
      className={clsx(styles.container, fullWidth && styles.fullWidth, className)}
    >
      {label && (
        <span data-slot="expiry-picker-label" className={styles.label}>
          {label}
        </span>
      )}

      <div data-slot="expiry-picker-presets" className={styles.presets} role="radiogroup" aria-label={label || _(msg`Expiry duration`)}>
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            data-slot="expiry-picker-preset"
            role="radio"
            aria-checked={value.preset === preset.key}
            className={clsx(
              styles.presetChip,
              value.preset === preset.key && styles.presetChipActive,
            )}
            disabled={disabled}
            onClick={() => handlePresetClick(preset.key)}
          >
            {presetLabels[preset.key]}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div data-slot="expiry-picker-custom" className={styles.customDateWrapper}>
          <input
            type="date"
            data-slot="expiry-picker-custom-date"
            className={styles.customDateInput}
            value={formatDateForInput(value.customDate)}
            onChange={handleCustomDateChange}
            min={minDate ? format(minDate, "yyyy-MM-dd") : format(tomorrow, "yyyy-MM-dd")}
            disabled={disabled}
          />
          <button
            type="button"
            data-slot="expiry-picker-clear"
            className={styles.clearButton}
            onClick={handleClear}
            aria-label={_(msg`Clear expiry date`)}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {value.preset !== "never" && displayText && (
        <div data-slot="expiry-picker-display" className={styles.display}>
          <span>{displayText}</span>
        </div>
      )}

      {error && (
        <p data-slot="expiry-picker-error" id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p data-slot="expiry-picker-helper" id={helperId} className={styles.helper}>
          {helperText}
        </p>
      )}
    </div>
  );
}
