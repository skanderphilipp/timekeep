import type { MessageDescriptor } from "@lingui/core";

import type { ColumnDefinition, TextFieldMetadata, TimestampFieldMetadata } from "../types";
import { msg } from "@lingui/core/macro";

type T = (descriptor: MessageDescriptor) => string;

/**
 * Audit column definitions — for the audit log table.
 */
export function createAuditColumns(_: T): ColumnDefinition[] {
  return [
    {
      id: "timestamp",
      header: _(msg`Time`),
      fieldId: "timestamp",
      label: _(msg`Time`),
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
      id: "actor",
      header: _(msg`Actor`),
      fieldId: "actor",
      label: _(msg`Actor`),
      type: "text",
      metadata: {
        fieldName: "actor",
        isSortable: true,
      } as TextFieldMetadata,
      isVisible: true,
      width: "150px",
    },
    {
      id: "action",
      header: _(msg`Action`),
      fieldId: "action",
      label: _(msg`Action`),
      type: "text",
      metadata: {
        fieldName: "action",
        isSortable: true,
      } as TextFieldMetadata,
      isVisible: true,
      width: "150px",
    },
    {
      id: "resource",
      header: _(msg`Resource`),
      fieldId: "resource",
      label: _(msg`Resource`),
      type: "text",
      metadata: {
        fieldName: "resource",
        isSortable: false,
      } as TextFieldMetadata,
      isVisible: true,
      width: "200px",
    },
    {
      id: "status",
      header: _(msg`Status`),
      fieldId: "status",
      label: _(msg`Status`),
      type: "text",
      metadata: {
        fieldName: "status",
        isSortable: false,
      } as TextFieldMetadata,
      isVisible: true,
      width: "100px",
    },
  ];
}
