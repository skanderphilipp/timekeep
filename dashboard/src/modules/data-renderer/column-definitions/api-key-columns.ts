import type { MessageDescriptor } from "@lingui/core";

import type { ColumnDefinition, TextFieldMetadata, TimestampFieldMetadata } from "../types";
import { msg } from "@lingui/core/macro";

type T = (descriptor: MessageDescriptor) => string;

/**
 * API Key column definitions — for the API key management table.
 */
export function createApiKeyColumns(_: T): ColumnDefinition[] {
  return [
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
      isLabelIdentifier: true,
      width: "200px",
    },
    {
      id: "created_at",
      header: _(msg`Created`),
      fieldId: "created_at",
      label: _(msg`Created`),
      type: "timestamp",
      metadata: {
        fieldName: "created_at",
        isSortable: true,
        format: "date-only",
      } as TimestampFieldMetadata,
      isVisible: true,
      width: "140px",
    },
    {
      id: "expires_at",
      header: _(msg`Expires`),
      fieldId: "expires_at",
      label: _(msg`Expires`),
      type: "timestamp",
      metadata: {
        fieldName: "expires_at",
        isSortable: true,
        format: "date-only",
      } as TimestampFieldMetadata,
      isVisible: true,
      width: "140px",
    },
  ];
}
