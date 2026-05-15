import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconDeviceDesktop, IconStatusChange, IconCalendar, IconAlertTriangle } from "@tabler/icons-react";

import { usePunchQueryPage } from "../hooks/use-punch-query-page";
import { DataTableContainer } from "@/modules/data-renderer/components/data-table-container";
import {
  Section,
  EmptyState,
  FilterDropdown,
  FilterInput,
  FilterSelect,
  DatePicker,
  Toggle,
} from "@/components/ui";
import type { FilterField } from "@/components/ui/filter-dropdown";
import { Banner } from "@/components/ui/banner";
import { MultiSelect } from "@/components/ui/multi-select";
import { PUNCH_STATUSES } from "@shared/punch-statuses";

/** Punch status options for the FilterSelect dropdown. */
function useStatusOptions() {
  const { _ } = useLingui();
  return [
    { value: "", label: _(msg`All Statuses`) },
    ...PUNCH_STATUSES.map((s) => ({
      value: s.value,
      label: s.label,
    })),
  ];
}

/**
 * Punch records table with Twenty-style filter dropdown and facet-powered options.
 *
 * Layout:
 *   [🔍 Search by employee name or PIN…]
 *   [+ Filter] [✕ Reset]                       N results  [Columns ▾]
 *   [Device: Main Gate ✕] [Status: Check In ✕]
 *
 * Device options are loaded from `GET /api/punches/filters` with
 * contextual counts that respect active date/status filters.
 */
export function PunchQueryView() {
  const { _ } = useLingui();
  const page = usePunchQueryPage();
  const statusOptions = useStatusOptions();

  /** Filter fields available in the dropdown (Twenty-style 2-step flow). */
  const filterFields: FilterField[] = [
    {
      key: "device",
      label: _(msg`Device`),
      icon: <IconDeviceDesktop size={14} />,
      renderValueSelector: () => (
        <FilterSelect
          options={page.facetOptions.deviceOptions}
          value={page.filters.device_sn ?? ""}
          onChange={(v) => {
            page.handleDeviceChange(v);
          }}
          label={_(msg`Device`)}
        />
      ),
    },
    {
      key: "status",
      label: _(msg`Status`),
      icon: <IconStatusChange size={14} />,
      renderValueSelector: () => (
        <FilterSelect
          options={statusOptions}
          value={page.filters.status ?? ""}
          onChange={(v) => {
            page.handleStatusChange(v);
          }}
          label={_(msg`Status`)}
        />
      ),
    },
    {
      key: "date",
      label: _(msg`Date range`),
      icon: <IconCalendar size={14} />,
      renderValueSelector: () => (
        <DatePicker
          mode="range"
          value={page.dateFrom}
          endValue={page.dateTo}
          onChange={page.handleDateChange}
          placeholder={_(msg`Select date range…`)}
          presets={page.presets}
        />
      ),
    },
    {
      key: "anomalies",
      label: _(msg`Anomalies only`),
      icon: <IconAlertTriangle size={14} />,
      renderValueSelector: () => (
        <Toggle
          checked={page.anomaliesOnly}
          onChange={page.handleAnomaliesOnlyToggle}
          label={_(msg`Show only anomalous punches`)}
        />
      ),
    },
  ];

  return (
    <Section>
      {/* Anomaly banner */}
      {page.anomalyCount > 0 && (
        <Banner variant="warning">
          {_(msg`${page.anomalyCount} anomalies detected in current view`)}
        </Banner>
      )}

      {/* Search input — full width, always visible */}
      <div style={{ marginBottom: "var(--ao-spacing-3)" }}>
        <FilterInput
          style={{ width: "100%" }}
          placeholder={_(msg`Search by employee name or PIN…`)}
          value={page.filters.user_pin ?? ""}
          onChange={page.handleSearchChange}
        />
      </div>

      {/* Filter button + chips + actions (Twenty-style compact toolbar) */}
      <FilterDropdown
        fields={filterFields}
        activeFilters={page.activeFilters}
        resultCount={page.punches.length}
        hasActiveFilters={page.hasActiveFilters}
        onClear={page.handleClearFilters}
        actions={
          <MultiSelect
            options={page.columnOptions}
            values={page.visibleColumnIds}
            onChange={page.handleColumnToggle}
            placeholder={_(msg`Columns`)}
          />
        }
      />

      <DataTableContainer
        columns={page.columns}
        data={page.punches}
        getRowKey={page.getRowKey}
        entityType="punch"
        isLoading={page.isLoading}
        error={page.error}
        onSortChange={page.handleSortChange}
        infiniteScroll={{
          hasNextPage: page.hasNextPage,
          isFetchingNextPage: page.isFetchingNextPage,
          fetchNextPage: page.fetchNextPage,
        }}
        emptyState={
          <EmptyState
            title={_(msg`No punch records found`)}
            description={
              page.hasActiveFilters
                ? _(msg`No punch records match the current filters. Try adjusting or clearing them.`)
                : _(msg`Attendance data will appear here once devices start recording punches.`)
            }
          />
        }
      />
    </Section>
  );
}
