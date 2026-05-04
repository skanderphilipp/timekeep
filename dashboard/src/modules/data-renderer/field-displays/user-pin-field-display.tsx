import { useCallback } from "react";
import { Chip, ChipAccent, ChipVariant, ChipSize } from "@/components/ui/chip";
import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useFieldContext } from "../contexts/field-context";

type UserPinFieldDisplayProps = {
  value: string;
};

/**
 * User PIN / name field display — renders as a clickable chip.
 *
 * Shows the employee name when available (from the `employee_name` field),
 * falling back to the raw PIN. Clicking navigates to the user detail panel
 * using the PIN as the entity identifier.
 */
export function UserPinFieldDisplay({ value }: UserPinFieldDisplayProps) {
  const openDetail = useOpenDetailPanel();
  const { entityId } = useFieldContext();

  const pin = entityId ?? value;

  const handleClick = useCallback(() => {
    if (pin) {
      openDetail("user", pin, `User ${value}`);
    }
  }, [pin, value, openDetail]);

  const displayLabel = value || pin;

  return (
    <Chip
      size={ChipSize.Small}
      label={displayLabel}
      variant={ChipVariant.Regular}
      accent={ChipAccent.TextSecondary}
      clickable
      onClick={handleClick}
    />
  );
}
