import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import {
  createEditableCellRenderer,
  type CellEditingConfig,
} from "../components/create-editable-cell-renderer";
import type { ColumnDefinition, ReferenceFieldMetadata } from "../types";

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

afterEach(() => {
  vi.restoreAllMocks();
});

type TestRow = {
  id: string;
  name: string;
  department_id: string;
  department: string;
};

const DEPT_OPTIONS = [
  { value: "dept-1", label: "Engineering" },
  { value: "dept-2", label: "Marketing" },
  { value: "dept-3", label: "Sales" },
];

function deptColumn(editable = true, options = DEPT_OPTIONS): ColumnDefinition {
  return {
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
      options,
    } as ReferenceFieldMetadata,
    isVisible: true,
    editable,
  };
}

function renderCell(col: ColumnDefinition, row: TestRow, config?: CellEditingConfig) {
  const renderCellFn = createEditableCellRenderer<TestRow>(
    col,
    undefined,
    (r) => r.id,
    config,
  );
  const el = renderCellFn(row);
  render(
    <table>
      <tbody>
        <tr>
          <td>{el}</td>
        </tr>
      </tbody>
    </table>,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("createEditableCellRenderer — reference columns", () => {
  it("renders department name in display mode", () => {
    const col = deptColumn(false);
    renderCell(col, { id: "r1", name: "Alice", department_id: "dept-1", department: "Engineering" });
    expect(screen.getByText("Engineering")).toBeDefined();
  });

  it("enters edit mode and shows Combobox for reference with options", () => {
    const onPersist = vi.fn();
    const col = deptColumn(true);
    const config: CellEditingConfig = { onPersist, editableColumns: ["department"] };
    renderCell(col, { id: "r2", name: "Alice", department_id: "dept-1", department: "Engineering" }, config);

    const cell = document.querySelector('div[aria-label="Edit department"]') as HTMLElement;
    fireEvent.click(cell);

    const combobox = document.querySelector('[role="combobox"]');
    expect(combobox).toBeDefined();
  });

  it("calls onPersist with selected department ID when user picks from dropdown", async () => {
    const onPersist = vi.fn();
    const col = deptColumn(true);
    const config: CellEditingConfig = { onPersist, editableColumns: ["department"] };
    renderCell(col, { id: "r3", name: "Alice", department_id: "dept-1", department: "Engineering" }, config);

    const cell = document.querySelector('div[aria-label="Edit department"]') as HTMLElement;
    fireEvent.click(cell);

    const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(combobox);

    await waitFor(() => {
      fireEvent.click(screen.getByText("Marketing"));
    });

    expect(onPersist).toHaveBeenCalledWith("r3", "department", "dept-2");
  });

  it("BUG: has empty dropdown when reference column has NO options", () => {
    const onPersist = vi.fn();
    const col = deptColumn(true, []);
    const config: CellEditingConfig = { onPersist, editableColumns: ["department"] };
    renderCell(col, { id: "r4", name: "Alice", department_id: "dept-1", department: "Engineering" }, config);

    const cell = document.querySelector('div[aria-label="Edit department"]') as HTMLElement;
    fireEvent.click(cell);

    const combobox = document.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(combobox);

    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBe(0);
  });
});
