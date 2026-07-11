import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { ReactNode } from "react";

type FilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional icon/avatar/status indicator rendered before the label. */
  prefix?: ReactNode;
  /** Optional element rendered after the label (e.g. count badge). */
  suffix?: ReactNode;
};

type FilterSelectProps = {
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  /** Passed through to Combobox for fully custom option rendering. */
  renderOption?: (option: ComboboxOption, checkIndicator: ReactNode) => ReactNode;
  className?: string;
};

/**
 * Filter bar select — backed by Combobox for searchable, keyboard-navigable selection.
 * Auto-enables the search input when there are more than 8 options.
 *
 * Supports rich options with `prefix` (icons, avatars) and `suffix` (counts)
 * via the underlying Combobox. Use `renderOption` for fully custom markup.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  renderOption,
  className,
}: FilterSelectProps) {
  const comboboxOptions: ComboboxOption[] = options.map((o) => ({
    value: o.value,
    label: o.label,
    disabled: o.disabled,
    prefix: o.prefix,
    suffix: o.suffix,
  }));

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Combobox
      options={comboboxOptions}
      value={value}
      onChange={onChange}
      placeholder={selectedLabel ?? label}
      searchable={options.length > 8}
      renderOption={renderOption}
      className={className}
    />
  );
}
