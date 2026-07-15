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
use axum::routing::{delete, get, post, put};
use axum_prometheus::PrometheusMetricLayer;
use timekeep_core::{ProviderRegistry, events::EventBus, traits::Storage};
use timekeep_engine::health::EngineHealth;
use tower_http::limit::RequestBodyLimitLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use app_state::{AppState, DeviceConnectionState};

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

pub fn management_router(
    event_bus: EventBus,
    storage: Arc<dyn Storage>,
    employees: Option<Arc<dyn timekeep_core::EmployeeStore>>,
    device_state: DeviceConnectionState,
    provider_registry: Arc<ProviderRegistry>,
    engine_health: EngineHealth,
) -> Router {
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
        jwt_secret: jwt_secret.clone(),
        admin_user: admin_user.clone(),
        admin_password: admin_password.clone(),
        api_key,
        device_state,
        provider_registry,
        engine_health,
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
        .route("/api/punches", get(routes::punches::query_punches_mgmt))
        .route("/api/punches/schema", get(routes::punches::punch_schema))
        .route("/api/punches/filters", get(routes::punches::punch_filters))
        .route("/api/devices/schema", get(routes::devices::device_schema))
        .route("/api/devices/filters", get(routes::devices::device_filters))
        .route("/api/providers", get(routes::devices::list_providers))
        .route("/api/endpoints", get(management::list_endpoints))
        .route("/api/settings", get(management::get_settings))
        .route("/api/audit", get(management::query_audit))
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
        .route("/api/employees/{id}", get(employees::get_employee))
        // Enhanced dashboard quick stats
        .route("/api/dashboard/quick-stats", get(employees::dashboard_quick_stats));

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
        .route("/api/api-keys/{id}", delete(management::revoke_api_key))
        .route("/api/exports/punches", get(management::export_punches))
        .route("/api/endpoints", post(management::create_endpoint))
        .route(
            "/api/endpoints/{id}",
            put(management::update_endpoint).delete(management::delete_endpoint),
        )
        .route("/api/settings", put(management::update_settings))
        // Dashboard user management
        .route("/api/users", get(users::list_users).post(users::create_user))
        .route("/api/users/{id}", put(users::update_user).delete(users::delete_user))
        // Employee management
        .route("/api/employees", post(employees::create_employee))
        .route(
            "/api/employees/{id}",
            put(employees::update_employee).delete(employees::deactivate_employee),
        )
        // Device enrollment
        .route("/api/devices/{sn}/enrollments", post(employees::enroll_employee))
        .route("/api/devices/{sn}/enrollments", get(employees::list_device_enrollments))
        // Device user sync operations
        .route("/api/devices/{sn}/sync-clock", post(routes::device_users::sync_device_clock))
        .route("/api/devices/{sn}/restart", post(routes::device_users::restart_device))
        .route("/api/devices/{sn}/resync", post(routes::device_users::resync_device))
        .route(
            "/api/devices/{sn}/sync-from/{source_sn}",
            post(routes::device_users::sync_device_to_device),
        )
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
        .merge(
            SwaggerUi::new("/api/docs")
                .url("/api/docs/openapi.json", crate::openapi::ApiDoc::openapi()),
        )
        .route("/api/auth/login", post(routes::auth::login))
        .route("/api/health", get(routes::auth::health_check))
        .route("/api/about", get(routes::auth::about))
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

pub fn integration_router(
    event_bus: EventBus,
    storage: Arc<dyn Storage>,
    employees: Option<Arc<dyn timekeep_core::EmployeeStore>>,
    device_state: DeviceConnectionState,
    provider_registry: Arc<ProviderRegistry>,
    engine_health: EngineHealth,
) -> Router {
    let api_key = std::env::var("TIMEKEEP_API_KEY").unwrap_or_default();
    let (prometheus_layer, metric_handle) = get_prometheus();

    let state = AppState {
        event_bus,
        storage,
        employees,
        jwt_secret: String::new(),
        admin_user: String::new(),
        admin_password: String::new(),
        api_key: api_key.clone(),
        device_state,
        provider_registry,
        engine_health,
    };

    let int_rate_limiter = middleware::rate_limiter::RateLimiter::new(300, Duration::from_secs(60));
    let body_limit = RequestBodyLimitLayer::new(1024 * 1024);

    Router::new()
        .route("/api/v1/health", get(routes::auth::health_check))
        .route("/api/v1/metrics", get(|| async move { metric_handle.render() }))
        .route("/api/v1/punches", get(routes::punches::query_punches_integration))
        .route("/api/v1/employees/{pin}/work-days", get(employees::employee_work_days))
        .route("/api/v1/employees/{pin}/summary", get(employees::employee_summary))
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
    }
    impl FakeStorage {
        fn new() -> Self {
            Self {
                punches: StdMutex::new(Vec::new()),
                devices: StdMutex::new(Vec::new()),
                api_keys: StdMutex::new(Vec::new()),
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
    }

    fn test_state() -> AppState {
        AppState {
            event_bus: EventBus::default(),
            storage: Arc::new(FakeStorage::new()),
            employees: None,
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

    // ── Integration API ───────────────────────────────────────────

    #[tokio::test]
    async fn test_integration_api_key_blocks() {
        let app = integration_router(
            EventBus::default(),
            Arc::new(FakeStorage::new()),
            None,
            DeviceConnectionState::default(),
            Arc::new(timekeep_core::ProviderRegistry::new()),
            EngineHealth::default(),
        );

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
}
