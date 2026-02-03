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
        crate::login,
        crate::users::whoami,
        crate::health_check,

        // ── Devices ──
        crate::list_devices,
        crate::get_device,
        crate::add_device,
        crate::update_device,
        crate::remove_device,

        // ── Device Discovery & Provisioning ──
        crate::discover_device,
        crate::scan_network,
        crate::provision_device,

        // ── Device Search & Health ──
        crate::search_devices,
        crate::devices_health,
        crate::device_events,

        // ── Device Batch ──
        crate::batch_action,

        // ── Providers ──
        crate::list_providers,

        // ── Dashboard ──
        crate::today_summary,
        crate::report_summary,

        // ── Punches (Management) ──
        crate::query_punches_mgmt,
        crate::correct_punch,

        // ── Punches (Integration) ──
        crate::query_punches_integration,

        // ── Device Users ──
        crate::set_user_on_device,
        crate::delete_user_from_device,

        // ── Device Commands ──
        crate::enqueue_device_command,

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

        // ── Export ──
        crate::management::export_punches,

        // ── Dashboard User Management ──
        crate::users::list_users,
        crate::users::create_user,
        crate::users::update_user,
        crate::users::delete_user,
        crate::users::change_password,
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

            // Device Discovery & Provisioning
            DiscoverDeviceRequest,
            ScanNetworkRequest,
            ProvisionDeviceRequest,
            DeviceDiscoverResponse,
            NetworkScanResponse,

            // Device Activity
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

            // Status
            StatusResponse,

            // Health
            HealthResponse,
        )
    ),
    tags(
        (name = "Auth", description = "Authentication — JWT token issuance"),
        (name = "Health", description = "Health check and Prometheus metrics"),
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
}
