import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { IconTable, IconTimeline, IconCalendar } from "@tabler/icons-react";

import { DataListView } from "./data-list-view";
import type { ColumnDefinition, TextFieldMetadata } from "../types";

// ── Sample data ──────────────────────────────────────────────────────────

type SampleRow = {
	id: string;
	name: string;
	role: string;
	status: string;
};

const sampleData: SampleRow[] = [
	{ id: "1", name: "Alice Johnson", role: "Admin", status: "Active" },
	{ id: "2", name: "Bob Smith", role: "Operator", status: "Inactive" },
	{ id: "3", name: "Carol White", role: "Viewer", status: "Active" },
	{ id: "4", name: "Dave Brown", role: "Admin", status: "Active" },
	{ id: "5", name: "Eve Davis", role: "Operator", status: "Inactive" },
];

const sampleColumns: ColumnDefinition[] = [
	{
		id: "name",
		header: "Name",
		fieldId: "name",
		label: "Name",
		type: "text",
		metadata: { fieldName: "name", isSortable: true } as TextFieldMetadata,
		isVisible: true,
		width: "200px",
	},
	{
		id: "role",
		header: "Role",
		fieldId: "role",
		label: "Role",
		type: "text",
		metadata: { fieldName: "role", isSortable: true } as TextFieldMetadata,
		isVisible: true,
		width: "120px",
	},
	{
		id: "status",
		header: "Status",
		fieldId: "status",
		label: "Status",
		type: "text",
		metadata: { fieldName: "status", isSortable: false } as TextFieldMetadata,
		isVisible: true,
		width: "100px",
	},
];

// ── Meta ─────────────────────────────────────────────────────────────────

const meta = {
	title: "Data Renderer/DataListView",
	component: DataListView<SampleRow>,
	parameters: {
		layout: "padded",
		docs: {
			description: {
				component:
					"Generic list page shell. Supports table and grid layouts. " +
					"Renders TopBar (search, filters, view picker) + DataBoundary + DataTableContainer.",
			},
		},
	},
	args: {
		entity: "user",
		columns: sampleColumns,
		data: sampleData,
		getRowKey: (row) => row.id,
		isLoading: false,
		error: null,
		onRetry: fn(),
	},
	tags: ["autodocs", "level:composite"],
} satisfies Meta<typeof DataListView<SampleRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── Stories ──────────────────────────────────────────────────────────────

/** Default table layout with data. */
export const Table: Story = {
	args: {
		layout: "table",
		searchValue: "",
		onSearchChange: fn(),
		resultCount: sampleData.length,
	},
};

/** Table layout with search active. */
export const TableWithSearch: Story = {
	args: {
		layout: "table",
		searchPlaceholder: "Search users…",
		searchValue: "Alice",
		onSearchChange: fn(),
		hasActiveFilters: true,
		onClearFilters: fn(),
		resultCount: 1,
	},
};

/** Table layout with view picker for multiple view types. */
export const TableWithViewPicker: Story = {
	args: {
		layout: "table",
		searchValue: "",
		onSearchChange: fn(),
		viewOptions: [
			{ value: "table", label: "Table", icon: <IconTable size={14} /> },
			{ value: "timeline", label: "Timeline", icon: <IconTimeline size={14} /> },
			{ value: "calendar", label: "Calendar", icon: <IconCalendar size={14} /> },
		],
		currentView: "table",
		onViewChange: fn(),
		resultCount: sampleData.length,
	},
};

/** Grid layout with custom card renderer. */
export const Grid: Story = {
	args: {
		layout: "grid",
		renderCard: (row) => (
			<div
				style={{
					background: "var(--ao-surface)",
					border: "1px solid var(--ao-border)",
					borderRadius: "8px",
					padding: "16px",
				}}
			>
				<div style={{ fontWeight: 600 }}>{row.name}</div>
				<div style={{ color: "var(--ao-text-tertiary)", fontSize: "12px" }}>{row.role}</div>
				<div style={{ color: "var(--ao-text-tertiary)", fontSize: "12px" }}>{row.status}</div>
			</div>
		),
		searchValue: "",
		onSearchChange: fn(),
		resultCount: sampleData.length,
	},
};

/** Grid layout with search active. */
export const GridWithSearch: Story = {
	args: {
		layout: "grid",
		renderCard: (row) => (
			<div
				style={{
					background: "var(--ao-surface)",
					border: "1px solid var(--ao-border)",
					borderRadius: "8px",
					padding: "16px",
				}}
			>
				<div style={{ fontWeight: 600 }}>{row.name}</div>
				<div style={{ color: "var(--ao-text-tertiary)", fontSize: "12px" }}>{row.role}</div>
			</div>
		),
		searchValue: "Alice",
		onSearchChange: fn(),
		hasActiveFilters: true,
		onClearFilters: fn(),
		resultCount: 1,
	},
};

/** Loading state. */
export const Loading: Story = {
	args: {
		layout: "table",
		isLoading: true,
		data: [],
		searchValue: "",
		onSearchChange: fn(),
	},
};

/** Error state. */
export const Error: Story = {
	args: {
		layout: "table",
		error: "Failed to load records. Server returned 500.",
		data: [],
		searchValue: "",
		onSearchChange: fn(),
		onRetry: fn(),
	},
};

/** Empty state — no data at all. */
export const Empty: Story = {
	args: {
		layout: "table",
		data: [],
		searchValue: "",
		onSearchChange: fn(),
	},
};

/** Empty state after filtering. */
export const EmptyAfterFilter: Story = {
	args: {
		layout: "table",
		data: [],
		searchValue: "zzz_nonexistent",
		onSearchChange: fn(),
		hasActiveFilters: true,
		onClearFilters: fn(),
	},
};

/** Custom view — renders via renderCustomView when ViewPicker selects a non-table view. */
export const CustomView: Story = {
	args: {
		layout: "table",
		viewOptions: [
			{ value: "table", label: "Table", icon: <IconTable size={14} /> },
			{ value: "timeline", label: "Timeline", icon: <IconTimeline size={14} /> },
		],
		renderCustomView: (view) => {
			if (view === "timeline") {
				return (
					<div style={{ border: "1px dashed var(--ao-border)", borderRadius: 8, padding: 32, textAlign: "center" }}>
						<h3>Timeline View</h3>
						<p style={{ color: "var(--ao-text-tertiary)" }}>Custom timeline content would render here.</p>
					</div>
				);
			}
			return null;
		},
		searchValue: "",
		onSearchChange: fn(),
		resultCount: sampleData.length,
	},
};
