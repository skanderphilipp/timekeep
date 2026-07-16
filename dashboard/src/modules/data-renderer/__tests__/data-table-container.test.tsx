import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { screen, fireEvent } from "@testing-library/react";

import { createServer } from "@/testing/msw/server";
import { createRenderWrapper } from "@/testing/render-with-providers";
import { DataTableContainer } from "../components/data-table-container";
import { createPunchColumns } from "../column-definitions/punch-columns";
import type { Punch } from "@/lib/api";
import type { ColumnDefinition } from "../types";

// ── Test setup ──────────────────────────────────────────────────────────────

const server = createServer();
const { render } = createRenderWrapper();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

// ── Helpers ─────────────────────────────────────────────────────────────────

const makePunch = (overrides: Partial<Punch> = {}): Punch => ({
  id: overrides.id ?? "punch-1",
  user_pin: overrides.user_pin ?? "12345",
  timestamp: overrides.timestamp ?? 1700000000,
  status: overrides.status ?? "check_in",
  verify_mode: overrides.verify_mode ?? "fingerprint",
  device_sn: overrides.device_sn ?? "DEV001",
});

// Identity translator for tests
const _ = (descriptor: { id?: string; message?: string }) =>
  descriptor.message ?? descriptor.id ?? "";

const baseProps = {
  columns: createPunchColumns(_),
  data: [] as Punch[],
  getRowKey: (p: Punch) => p.id,
  entityType: "punch" as const,
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DataTableContainer", () => {
  it("renders loading state", () => {
    render(<DataTableContainer {...baseProps} isLoading />);

    const table = screen.getByRole("table");
    expect(table).toBeDefined();
  });

  it("renders empty state when no data and not loading", () => {
    render(
      <DataTableContainer {...baseProps} emptyState={<div data-testid="empty">No records</div>} />,
    );

    expect(screen.getByTestId("empty")).toBeDefined();
  });

  it("renders rows from data", () => {
    const punches = [
      makePunch({ id: "p-1", user_pin: "111", device_sn: "DEV-A" }),
      makePunch({ id: "p-2", user_pin: "222", device_sn: "DEV-B" }),
    ];

    render(<DataTableContainer {...baseProps} data={punches} />);

    expect(screen.getByText("111")).toBeDefined();
    expect(screen.getByText("222")).toBeDefined();
    expect(screen.getAllByText("DEV-A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DEV-B").length).toBeGreaterThan(0);
  });

  it("renders status as colored tags", () => {
    const punches = [makePunch({ id: "p-1", status: "check_in" })];

    render(<DataTableContainer {...baseProps} data={punches} />);

    expect(screen.getByText("Check In")).toBeDefined();
  });

  it("renders column headers", () => {
    const punches = [makePunch()];

    render(<DataTableContainer {...baseProps} data={punches} />);

    expect(screen.getByText("Timestamp")).toBeDefined();
    expect(screen.getByText("PIN")).toBeDefined();
    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Device")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Method")).toBeDefined();
  });

  it("renders timestamp as formatted date", () => {
    const punches = [makePunch({ id: "p-1", timestamp: 1700000000 })];

    render(<DataTableContainer {...baseProps} data={punches} />);

    const date = new Date(1700000000 * 1000);
    const expected = date.toLocaleString();
    expect(screen.getByText(expected)).toBeDefined();
  });

  it("handles row click", () => {
    const onRowClick = vi.fn();
    const punches = [makePunch({ id: "p-1" })];

    render(<DataTableContainer {...baseProps} data={punches} onRowClick={onRowClick} />);

    const rows = screen.getAllByRole("row");
    const dataRow = rows[1];
    if (dataRow) {
      fireEvent.click(dataRow);
    }

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(punches[0]);
  });

  it("shows pagination footer when pagination provided", () => {
    const punches = [makePunch()];

    render(
      <DataTableContainer
        {...baseProps}
        data={punches}
        pagination={{ page: 1, pageSize: 10, total: 25 }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText("25 rows")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Inline editing
  // ═══════════════════════════════════════════════════════════════════════════

  describe("inline editing", () => {
    it("renders editable cells with EditableCell wrapper when editingConfig is provided", () => {
      const onPersist = vi.fn();
      const columns: ColumnDefinition[] = [
        {
          id: "name", header: "Name", fieldId: "name", label: "Name",
          type: "text",
          metadata: { fieldName: "name", isSortable: true },
          isVisible: true,
          editable: true,
        },
      ];

      type EditableRow = { id: string; name: string };

      render(
        <DataTableContainer<EditableRow>
          columns={columns}
          data={[{ id: "r1", name: "Alice" }]}
          getRowKey={(r) => r.id}
          entityType="user"
          editingConfig={{ onPersist, editableColumns: ["name"] }}
        />,
      );

      const cell = document.querySelector('div[aria-label="Edit name"]') as HTMLElement;
      expect(cell).toBeDefined();
      expect(screen.getByText("Alice")).toBeDefined();
    });

    it("enters edit mode on click and renders the field input", () => {
      const onPersist = vi.fn();
      const columns: ColumnDefinition[] = [
        {
          id: "name", header: "Name", fieldId: "name", label: "Name",
          type: "text",
          metadata: { fieldName: "name", isSortable: true },
          isVisible: true,
          editable: true,
        },
      ];

      type EditableRow = { id: string; name: string };

      render(
        <DataTableContainer<EditableRow>
          columns={columns}
          data={[{ id: "r1", name: "Alice" }]}
          getRowKey={(r) => r.id}
          entityType="user"
          editingConfig={{ onPersist, editableColumns: ["name"] }}
        />,
      );

      const cell = document.querySelector('div[aria-label="Edit name"]') as HTMLElement;
      fireEvent.click(cell);

      const input = screen.queryByRole("textbox") as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe("Alice");
    });

    it("does not wrap non-editable columns in EditableCell", () => {
      const columns: ColumnDefinition[] = [
        {
          id: "name", header: "Name", fieldId: "name", label: "Name",
          type: "text",
          metadata: { fieldName: "name", isSortable: true },
          isVisible: true,
        },
      ];

      type EditableRow = { id: string; name: string };

      render(
        <DataTableContainer<EditableRow>
          columns={columns}
          data={[{ id: "r1", name: "Alice" }]}
          getRowKey={(r) => r.id}
          entityType="user"
          editingConfig={{ onPersist: vi.fn(), editableColumns: ["name"] }}
        />,
      );

      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByText("Alice")).toBeDefined();
    });

    it("does not wrap editable columns when editingConfig is absent", () => {
      const columns: ColumnDefinition[] = [
        {
          id: "name", header: "Name", fieldId: "name", label: "Name",
          type: "text",
          metadata: { fieldName: "name", isSortable: true },
          isVisible: true,
          editable: true,
        },
      ];

      type EditableRow = { id: string; name: string };

      render(
        <DataTableContainer<EditableRow>
          columns={columns}
          data={[{ id: "r1", name: "Alice" }]}
          getRowKey={(r) => r.id}
          entityType="user"
        />,
      );

      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByText("Alice")).toBeDefined();
    });
  });
});
