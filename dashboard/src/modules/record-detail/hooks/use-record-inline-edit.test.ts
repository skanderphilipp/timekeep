import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useRecordInlineEdit } from "./use-record-inline-edit";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/employees", () => ({
  updateEmployee: vi.fn(),
}));

vi.mock("@/lib/api/departments", () => ({
  updateDepartment: vi.fn(),
}));

vi.mock("@/lib/api/devices", () => ({
  updateDevice: vi.fn(),
}));

vi.mock("@/lib/api/users", () => ({
  updateUser: vi.fn(),
}));

vi.mock("@/lib/api/integrations", () => ({
  updateEndpoint: vi.fn(),
}));

import { updateEmployee } from "@/lib/api/employees";
import { updateDepartment } from "@/lib/api/departments";
import { updateDevice } from "@/lib/api/devices";
import { updateUser } from "@/lib/api/users";
import { updateEndpoint } from "@/lib/api/integrations";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useRecordInlineEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls updateEmployee for employee entity", async () => {
    const mockEmployee = { id: "emp-1", name: "Updated Name" };
    vi.mocked(updateEmployee).mockResolvedValue(mockEmployee as never);

    const { result } = renderHook(
      () => useRecordInlineEdit("employee"),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ rowId: "emp-1", field: "name", value: "Updated Name" });

    await waitFor(() => {
      expect(updateEmployee).toHaveBeenCalledWith("emp-1", { name: "Updated Name" });
    });
  });

  it("calls updateDepartment for department entity", async () => {
    const mockDept = { id: "dept-1", name: "Updated Dept" };
    vi.mocked(updateDepartment).mockResolvedValue(mockDept as never);

    const { result } = renderHook(
      () => useRecordInlineEdit("department"),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ rowId: "dept-1", field: "name", value: "Updated Dept" });

    await waitFor(() => {
      expect(updateDepartment).toHaveBeenCalledWith("dept-1", { name: "Updated Dept" });
    });
  });

  it("calls updateDevice for device entity", async () => {
    const mockDevice = { status: "ok" };
    vi.mocked(updateDevice).mockResolvedValue(mockDevice as never);

    const { result } = renderHook(
      () => useRecordInlineEdit("device"),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ rowId: "ABC123", field: "label", value: "Front Desk" });

    await waitFor(() => {
      expect(updateDevice).toHaveBeenCalledWith("ABC123", { label: "Front Desk" });
    });
  });

  it("calls updateUser for user entity", async () => {
    const mockUser = { id: "u1", display_name: "Alice" };
    vi.mocked(updateUser).mockResolvedValue(mockUser as never);

    const { result } = renderHook(
      () => useRecordInlineEdit("user"),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ rowId: "u1", field: "display_name", value: "Alice" });

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith("u1", { display_name: "Alice" });
    });
  });

  it("calls updateEndpoint for endpoint entity", async () => {
    const mockEp = { id: "ep1", name: "My Webhook" };
    vi.mocked(updateEndpoint).mockResolvedValue(mockEp as never);

    const { result } = renderHook(
      () => useRecordInlineEdit("endpoint"),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ rowId: "ep1", field: "name", value: "My Webhook" });

    await waitFor(() => {
      expect(updateEndpoint).toHaveBeenCalledWith("ep1", { name: "My Webhook" });
    });
  });

  it("throws for entity types not in the registry (punch)", async () => {
    const { result } = renderHook(
      () => useRecordInlineEdit("punch"),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ rowId: "p1", field: "status", value: "check_in" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain(
        "Inline edit not supported",
      );
    });
  });

  it("throws for entity types not in the registry (audit)", async () => {
    const { result } = renderHook(
      () => useRecordInlineEdit("audit"),
      { wrapper: makeWrapper() },
    );

    result.current.mutate({ rowId: "a1", field: "action", value: "login" });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain(
        "Inline edit not supported",
      );
    });
  });
});
