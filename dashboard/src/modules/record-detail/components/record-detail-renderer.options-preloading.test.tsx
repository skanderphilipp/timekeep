import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";

import { RecordDetailRenderer } from "./record-detail-renderer";

/**
 * RED TESTS: Options preloading for reference/FK fields.
 *
 * Currently, `RecordDetailRendererInner` only preloads department options
 * for `employee` and `device_group` entities. This means:
 *   - Department entity cannot have reference fields with preloaded options
 *   - Work policy options are NEVER preloaded for any entity
 *
 * These tests prove the preloading system is broken before we fix it.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api/employees", () => ({
  fetchEmployee: vi.fn().mockResolvedValue(null),
  updateEmployee: vi.fn(),
  createEmployee: vi.fn(),
}));

vi.mock("@/lib/api/departments", () => ({
  fetchDepartment: vi.fn().mockResolvedValue(null),
  updateDepartment: vi.fn(),
  createDepartment: vi.fn(),
  fetchDepartments: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/api/devices", () => ({
  fetchDeviceDetail: vi.fn(),
  updateDevice: vi.fn(),
}));

vi.mock("@/lib/api/users", () => ({
  fetchUser: vi.fn().mockResolvedValue(null),
  updateUser: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("@/lib/api/punches", () => ({
  fetchPunch: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/api/device-groups", () => ({
  fetchDeviceGroup: vi.fn().mockResolvedValue(null),
  updateDeviceGroup: vi.fn(),
  createDeviceGroup: vi.fn(),
}));

vi.mock("@/lib/api/work-policies", () => ({
  fetchWorkPolicyTemplate: vi.fn().mockResolvedValue(null),
  updateWorkPolicyTemplate: vi.fn(),
  createWorkPolicyTemplate: vi.fn(),
  fetchWorkPolicyTemplates: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/api/apikeys", () => ({
  fetchApiKey: vi.fn().mockResolvedValue(null),
  createApiKey: vi.fn(),
}));

vi.mock("@/lib/api/audit", () => ({
  fetchAuditEvent: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/api/integrations", () => ({
  fetchEndpoint: vi.fn().mockResolvedValue(null),
  updateEndpoint: vi.fn(),
  createEndpoint: vi.fn(),
}));

// Employee hooks
vi.mock("@/modules/employees/hooks/use-employee-summary", () => ({
  useEmployeeSummary: vi.fn(() => ({ data: null, isLoading: false })),
}));

vi.mock("@/modules/employees/hooks/use-employee-work-days", () => ({
  useEmployeeWorkDays: vi.fn(() => ({ data: null, isLoading: false })),
}));

// Device
vi.mock("@/modules/devices/components/device-detail-auto-content", () => ({
  getDeviceDetailContent: vi.fn(() => ({
    tabChildren: {},
    children: null,
  })),
}));

// Navigation
vi.mock("@/infrastructure/side-panel/hooks/use-side-panel-navigation", () => ({
  useSidePanelNavigation: vi.fn(() => ({
    activeEntry: null,
    replaceActiveEntityId: vi.fn(),
  })),
  useOpenDetailPanel: vi.fn(() => vi.fn()),
  useOpenRecordInSidePanel: vi.fn(() => vi.fn()),
}));

// Lingui
vi.mock("@lingui/react", () => ({
  useLingui: vi.fn(() => ({
    _: (val: unknown) => {
      if (typeof val === "string") return val;
      if (val && typeof val === "object" && "message" in (val as Record<string, unknown>)) {
        return (val as { message: string }).message;
      }
      return String(val ?? "");
    },
    i18n: {},
  })),
}));

// Toast
vi.mock("@/infrastructure/toast/toast", () => ({
  useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries: ["/"] }, children),
    );
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("RecordDetailRenderer — options preloading (RED)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: Department entity detail should have work_policy options preloaded
  // ═══════════════════════════════════════════════════════════════════════════

  it("MUST preload work_policy options when rendering department detail", async () => {
    const { fetchDepartments } = await import("@/lib/api/departments");
    const { fetchWorkPolicyTemplates } = await import("@/lib/api/work-policies");

    vi.mocked(fetchDepartments).mockResolvedValue([
      { id: "dept-1", name: "Engineering" },
    ] as never);

    vi.mocked(fetchWorkPolicyTemplates).mockResolvedValue([
      { id: "wp-1", title: "Standard 9-5" },
      { id: "wp-2", title: "Flexible Hours" },
    ] as never);

    const { fetchDepartment } = await import("@/lib/api/departments");
    vi.mocked(fetchDepartment).mockResolvedValue({
      id: "dept-1",
      name: "Engineering",
      employee_count: 42,
      created_at: 1700000000,
      work_policy_id: "wp-1",
      work_policy_title: "Standard 9-5",
    } as never);

    render(
      <RecordDetailRenderer entity="department" entityId="dept-1" isInSidePanel={false} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      const elements = screen.getAllByText("Engineering");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    // RED: currently fetchWorkPolicyTemplates is NEVER called because
    // the renderer only preloads for employee and device_group entities.
    // After fix: this should be called to populate the work_policy dropdown.
    //
    // This assertion will FAIL until the renderer is fixed to generalize
    // options preloading for ALL entities, not just employee/device_group.
    expect(
      fetchWorkPolicyTemplates,
      "work_policy options must be preloaded for department entity. " +
        "Currently preloading is hardcoded to employee & device_group only.",
    ).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: Employee detail should still preload department options
  // ═══════════════════════════════════════════════════════════════════════════

  it("MUST still preload department options for employee entity (regression guard)", async () => {
    const { fetchDepartments } = await import("@/lib/api/departments");
    const { fetchEmployee } = await import("@/lib/api/employees");

    vi.mocked(fetchEmployee).mockResolvedValue({
      id: "emp-1",
      name: "Alice",
      pin: "1001",
      department: "Engineering",
      department_id: "dept-1",
    } as never);

    vi.mocked(fetchDepartments).mockResolvedValue([
      { id: "dept-1", name: "Engineering" },
      { id: "dept-2", name: "Sales" },
    ] as never);

    render(
      <RecordDetailRenderer entity="employee" entityId="emp-1" isInSidePanel={false} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      const elements = screen.getAllByText("Alice");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    // This should still work — it was the original behavior
    expect(fetchDepartments).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RED TEST: Options preloading should be driven by the entity config
  // ═══════════════════════════════════════════════════════════════════════════

  it("MUST preload options based on referenceEntity declarations in the config", async () => {
    const { fetchWorkPolicyTemplates } = await import("@/lib/api/work-policies");
    const { fetchDepartment } = await import("@/lib/api/departments");

    vi.mocked(fetchDepartment).mockResolvedValue({
      id: "dept-1",
      name: "Engineering",
      employee_count: 42,
      created_at: 1700000000,
      work_policy_id: "wp-1",
      work_policy_title: "Standard 9-5",
    } as never);

    vi.mocked(fetchWorkPolicyTemplates).mockResolvedValue([
      { id: "wp-1", title: "Standard 9-5" },
    ] as never);

    render(
      <RecordDetailRenderer entity="department" entityId="dept-1" isInSidePanel={false} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      const elements = screen.getAllByText("Engineering");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    // RED: The renderer should detect that the department config has
    // a reference field pointing to "work_policy" and preload those options.
    // Currently it only checks entity === "employee" || entity === "device_group".
    expect(
      fetchWorkPolicyTemplates,
      "Options preloading must be driven by config inspection, not hardcoded entity checks",
    ).toHaveBeenCalled();
  });
});
