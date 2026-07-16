import type { MessageDescriptor } from "@lingui/core";

import type {
  ColumnDefinition,
  TextFieldMetadata,
  ReferenceFieldMetadata,
  StatusFieldMetadata,
} from "../types";
import { msg } from "@lingui/core/macro";

type T = (descriptor: MessageDescriptor) => string;

/**
 * Employee column definitions — for the employee directory table.
 *
 * Columns:
 * - pin (plain text, sortable)
 * - name (plain text, sortable)
 * - department (reference → clickable chip → department detail)
 * - status (status badge: active / inactive)
 *
 * Deprecated: pages now use useSchemaColumns("employee").
 * Kept for storybook and test backward compat.
 */
export function createEmployeeColumns(_: T): ColumnDefinition[] {
  return [
    {
      id: "pin",
      header: _(msg`PIN`),
      fieldId: "pin",
      label: _(msg`PIN`),
      type: "text",
      metadata: {
        fieldName: "pin",
        isSortable: true,
      } as TextFieldMetadata,
      isVisible: true,
      width: "100px",
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
    },
    {
      id: "department",
      header: _(msg`Department`),
      fieldId: "department",
      label: _(msg`Department`),
      type: "reference",
      metadata: {
        fieldName: "department",
        isSortable: false,
        referenceEntity: "department",
        referenceIdField: "department_id",
        displayField: "department",
      } as ReferenceFieldMetadata,
      isVisible: true,
      width: "180px",
    },
    {
      id: "status",
      header: _(msg`Status`),
      fieldId: "active",
      label: _(msg`Status`),
      type: "status",
      metadata: {
        fieldName: "active",
        isSortable: false,
        labels: {
          true: _(msg`Active`),
          false: _(msg`Inactive`),
        },
        colors: {
          true: "green",
          false: "gray",
        },
      } as StatusFieldMetadata,
      isVisible: true,
      width: "100px",
    },
  ];
}
