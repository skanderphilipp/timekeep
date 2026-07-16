import { useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { Section, Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView } from "@/modules/data-renderer";
import { useDepartmentsPage } from "../hooks/use-departments-page";
import { useOpenRecordInSidePanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";

/**
 * Department list view — schema-driven table with name, employee count, policy status.
 *
 * All state and logic delegated to {@link useDepartmentsPage}.
 *
 * Admin actions: Create (side-panel form), Edit (side-panel on row click).
 */
export function DepartmentsView() {
  const { _ } = useLingui();
  const page = useDepartmentsPage();
  const openRecord = useOpenRecordInSidePanel();

  const handleAdd = useCallback(() => {
    openRecord({
      entityType: "department",
      title: _(msg`Add Department`),
      isNewRecord: true,
    });
  }, [openRecord, _]);

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
          columns={page.columns}
          data={page.data}
          getRowKey={(d) => d.id}
          isLoading={page.isLoading}
          error={page.error}
          onRetry={page.refetch}
          searchPlaceholder={_(msg`Search by name…`)}
          searchValue={page.searchValue}
          onSearchChange={page.onSearchChange}
          filterFields={page.filterFields}
          hasActiveFilters={page.hasActiveFilters}
          onClearFilters={page.onClearFilters}
          onRowClick={page.onRowClick}
          editingConfig={page.editingConfig}
          resultCount={page.resultCount}
          emptyState={
            page.hasActiveFilters ? (
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
      </Section>
    </>
  );
}
