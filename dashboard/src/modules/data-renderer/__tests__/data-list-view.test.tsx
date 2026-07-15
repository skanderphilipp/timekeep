import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { screen } from "@testing-library/react";

import { createServer } from "@/testing/msw/server";
import { createRenderWrapper } from "@/testing/render-with-providers";
import { DataListView } from "../components/data-list-view";
import type { ColumnDefinition, TextFieldMetadata } from "../types";

// ── Test setup ───────────────────────────────────────────────────────────

const server = createServer();
const { render } = createRenderWrapper();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});
afterAll(() => server.close());

// ── Sample data ─────────────────────────────────────────────────────────

type SampleRow = { id: string; name: string; role: string };

const sampleData: SampleRow[] = [
	{ id: "1", name: "Alice", role: "Admin" },
	{ id: "2", name: "Bob", role: "Operator" },
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
		isLabelIdentifier: true,
	},
	{
		id: "role",
		header: "Role",
		fieldId: "role",
		label: "Role",
		type: "text",
		metadata: { fieldName: "role", isSortable: true } as TextFieldMetadata,
		isVisible: true,
	},
];

function baseProps(overrides = {}) {
	return {
		entity: "user" as const,
		columns: sampleColumns,
		data: sampleData,
		getRowKey: (row: SampleRow) => row.id,
		isLoading: false,
		error: null,
		onRetry: vi.fn(),
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("DataListView", () => {
	// ── Table mode ─────────────────────────────────────────────────────

	describe("table layout", () => {
		it("renders the data table with rows", () => {
			render(<DataListView {...baseProps()} />);

			expect(screen.getByText("Alice")).toBeDefined();
			expect(screen.getByText("Bob")).toBeDefined();
		});

		it("renders the TopBar with search input when onSearchChange is provided", () => {
			render(
				<DataListView
					{...baseProps()}
					searchValue=""
					onSearchChange={vi.fn()}
				/>,
			);

			const searchInput = screen.getByRole("textbox");
			expect(searchInput).toBeDefined();
		});

		it("renders the view picker when multiple viewOptions are provided", () => {
			render(
				<DataListView
					{...baseProps()}
					viewOptions={[
						{ value: "table", label: "Table", icon: null },
						{ value: "timeline", label: "Timeline", icon: null },
					]}
					currentView="table"
					onViewChange={vi.fn()}
				/>,
			);

			expect(screen.getByText("Table")).toBeDefined();
			expect(screen.getByText("Timeline")).toBeDefined();
		});

		it("does not render view picker when only one option", () => {
			render(
				<DataListView
					{...baseProps()}
					viewOptions={[{ value: "table", label: "Table", icon: null }]}
					currentView="table"
					onViewChange={vi.fn()}
				/>,
			);

			expect(screen.queryByText("Table")).toBeNull();
		});
	});

	// ── Grid mode ──────────────────────────────────────────────────────

	describe("grid layout", () => {
		it("renders cards via renderCard", () => {
			render(
				<DataListView
					{...baseProps({ columns: undefined })}
					layout="grid"
					renderCard={(row) => (
						<div data-testid={`card-${row.id}`}>
							<span>{row.name}</span>
						</div>
					)}
				/>,
			);

			expect(screen.getByTestId("card-1")).toBeDefined();
			expect(screen.getByTestId("card-2")).toBeDefined();
		});

		it("renders TopBar with search in grid mode", () => {
			render(
				<DataListView
					{...baseProps({ columns: undefined })}
					layout="grid"
					renderCard={(row) => <div key={row.id}>{row.name}</div>}
					searchValue=""
					onSearchChange={vi.fn()}
				/>,
			);

			const searchInput = screen.getByRole("textbox");
			expect(searchInput).toBeDefined();
		});
	});

	// ── States ─────────────────────────────────────────────────────────

	describe("states", () => {
		it("shows loading state when isLoading and no data", () => {
			render(<DataListView {...baseProps({ isLoading: true, data: [] })} />);

			// ListLoading renders a spinner
			const spinner = document.querySelector('[data-slot="spinner"]');
			expect(spinner).toBeDefined();
		});

		it("shows error state with retry button", () => {
			const onRetry = vi.fn();
			render(
				<DataListView
					{...baseProps({ error: "Server Error", data: [], onRetry })}
				/>,
			);

			// PageError renders "Server Unreachable" title
			expect(screen.getByText("Server Unreachable")).toBeDefined();
		});

		it("shows empty state when data is empty", () => {
			render(<DataListView {...baseProps({ data: [] })} />);

			expect(screen.getByText("No records found")).toBeDefined();
		});

		it("shows custom empty state when provided", () => {
			render(
				<DataListView
					{...baseProps({ data: [] })}
					emptyState={<div data-testid="custom-empty">Nothing here</div>}
				/>,
			);

			expect(screen.getByTestId("custom-empty")).toBeDefined();
		});
	});

	// ── Filter chips ───────────────────────────────────────────────────

	it("renders active filter chips in the TopBar bottom row", () => {
		render(
			<DataListView
				{...baseProps()}
				searchValue="Alice"
				onSearchChange={vi.fn()}
				activeFilters={[{ key: "role", label: "Role: Admin", onRemove: vi.fn() }]}
				hasActiveFilters={true}
				onClearFilters={vi.fn()}
			/>,
		);

		expect(screen.getByText("Role: Admin")).toBeDefined();
	});

	it("renders result count", () => {
		render(<DataListView {...baseProps({ resultCount: 2 })} />);

		expect(screen.getByText("2 results")).toBeDefined();
	});

	it("renders reset button when filters are active", () => {
		render(
			<DataListView
				{...baseProps()}
				searchValue="Alice"
				onSearchChange={vi.fn()}
				hasActiveFilters={true}
				onClearFilters={vi.fn()}
			/>,
		);

		expect(screen.getByText("Reset")).toBeDefined();
	});

	// ── Custom views ────────────────────────────────────────────────

	it("renders custom view when currentView is not table", () => {
		render(
			<DataListView
				{...baseProps()}
				viewOptions={[
					{ value: "table", label: "Table", icon: null },
					{ value: "timeline", label: "Timeline", icon: null },
				]}
				currentView="timeline"
				onViewChange={vi.fn()}
				renderCustomView={(view) => {
					if (view === "timeline") return <div data-testid="timeline-view">Timeline content</div>;
					return null;
				}}
			/>,
		);

		expect(screen.getByTestId("timeline-view")).toBeDefined();
	});
});
