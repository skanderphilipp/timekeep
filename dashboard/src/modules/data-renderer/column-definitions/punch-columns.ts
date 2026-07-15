import type { MessageDescriptor } from "@lingui/core";

import type {
  ColumnDefinition,
  DeviceSnFieldMetadata,
  UserPinFieldMetadata,
  EmployeeNameFieldMetadata,
  TimestampFieldMetadata,
  StatusFieldMetadata,
  VerifyMethodFieldMetadata,
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
 * Column titles are frontend-defined (Lingui i18n). The Rust backend returns
 * raw field values without column metadata. This means the frontend owns both
 * the presentation (labels) and the interpretation (which field is which).
 *
 * TODO(ENTERPRISE): Consider a dynamic schema approach where the backend
 * returns column metadata (field_id, i18n_key, sortable, type) and the
 * frontend resolves labels via Lingui. This would eliminate the current
 * title/content drift risk.
 * Phase: Cross-cutting (Rust + TS)
 * Impact: Column additions require frontend changes today. A dynamic schema
 *         would let the backend define columns independently.
 * Fix: Add a /api/punches/columns endpoint or include column metadata in
 *       the punch list response envelope.
 */
export function createPunchColumns(_: T): ColumnDefinition[] {
  // Build label/color maps from the shared catalog
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
      type: "user_pin",
      metadata: {
        fieldName: "user_pin",
        isSortable: true,
      } as UserPinFieldMetadata,
      isVisible: true,
      width: "120px",
    },
    {
      id: "employee_name",
      header: _(msg`Name`),
      fieldId: "employee_name",
      label: _(msg`Name`),
      type: "employee_name",
      metadata: {
        fieldName: "employee_name",
        isSortable: false,
      } as EmployeeNameFieldMetadata,
      isVisible: true,
      isLabelIdentifier: true,
      width: "160px",
    },
    {
      id: "device_sn",
      header: _(msg`Device`),
      fieldId: "device_sn",
      label: _(msg`Device`),
      type: "device_sn",
      metadata: {
        fieldName: "device_sn",
        isSortable: true,
      } as DeviceSnFieldMetadata,
      isVisible: true,
      isLabelIdentifier: true,
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
        colors: colors as Record<string, "green" | "red" | "amber" | "blue" | "gray">,
      } as StatusFieldMetadata,
      isVisible: true,
      width: "120px",
    },
    {
      id: "verify_mode",
      header: _(msg`Method`),
      fieldId: "verify_mode",
      label: _(msg`Method`),
      type: "verify_method",
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
      } as VerifyMethodFieldMetadata,
      isVisible: true,
      width: "110px",
    },
  ];
}
