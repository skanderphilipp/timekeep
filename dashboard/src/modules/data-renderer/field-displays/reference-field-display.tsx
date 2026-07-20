import { useCallback } from "react";
import { Tag } from "@/components/ui";
import { useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { useFieldContext } from "../contexts/field-context";
import type { EntityType } from "@/types/entities";

type ReferenceFieldDisplayProps = {
  /** The display value (label). */
  value: string;
  /** The entity ID to navigate to. */
  entityId: string;
  /** The entity type to navigate to (e.g., "device", "user", "department"). */
  referenceEntity: string;
};

/**
 * Generic reference / FK field display — renders as a clickable Tag.
 *
 * Navigates to the related entity detail panel on click.
 * The wrapper span stops event propagation so the cell-level
 * click-to-edit doesn't fire when clicking the Tag.
 *
 * `display: inline-block` ensures the span is only as wide as
 * the Tag — clicking empty area around the Tag still enters
 * edit mode via the cell's onClick.
 *
 * **Navigation routing** (`LayoutRenderingContext` pattern):
 * - When `onNavigateToEntity` is provided via `FieldContext`, it delegates
 *   to that callback. This allows the record-detail module to route
 *   correctly: main panel → full page, side panel → nested panel.
 * - When NOT provided (e.g., table cells), falls back to
 *   `useOpenDetailPanel` which opens a side panel.
 *
 * This is the SINGLE display component for ALL FK/reference fields.
 * No per-entity variant exists — the navigation target comes from
 * `referenceEntity`, set by `createCellRenderer` from column metadata.
 */
export function ReferenceFieldDisplay({
  value,
  entityId,
  referenceEntity,
}: ReferenceFieldDisplayProps) {
  const openDetail = useOpenDetailPanel();
  const { onNavigateToEntity } = useFieldContext();

  const handleClick = useCallback(() => {
    if (!entityId) return;

    if (onNavigateToEntity) {
      onNavigateToEntity(referenceEntity, entityId, value || entityId);
    } else {
      openDetail(referenceEntity as EntityType, entityId, value || entityId);
    }
  }, [entityId, value, referenceEntity, onNavigateToEntity, openDetail]);

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      data-no-close
      style={{ display: "inline-block" }}
    >
      <Tag text={value || "-"} color="gray" onClick={handleClick} />
    </span>
  );
}
