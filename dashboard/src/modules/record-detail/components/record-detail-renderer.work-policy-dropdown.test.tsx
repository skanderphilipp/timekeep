import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createElement, type ReactNode } from "react";

import { RecordDetailRenderer } from "./record-detail-renderer";

/** Integration tests for the work_policy dropdown in department detail. */

vi.mock("@/lib/api/employees", () => ({ fetchEmployee: vi.fn().mockResolvedValue(null), updateEmployee: vi.fn(), createEmployee: vi.fn() }));
vi.mock("@/lib/api/departments", () => ({ fetchDepartment: vi.fn().mockResolvedValue(null), updateDepartment: vi.fn(), createDepartment: vi.fn(), fetchDepartments: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/api/devices", () => ({ fetchDeviceDetail: vi.fn(), updateDevice: vi.fn() }));
vi.mock("@/lib/api/users", () => ({ fetchUser: vi.fn().mockResolvedValue(null), updateUser: vi.fn(), createUser: vi.fn() }));
vi.mock("@/lib/api/punches", () => ({ fetchPunch: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api/device-groups", () => ({ fetchDeviceGroup: vi.fn().mockResolvedValue(null), updateDeviceGroup: vi.fn(), createDeviceGroup: vi.fn() }));
vi.mock("@/lib/api/work-policies", () => ({ fetchWorkPolicyTemplate: vi.fn().mockResolvedValue(null), updateWorkPolicyTemplate: vi.fn(), createWorkPolicyTemplate: vi.fn(), fetchWorkPolicyTemplates: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/api/apikeys", () => ({ fetchApiKey: vi.fn().mockResolvedValue(null), createApiKey: vi.fn() }));
vi.mock("@/lib/api/audit", () => ({ fetchAuditEvent: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api/integrations", () => ({ fetchEndpoint: vi.fn().mockResolvedValue(null), updateEndpoint: vi.fn(), createEndpoint: vi.fn() }));
vi.mock("@/modules/employees/hooks/use-employee-summary", () => ({ useEmployeeSummary: vi.fn(() => ({ data: null, isLoading: false })) }));
vi.mock("@/modules/employees/hooks/use-employee-work-days", () => ({ useEmployeeWorkDays: vi.fn(() => ({ data: null, isLoading: false })) }));
vi.mock("@/modules/devices/components/device-detail-auto-content", () => ({ getDeviceDetailContent: vi.fn(() => ({ tabChildren: {}, children: null })) }));
vi.mock("@/infrastructure/side-panel/hooks/use-side-panel-navigation", () => ({ useSidePanelNavigation: vi.fn(() => ({ activeEntry: null, replaceActiveEntityId: vi.fn() })), useOpenDetailPanel: vi.fn(() => vi.fn()), useOpenRecordInSidePanel: vi.fn(() => vi.fn()) }));
vi.mock("@lingui/react", () => ({ useLingui: vi.fn(() => ({ _: (val: unknown) => { if (typeof val === "string") return val; if (val && typeof val === "object" && "message" in (val as Record<string, unknown>)) return (val as { message: string }).message; return String(val ?? ""); }, i18n: {} })) }));
vi.mock("@/infrastructure/toast/toast", () => ({ useToast: vi.fn(() => ({ success: vi.fn(), error: vi.fn() })) }));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, createElement(MemoryRouter, { initialEntries: ["/"] }, children));
  };
}

describe("RecordDetailRenderer — work_policy dropdown", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders work_policy NAME on the policy tab", async () => {
    const { fetchDepartment } = await import("@/lib/api/departments");
    const { fetchWorkPolicyTemplates } = await import("@/lib/api/work-policies");
    vi.mocked(fetchDepartment).mockResolvedValue({ id: "dept-1", name: "Engineering", work_policy_id: "wp-1", work_policy_title: "Standard 9-5" } as never);
    vi.mocked(fetchWorkPolicyTemplates).mockResolvedValue([{ id: "wp-1", title: "Standard 9-5" }, { id: "wp-2", title: "Flexible Hours" }] as never);

    render(<RecordDetailRenderer entity="department" entityId="dept-1" isInSidePanel={false} />, { wrapper: makeWrapper() });

    await waitFor(() => { expect(screen.getAllByText("Engineering").length).toBeGreaterThanOrEqual(1); });
    expect(fetchWorkPolicyTemplates).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Work Policy"));
    await waitFor(() => { expect(screen.getByText("Assigned Policy")).toBeDefined(); });
    expect(screen.getByText("Standard 9-5")).toBeDefined();
    expect(screen.queryByText("wp-1")).toBeNull();
  });

  it("enters edit mode and shows options when policy IS assigned", async () => {
    const { fetchDepartment } = await import("@/lib/api/departments");
    const { fetchWorkPolicyTemplates } = await import("@/lib/api/work-policies");
    vi.mocked(fetchDepartment).mockResolvedValue({ id: "dept-1", name: "Engineering", work_policy_id: "wp-1", work_policy_title: "Standard 9-5" } as never);
    vi.mocked(fetchWorkPolicyTemplates).mockResolvedValue([{ id: "wp-1", title: "Standard 9-5" }, { id: "wp-2", title: "Flexible Hours" }, { id: "wp-3", title: "Night Shift" }] as never);

    render(<RecordDetailRenderer entity="department" entityId="dept-1" isInSidePanel={false} />, { wrapper: makeWrapper() });

    await waitFor(() => { expect(screen.getAllByText("Engineering").length).toBeGreaterThanOrEqual(1); });
    fireEvent.click(screen.getByText("Work Policy"));
    await waitFor(() => { expect(screen.getByText("Assigned Policy")).toBeDefined(); });

    const policyTag = screen.getByText("Standard 9-5");
    const editButton = policyTag.closest("[role=\"button\"]") as HTMLElement;
    expect(editButton).toBeDefined();
    fireEvent.click(editButton);

    await waitFor(() => { expect(document.querySelector("[role='combobox']")).toBeDefined(); }, { timeout: 3000 });
    fireEvent.click(document.querySelector("[role='combobox']") as HTMLElement);

    await waitFor(() => { expect(screen.getByText("Flexible Hours")).toBeDefined(); expect(screen.getByText("Night Shift")).toBeDefined(); }, { timeout: 2000 });
  });

  it("API is called and field renders when NO work_policy is assigned", async () => {
    const { fetchDepartment } = await import("@/lib/api/departments");
    const { fetchWorkPolicyTemplates } = await import("@/lib/api/work-policies");
    vi.mocked(fetchDepartment).mockResolvedValue({ id: "dept-1", name: "Engineering", employee_count: 42, created_at: 1700000000 } as never);
    vi.mocked(fetchWorkPolicyTemplates).mockResolvedValue([{ id: "wp-1", title: "Standard 9-5" }] as never);

    render(<RecordDetailRenderer entity="department" entityId="dept-1" isInSidePanel={false} />, { wrapper: makeWrapper() });

    await waitFor(() => { expect(screen.getAllByText("Engineering").length).toBeGreaterThanOrEqual(1); });
    fireEvent.click(screen.getByText("Work Policy"));
    await waitFor(() => { expect(screen.getByText("Assigned Policy")).toBeDefined(); });
    expect(fetchWorkPolicyTemplates).toHaveBeenCalled();
  });
});
