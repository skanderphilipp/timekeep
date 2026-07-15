// ── Barrel re-exports — every symbol previously available from `@/lib/api` ──
//
// Consuming code (hooks, components, pages) imports from `@/lib/api` as before.
// The underlying functions and types are now organized by domain under `lib/api/`.

// ── Client helpers (re-exported for consumers that import them from @/lib/api) ──

export {
  AUTH_LOGOUT_EVENT,
  setAuthToken,
} from "./client";

// ── Shared types & pagination ──────────────────────────────────────────────────

export type {
  PaginatedResponse,
  CursorPaginatedResponse,
  FacetKind,
  FacetOption,
  FacetGroup,
} from "./client";

// ── Auth ───────────────────────────────────────────────────────────────────────

export {
  login,
  fetchSetupStatus,
  performSetup,
  fetchMe,
  permissionsToSet,
} from "./auth";
export type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  SetupStatus,
  SetupRequest,
  SetupResponse,
} from "./auth";

// ── Devices ────────────────────────────────────────────────────────────────────

export {
  fetchDevices,
  fetchDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  fetchDeviceDetail,
  setUserOnDevice,
  deleteUserFromDevice,
  getSyncedDeviceUsers,
  enqueueDeviceCommand,
  restartDevice,
  syncDeviceClock,
  resyncDevice,
  syncDeviceToDevice,
  enrollEmployee,
  listDeviceEnrollments,
  syncEmployeeToDevices,
  removeEmployeeFromDevices,
  scanNetwork,
  discoverDevice,
  provisionDevice,
  fetchDeviceSchema,
  fetchDeviceFilters,
} from "./devices";
export type {
  DeviceSummary,
  DeviceConfig,
  DeviceDetailResponse,
  SetUserRequest,
  SyncedUser,
  EnqueueCommandRequest,
  EnrollEmployeeRequest,
  DeviceEnrollment,
  DiscoveredDevice,
  NetworkScanResponse,
  ScanNetworkRequest,
  DiscoverDeviceRequest,
  DeviceFacetParams,
} from "./devices";

// ── Punches ────────────────────────────────────────────────────────────────────

export {
  fetchPunches,
  fetchPunchesCursor,
  fetchPunchFilters,
  fetchPunchSchema,
  correctPunch,
  fetchPunchExport,
} from "./punches";
export type {
  Punch,
  PunchFilter,
  FacetFilterParams,
  CorrectPunchRequest,
  PunchCorrectedResponse,
  ExportFilter,
} from "./punches";

// ── Dashboard ──────────────────────────────────────────────────────────────────

export {
  fetchTodaySummary,
  fetchQuickStats,
  fetchDevicesHealth,
  fetchDeviceActivity,
} from "./dashboard";
export type {
  TodaySummary,
  CurrentlyCheckedIn,
  DashboardRecentEvent,
  DashboardDeviceHealth,
  DashboardHourlyBreakdown,
  QuickStats,
  DeviceHealthEntry,
  DeviceHealthSummary,
  DeviceActivityEvent,
  DeviceActivityPage,
} from "./dashboard";

// ── Employees ──────────────────────────────────────────────────────────────────

export {
  fetchEmployees,
  fetchEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  fetchEmployeeWorkDays,
  fetchEmployeeSummary,
  fetchEmployeeMonthly,
  fetchEmployeeCalendar,
  fetchEmployeeSchema,
  fetchEmployeeFilters,
} from "./employees";
export type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  WorkDay,
  EmployeeWorkDays,
  EmployeeSummary,
  MonthlyTrendPoint,
  CalendarDay,
  WorkDayQuery,
  EmployeeFacetParams,
} from "./employees";

// ── Reports ────────────────────────────────────────────────────────────────────

export {
  fetchReportSummary,
} from "./reports";
export type {
  ReportSummary,
  DailyHoursBreakdown,
  WeeklyHoursBreakdown,
  AttendanceDistribution,
  EmployeeReportKpi,
  DailyBreakdown,
  ReportSummaryFilter,
} from "./reports";

// ── Settings ───────────────────────────────────────────────────────────────────

export {
  fetchSystemSettings,
  updateSystemSettings,
  fetchHealth,
} from "./settings";
export type {
  SystemSettings,
  UpdateSystemSettingsRequest,
  EngineHealthStats,
  DistributorHealthEntry,
  DeviceHealthInfo,
  Health,
} from "./settings";

// ── Users ──────────────────────────────────────────────────────────────────────

export {
  fetchUsers,
  fetchUser,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
} from "./users";
export type {
  DashboardUser,
  CreateDashboardUserRequest,
  UpdateDashboardUserRequest,
} from "./users";

// ── API Keys ───────────────────────────────────────────────────────────────────

export {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
} from "./apikeys";
export type {
  ApiKey,
  CreateApiKeyRequest,
  ApiKeyCreatedResponse,
} from "./apikeys";

// ── Integrations ───────────────────────────────────────────────────────────────

export {
  INTEGRATION_KINDS,
  createIntegrationKinds,
  fetchEndpoints,
  fetchEndpoint,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
} from "./integrations";
export type {
  IntegrationKind,
  IntegrationEndpoint,
  CreateEndpointRequest,
  UpdateEndpointRequest,
} from "./integrations";

// ── Audit ──────────────────────────────────────────────────────────────────────
// ── Departments ────────────────────────────────────────────────────────────────

export {
  fetchDepartments,
  fetchDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  fetchDepartmentSchema,
  fetchDepartmentFilters,
} from "./departments";
export type {
  Department,
  WorkPolicy,
  DepartmentRequest,
  DepartmentFacetParams,
} from "./departments";

export {
  fetchAuditLogs,
  fetchAuditSchema,
  fetchAuditFilters,
} from "./audit";
export type {
  AuditEvent,
  AuditFilter,
  AuditFacetParams,
} from "./audit";
