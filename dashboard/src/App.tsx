import { Routes, Route } from "react-router-dom";

import { AppRoute } from "@/lib/navigation";
import { RequireAuth } from "@/modules/auth/components/require-auth";
import { RequireRole } from "@/modules/auth/components/require-role";
import { LoginPage } from "@/modules/auth/pages/login-page";
import { SetupPage } from "@/modules/auth/pages/setup-page";
import { DashboardPage } from "@/modules/dashboard/pages/dashboard-page";
import { DeviceListPage } from "@/modules/devices/pages/device-list-page";
import { DeviceFormPage } from "@/modules/devices/pages/device-form-page";
import { PunchQueryPage } from "@/modules/punches/pages/punch-query-page";
import { ReportsPage } from "@/modules/reports/pages/reports-page";
import { SettingsPage } from "@/modules/settings/pages/settings-page";
import { ApiKeysPage } from "@/modules/apikeys/pages/api-keys-page";
import { EndpointsPage } from "@/modules/integrations/pages/endpoints-page";
import { AuditLogPage } from "@/modules/audit/pages/audit-log-page";
import { UsersPage } from "@/modules/users/pages/users-page";
import { NotFoundPage } from "@/modules/navigation/pages/not-found-page";
import { AppShell } from "./app-shell";
import { SidePanelCmdkHandler } from "@/infrastructure/side-panel/side-panel-shell";

export function App() {
  return (
    <>
      <Routes>
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
                  <Route
                    path={AppRoute.devices.new}
                    element={
                      <RequireRole minimum="admin">
                        <DeviceFormPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/devices/:sn/edit"
                    element={
                      <RequireRole minimum="admin">
                        <DeviceFormPage />
                      </RequireRole>
                    }
                  />
                  <Route path={AppRoute.punches.list} element={<PunchQueryPage />} />
                  <Route path={AppRoute.reports} element={<ReportsPage />} />
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
                  {/* Legacy redirects — keep old URLs working */}
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
      {/* SidePanelShell lives inside AppShell (app-shell.tsx), not here. */}
      <SidePanelCmdkHandler />
    </>
  );
}
