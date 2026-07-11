import { DatePicker } from "@/components/ui/date-picker";
import { fromDateString, toDateString } from "@/lib/date";

type FilterDateRangeProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/**
 * Filter bar date field — ISO string ↔ Date bridging layer over DatePicker.
 */
export function FilterDateRange({ label, value, onChange, className }: FilterDateRangeProps) {
  const dateValue = value ? fromDateString(value) : null;

  const handleChange = (date: Date | null) => {
    onChange(date ? toDateString(date) : "");
  };

  return (
    <DatePicker
      value={dateValue}
      onChange={handleChange}
      placeholder={label}
      clearable
      className={className}
    />
  );
}
