import { useCallback } from "react";
import { Chip, ChipAccent, ChipVariant, ChipSize } from "@/components/ui";
import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useFieldContext } from "../contexts/field-context";

type DeviceSnFieldDisplayProps = {
  value: string;
};

/**
 * Device serial number field display — renders as a clickable chip.
 *
 * The `device_label` field is available in the API response via `Punch.device_label`.
 * Currently shows the serial number; a future improvement can render the label when available.
 */
export function DeviceSnFieldDisplay({ value }: DeviceSnFieldDisplayProps) {
  const openDetail = useOpenDetailPanel();
  const { entityId } = useFieldContext();

  const sn = entityId ?? value;

  const handleClick = useCallback(() => {
    if (sn) {
      openDetail("device", sn, `Device ${value}`);
    }
  }, [sn, value, openDetail]);

  return (
    <Chip
      size={ChipSize.Small}
      label={value}
      variant={ChipVariant.Regular}
      accent={ChipAccent.TextPrimary}
      clickable
      onClick={handleClick}
    />
  );
}
