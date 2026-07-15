import { useCallback } from "react";
import { Tag } from "@/components/ui";
import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useFieldContext } from "../contexts/field-context";

type UserPinFieldDisplayProps = {
  value: string;
};

/**
 * User-reference field display — renders as a clickable tag.
 *
 * Used for both `user_pin` and `employee_name` columns.
 * - `employee_name`: displays the name, navigates via PIN from entityId.
 * - `user_pin`: displays the PIN, navigates via the PIN itself.
 *
 * Falls back to "-" when the display value is empty (entityId is
 * navigation-only and never shown as display text).
 */
export function UserPinFieldDisplay({ value }: UserPinFieldDisplayProps) {
  const openDetail = useOpenDetailPanel();
  const { entityId } = useFieldContext();

  /** Navigation identifier: entityId (set by createCellRenderer) or the raw value. */
  const pin = entityId ?? value;

  const handleClick = useCallback(() => {
    if (pin) {
      openDetail("user", pin, `User ${value || pin}`);
    }
  }, [pin, value, openDetail]);

  /** Display text: value only. entityId is for navigation, NOT for display. */
  const displayLabel = value || "-";

  return <Tag text={displayLabel} color="gray" onClick={handleClick} />;
}
