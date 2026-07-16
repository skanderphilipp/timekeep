//! OpenAPI 3.1 specification for the timekeep REST API.
//!
//! Available at `/api/docs/openapi.json` (spec) and `/api/docs` (Swagger UI).

use crate::dto::*;
use crate::request::*;
use crate::response::*;
use crate::users::*;
use utoipa::OpenApi;
use utoipa::openapi::security::{ApiKey, ApiKeyValue, HttpAuthScheme, HttpBuilder, SecurityScheme};

/// The compiled OpenAPI specification with all path definitions
/// and security schemes.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "timekeep API",
        version = env!("CARGO_PKG_VERSION"),
        description = "Biometric attendance management system with ZKTeco device integration, Odoo HR sync",
        contact(name = "Bentech - info@bentech.app"),
        license(name = "MIT"),
    ),
    security(
        ("bearer_auth" = []),
        ("api_key" = [])
    ),
    modifiers(&SecurityAddon),
    paths(
        // ── Auth ──
        crate::routes::auth::login,
        crate::users::whoami,
        crate::routes::auth::health_check,

        // ── Config ──
        crate::routes::auth::client_config,

        // ── Search ──
        crate::routes::search::global_search,

        // ── Devices ──
        crate::routes::devices::list_devices,
        crate::routes::devices::get_device,
        crate::routes::devices::add_device,
        crate::routes::devices::update_device,
        crate::routes::devices::remove_device,

        // ── Device Synced Users ──
        crate::routes::devices::list_synced_device_users,

        // ── Device Activity ──
        crate::routes::devices::device_activity,

        // ── Device Discovery & Provisioning ──
        crate::routes::devices::discover_device,
        crate::routes::devices::scan_network,
        crate::routes::devices::provision_device,

        // ── Device Search & Health ──
        crate::routes::devices::search_devices,
        crate::routes::devices::devices_health,
        crate::routes::devices::device_events,

        // ── Device Metadata ──
        crate::routes::devices::device_schema,
        crate::routes::devices::device_filters,

        // ── Device Batch ──
        crate::routes::devices::batch_action,

        // ── Providers ──
        crate::routes::devices::list_providers,

        // ── Dashboard ──
        crate::routes::dashboard::today_summary,
        crate::routes::dashboard::report_summary,

        // ── Punches (Management) ──
        crate::routes::punches::query_punches_mgmt,
        crate::routes::punches::correct_punch,
        crate::routes::punches::punch_schema,
        crate::routes::punches::punch_filters,

        // ── Punches (Integration) ──
        crate::routes::punches::query_punches_integration,

        // ── Device Users ──
        crate::routes::device_users::set_user_on_device,
        crate::routes::device_users::delete_user_from_device,
        crate::routes::device_users::bulk_set_users_on_device,

        // ── Device Commands ──
        crate::routes::device_users::enqueue_device_command,

        // ── Device Operations ──
        crate::routes::device_users::sync_device_clock,
        crate::routes::device_users::restart_device,
        crate::routes::device_users::resync_device,
        crate::routes::device_users::sync_device_to_device,
        crate::routes::device_users::sync_all_devices,
        crate::routes::device_users::transfer_templates,

        // ── Device Group Sync ──
        crate::routes::device_users::sync_device_group,

        // ── API Keys ──
        crate::management::list_api_keys,
        crate::management::create_api_key,
        crate::management::revoke_api_key,

        // ── Integration Endpoints ──
        crate::management::list_endpoints,
        crate::management::create_endpoint,
        crate::management::update_endpoint,
        crate::management::delete_endpoint,

        // ── Settings ──
        crate::management::get_settings,
        crate::management::update_settings,

        // ── Audit ──
        crate::management::query_audit,
        crate::management::audit_schema,
        crate::management::audit_filters,

        // ── Export ──
        crate::management::export_punches,

        // ── Dashboard User Management ──
        crate::users::list_users,
        crate::users::create_user,
        crate::users::update_user,
        crate::users::delete_user,
        crate::users::change_password,

        // ── Employees ──
        crate::employees::list_employees,
        crate::employees::create_employee,
        crate::employees::get_employee,
        crate::employees::update_employee,
        crate::employees::deactivate_employee,
        crate::employees::employee_schema,
        crate::employees::employee_filters,

        // ── Employee Attendance ──
        crate::employees::employee_work_days,
        crate::employees::employee_summary,
        crate::employees::employee_monthly_trend,
        crate::employees::employee_calendar,

        // ── Employee Dashboard ──
        crate::employees::dashboard_quick_stats,

        // ── Employee Device Enrollment ──
        crate::employees::enroll_employee,
        crate::employees::list_device_enrollments,

        // ── Employee Device Sync ──
        crate::employees::sync_employee_to_devices,
        crate::employees::remove_employee_from_devices,

        // ── Departments ──
        crate::routes::departments::list_departments,
        crate::routes::departments::get_department,
        crate::routes::departments::create_department,
        crate::routes::departments::update_department,
        crate::routes::departments::delete_department,
        crate::routes::departments::department_schema,
        crate::routes::departments::department_filters,

        // ── Device Groups ──
        crate::routes::device_groups::list_groups,
        crate::routes::device_groups::get_group,
        crate::routes::device_groups::create_group,
        crate::routes::device_groups::update_group,
        crate::routes::device_groups::delete_group,
        crate::routes::device_groups::list_devices_in_group,
        crate::routes::device_groups::set_device_group,
    ),
    components(
        schemas(
            // Envelope
            ApiError,
            FieldError,
            PageMeta,

            // Auth
            LoginRequest,
            LoginResponse,

            // Devices
            AddDeviceRequest,
            UpdateDeviceRequest,
            DeviceResponse,
            DeviceSummary,
            DeviceDetailResponse,

            // Device Synced Users
            SyncedUserResponse,

            // Device Activity
            DeviceActivityEntry,

            // Device Discovery & Provisioning
            DiscoverDeviceRequest,
            ScanNetworkRequest,
            ProvisionDeviceRequest,
            DeviceDiscoverResponse,
            NetworkScanResponse,

            // Device Events
            DeviceEventListQuery,
            DeviceEventResponse,

            // Device Search
            DeviceSearchQuery,

            // Device Health
            DeviceHealthSummaryResponse,
            DeviceHealthEntry,

            // Device Batch
            BatchActionRequest,
            BatchActionResponse,

            // Providers
            ProviderResponse,
            ProviderCapabilitiesResponse,

            // Punches
            PunchListQuery,
            CorrectPunchRequest,
            PunchResponse,
            PunchIntegrationResponse,
            PunchListResponse,
            PunchIntegrationListResponse,
            PunchCorrectedResponse,

            // Dashboard
            TodaySummaryResponse,
            QuickStatsResponse,

            // Reports
            ReportSummaryQuery,
            ReportSummaryResponse,
            DailyBreakdown,

            // Users (Dashboard)
            UserProfileResponse,
            DashboardUserResponse,
            CreateDashboardUserRequest,
            UpdateDashboardUserRequest,
            ChangePasswordRequest,

            // Users (Device)
            SetUserRequest,

            // Commands
            EnqueueCommandRequest,

            // API Keys
            CreateApiKeyRequest,
            ApiKeyResponse,
            ApiKeyCreatedResponse,

            // Integration Endpoints
            CreateEndpointRequest,
            UpdateEndpointRequest,
            EndpointResponse,

            // System Settings
            UpdateSystemSettingsRequest,
            SystemSettingsResponse,

            // Audit
            AuditEventResponse,

            // Export
            ExportFormat,

            // Employees
            CreateEmployeeRequest,
            UpdateEmployeeRequest,
            EmployeeResponse,
            EmployeeWorkDaysResponse,
            EmployeeSummaryResponse,
            WorkDayResponse,
            WorkPeriodResponse,
            MonthlyTrendResponse,
            CalendarDayResponse,
            EnrollEmployeeRequest,
            EmployeeListQuery,

            // Departments
            CreateDepartmentRequest,
            UpdateDepartmentRequest,
            DepartmentResponse,
            WorkPolicyInput,

            // Device Groups
            CreateDeviceGroupRequest,
            UpdateDeviceGroupRequest,
            SetDeviceGroupRequest,
            DeviceGroupResponse,

            // Status
            StatusResponse,

            // Health
            HealthResponse,

            // Client Config
            ClientConfigResponse,
        )
    ),
    tags(
        (name = "Auth", description = "Authentication — JWT token issuance"),
        (name = "Config", description = "Client bootstrap configuration — workspace info, setup status, feature flags"),
        (name = "Health", description = "Health check and Prometheus metrics"),
        (name = "Search", description = "Full-text search across all indexed entities"),
        (name = "Devices", description = "Biometric device registration, discovery, provisioning, and monitoring"),
        (name = "Providers", description = "Device provider registry — supported vendors and capabilities"),
        (name = "Discovery", description = "Network scanning and device auto-detection"),
        (name = "Dashboard", description = "Real-time attendance dashboard data"),
        (name = "Punches", description = "Attendance punch records — query and correction"),
        (name = "Users", description = "Dashboard user management (CRUD + passwords) and device user enrollment"),
        (name = "Commands", description = "Device command queue (reboot, clear, resync)"),
        (name = "API Keys", description = "API key management for integration partners (Odoo, Zapier, …)"),
        (name = "Integration Endpoints", description = "Manage integration destinations — webhooks, Odoo, SAP, Zapier"),
        (name = "Settings", description = "System-wide settings — polling interval, auto-discover"),
        (name = "Audit", description = "Audit log — complete timeline of all system activity"),
        (name = "Export", description = "Data export endpoints — CSV and Excel downloads"),
        (name = "Integration", description = "Machine-to-machine integration API (API key auth, port 3001)"),
        (name = "Employees", description = "Employee directory — CRUD, attendance queries, device enrollment"),
        (name = "Departments", description = "Organizational departments with work policy overrides — groups employees for scheduling and reporting"),
        (name = "Device Groups", description = "Device groups for department-scoped employee sync operations"),
    )
)]
pub struct ApiDoc;

/// Registers custom security schemes (Bearer JWT + API key in header).
struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .description(Some("JWT token from POST /api/auth/login"))
                        .build(),
                ),
            );
            components.add_security_scheme(
                "api_key",
                SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("X-API-Key"))),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Smoke test: ensure the OpenAPI spec compiles and serializes.
    #[test]
    fn test_openapi_spec_generates() {
        let spec = ApiDoc::openapi();
        let json = serde_json::to_string_pretty(&spec).expect("OpenAPI spec should serialize");
        assert!(json.contains("timekeep"));
        assert!(json.contains("bearer_auth"));
        assert!(json.contains("openapi"));
        assert!(json.contains("X-API-Key"));
    }

    /// Coverage test: verify every major API group is represented in the spec.
    ///
    /// If you add a new route group to `management_router()`, add its paths
    /// here or this test will remind you.
    #[test]
    fn test_openapi_path_coverage() {
        let spec = ApiDoc::openapi();
        let paths = &spec.paths.paths;

        // Collect all path keys for assertions
        let path_keys: Vec<&str> = paths.keys().map(|s| s.as_str()).collect();

        // Auth & Config
        assert!(path_keys.contains(&"/api/auth/login"), "Missing /api/auth/login");
        assert!(path_keys.contains(&"/api/auth/me"), "Missing /api/auth/me");
        assert!(path_keys.contains(&"/api/health"), "Missing /api/health");
        assert!(path_keys.contains(&"/api/client-config"), "Missing /api/client-config");

        // Search
        assert!(path_keys.contains(&"/api/search"), "Missing /api/search");

        // Devices
        assert!(path_keys.contains(&"/api/devices"), "Missing /api/devices");
        assert!(path_keys.contains(&"/api/devices/health"), "Missing /api/devices/health");
        assert!(path_keys.contains(&"/api/devices/search"), "Missing /api/devices/search");
        assert!(path_keys.contains(&"/api/devices/scan"), "Missing /api/devices/scan");
        assert!(path_keys.contains(&"/api/devices/discover"), "Missing /api/devices/discover");
        assert!(path_keys.contains(&"/api/devices/provision"), "Missing /api/devices/provision");
        assert!(path_keys.contains(&"/api/devices/batch"), "Missing /api/devices/batch");
        assert!(path_keys.contains(&"/api/devices/schema"), "Missing /api/devices/schema");
        assert!(path_keys.contains(&"/api/devices/filters"), "Missing /api/devices/filters");

        // Punches
        assert!(path_keys.contains(&"/api/punches"), "Missing /api/punches");
        assert!(path_keys.contains(&"/api/punches/correct"), "Missing /api/punches/correct");
        assert!(path_keys.contains(&"/api/punches/schema"), "Missing /api/punches/schema");
        assert!(path_keys.contains(&"/api/punches/filters"), "Missing /api/punches/filters");

        // Dashboard
        assert!(path_keys.contains(&"/api/dashboard/today"), "Missing /api/dashboard/today");
        assert!(
            path_keys.contains(&"/api/dashboard/quick-stats"),
            "Missing /api/dashboard/quick-stats"
        );

        // Reports
        assert!(path_keys.contains(&"/api/reports/summary"), "Missing /api/reports/summary");

        // Users
        assert!(path_keys.contains(&"/api/users"), "Missing /api/users");

        // API Keys
        assert!(path_keys.contains(&"/api/api-keys"), "Missing /api/api-keys");

        // Endpoints
        assert!(path_keys.contains(&"/api/endpoints"), "Missing /api/endpoints");

        // Settings
        assert!(path_keys.contains(&"/api/settings"), "Missing /api/settings");

        // Audit
        assert!(path_keys.contains(&"/api/audit"), "Missing /api/audit");
        assert!(path_keys.contains(&"/api/audit/schema"), "Missing /api/audit/schema");
        assert!(path_keys.contains(&"/api/audit/filters"), "Missing /api/audit/filters");

        // Export
        assert!(path_keys.contains(&"/api/exports/punches"), "Missing /api/exports/punches");

        // Employees
        assert!(path_keys.contains(&"/api/employees"), "Missing /api/employees");
        assert!(path_keys.contains(&"/api/employees/schema"), "Missing /api/employees/schema");
        assert!(path_keys.contains(&"/api/employees/filters"), "Missing /api/employees/filters");

        // Departments
        assert!(path_keys.contains(&"/api/departments"), "Missing /api/departments");
        assert!(path_keys.contains(&"/api/departments/schema"), "Missing /api/departments/schema");
        assert!(
            path_keys.contains(&"/api/departments/filters"),
            "Missing /api/departments/filters"
        );

        // Parameterized paths (contains /api/group/{param}/action format)
        let pairs = [
            ("/api/devices/", "/activity"),
            ("/api/devices/", "/synced-users"),
            ("/api/devices/", "/events"),
            ("/api/devices/", "/sync-clock"),
            ("/api/devices/", "/restart"),
            ("/api/devices/", "/resync"),
            ("/api/devices/", "/group"),
            ("/api/devices/", "/enrollments"),
            ("/api/employees/", "/work-days"),
            ("/api/employees/", "/summary"),
            ("/api/employees/", "/monthly"),
            ("/api/employees/", "/calendar"),
            ("/api/employees/", "/sync-to-devices"),
            ("/api/employees/", "/remove-from-devices"),
            ("/api/device-groups/", "/devices"),
            ("/api/device-groups/", "/sync"),
        ];
        for (prefix, suffix) in &pairs {
            let found = path_keys.iter().any(|p| p.contains(prefix) && p.contains(suffix));
            assert!(found, "Missing path matching '{prefix}...{suffix}'");
        }

        // Static paths for parameterized routes
        assert!(path_keys.contains(&"/api/devices/sync-all"), "Missing /api/devices/sync-all");
        assert!(path_keys.contains(&"/api/device-groups"), "Missing /api/device-groups");
    }

    /// Print all OpenAPI paths for manual review. Run with --nocapture.
    #[test]
    fn test_list_all_openapi_paths() {
        let spec = ApiDoc::openapi();
        let mut paths: Vec<_> = spec.paths.paths.keys().collect();
        paths.sort();
        println!("\nOpenAPI spec paths ({}):", paths.len());
        for p in &paths {
            println!("  {p}");
        }
    }
}
