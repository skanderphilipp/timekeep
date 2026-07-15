import { useState, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconPencil, IconTrash, IconPower } from "@tabler/icons-react";

import { Section, DataTable, Badge, Button, IconButton, Dialog, FormActions, ActionGroup, type DataTableColumn } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataBoundary } from "@/modules/shared/components";
import { useToast } from "@/infrastructure/toast/toast";
import { useEndpoints } from "../hooks/use-endpoints";
import { EndpointForm } from "./endpoint-form";
import { updateEndpoint, type IntegrationEndpoint } from "@/lib/api";
import { EndpointListLoading, EndpointListError, EndpointListEmpty } from "../states";

function kindVariant(k: string): "success" | "warning" | "neutral" {
  if (k === "webhook") return "success";
  if (k === "odoo") return "warning";
  return "neutral";
}

/**
 * Integration endpoints view — table, create/edit dialog, delete confirm.
 *
 * Uses `DataBoundary` for the data pipeline. Local UI state (form, editing,
 * deleting) stays via `useState` — no cross-component coordination needed.
 */
export function EndpointsView() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, remove } = useEndpoints();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationEndpoint | undefined>();
  const [deleting, setDeleting] = useState<IntegrationEndpoint | undefined>();

  const closeForm = () => {
    setFormOpen(false);
    setEditing(undefined);
    query.refetch();
  };

  const handleToggle = async (ep: IntegrationEndpoint) => {
    try {
      await updateEndpoint(ep.id, { enabled: !ep.enabled });
      toast.success(_(ep.enabled ? msg`Endpoint disabled.` : msg`Endpoint enabled.`));
      query.refetch();
    } catch {
      toast.error(_(msg`Failed to toggle endpoint.`));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(_(msg`Endpoint deleted.`));
      query.refetch();
    } catch {
      toast.error(_(msg`Failed to delete endpoint.`));
    } finally {
      setDeleting(undefined);
    }
  };

  const openCreateForm = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const columns: DataTableColumn<IntegrationEndpoint, string>[] = useMemo(
    () => [
      {
        id: "kind",
        header: _(msg`Type`),
        accessor: (e) => e.kind,
        cell: (e) => <Badge variant={kindVariant(e.kind)}>{e.kind}</Badge>,
      },
      { id: "name", header: _(msg`Name`), accessor: (e) => e.name, sortable: true },
      {
        id: "enabled",
        header: _(msg`Status`),
        accessor: (e) => (e.enabled ? "active" : "inactive"),
        cell: (e) => (
          <Badge variant={e.enabled ? "success" : "neutral"}>
            {e.enabled ? _(msg`Active`) : _(msg`Inactive`)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: _(msg`Actions`),
        accessor: () => "",
        cell: (e) => (
          <ActionGroup>
            <IconButton size="sm" aria-label={_(msg`Toggle`)} onClick={() => handleToggle(e)}>
              <IconPower size={14} />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={_(msg`Edit`)}
              onClick={() => {
                setEditing(e);
                setFormOpen(true);
              }}
            >
              <IconPencil size={14} />
            </IconButton>
            <IconButton
              size="sm"
              accent="tertiary"
              aria-label={_(msg`Delete`)}
              onClick={() => setDeleting(e)}
            >
              <IconTrash size={14} />
            </IconButton>
          </ActionGroup>
        ),
      },
    ],
    [_],
  );

  return (
    <>
      <PageHeader
        title={_(msg`Integration Endpoints`)}
        description={_(
          msg`Configure where attendance events are delivered — webhooks, Odoo, SAP, Zapier.`,
        )}
        actions={
          !query.isLoading && !query.error ? (
            <Button size="sm" icon={<IconPlus size={16} />} onClick={openCreateForm}>
              {_(msg`Add Endpoint`)}
            </Button>
          ) : undefined
        }
      />

      <Section>
        <DataBoundary<IntegrationEndpoint>
          data={query.data ? query.data : undefined}
          isLoading={query.isLoading}
          error={query.error ?? null}
          onRetry={() => query.refetch()}
          loadingFallback={<EndpointListLoading />}
          errorFallback={<EndpointListError onRetry={() => query.refetch()} />}
          emptyFallback={<EndpointListEmpty onAddEndpoint={openCreateForm} />}
        >
          {(endpoints) => <DataTable columns={columns} data={endpoints} getRowKey={(e) => e.id} />}
        </DataBoundary>
      </Section>

      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          if (!o) closeForm();
        }}
        title={_(editing ? msg`Edit Endpoint` : msg`Create Endpoint`)}
      >
        <EndpointForm endpoint={editing} onSuccess={closeForm} />
      </Dialog>

      <Dialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(undefined);
        }}
        title={_(msg`Delete Endpoint`)}
        description={_(msg`Delete ${deleting?.name ?? ""}? This cannot be undone.`)}
      >
        <FormActions>
          <Button
            variant="secondary"
            onClick={() => setDeleting(undefined)}
            disabled={remove.isPending}
          >
            {_(msg`Cancel`)}
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={remove.isPending}>
            {_(msg`Delete`)}
          </Button>
        </FormActions>
      </Dialog>
    </>
  );
}
