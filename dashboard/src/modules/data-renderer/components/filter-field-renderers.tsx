/**
 * Filter Dimension Renderers
 *
 * Maps FilterDimensionMeta[] → FilterField[] using FilterRenderContext.
 * Uses ReferenceFacetSelector for search-as-you-type on reference facets.
 */

import {
	Select,
	DatePicker,
	Switch,
	type FilterField,
} from "@/components/ui";

import { ReferenceFacetSelector } from "./reference-facet-selector";
import type { FilterDimensionMeta, FilterRenderContext } from "../hooks/use-filter-fields";

export function renderFilterDimensions(
	dimensions: FilterDimensionMeta[],
	context: FilterRenderContext,
): FilterField[] {
	const fields: FilterField[] = [];

	for (const dim of dimensions) {
		switch (dim.uiKind) {
			case "date-range": {
				if (!context.dateRange) continue;
				fields.push({
					key: dim.field,
					label: dim.label,
					renderValueSelector: ({ onApply }: { onApply: () => void; onBack: () => void }) => (
						<section style={{ padding: "var(--ao-spacing-3)", minWidth: 280 }}>
							<DatePicker
								mode="range"
								value={context.dateRange!.from}
								endValue={context.dateRange!.to}
								onChange={(from, to) => {
									context.dateRange!.onChange(from, to);
									onApply();
								}}
								placeholder={dim.label}
								presets={context.dateRange!.presets}
							/>
						</section>
					),
				});
				break;
			}

			case "toggle": {
				const toggle = context.toggles?.[dim.field];
				if (!toggle) continue;
				fields.push({
					key: dim.field,
					label: dim.label,
					renderValueSelector: ({ onApply }: { onApply: () => void; onBack: () => void }) => (
						<section style={{ padding: "var(--ao-spacing-3)", minWidth: 240 }}>
							<Switch
								checked={toggle.checked}
								onCheckedChange={(checked) => {
									toggle.onChange(checked);
									onApply();
								}}
								label={toggle.label}
							/>
						</section>
					),
				});
				break;
			}

			case "enum": {
				const options = context.enumOptions[dim.field];
				if (!options || options.length === 0) continue;
				fields.push({
					key: dim.field,
					label: dim.label,
					renderValueSelector: ({ onApply }: { onApply: () => void; onBack: () => void }) => (
						<section style={{ padding: "var(--ao-spacing-2)" }}>
							<Select
								options={options}
								value={context.values[dim.field] ?? ""}
								onChange={(v: string) => {
									context.handlers[dim.field]?.(v);
									onApply();
								}}
								label={dim.label}
								fullWidth
							/>
						</section>
					),
				});
				break;
			}

			case "reference": {
				const searchMeta = context.facetSearch?.[dim.field];
				fields.push({
					key: dim.field,
					label: dim.label,
					renderValueSelector: ({ onApply }: { onApply: () => void; onBack: () => void }) => {
						if (searchMeta) {
							return (
								<ReferenceFacetSelector
									entity={searchMeta.entity}
									dimension={searchMeta.dimension}
									context={searchMeta.context}
									value={context.values[dim.field]}
									onChange={(v) => {
										context.handlers[dim.field]?.(v);
									}}
									onApply={onApply}
								/>
							);
						}
						// Fallback: basic Select for reference facets without search
						const options = context.enumOptions[dim.field];
						if (!options || options.length === 0) return null;
						return (
							<section style={{ padding: "var(--ao-spacing-2)" }}>
								<Select
									options={options}
									value={context.values[dim.field] ?? ""}
									onChange={(v: string) => {
										context.handlers[dim.field]?.(v);
										onApply();
									}}
									label={dim.label}
									fullWidth
								/>
							</section>
						);
					},
				});
				break;
			}
		}
	}

	return fields;
}
