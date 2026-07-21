/**
 * ReferenceFacetSelector — search-as-you-type dropdown for reference facets.
 *
 * Renders inside FilterDropdown's `renderValueSelector` panel.
 * Replaces static `<Select>` for high-cardinality dimensions
 * (devices, employees, actors, departments).
 *
 * Shows:
 *   - Search input at top
 *   - Top-20 options by default (most common)
 *   - Filtered results as user types (debounced)
 *   - Contextual record counts per option
 */

import { useState, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { SearchInput, Spinner } from "@/components/ui";
import { useFacetSearch } from "@/modules/data-renderer/hooks/use-facet-search";

import type { FacetOptionItem } from "@/modules/data-renderer/hooks/use-facet-search";

// ── Styles (inline — minimal for now) ───────────────────────────────────

const SEARCH_WRAPPER_STYLE: React.CSSProperties = {
	padding: "var(--ao-spacing-2) var(--ao-spacing-2) var(--ao-spacing-1)",
};

const LIST_STYLE: React.CSSProperties = {
	maxHeight: 280,
	overflowY: "auto",
	padding: 0,
	margin: 0,
	listStyle: "none",
};

const ITEM_STYLE: React.CSSProperties = {
	alignItems: "center",
	background: "none",
	border: "none",
	cursor: "pointer",
	display: "flex",
	fontFamily: "inherit",
	fontSize: "var(--ao-font-size-sm)",
	gap: "var(--ao-spacing-2)",
	justifyContent: "space-between",
	padding: "var(--ao-spacing-1_5) var(--ao-spacing-2)",
	textAlign: "left",
	width: "100%",
};

const ITEM_HOVER_STYLE: React.CSSProperties = {
	background: "var(--ao-background-tertiary)",
};

const COUNT_STYLE: React.CSSProperties = {
	color: "var(--ao-font-color-tertiary)",
	fontSize: "var(--ao-font-size-xs)",
	fontVariantNumeric: "tabular-nums",
};

const EMPTY_STYLE: React.CSSProperties = {
	color: "var(--ao-font-color-tertiary)",
	fontSize: "var(--ao-font-size-sm)",
	padding: "var(--ao-spacing-4) var(--ao-spacing-2)",
	textAlign: "center",
};

// ── Types ───────────────────────────────────────────────────────────────

export type ReferenceFacetSelectorProps = {
	/** Entity name for the facet endpoint. */
	entity: string;
	/** Facet dimension key (e.g. "device_sn", "actor"). */
	dimension: string;
	/** Active filter context for contextual counts. */
	context?: Record<string, unknown>;
	/** Currently selected value. */
	value?: string;
	/** Called when a value is selected. */
	onChange: (value: string) => void;
	/** Called to close the popover. */
	onApply: () => void;
	/** Placeholder for the search input. */
	placeholder?: string;
};

// ── Option Item ─────────────────────────────────────────────────────────

function OptionItem({
	option,
	isSelected,
	onClick,
}: {
	option: FacetOptionItem;
	isSelected: boolean;
	onClick: () => void;
}) {
	const [hovered, setHovered] = useState(false);

	return (
		<li>
			<button
				type="button"
				data-slot="option-item"
				style={{
					...ITEM_STYLE,
					...(isSelected || hovered ? ITEM_HOVER_STYLE : {}),
				}}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
				onClick={onClick}
			>
				<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					{option.label}
				</span>
				{option.count !== undefined && option.count !== null && (
					<span style={COUNT_STYLE}>{option.count.toLocaleString()}</span>
				)}
			</button>
		</li>
	);
}


// ── Component ───────────────────────────────────────────────────────────

/**
 * Search-as-you-type dropdown for reference facet dimensions.
 *
 * Renders inside FilterDropdown's value selector:
 * ```tsx
 * renderValueSelector: ({ onApply }) => (
 *   <ReferenceFacetSelector
 *     entity="punch"
 *     dimension="device_sn"
 *     context={{ since, until }}
 *     value={filters.device_sn}
 *     onChange={(v) => { handlers.device_sn(v); }}
 *     onApply={onApply}
 *   />
 * )
 * ```
 */
export function ReferenceFacetSelector({
	entity,
	dimension,
	context = {},
	value,
	onChange,
	onApply,
	placeholder,
}: ReferenceFacetSelectorProps) {
	const { _ } = useLingui();
	const { search, setSearch, options, isLoading } = useFacetSearch({
		entity,
		dimension,
		context,
	});

	const allOption = useMemo<FacetOptionItem>(
		() => ({ value: "", label: _(msg`All`) }),
		[_],
	);

	const displayOptions = useMemo(() => {
		if (search.length > 0 && !isLoading && options.length === 0) return [];
		return [allOption, ...options];
	}, [allOption, options, search, isLoading]);

	return (
		<section data-slot="reference-facet-selector" style={{ minWidth: 260 }}>
			<div style={SEARCH_WRAPPER_STYLE}>
				<SearchInput
					placeholder={placeholder ?? _(msg`Search…`)}
					value={search}
					onChange={setSearch}
					debounceMs={0}
				/>
			</div>

			{isLoading && displayOptions.length <= 1 && (
				<div style={{ display: "flex", justifyContent: "center", padding: "var(--ao-spacing-4)" }}>
					<Spinner size="sm" />
				</div>
			)}

			{!isLoading && displayOptions.length === 0 && (
				<div style={EMPTY_STYLE}>{_(msg`No results found`)}</div>
			)}

			{displayOptions.length > 0 && (
				<ul style={LIST_STYLE} role="listbox">
					{displayOptions.map((opt) => (
						<OptionItem
							key={opt.value || "__all__"}
							option={opt}
							isSelected={value === opt.value}
							onClick={() => {
								onChange(opt.value);
								onApply();
							}}
						/>
					))}
				</ul>
			)}
		</section>
	);
}

ReferenceFacetSelector.displayName = "ReferenceFacetSelector";
