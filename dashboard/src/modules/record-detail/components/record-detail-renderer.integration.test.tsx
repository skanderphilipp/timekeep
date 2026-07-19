import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";

import { RecordDetailRenderer } from "./record-detail-renderer";

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

// Device auto-content (simplified mock to avoid deep sub-component rendering)
vi.mock("@/modules/devices/components/device-detail-auto-content", () => ({
  getDeviceDetailContent: vi.fn(() => ({
    tabChildren: {
      config: createElement("div", { "data-testid": "device-config-tab" }, "Config Content"),
      users: createElement("div", { "data-testid": "device-users-tab" }, "Users Content"),
    },
    children: createElement("div", { "data-testid": "device-extras" }, "Device Extras"),
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

describe("RecordDetailRenderer — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Device detail ───────────────────────────────────────────────────────────

  describe("device detail", () => {
    it("auto-injects device extras and tab content", async () => {
      const { fetchDeviceDetail } = await import("@/lib/api/devices");
      vi.mocked(fetchDeviceDetail).mockResolvedValue({
        serial_number: "DEV-001",
        label: "Test Device",
        host: "10.0.0.1",
        port: 4370,
        status: "online",
      } as never);

      render(
        <RecordDetailRenderer entity="device" entityId="DEV-001" isInSidePanel={false} />,
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(screen.getByTestId("device-extras")).toBeTruthy();
      });
    });
  });

  // ── Department detail ───────────────────────────────────────────────────────

  describe("department detail", () => {
    it("renders department fields from fetched record", async () => {
      const { fetchDepartment } = await import("@/lib/api/departments");
      vi.mocked(fetchDepartment).mockResolvedValue({
        id: "dept-1",
        name: "Engineering",
        employee_count: 42,
        created_at: 1700000000,
      } as never);

      render(
        <RecordDetailRenderer entity="department" entityId="dept-1" isInSidePanel={false} />,
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        // Department name appears in both header and fields
        const elements = screen.getAllByText("Engineering");
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ── Create flow (isNewRecord) ───────────────────────────────────────────────

  describe("create flow", () => {
    it("renders create button when entityId is empty", async () => {
      render(
        <RecordDetailRenderer entity="work_policy" entityId="" isInSidePanel={false} />,
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(screen.getByText("Create")).toBeTruthy();
      });
    });

    it("renders editable fields for new record", async () => {
      render(
        <RecordDetailRenderer entity="work_policy" entityId="" isInSidePanel={false} />,
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(screen.getByText("Title")).toBeTruthy();
        expect(screen.getByText("Work Start")).toBeTruthy();
      });
    });

    it("does NOT fetch data when entityId is empty", async () => {
      const { fetchWorkPolicyTemplate } = await import("@/lib/api/work-policies");

      render(
        <RecordDetailRenderer entity="work_policy" entityId="" isInSidePanel={false} />,
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(screen.getByText("Create")).toBeTruthy();
      });

      expect(fetchWorkPolicyTemplate).not.toHaveBeenCalled();
    });
  });

  // ── Unconfigured entity ─────────────────────────────────────────────────────

  describe("unconfigured entity", () => {
    it("shows helpful message for missing config", async () => {
      render(
        <RecordDetailRenderer entity={"nonexistent" as any} entityId="x" isInSidePanel={false} />,
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Detail view for nonexistent is not yet configured/),
        ).toBeTruthy();
      });
    });
  });

  // ── Side panel vs main panel ────────────────────────────────────────────────

  describe("panel context", () => {
    it("renders in side panel mode without errors", async () => {
      const { fetchDepartment } = await import("@/lib/api/departments");
      vi.mocked(fetchDepartment).mockResolvedValue({
        id: "dept-1",
        name: "Side Panel Dept",
        employee_count: 5,
        created_at: 1700000000,
      } as never);

      render(
        <RecordDetailRenderer entity="department" entityId="dept-1" isInSidePanel={true} />,
        { wrapper: makeWrapper() },
      );

      await waitFor(() => {
        const elements = screen.getAllByText("Side Panel Dept");
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
