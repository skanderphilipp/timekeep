import { clsx } from "clsx";
import { type ReactNode } from "react";

import styles from "./view-picker.module.scss";

// ── Types ──────────────────────────────────────────────────────────────

export type ViewType = "table" | "timeline" | "calendar";

export type ViewPickerOption = {
  value: ViewType;
  label: string;
  icon: ReactNode;
};

export type ViewPickerProps = {
  /** Available view options. */
  options: ViewPickerOption[];
  /** Currently active view type. */
  value: ViewType;
  /** Called when a view type is selected. */
  onChange: (type: ViewType) => void;
  className?: string;
};

// ── Component ──────────────────────────────────────────────────────────

/**
 * ViewPicker — compact toggle for switching between table, timeline, and calendar views.
 *
 * Renders as a segmented button group. Designed to live in the `left` slot
 * of a TopBar. Each option has an icon + label.
 *
 * ```tsx
 * <ViewPicker
 *   options={[
 *     { value: "table", label: "Table", icon: <IconTable size={14} /> },
 *     { value: "timeline", label: "Timeline", icon: <IconTimeline size={14} /> },
 *   ]}
 *   value={currentView}
 *   onChange={setView}
 * />
 * ```
 */
export function ViewPicker({ options, value, onChange, className }: ViewPickerProps) {
  return (
    <div data-slot="view-picker" className={clsx(styles.root, className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-slot="view-picker-option"
          className={styles.option}
          data-active={value === opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          <span className={styles.icon}>{opt.icon}</span>
          <span className={styles.label}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

ViewPicker.displayName = "ViewPicker";
