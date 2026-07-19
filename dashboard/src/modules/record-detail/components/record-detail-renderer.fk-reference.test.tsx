import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";

import { RecordDetailRenderer } from "./record-detail-renderer";

// =========================================================================
// Mocks
// =========================================================================

vi.mock("@/lib/api/employees", () => ({
  fetchEmployee: vi.fn().mockResolvedValue(null),
  updateEmployee: vi.fn(),
  createEmployee: vi.fn(),
}));
vi.mock("@/lib/api/users", () => ({
  fetchUser: vi.fn().mockResolvedValue(null),
  updateUser: vi.fn(),
  createUser: vi.fn(),
}));
vi.mock("@/lib/api/punches", () => ({
  fetchPunch: vi.fn().mockResolvedValue(null),
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
vi.mock("@/lib/api/devices", () => ({
  fetchDeviceDetail: vi.fn(),
  updateDevice: vi.fn(),
}));
vi.mock("@/lib/api/departments", () => ({
  fetchDepartment: vi.fn().mockResolvedValue(null),
  updateDepartment: vi.fn(),
  createDepartment: vi.fn(),
  fetchDepartments: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/api/device-groups", () => ({
  fetchDeviceGroup: vi.fn().mockResolvedValue(null),
  updateDeviceGroup: vi.fn(),
  createDeviceGroup: vi.fn(),
  fetchDeviceGroups: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/devices/components/device-detail-auto-content", () => ({
  getDeviceDetailContent: vi.fn(() => ({
    tabChildren: {
      info: createElement("div", { "data-testid": "device-overview-extras" }, "Health Cards"),
      config: createElement("div", { "data-testid": "device-config-tab" }, "Config Content"),
      users: createElement("div", { "data-testid": "device-users-tab" }, "Users Content"),
      activity: createElement("div", { "data-testid": "device-activity-tab" }, "Activity Feed"),
    },
    children: createElement("div", { "data-testid": "device-status-bar" }, "Status Bar"),
  })),
}));

vi.mock("@/infrastructure/side-panel/hooks/use-side-panel-navigation", () => ({
  useSidePanelNavigation: vi.fn(() => ({
    activeEntry: null,
    replaceActiveEntityId: vi.fn(),
  })),
  useOpenDetailPanel: vi.fn(() => vi.fn()),
  useOpenRecordInSidePanel: vi.fn(() => vi.fn()),
}));

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

vi.mock("@/infrastructure/toast/toast", () => ({
  useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })),
}));

// =========================================================================
// Helpers
// =========================================================================

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

const DEVICE_FIXTURE = {
  serial_number: "DEV-001", label: "Test Device",
  host: "10.0.0.1", port: 4370, status: "online",
  group_id: "group-uuid-1", comm_key: 0, push_enabled: true, timezone: null,
  vendor: "zkteco",
  user_count: 10, user_capacity: 100,
  record_count: 500, record_capacity: 10000, record_usage_pct: 5,
  fingerprint_count: 0, fingerprint_capacity: 0,
  face_count: 0, face_capacity: 0,
  adms_active: true, sdk_poll_active: true,
  last_seen_at: Math.floor(Date.now() / 1000),
  last_sync_at: Math.floor(Date.now() / 1000),
};

// =========================================================================
// Tests
// =========================================================================

describe("RecordDetailRenderer FK references", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preloads device_group options when config has a reference field with referenceEntity=device_group", async () => {
    const { fetchDeviceDetail } = await import("@/lib/api/devices");
    vi.mocked(fetchDeviceDetail).mockResolvedValue({ ...DEVICE_FIXTURE } as never);

    const { fetchDeviceGroups } = await import("@/lib/api/device-groups");
    vi.mocked(fetchDeviceGroups).mockResolvedValue([
      { id: "g1", name: "Entrance", department_ids: [], created_at: 1, updated_at: 1 },
      { id: "g2", name: "Warehouse", department_ids: [], created_at: 1, updated_at: 1 },
    ]);

    render(
      <RecordDetailRenderer entity="device" entityId="DEV-001" isInSidePanel={false} />,
      { wrapper: makeWrapper() },
    );

    // Wait for the Overview tab to render
    await waitFor(() => {
      expect(screen.getByText("Group")).toBeTruthy();
    });

    // Verify the field shows the value
    await waitFor(() => {
      expect(screen.getByText("group-uuid-1")).toBeTruthy();
    });

    // The key assertion: fetchDeviceGroups MUST have been called.
    // This proves the option preloader correctly detected referenceEntity="device_group"
    // in the config and enabled the device groups query.
    expect(fetchDeviceGroups).toHaveBeenCalledTimes(1);
    expect(fetchDeviceGroups).toHaveBeenCalledWith();
  });

  it("resolves department_ids to display labels on device group detail", async () => {
    const { fetchDeviceGroup } = await import("@/lib/api/device-groups");
    vi.mocked(fetchDeviceGroup).mockResolvedValue({
      id: "grp-1", name: "Main Group",
      department_ids: ["dept-1", "dept-2"],
      created_at: 1, updated_at: 1,
    } as never);

    const { fetchDepartments } = await import("@/lib/api/departments");
    vi.mocked(fetchDepartments).mockResolvedValue([
      { id: "dept-1", name: "Engineering", created_at: 1, updated_at: 1 },
      { id: "dept-2", name: "HR", created_at: 1, updated_at: 1 },
      { id: "dept-3", name: "Finance", created_at: 1, updated_at: 1 },
    ] as never);

    render(
      <RecordDetailRenderer entity="device_group" entityId="grp-1" isInSidePanel={false} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("Departments")).toBeTruthy();
    });

    // Labels should resolve UUIDs to human-readable names
    await waitFor(() => {
      expect(screen.getByText("Engineering")).toBeTruthy();
      expect(screen.getByText("HR")).toBeTruthy();
    });

    // Raw UUIDs should NOT be visible
    expect(screen.queryByText("dept-1")).toBeNull();
    expect(screen.queryByText("dept-2")).toBeNull();
  });

  it("renders editable wrappers for fields with editable:true", async () => {
    const { fetchDeviceDetail } = await import("@/lib/api/devices");
    vi.mocked(fetchDeviceDetail).mockResolvedValue({ ...DEVICE_FIXTURE } as never);

    const { fetchDeviceGroups } = await import("@/lib/api/device-groups");
    vi.mocked(fetchDeviceGroups).mockResolvedValue([
      { id: "g1", name: "G1", department_ids: [], created_at: 1, updated_at: 1 },
    ]);

    render(
      <RecordDetailRenderer entity="device" entityId="DEV-001" isInSidePanel={false} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("Group")).toBeTruthy();
    });

    // There should be data-editable wrappers for editable fields
    // (host, port, vendor, model, push_enabled, group_id are all editable)
    const editableWrappers = document.querySelectorAll("[data-editable]");
    expect(editableWrappers.length).toBeGreaterThanOrEqual(4);
  });
});
