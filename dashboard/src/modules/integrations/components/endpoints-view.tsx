import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconTable } from "@tabler/icons-react";

import { Section, Button, Dialog, FormActions, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { useToast } from "@/infrastructure/toast/toast";
import { useEndpoints } from "../hooks/use-endpoints";
import { useEndpointColumns } from "../hooks/use-endpoint-columns";
import { EndpointForm } from "./endpoint-form";
import { updateEndpoint, type IntegrationEndpoint } from "@/lib/api";
import { DataListView } from "@/modules/data-renderer";

/**
 * Integration endpoints view — schema-driven table via {@link DataListView}.
 *
 * Column definitions are extracted to {@link useEndpointColumns}.
 * Dialogs (create/edit, delete) live outside the DataListView boundary.
 */
export function EndpointsView() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, remove } = useEndpoints();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationEndpoint | undefined>();
  const [deleting, setDeleting] = useState<IntegrationEndpoint | undefined>();
  const [search, setSearch] = useState("");

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(undefined);
    query.refetch();
  }, [query]);

  const handleToggle = useCallback(
    async (ep: IntegrationEndpoint) => {
      try {
        await updateEndpoint(ep.id, { enabled: !ep.enabled });
        toast.success(_(ep.enabled ? msg`Endpoint disabled.` : msg`Endpoint enabled.`));
        query.refetch();
      } catch {
        toast.error(_(msg`Failed to toggle endpoint.`));
      }
    },
    [query, toast, _],
  );

  const handleDelete = useCallback(async () => {
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
  }, [deleting, remove, query, toast, _]);

  const openCreateForm = useCallback(() => {
    setEditing(undefined);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((ep: IntegrationEndpoint) => {
    setEditing(ep);
    setFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback((ep: IntegrationEndpoint) => {
    setDeleting(ep);
  }, []);

  const columns = useEndpointColumns(handleToggle, handleEdit, handleDeleteClick);

  // ── Client-side search ──────────────────────────────────────────
  const endpoints = query.data ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return endpoints;
    return endpoints.filter(
      (ep) =>
        ep.name.toLowerCase().includes(q) ||
        ep.kind.toLowerCase().includes(q),
    );
  }, [endpoints, search]);

  const hasActiveFilters = search.length > 0;
  const handleClearFilters = useCallback(() => setSearch(""), []);

  const viewOptions = useMemo(
    () => [{ value: "table" as const, label: _(msg`Table`), icon: <IconTable size={14} /> }],
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
        <DataListView<IntegrationEndpoint>
          entity="user"
          columns={columns}
          data={filtered}
          getRowKey={(e) => e.id}
          isLoading={query.isLoading}
          error={query.error?.message ?? null}
          onRetry={() => query.refetch()}
          searchPlaceholder={_(msg`Search by name or type…`)}
          searchValue={search}
          onSearchChange={setSearch}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          viewOptions={viewOptions}
          currentView="table"
          onViewChange={() => {}}
          resultCount={filtered.length}
          emptyState={
            endpoints.length > 0 ? (
              <EmptyState
                title={_(msg`No endpoints match`)}
                description={_(msg`Try adjusting or clearing your search.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No endpoints`)}
                description={_(msg`Add your first integration endpoint to get started.`)}
                action={
                  <Button icon={<IconPlus size={16} />} onClick={openCreateForm}>
                    {_(msg`Add Endpoint`)}
                  </Button>
                }
              />
            )
          }
        />
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
