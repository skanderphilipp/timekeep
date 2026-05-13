import { useState, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus, IconPencil, IconTrash, IconPower } from "@tabler/icons-react";

import { PageLayout, PageBody, PageHeader, Section, DataTable, Spinner, EmptyState, Badge, Button, IconButton, Dialog, FormActions, ActionGroup } from "@/components/ui";
import { useToast } from "@/infrastructure/toast/toast";
import { useEndpoints } from "../hooks/use-endpoints";
import { EndpointForm } from "../components/endpoint-form";
import { updateEndpoint } from "@/lib/api";
import type { IntegrationEndpoint } from "@/lib/api";
import type { DataTableColumn } from "@/components/ui/data-table";

function kindVariant(k: string): "success" | "warning" | "neutral" {
  if (k === "webhook") return "success";
  if (k === "odoo") return "warning";
  return "neutral";
}

export function EndpointsPage() {
  const { _ } = useLingui();
  const toast = useToast();
  const { query, remove } = useEndpoints();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationEndpoint | undefined>();
  const [deleting, setDeleting] = useState<IntegrationEndpoint | undefined>();

  const closeForm = () => { setFormOpen(false); setEditing(undefined); query.refetch(); };

  const handleToggle = async (ep: IntegrationEndpoint) => {
    try {
      await updateEndpoint(ep.id, { enabled: !ep.enabled });
      toast.success(_(ep.enabled ? msg`Endpoint disabled.` : msg`Endpoint enabled.`));
      query.refetch();
    } catch { toast.error(_(msg`Failed to toggle endpoint.`)); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try { await remove.mutateAsync(deleting.id); toast.success(_(msg`Endpoint deleted.`)); query.refetch(); }
    catch { toast.error(_(msg`Failed to delete endpoint.`)); }
    finally { setDeleting(undefined); }
  };

  const columns: DataTableColumn<IntegrationEndpoint, string>[] = useMemo(() => [
    { id: "kind", header: _(msg`Type`), accessor: (e) => e.kind, cell: (e) => <Badge variant={kindVariant(e.kind)}>{e.kind}</Badge> },
    { id: "name", header: _(msg`Name`), accessor: (e) => e.name, sortable: true },
    { id: "enabled", header: _(msg`Status`), accessor: (e) => e.enabled ? "active" : "inactive", cell: (e) => <Badge variant={e.enabled ? "success" : "neutral"}>{e.enabled ? _(msg`Active`) : _(msg`Inactive`)}</Badge> },
    {
      id: "actions", header: _(msg`Actions`), accessor: () => "",
      cell: (e) => (
        <ActionGroup>
          <IconButton size="sm" aria-label={_(msg`Toggle`)} onClick={() => handleToggle(e)}><IconPower size={14} /></IconButton>
          <IconButton size="sm" aria-label={_(msg`Edit`)} onClick={() => { setEditing(e); setFormOpen(true); }}><IconPencil size={14} /></IconButton>
          <IconButton size="sm" accent="tertiary" aria-label={_(msg`Delete`)} onClick={() => setDeleting(e)}><IconTrash size={14} /></IconButton>
        </ActionGroup>
      ),
    },
  ], [_]);

  if (query.isLoading) return <PageLayout><PageBody><PageHeader title={_(msg`Integration Endpoints`)} /><Section><Spinner /></Section></PageBody></PageLayout>;

  const endpoints = query.data ?? [];

  return (
    <PageLayout>
      <PageBody>
        <PageHeader
          title={_(msg`Integration Endpoints`)}
          description={_(msg`Configure where attendance events are delivered — webhooks, Odoo, SAP, Zapier.`)}
          actions={
            <Button size="sm" icon={<IconPlus size={16} />} onClick={() => { setEditing(undefined); setFormOpen(true); }}>
              {_(msg`Add Endpoint`)}
            </Button>
          }
        />

        <Section>
          {query.error ? <EmptyState title={_(msg`Failed to load endpoints`)} description={_(msg`Is the backend running?`)} /> :
           endpoints.length === 0 ? <EmptyState title={_(msg`No endpoints`)} description={_(msg`Add an endpoint to start sending attendance events.`)} action={<Button icon={<IconPlus size={16} />} onClick={() => { setEditing(undefined); setFormOpen(true); }}>{_(msg`Add Endpoint`)}</Button>} /> :
           <DataTable columns={columns} data={endpoints} getRowKey={(e) => e.id} />}
        </Section>

        <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); }} title={_(editing ? msg`Edit Endpoint` : msg`Create Endpoint`)}>
          <EndpointForm endpoint={editing} onSuccess={closeForm} />
        </Dialog>

        <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(undefined); }} title={_(msg`Delete Endpoint`)} description={_(msg`Delete ${deleting?.name ?? ""}? This cannot be undone.`)}>
          <FormActions>
            <Button variant="secondary" onClick={() => setDeleting(undefined)} disabled={remove.isPending}>{_(msg`Cancel`)}</Button>
            <Button variant="danger" onClick={handleDelete} loading={remove.isPending}>{_(msg`Delete`)}</Button>
          </FormActions>
        </Dialog>
      </PageBody>
    </PageLayout>
  );
}
