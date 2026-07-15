import { type ReactNode, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
	SearchInput,
	FilterDropdown,
	FilterChips,
	EmptyState,
	TableOptionsDropdown,
	Grid,
	type FilterField,
	type ColumnOption,
	type ActiveFilter,
} from "@/components/ui";
import { TopBar, ViewPicker, DataBoundary, type ViewType } from "@/modules/shared/components";
import { DataTableContainer } from "./data-table-container";
import { type CellEditingConfig } from "./create-editable-cell-renderer";
import type { ColumnDefinition } from "../types";
import type { EntityType } from "@/types/entities";

// ── Types ──────────────────────────────────────────────────────────────

export type DataListViewProps<T extends Record<string, unknown>> = {
	/** Entity name for cell click routing (only used in table mode). */
	entity: EntityType;

	// ── Layout ──────────────────────────────────────────────────────────

	/**
	 * Layout mode.
	 * - `"table"` — standard DataTableContainer (default).
	 * - `"grid"`  — renders cards via `renderCard`. Ignores table-specific props.
	 */
	layout?: "table" | "grid";

	/**
	 * Required for `layout="grid"`. Renders one card per row.
	 * Receives the row data; should return a React element (card, tile, etc.).
	 */
	renderCard?: (row: T) => ReactNode;

	// ── Table mode only ─────────────────────────────────────────────────

	/** Column definitions (from schema or hardcoded). Used only in table mode. */
	columns?: ColumnDefinition[];
	/** Stable row key extractor. */
	getRowKey: (row: T) => string;
	/** Sort change handler. Table mode only. */
	onSortChange?: (columnId: string) => void;
	/** Column visibility options. Table mode only. */
	columnOptions?: ColumnOption[];
	/** Column toggle handler. Table mode only. */
	onColumnToggle?: (columnId: string) => void;
	/** Row click handler. Table mode only. */
	onRowClick?: (row: T) => void;

	/**
	 * Inline editing configuration (Phase 4). When provided, columns marked
	 * `editable: true` become click-to-edit cells with Tab navigation.
	 */
	editingConfig?: CellEditingConfig;

	// ── Data ────────────────────────────────────────────────────────────

	data: T[];
	isLoading: boolean;
	error: string | null;
	onRetry: () => void;
	emptyState?: ReactNode;

	// ── Search ─────────────────────────────────────────────────────────

	searchPlaceholder?: string;
	searchValue?: string;
	onSearchChange?: (value: string) => void;
	searchDebounceMs?: number;

	// ── Filters ────────────────────────────────────────────────────────

	filterFields?: FilterField[];
	activeFilters?: ActiveFilter[];
	hasActiveFilters?: boolean;
	onClearFilters?: () => void;

	// ── View picker ────────────────────────────────────────────────────

	viewOptions?: { value: ViewType; label: string; icon: ReactNode }[];
	currentView?: ViewType;
	onViewChange?: (view: ViewType) => void;

	/**
	 * Render a custom view for non-table layouts (timeline, calendar, etc.).
	 * Receives the active view type. Only called when `currentView !== "table"`.
	 */
	renderCustomView?: (view: ViewType) => ReactNode;

	// ── Pagination ─────────────────────────────────────────────────────

	infiniteScroll?: {
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		fetchNextPage: () => void;
	};

	// ── Misc ───────────────────────────────────────────────────────────

	resultCount?: number;
};

// ── Component ──────────────────────────────────────────────────────────

export function DataListView<T extends Record<string, unknown>>({
	entity,
	layout = "table",
	renderCard,
	columns,
	data,
	getRowKey,
	isLoading,
	error,
	onRetry,
	emptyState,
	searchPlaceholder,
	searchValue,
	onSearchChange,
	searchDebounceMs = 300,
	filterFields,
	activeFilters,
	hasActiveFilters = false,
	onClearFilters,
	onSortChange,
	columnOptions,
	onColumnToggle,
	viewOptions,
	currentView = "table",
	onViewChange,
	renderCustomView,
	infiniteScroll,
	resultCount,
	onRowClick,
	editingConfig,
}: DataListViewProps<T>) {
	const { _ } = useLingui();

	const isGrid = layout === "grid";
	const hasViewPicker = viewOptions && viewOptions.length > 1;
	const hasSearch = !!onSearchChange;
	const hasFilterDropdown = filterFields && filterFields.length > 0;
	const hasColumnToggle = !isGrid && columnOptions && columnOptions.length > 0 && onColumnToggle;
	const hasChips = activeFilters && activeFilters.length > 0;

	const rightActions: ReactNode[] = [];

	if (hasFilterDropdown) {
		rightActions.push(<FilterDropdown key="filters" fields={filterFields!} />);
	}
	if (hasColumnToggle) {
		rightActions.push(
			<TableOptionsDropdown
				key="columns"
				columns={columnOptions!.map((o) => ({ id: o.id, label: o.label, visible: o.visible }))}
				onToggle={onColumnToggle!}
			/>,
		);
	}

	const defaultEmpty = (
		<EmptyState
			title={_(msg`No records found`)}
			description={
				hasActiveFilters
					? _(msg`No records match the current filters. Try adjusting or clearing them.`)
					: _(msg`No records yet.`)
			}
		/>
	);

	const memoizedError = useMemo(
		() => (error ? new Error(error) : null),
		[error],
	);

	return (
		<>
			<TopBar
				left={
					hasViewPicker ? (
						<ViewPicker options={viewOptions!} value={currentView} onChange={onViewChange!} />
					) : undefined
				}
				center={
					hasSearch ? (
						<SearchInput
							placeholder={searchPlaceholder ?? _(msg`Search…`)}
							value={searchValue ?? ""}
							onChange={onSearchChange!}
							debounceMs={searchDebounceMs}
						/>
					) : undefined
				}
				right={rightActions.length > 0 ? <>{rightActions}</> : undefined}
				bottom={hasChips ? <FilterChips chips={activeFilters!} /> : undefined}
				resultCount={resultCount}
				hasActiveFilters={hasActiveFilters}
				onClear={onClearFilters}
			/>

			{currentView !== "table" && renderCustomView ? (
				renderCustomView(currentView)
			) : (
				<DataBoundary<T>
					data={isLoading ? undefined : data}
					isLoading={isLoading}
					error={memoizedError}
					onRetry={onRetry}
					emptyFallback={emptyState ?? defaultEmpty}
				>
					{(boundaryData) => {
						if (isGrid) {
							if (!renderCard) return defaultEmpty;
							return (
								<Grid>
									{boundaryData.map((row) => {
										const key = getRowKey(row);
										return <div key={key}>{renderCard(row)}</div>;
									})}
								</Grid>
							);
						}

						return (
							<DataTableContainer
								columns={columns ?? []}
								data={boundaryData}
								getRowKey={getRowKey}
								entityType={entity}
								onSortChange={onSortChange}
								onRowClick={onRowClick}
								infiniteScroll={infiniteScroll}
								editingConfig={editingConfig}
							/>
						);
					}}
				</DataBoundary>
			)}
		</>
	);
}

DataListView.displayName = "DataListView";
