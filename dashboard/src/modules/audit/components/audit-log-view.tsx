import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconTable } from "@tabler/icons-react";
import { useMemo } from "react";

import { useAuditLog } from "../hooks/use-audit-log";
import { Section } from "@/components/ui";
import { DataListView } from "@/modules/data-renderer";

/**
 * Audit log view — schema-driven table via {@link DataListView}.
 */
export function AuditLogView() {
	const { _ } = useLingui();
	const page = useAuditLog();

	const viewOptions = useMemo(
		() => [{ value: "table" as const, label: _(msg`Table`), icon: <IconTable size={14} /> }],
		[_],
	);

	return (
		<Section>
			<DataListView
				entity="audit"
				columns={page.columns}
				data={page.data}
				getRowKey={page.getRowKey}
				isLoading={page.isLoading}
				error={page.error}
				onRetry={page.onRetry}
				searchPlaceholder={_(msg`Search actors, actions, resources…`)}
				searchValue={page.searchValue}
				onSearchChange={page.onSearchChange}
				hasActiveFilters={page.hasActiveFilters}
				onClearFilters={page.onClearFilters}
				onSortChange={page.onSortChange}
				viewOptions={viewOptions}
				currentView="table"
				onViewChange={() => {}}
				resultCount={page.resultCount}
			/>
		</Section>
	);
}
