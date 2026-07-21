//! # timekeep-api
//!
//! REST API for timekeep.
//!
//! ## Management API (port 3000) — JWT auth
//! ## Integration API (port 3001) — API key auth
//!
//! ## Response contract
//!
//! Every endpoint returns [`ApiEnvelope<T>`] with a consistent shape:
//! ```json
//! { "data": {...}, "meta": {"has_more": true, "next_cursor": "..."}, "error": null }
//! ```
//!
//! Errors use proper HTTP status codes (401, 404, 409, 422, 500) and
//! carry machine-readable `code` fields.

pub mod app_state;
pub mod audit;
pub mod auth;
pub mod dto;
pub mod employees;
pub mod helpers;
pub mod integration;
pub mod management;
pub mod middleware;
pub mod openapi;
pub mod request;
pub mod response;
pub mod routes;
pub mod users;

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::middleware as axum_mw;
use axum::response::Html;
use axum::routing::{delete, get, post, put};
use axum_prometheus::PrometheusMetricLayer;
use timekeep_core::{ProviderRegistry, events::EventBus, traits::Storage};
use timekeep_engine::health::EngineHealth;
use tower_http::limit::RequestBodyLimitLayer;
use utoipa::OpenApi;

use app_state::{AppState, DeviceConnectionState, SyncProviderRegistry};

/// Serve the Swagger UI HTML page that fetches the OpenAPI spec from `/api/docs/openapi.json`.
///
/// Uses unpkg CDN for swagger-ui-dist (v5). The inline approach avoids the
/// utoipa-swagger-ui v9 + axum 0.8 compatibility issue where the crate's
/// internal router returns 404 on trailing-slash redirects.
async fn swagger_ui_html() -> Html<&'static str> {
    Html(
        r###"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>timekeep API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    SwaggerUIBundle({
      url: "/api/docs/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "StandaloneLayout"
    });
  </script>
</body>
</html>"###,
    )
}

// ─── Global Prometheus layer ────────────────────────────────────────

static PROMETHEUS: std::sync::OnceLock<(
    PrometheusMetricLayer,
    axum_prometheus::metrics_exporter_prometheus::PrometheusHandle,
)> = std::sync::OnceLock::new();

fn get_prometheus()
-> (PrometheusMetricLayer<'static>, axum_prometheus::metrics_exporter_prometheus::PrometheusHandle)
{
    PROMETHEUS.get_or_init(PrometheusMetricLayer::pair).clone()
}

// ─── Router builders ────────────────────────────────────────────────

/// Bundled dependencies for building API routers.
///
/// All infrastructure concerns (storage, event bus, providers, health)
/// are collected here so that `management_router` and `integration_router`
/// accept a single struct instead of 8 individual parameters.
pub struct RouterConfig {
    pub event_bus: EventBus,
    pub storage: Arc<dyn Storage>,
    pub employees: Option<Arc<dyn timekeep_core::EmployeeStore>>,
    pub onboarding: Option<Arc<dyn timekeep_core::OnboardingSessionStore>>,
    pub search: Option<Arc<dyn timekeep_core::SearchStore>>,
    pub device_state: DeviceConnectionState,
    pub provider_registry: Arc<ProviderRegistry>,
    pub engine_health: EngineHealth,
    /// Registered sync providers (Odoo, SAP, etc.).
    pub sync_providers: SyncProviderRegistry,
}

pub fn management_router(config: RouterConfig) -> Router {
    let RouterConfig {
        event_bus,
        storage,
        employees,
        onboarding,
        search,
        device_state,
        provider_registry,
        engine_health,
        sync_providers,
        // Secrets are read from env inside the router (12-factor app)
    } = config;

    let jwt_secret =
        std::env::var("TIMEKEEP_JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());
    let admin_user = std::env::var("TIMEKEEP_ADMIN_USER").unwrap_or_else(|_| "admin".into());
    let admin_password =
        std::env::var("TIMEKEEP_ADMIN_PASSWORD").unwrap_or_else(|_| "admin".into());
    /*
     * Secrets are loaded from environment variables (12-factor app).
     * Dev defaults are insecure — validate_config() in main.rs warns at startup.
     */
    let api_key = std::env::var("TIMEKEEP_API_KEY").unwrap_or_default();
    let (prometheus_layer, metric_handle) = get_prometheus();

    let state = AppState {
        event_bus,
        storage,
        employees,
        onboarding,
        search,
        jwt_secret: jwt_secret.clone(),
        admin_user: admin_user.clone(),
        admin_password: admin_password.clone(),
        api_key,
        device_state,
        provider_registry,
        engine_health,
        sync_providers,
    };

    let mgmt_rate_limiter =
        middleware::rate_limiter::RateLimiter::new(100, Duration::from_secs(60));
    let body_limit = RequestBodyLimitLayer::new(1024 * 1024);

    // ── Role-based route groups ──────────────────────────────────
    //
    // Each group applies the minimum-required role middleware INNERMOST,
    // then the JWT middleware (require_jwt) runs OUTERMOST (first).
    //
    // Request flow: require_jwt → require_{role} → handler

    // Viewer: read-only access (lowest privilege)
    let viewer_routes = Router::new()
        .route("/api/search", get(routes::search::global_search))
        .route("/api/devices", get(routes::devices::list_devices))
        .route("/api/devices/search", get(routes::devices::search_devices))
        .route("/api/devices/health", get(routes::devices::devices_health))
        .route("/api/devices/{sn}", get(routes::devices::get_device))
        // Device users (synced from device, stored locally — viewer can see)
        .route("/api/devices/{sn}/synced-users", get(routes::devices::list_synced_device_users))
        .route("/api/devices/{sn}/events", get(routes::devices::device_events))
        .route("/api/devices/{sn}/activity", get(routes::devices::device_activity))
        .route("/api/auth/me", get(users::whoami))
        .route("/api/dashboard/today", get(routes::dashboard::today_summary))
        .route("/api/reports/summary", get(routes::dashboard::report_summary))
        .route("/api/reports/monthly-trend", get(routes::dashboard::monthly_trend))
        .route("/api/reports/by-department", get(routes::dashboard::department_attendance))
        .route("/api/reports/anomalies", get(routes::dashboard::list_anomalies))
        .route("/api/attendance/calendar", get(routes::attendance::calendar))
        .route("/api/attendance/timeline", get(routes::attendance::timeline))
        .route("/api/punches/schema", get(routes::punches::punch_schema))
        .route("/api/punches/filters", get(routes::punches::punch_filters))
        .route("/api/punches", get(routes::punches::query_punches_mgmt))
        .route("/api/punches/{id}", get(routes::punches::get_punch))
        .route("/api/devices/schema", get(routes::devices::device_schema))
        .route("/api/devices/filters", get(routes::devices::device_filters))
        .route("/api/providers", get(routes::devices::list_providers))
        .route("/api/endpoints", get(management::list_endpoints))
        .route("/api/settings", get(management::get_settings))
        .route("/api/audit", get(management::query_audit))
        .route("/api/audit/{id}", get(management::get_audit_event))
        .route("/api/audit/schema", get(management::audit_schema))
        .route("/api/audit/filters", get(management::audit_filters))
        .route("/api/users/{id}/password", put(users::change_password))
        // Employee work-day queries (viewer can view attendance)
        .route("/api/employees/{pin}/work-days", get(employees::employee_work_days))
        .route("/api/employees/{pin}/summary", get(employees::employee_summary))
        .route("/api/employees/{pin}/monthly", get(employees::employee_monthly_trend))
        .route("/api/employees/{pin}/calendar", get(employees::employee_calendar))
        .route("/api/employees", get(employees::list_employees))
        .route("/api/employees/schema", get(employees::employee_schema))
        .route("/api/employees/filters", get(employees::employee_filters))
        // Exact paths before parameterised — Axum matches in order
        .route(
            "/api/employees/enrollment-summary",
            get(routes::employee_enrollments::enrollment_summary),
        )
        .route("/api/employees/{id}", get(employees::get_employee))
        .route(
            "/api/employees/{id}/enrollments",
            get(routes::employee_enrollments::list_employee_enrollments),
        )
        // Department management (viewer can see)
        .route("/api/departments", get(routes::departments::list_departments))
        .route("/api/departments/schema", get(routes::departments::department_schema))
        .route("/api/departments/filters", get(routes::departments::department_filters))
        .route("/api/departments/{id}", get(routes::departments::get_department))
        // Work policy templates (viewer can see)
        .route("/api/work-policies", get(routes::work_policy_templates::list_templates))
        .route("/api/work-policies/schema", get(routes::work_policy_templates::template_schema))
        .route("/api/work-policies/filters", get(routes::work_policy_templates::template_filters))
        .route("/api/work-policies/{id}", get(routes::work_policy_templates::get_template))
        // Device group management (viewer can see)
        .route("/api/device-groups", get(routes::device_groups::list_groups))
        .route("/api/device-groups/{id}", get(routes::device_groups::get_group))
        .route("/api/device-groups/{id}/devices", get(routes::device_groups::list_devices_in_group))
        // Enhanced dashboard quick stats
        .route("/api/dashboard/quick-stats", get(employees::dashboard_quick_stats))
        // Onboarding session events (SSE stream — viewer can watch progress)
        .route("/api/onboarding/{id}/events", get(routes::onboarding::session_events));

    // Operator: write punches, manage users, view API keys
    let operator_routes = Router::new()
        .route("/api/punches/correct", post(routes::punches::correct_punch))
        .route("/api/devices/{sn}/users", post(routes::device_users::set_user_on_device))
        .route("/api/devices/{sn}/users/bulk", post(routes::device_users::bulk_set_users_on_device))
        .route(
            "/api/devices/{sn}/users/{user_sn}",
            delete(routes::device_users::delete_user_from_device),
        )
        .route("/api/devices/{sn}/commands", post(routes::device_users::enqueue_device_command))
        // Live device users (synced fallback until SDK live query is available)
        .route("/api/devices/{sn}/live-users", get(routes::onboarding::get_live_users))
        // Operator can list API keys (read-only view of integration partners)
        .route("/api/api-keys", get(management::list_api_keys))
        .layer(axum_mw::from_fn(auth::require_operator));

    // Admin: device CRUD, API key CRUD, exports, endpoints, settings
    let admin_routes = Router::new()
        .route("/api/devices", post(routes::devices::add_device))
        .route("/api/devices/discover", post(routes::devices::discover_device))
        .route("/api/devices/scan", post(routes::devices::scan_network))
        .route("/api/devices/provision", post(routes::devices::provision_device))
        .route("/api/devices/batch", post(routes::devices::batch_action))
        .route(
            "/api/devices/{sn}",
            put(routes::devices::update_device).delete(routes::devices::remove_device),
        )
        .route("/api/api-keys", post(management::create_api_key))
        .route(
            "/api/api-keys/{id}",
            get(management::get_api_key).delete(management::revoke_api_key),
        )
        .route("/api/exports/punches", get(management::export_punches))
        .route("/api/endpoints", post(management::create_endpoint))
        .route(
            "/api/endpoints/{id}",
            get(management::get_endpoint)
                .put(management::update_endpoint)
                .delete(management::delete_endpoint),
        )
        .route("/api/settings", put(management::update_settings))
        // Dashboard user management
        .route("/api/users", get(users::list_users).post(users::create_user))
        .route(
            "/api/users/{id}",
            get(users::get_user).put(users::update_user).delete(users::delete_user),
        )
        // Employee management
        .route("/api/employees", post(employees::create_employee))
        .route(
            "/api/employees/{id}",
            put(employees::update_employee).delete(employees::deactivate_employee),
        )
        // Department management (admin)
        .route("/api/departments", post(routes::departments::create_department))
        .route(
            "/api/departments/{id}",
            put(routes::departments::update_department)
                .delete(routes::departments::delete_department),
        )
        // Work policy templates (admin)
        .route("/api/work-policies", post(routes::work_policy_templates::create_template))
        .route(
            "/api/work-policies/{id}",
            put(routes::work_policy_templates::update_template)
                .delete(routes::work_policy_templates::delete_template),
        )
        // Device group management (admin)
        .route("/api/device-groups", post(routes::device_groups::create_group))
        .route(
            "/api/device-groups/{id}",
            put(routes::device_groups::update_group).delete(routes::device_groups::delete_group),
        )
        .route("/api/devices/{sn}/group", put(routes::device_groups::set_device_group))
        // Onboarding wizard (admin only — guides new customers through setup)
        .route("/api/onboarding/employee", post(routes::onboarding::create_employee_onboarding))
        .route("/api/onboarding/device", post(routes::onboarding::create_device_onboarding))
        .route("/api/onboarding/{id}", get(routes::onboarding::get_session))
        .route("/api/onboarding/{id}/advance", post(routes::onboarding::advance_session))
        .route("/api/onboarding/{id}/cancel", post(routes::onboarding::cancel_session))
        .route("/api/onboarding/{id}/retry", post(routes::onboarding::retry_session))
        .route("/api/onboarding", get(routes::onboarding::list_sessions))
        // Device enrollment
        .route("/api/devices/{sn}/enrollments", post(employees::enroll_employee))
        .route("/api/devices/{sn}/enrollments", get(employees::list_device_enrollments))
        // Fingerprint enrollment during onboarding wizard
        .route(
            "/api/devices/{sn}/users/{pin}/enroll-finger",
            post(routes::onboarding::enroll_finger),
        )
        // Enrollment SSE progress stream
        .route("/api/devices/{sn}/enrollment-events", get(routes::onboarding::enrollment_events))
        // Device user sync operations
        .route("/api/devices/{sn}/sync-clock", post(routes::device_users::sync_device_clock))
        .route("/api/devices/{sn}/restart", post(routes::device_users::restart_device))
        .route("/api/devices/{sn}/clear-users", post(routes::device_users::clear_device_users))
        .route("/api/devices/{sn}/pull-attendance", post(routes::devices::pull_attendance))
        .route("/api/devices/{sn}/refresh-info", post(routes::devices::refresh_device_info))
        .route("/api/devices/{sn}/refresh-users", post(routes::devices::refresh_device_users))
        .route(
            "/api/devices/{sn}/sync-from/{source_sn}",
            post(routes::device_users::sync_device_to_device),
        )
        // Group sync
        .route("/api/device-groups/{id}/sync", post(routes::device_users::sync_device_group))
        .route("/api/devices/sync-all", post(routes::device_users::sync_all_devices))
        .route("/api/sync/providers", get(routes::sync::list_providers))
        .route("/api/sync/{provider}/status", get(routes::sync::provider_status))
        .route("/api/sync/{provider}/trigger", post(routes::sync::trigger_provider))
        // Fingerprint template transfer
        .route(
            "/api/devices/{sn}/transfer-templates-to/{target_sn}",
            post(routes::device_users::transfer_templates),
        )
        // Employee sync to all devices
        .route("/api/employees/{id}/sync-to-devices", post(employees::sync_employee_to_devices))
        .route(
            "/api/employees/{id}/remove-from-devices",
            post(employees::remove_employee_from_devices),
        )
        .layer(axum_mw::from_fn(auth::require_admin));

    let protected = Router::new()
        .merge(viewer_routes)
        .merge(operator_routes)
        .merge(admin_routes)
        .layer(axum_mw::from_fn_with_state(state.clone(), audit::audit_middleware))
        .layer(axum_mw::from_fn_with_state(state.clone(), auth::require_jwt));

    Router::new()
        .route("/api/docs", get(swagger_ui_html))
        .route("/api/docs/", get(swagger_ui_html))
        .route(
            "/api/docs/openapi.json",
            get(|| async { axum::Json(crate::openapi::ApiDoc::openapi()) }),
        )
        .route("/api/auth/login", post(routes::auth::login))
        .route("/api/health", get(routes::auth::health_check))
        .route("/api/about", get(routes::auth::about))
        .route("/api/client-config", get(routes::auth::client_config))
        .route("/api/metrics", get(|| async move { metric_handle.render() }))
        .route("/api/status", get(routes::auth::setup_status))
        .route("/api/setup", post(routes::auth::perform_setup))
        .merge(protected)
        .layer(axum_mw::from_fn_with_state(
            mgmt_rate_limiter,
            middleware::rate_limiter::rate_limit_middleware,
        ))
        .layer(body_limit)
        .layer(prometheus_layer)
        .with_state(state)
}

///
/// TODO(ENTERPRISE): Replace 8-param signature with a RouterConfig struct (same as management_router).
/// Phase: API stabilisation (pre-v1.0).
/// Impact: Adding new dependencies requires signature changes in 3+ call sites.
#[allow(clippy::too_many_arguments)]
pub fn integration_router(config: RouterConfig) -> Router {
    let RouterConfig {
        event_bus,
        storage,
        employees,
        onboarding,
        search: _search,
        device_state,
        provider_registry,
        engine_health,
        sync_providers,
    } = config;

    let api_key = std::env::var("TIMEKEEP_API_KEY").unwrap_or_default();
    let (prometheus_layer, metric_handle) = get_prometheus();

    let state = AppState {
        event_bus,
        storage,
        employees,
        onboarding,
        search: None,
        jwt_secret: String::new(),
        admin_user: String::new(),
        admin_password: String::new(),
        api_key: api_key.clone(),
        device_state,
        provider_registry,
        engine_health,
        sync_providers,
    };

    let int_rate_limiter = middleware::rate_limiter::RateLimiter::new(300, Duration::from_secs(60));
    let body_limit = RequestBodyLimitLayer::new(1024 * 1024);

    Router::new()
        .route("/api/v1/health", get(routes::auth::health_check))
        .route("/api/v1/metrics", get(|| async move { metric_handle.render() }))
        .route("/api/v1/punches", get(routes::punches::query_punches_integration))
        .route("/api/v1/employees/{pin}/work-days", get(employees::employee_work_days))
        .route("/api/v1/employees/{pin}/summary", get(employees::employee_summary))
        .route("/api/v1/integration/odoo/employee-event", post(integration::odoo_employee_event))
        .route("/api/v1/sync/providers", get(routes::sync::list_providers))
        .route("/api/v1/sync/{provider}/status", get(routes::sync::provider_status))
        .route("/api/v1/sync/{provider}/trigger", post(routes::sync::trigger_provider))
        .layer(axum_mw::from_fn_with_state(state.clone(), integration::require_api_key))
        .layer(axum_mw::from_fn_with_state(
            int_rate_limiter,
            middleware::rate_limiter::rate_limit_middleware,
        ))
        .layer(body_limit)
        .layer(prometheus_layer)
        .with_state(state)
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex as StdMutex;
    use timekeep_core::model::AttendancePunch;
    use timekeep_core::traits::Storage;

    struct FakeStorage {
        punches: StdMutex<Vec<AttendancePunch>>,
        devices: StdMutex<Vec<timekeep_core::DeviceConfig>>,
        api_keys: StdMutex<Vec<timekeep_core::ApiKey>>,
        departments: StdMutex<Vec<timekeep_core::Department>>,
        device_groups: StdMutex<Vec<timekeep_core::DeviceGroup>>,
        settings: StdMutex<Option<timekeep_core::SystemSettings>>,
    }
    impl FakeStorage {
        fn new() -> Self {
            Self {
                punches: StdMutex::new(Vec::new()),
                devices: StdMutex::new(Vec::new()),
                api_keys: StdMutex::new(Vec::new()),
                departments: StdMutex::new(Vec::new()),
                device_groups: StdMutex::new(Vec::new()),
                settings: StdMutex::new(Some(timekeep_core::SystemSettings::default())),
            }
        }
    }
    #[async_trait]
    impl Storage for FakeStorage {
        async fn store_punch(&self, p: &AttendancePunch) -> Result<(), timekeep_core::Error> {
            self.punches.lock().unwrap().push(p.clone());
            Ok(())
        }
        async fn store_punches(&self, p: &[AttendancePunch]) -> Result<u64, timekeep_core::Error> {
            let mut g = self.punches.lock().unwrap();
            g.extend_from_slice(p);
            Ok(p.len() as u64)
        }
        async fn query_punches(
            &self,
            _: &timekeep_core::PunchFilter,
        ) -> Result<Vec<AttendancePunch>, timekeep_core::Error> {
            Ok(self.punches.lock().unwrap().clone())
        }
        async fn upsert_device(
            &self,
            _: &timekeep_core::model::Device,
        ) -> Result<(), timekeep_core::Error> {
            Ok(())
        }
        async fn upsert_device_config(
            &self,
            c: &timekeep_core::DeviceConfig,
        ) -> Result<(), timekeep_core::Error> {
            let mut d = self.devices.lock().unwrap();
            if let Some(e) = d.iter_mut().find(|x| x.serial_number == c.serial_number) {
                *e = c.clone();
            } else {
                d.push(c.clone());
            }
            Ok(())
        }
        async fn list_device_configs(
            &self,
        ) -> Result<Vec<timekeep_core::DeviceConfig>, timekeep_core::Error> {
            Ok(self.devices.lock().unwrap().clone())
        }
        async fn delete_device_config(&self, sn: &str) -> Result<(), timekeep_core::Error> {
            self.devices.lock().unwrap().retain(|d| d.serial_number != sn);
            Ok(())
        }
        async fn latest_punch_for_device(
            &self,
            _: &str,
        ) -> Result<Option<jiff::Timestamp>, timekeep_core::Error> {
            Ok(None)
        }
        async fn punch_exists(&self, _: &str) -> Result<bool, timekeep_core::Error> {
            Ok(false)
        }
        async fn get_punch(
            &self,
            id: &str,
        ) -> Result<Option<AttendancePunch>, timekeep_core::Error> {
            Ok(self.punches.lock().unwrap().iter().find(|p| p.id == id).cloned())
        }
        async fn create_api_key(
            &self,
            key: &timekeep_core::ApiKey,
        ) -> Result<(), timekeep_core::Error> {
            self.api_keys.lock().unwrap().push(key.clone());
            Ok(())
        }
        async fn find_api_key_by_hash(
            &self,
            key_hash: &str,
        ) -> Result<Option<timekeep_core::ApiKey>, timekeep_core::Error> {
            Ok(self.api_keys.lock().unwrap().iter().find(|k| k.key_hash == key_hash).cloned())
        }
        async fn find_dashboard_user_by_username(
            &self,
            username: &str,
        ) -> Result<Option<timekeep_core::DashboardUser>, timekeep_core::Error> {
            // Hardcoded test user: admin / test123
            if username == "admin" {
                // Pre-computed: SHA-256("test-salt:test123")
                let hash = "fd6faef2ff23b0a350c181bf03187c61b8d3b0ec1bbe1263f43d2bfb311700d7";
                Ok(Some(timekeep_core::DashboardUser {
                    id: "test-admin".into(),
                    username: "admin".into(),
                    password_hash: hash.to_string(),
                    salt: "test-salt".into(),
                    role: timekeep_core::Role::Admin,
                    permissions: timekeep_core::PermissionSet::all(),
                    display_name: "Admin".into(),
                    active: true,
                    created_at: 0,
                    updated_at: 0,
                }))
            } else {
                Ok(None)
            }
        }

        // ── Departments ─────────────────────────────────────────
        async fn list_departments(
            &self,
        ) -> Result<Vec<timekeep_core::Department>, timekeep_core::Error> {
            Ok(self.departments.lock().unwrap().clone())
        }
        async fn get_department(
            &self,
            id: &str,
        ) -> Result<Option<timekeep_core::Department>, timekeep_core::Error> {
            Ok(self.departments.lock().unwrap().iter().find(|d| d.id.0 == id).cloned())
        }
        async fn get_department_by_name(
            &self,
            name: &str,
        ) -> Result<Option<timekeep_core::Department>, timekeep_core::Error> {
            Ok(self.departments.lock().unwrap().iter().find(|d| d.name == name).cloned())
        }
        async fn create_department(
            &self,
            d: &timekeep_core::Department,
        ) -> Result<(), timekeep_core::Error> {
            self.departments.lock().unwrap().push(d.clone());
            Ok(())
        }
        async fn update_department(
            &self,
            d: &timekeep_core::Department,
        ) -> Result<(), timekeep_core::Error> {
            let mut depts = self.departments.lock().unwrap();
            if let Some(e) = depts.iter_mut().find(|x| x.id.0 == d.id.0) {
                *e = d.clone();
            }
            Ok(())
        }
        async fn delete_department(&self, id: &str) -> Result<(), timekeep_core::Error> {
            self.departments.lock().unwrap().retain(|d| d.id.0 != id);
            Ok(())
        }
        async fn get_system_settings(
            &self,
        ) -> Result<timekeep_core::SystemSettings, timekeep_core::Error> {
            Ok(self.settings.lock().unwrap().clone().unwrap_or_default())
        }

        // ── Device Groups ───────────────────────────────────────
        async fn list_device_groups(
            &self,
        ) -> Result<Vec<timekeep_core::DeviceGroup>, timekeep_core::Error> {
            Ok(self.device_groups.lock().unwrap().clone())
        }
        async fn get_device_group(
            &self,
            id: &str,
        ) -> Result<Option<timekeep_core::DeviceGroup>, timekeep_core::Error> {
            Ok(self.device_groups.lock().unwrap().iter().find(|g| g.id.0 == id).cloned())
        }
        async fn get_device_group_by_name(
            &self,
            name: &str,
        ) -> Result<Option<timekeep_core::DeviceGroup>, timekeep_core::Error> {
            Ok(self.device_groups.lock().unwrap().iter().find(|g| g.name == name).cloned())
        }
        async fn create_device_group(
            &self,
            g: &timekeep_core::DeviceGroup,
        ) -> Result<(), timekeep_core::Error> {
            self.device_groups.lock().unwrap().push(g.clone());
            Ok(())
        }
        async fn update_device_group(
            &self,
            g: &timekeep_core::DeviceGroup,
        ) -> Result<(), timekeep_core::Error> {
            let mut groups = self.device_groups.lock().unwrap();
            if let Some(e) = groups.iter_mut().find(|x| x.id.0 == g.id.0) {
                *e = g.clone();
            }
            Ok(())
        }
        async fn delete_device_group(&self, id: &str) -> Result<(), timekeep_core::Error> {
            self.device_groups.lock().unwrap().retain(|g| g.id.0 != id);
            Ok(())
        }
        async fn list_devices_in_group(
            &self,
            group_id: &str,
        ) -> Result<Vec<timekeep_core::DeviceConfig>, timekeep_core::Error> {
            Ok(self
                .devices
                .lock()
                .unwrap()
                .iter()
                .filter(|d| d.group_id.as_deref() == Some(group_id))
                .cloned()
                .collect())
        }
        async fn set_device_group_membership(
            &self,
            device_sn: &str,
            group_id: Option<&str>,
        ) -> Result<(), timekeep_core::Error> {
            let mut devices = self.devices.lock().unwrap();
            if let Some(d) = devices.iter_mut().find(|d| d.serial_number == device_sn) {
                d.group_id = group_id.map(String::from);
            }
            Ok(())
        }
    }

    fn test_state() -> AppState {
        AppState {
            event_bus: EventBus::default(),
            storage: Arc::new(FakeStorage::new()),
            employees: None,
            onboarding: None,
            search: None,
            jwt_secret: "test-jwt".into(),
            admin_user: "admin".into(),
            admin_password: "test123".into(),
            api_key: String::new(),
            device_state: DeviceConnectionState::default(),
            provider_registry: Arc::new(timekeep_core::ProviderRegistry::new()),
            engine_health: EngineHealth::default(),
        }
    }

    fn test_mgmt() -> Router {
        let (pl, mh) = get_prometheus();
        let state = test_state();
        let protected = Router::new()
            .route(
                "/api/devices",
                get(routes::devices::list_devices).post(routes::devices::add_device),
            )
            .route(
                "/api/devices/{sn}",
                get(routes::devices::get_device)
                    .put(routes::devices::update_device)
                    .delete(routes::devices::remove_device),
            )
            .route("/api/dashboard/today", get(routes::dashboard::today_summary))
            .route("/api/punches", get(routes::punches::query_punches_mgmt))
            .route("/api/punches/schema", get(routes::punches::punch_schema))
            .route("/api/punches/filters", get(routes::punches::punch_filters))
            .route("/api/punches/{id}", get(routes::punches::get_punch))
            .route("/api/punches/correct", post(routes::punches::correct_punch))
            .route("/api/devices/{sn}/users", post(routes::device_users::set_user_on_device))
            .route(
                "/api/devices/{sn}/users/{user_sn}",
                delete(routes::device_users::delete_user_from_device),
            )
            .route("/api/devices/{sn}/commands", post(routes::device_users::enqueue_device_command))
            .layer(axum_mw::from_fn_with_state(state.clone(), auth::require_jwt));
        Router::new()
            .route("/api/auth/login", post(routes::auth::login))
            .route("/api/health", get(routes::auth::health_check))
            .route("/api/metrics", get(|| async move { mh.render() }))
            .merge(protected)
            .layer(pl)
            .with_state(state)
    }

    fn admin_token() -> String {
        middleware::jwt::create_token("admin", timekeep_core::Role::Admin, "test-jwt").unwrap()
    }

    // ── Health ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_health_returns_envelope() {
        let r = test_mgmt();
        let req = axum::http::Request::get("/api/health").body(axum::body::Body::empty()).unwrap();
        let resp = tower::ServiceExt::oneshot(r, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["status"], "healthy");
        assert!(v["error"].is_null());
    }

    #[tokio::test]
    async fn test_metrics_ok() {
        let r = test_mgmt();
        let req = axum::http::Request::get("/api/metrics").body(axum::body::Body::empty()).unwrap();
        assert_eq!(tower::ServiceExt::oneshot(r, req).await.unwrap().status(), 200);
    }

    // ── Auth ───────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_login_ok() {
        let body = serde_json::json!({"username":"admin","password":"test123"});
        let req = axum::http::Request::post("/api/auth/login")
            .header("content-type", "application/json")
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["token_type"], "Bearer");
        assert!(v["data"]["token"].as_str().unwrap().len() > 10);
    }

    #[tokio::test]
    async fn test_login_bad_password_returns_401() {
        let body = serde_json::json!({"username":"admin","password":"wrong"});
        let req = axum::http::Request::post("/api/auth/login")
            .header("content-type", "application/json")
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        assert_eq!(resp.status(), 401);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["error"]["code"], "unauthorized");
        assert!(v["data"].is_null());
    }

    // ── Auth middleware ────────────────────────────────────────────

    #[tokio::test]
    async fn test_protected_needs_token() {
        let req = axum::http::Request::get("/api/devices").body(axum::body::Body::empty()).unwrap();
        assert_eq!(tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap().status(), 401);
    }

    #[tokio::test]
    async fn test_protected_with_token() {
        let tok = admin_token();
        let req = axum::http::Request::get("/api/devices")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        assert_eq!(tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap().status(), 200);
    }

    #[tokio::test]
    async fn test_protected_bad_token() {
        let req = axum::http::Request::get("/api/devices")
            .header("Authorization", "Bearer bad.token.here")
            .body(axum::body::Body::empty())
            .unwrap();
        assert_eq!(tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap().status(), 401);
    }

    // ── Devices ───────────────────────────────────────────────────

    #[tokio::test]
    async fn test_add_device_rejects_empty() {
        let tok = admin_token();
        // Missing host field should cause serde deserialization error → 422
        let body = serde_json::json!({"serial_number":"SN001"});
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        // serde returns 422 for missing required fields when using Json<T>
        assert_eq!(resp.status(), 422);
    }

    #[tokio::test]
    async fn test_add_device_creates() {
        let tok = admin_token();
        let body = serde_json::json!({"serial_number":"SN001","host":"10.0.0.1"});
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        assert_eq!(resp.status(), 201);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["serial_number"], "SN001");
        assert_eq!(v["data"]["host"], "10.0.0.1");
    }

    #[tokio::test]
    async fn test_get_device_not_found() {
        let tok = admin_token();
        let req = axum::http::Request::get("/api/devices/NONEXISTENT")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        assert_eq!(resp.status(), 404);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["error"]["code"], "not_found");
        assert!(v["data"].is_null());
    }

    // ── Punch correction ──────────────────────────────────────────

    #[tokio::test]
    async fn test_correct_punch_creates() {
        let tok = admin_token();
        let body = serde_json::json!({
            "user_pin":"145",
            "device_sn":"SN001",
            "status":"check_in",
            "timestamp":1752129600
        });
        let req = axum::http::Request::post("/api/punches/correct")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        assert_eq!(resp.status(), 201);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["user_pin"], "145");
        assert!(v["error"].is_null());
    }

    // ── Punch single lookup ────────────────────────────────────────

    #[tokio::test]
    async fn test_get_punch_returns_punch() {
        let tok = admin_token();
        let router = test_mgmt();

        // First, create a punch via correction endpoint so it exists in storage
        let body = serde_json::json!({
            "user_pin":"145",
            "device_sn":"SN001",
            "status":"check_in",
            "timestamp":1752129600
        });
        let req = axum::http::Request::post("/api/punches/correct")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
        let create_body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let created: serde_json::Value = serde_json::from_slice(&create_body).unwrap();
        let punch_id = created["data"]["id"].as_str().unwrap().to_string();

        // Now fetch it by ID using the same router (same storage)
        let req = axum::http::Request::get(format!("/api/punches/{punch_id}"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200, "GET /api/punches/{{id}} should return 200");

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["user_pin"], "145");
        assert!(v["error"].is_null());
    }

    #[tokio::test]
    async fn test_get_punch_not_found() {
        let tok = admin_token();
        let req = axum::http::Request::get("/api/punches/nonexistent-id")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        assert_eq!(resp.status(), 404, "GET /api/punches/{{id}} for missing should return 404");
    }

    // ── Integration API ───────────────────────────────────────────

    #[tokio::test]
    async fn test_integration_api_key_blocks() {
        let app = integration_router(RouterConfig {
            event_bus: EventBus::default(),
            storage: Arc::new(FakeStorage::new()),
            employees: None,
            onboarding: None,
            search: None,
            device_state: DeviceConnectionState::default(),
            provider_registry: Arc::new(timekeep_core::ProviderRegistry::new()),
            engine_health: EngineHealth::default(),
        });

        let req =
            axum::http::Request::get("/api/v1/punches").body(axum::body::Body::empty()).unwrap();
        assert_eq!(tower::ServiceExt::oneshot(app, req).await.unwrap().status(), 401);
    }

    #[tokio::test]
    async fn test_integration_api_key_accepts() {
        let storage = Arc::new(FakeStorage::new());
        let raw_key = "ak_test_integration_key_12345";
        let key_hash = timekeep_core::ApiKey::hash_key(raw_key);
        let test_key = timekeep_core::ApiKey {
            id: "test-key-id".into(),
            name: "test".into(),
            key_hash: key_hash.clone(),
            prefix: "ak_test_integr".into(),
            permissions: timekeep_core::PermissionSet::all(),
            created_by: "test".into(),
            created_at: jiff::Timestamp::now(),
            last_used_at: None,
            expires_at: None,
            revoked: false,
        };
        storage.create_api_key(&test_key).await.unwrap();

        let state = AppState {
            event_bus: EventBus::default(),
            storage: storage.clone(),
            employees: None,
            onboarding: None,
            search: None,
            jwt_secret: String::new(),
            admin_user: String::new(),
            admin_password: String::new(),
            api_key: String::new(),
            device_state: DeviceConnectionState::default(),
            provider_registry: Arc::new(timekeep_core::ProviderRegistry::new()),
            engine_health: EngineHealth::default(),
        };
        let (pl, mh) = get_prometheus();
        let r = Router::new()
            .route("/api/v1/health", get(routes::auth::health_check))
            .route("/api/v1/metrics", get(|| async move { mh.render() }))
            .route("/api/v1/punches", get(routes::punches::query_punches_integration))
            .layer(axum_mw::from_fn_with_state(state.clone(), integration::require_api_key))
            .layer(pl)
            .with_state(state);
        let req = axum::http::Request::get("/api/v1/punches")
            .header("X-API-Key", raw_key)
            .body(axum::body::Body::empty())
            .unwrap();
        assert_eq!(tower::ServiceExt::oneshot(r, req).await.unwrap().status(), 200);
    }

    // ── Envelope contract ─────────────────────────────────────────

    #[tokio::test]
    async fn test_envelope_shape_on_devices_list() {
        let tok = admin_token();
        let req = axum::http::Request::get("/api/devices")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        // Must have the standard envelope keys
        assert!(v["data"].is_array(), "data should be array for list endpoint");
        assert!(v["meta"].is_object(), "meta should be present for list endpoint");
        assert!(v["error"].is_null(), "error should be null on success");
        assert_eq!(v["meta"]["total"], 0);
    }

    #[tokio::test]
    async fn test_envelope_shape_on_error() {
        let tok = admin_token();
        let req = axum::http::Request::get("/api/devices/NONEXISTENT")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(test_mgmt(), req).await.unwrap();

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert!(v["data"].is_null(), "data should be null on error");
        assert!(v["meta"].is_null(), "meta should be null on error");
        assert!(v["error"].is_object(), "error should be present on error");
        assert_eq!(v["error"]["code"], "not_found");
    }

    // ── Device Groups ──────────────────────────────────────────

    /// Build a test router with device group routes wired.
    fn test_mgmt_with_groups() -> Router {
        let (pl, _mh) = get_prometheus();
        let state = test_state();
        let protected = Router::new()
            // Device CRUD
            .route(
                "/api/devices",
                get(routes::devices::list_devices).post(routes::devices::add_device),
            )
            .route(
                "/api/devices/{sn}",
                get(routes::devices::get_device)
                    .put(routes::devices::update_device)
                    .delete(routes::devices::remove_device),
            )
            // Department CRUD
            .route(
                "/api/departments",
                get(routes::departments::list_departments)
                    .post(routes::departments::create_department),
            )
            .route(
                "/api/departments/{id}",
                get(routes::departments::get_department)
                    .put(routes::departments::update_department)
                    .delete(routes::departments::delete_department),
            )
            // Device Groups CRUD
            .route(
                "/api/device-groups",
                get(routes::device_groups::list_groups).post(routes::device_groups::create_group),
            )
            .route(
                "/api/device-groups/{id}",
                get(routes::device_groups::get_group)
                    .put(routes::device_groups::update_group)
                    .delete(routes::device_groups::delete_group),
            )
            .route(
                "/api/device-groups/{id}/devices",
                get(routes::device_groups::list_devices_in_group),
            )
            .route("/api/devices/{sn}/group", put(routes::device_groups::set_device_group))
            // Sync operations
            .route("/api/device-groups/{id}/sync", post(routes::device_users::sync_device_group))
            .route("/api/devices/sync-all", post(routes::device_users::sync_all_devices))
        .route("/api/sync/providers", get(routes::sync::list_providers))
        .route("/api/sync/{provider}/status", get(routes::sync::provider_status))
        .route("/api/sync/{provider}/trigger", post(routes::sync::trigger_provider))
            .route("/api/devices/{sn}/clear-users", post(routes::device_users::clear_device_users))
            // Dashboard
            .route("/api/dashboard/today", get(routes::dashboard::today_summary))
            .route("/api/reports/summary", get(routes::dashboard::report_summary))
            .route("/api/reports/monthly-trend", get(routes::dashboard::monthly_trend))
            .route("/api/reports/by-department", get(routes::dashboard::department_attendance))
            .route("/api/reports/anomalies", get(routes::dashboard::list_anomalies))
            .route("/api/punches", get(routes::punches::query_punches_mgmt))
            .route("/api/punches/correct", post(routes::punches::correct_punch))
            .layer(axum_mw::from_fn_with_state(state.clone(), auth::require_jwt));
        Router::new().merge(protected).layer(pl).with_state(state)
    }

    #[tokio::test]
    async fn test_create_and_list_device_groups() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create a group
        let body = serde_json::json!({"name": "onboarding", "description": "HR enrollment device"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 201);

        // List groups
        let req = axum::http::Request::get("/api/device-groups")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"].as_array().unwrap().len(), 1);
        assert_eq!(v["data"][0]["name"], "onboarding");
        assert_eq!(v["data"][0]["description"], "HR enrollment device");
    }

    #[tokio::test]
    async fn test_create_duplicate_group_rejected() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        let body = serde_json::json!({"name": "staff"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 201);

        // Duplicate
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 409);
    }

    #[tokio::test]
    async fn test_delete_device_group() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create
        let body = serde_json::json!({"name": "temp-group"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let group_id = v["data"]["id"].as_str().unwrap().to_string();

        // Delete
        let req = axum::http::Request::delete(format!("/api/device-groups/{group_id}"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        // Verify gone
        let req = axum::http::Request::get(format!("/api/device-groups/{group_id}"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 404);
    }

    #[tokio::test]
    async fn test_sync_group_validates_existence() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Sync nonexistent group
        let req = axum::http::Request::post("/api/device-groups/nonexistent/sync")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 404);
    }

    #[tokio::test]
    async fn test_sync_group_empty_devices_rejected() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create a group with no devices
        let body = serde_json::json!({"name": "empty-group"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let group_id = v["data"]["id"].as_str().unwrap().to_string();

        // Sync empty group — should be rejected
        let req = axum::http::Request::post(format!("/api/device-groups/{group_id}/sync"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 422);
    }

    // ═══════════════════════════════════════════════════════════════
    // Department-Scoped Policy Resolution Tests
    // ═══════════════════════════════════════════════════════════════

    /// Fake employee store backed by the same FakeStorage departments.
    struct FakeEmployeeStore {
        employees: StdMutex<Vec<timekeep_core::Employee>>,
    }

    impl FakeEmployeeStore {
        fn new() -> Self {
            Self { employees: StdMutex::new(Vec::new()) }
        }

        fn seed(&self, emp: timekeep_core::Employee) {
            self.employees.lock().unwrap().push(emp);
        }
    }

    #[async_trait]
    impl timekeep_core::EmployeeStore for FakeEmployeeStore {
        async fn create_employee(
            &self,
            employee: &timekeep_core::Employee,
        ) -> Result<(), timekeep_core::Error> {
            self.employees.lock().unwrap().push(employee.clone());
            Ok(())
        }
        async fn find_employee(
            &self,
            _id: &timekeep_core::EmployeeId,
        ) -> Result<Option<timekeep_core::Employee>, timekeep_core::Error> {
            Ok(None)
        }
        async fn find_employee_by_pin(
            &self,
            pin: &str,
        ) -> Result<Option<timekeep_core::Employee>, timekeep_core::Error> {
            Ok(self.employees.lock().unwrap().iter().find(|e| e.pin == pin).cloned())
        }
        async fn find_employee_by_external_id(
            &self,
            _external_id: &str,
        ) -> Result<Option<timekeep_core::Employee>, timekeep_core::Error> {
            Ok(None)
        }
        async fn list_employees(
            &self,
            _params: &timekeep_core::ListParams,
        ) -> Result<timekeep_core::ListResult<timekeep_core::Employee>, timekeep_core::Error>
        {
            let items = self.employees.lock().unwrap().clone();
            let len = items.len();
            Ok(timekeep_core::ListResult::paginated(items, len as u64, false, None))
        }
        async fn update_employee(
            &self,
            _employee: &timekeep_core::Employee,
        ) -> Result<(), timekeep_core::Error> {
            Ok(())
        }
        async fn deactivate_employee(
            &self,
            _id: &timekeep_core::EmployeeId,
        ) -> Result<(), timekeep_core::Error> {
            Ok(())
        }
        async fn count_employees_in_department(
            &self,
            department_id: &str,
        ) -> Result<u64, timekeep_core::Error> {
            Ok(self
                .employees
                .lock()
                .unwrap()
                .iter()
                .filter(|e| e.department_id.as_deref() == Some(department_id) && e.active)
                .count() as u64)
        }
        async fn count_active_employees(&self) -> Result<u64, timekeep_core::Error> {
            Ok(self.employees.lock().unwrap().iter().filter(|e| e.active).count() as u64)
        }
        async fn create_enrollment(
            &self,
            _enrollment: &timekeep_core::DeviceEnrollment,
        ) -> Result<(), timekeep_core::Error> {
            Ok(())
        }
        async fn find_enrollment(
            &self,
            _employee_id: &timekeep_core::EmployeeId,
            _device_sn: &str,
        ) -> Result<Option<timekeep_core::DeviceEnrollment>, timekeep_core::Error> {
            Ok(None)
        }
        async fn list_enrollments_for_employee(
            &self,
            _employee_id: &timekeep_core::EmployeeId,
        ) -> Result<Vec<timekeep_core::DeviceEnrollment>, timekeep_core::Error> {
            Ok(vec![])
        }
        async fn list_enrollments_for_device(
            &self,
            _device_sn: &str,
        ) -> Result<Vec<timekeep_core::DeviceEnrollment>, timekeep_core::Error> {
            Ok(vec![])
        }
        async fn delete_enrollment(
            &self,
            _employee_id: &timekeep_core::EmployeeId,
            _device_sn: &str,
        ) -> Result<(), timekeep_core::Error> {
            Ok(())
        }
    }

    /// Build a test state with departments, employees, and the
    /// dashboard routes, for testing per-department policy resolution.
    fn test_state_with_employees(
        storage: Arc<FakeStorage>,
        employees: Arc<FakeEmployeeStore>,
    ) -> AppState {
        AppState {
            event_bus: EventBus::default(),
            storage: storage as Arc<dyn Storage>,
            employees: Some(employees as Arc<dyn timekeep_core::EmployeeStore>),
            onboarding: None,
            search: None,
            jwt_secret: "test-jwt".into(),
            admin_user: "admin".into(),
            admin_password: "test123".into(),
            api_key: String::new(),
            device_state: DeviceConnectionState::default(),
            provider_registry: Arc::new(timekeep_core::ProviderRegistry::new()),
            engine_health: EngineHealth::default(),
        }
    }

    fn dashboard_router(state: AppState) -> Router {
        let (pl, _mh) = get_prometheus();
        let protected = Router::new()
            .route("/api/dashboard/today", get(routes::dashboard::today_summary))
            .route("/api/reports/summary", get(routes::dashboard::report_summary))
            .route("/api/reports/monthly-trend", get(routes::dashboard::monthly_trend))
            .route("/api/reports/by-department", get(routes::dashboard::department_attendance))
            .route("/api/reports/anomalies", get(routes::dashboard::list_anomalies))
            .route("/api/punches", get(routes::punches::query_punches_mgmt))
            .route("/api/punches/correct", post(routes::punches::correct_punch))
            .route(
                "/api/devices",
                get(routes::devices::list_devices).post(routes::devices::add_device),
            )
            .route(
                "/api/device-groups",
                get(routes::device_groups::list_groups).post(routes::device_groups::create_group),
            )
            .route("/api/device-groups/{id}/sync", post(routes::device_users::sync_device_group))
            .route("/api/devices/sync-all", post(routes::device_users::sync_all_devices))
        .route("/api/sync/providers", get(routes::sync::list_providers))
        .route("/api/sync/{provider}/status", get(routes::sync::provider_status))
        .route("/api/sync/{provider}/trigger", post(routes::sync::trigger_provider))
            .route("/api/devices/{sn}/clear-users", post(routes::device_users::clear_device_users))
            .route("/api/devices/{sn}/group", put(routes::device_groups::set_device_group))
            .layer(axum_mw::from_fn_with_state(state.clone(), auth::require_jwt));
        Router::new().merge(protected).layer(pl).with_state(state)
    }

    fn make_punch(
        pin: &str,
        device_sn: &str,
        ts_epoch: i64,
        status: timekeep_core::PunchStatus,
    ) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(ts_epoch).unwrap();
        let mut p = AttendancePunch {
            id: uuid::Uuid::new_v4().to_string(),
            device_sn: device_sn.into(),
            user_pin: pin.into(),
            timestamp: ts,
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
            raw_data: None,
        };
        p.id = p.generate_deduplication_id();
        p
    }

    // ── Policy Resolution: today_summary ──────────────────────────

    #[tokio::test]
    async fn test_today_summary_late_detection_with_mixed_policies() {
        let storage = Arc::new(FakeStorage::new());
        let employees = Arc::new(FakeEmployeeStore::new());

        // Org default: 08:00 start, 15 min grace → late after 08:15
        // Flexible policy: never late
        let flexible = timekeep_core::WorkPolicy::flexible(4);
        let mgmt_dept = timekeep_core::Department::new("Management", Some(flexible));
        storage.create_department(&mgmt_dept).await.unwrap();

        // Employee 1001 = Management (flexible, never late)
        // Employee 1002 = no department (org default, late after 08:15)
        let mut alice =
            timekeep_core::Employee::new("1001", "Alice", Some("Management".into()), None);
        alice.department_id = Some(mgmt_dept.id.0.clone());
        employees.seed(alice);
        employees.seed(timekeep_core::Employee::new("1002", "Bob", None, None));

        // Both punch in at 09:30 — late by org default (after 09:15),
        // but NOT late by flexible policy (never late)
        let now = jiff::Timestamp::now();
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        let today = z.datetime().date();
        let today_930am =
            jiff::civil::DateTime::from_parts(today, jiff::civil::Time::new(9, 30, 0, 0).unwrap())
                .to_zoned(jiff::tz::TimeZone::UTC)
                .unwrap()
                .timestamp()
                .as_second();
        storage
            .store_punch(&make_punch(
                "1001",
                "SN001",
                today_930am,
                timekeep_core::PunchStatus::CheckIn,
            ))
            .await
            .unwrap();
        storage
            .store_punch(&make_punch(
                "1002",
                "SN001",
                today_930am,
                timekeep_core::PunchStatus::CheckIn,
            ))
            .await
            .unwrap();

        let state = test_state_with_employees(storage, employees);
        let app = dashboard_router(state);
        let tok = admin_token();

        let req = axum::http::Request::get("/api/dashboard/today")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        // Only Bob (1002) should be marked late — Alice has flexible policy
        assert_eq!(v["data"]["late"], 1, "only non-flexible employee should be late");
        assert_eq!(v["data"]["on_time"], 1, "flexible employee should be on time");
        assert_eq!(v["data"]["present"], 2, "both employees should be present");
    }

    #[tokio::test]
    async fn test_today_summary_all_flexible_none_late() {
        let storage = Arc::new(FakeStorage::new());
        let employees = Arc::new(FakeEmployeeStore::new());

        let flexible = timekeep_core::WorkPolicy::flexible(4);
        let mgmt = timekeep_core::Department::new("Management", Some(flexible.clone()));
        storage.create_department(&mgmt).await.unwrap();

        let mut alice =
            timekeep_core::Employee::new("1001", "Alice", Some("Management".into()), None);
        alice.department_id = Some(mgmt.id.0.clone());
        employees.seed(alice);
        let mut bob = timekeep_core::Employee::new("1002", "Bob", Some("Management".into()), None);
        bob.department_id = Some(mgmt.id.0.clone());
        employees.seed(bob);

        // Both punch in at 11:00 (would be late by standard policy, but flexible)
        let now = jiff::Timestamp::now();
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        let today = z.datetime().date();
        let ts =
            jiff::civil::DateTime::from_parts(today, jiff::civil::Time::new(11, 0, 0, 0).unwrap())
                .to_zoned(jiff::tz::TimeZone::UTC)
                .unwrap()
                .timestamp()
                .as_second();
        storage
            .store_punch(&make_punch("1001", "SN001", ts, timekeep_core::PunchStatus::CheckIn))
            .await
            .unwrap();
        storage
            .store_punch(&make_punch("1002", "SN001", ts, timekeep_core::PunchStatus::CheckIn))
            .await
            .unwrap();

        let state = test_state_with_employees(storage, employees);
        let app = dashboard_router(state);
        let tok = admin_token();

        let req = axum::http::Request::get("/api/dashboard/today")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["late"], 0, "flexible policy: no one should be late");
        assert_eq!(v["data"]["on_time"], 2, "flexible policy: everyone on time");
    }

    #[tokio::test]
    async fn test_today_summary_warehouse_early_shift() {
        let storage = Arc::new(FakeStorage::new());
        let employees = Arc::new(FakeEmployeeStore::new());

        // Warehouse: 06:00–14:00, 15 min grace → late after 06:15
        let early = timekeep_core::WorkPolicy {
            work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
            work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
            ..timekeep_core::WorkPolicy::standard_9to5()
        };
        let warehouse = timekeep_core::Department::new("Warehouse", Some(early));
        storage.create_department(&warehouse).await.unwrap();

        // Office: inherits org default (08:00, late after 08:15)
        let office = timekeep_core::Department::new("Office", None);
        storage.create_department(&office).await.unwrap();

        let mut carl = timekeep_core::Employee::new("2001", "Carl", Some("Warehouse".into()), None);
        carl.department_id = Some(warehouse.id.0.clone());
        employees.seed(carl);
        let mut diana = timekeep_core::Employee::new("2002", "Diana", Some("Office".into()), None);
        diana.department_id = Some(office.id.0.clone());
        employees.seed(diana);

        // Carl (warehouse) punches at 06:10 → on time (before 06:15 grace)
        // Diana (office) punches at 06:10 → this is before 08:00 start, not late
        let now = jiff::Timestamp::now();
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        let today = z.datetime().date();
        let early_ts =
            jiff::civil::DateTime::from_parts(today, jiff::civil::Time::new(6, 10, 0, 0).unwrap())
                .to_zoned(jiff::tz::TimeZone::UTC)
                .unwrap()
                .timestamp()
                .as_second();
        storage
            .store_punch(&make_punch(
                "2001",
                "SN001",
                early_ts,
                timekeep_core::PunchStatus::CheckIn,
            ))
            .await
            .unwrap();
        storage
            .store_punch(&make_punch(
                "2002",
                "SN001",
                early_ts,
                timekeep_core::PunchStatus::CheckIn,
            ))
            .await
            .unwrap();

        let state = test_state_with_employees(storage, employees);
        let app = dashboard_router(state);
        let tok = admin_token();

        let req = axum::http::Request::get("/api/dashboard/today")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        // 06:10 is before both warehouse start (06:00+0 grace=06:00) and office start (08:00)
        // late threshold is from work_start + grace: warehouse late after 06:15, office after 08:15
        // 06:10 is NOT late for warehouse (before 06:15), and NOT late for office (before 08:15)
        assert_eq!(v["data"]["late"], 0, "06:10 is before both grace thresholds");
        assert_eq!(v["data"]["on_time"], 2);
    }

    // ── Policy Resolution: report_summary ──────────────────────────

    #[tokio::test]
    async fn test_report_summary_with_mixed_department_policies() {
        let storage = Arc::new(FakeStorage::new());
        let employees = Arc::new(FakeEmployeeStore::new());

        // Management: flexible (never late)
        let flexible = timekeep_core::WorkPolicy::flexible(4);
        let mgmt = timekeep_core::Department::new("Management", Some(flexible));
        let mgmt_id = mgmt.id.0.clone();
        storage.create_department(&mgmt).await.unwrap();
        // Engineering: no override (org default)
        let eng = timekeep_core::Department::new("Engineering", None);
        let eng_id = eng.id.0.clone();
        storage.create_department(&eng).await.unwrap();

        let mut alice =
            timekeep_core::Employee::new("1001", "Alice", Some("Management".into()), None);
        alice.department_id = Some(mgmt_id);
        employees.seed(alice);
        let mut bob = timekeep_core::Employee::new("1002", "Bob", Some("Engineering".into()), None);
        bob.department_id = Some(eng_id);
        employees.seed(bob);

        // Both punch in at 09:00 and out at 17:00 on the same day
        let now = jiff::Timestamp::now();
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        let today = z.datetime().date();
        let day_start =
            jiff::civil::DateTime::from_parts(today, jiff::civil::Time::new(8, 0, 0, 0).unwrap())
                .to_zoned(jiff::tz::TimeZone::UTC)
                .unwrap()
                .timestamp()
                .as_second();
        let day_end =
            jiff::civil::DateTime::from_parts(today, jiff::civil::Time::new(16, 0, 0, 0).unwrap())
                .to_zoned(jiff::tz::TimeZone::UTC)
                .unwrap()
                .timestamp()
                .as_second();
        storage
            .store_punch(&make_punch(
                "1001",
                "SN001",
                day_start,
                timekeep_core::PunchStatus::CheckIn,
            ))
            .await
            .unwrap();
        storage
            .store_punch(&make_punch(
                "1001",
                "SN001",
                day_end,
                timekeep_core::PunchStatus::CheckOut,
            ))
            .await
            .unwrap();
        storage
            .store_punch(&make_punch(
                "1002",
                "SN001",
                day_start,
                timekeep_core::PunchStatus::CheckIn,
            ))
            .await
            .unwrap();
        storage
            .store_punch(&make_punch(
                "1002",
                "SN001",
                day_end,
                timekeep_core::PunchStatus::CheckOut,
            ))
            .await
            .unwrap();

        let state = test_state_with_employees(storage, employees);
        let app = dashboard_router(state);
        let tok = admin_token();

        let req = axum::http::Request::get("/api/reports/summary")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        // Should have data for both employees
        assert_eq!(v["data"]["unique_users"], 2);
        assert_eq!(v["data"]["total_punches"], 4);
        assert_eq!(v["data"]["check_ins"], 2);
        assert_eq!(v["data"]["check_outs"], 2);
        // Both employees present → no absent
        assert!(
            v["data"]["absence_rate"].as_f64().unwrap() < 1.0,
            "both employees should be present"
        );
    }

    #[tokio::test]
    async fn test_report_summary_handles_empty_punches() {
        let storage = Arc::new(FakeStorage::new());
        let employees = Arc::new(FakeEmployeeStore::new());

        let state = test_state_with_employees(storage, employees);
        let app = dashboard_router(state);
        let tok = admin_token();

        let req = axum::http::Request::get("/api/reports/summary")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["total_punches"], 0);
        assert_eq!(v["data"]["unique_users"], 0);
        assert!(v["data"]["employees"].as_array().unwrap().is_empty());
    }

    // ── Device Group: CRUD Edge Cases ──────────────────────────────

    #[tokio::test]
    async fn test_create_group_empty_name_rejected() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        let body = serde_json::json!({"name": "   "});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 422, "empty/whitespace name should be rejected");
    }

    #[tokio::test]
    async fn test_update_group_rename() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create
        let body = serde_json::json!({"name": "old-name"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let group_id = v["data"]["id"].as_str().unwrap().to_string();

        // Update name
        let body = serde_json::json!({"name": "new-name"});
        let req = axum::http::Request::put(format!("/api/device-groups/{group_id}"))
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        // Verify
        let req = axum::http::Request::get(format!("/api/device-groups/{group_id}"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["name"], "new-name");
    }

    // ── Device Membership ──────────────────────────────────────────

    #[tokio::test]
    async fn test_assign_device_to_group() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create group
        let body = serde_json::json!({"name": "onboarding"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let group_id = v["data"]["id"].as_str().unwrap().to_string();

        // Register a device
        let body = serde_json::json!({"serial_number": "HR-DEV01", "host": "10.0.0.50"});
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 201);

        // Assign device to group
        let body = serde_json::json!({"group_id": group_id});
        let req = axum::http::Request::put("/api/devices/HR-DEV01/group")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        // List devices in group — should contain HR-DEV01
        let req = axum::http::Request::get(format!("/api/device-groups/{group_id}/devices"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"].as_array().unwrap().len(), 1);
        assert_eq!(v["data"][0]["serial_number"], "HR-DEV01");

        // Remove device from group
        let body = serde_json::json!({});
        let req = axum::http::Request::put("/api/devices/HR-DEV01/group")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        // List devices in group — should be empty now
        let req = axum::http::Request::get(format!("/api/device-groups/{group_id}/devices"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"].as_array().unwrap().len(), 0, "device should be removed from group");
    }

    // ── Sync: Group + Department Filter ────────────────────────────

    #[tokio::test]
    async fn test_group_sync_with_devices_succeeds() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create group
        let body = serde_json::json!({"name": "staff-punchers"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let group_id = v["data"]["id"].as_str().unwrap().to_string();

        // Register a device and assign to group
        let body = serde_json::json!({"serial_number": "DEV-01", "host": "10.0.0.1"});
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();

        let body = serde_json::json!({"group_id": group_id});
        let req = axum::http::Request::put("/api/devices/DEV-01/group")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();

        // Sync group
        let req = axum::http::Request::post(format!("/api/device-groups/{group_id}/sync"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200, "group sync with devices should be accepted");
    }

    #[tokio::test]
    async fn test_group_sync_with_department_filter_validates_department() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create group and device
        let body = serde_json::json!({"name": "hr-onboarding"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let group_id = v["data"]["id"].as_str().unwrap().to_string();

        // Register device and assign to group
        let body = serde_json::json!({"serial_number": "HR-01", "host": "10.0.0.60"});
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();

        let body = serde_json::json!({"group_id": group_id});
        let req = axum::http::Request::put("/api/devices/HR-01/group")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();

        // Sync with non-existent department filter
        let req = axum::http::Request::post(format!(
            "/api/device-groups/{group_id}/sync?department_id=NonExistent"
        ))
        .header("Authorization", format!("Bearer {tok}"))
        .body(axum::body::Body::empty())
        .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 404, "sync with non-existent department should be rejected");
    }

    #[tokio::test]
    async fn test_clear_device_users_endpoint() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Register a device
        let body = serde_json::json!({"serial_number": "ONBOARD-01", "host": "10.0.0.70"});
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 201);

        // Clear users (pure destructive — no re-upload)
        let req = axum::http::Request::post("/api/devices/ONBOARD-01/clear-users")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200, "clear-users should be accepted");
    }

    #[tokio::test]
    async fn test_sync_all_with_devices_succeeds() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Register a device
        let body = serde_json::json!({"serial_number": "DEV-A", "host": "10.0.0.1"});
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();

        // Sync all
        let req = axum::http::Request::post("/api/devices/sync-all")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 200, "sync-all with devices should succeed");
    }

    #[tokio::test]
    async fn test_device_add_with_group_id() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create a group
        let body = serde_json::json!({"name": "office-group"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let group_id = v["data"]["id"].as_str().unwrap().to_string();

        // Add device with group_id
        let body = serde_json::json!({
            "serial_number": "OFFICE-01",
            "host": "10.0.0.10",
            "group_id": group_id
        });
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 201);
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["group_id"], group_id, "device should have group_id set");

        // Verify device appears in group's device list
        let req = axum::http::Request::get(format!("/api/device-groups/{group_id}/devices"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"].as_array().unwrap().len(), 1);
        assert_eq!(v["data"][0]["serial_number"], "OFFICE-01");
    }

    #[tokio::test]
    async fn test_create_group_with_department_ids() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create a group with department assignments
        let body = serde_json::json!({
            "name": "office",
            "description": "Main office devices",
            "department_ids": ["dept-hr", "dept-mgmt"]
        });
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 201);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["name"], "office");
        assert_eq!(v["data"]["department_ids"].as_array().unwrap().len(), 2);
        assert_eq!(v["data"]["department_ids"][0], "dept-hr");

        // Fetch the group and verify department_ids are persisted
        let group_id = v["data"]["id"].as_str().unwrap();
        let req = axum::http::Request::get(format!("/api/device-groups/{group_id}"))
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["department_ids"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn test_create_group_empty_department_ids_means_all() {
        let tok = admin_token();
        let app = test_mgmt_with_groups();

        // Create a group without department_ids (empty = all departments)
        let body = serde_json::json!({"name": "all-hands"});
        let req = axum::http::Request::post("/api/device-groups")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&body).unwrap()))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(app, req).await.unwrap();
        assert_eq!(resp.status(), 201);

        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["name"], "all-hands");
        // Empty department_ids means all departments — should serialize as empty array
        assert!(v["data"]["department_ids"].as_array().unwrap().is_empty());
    }

    // ── Sparse Field Selection ─────────────────────────────────────

    #[tokio::test]
    async fn test_punches_fields_returns_only_requested_keys() {
        let router = test_mgmt();
        let tok = admin_token();

        // Seed one punch
        let punch_body = serde_json::json!({
            "user_pin": "145", "device_sn": "DEV001", "status": "check_in",
            "verify_mode": "fingerprint", "timestamp": 1752129600
        });
        let req = axum::http::Request::post("/api/punches/correct")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&punch_body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();

        let req = axum::http::Request::get("/api/punches?fields=id,timestamp,status")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200);
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        let punches = v["data"]["punches"].as_array().unwrap();
        assert!(!punches.is_empty(), "should have at least one punch");
        let punch = &punches[0];
        // Should have only requested fields
        assert!(punch.get("id").is_some(), "id should be present");
        assert!(punch.get("timestamp").is_some(), "timestamp should be present");
        assert!(punch.get("status").is_some(), "status should be present");
        // Should NOT have non-requested fields
        assert!(punch.get("device_sn").is_none(), "device_sn should be absent");
        assert!(punch.get("verify_mode").is_none(), "verify_mode should be absent");
        assert!(punch.get("user_pin").is_none(), "user_pin should be absent");
        // Meta should still be present
        assert!(v["meta"].is_object(), "meta should be present");
    }

    #[tokio::test]
    async fn test_punches_without_fields_returns_all_keys() {
        let router = test_mgmt();
        let tok = admin_token();

        // Seed one punch
        let punch_body = serde_json::json!({
            "user_pin": "145", "device_sn": "DEV001", "status": "check_in",
            "verify_mode": "fingerprint", "timestamp": 1752129600
        });
        let req = axum::http::Request::post("/api/punches/correct")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&punch_body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();

        let req = axum::http::Request::get("/api/punches")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200);
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        let punches = v["data"]["punches"].as_array().unwrap();
        assert!(!punches.is_empty());
        let punch = &punches[0];
        // All fields should be present (backward compat)
        assert!(punch.get("id").is_some());
        assert!(punch.get("device_sn").is_some());
        assert!(punch.get("user_pin").is_some());
        assert!(punch.get("timestamp").is_some());
        assert!(punch.get("status").is_some());
        assert!(punch.get("verify_mode").is_some());
    }

    #[tokio::test]
    async fn test_fields_case_insensitive() {
        let router = test_mgmt();
        let tok = admin_token();

        let punch_body = serde_json::json!({
            "user_pin": "145", "device_sn": "DEV001", "status": "check_in",
            "verify_mode": "fingerprint", "timestamp": 1752129600
        });
        let req = axum::http::Request::post("/api/punches/correct")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&punch_body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();

        let req = axum::http::Request::get("/api/punches?fields=ID,DEVICE_SN,STATUS")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        let punch = &v["data"]["punches"].as_array().unwrap()[0];
        assert!(punch.get("id").is_some(), "case-insensitive ID");
        assert!(punch.get("device_sn").is_some(), "case-insensitive DEVICE_SN");
        assert!(punch.get("status").is_some(), "case-insensitive STATUS");
    }

    #[tokio::test]
    async fn test_fields_unknown_names_silently_ignored() {
        let router = test_mgmt();
        let tok = admin_token();

        let punch_body = serde_json::json!({
            "user_pin": "145", "device_sn": "DEV001", "status": "check_in",
            "verify_mode": "fingerprint", "timestamp": 1752129600
        });
        let req = axum::http::Request::post("/api/punches/correct")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&punch_body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();

        let req = axum::http::Request::get("/api/punches?fields=id,nonexistent,also_fake")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200);
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        let punch = &v["data"]["punches"].as_array().unwrap()[0];
        assert!(punch.get("id").is_some(), "valid field should still be present");
        assert!(punch.get("nonexistent").is_none(), "unknown field should be absent");
    }

    #[tokio::test]
    async fn test_devices_fields_returns_only_requested_keys() {
        let router = test_mgmt();
        let tok = admin_token();

        // Seed a device config
        let device_body = serde_json::json!({
            "serial_number": "DEV-SEL-001", "host": "192.168.1.50",
            "label": "Field Test Device", "vendor": "zkteco"
        });
        let req = axum::http::Request::post("/api/devices")
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::from(serde_json::to_string(&device_body).unwrap()))
            .unwrap();
        let _resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();

        let req = axum::http::Request::get("/api/devices?fields=serial_number,label,host")
            .header("Authorization", format!("Bearer {tok}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200);
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();

        let devices = v["data"].as_array().unwrap();
        assert!(!devices.is_empty());
        let device = &devices[0];
        assert!(device.get("serial_number").is_some());
        assert!(device.get("label").is_some());
        assert!(device.get("host").is_some());
        assert!(device.get("port").is_none(), "port should be absent");
        assert!(device.get("vendor").is_none(), "vendor should be absent");
    }

    // ═══════════════════════════════════════════════════════════════
    // Onboarding Wizard API Tests
    // ═══════════════════════════════════════════════════════════════

    /// Fake onboarding store backed by in-memory HashMap.
    struct FakeOnboardingStore {
        sessions: StdMutex<std::collections::HashMap<String, timekeep_core::OnboardingSession>>,
        logs: StdMutex<std::collections::HashMap<String, Vec<timekeep_core::OnboardingSessionLog>>>,
    }

    impl FakeOnboardingStore {
        fn new() -> Self {
            Self {
                sessions: StdMutex::new(std::collections::HashMap::new()),
                logs: StdMutex::new(std::collections::HashMap::new()),
            }
        }
    }

    #[async_trait]
    impl timekeep_core::OnboardingSessionStore for FakeOnboardingStore {
        async fn create_session(
            &self,
            session: &timekeep_core::OnboardingSession,
        ) -> Result<(), timekeep_core::Error> {
            self.sessions.lock().unwrap().insert(session.id.clone(), session.clone());
            Ok(())
        }

        async fn get_session(
            &self,
            id: &str,
        ) -> Result<Option<timekeep_core::OnboardingSession>, timekeep_core::Error> {
            Ok(self.sessions.lock().unwrap().get(id).cloned())
        }

        async fn update_session(
            &self,
            session: &timekeep_core::OnboardingSession,
        ) -> Result<(), timekeep_core::Error> {
            self.sessions.lock().unwrap().insert(session.id.clone(), session.clone());
            Ok(())
        }

        async fn list_sessions(
            &self,
            status: Option<timekeep_core::OnboardingStatus>,
            session_type: Option<timekeep_core::OnboardingType>,
        ) -> Result<Vec<timekeep_core::OnboardingSession>, timekeep_core::Error> {
            let sessions = self.sessions.lock().unwrap();
            let mut result: Vec<_> = sessions
                .values()
                .filter(|s| {
                    status.as_ref().map_or(true, |st| s.status == *st)
                        && session_type.as_ref().map_or(true, |t| s.session_type == *t)
                })
                .cloned()
                .collect();
            result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
            Ok(result)
        }

        async fn cancel_session(&self, id: &str) -> Result<(), timekeep_core::Error> {
            if let Some(s) = self.sessions.lock().unwrap().get_mut(id) {
                s.status = timekeep_core::OnboardingStatus::Cancelled;
                s.updated_at = jiff::Timestamp::now();
            }
            Ok(())
        }

        async fn list_abandoned_sessions(
            &self,
            _older_than_secs: u64,
        ) -> Result<Vec<timekeep_core::OnboardingSession>, timekeep_core::Error> {
            Ok(vec![])
        }

        async fn time_out_session(&self, id: &str) -> Result<(), timekeep_core::Error> {
            if let Some(s) = self.sessions.lock().unwrap().get_mut(id) {
                s.status = timekeep_core::OnboardingStatus::TimedOut;
                s.updated_at = jiff::Timestamp::now();
            }
            Ok(())
        }

        async fn delete_session(&self, id: &str) -> Result<(), timekeep_core::Error> {
            self.sessions.lock().unwrap().remove(id);
            self.logs.lock().unwrap().remove(id);
            Ok(())
        }

        async fn count_sessions(
            &self,
            status: Option<timekeep_core::OnboardingStatus>,
        ) -> Result<u64, timekeep_core::Error> {
            let sessions = self.sessions.lock().unwrap();
            let count = sessions
                .values()
                .filter(|s| status.as_ref().map_or(true, |st| s.status == *st))
                .count();
            Ok(count as u64)
        }

        async fn record_step_log(
            &self,
            log: &timekeep_core::OnboardingSessionLog,
        ) -> Result<(), timekeep_core::Error> {
            self.logs.lock().unwrap().entry(log.session_id.clone()).or_default().push(log.clone());
            Ok(())
        }

        async fn get_step_logs(
            &self,
            session_id: &str,
        ) -> Result<Vec<timekeep_core::OnboardingSessionLog>, timekeep_core::Error> {
            Ok(self.logs.lock().unwrap().get(session_id).cloned().unwrap_or_default())
        }
    }

    /// Create a test AppState with the fake onboarding store.
    fn onboarding_test_state(onboarding: Arc<FakeOnboardingStore>) -> AppState {
        let mut state = test_state();
        state.onboarding = Some(onboarding as Arc<dyn timekeep_core::OnboardingSessionStore>);
        state
    }

    /// Create a test router for onboarding endpoints (no auth required).
    fn onboarding_test_router(state: AppState) -> Router {
        let (pl, _mh) = get_prometheus();
        Router::new()
            .route("/api/onboarding/employee", post(routes::onboarding::create_employee_onboarding))
            .route("/api/onboarding/device", post(routes::onboarding::create_device_onboarding))
            .route("/api/onboarding/{id}", get(routes::onboarding::get_session))
            .route("/api/onboarding/{id}/advance", post(routes::onboarding::advance_session))
            .route("/api/onboarding/{id}/cancel", post(routes::onboarding::cancel_session))
            .route("/api/onboarding/{id}/retry", post(routes::onboarding::retry_session))
            .route("/api/onboarding", get(routes::onboarding::list_sessions))
            .layer(pl)
            .with_state(state)
    }

    // ── Create session tests ────────────────────────────────────

    #[tokio::test]
    async fn test_create_employee_onboarding_session() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        let req = axum::http::Request::post("/api/onboarding/employee")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::json!({
                    "employee_name": "Test Employee",
                    "employee_pin": "1001",
                    "department_id": "dept-1",
                    "target_device_sns": ["DEV001"],
                    "biometric_types": ["fingerprint"],
                    "finger_index": 1
                })
                .to_string(),
            ))
            .unwrap();

        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 201);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let data = &v["data"];
        assert_eq!(data["session_type"], "employee");
        assert_eq!(data["status"], "in_progress");
        assert_eq!(data["current_step"], "created");
        assert_eq!(data["total_steps"], 6);
        assert!(data["session_id"].as_str().is_some());
    }

    #[tokio::test]
    async fn test_create_device_onboarding_session() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        let req = axum::http::Request::post("/api/onboarding/device")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::json!({
                    "host": "192.168.1.100",
                    "port": 4370,
                    "serial_number": "DEV001",
                    "label": "Test Device",
                    "vendor": "zkteco"
                })
                .to_string(),
            ))
            .unwrap();

        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 201);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["session_type"], "device");
        assert_eq!(v["data"]["total_steps"], 7);
    }

    // ── Get session test ────────────────────────────────────────

    #[tokio::test]
    async fn test_get_onboarding_session() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        // First create a session
        let req = axum::http::Request::post("/api/onboarding/employee")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::json!({
                    "employee_name": "Test",
                    "employee_pin": "1001",
                    "target_device_sns": ["DEV001"],
                    "biometric_types": ["fingerprint"],
                    "finger_index": 1
                })
                .to_string(),
            ))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let session_id = v["data"]["session_id"].as_str().unwrap().to_string();

        // Now get it
        let req = axum::http::Request::get(format!("/api/onboarding/{session_id}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["session_id"], session_id);
        assert!(v["data"]["steps"].as_array().is_some());
    }

    #[tokio::test]
    async fn test_get_nonexistent_session_returns_404() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store);
        let router = onboarding_test_router(state);

        let req = axum::http::Request::get("/api/onboarding/nonexistent-id")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 404);
    }

    // ── Cancel session test ─────────────────────────────────────

    #[tokio::test]
    async fn test_cancel_onboarding_session() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        // Create a session
        let req = axum::http::Request::post("/api/onboarding/employee")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::json!({
                    "employee_name": "Test",
                    "employee_pin": "1001",
                    "target_device_sns": ["DEV001"],
                    "biometric_types": ["fingerprint"],
                    "finger_index": 1
                })
                .to_string(),
            ))
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let session_id = v["data"]["session_id"].as_str().unwrap().to_string();

        // Cancel it
        let req = axum::http::Request::post(format!("/api/onboarding/{session_id}/cancel"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        // Verify state
        let req = axum::http::Request::get(format!("/api/onboarding/{session_id}"))
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["status"], "cancelled");
    }

    #[tokio::test]
    async fn test_cannot_cancel_terminal_session() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        // Create a session and mark it completed
        let session = timekeep_core::OnboardingSession::new(
            "sess-completed".into(),
            timekeep_core::OnboardingType::Employee,
            None,
            serde_json::json!({}),
        );
        store.create_session(&session).await.unwrap();
        // Manually set completed
        let mut s = store.get_session("sess-completed").await.unwrap().unwrap();
        s.status = timekeep_core::OnboardingStatus::Completed;
        store.update_session(&s).await.unwrap();

        let req = axum::http::Request::post("/api/onboarding/sess-completed/cancel")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 400); // Bad request — can't cancel completed
    }

    // ── List sessions test ──────────────────────────────────────

    #[tokio::test]
    async fn test_list_onboarding_sessions() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        // Create two sessions
        for i in 0..2 {
            let req = axum::http::Request::post("/api/onboarding/employee")
                .header("Content-Type", "application/json")
                .body(axum::body::Body::from(
                    serde_json::json!({
                        "employee_name": format!("Employee {i}"),
                        "employee_pin": format!("100{i}"),
                        "target_device_sns": ["DEV001"],
                        "biometric_types": ["fingerprint"],
                        "finger_index": 1
                    })
                    .to_string(),
                ))
                .unwrap();
            let _ = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
        }

        let req =
            axum::http::Request::get("/api/onboarding").body(axum::body::Body::empty()).unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let data = v["data"].as_array().unwrap();
        assert_eq!(data.len(), 2);
    }

    #[tokio::test]
    async fn test_list_sessions_with_status_filter() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        // Create one session
        let req = axum::http::Request::post("/api/onboarding/employee")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::json!({
                    "employee_name": "Test",
                    "employee_pin": "1001",
                    "target_device_sns": ["DEV001"],
                    "biometric_types": ["fingerprint"],
                    "finger_index": 1
                })
                .to_string(),
            ))
            .unwrap();
        let _ = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();

        // Filter by completed — should be empty
        let req = axum::http::Request::get("/api/onboarding?status=completed")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let data = v["data"].as_array().unwrap();
        assert_eq!(data.len(), 0);
    }

    // ── Retry test ──────────────────────────────────────────────

    #[tokio::test]
    async fn test_retry_failed_session() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        // Create a failed session
        let session = timekeep_core::OnboardingSession::new(
            "sess-failed".into(),
            timekeep_core::OnboardingType::Employee,
            None,
            serde_json::json!({}),
        );
        store.create_session(&session).await.unwrap();
        let mut s = store.get_session("sess-failed").await.unwrap().unwrap();
        s.status = timekeep_core::OnboardingStatus::Failed;
        s.error_message = Some("Test error".into());
        store.update_session(&s).await.unwrap();

        let req = axum::http::Request::post("/api/onboarding/sess-failed/retry")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router.clone(), req).await.unwrap();
        assert_eq!(resp.status(), 200);

        // Verify reset
        let req = axum::http::Request::get("/api/onboarding/sess-failed")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["status"], "in_progress");
        assert!(v["data"]["error_message"].is_null());
    }

    #[tokio::test]
    async fn test_cannot_retry_in_progress_session() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store.clone());
        let router = onboarding_test_router(state);

        let session = timekeep_core::OnboardingSession::new(
            "sess-active".into(),
            timekeep_core::OnboardingType::Employee,
            None,
            serde_json::json!({}),
        );
        store.create_session(&session).await.unwrap();

        let req = axum::http::Request::post("/api/onboarding/sess-active/retry")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 400);
    }

    // ── Enroll finger test ──────────────────────────────────────

    #[tokio::test]
    async fn test_enroll_finger_endpoint() {
        let store = Arc::new(FakeOnboardingStore::new());
        let state = onboarding_test_state(store);
        let (pl, _mh) = get_prometheus();
        let router = Router::new()
            .route(
                "/api/devices/{sn}/users/{pin}/enroll-finger",
                post(routes::onboarding::enroll_finger),
            )
            .layer(pl)
            .with_state(state);

        let req = axum::http::Request::post("/api/devices/DEV001/users/1001/enroll-finger")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(serde_json::json!({"finger_index": 1}).to_string()))
            .unwrap();

        let resp = tower::ServiceExt::oneshot(router, req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["data"]["status"], "enrollment_triggered");
    }
}
