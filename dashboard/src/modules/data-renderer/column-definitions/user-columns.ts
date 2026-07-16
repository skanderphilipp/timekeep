import type { MessageDescriptor } from "@lingui/core";

import type { ColumnDefinition, ReferenceFieldMetadata, TextFieldMetadata } from "../types";
import { msg } from "@lingui/core/macro";

type T = (descriptor: MessageDescriptor) => string;

/**
 * User column definitions — for the user list table.
 *
 * Columns:
 * - user_pin (reference → clickable chip → user detail)
 * - name (plain text)
 * - role (plain text)
 *
 * Deprecated: pages now use useSchemaColumns("user").
 * Kept for storybook and test backward compat.
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
      type: "reference",
      metadata: {
        fieldName: "user_pin",
        isSortable: true,
        referenceEntity: "user",
        referenceIdField: "user_pin",
      } as ReferenceFieldMetadata,
      isVisible: true,
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
