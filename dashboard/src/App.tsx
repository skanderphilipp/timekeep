import { Routes, Route } from "react-router-dom";

import { AppRoute } from "@/lib/navigation";
import { RequireAuth } from "@/modules/auth/components/require-auth";
import { RequireRole } from "@/modules/auth/components/require-role";
import { LoginPage } from "@/modules/auth/pages/login-page";
import { SetupPage } from "@/modules/auth/pages/setup-page";
import { ConnectionPage } from "@/modules/server-connection/pages/connection-page";
import { DashboardPage } from "@/modules/dashboard/pages/dashboard-page";
import { DeviceListPage } from "@/modules/devices/pages/device-list-page";
import { DeviceDetailPage } from "@/modules/devices/pages/device-detail-page";
import { PunchQueryPage } from "@/modules/punches/pages/punch-query-page";
import { ReportsPage } from "@/modules/reports/pages/reports-page";
import { DepartmentsPage } from "@/modules/departments/pages/departments-page";
import { DepartmentDetailPage } from "@/modules/departments/pages/department-detail-page";
import { WorkPoliciesPage } from "@/modules/work-policies/pages/work-policies-page";
import { DeviceGroupsPage } from "@/modules/device-groups/pages/device-groups-page";
import { DeviceGroupDetailPage } from "@/modules/device-groups/pages/device-group-detail-page";
import { SettingsPage } from "@/modules/settings/pages/settings-page";
import { ApiKeysPage } from "@/modules/apikeys/pages/api-keys-page";
import { EndpointsPage } from "@/modules/integrations/pages/endpoints-page";
import { AuditLogPage } from "@/modules/audit/pages/audit-log-page";
import { UsersPage } from "@/modules/users/pages/users-page";
import { EmployeeListPage } from "@/modules/employees/pages/employee-list-page";
import { EmployeeDetailPage } from "@/modules/employees/pages/employee-detail-page";
import { NotFoundPage } from "@/modules/navigation/pages/not-found-page";
import { AppShell } from "./app-shell";

export function App() {
  return (
    <Routes>
      <Route path={AppRoute.connect} element={<ConnectionPage />} />
      <Route path={AppRoute.setup} element={<SetupPage />} />
      <Route path={AppRoute.login} element={<LoginPage />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path={AppRoute.dashboard} element={<DashboardPage />} />
                <Route path={AppRoute.devices.list} element={<DeviceListPage />} />
                {/* Device detail (viewer+) */}
                <Route path="/devices/:sn" element={<DeviceDetailPage />} />
                <Route path={AppRoute.attendance.list} element={<PunchQueryPage />} />
                <Route path={AppRoute.employees.list} element={<EmployeeListPage />} />
                <Route path="/employees/:id" element={<EmployeeDetailPage />} />
                <Route path={AppRoute.reports} element={<ReportsPage />} />
                <Route
                  path={AppRoute.devices.groups}
                  element={
                    <RequireRole minimum="admin">
                      <DeviceGroupsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/devices/groups/:id"
                  element={
                    <RequireRole minimum="admin">
                      <DeviceGroupDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.departments.list}
                  element={<DepartmentsPage />}
                />
                <Route
                  path="/departments/:id"
                  element={
                    <RequireRole minimum="admin">
                      <DepartmentDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.workPolicies.list}
                  element={
                    <RequireRole minimum="admin">
                      <WorkPoliciesPage />
                    </RequireRole>
                  }
                />
                <Route path={AppRoute.settings.system} element={<SettingsPage />} />
                <Route
                  path={AppRoute.settings.users}
                  element={
                    <RequireRole minimum="admin">
                      <UsersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.settings.apiKeys}
                  element={
                    <RequireRole minimum="admin">
                      <ApiKeysPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.settings.endpoints}
                  element={
                    <RequireRole minimum="admin">
                      <EndpointsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.settings.audit}
                  element={
                    <RequireRole minimum="admin">
                      <AuditLogPage />
                    </RequireRole>
                  }
                />
                {/* Legacy redirects */}
                <Route
                  path={AppRoute.legacy.users}
                  element={
                    <RequireRole minimum="admin">
                      <UsersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.legacy.endpoints}
                  element={
                    <RequireRole minimum="admin">
                      <EndpointsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.legacy.apiKeys}
                  element={
                    <RequireRole minimum="admin">
                      <ApiKeysPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.legacy.apiKeysAlt}
                  element={
                    <RequireRole minimum="admin">
                      <ApiKeysPage />
                    </RequireRole>
                  }
                />
                <Route
                  path={AppRoute.legacy.audit}
                  element={
                    <RequireRole minimum="admin">
                      <AuditLogPage />
                    </RequireRole>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
