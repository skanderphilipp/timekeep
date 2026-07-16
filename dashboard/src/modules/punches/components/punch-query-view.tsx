import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconTable, IconTimeline } from "@tabler/icons-react";

import { usePunchQueryPage } from "../hooks/use-punch-query-page";
import { useMemo, useState, useCallback } from "react";
import { DataListView, useFilterFields, renderFilterDimensions } from "@/modules/data-renderer";
import type { FilterRenderContext } from "@/modules/data-renderer";
import type { ViewType } from "@/modules/shared/components";
import { Section, EmptyState, Banner, type ColumnOption } from "@/components/ui";
import { PUNCH_STATUSES } from "@shared/punch-statuses";
import { PunchTimelineView } from "./punch-timeline-view";

function useStatusOptions() {
	const { _ } = useLingui();
	return useMemo(
		() => [
			{ value: "", label: _(msg`All Statuses`) },
			...PUNCH_STATUSES.map((s) => ({ value: s.value, label: s.label })),
		],
		[_],
	);
}

function useVerifyModeOptions() {
	const { _ } = useLingui();
	return useMemo(
		() => [
			{ value: "", label: _(msg`All Methods`) },
			{ value: "fingerprint", label: _(msg`Fingerprint`) },
			{ value: "face", label: _(msg`Face`) },
			{ value: "card", label: _(msg`RF Card`) },
			{ value: "password", label: _(msg`Password`) },
			{ value: "palm", label: _(msg`Palm`) },
		],
		[_],
	);
}

export function PunchQueryView() {
	const { _ } = useLingui();
	const page = usePunchQueryPage();
	const statusOptions = useStatusOptions();
	const verifyOptions = useVerifyModeOptions();

	const [currentView, setCurrentView] = useState<ViewType>("table");

	const { dimensions: filterDimensions } = useFilterFields("punch");

	const filterContext = useMemo<FilterRenderContext>(() => ({
			values: page.filters as Record<string, string | undefined>,
			handlers: {
				device_sn: page.handleDeviceChange,
				status: page.handleStatusChange,
				verify_mode: page.handleVerifyModeChange,
				user_pin: page.handleSearchChange,
			},
			enumOptions: { status: statusOptions, verify_mode: verifyOptions },
			facetSearch: {
				device_sn: {
					entity: "punch",
					dimension: "device_sn",
					context: {
						since: page.filters.since,
						until: page.filters.until,
						status: page.filters.status,
					},
				},
				user_pin: {
					entity: "punch",
					dimension: "employee",
					context: {
						since: page.filters.since,
						until: page.filters.until,
						status: page.filters.status,
					},
				},
			},
			dateRange: {
				from: page.dateFrom, to: page.dateTo,
				onChange: page.handleDateChange,
				presets: page.presets,
			},
			toggles: {
				anomalies_only: {
					checked: page.anomaliesOnly,
					onChange: page.handleAnomaliesOnlyToggle,
					label: _(msg`Show only anomalous punches`),
				},
			},
		}), [page, statusOptions, verifyOptions, _]);

	const filterFields = useMemo(
		() => renderFilterDimensions(filterDimensions, filterContext),
		[filterDimensions, filterContext],
	);

	const columnOptions: ColumnOption[] = useMemo(
		() => page.columnOptions.map((opt) => ({
			id: opt.value, label: opt.label,
			visible: page.visibleColumnIds.includes(opt.value),
		})),
		[page.columnOptions, page.visibleColumnIds],
	);

	const viewOptions = useMemo(
		() => [
			{ value: "table" as const, label: _(msg`Table`), icon: <IconTable size={14} /> },
			{ value: "timeline" as const, label: _(msg`Timeline`), icon: <IconTimeline size={14} /> },
		],
		[_],
	);

	const handleViewChange = useCallback((view: ViewType) => setCurrentView(view), []);

	const renderCustomView = useCallback(
		(view: ViewType) => {
			if (view === "timeline") {
				return (
					<PunchTimelineView
						date={page.dateFrom}
						filterSince={page.filters.since}
						filterUntil={page.filters.until}
						punches={page.punches}
						isLoading={page.isLoading}
					/>
				);
			}
			return null;
		},
		[page.dateFrom, page.punches, page.isLoading],
	);

	return (
		<Section>
			{page.anomalyCount > 0 && (
				<Banner variant="warning">
					{_(msg`${page.anomalyCount} anomalies detected in current view`)}
				</Banner>
			)}

			<DataListView
				entity="punch"
				columns={page.columns}
				data={page.punches}
				getRowKey={page.getRowKey}
				isLoading={page.isLoading}
				error={page.error}
				onRetry={page.refetch}
				searchPlaceholder={_(msg`Search by employee name or PIN…`)}
				searchValue={page.searchValue}
				onSearchChange={page.handleSearchChange}
				filterFields={filterFields}
				activeFilters={page.activeFilters}
				hasActiveFilters={page.hasActiveFilters}
				onClearFilters={page.handleClearFilters}
				onSortChange={page.handleSortChange}
				onRowClick={page.onRowClick}
				columnOptions={columnOptions}
				onColumnToggle={(id) => {
					const currentIds = page.visibleColumnIds;
					const nextIds = currentIds.includes(id)
						? currentIds.filter((vid) => vid !== id)
						: [...currentIds, id];
					page.handleColumnToggle(nextIds);
				}}
				viewOptions={viewOptions}
				currentView={currentView}
				onViewChange={handleViewChange}
				renderCustomView={renderCustomView}
				infiniteScroll={{
					hasNextPage: page.hasNextPage,
					isFetchingNextPage: page.isFetchingNextPage,
					fetchNextPage: page.fetchNextPage,
				}}
				resultCount={page.punches.length}
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
