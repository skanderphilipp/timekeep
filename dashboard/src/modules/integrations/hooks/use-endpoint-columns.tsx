import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPencil, IconTrash, IconPower } from "@tabler/icons-react";

import { Badge, IconButton, ActionGroup } from "@/components/ui";
import type { ColumnDefinition, TextFieldMetadata } from "@/modules/data-renderer";
import type { IntegrationEndpoint } from "@/lib/api";

function kindVariant(k: string): "success" | "warning" | "neutral" {
  if (k === "webhook") return "success";
  if (k === "odoo") return "warning";
  return "neutral";
}

/**
 * Column definitions for the integration endpoints table.
 *
 * TODO(ENTERPRISE): Migrate to useSchemaColumns("integration_endpoint") when
 * the backend schema endpoint is available.
 *
 * Phase: Backend API completion
 * Impact: Column definitions are currently hardcoded. Schema-driven columns
 *         would provide sortability, filterability, and column visibility from the backend.
 * Fix: Add GET /api/integration-endpoints/schema, then replace this hook
 *       with useSchemaColumns("integration_endpoint").
 */
export function useEndpointColumns(
  onToggle: (ep: IntegrationEndpoint) => void,
  onEdit: (ep: IntegrationEndpoint) => void,
  onDelete: (ep: IntegrationEndpoint) => void,
): ColumnDefinition[] {
  const { _ } = useLingui();

  return useMemo<ColumnDefinition[]>(
    () => [
      {
        id: "kind",
        header: _(msg`Type`),
        fieldId: "kind",
        label: _(msg`Type`),
        type: "text",
        metadata: { fieldName: "kind", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "100px",
        render: (row: unknown) => {
          const ep = row as IntegrationEndpoint;
          return <Badge variant={kindVariant(ep.kind)}>{ep.kind}</Badge>;
        },
      },
      {
        id: "name",
        header: _(msg`Name`),
        fieldId: "name",
        label: _(msg`Name`),
        type: "text",
        metadata: { fieldName: "name", isSortable: true } as TextFieldMetadata,
        isVisible: true,
        isLabelIdentifier: true,
        width: "200px",
        editable: true,
      },
      {
        id: "enabled",
        header: _(msg`Status`),
        fieldId: "enabled",
        label: _(msg`Status`),
        type: "text",
        metadata: { fieldName: "enabled", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "100px",
        render: (row: unknown) => {
          const ep = row as IntegrationEndpoint;
          return (
            <Badge variant={ep.enabled ? "success" : "neutral"}>
              {ep.enabled ? _(msg`Active`) : _(msg`Inactive`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: _(msg`Actions`),
        fieldId: "actions",
        label: _(msg`Actions`),
        type: "text",
        metadata: { fieldName: "actions", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "120px",
        render: (row: unknown) => {
          const ep = row as IntegrationEndpoint;
          return (
            <ActionGroup>
              <IconButton size="sm" aria-label={_(msg`Toggle`)} onClick={() => onToggle(ep)}>
                <IconPower size={14} />
              </IconButton>
              <IconButton size="sm" aria-label={_(msg`Edit`)} onClick={() => onEdit(ep)}>
                <IconPencil size={14} />
              </IconButton>
              <IconButton
                size="sm"
                accent="tertiary"
                aria-label={_(msg`Delete`)}
                onClick={() => onDelete(ep)}
              >
                <IconTrash size={14} />
              </IconButton>
            </ActionGroup>
          );
        },
      },
    ],
    [_, onToggle, onEdit, onDelete],
  );
}
