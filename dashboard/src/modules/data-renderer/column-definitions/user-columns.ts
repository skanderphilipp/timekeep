import type { MessageDescriptor } from "@lingui/core";

import type { ColumnDefinition, UserPinFieldMetadata, TextFieldMetadata } from "../types";
import { msg } from "@lingui/core/macro";

type T = (descriptor: MessageDescriptor) => string;

/**
 * User column definitions — for the user list table.
 *
 * Columns:
 * - user_pin (label identifier → clickable Chip)
 * - name (plain text)
 * - role (plain text)
 *
 * TODO(ENTERPRISE): Add enrollment status column when user API returns it.
 * Phase: User management
 * Impact: User table shows limited columns; no enrollment/fingerprint info.
 * Fix: Extend user API to return enrollment data, add status column here.
 */
export function createUserColumns(_: T): ColumnDefinition[] {
  return [
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
      isLabelIdentifier: true,
      width: "120px",
    },
    {
      id: "name",
      header: _(msg`Name`),
      fieldId: "name",
      label: _(msg`Name`),
      type: "text",
      metadata: {
        fieldName: "name",
        isSortable: true,
      } as TextFieldMetadata,
      isVisible: true,
      width: "200px",
    },
    {
      id: "role",
      header: _(msg`Role`),
      fieldId: "role",
      label: _(msg`Role`),
      type: "text",
      metadata: {
        fieldName: "role",
        isSortable: false,
      } as TextFieldMetadata,
      isVisible: true,
      width: "120px",
    },
  ];
}
