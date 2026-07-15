import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
	IconDeviceDesktop,
	IconStatusChange,
	IconSearch,
} from "@tabler/icons-react";

import { usePunchQueryPage } from "../hooks/use-punch-query-page";
import { useSchemaFilterFields } from "../hooks/use-schema-filter-fields";
import { useMemo, useCallback } from "react";
import { DataTableContainer } from "@/modules/data-renderer/components/data-table-container";
import {
	Section,
	EmptyState,
	FilterBar,
	FilterDropdown,
	SearchInput,
	Select,
	DatePicker,
	Switch,
	Banner,
	TableOptionsDropdown,
	type FilterField,
	type ColumnOption,
} from "@/components/ui";
import { PUNCH_STATUSES } from "@shared/punch-statuses";
import type { SchemaFilterMeta } from "../hooks/use-schema-filter-fields";

// ── Filter option helpers ───────────────────────────────────────────────

function useStatusOptions() {
	const { _ } = useLingui();
	return useMemo(
		() => [
			{ value: "", label: _(msg`All Statuses`) },
			...PUNCH_STATUSES.map((s) => ({
				value: s.value,
				label: s.label,
			})),
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

// ── Filter field builder ────────────────────────────────────────────────

const FIELD_ICONS: Record<string, React.ReactNode> = {
	device_sn: <IconDeviceDesktop size={14} />,
	status: <IconStatusChange size={14} />,
	verify_mode: <IconSearch size={14} />,
};

/**
 * Build FilterField objects for each filterable column from the schema.
 *
 * The FilterField.renderValueSelector receives `{ onApply, onBack }` from
 * the FilterDropdown component. We call `onApply` when a value is selected
 * to close the popover.
 */
function buildSchemaFilterFields(
	columns: SchemaFilterMeta[],
	_: ReturnType<typeof useLingui>["_"],
	context: {
		filters: Record<string, string | undefined>;
		statusOptions: { value: string; label: string }[];
		verifyOptions: { value: string; label: string }[];
		deviceOptions: { value: string; label: string }[];
		handlers: Record<string, (value: string) => void>;
	},
): FilterField[] {
	const fields: FilterField[] = [];

	for (const col of columns) {
		if (!col.facetKind) continue;

		const icon = FIELD_ICONS[col.field] ?? undefined;

		if (col.facetKind === "enum") {
			const options =
				col.field === "status"
					? context.statusOptions
					: col.field === "verify_mode"
						? context.verifyOptions
						: [];
			if (options.length === 0) continue;

			fields.push({
				key: col.field,
				label: col.label,
				icon,
				renderValueSelector: ({ onApply }: { onApply: () => void; onBack: () => void }) => (
					<section style={{ padding: "var(--ao-spacing-2)" }}>
						<Select
							options={options}
							value={(context.filters[col.field] as string) ?? ""}
							onChange={(v: string) => {
								context.handlers[col.field]?.(v);
								onApply();
							}}
							label={col.label}
							fullWidth
						/>
					</section>
				),
			});
		} else if (col.facetKind === "reference" && col.field === "device_sn") {
			fields.push({
				key: col.field,
				label: col.label,
				icon,
				renderValueSelector: ({ onApply }: { onApply: () => void; onBack: () => void }) => (
					<section style={{ padding: "var(--ao-spacing-2)" }}>
						<Select
							options={context.deviceOptions}
							value={(context.filters["device_sn"] as string) ?? ""}
							onChange={(v: string) => {
								context.handlers["device_sn"]?.(v);
								onApply();
							}}
							label={col.label}
							fullWidth
						/>
					</section>
				),
			});
		}
	}

	return fields;
}

// ── View Component ──────────────────────────────────────────────────────

/**
 * Punch records table — unified toolbar with search + filter dropdown + columns.
 *
 * Uses FilterBar + FilterDropdown architecture.
 * Filter fields are derived from the backend schema (GET /api/punches/schema).
 * The schema determines which columns are filterable and their facet kind.
 */
export function PunchQueryView() {
	const { _ } = useLingui();
	const page = usePunchQueryPage();
	const statusOptions = useStatusOptions();
	const verifyOptions = useVerifyModeOptions();

	// ── Schema-driven filter metadata ──────────────────────────────────

	const { filterableColumns } = useSchemaFilterFields();

	// ── Column options ──────────────────────────────────────────────────

	const columnOptions: ColumnOption[] = useMemo(
		() =>
			page.columnOptions.map((opt) => ({
				id: opt.value,
				label: opt.label,
				visible: page.visibleColumnIds.includes(opt.value),
			})),
		[page.columnOptions, page.visibleColumnIds],
	);

	const handleColumnToggle = useCallback(
		(columnId: string) => {
			const currentIds = page.visibleColumnIds;
			const nextIds = currentIds.includes(columnId)
				? currentIds.filter((id) => id !== columnId)
				: [...currentIds, columnId];
			page.handleColumnToggle(nextIds);
		},
		[page.visibleColumnIds, page.handleColumnToggle],
	);

	// ── Filter handlers keyed by field name ─────────────────────────────

	const handlersByField = useMemo<Record<string, (value: string) => void>>(
		() => ({
			device_sn: page.handleDeviceChange,
			status: page.handleStatusChange,
			verify_mode: page.handleVerifyModeChange,
		}),
		[page.handleDeviceChange, page.handleStatusChange, page.handleVerifyModeChange],
	);

	// ── Build FilterField[] for FilterDropdown ──────────────────────────

	const schemaFilterFields = useMemo<FilterField[]>(
		() =>
			buildSchemaFilterFields(filterableColumns, _, {
				filters: page.filters as Record<string, string | undefined>,
				statusOptions,
				verifyOptions,
				deviceOptions: page.facetOptions.deviceOptions.map((o) => ({
					value: o.value,
					label: o.label,
				})),
				handlers: handlersByField,
			}),
		[
			filterableColumns,
			_,
			page.filters,
			statusOptions,
			verifyOptions,
			page.facetOptions.deviceOptions,
			handlersByField,
		],
	);

	return (
		<Section>
			{page.anomalyCount > 0 && (
				<Banner variant="warning">
					{_(msg`${page.anomalyCount} anomalies detected in current view`)}
				</Banner>
			)}

			<FilterBar
				search={
					<SearchInput
						placeholder={_(msg`Search by employee name or PIN…`)}
						value={page.filters.user_pin ?? ""}
						onChange={page.handleSearchChange}
						debounceMs={300}
					/>
				}
				activeFilters={page.activeFilters}
				resultCount={page.punches.length}
				hasActiveFilters={page.hasActiveFilters}
				onClear={page.handleClearFilters}
				actions={<TableOptionsDropdown columns={columnOptions} onToggle={handleColumnToggle} />}
			>
				<DatePicker
					mode="range"
					value={page.dateFrom}
					endValue={page.dateTo}
					onChange={page.handleDateChange}
					placeholder={_(msg`Select date range…`)}
					presets={page.presets}
				/>
				<Switch
					checked={page.anomaliesOnly}
					onCheckedChange={page.handleAnomaliesOnlyToggle}
					label={_(msg`Show only anomalous punches`)}
				/>
				<FilterDropdown fields={schemaFilterFields} />
			</FilterBar>

			<DataTableContainer
				columns={page.columns}
				data={page.punches}
				getRowKey={page.getRowKey}
				entityType="punch"
				isLoading={page.isLoading}
				error={page.error}
				onRetry={page.refetch}
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
								? _(
										msg`No punch records match the current filters. Try adjusting or clearing them.`,
									)
								: _(msg`Attendance data will appear here once devices start recording punches.`)
						}
					/>
				}
			/>
		</Section>
	);
}
