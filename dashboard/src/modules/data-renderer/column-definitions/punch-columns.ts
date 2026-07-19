import type { MessageDescriptor } from "@lingui/core";

import type {
  ColumnDefinition,
  StatusFieldMetadata,
  EnumFieldMetadata,
  ReferenceFieldMetadata,
  TimestampFieldMetadata,
} from "../types";
import { msg } from "@lingui/core/macro";
import { PUNCH_STATUSES, type PunchStatusValue } from "@shared/punch-statuses";
import { getPunchStatusColor } from "@/lib/punch-status-colors";

type T = (descriptor: MessageDescriptor) => string;

/** I18n label descriptors for punch statuses. */
const STATUS_LABELS: Record<PunchStatusValue, MessageDescriptor> = {
  check_in: msg`Check In`,
  check_out: msg`Check Out`,
  break_out: msg`Break Out`,
  break_in: msg`Break In`,
  overtime_in: msg`OT In`,
  overtime_out: msg`OT Out`,
};

/**
 * Punch column definitions — for the punch/attendance query table.
 *
 * Used as fallback when the backend schema hasn't loaded yet.
 * Primary source is `useSchemaColumns("punch")` → schema-driven columns.
 *
 * TODO(ENTERPRISE): Remove once backend schema is always available on init.
 * Phase: Schema hydration guarantee
 * Impact: Frontend defines column types twice (here + metadata.ts REFERENCE_CONFIG).
 * Fix: Ensure metadata store is hydrated before first render, remove hardcoded columns.
 */
export function createPunchColumns(_: T): ColumnDefinition[] {
  const labels: Record<string, string> = {};
  const colors: Record<string, string> = {};
  for (const s of PUNCH_STATUSES) {
    labels[s.value] = _(STATUS_LABELS[s.value]);
    colors[s.value] = getPunchStatusColor(s.value);
  }

  return [
    {
      id: "timestamp",
      header: _(msg`Timestamp`),
      fieldId: "timestamp",
      label: _(msg`Timestamp`),
      type: "timestamp",
      metadata: {
        fieldName: "timestamp",
        isSortable: true,
        format: "iso",
      } as TimestampFieldMetadata,
      isVisible: true,
      width: "180px",
    },
    {
      id: "user_pin",
      header: _(msg`PIN`),
      fieldId: "user_pin",
      label: _(msg`PIN`),
      type: "reference",
      metadata: {
        fieldName: "user_pin",
        isSortable: true,
        referenceEntity: "employee",
        referenceIdField: "user_pin",
      } as ReferenceFieldMetadata,
      isVisible: true,
      width: "120px",
    },
    {
      id: "employee_name",
      header: _(msg`Name`),
      fieldId: "employee_name",
      label: _(msg`Name`),
      type: "reference",
      metadata: {
        fieldName: "employee_name",
        isSortable: false,
        referenceEntity: "employee",
        referenceIdField: "user_pin",
        displayField: "employee_name",
      } as ReferenceFieldMetadata,
      isVisible: true,
      width: "160px",
    },
    {
      id: "device_sn",
      header: _(msg`Device`),
      fieldId: "device_sn",
      label: _(msg`Device`),
      type: "reference",
      metadata: {
        fieldName: "device_sn",
        isSortable: true,
        referenceEntity: "device",
        referenceIdField: "device_sn",
        displayField: "device_label",
      } as ReferenceFieldMetadata,
      isVisible: true,
      width: "150px",
    },
    {
      id: "status",
      header: _(msg`Status`),
      fieldId: "status",
      label: _(msg`Status`),
      type: "status",
      metadata: {
        fieldName: "status",
        isSortable: true,
        labels,
        colors: colors as Record<string, "green" | "red" | "amber" | "blue" | "gray" | "accent">,
      } as StatusFieldMetadata,
      isVisible: true,
      width: "120px",
    },
    {
      id: "verify_mode",
      header: _(msg`Method`),
      fieldId: "verify_mode",
      label: _(msg`Method`),
      type: "enum",
      metadata: {
        fieldName: "verify_mode",
        isSortable: true,
        labels: {
          fingerprint: _(msg`Fingerprint`),
          face: _(msg`Face`),
          card: _(msg`RF Card`),
          password: _(msg`Password`),
          palm: _(msg`Palm`),
        },
        colors: {
          fingerprint: "green",
          face: "blue",
          card: "amber",
          password: "gray",
          palm: "accent",
        },
      } as EnumFieldMetadata,
      isVisible: true,
      width: "110px",
    },
  ];
}
