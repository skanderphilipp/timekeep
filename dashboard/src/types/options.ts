import type { ReactNode } from "react";

/** Option shape for single-select controls (Combobox, Select). */
export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional icon, avatar, or status indicator rendered before the label. */
  prefix?: ReactNode;
  /** Optional element rendered after the label (e.g., count badge). */
  suffix?: ReactNode;
};

/** Option shape for multi-select controls. */
export type MultiSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
