import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { screen, fireEvent } from "@testing-library/react";

import { createServer } from "@/testing/msw/server";
import { createRenderWrapper } from "@/testing/render-with-providers";
import { DataTableContainer } from "../components/data-table-container";
import { createPunchColumns } from "../column-definitions/punch-columns";
import type { Punch } from "@/lib/api";

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

// Identity translator for tests — returns the default English message text
const _ = (descriptor: { id?: string; message?: string }) => descriptor.message ?? descriptor.id ?? "";

const baseProps = {
  columns: createPunchColumns(_),
  data: [] as Punch[],
  getRowKey: (p: Punch) => p.id,
  entityType: "punch" as const,
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe("DataTableContainer", () => {
  it("renders loading state", () => {
    render(
      <DataTableContainer {...baseProps} isLoading />,
    );

    const table = screen.getByRole("table");
    expect(table).toBeDefined();
  });

  it("renders empty state when no data and not loading", () => {
    render(
      <DataTableContainer
        {...baseProps}
        emptyState={<div data-testid="empty">No records</div>}
      />,
    );

    expect(screen.getByTestId("empty")).toBeDefined();
  });

  it("renders rows from data", () => {
    const punches = [
      makePunch({ id: "p-1", user_pin: "111", device_sn: "DEV-A" }),
      makePunch({ id: "p-2", user_pin: "222", device_sn: "DEV-B" }),
    ];

    render(
      <DataTableContainer
        {...baseProps}
        data={punches}
      />,
    );

    // Each punch should render its PIN
    expect(screen.getByText("111")).toBeDefined();
    expect(screen.getByText("222")).toBeDefined();

    // Device SNs should render as chips
    expect(screen.getAllByText("DEV-A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DEV-B").length).toBeGreaterThan(0);
  });

  it("renders status as colored tags", () => {
    const punches = [makePunch({ id: "p-1", status: "check_in" })];

    render(
      <DataTableContainer
        {...baseProps}
        data={punches}
      />,
    );

    expect(screen.getByText("Check In")).toBeDefined();
  });

  it("renders column headers", () => {
    const punches = [makePunch()];

    render(
      <DataTableContainer
        {...baseProps}
        data={punches}
      />,
    );

    expect(screen.getByText("Timestamp")).toBeDefined();
    expect(screen.getByText("Employee")).toBeDefined();
    expect(screen.getByText("Device")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Method")).toBeDefined();
  });

  it("renders timestamp as formatted date", () => {
    const punches = [makePunch({ id: "p-1", timestamp: 1700000000 })];

    render(
      <DataTableContainer
        {...baseProps}
        data={punches}
      />,
    );

    const date = new Date(1700000000 * 1000);
    const expected = date.toLocaleString();
    expect(screen.getByText(expected)).toBeDefined();
  });

  it("handles row click", () => {
    const onRowClick = vi.fn();
    const punches = [makePunch({ id: "p-1" })];

    render(
      <DataTableContainer
        {...baseProps}
        data={punches}
        onRowClick={onRowClick}
      />,
    );

    const rows = screen.getAllByRole("row");
    const dataRow = rows[1];
    if (dataRow) {
      fireEvent.click(dataRow);
    }

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(punches[0]);
  });

  it("renders error state", () => {
    render(
      <DataTableContainer
        {...baseProps}
        error="Connection refused"
      />,
    );

    expect(screen.getByText("Connection refused")).toBeDefined();
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
});
