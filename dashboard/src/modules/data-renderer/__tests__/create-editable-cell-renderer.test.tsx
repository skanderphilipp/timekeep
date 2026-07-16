import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";

import { createRenderWrapper } from "@/testing/render-with-providers";
import {
	createEditableCellRenderer,
	type CellEditingConfig,
} from "../components/create-editable-cell-renderer";
import type { ColumnDefinition, TextFieldMetadata } from "../types";

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

type TestRow = {
	id: string;
	name: string;
	email: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function textColumn(
	overrides: Partial<ColumnDefinition<TextFieldMetadata>> = {},
): ColumnDefinition<TextFieldMetadata> {
	return {
		id: "name",
		header: "Name",
		fieldId: "name",
		label: "Name",
		type: "text",
		metadata: { fieldName: "name", isSortable: true },
		isVisible: true,
		...overrides,
	} as ColumnDefinition<TextFieldMetadata>;
}

function editingConfig(
	overrides: Partial<CellEditingConfig> = {},
): CellEditingConfig {
	return {
		onPersist: vi.fn(),
		editableColumns: ["name"],
		...overrides,
	};
}

function renderRow(element: React.ReactNode) {
	// Wrap in table structure matching how DataTable renders cells
	render(
		<table>
			<tbody>
				<tr>
					<td>{element}</td>
				</tr>
			</tbody>
		</table>,
	);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("createEditableCellRenderer", () => {
	// ═══════════════════════════════════════════════════════════════════════════
	// Non-editable columns
	// ═══════════════════════════════════════════════════════════════════════════

	describe("non-editable columns", () => {
		it("renders plain FieldDisplay when column.editable is false", () => {
			const col = textColumn({ editable: false });
			const renderCell = createEditableCellRenderer(col);
			const el = renderCell({ id: "1", name: "Alice", email: "" } as TestRow);

			renderRow(el);

			expect(screen.getByText("Alice")).toBeDefined();
			expect(screen.queryByRole("button")).toBeNull();
		});

		it("renders plain FieldDisplay when column.editable is undefined", () => {
			const col = textColumn();
			delete (col as Record<string, unknown>).editable;
			const renderCell = createEditableCellRenderer(col);
			const el = renderCell({ id: "1", name: "Bob", email: "" } as TestRow);

			renderRow(el);

			expect(screen.getByText("Bob")).toBeDefined();
			expect(screen.queryByRole("button")).toBeNull();
		});

		it("renders dash for empty text values", () => {
			const col = textColumn();
			const renderCell = createEditableCellRenderer(col);
			const el = renderCell({ id: "1", name: "", email: "" } as TestRow);

			renderRow(el);

			expect(screen.getByText("-")).toBeDefined();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// Editable columns with editingConfig
	// ═══════════════════════════════════════════════════════════════════════════

	describe("editable columns with editingConfig", () => {
		it("wraps in EditableCell when column.editable and editingConfig are both set", () => {
			const col = textColumn({ editable: true });
			const config = editingConfig();
			const renderCell = createEditableCellRenderer(
				col,
				undefined,
				(r) => (r as TestRow).id,
				config,
			);
			const el = renderCell({ id: "1", name: "Alice", email: "" } as TestRow);

			renderRow(el);

			// EditableCell display mode renders a div with role="button" and aria-label
			const cell = document.querySelector('div[aria-label="Edit name"]') as HTMLElement;
			expect(cell).toBeDefined();
			expect(screen.getByText("Alice")).toBeDefined();
		});

		it("enters edit mode on click, rendering FieldTextInput", () => {
			const onPersist = vi.fn();
			const col = textColumn({ editable: true });
			const config = editingConfig({ onPersist });
			const renderCell = createEditableCellRenderer(
				col,
				undefined,
				(r) => (r as TestRow).id,
				config,
			);
			const el = renderCell({ id: "1", name: "Alice", email: "" } as TestRow);

			renderRow(el);

			// Click the editable cell
			const cell = document.querySelector('div[aria-label="Edit name"]') as HTMLElement;
			fireEvent.click(cell);

			// After click, a text input should appear
			const input = screen.queryByRole("textbox") as HTMLInputElement;
			expect(input).not.toBeNull();
			expect(input.value).toBe("Alice");
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// Editable columns without editingConfig
	// ═══════════════════════════════════════════════════════════════════════════

	describe("editable columns without editingConfig", () => {
		it("returns plain display when editingConfig is undefined", () => {
			const col = textColumn({ editable: true });
			const renderCell = createEditableCellRenderer(
				col,
				undefined,
				(r) => (r as TestRow).id,
				undefined,
			);
			const el = renderCell({ id: "1", name: "Alice", email: "" } as TestRow);

			renderRow(el);

			expect(screen.getByText("Alice")).toBeDefined();
			expect(screen.queryByRole("button")).toBeNull();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// Custom render priority
	// ═══════════════════════════════════════════════════════════════════════════

	describe("custom render priority", () => {
		it("returns custom render even when column is marked editable", () => {
			const col = textColumn({
				editable: true,
				render: (row: unknown) => (
					<span data-testid="custom-render">
						Custom: {(row as TestRow).name}
					</span>
				),
			});
			const config = editingConfig();
			const renderCell = createEditableCellRenderer(
				col,
				undefined,
				(r) => (r as TestRow).id,
				config,
			);
			const el = renderCell({ id: "1", name: "Alice", email: "" } as TestRow);

			renderRow(el);

			expect(screen.getByTestId("custom-render")).toBeDefined();
			expect(screen.getByText("Custom: Alice")).toBeDefined();
			expect(screen.queryByRole("button")).toBeNull();
		});
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// Reference columns
	// ═══════════════════════════════════════════════════════════════════════════

	describe("reference columns", () => {
		it("renders as clickable chip without EditableCell wrapper", () => {
			const col: ColumnDefinition = {
				id: "department",
				header: "Department",
				fieldId: "department",
				label: "Department",
				type: "reference",
				metadata: {
					fieldName: "department",
					referenceEntity: "department",
					referenceIdField: "department_id",
					displayField: "department",
				},
				isVisible: true,
			};
			const renderCell = createEditableCellRenderer(
				col,
				undefined,
				(r) => (r as TestRow).id,
			);
			const el = renderCell({
				id: "1",
				name: "Alice",
				email: "",
				department_id: "dept-1",
				department: "Engineering",
			} as TestRow & { department_id: string; department: string });

			renderRow(el);

			expect(screen.getByText("Engineering")).toBeDefined();
			expect(
				document.querySelector('div[aria-label="Edit department"]'),
			).toBeNull();
		});
	});
});
