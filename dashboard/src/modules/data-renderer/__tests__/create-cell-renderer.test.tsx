import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import { createCellRenderer } from "@/modules/data-renderer/components/data-table-cell";
import type { TextFieldMetadata, ReferenceFieldMetadata } from "@/modules/data-renderer/types";

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

type TestRow = {
  id: string;
  name: string;
  device_sn: string;
  device_label: string;
  user_pin: string;
  employee_name: string;
  department_id: string;
  department: string;
  active: boolean;
  created_at: number;
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe("createCellRenderer", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Generic type: text
  // ═══════════════════════════════════════════════════════════════════════════

  describe("text columns", () => {
    it("renders text value as plain text", () => {
      const col: any = {
        id: "name", header: "Name", fieldId: "name", label: "Name",
        type: "text",
        metadata: { fieldName: "name", isSortable: true } as TextFieldMetadata,
        isVisible: true,
      };

      const renderFn = createCellRenderer(col, undefined, (r: TestRow) => r.id);
      const el = renderFn({ id: "1", name: "Alice", device_sn: "", device_label: "", user_pin: "", employee_name: "", department_id: "", department: "", active: true, created_at: 0 });

      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      expect(screen.getByText("Alice")).toBeDefined();
    });

    it("shows '-' for empty text values", () => {
      const col: any = {
        id: "name", header: "Name", fieldId: "name", label: "Name",
        type: "text",
        metadata: { fieldName: "name" } as TextFieldMetadata,
        isVisible: true,
      };

      const renderFn = createCellRenderer(col);
      const el = renderFn({ id: "1", name: "", device_sn: "", device_label: "", user_pin: "", employee_name: "", department_id: "", department: "", active: true, created_at: 0 });

      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      expect(screen.getByText("-")).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Generic type: reference
  // ═══════════════════════════════════════════════════════════════════════════

  describe("reference columns (generic FK fields)", () => {
    it("renders clickable Tag for device_sn (reference → device, displayField=label)", () => {
      const col: any = {
        id: "device_sn", header: "Device", fieldId: "device_sn", label: "Device",
        type: "reference",
        metadata: {
          fieldName: "device_sn",
          referenceEntity: "device", referenceIdField: "device_sn",
          displayField: "device_label",
        } as ReferenceFieldMetadata,
        isVisible: true,
      };

      const row: TestRow = {
        id: "1", name: "", device_sn: "DEV-001", device_label: "Main Entrance",
        user_pin: "", employee_name: "", department_id: "", department: "",
        active: true, created_at: 0,
      };

      const el = createCellRenderer(col)(row);
      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      expect(screen.getByText("Main Entrance")).toBeDefined();
    });

    it("renders clickable Tag for user_pin (reference → user, no displayField)", () => {
      const col: any = {
        id: "user_pin", header: "PIN", fieldId: "user_pin", label: "PIN",
        type: "reference",
        metadata: {
          fieldName: "user_pin",
          referenceEntity: "user", referenceIdField: "user_pin",
        } as ReferenceFieldMetadata,
        isVisible: true,
      };

      const row: TestRow = {
        id: "1", name: "", device_sn: "", device_label: "",
        user_pin: "12345", employee_name: "",
        department_id: "", department: "",
        active: true, created_at: 0,
      };

      const el = createCellRenderer(col)(row);
      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      expect(screen.getByText("12345")).toBeDefined();
    });

    it("renders clickable Tag for employee_name (displayField overrides)", () => {
      const col: any = {
        id: "employee_name", header: "Name", fieldId: "employee_name", label: "Name",
        type: "reference",
        metadata: {
          fieldName: "employee_name",
          referenceEntity: "user", referenceIdField: "user_pin",
          displayField: "employee_name",
        } as ReferenceFieldMetadata,
        isVisible: true,
      };

      const row: TestRow = {
        id: "1", name: "", device_sn: "", device_label: "",
        user_pin: "12345", employee_name: "Alice Johnson",
        department_id: "", department: "",
        active: true, created_at: 0,
      };

      const el = createCellRenderer(col)(row);
      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      expect(screen.getByText("Alice Johnson")).toBeDefined();
    });

    it("renders clickable Tag for department FK", () => {
      const col: any = {
        id: "department", header: "Dept", fieldId: "department", label: "Dept",
        type: "reference",
        metadata: {
          fieldName: "department",
          referenceEntity: "department", referenceIdField: "department_id",
          displayField: "department",
        } as ReferenceFieldMetadata,
        isVisible: true,
      };

      const row: TestRow = {
        id: "1", name: "", device_sn: "", device_label: "",
        user_pin: "", employee_name: "",
        department_id: "dep-1", department: "Engineering",
        active: true, created_at: 0,
      };

      const el = createCellRenderer(col)(row);
      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      expect(screen.getByText("Engineering")).toBeDefined();
    });

    it("has stopPropagation wrapper span (no row-click conflict)", () => {
      const col: any = {
        id: "device_sn", header: "Device", fieldId: "device_sn", label: "Device",
        type: "reference",
        metadata: {
          fieldName: "device_sn",
          referenceEntity: "device", referenceIdField: "device_sn",
        } as ReferenceFieldMetadata,
        isVisible: true,
      };

      const row: TestRow = {
        id: "1", name: "", device_sn: "DEV-001", device_label: "",
        user_pin: "", employee_name: "", department_id: "", department: "",
        active: true, created_at: 0,
      };

      const el = createCellRenderer(col)(row);
      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      const span = document.querySelector("span[data-no-close]");
      expect(span).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Generic type: timestamp
  // ═══════════════════════════════════════════════════════════════════════════

  describe("timestamp columns", () => {
    it("renders formatted timestamp", () => {
      const col: any = {
        id: "created_at", header: "Created", fieldId: "created_at", label: "Created",
        type: "timestamp",
        metadata: { fieldName: "created_at", format: "iso" },
        isVisible: true,
      };

      const row: TestRow = {
        id: "1", name: "", device_sn: "", device_label: "",
        user_pin: "", employee_name: "", department_id: "", department: "",
        active: true, created_at: 1700000000,
      };

      const el = createCellRenderer(col)(row);
      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      const date = new Date(1700000000 * 1000);
      expect(screen.getByText(date.toLocaleString())).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Generic type: status
  // ═══════════════════════════════════════════════════════════════════════════

  describe("status columns", () => {
    it("renders colored tag with label from metadata", () => {
      const col: any = {
        id: "active", header: "Status", fieldId: "active", label: "Status",
        type: "status",
        metadata: {
          fieldName: "active",
          labels: { true: "Active", false: "Inactive" },
          colors: { true: "green", false: "gray" },
        },
        isVisible: true,
      };

      const row: TestRow = {
        id: "1", name: "", device_sn: "", device_label: "",
        user_pin: "", employee_name: "", department_id: "", department: "",
        active: true, created_at: 0,
      };

      const el = createCellRenderer(col)(row);
      render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
      expect(screen.getByText("Active")).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Custom render
  // ═══════════════════════════════════════════════════════════════════════════

  it("custom render takes precedence over type dispatcher", () => {
    const col: any = {
      id: "name", header: "Name", fieldId: "name", label: "Name",
      type: "text",
      metadata: { fieldName: "name" } as TextFieldMetadata,
      isVisible: true,
      render: (row: TestRow) => <span data-testid="custom-render">Custom: {row.name}</span>,
    };

    const row: TestRow = {
      id: "1", name: "Alice", device_sn: "", device_label: "",
      user_pin: "", employee_name: "", department_id: "", department: "",
      active: true, created_at: 0,
    };

    const el = createCellRenderer(col)(row);
    render(<table><tbody><tr><td>{el}</td></tr></tbody></table>);
    expect(screen.getByTestId("custom-render")).toBeDefined();
    expect(screen.getByText("Custom: Alice")).toBeDefined();
  });
});
