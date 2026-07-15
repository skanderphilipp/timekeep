import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { AppRoute } from "@/lib/navigation";
import { Section, Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView } from "@/modules/data-renderer";
import { useEmployeeListPage } from "../hooks/use-employee-list-page";
import { EmployeeCalendarView } from "./employee-calendar-view";

/**
 * EmployeeListView — schema-driven employee directory with facet-powered filters.
 *
 * All state and logic delegated to {@link useEmployeeListPage}.
 * Supports table and calendar views via {@link DataListView} ViewPicker.
 */
export function EmployeeListView() {
  const { _ } = useLingui();
  const page = useEmployeeListPage();

  return (
    <>
      <PageHeader
        title={_(msg`Employees`)}
        description={_(msg`Manage employee records and view attendance.`)}
        actions={
          <Button to={AppRoute.employees.new} size="sm" icon={<IconPlus size={16} />}>
            {_(msg`Add Employee`)}
          </Button>
        }
      />

      <Section>
        <DataListView
          entity="employee"
          columns={page.columns}
          data={page.data}
          getRowKey={(e) => e.id}
          isLoading={page.isLoading}
          error={page.error}
          onRetry={page.refetch}
          searchPlaceholder={_(msg`Search by name, PIN, or department…`)}
          searchValue={page.searchValue}
          onSearchChange={page.onSearchChange}
          filterFields={page.filterFields}
          hasActiveFilters={page.hasActiveFilters}
          onClearFilters={page.onClearFilters}
          onRowClick={page.onRowClick}
          viewOptions={page.viewOptions}
          currentView={page.currentView}
          onViewChange={page.onViewChange}
          renderCustomView={(view) =>
            view === "calendar" ? (
              <EmployeeCalendarView
                year={page.calendarYear}
                month={page.calendarMonth}
                onDayClick={page.onCalendarDayClick}
              />
            ) : null
          }
          resultCount={page.resultCount}
          emptyState={
            page.hasEmployees ? (
              <EmptyState
                title={_(msg`No employees match`)}
                description={_(msg`Try adjusting or clearing your search and filter.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No employees`)}
                description={_(msg`Add your first employee to get started.`)}
                action={
                  <Button to={AppRoute.employees.new} icon={<IconPlus size={16} />}>
                    {_(msg`Add Employee`)}
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
