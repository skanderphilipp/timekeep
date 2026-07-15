import { EllipsisDisplay } from "./ellipsis-display";

type NumberDisplayProps = {
  value: string | number | null | undefined;
  decimals?: number;
  suffix?: string;
};

/**
 * Read-only number display with optional decimal formatting and suffix.
 *
 * Accepts string, number, null, or undefined. Null/undefined renders
 * an empty cell. Decimals default to 0 (integer display).
 *
 * @example
 * <NumberDisplay value={42} />
 * <NumberDisplay value={3.14159} decimals={2} />
 * <NumberDisplay value={120} suffix="min" />
 */
export function NumberDisplay({
  value,
  decimals = 0,
  suffix,
}: NumberDisplayProps) {
  if (value === null || value === undefined) return null;

  const num = typeof value === "string" ? Number.parseFloat(value) : value;

  if (Number.isNaN(num)) return null;

  const formatted = num.toFixed(decimals);
  const displayText = suffix ? `${formatted} ${suffix}` : formatted;

  return <EllipsisDisplay>{displayText}</EllipsisDisplay>;
}
