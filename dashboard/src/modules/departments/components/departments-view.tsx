import { useCallback, useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { Section, Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView, useSchemaColumns } from "@/modules/data-renderer";
import { useDepartments } from "../hooks/use-departments";
import type { Department } from "@/lib/api";
import { DepartmentFormModal } from "./department-form-modal";

/**
 * Department list view — schema-driven table with name, policy, employee count.
 *
 * Admin actions: Create (modal), Edit (modal on row click).
 * Controlled at the route level for role-based access.
 */
export function DepartmentsView() {
  const { _ } = useLingui();
  const query = useDepartments();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const { columns, isLoading: schemaLoading } = useSchemaColumns("department");

  const handleAdd = useCallback(() => {
    setEditingId(undefined);
    setModalOpen(true);
  }, []);

  const handleRowClick = useCallback((d: Department) => {
    setEditingId(d.id);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) setEditingId(undefined);
  }, []);

  const hasDepartments = (query.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={_(msg`Departments`)}
        description={_(msg`Manage organizational units and work policies.`)}
        actions={
          <Button size="sm" icon={<IconPlus size={16} />} onClick={handleAdd}>
            {_(msg`Add Department`)}
          </Button>
        }
      />

      <Section>
        <DataListView
          entity="department"
          columns={columns}
          data={query.data ?? []}
          getRowKey={(d: Department) => d.id}
          isLoading={query.isLoading || schemaLoading}
          error={query.error?.message ?? null}
          onRetry={() => query.refetch()}
          onRowClick={handleRowClick}
          resultCount={query.data?.length}
          emptyState={
            hasDepartments ? (
              <EmptyState
                title={_(msg`No departments match`)}
                description={_(msg`Try adjusting your search.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No departments`)}
                description={_(msg`Create your first department to organize employees.`)}
                action={
                  <Button icon={<IconPlus size={16} />} onClick={handleAdd}>
                    {_(msg`Add Department`)}
                  </Button>
                }
              />
            )
          }
        />

        <DepartmentFormModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          departmentId={editingId}
        />
      </Section>
    </>
  );
}
