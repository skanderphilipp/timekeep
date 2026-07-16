import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useRecordDetail } from "./use-record-detail";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/employees", () => ({
  fetchEmployee: vi.fn(),
  fetchEmployees: vi.fn(),
}));

vi.mock("@/lib/api/departments", () => ({
  fetchDepartment: vi.fn(),
}));

vi.mock("@/lib/api/devices", () => ({
  fetchDeviceDetail: vi.fn(),
}));

vi.mock("@/lib/api/punches", () => ({
  fetchPunch: vi.fn(),
}));

vi.mock("@/lib/api/apikeys", () => ({
  fetchApiKey: vi.fn(),
}));

vi.mock("@/lib/api/audit", () => ({
  fetchAuditEvent: vi.fn(),
}));

vi.mock("@/lib/api/integrations", () => ({
  fetchEndpoint: vi.fn(),
}));

import { fetchEmployee, fetchEmployees } from "@/lib/api/employees";
import { fetchDepartment } from "@/lib/api/departments";
import { fetchDeviceDetail } from "@/lib/api/devices";
import { fetchPunch } from "@/lib/api/punches";
import { fetchApiKey } from "@/lib/api/apikeys";
import { fetchAuditEvent } from "@/lib/api/audit";
import { fetchEndpoint } from "@/lib/api/integrations";

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

describe("useRecordDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches employee by ID", async () => {
    const mockEmployee = { id: "emp-1", name: "Alice", pin: "1001" };
    vi.mocked(fetchEmployee).mockResolvedValue(mockEmployee as never);

    const { result } = renderHook(
      () => useRecordDetail("employee", "emp-1"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockEmployee);
    });

    expect(fetchEmployee).toHaveBeenCalledWith("emp-1");
  });

  it("fetches department by ID", async () => {
    const mockDept = { id: "dept-1", name: "Engineering" };
    vi.mocked(fetchDepartment).mockResolvedValue(mockDept as never);

    const { result } = renderHook(
      () => useRecordDetail("department", "dept-1"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockDept);
    });

    expect(fetchDepartment).toHaveBeenCalledWith("dept-1");
  });

  it("fetches device by serial number", async () => {
    const mockDevice = { serial_number: "ABC123", label: "Front Desk" };
    vi.mocked(fetchDeviceDetail).mockResolvedValue(mockDevice as never);

    const { result } = renderHook(
      () => useRecordDetail("device", "ABC123"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockDevice);
    });

    expect(fetchDeviceDetail).toHaveBeenCalledWith("ABC123");
  });

  it("fetches punch by ID via API", async () => {
    const mockPunch = {
      id: "punch-1",
      user_pin: "1001",
      timestamp: 1700000000,
      status: "check_in",
      verify_mode: "fingerprint",
      device_sn: "ABC123",
    };
    vi.mocked(fetchPunch).mockResolvedValue(mockPunch as never);

    const { result } = renderHook(
      () => useRecordDetail("punch", "punch-1"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockPunch);
    });

    expect(fetchPunch).toHaveBeenCalledWith("punch-1");
  });

  it("fetches api_key by ID", async () => {
    const mockApiKey = { id: "key-1", name: "Production Key", prefix: "ak_prod_abc123" };
    vi.mocked(fetchApiKey).mockResolvedValue(mockApiKey as never);

    const { result } = renderHook(
      () => useRecordDetail("api_key", "key-1"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockApiKey);
    });

    expect(fetchApiKey).toHaveBeenCalledWith("key-1");
  });

  it("fetches audit event by ID", async () => {
    const mockAudit = { id: "audit-1", action: "login", actor: "admin", status: "success" };
    vi.mocked(fetchAuditEvent).mockResolvedValue(mockAudit as never);

    const { result } = renderHook(
      () => useRecordDetail("audit", "audit-1"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockAudit);
    });

    expect(fetchAuditEvent).toHaveBeenCalledWith("audit-1");
  });

  it("fetches endpoint by ID", async () => {
    const mockEndpoint = { id: "ep-1", name: "Odoo Webhook", kind: "webhook" };
    vi.mocked(fetchEndpoint).mockResolvedValue(mockEndpoint as never);

    const { result } = renderHook(
      () => useRecordDetail("endpoint", "ep-1"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockEndpoint);
    });

    expect(fetchEndpoint).toHaveBeenCalledWith("ep-1");
  });

  it("does not fetch when entityId is empty", () => {
    const { result } = renderHook(
      () => useRecordDetail("employee", ""),
      { wrapper: makeWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchEmployee).not.toHaveBeenCalled();
  });

  it("fetches user by PIN via employee lookup", async () => {
    const mockEmployees = [
      { id: "e1", pin: "1001", name: "Alice" },
      { id: "e2", pin: "2002", name: "Bob" },
    ];
    vi.mocked(fetchEmployees).mockResolvedValue(mockEmployees as never);

    const { result } = renderHook(
      () => useRecordDetail("user", "1001"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockEmployees[0]);
    });
  });
});
