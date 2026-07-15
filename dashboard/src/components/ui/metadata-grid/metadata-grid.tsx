import type { ReactNode } from "react";

import { DetailGrid, DetailItem } from "../detail-grid";

// ── Types ──────────────────────────────────────────────────────────────────

export type MetadataField = {
  /** Stable identifier for this field (used as React key). */
  key: string;
  /** Pre-translated label (use `_(msg\`...\`)` at the call site). */
  label: string;
  /** Value to display. Strings render with overflow tooltip; ReactNodes render inline. */
  value: ReactNode;
  /** When `true`, this field is hidden. Use for conditional fields. */
  hideIf?: boolean;
  /** Optional icon rendered before the label text. */
  icon?: ReactNode;
};

export type MetadataGridProps = {
  /** Array of field descriptors. Fields with `hideIf: true` are skipped. */
  fields: MetadataField[];
  /** Optional section title shown above the grid rows. */
  title?: string;
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * MetadataGrid — schema-driven key-value display grid.
 *
 * Takes an array of {@link MetadataField} descriptors and renders them
 * using {@link DetailGrid} + {@link DetailItem}. This replaces manual
 * field-by-field `<DetailItem>` lists in detail views.
 *
 * Each module defines its field schema as a constant or derived function,
 * eliminating duplicated layout code per domain.
 *
 * @example
 * ```tsx
 * const DEVICE_INFO_FIELDS = (device: DeviceDetailResponse): MetadataField[] => [
 *   { key: "sn", label: _(msg`Serial Number`), value: device.serial_number },
 *   { key: "label", label: _(msg`Label`), value: device.label || "—" },
 *   { key: "model", label: _(msg`Model`), value: device.model, hideIf: !device.model },
 * ];
 *
 * <Card>
 *   <Card.Content>
 *     <MetadataGrid fields={DEVICE_INFO_FIELDS(device)} />
 *   </Card.Content>
 * </Card>
 * ```
 *
 * All labels are **pre-translated** by the caller using Lingui `_(msg\`...\`)`.
 * MetadataGrid itself has zero i18n dependencies.
 */
export function MetadataGrid({ fields, title }: MetadataGridProps) {
  const visible = fields.filter((f) => !f.hideIf);

  if (visible.length === 0) {
    return null;
  }

  return (
    <DetailGrid title={title}>
      {visible.map((field) => (
        <DetailItem key={field.key} label={field.label} icon={field.icon}>
          {field.value}
        </DetailItem>
      ))}
    </DetailGrid>
  );
}
