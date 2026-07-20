import { useState, useMemo, useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconTable } from "@tabler/icons-react";

import { Section, Button, Dialog, FormActions, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { useToast } from "@/infrastructure/toast/toast";
import { useEndpoints } from "../hooks/use-endpoints";
import { useEndpointColumns } from "../hooks/use-endpoint-columns";
import { useOpenRecordInSidePanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";
import { updateEndpoint, type IntegrationEndpoint } from "@/lib/api";
import { DataListView } from "@/modules/data-renderer";
import { useRecordInlineEdit } from "@/modules/record-detail";

/**
 * Integration endpoints view — schema-driven table via {@link DataListView}.
 *
 * Column definitions are extracted to {@link useEndpointColumns}.
 * Create opens the side panel. The delete dialog stays
 * as a modal confirmation (it's a destructive action, not a form).
 *
 * TODO(ENTERPRISE): Wire endpoint detail/editing through RecordDetailRenderer.
 * Phase: Side panel detail views completion
 * Impact: Clicking endpoint rows shows no detail; editing uses dialog placeholder.
 * Fix: Add single-entity fetch + inline editing to RecordDetailRenderer for endpoint.
 */
export function EndpointsView() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, remove } = useEndpoints();
  const openRecord = useOpenRecordInSidePanel();

  // ── Inline editing mutation ────────────────────────────────────────

  const editEndpoint = useRecordInlineEdit("endpoint");

  const [deleting, setDeleting] = useState<IntegrationEndpoint | undefined>();
  const [search, setSearch] = useState("");

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

  const handleCreate = useCallback(() => {
    openRecord({
      entityType: "endpoint",
      title: _(msg`Create Endpoint`),
      isNewRecord: true,
    });
  }, [openRecord, _]);

  /**
   * TODO(ENTERPRISE): Open endpoint detail in side panel for editing.
   * Currently wired to no-op — will be replaced with side-panel navigation
   * once endpoint detail views are configured in RecordDetailRenderer.
   */
  const handleEdit = useCallback((_ep: IntegrationEndpoint) => {
    // Will become: openRecord({ entityType: "endpoint", entityId: ep.id, title: ep.name });
  }, []);

  const handleDeleteClick = useCallback((ep: IntegrationEndpoint) => {
    setDeleting(ep);
  }, []);

  const columns = useEndpointColumns(handleToggle, handleEdit, handleDeleteClick);

  // ── Editing config passed to DataListView ──────────────────────────

  const editingConfig = useMemo(
    () => ({
      onPersist: (rowId: string, field: string, value: unknown) => {
        editEndpoint.mutate({ rowId, field, value });
      },
      editableColumns: ["name"],
    }),
    [editEndpoint.mutate],
  );

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
            <Button size="sm" icon={<IconPlus size={16} />} onClick={handleCreate}>
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
          editingConfig={editingConfig}
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
                  <Button icon={<IconPlus size={16} />} onClick={handleCreate}>
                    {_(msg`Add Endpoint`)}
                  </Button>
                }
              />
            )
          }
        />
      </Section>

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
