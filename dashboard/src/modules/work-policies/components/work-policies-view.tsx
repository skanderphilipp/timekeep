import { useCallback } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { Section, Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView } from "@/modules/data-renderer";
import { useWorkPoliciesPage } from "../hooks/use-work-policies-page";
import { useOpenRecordInSidePanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";

/**
 * Work policy template list view — schema-driven table with title, schedule, thresholds.
 *
 * All state and logic delegated to {@link useWorkPoliciesPage}.
 *
 * Admin actions: Create (side-panel form), Edit (side-panel on row click).
 */
export function WorkPoliciesView() {
  const { _ } = useLingui();
  const page = useWorkPoliciesPage();
  const openRecord = useOpenRecordInSidePanel();

  const handleAdd = useCallback(() => {
    openRecord({
      entityType: "work_policy",
      title: _(msg`Add Work Policy`),
      isNewRecord: true,
    });
  }, [openRecord, _]);

  return (
    <>
      <PageHeader
        title={_(msg`Work Policies`)}
        description={_(msg`Manage reusable work policy templates for departments.`)}
        actions={
          <Button size="sm" icon={<IconPlus size={16} />} onClick={handleAdd}>
            {_(msg`Add Policy`)}
          </Button>
        }
      />

      <Section>
        <DataListView
          entity="work_policy"
          columns={page.columns}
          data={page.data}
          getRowKey={(d) => d.id}
          isLoading={page.isLoading}
          error={page.error}
          onRetry={page.refetch}
          searchPlaceholder={_(msg`Search by title…`)}
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
                title={_(msg`No policies match`)}
                description={_(msg`Try adjusting your search.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No work policies`)}
                description={_(msg`Create your first work policy template to standardize schedules.`)}
                action={
                  <Button icon={<IconPlus size={16} />} onClick={handleAdd}>
                    {_(msg`Add Policy`)}
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
