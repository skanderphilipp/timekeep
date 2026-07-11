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

pub mod audit;
pub mod auth;
pub mod dto;
pub mod employees;
pub mod integration;
pub mod management;
pub mod openapi;
pub mod request;
pub mod response;
pub mod users;

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use axum_prometheus::PrometheusMetricLayer;
use timekeep_core::{
    Error, ProviderRegistry,
    events::{DomainEvent, EventBus},
    model::device_event::DeviceEventType,
    traits::{
        Storage,
        storage::{DeviceEventFilter, PunchFilter},
    },
};
use timekeep_engine::health::EngineHealth;
use tokio::sync::Mutex as TokioMutex;
use tower_http::limit::RequestBodyLimitLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use dto::*;
use request::*;
use response::*;

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

const JWT_EXPIRY_HOURS: u64 = 24;

// ─── Rate Limiter ───────────────────────────────────────────────────

#[derive(Clone)]
struct RateLimiter {
    timestamps: Arc<TokioMutex<VecDeque<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    fn new(max_requests: usize, window: Duration) -> Self {
        Self {
            timestamps: Arc::new(TokioMutex::new(VecDeque::with_capacity(max_requests))),
            max_requests,
            window,
        }
    }
}

async fn rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    request: axum::extract::Request,
    next: Next,
) -> Result<axum::response::Response, StatusCode> {
    let now = Instant::now();
    let mut timestamps = limiter.timestamps.lock().await;
    while timestamps.front().is_some_and(|t| now.duration_since(*t) > limiter.window) {
        timestamps.pop_front();
    }
    if timestamps.len() >= limiter.max_requests {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }
    timestamps.push_back(now);
    drop(timestamps);
    Ok(next.run(request).await)
}

// ─── JWT ────────────────────────────────────────────────────────────

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct Claims {
    sub: String,
    role: String,
    permissions: Option<String>,
    exp: usize,
    iat: usize,
}

fn create_token(username: &str, role: timekeep_core::Role, secret: &str) -> Result<String, Error> {
    let now = jiff::Timestamp::now().as_second() as usize;
    let claims = Claims {
        sub: username.into(),
        role: role.to_string(),
        permissions: Some(role.permissions().to_space_separated()),
        exp: now + JWT_EXPIRY_HOURS as usize * 3600,
        iat: now,
    };
    jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| Error::auth(format!("jwt encode: {e}")))
}

fn verify_token(token: &str, secret: &str) -> Result<Claims, Error> {
    jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .map(|d| d.claims)
    .map_err(|e| Error::auth(format!("jwt verify: {e}")))
}

// ─── Cursor encoding/decoding ───────────────────────────────────────

/// Encode a cursor from a punch's timestamp (seconds) and dedup ID.
/// Format: base64("{timestamp}:{dedup_id}")
fn encode_cursor(timestamp_sec: i64, dedup_id: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(format!("{timestamp_sec}:{dedup_id}"))
}

/// Decode a cursor into (timestamp_sec, dedup_id).
/// Returns None if the cursor is malformed.
fn decode_cursor(cursor: &str) -> Option<(i64, String)> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(cursor).ok()?;
    let s = String::from_utf8(bytes).ok()?;
    let (ts_str, id) = s.split_once(':')?;
    let ts = ts_str.parse::<i64>().ok()?;
    Some((ts, id.to_string()))
}

// ─── App State ──────────────────────────────────────────────────────

/// Tracks which devices are currently connected and how.
/// Built by subscribing to DeviceOnline/DeviceOffline events.
#[derive(Clone, Default)]
pub struct DeviceConnectionState {
    inner: Arc<TokioMutex<HashMap<String, DeviceConnInfo>>>,
}

#[derive(Clone)]
pub struct DeviceConnInfo {
    pub adms_active: bool,
    pub sdk_active: bool,
    pub last_seen: i64,
    pub last_poll: Option<i64>,
}

impl DeviceConnectionState {
    /// Get all device connection states (for dashboard overview).
    pub async fn get_all(&self) -> HashMap<String, DeviceConnInfo> {
        self.inner.lock().await.clone()
    }

    /// Mark a device as connected via ADMS push.
    pub async fn set_adms_connected(&self, sn: &str, ts: i64) {
        let mut guard = self.inner.lock().await;
        let entry = guard.entry(sn.to_string()).or_insert(DeviceConnInfo {
            adms_active: false,
            sdk_active: false,
            last_seen: ts,
            last_poll: None,
        });
        entry.adms_active = true;
        entry.last_seen = ts;
    }

    /// Mark a device as disconnected.
    pub async fn set_disconnected(&self, sn: &str, ts: i64) {
        let mut guard = self.inner.lock().await;
        if let Some(entry) = guard.get_mut(sn) {
            entry.adms_active = false;
            entry.sdk_active = false;
            entry.last_seen = ts;
        }
    }

    /// Mark SDK poll success.
    pub async fn set_sdk_polled(&self, sn: &str, ts: i64) {
        let mut guard = self.inner.lock().await;
        let entry = guard.entry(sn.to_string()).or_insert(DeviceConnInfo {
            adms_active: false,
            sdk_active: false,
            last_seen: ts,
            last_poll: None,
        });
        entry.sdk_active = true;
        entry.last_seen = ts;
        entry.last_poll = Some(ts);
    }

    /// Get connection info for a device.
    pub async fn get(&self, sn: &str) -> Option<DeviceConnInfo> {
        self.inner.lock().await.get(sn).cloned()
    }
}

#[derive(Clone)]
pub struct AppState {
    pub event_bus: EventBus,
    pub storage: Arc<dyn Storage>,
    pub employees: Option<Arc<dyn timekeep_core::EmployeeRepository>>,
    pub jwt_secret: String,
    pub admin_user: String,
    pub admin_password: String,
    pub api_key: String,
    pub device_state: DeviceConnectionState,
    pub provider_registry: Arc<ProviderRegistry>,
    pub engine_health: EngineHealth,
}

// ─── Router builders ────────────────────────────────────────────────

pub fn management_router(
    event_bus: EventBus,
    storage: Arc<dyn Storage>,
    employees: Option<Arc<dyn timekeep_core::EmployeeRepository>>,
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
     * TODO(ENTERPRISE): Extract to config
     *
     * Phase: Production hardening (before tenant onboarding)
     * Impact: Hardcoded defaults for dev convenience.
     * Fix: Read from env var or config file.
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

    let mgmt_rate_limiter = RateLimiter::new(100, Duration::from_secs(60));
    let body_limit = RequestBodyLimitLayer::new(1024 * 1024);

    // ── Role-based route groups ──────────────────────────────────
    //
    // Each group applies the minimum-required role middleware INNERMOST,
    // then the JWT middleware (require_jwt) runs OUTERMOST (first).
    //
    // Request flow: require_jwt → require_{role} → handler

    // Viewer: read-only access (lowest privilege)
    let viewer_routes = Router::new()
        .route("/api/devices", get(list_devices))
        .route("/api/devices/search", get(search_devices))
        .route("/api/devices/health", get(devices_health))
        .route("/api/devices/{sn}", get(get_device))
        .route("/api/devices/{sn}/events", get(device_events))
        .route("/api/auth/me", get(users::whoami))
        .route("/api/dashboard/today", get(today_summary))
        .route("/api/reports/summary", get(report_summary))
        .route("/api/punches", get(query_punches_mgmt))
        .route("/api/punches/filters", get(punch_filters))
        .route("/api/providers", get(list_providers))
        .route("/api/endpoints", get(management::list_endpoints))
        .route("/api/settings", get(management::get_settings))
        .route("/api/audit", get(management::query_audit))
        .route("/api/users/{id}/password", put(users::change_password))
        // Employee work-day queries (viewer can view attendance)
        .route("/api/employees/{pin}/work-days", get(employees::employee_work_days))
        .route("/api/employees/{pin}/summary", get(employees::employee_summary))
        .route("/api/employees", get(employees::list_employees))
        .route("/api/employees/{id}", get(employees::get_employee))
        // Enhanced dashboard quick stats
        .route("/api/dashboard/quick-stats", get(employees::dashboard_quick_stats));

    // Operator: write punches, manage users, view API keys
    let operator_routes = Router::new()
        .route("/api/punches/correct", post(correct_punch))
        .route("/api/devices/{sn}/users", post(set_user_on_device))
        .route("/api/devices/{sn}/users/{user_sn}", delete(delete_user_from_device))
        .route("/api/devices/{sn}/commands", post(enqueue_device_command))
        // Operator can list API keys (read-only view of integration partners)
        .route("/api/api-keys", get(management::list_api_keys))
        .layer(middleware::from_fn(auth::require_operator));

    // Admin: device CRUD, API key CRUD, exports, endpoints, settings
    let admin_routes = Router::new()
        .route("/api/devices", post(add_device))
        .route("/api/devices/discover", post(discover_device))
        .route("/api/devices/scan", post(scan_network))
        .route("/api/devices/provision", post(provision_device))
        .route("/api/devices/batch", post(batch_action))
        .route("/api/devices/{sn}", put(update_device).delete(remove_device))
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
        .layer(middleware::from_fn(auth::require_admin));

    let protected = Router::new()
        .merge(viewer_routes)
        .merge(operator_routes)
        .merge(admin_routes)
        .layer(middleware::from_fn_with_state(state.clone(), audit::audit_middleware))
        .layer(middleware::from_fn_with_state(state.clone(), auth::require_jwt));

    Router::new()
        .merge(
            SwaggerUi::new("/api/docs")
                .url("/api/docs/openapi.json", crate::openapi::ApiDoc::openapi()),
        )
        .route("/api/auth/login", post(login))
        .route("/api/health", get(health_check))
        .route("/api/metrics", get(|| async move { metric_handle.render() }))
        .route("/api/status", get(setup_status))
        .route("/api/setup", post(perform_setup))
        .merge(protected)
        .layer(middleware::from_fn_with_state(mgmt_rate_limiter, rate_limit_middleware))
        .layer(body_limit)
        .layer(prometheus_layer)
        .with_state(state)
}

pub fn integration_router(
    event_bus: EventBus,
    storage: Arc<dyn Storage>,
    employees: Option<Arc<dyn timekeep_core::EmployeeRepository>>,
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

    let int_rate_limiter = RateLimiter::new(300, Duration::from_secs(60));
    let body_limit = RequestBodyLimitLayer::new(1024 * 1024);

    Router::new()
        .route("/api/v1/health", get(health_check))
        .route("/api/v1/metrics", get(|| async move { metric_handle.render() }))
        .route("/api/v1/punches", get(query_punches_integration))
        .route("/api/v1/employees/{pin}/work-days", get(employees::employee_work_days))
        .route("/api/v1/employees/{pin}/summary", get(employees::employee_summary))
        .layer(middleware::from_fn_with_state(state.clone(), integration::require_api_key))
        .layer(middleware::from_fn_with_state(int_rate_limiter, rate_limit_middleware))
        .layer(body_limit)
        .layer(prometheus_layer)
        .with_state(state)
}

// ─── Handlers ───────────────────────────────────────────────────────

// ── Setup (First-Run Onboarding) ────────────────────────────────────

/// Check if the system needs initial setup.
///
/// Returns `{ setup_needed: true }` when no dashboard users exist.
/// The frontend uses this to decide whether to show the setup wizard
/// or the login page.
#[utoipa::path(
    get,
    path = "/api/status",
    tag = "Setup",
    responses(
        (status = 200, description = "Setup status", body = SetupStatusResponse),
    )
)]
pub(crate) async fn setup_status(
    State(state): State<AppState>,
) -> Json<ApiEnvelope<SetupStatusResponse>> {
    let setup_needed = state
        .storage
        .list_dashboard_users(&timekeep_core::ListParams::default())
        .await
        .map(|r| r.items.is_empty())
        .unwrap_or(true); // if DB is unreachable, assume setup needed
    Json(ApiEnvelope::success(SetupStatusResponse { setup_needed }))
}

/// Create the first admin user during initial setup.
///
/// Only works when NO dashboard users exist — returns 409 if users already exist.
/// Requires username (3+ chars) and password (6+ chars). Returns a JWT token
/// for immediate auto-login after setup.
#[utoipa::path(
    post,
    path = "/api/setup",
    tag = "Setup",
    request_body = SetupRequest,
    responses(
        (status = 201, description = "Admin created, JWT returned", body = SetupCompletedResponse),
        (status = 409, description = "Setup already completed — users exist"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn perform_setup(
    State(state): State<AppState>,
    Json(body): Json<SetupRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<SetupCompletedResponse>>), AppError> {
    // Guard: only allow setup when no users exist
    let existing = state
        .storage
        .list_dashboard_users(&timekeep_core::ListParams::default())
        .await
        .map_err(|e| AppError::Internal(format!("failed to check users: {e}")))?;
    if !existing.items.is_empty() {
        return Err(AppError::Duplicate("setup already completed — users exist".into()));
    }

    // Validate inputs
    if body.username.trim().len() < 3 {
        return Err(AppError::validation("username must be at least 3 characters"));
    }
    if body.password.len() < 6 {
        return Err(AppError::validation("password must be at least 6 characters"));
    }

    // Create the admin user
    let salt = timekeep_core::DashboardUser::generate_salt();
    let password_hash = timekeep_core::DashboardUser::hash_password(&body.password, &salt);
    let now = jiff::Timestamp::now().as_second();
    let display_name = body.display_name.unwrap_or_else(|| body.username.clone());

    let user = timekeep_core::DashboardUser {
        id: uuid::Uuid::now_v7().to_string(),
        username: body.username.trim().to_string(),
        password_hash,
        salt,
        role: timekeep_core::Role::Admin,
        permissions: timekeep_core::PermissionSet::empty(),
        display_name,
        active: true,
        created_at: now,
        updated_at: now,
    };

    state
        .storage
        .create_dashboard_user(&user)
        .await
        .map_err(|e| AppError::Internal(format!("failed to create admin user: {e}")))?;

    tracing::info!(
        username = %user.username,
        "initial admin user created via setup endpoint"
    );

    // Issue JWT for immediate login
    let token = create_token(&user.username, user.role, &state.jwt_secret)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let resp = SetupCompletedResponse {
        token,
        expires_in: JWT_EXPIRY_HOURS * 3600,
        username: user.username,
        role: user.role.to_string(),
    };

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(resp))))
}

// ── Health ──────────────────────────────────────────────────────────

/// Health check with real database ping.
#[utoipa::path(
    get,
    path = "/api/health",
    tag = "Health",
    responses(
        (status = 200, description = "All components healthy", body = HealthResponse),
        (status = 503, description = "Service degraded", body = HealthResponse),
    )
)]
pub(crate) async fn health_check(
    State(state): State<AppState>,
) -> (StatusCode, Json<ApiEnvelope<HealthResponse>>) {
    let db_status = match state.storage.health_check().await {
        Ok(()) => "connected".to_string(),
        Err(e) => {
            tracing::warn!(error = %e, "health check: database ping failed");
            format!("error: {e}")
        },
    };

    // Build rich health data from engine and device state
    let engine_snap = state.engine_health.snapshot();
    let engine_stats = EngineHealthStats {
        events_processed: engine_snap.events_processed,
        events_dropped: engine_snap.events_dropped,
        events_distributed: engine_snap.events_distributed,
        events_failed: engine_snap.events_failed,
    };

    // Per-device connection health
    let now = jiff::Timestamp::now().as_second();
    let device_health: Vec<DeviceHealthInfo> = state
        .device_state
        .get_all()
        .await
        .into_iter()
        .map(|(sn, info)| DeviceHealthInfo {
            serial_number: sn,
            adms_active: info.adms_active,
            sdk_active: info.sdk_active,
            last_seen_secs_ago: Some((now - info.last_seen).max(0) as u64),
            last_poll_secs_ago: info.last_poll.map(|lp| (now - lp).max(0) as u64),
        })
        .collect();

    // Determine overall status
    let overall = if db_status != "connected" { "degraded" } else { "healthy" };

    let response = HealthResponse {
        status: overall.to_string(),
        version: env!("CARGO_PKG_VERSION").into(),
        db: db_status,
        uptime_seconds: engine_snap.uptime_seconds,
        engine: Some(engine_stats),
        distributors: None, // Populated by the engine directly if it has distributor handles
        devices: if device_health.is_empty() { None } else { Some(device_health) },
    };

    let status_code =
        if overall == "healthy" { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };

    (status_code, Json(ApiEnvelope::success(response)))
}

/// Authenticate and receive a JWT token.
#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "Auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "JWT token issued", body = LoginResponse),
        (status = 401, description = "Invalid credentials"),
    )
)]
pub(crate) async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<LoginResponse>>), AppError> {
    // 1. Try database-backed dashboard user first
    if let Ok(Some(user)) = state.storage.find_dashboard_user_by_username(&body.username).await
        && user.active
        && user.verify_password(&body.password)
    {
        let token = create_token(&user.username, user.role, &state.jwt_secret)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let resp = LoginResponse::new(
            token,
            JWT_EXPIRY_HOURS * 3600,
            user.username.clone(),
            user.role,
            user.effective_permissions(),
        );
        return Ok((StatusCode::OK, Json(ApiEnvelope::success(resp))));
    }

    // 2. Legacy fallback: env-var based admin.
    // Works only when explicitly configured (non-default values) OR when no DB
    // users exist (first-run scenario before /api/setup is called).
    let db_is_empty = state
        .storage
        .list_dashboard_users(&timekeep_core::ListParams::default())
        .await
        .map(|r| r.items.is_empty())
        .unwrap_or(true);

    let env_is_configured = state.admin_user != "admin" || state.admin_password != "admin";

    if (env_is_configured || db_is_empty)
        && body.username == state.admin_user
        && body.password == state.admin_password
    {
        if env_is_configured {
            tracing::warn!(
                username = %body.username,
                "authenticated via env-var fallback (legacy). Migrate to DB users via /api/setup."
            );
        }
        let token = create_token(&body.username, timekeep_core::Role::Admin, &state.jwt_secret)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let role = timekeep_core::Role::Admin;
        let resp = LoginResponse::new(
            token,
            JWT_EXPIRY_HOURS * 3600,
            body.username.clone(),
            role,
            role.permissions(),
        );
        return Ok((StatusCode::OK, Json(ApiEnvelope::success(resp))));
    }

    Err(AppError::Unauthorized)
}

// ── Devices ─────────────────────────────────────────────────────────

/// List devices with search, sort, and pagination.
#[utoipa::path(
    get,
    path = "/api/devices",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(timekeep_core::ListParams),
    responses(
        (status = 200, description = "Device list with pagination", body = Vec<DeviceSummary>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_devices(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<Json<ApiEnvelope<Vec<DeviceSummary>>>, AppError> {
    use timekeep_core::traits::storage::DeviceFilter;

    let filter = DeviceFilter { params };
    let result = state.storage.list_device_configs_filtered(&filter).await?;

    let mut items: Vec<DeviceSummary> = Vec::with_capacity(result.items.len());
    for config in &result.items {
        let conn = state.device_state.get(&config.serial_number).await;
        let (status, adms, sdk, last_seen) = match conn {
            Some(info) => {
                let s =
                    if info.adms_active || info.sdk_active { "connected" } else { "disconnected" };
                (s.to_string(), info.adms_active, info.sdk_active, Some(info.last_seen))
            },
            None => ("disconnected".to_string(), false, false, None),
        };
        items.push(DeviceSummary {
            serial_number: config.serial_number.clone(),
            label: config.label.clone(),
            host: config.host.clone(),
            port: config.port,
            push_enabled: config.push_enabled,
            vendor: config.vendor.clone(),
            connection_status: status,
            adms_active: adms,
            sdk_poll_active: sdk,
            last_seen_at: last_seen,
            location: config.location.clone(),
        });
    }

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    Ok(Json(ApiEnvelope::paginated(items, meta)))
}

/// Get a single device by serial number.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Device details", body = DeviceDetailResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Device not found"),
    )
)]
pub(crate) async fn get_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<DeviceDetailResponse>>, AppError> {
    let configs = state.storage.list_device_configs().await?;
    let config = configs
        .iter()
        .find(|d| d.serial_number == sn)
        .ok_or_else(|| AppError::not_found(format!("device '{sn}' not found")))?;

    // Get enriched device info from storage (populated by get_device_info())
    let device_info = state.storage.get_device_info(&sn).await.ok().flatten();

    // Get real-time connection state
    let conn = state.device_state.get(&sn).await;
    let (adms, sdk, last_seen) = match conn {
        Some(info) => (info.adms_active, info.sdk_active, Some(info.last_seen)),
        None => (false, false, None),
    };

    let detail =
        DeviceDetailResponse::from_parts(config, device_info.as_ref(), adms, sdk, last_seen);
    Ok(Json(ApiEnvelope::success(detail)))
}

/// Register a new biometric device.
#[utoipa::path(
    post,
    path = "/api/devices",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = AddDeviceRequest,
    responses(
        (status = 201, description = "Device registered", body = DeviceResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn add_device(
    State(state): State<AppState>,
    Json(body): Json<AddDeviceRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DeviceResponse>>), AppError> {
    if body.serial_number.is_empty() || body.host.is_empty() {
        return Err(AppError::validation("serial_number and host are required"));
    }

    let config = timekeep_core::DeviceConfig {
        label: body.label.unwrap_or_else(|| body.serial_number.clone()),
        serial_number: body.serial_number.clone(),
        host: body.host,
        port: body.port,
        comm_key: body.comm_key,
        push_enabled: body.push_enabled,
        timezone: body.timezone,
        vendor: body.vendor.clone().unwrap_or_else(|| "zkteco".into()),
        location: body.location.clone(),
        poll_interval_secs: body.poll_interval_secs,
    };

    state.storage.upsert_device_config(&config).await?;

    state.event_bus.publish(DomainEvent::DeviceRegistered { device_sn: body.serial_number });

    let resp = DeviceResponse::from(&config);
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(resp))))
}

/// Update an existing device configuration.
#[utoipa::path(
    put,
    path = "/api/devices/{sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    request_body = UpdateDeviceRequest,
    responses(
        (status = 200, description = "Device updated", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 404, description = "Device not found"),
    )
)]
pub(crate) async fn update_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Json(body): Json<UpdateDeviceRequest>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let configs = state.storage.list_device_configs().await?;
    let existing = configs
        .into_iter()
        .find(|d| d.serial_number == sn)
        .ok_or_else(|| AppError::not_found(format!("device '{sn}' not found")))?;

    let config = timekeep_core::DeviceConfig {
        label: body.label.unwrap_or(existing.label),
        serial_number: sn,
        host: body.host.unwrap_or(existing.host),
        port: body.port.unwrap_or(existing.port),
        comm_key: body.comm_key.unwrap_or(existing.comm_key),
        push_enabled: body.push_enabled.unwrap_or(existing.push_enabled),
        timezone: body.timezone.or(existing.timezone),
        vendor: body.vendor.unwrap_or(existing.vendor),
        location: body.location.or(existing.location),
        poll_interval_secs: body.poll_interval_secs.or(existing.poll_interval_secs),
    };

    state.storage.upsert_device_config(&config).await?;
    Ok(Json(ApiEnvelope::success(StatusResponse::updated())))
}

/// Remove a device from the registry.
#[utoipa::path(
    delete,
    path = "/api/devices/{sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Device removed", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn remove_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.storage.delete_device_config(&sn).await?;
    state.event_bus.publish(DomainEvent::DeviceRemoved { device_sn: sn });
    Ok(Json(ApiEnvelope::success(StatusResponse::deleted())))
}

// ── Device Events (activity timeline) ────────────────────────────────

/// Get the activity timeline for a device.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}/events",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
        DeviceEventListQuery,
    ),
    responses(
        (status = 200, description = "Device events with pagination", body = Vec<DeviceEventResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn device_events(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Query(query): Query<DeviceEventListQuery>,
) -> Result<Json<ApiEnvelope<Vec<DeviceEventResponse>>>, AppError> {
    let event_types: Option<Vec<DeviceEventType>> = query.event_types.as_ref().and_then(|s| {
        let types: Vec<DeviceEventType> = s
            .split(',')
            .filter_map(|k| match k.trim() {
                "came_online" => Some(DeviceEventType::CameOnline),
                "went_offline" => Some(DeviceEventType::WentOffline { reason: "".into() }),
                "sync_started" => Some(DeviceEventType::SyncStarted),
                "sync_completed" => {
                    Some(DeviceEventType::SyncCompleted { records_synced: 0, duration_ms: 0 })
                },
                "sync_failed" => {
                    Some(DeviceEventType::SyncFailed { error: "".into(), records_synced: 0 })
                },
                "storage_warning" => Some(DeviceEventType::StorageWarning {
                    records_used: 0,
                    records_capacity: 0,
                    percentage: 0.0,
                }),
                "config_changed" => Some(DeviceEventType::ConfigChanged {
                    field: "".into(),
                    old_value: None,
                    new_value: None,
                }),
                "provisioning_started" => Some(DeviceEventType::ProvisioningStarted),
                "provisioning_completed" => Some(DeviceEventType::ProvisioningCompleted),
                "decommissioned" => Some(DeviceEventType::Decommissioned),
                "firmware_updated" => Some(DeviceEventType::FirmwareUpdated {
                    old_version: "".into(),
                    new_version: "".into(),
                }),
                _ => None,
            })
            .collect();
        if types.is_empty() { None } else { Some(types) }
    });

    let filter = DeviceEventFilter {
        params: timekeep_core::ListParams {
            sort_by: Some(query.sort_by),
            sort_order: query.sort_order,
            limit: query.limit.min(200),
            cursor: query.cursor,
            ..Default::default()
        },
        device_sn: Some(sn),
        event_types,
        since: query.since.map(|s| jiff::Timestamp::from_second(s).unwrap()),
        until: query.until.map(|s| jiff::Timestamp::from_second(s).unwrap()),
    };

    let result = state.storage.query_device_events(&filter).await?;
    let items: Vec<DeviceEventResponse> = result.items.iter().map(|e| e.into()).collect();

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    Ok(Json(ApiEnvelope::paginated(items, meta)))
}

// ── Device Search ────────────────────────────────────────────────────

/// Search devices with rich filters.
#[utoipa::path(
    get,
    path = "/api/devices/search",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(DeviceSearchQuery),
    responses(
        (status = 200, description = "Search results with pagination", body = Vec<DeviceSummary>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn search_devices(
    State(state): State<AppState>,
    Query(query): Query<DeviceSearchQuery>,
) -> Result<Json<ApiEnvelope<Vec<DeviceSummary>>>, AppError> {
    use timekeep_core::traits::storage::DeviceFilter;

    let filter = DeviceFilter {
        params: timekeep_core::ListParams {
            search: query.q,
            sort_by: Some(query.sort_by),
            sort_order: query.sort_order,
            limit: query.limit.min(200),
            cursor: query.cursor,
        },
    };

    let result = state.storage.list_device_configs_filtered(&filter).await?;

    let mut items: Vec<DeviceSummary> = Vec::with_capacity(result.items.len());
    for config in &result.items {
        // Apply in-memory filters for vendor, status, location
        if let Some(v) = &query.vendor
            && config.vendor != *v
        {
            continue;
        }
        if let Some(loc) = &query.location
            && config.location.as_deref() != Some(loc.as_str())
        {
            continue;
        }

        let conn = state.device_state.get(&config.serial_number).await;
        let (status, adms, sdk, last_seen) = match conn {
            Some(info) => {
                let s =
                    if info.adms_active || info.sdk_active { "connected" } else { "disconnected" };
                (s.to_string(), info.adms_active, info.sdk_active, Some(info.last_seen))
            },
            None => ("disconnected".to_string(), false, false, None),
        };

        if let Some(st) = &query.status
            && status != *st
        {
            continue;
        }

        items.push(DeviceSummary {
            serial_number: config.serial_number.clone(),
            label: config.label.clone(),
            host: config.host.clone(),
            port: config.port,
            push_enabled: config.push_enabled,
            vendor: config.vendor.clone(),
            connection_status: status,
            adms_active: adms,
            sdk_poll_active: sdk,
            last_seen_at: last_seen,
            location: config.location.clone(),
        });
    }

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    Ok(Json(ApiEnvelope::paginated(items, meta)))
}

// ── Device Health ────────────────────────────────────────────────────

/// Get aggregate health summary for all devices.
#[utoipa::path(
    get,
    path = "/api/devices/health",
    tag = "Devices",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Device health summary", body = DeviceHealthSummaryResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn devices_health(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<DeviceHealthSummaryResponse>>, AppError> {
    let configs = state.storage.list_device_configs().await?;
    let mut entries = Vec::with_capacity(configs.len());
    let mut online = 0usize;
    let mut offline = 0usize;
    let mut syncing = 0usize;
    let mut errors = 0usize;

    for config in &configs {
        let conn = state.device_state.get(&config.serial_number).await;
        let (status, last_seen) = match conn {
            Some(info) => {
                let s = if info.adms_active || info.sdk_active { "online" } else { "offline" };
                (s.to_string(), Some(info.last_seen))
            },
            None => ("offline".to_string(), None),
        };

        // Get device info for record usage
        let record_usage = state
            .storage
            .get_device_info(&config.serial_number)
            .await
            .ok()
            .flatten()
            .map(|d| d.record_usage_pct())
            .unwrap_or(0.0);

        match status.as_str() {
            "online" => online += 1,
            "offline" => offline += 1,
            "syncing" => syncing += 1,
            "error" => errors += 1,
            _ => offline += 1,
        }

        entries.push(DeviceHealthEntry {
            serial_number: config.serial_number.clone(),
            label: config.label.clone(),
            status: status.clone(),
            record_usage_pct: record_usage,
            last_seen_at: last_seen,
        });
    }

    let summary = DeviceHealthSummaryResponse {
        total: configs.len(),
        online,
        offline,
        syncing,
        errors,
        devices: entries,
    };

    Ok(Json(ApiEnvelope::success(summary)))
}

// ── Device Discovery ─────────────────────────────────────────────────

/// Probe a device to auto-detect vendor and extract identity.
#[utoipa::path(
    post,
    path = "/api/devices/discover",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = DiscoverDeviceRequest,
    responses(
        (status = 200, description = "Discovery result", body = DeviceDiscoverResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn discover_device(
    State(state): State<AppState>,
    Json(body): Json<DiscoverDeviceRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DeviceDiscoverResponse>>), AppError> {
    if body.host.is_empty() {
        return Err(AppError::validation("host is required"));
    }

    match state.provider_registry.probe_all(&body.host, body.port).await {
        Ok(probe) => {
            state.event_bus.publish(DomainEvent::DeviceDiscovered { probe: probe.clone() });
            let resp = DeviceDiscoverResponse::from_probe(&probe);
            Ok((StatusCode::OK, Json(ApiEnvelope::success(resp))))
        },
        Err(_) => {
            Ok((StatusCode::OK, Json(ApiEnvelope::success(DeviceDiscoverResponse::unreachable()))))
        },
    }
}

// ── Network Scan ────────────────────────────────────────────────────

/// Scan the local network for biometric devices.
#[utoipa::path(
    post,
    path = "/api/devices/scan",
    tag = "Discovery",
    security(("bearer_auth" = [])),
    request_body = ScanNetworkRequest,
    responses(
        (status = 200, description = "Scan completed — list of discovered devices", body = NetworkScanResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn scan_network(
    State(state): State<AppState>,
    Json(body): Json<ScanNetworkRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<NetworkScanResponse>>), AppError> {
    // Auto-detect subnet if not provided
    let subnet = body.subnet.unwrap_or_else(|| {
        timekeep_core::network_scanner::detect_local_subnets()
            .into_iter()
            .next()
            .unwrap_or_else(|| "192.168.1".to_string())
    });
    let port = body.port;

    let probes = state
        .provider_registry
        .scan_subnet(&subnet, port)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let devices: Vec<DeviceDiscoverResponse> =
        probes.iter().map(DeviceDiscoverResponse::from_probe).collect();

    let resp =
        NetworkScanResponse { subnet, hosts_scanned: 254, devices_found: devices.len(), devices };

    Ok((StatusCode::OK, Json(ApiEnvelope::success(resp))))
}

// ── Device Provisioning ──────────────────────────────────────────────

/// Finalize device provisioning after discovery.
#[utoipa::path(
    post,
    path = "/api/devices/provision",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = ProvisionDeviceRequest,
    responses(
        (status = 201, description = "Device provisioned", body = DeviceResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn provision_device(
    State(state): State<AppState>,
    Json(body): Json<ProvisionDeviceRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DeviceResponse>>), AppError> {
    if body.serial_number.is_empty() || body.host.is_empty() || body.label.is_empty() {
        return Err(AppError::validation("serial_number, host, and label are required"));
    }

    let config = timekeep_core::DeviceConfig {
        label: body.label.clone(),
        serial_number: body.serial_number.clone(),
        host: body.host,
        port: body.port,
        comm_key: body.comm_key,
        timezone: body.timezone,
        push_enabled: body.push_enabled,
        vendor: body.vendor,
        location: body.location,
        poll_interval_secs: body.poll_interval_secs,
    };

    state.storage.upsert_device_config(&config).await?;

    state.event_bus.publish(DomainEvent::DeviceProvisioned {
        device_sn: body.serial_number.clone(),
        provider: config.vendor.clone(),
    });

    let resp = DeviceResponse::from(&config);
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(resp))))
}

// ── Providers ────────────────────────────────────────────────────────

/// List all registered device providers (vendors).
#[utoipa::path(
    get,
    path = "/api/providers",
    tag = "Providers",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Provider list", body = Vec<ProviderResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_providers(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<ProviderResponse>>>, AppError> {
    let providers: Vec<ProviderResponse> =
        state.provider_registry.list().iter().map(|p| p.into()).collect();
    Ok(Json(ApiEnvelope::success(providers)))
}

// ── Batch Actions ────────────────────────────────────────────────────

/// Execute a batch action on multiple devices.
#[utoipa::path(
    post,
    path = "/api/devices/batch",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = BatchActionRequest,
    responses(
        (status = 200, description = "Batch action result", body = BatchActionResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn batch_action(
    State(state): State<AppState>,
    Json(body): Json<BatchActionRequest>,
) -> Result<Json<ApiEnvelope<BatchActionResponse>>, AppError> {
    if body.device_sns.is_empty() {
        return Err(AppError::validation("device_sns must not be empty"));
    }

    let total = body.device_sns.len();
    let mut succeeded = 0usize;
    let mut failed = 0usize;
    let mut errors = Vec::new();

    for sn in &body.device_sns {
        match body.action.as_str() {
            "sync_now" => {
                state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
                    device_sn: sn.clone(),
                    command: "SYNC".into(),
                });
                succeeded += 1;
            },
            "enable" | "disable" | "restart" => {
                state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
                    device_sn: sn.clone(),
                    command: body.action.to_uppercase(),
                });
                succeeded += 1;
            },
            other => {
                failed += 1;
                errors.push(format!("{sn}: unknown action '{other}'"));
            },
        }
    }

    let resp = BatchActionResponse {
        action: body.action,
        total,
        succeeded,
        failed,
        errors: if errors.is_empty() { None } else { Some(errors) },
    };

    Ok(Json(ApiEnvelope::success(resp)))
}

// ── Dashboard ───────────────────────────────────────────────────────

/// Get today's attendance summary.
#[utoipa::path(
    get,
    path = "/api/dashboard/today",
    tag = "Dashboard",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Today's summary", body = TodaySummaryResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn today_summary(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<TodaySummaryResponse>>, AppError> {
    use timekeep_core::PunchStatus;
    use timekeep_core::model::AttendancePunch;

    let now = jiff::Timestamp::now();
    let settings = state.storage.get_system_settings().await?;
    let policy = &settings.work_policy;

    // Today's date range (midnight to now)
    let today_start = {
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        jiff::civil::DateTime::from_parts(
            z.datetime().date(),
            jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
        )
        .to_zoned(jiff::tz::TimeZone::UTC)
        .unwrap()
        .timestamp()
    };

    let punches = state
        .storage
        .query_punches(&PunchFilter {
            since: Some(today_start),
            until: Some(now),
            ..Default::default()
        })
        .await?;

    // ── Present / absent / late / on_time ──
    let mut all_users: std::collections::HashSet<&str> = std::collections::HashSet::new();
    let mut first_check_in: std::collections::HashMap<&str, (&AttendancePunch, jiff::civil::Time)> =
        std::collections::HashMap::new();
    let mut last_punch_per_user: std::collections::HashMap<&str, &AttendancePunch> =
        std::collections::HashMap::new();

    for p in &punches {
        all_users.insert(&p.user_pin);
        last_punch_per_user.insert(&p.user_pin, p);
        if p.status == PunchStatus::CheckIn {
            let z = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
            let arrival = z.datetime().time();
            first_check_in.entry(&p.user_pin).or_insert((p, arrival));
        }
    }

    let present = all_users.len();
    // ── Total employees (from employee repository, fallback to unique users) ──
    let total_employees = if let Some(ref repo) = state.employees {
        repo.list_employees(&timekeep_core::query::ListParams::default())
            .await
            .map(|r| r.items.len())
            .unwrap_or(present)
    } else {
        present
    };
    let absent = total_employees.saturating_sub(present);

    let late = first_check_in.values().filter(|(_, arrival)| policy.is_late(*arrival)).count();
    let on_time = first_check_in.len().saturating_sub(late);

    let check_ins = punches.iter().filter(|p| p.status == PunchStatus::CheckIn).count();

    // ── Currently checked in ──
    let device_configs = state.storage.list_device_configs().await?;
    let device_label_map: std::collections::HashMap<&str, &str> =
        device_configs.iter().map(|c| (c.serial_number.as_str(), c.label.as_str())).collect();

    let mut currently_checked_in: Vec<CurrentlyCheckedIn> = Vec::new();
    for pin in &all_users {
        let user_punches: Vec<&AttendancePunch> =
            punches.iter().filter(|p| p.user_pin == *pin).collect();
        let has_check_in = user_punches.iter().any(|p| p.status == PunchStatus::CheckIn);
        let has_check_out = user_punches.iter().any(|p| p.status == PunchStatus::CheckOut);
        if has_check_in
            && !has_check_out
            && let Some(check_in) = user_punches.iter().find(|p| p.status == PunchStatus::CheckIn)
        {
            let elapsed = now.duration_since(check_in.timestamp).as_secs().max(0);
            currently_checked_in.push(CurrentlyCheckedIn {
                user_pin: check_in.user_pin.clone(),
                employee_name: check_in.employee_name.clone(),
                check_in_time: check_in.timestamp.as_second(),
                device_sn: check_in.device_sn.clone(),
                device_label: device_label_map
                    .get(check_in.device_sn.as_str())
                    .map(|l| l.to_string()),
                elapsed_seconds: elapsed,
            });
        }
    }
    currently_checked_in.sort_by_key(|c| c.check_in_time);

    // ── Recent events: last 20 punches, newest first ──
    let recent_events: Vec<DashboardRecentEvent> = punches
        .iter()
        .rev()
        .take(20)
        .map(|p| DashboardRecentEvent {
            user_pin: p.user_pin.clone(),
            employee_name: p.employee_name.clone(),
            timestamp: p.timestamp.as_second(),
            status: p.status.to_string(),
            device_sn: p.device_sn.clone(),
        })
        .collect();

    // ── Hourly breakdown ──
    let mut hourly: [u32; 24] = [0; 24];
    for p in &punches {
        let z = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
        let hour = z.datetime().time().hour() as usize;
        if hour < 24 {
            hourly[hour] += 1;
        }
    }
    let hourly_breakdown: Vec<DashboardHourlyBreakdown> = (0..24u8)
        .map(|hour| DashboardHourlyBreakdown { hour, count: hourly[hour as usize] })
        .filter(|h| h.count > 0)
        .collect();

    // ── Device health ──
    let conn_states = state.device_state.get_all().await;
    let device_health: Vec<DashboardDeviceHealth> = device_configs
        .iter()
        .map(|cfg| {
            let conn = conn_states.get(&cfg.serial_number);
            let online = conn.is_some_and(|c| c.adms_active || c.sdk_active);
            DashboardDeviceHealth {
                serial_number: cfg.serial_number.clone(),
                label: cfg.label.clone(),
                online,
                adms_active: conn.is_some_and(|c| c.adms_active),
                sdk_poll_active: conn.is_some_and(|c| c.sdk_active),
                last_seen_at: conn.map(|c| c.last_seen),
                record_count: 0,
            }
        })
        .collect();

    let summary = TodaySummaryResponse {
        date: now.as_second(),
        present,
        absent,
        late,
        on_time,
        total_employees,
        total_punches: punches.len(),
        check_ins,
        check_outs: punches.len() - check_ins,
        last_punch_at: punches.last().map(|p| p.timestamp.as_second()),
        currently_checked_in,
        recent_events,
        device_health,
        hourly_breakdown,
    };

    Ok(Json(ApiEnvelope::success(summary)))
}

// ── Reports ──────────────────────────────────────────────────────────

/// Get aggregated punch summary for a date range.
///
/// Returns per-status counts, unique users, and daily breakdown.
/// Defaults to today if no date range is specified.
#[utoipa::path(
    get,
    path = "/api/reports/summary",
    tag = "Dashboard",
    security(("bearer_auth" = [])),
    params(ReportSummaryQuery),
    responses(
        (status = 200, description = "Aggregated report summary", body = ReportSummaryResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn report_summary(
    State(state): State<AppState>,
    Query(params): Query<ReportSummaryQuery>,
) -> Result<Json<ApiEnvelope<ReportSummaryResponse>>, AppError> {
    use timekeep_core::PunchStatus;

    let now = jiff::Timestamp::now();
    let settings = state.storage.get_system_settings().await?;
    let policy = &settings.work_policy;

    let day_start = {
        let z = now.to_zoned(jiff::tz::TimeZone::UTC);
        jiff::civil::DateTime::from_parts(
            z.datetime().date(),
            jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
        )
        .to_zoned(jiff::tz::TimeZone::UTC)
        .unwrap()
        .timestamp()
    };

    let date_from =
        params.date_from.and_then(|ts| jiff::Timestamp::from_second(ts).ok()).unwrap_or(day_start);
    let date_to =
        params.date_to.and_then(|ts| jiff::Timestamp::from_second(ts).ok()).unwrap_or(now);

    let from_date = date_from.to_zoned(jiff::tz::TimeZone::UTC).datetime().date();
    let to_date = date_to.to_zoned(jiff::tz::TimeZone::UTC).datetime().date();
    let work_days = policy.count_working_days(from_date, to_date);

    let filter = PunchFilter { since: Some(date_from), until: Some(date_to), ..Default::default() };
    let punches = state.storage.query_punches(&filter).await?;

    // ── Basic counts ──
    let mut check_ins: u64 = 0;
    let mut check_outs: u64 = 0;
    let mut break_outs: u64 = 0;
    let mut break_ins: u64 = 0;
    let mut overtime_ins: u64 = 0;
    let mut overtime_outs: u64 = 0;
    let mut users = std::collections::HashSet::new();
    let mut day_counts = std::collections::BTreeMap::new();

    for punch in &punches {
        match punch.status {
            PunchStatus::CheckIn => check_ins += 1,
            PunchStatus::CheckOut => check_outs += 1,
            PunchStatus::BreakOut => break_outs += 1,
            PunchStatus::BreakIn => break_ins += 1,
            PunchStatus::OvertimeIn => overtime_ins += 1,
            PunchStatus::OvertimeOut => overtime_outs += 1,
        }
        users.insert(&punch.user_pin);
        let day_ts = {
            let z = punch.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
            jiff::civil::DateTime::from_parts(
                z.datetime().date(),
                jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
            )
            .to_zoned(jiff::tz::TimeZone::UTC)
            .unwrap()
            .timestamp()
            .as_second()
        };
        *day_counts.entry(day_ts).or_insert(0u64) += 1;
    }

    // ── Employee-day grouping for KPIs ──
    let mut emp_days: std::collections::HashMap<(String, i64), Vec<(i64, String)>> =
        std::collections::HashMap::new();
    let mut emp_names: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    for p in &punches {
        let day_ts = {
            let z = p.timestamp.to_zoned(jiff::tz::TimeZone::UTC);
            jiff::civil::DateTime::from_parts(
                z.datetime().date(),
                jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
            )
            .to_zoned(jiff::tz::TimeZone::UTC)
            .unwrap()
            .timestamp()
            .as_second()
        };
        let status_name = punch_status_name(&p.status);
        emp_days
            .entry((p.user_pin.clone(), day_ts))
            .or_default()
            .push((p.timestamp.as_second(), status_name));
        if let Some(ref name) = p.employee_name {
            emp_names.entry(p.user_pin.clone()).or_insert(name.clone());
        }
    }

    // ── Daily hours breakdown ──
    let mut daily_hours_map: std::collections::BTreeMap<i64, (i64, i64)> =
        std::collections::BTreeMap::new();
    for ((_pin, day), events) in &emp_days {
        let mut sorted: Vec<&(i64, String)> = events.iter().collect();
        sorted.sort_by_key(|(ts, _)| *ts);
        let _regular_secs: i64 = 0;
        let mut check_in_ts: Option<i64> = None;
        for (ts, status) in &sorted {
            match status.as_str() {
                "check_in" | "break_in" | "overtime_in" => {
                    check_in_ts = Some(*ts);
                },
                "check_out" | "break_out" | "overtime_out" => {
                    if let Some(ci) = check_in_ts.take() {
                        let dur = ts - ci;
                        if dur > 0 && dur < 86_400 {
                            let is_overtime = status.as_str() == "overtime_out";
                            if is_overtime {
                                let entry = daily_hours_map.entry(*day).or_default();
                                entry.1 += dur;
                            } else {
                                let entry = daily_hours_map.entry(*day).or_default();
                                entry.0 += dur;
                            }
                        }
                    }
                },
                _ => {},
            }
        }
    }
    let daily_hours: Vec<DailyHoursBreakdown> = daily_hours_map
        .into_iter()
        .map(|(date, (reg, ot))| DailyHoursBreakdown {
            date,
            regular_seconds: reg,
            overtime_seconds: ot,
        })
        .collect();

    // ── Weekly hours ──
    let mut weekly_hours_map: std::collections::BTreeMap<(i16, i8), i64> =
        std::collections::BTreeMap::new();
    for dh in &daily_hours {
        if let Ok(ts) = jiff::Timestamp::from_second(dh.date) {
            let z = ts.to_zoned(jiff::tz::TimeZone::UTC);
            let iso = z.datetime().date().iso_week_date();
            let key = (iso.year(), iso.week());
            *weekly_hours_map.entry(key).or_default() += dh.regular_seconds + dh.overtime_seconds;
        }
    }
    let weekly_hours: Vec<WeeklyHours> = weekly_hours_map
        .into_iter()
        .map(|((year, week), total_seconds)| WeeklyHours { week, year, total_seconds })
        .collect();

    // ── Per-employee KPIs & status distribution ──
    let pins: Vec<String> = users.iter().map(|s| s.to_string()).collect();
    let mut emp_stats: std::collections::HashMap<String, (u32, u32, u32, i64, i64, u32)> =
        std::collections::HashMap::new();
    let mut full_days: u64 = 0;
    let mut half_days: u64 = 0;
    let mut absent_days: u64 = 0;

    for pin in &pins {
        let mut days_present: u32 = 0;
        let mut days_absent: u32 = 0;
        let mut days_late: u32 = 0;
        let mut total_regular: i64 = 0;
        let mut total_overtime: i64 = 0;
        let mut _anomaly_count: u32 = 0;
        let mut days_with_hours: u32 = 0;

        // Check each working day in the range
        let mut cursor = from_date;
        loop {
            if cursor > to_date {
                break;
            }
            let weekday = cursor.weekday().to_monday_zero_offset() as u8 % 7;
            if policy.is_working_day(weekday) {
                let day_start_ts = jiff::civil::DateTime::from_parts(
                    cursor,
                    jiff::civil::Time::new(0, 0, 0, 0).unwrap(),
                )
                .to_zoned(jiff::tz::TimeZone::UTC)
                .unwrap()
                .timestamp()
                .as_second();

                let day_events = emp_days.get(&(pin.clone(), day_start_ts));
                if let Some(events) = day_events {
                    if !events.is_empty() {
                        let mut sorted: Vec<&(i64, String)> = events.iter().collect();
                        sorted.sort_by_key(|(ts, _)| *ts);

                        let mut day_regular: i64 = 0;
                        let mut day_overtime: i64 = 0;
                        let mut check_in_ts: Option<i64> = None;
                        let first_check_in = sorted
                            .iter()
                            .find(|(_, s)| s.as_str() == "check_in")
                            .map(|(ts, _)| *ts);

                        for (ts, status) in &sorted {
                            match status.as_str() {
                                "check_in" | "break_in" => check_in_ts = Some(*ts),
                                "check_out" | "break_out" => {
                                    if let Some(ci) = check_in_ts.take() {
                                        let dur = ts - ci;
                                        if dur > 0 && dur < 86_400 {
                                            day_regular += dur;
                                        }
                                    } else {
                                        _anomaly_count += 1;
                                    }
                                },
                                "overtime_in" => check_in_ts = Some(*ts),
                                "overtime_out" => {
                                    if let Some(ci) = check_in_ts.take() {
                                        let dur = ts - ci;
                                        if dur > 0 && dur < 86_400 {
                                            day_overtime += dur;
                                        }
                                    }
                                },
                                _ => {},
                            }
                        }

                        total_regular += day_regular;
                        total_overtime += day_overtime;
                        days_present += 1;
                        days_with_hours += 1;

                        if day_regular >= policy.min_seconds_for_present {
                            full_days += 1;
                        } else {
                            half_days += 1;
                        }

                        // Late detection
                        if let Some(fci) = first_check_in
                            && let Ok(ts) = jiff::Timestamp::from_second(fci)
                        {
                            let arrival = ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().time();
                            if policy.is_late(arrival) {
                                days_late += 1;
                            }
                        }
                    } else {
                        days_absent += 1;
                        absent_days += 1;
                    }
                } else {
                    days_absent += 1;
                    absent_days += 1;
                }
            }
            cursor = match cursor.tomorrow() {
                Ok(d) => d,
                Err(_) => break,
            };
        }

        emp_stats.insert(
            pin.clone(),
            (days_present, days_absent, days_late, total_regular, total_overtime, days_with_hours),
        );
    }

    let mut employees: Vec<EmployeeReportKpi> = emp_stats
        .into_iter()
        .map(|(pin, (present_d, absent_d, late_d, reg, ot, days_h))| EmployeeReportKpi {
            user_pin: pin.clone(),
            employee_name: emp_names.get(&pin).cloned(),
            days_present: present_d,
            days_absent: absent_d,
            days_late: late_d,
            avg_seconds_per_day: if days_h > 0 { reg / days_h as i64 } else { 0 },
            overtime_seconds: ot,
            anomaly_count: 0, // TODO: Use AttendanceCalculator for anomaly detection
        })
        .collect();
    employees.sort_by_key(|e| -(e.anomaly_count as i64));

    // ── Aggregate KPIs ──
    let avg_seconds_per_day = if !employees.is_empty() && work_days > 0 {
        employees.iter().map(|e| e.avg_seconds_per_day).sum::<i64>() / employees.len() as i64
    } else {
        0
    };
    let overtime_seconds = employees.iter().map(|e| e.overtime_seconds).sum();
    let total_employee_days = full_days + half_days + absent_days;
    let absence_rate = if total_employee_days > 0 {
        absent_days as f64 / total_employee_days as f64 * 100.0
    } else {
        0.0
    };

    let status_distribution = vec![
        AttendanceDistribution {
            status: "full".into(),
            count: full_days,
            percentage: if total_employee_days > 0 {
                full_days as f64 / total_employee_days as f64 * 100.0
            } else {
                0.0
            },
        },
        AttendanceDistribution {
            status: "half".into(),
            count: half_days,
            percentage: if total_employee_days > 0 {
                half_days as f64 / total_employee_days as f64 * 100.0
            } else {
                0.0
            },
        },
        AttendanceDistribution {
            status: "absent".into(),
            count: absent_days,
            percentage: if total_employee_days > 0 {
                absent_days as f64 / total_employee_days as f64 * 100.0
            } else {
                0.0
            },
        },
    ];

    let daily_breakdown: Vec<DailyBreakdown> =
        day_counts.into_iter().map(|(date, count)| DailyBreakdown { date, count }).collect();

    let summary = ReportSummaryResponse {
        date_from: date_from.as_second(),
        date_to: date_to.as_second(),
        total_punches: punches.len() as u64,
        check_ins,
        check_outs,
        break_outs,
        break_ins,
        overtime_ins,
        overtime_outs,
        unique_users: users.len() as u64,
        work_days,
        avg_seconds_per_day,
        overtime_seconds,
        absence_rate,
        daily_hours,
        weekly_hours,
        status_distribution,
        employees,
        daily_breakdown,
    };

    Ok(Json(ApiEnvelope::success(summary)))
}

// ── Punches (Management) ────────────────────────────────────────────

/// Query punches with cursor-based pagination.
#[utoipa::path(
    get,
    path = "/api/punches",
    tag = "Punches",
    security(("bearer_auth" = [])),
    params(PunchListQuery),
    responses(
        (status = 200, description = "Paginated punch records", body = PunchListResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn query_punches_mgmt(
    State(state): State<AppState>,
    Query(q): Query<PunchListQuery>,
) -> Result<Json<ApiEnvelope<PunchListResponse>>, AppError> {
    let (filter, is_cursor) = build_punch_filter(&q);
    let punches = state.storage.query_punches(&filter).await?;

    let responses: Vec<PunchResponse> = punches.iter().map(PunchResponse::from).collect();
    let has_more = responses.len() >= q.params.limit as usize;

    let meta = if has_more {
        if let Some(last) = punches.last() {
            let next_cursor = encode_cursor(last.timestamp.as_second(), &last.id);
            PageMeta::has_more(next_cursor)
        } else {
            PageMeta::single()
        }
    } else {
        if is_cursor {
            PageMeta { has_more: false, next_cursor: None, total: None }
        } else {
            PageMeta::single()
        }
    };

    Ok(Json(ApiEnvelope::paginated(PunchListResponse { punches: responses }, meta)))
}

fn build_punch_filter(q: &PunchListQuery) -> (PunchFilter, bool) {
    let (since, is_cursor) = if let Some(ref cursor) = q.params.cursor {
        match decode_cursor(cursor) {
            Some((ts, _id)) => {
                let ts = jiff::Timestamp::from_second(ts).ok();
                (ts, true)
            },
            None => {
                tracing::warn!(%cursor, "malformed cursor, ignoring");
                (None, false)
            },
        }
    } else if let Some(ts) = q.since {
        (jiff::Timestamp::from_second(ts).ok(), false)
    } else {
        (None, false)
    };

    let until = q.until.and_then(|ts| jiff::Timestamp::from_second(ts).ok());

    let status = q.status.as_deref().and_then(|s| match s {
        "check_in" => Some(timekeep_core::PunchStatus::CheckIn),
        "check_out" => Some(timekeep_core::PunchStatus::CheckOut),
        "break_out" => Some(timekeep_core::PunchStatus::BreakOut),
        "break_in" => Some(timekeep_core::PunchStatus::BreakIn),
        "overtime_in" => Some(timekeep_core::PunchStatus::OvertimeIn),
        "overtime_out" => Some(timekeep_core::PunchStatus::OvertimeOut),
        _ => None,
    });
    let verify_mode = q.verify_mode.as_deref().and_then(|s| match s {
        "password" => Some(timekeep_core::VerifyMode::Password),
        "fingerprint" => Some(timekeep_core::VerifyMode::Fingerprint),
        "card" => Some(timekeep_core::VerifyMode::Card),
        "face" => Some(timekeep_core::VerifyMode::Face),
        "palm" => Some(timekeep_core::VerifyMode::Palm),
        _ => None,
    });
    let anomalies_only = q.anomalies_only.as_deref().map(|s| s == "true");

    let filter = PunchFilter {
        params: q.params.clone(),
        device_sn: q.device_sn.clone(),
        device_sns: q.device_sns.clone(),
        user_pin: q.user_pin.clone(),
        since,
        until,
        status,
        verify_mode,
        anomalies_only,
    };

    (filter, is_cursor)
}
/// Return faceted filter metadata for punches (contextual counts).
///
/// Supports `?dimension=` for a single facet, or returns all dimensions.
/// Context filters (device_sn, since, until, status, etc.) constrain counts.
#[utoipa::path(
    get,
    path = "/api/punches/filters",
    tag = "Punches",
    security(("bearer_auth" = [])),
    params(FacetFilterParams),
    responses(
        (status = 200, description = "Facet metadata for the current filter context"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn punch_filters(
    State(state): State<AppState>,
    Query(q): Query<FacetFilterParams>,
) -> Result<Json<ApiEnvelope<Vec<timekeep_core::FacetGroup>>>, AppError> {
    use timekeep_core::{FacetContext, FacetQuery};

    let status = q.status.as_deref().and_then(|s| match s {
        "check_in" => Some(timekeep_core::PunchStatus::CheckIn),
        "check_out" => Some(timekeep_core::PunchStatus::CheckOut),
        "break_out" => Some(timekeep_core::PunchStatus::BreakOut),
        "break_in" => Some(timekeep_core::PunchStatus::BreakIn),
        "overtime_in" => Some(timekeep_core::PunchStatus::OvertimeIn),
        "overtime_out" => Some(timekeep_core::PunchStatus::OvertimeOut),
        _ => None,
    });

    let verify_mode = q.verify_mode.as_deref().and_then(|s| match s {
        "password" => Some(timekeep_core::VerifyMode::Password),
        "fingerprint" => Some(timekeep_core::VerifyMode::Fingerprint),
        "card" => Some(timekeep_core::VerifyMode::Card),
        "face" => Some(timekeep_core::VerifyMode::Face),
        "palm" => Some(timekeep_core::VerifyMode::Palm),
        _ => None,
    });

    let anomalies_only = q.anomalies_only.as_deref().map(|s| s == "true");

    let context = FacetContext {
        device_sns: q.device_sns.clone().or_else(|| q.device_sn.clone().map(|sn| vec![sn])),
        since: q.since.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        until: q.until.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        status,
        verify_mode,
        anomalies_only,
    };

    let query = FacetQuery {
        dimension: q.dimension.clone(),
        search: q.search.clone(),
        limit: q.limit.clamp(1, 100),
        context,
    };

    let groups = state.storage.punch_facets(&query).await?;
    Ok(Json(ApiEnvelope::success(groups)))
}

/// Manually correct a punch (HR override).
#[utoipa::path(
    post,
    path = "/api/punches/correct",
    tag = "Punches",
    security(("bearer_auth" = [])),
    request_body = CorrectPunchRequest,
    responses(
        (status = 201, description = "Punch corrected", body = PunchCorrectedResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn correct_punch(
    State(state): State<AppState>,
    Json(body): Json<CorrectPunchRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<PunchCorrectedResponse>>), AppError> {
    let status = match body.status.as_str() {
        "check_out" => timekeep_core::PunchStatus::CheckOut,
        "break_out" => timekeep_core::PunchStatus::BreakOut,
        "break_in" => timekeep_core::PunchStatus::BreakIn,
        _ => timekeep_core::PunchStatus::CheckIn,
    };

    let ts = body
        .timestamp
        .and_then(|t| jiff::Timestamp::from_second(t).ok())
        .unwrap_or_else(jiff::Timestamp::now);

    let mut punch = timekeep_core::model::AttendancePunch {
        id: String::new(),
        device_sn: body.device_sn.clone(),
        user_pin: body.user_pin.clone(),
        timestamp: ts,
        status,
        verify_mode: timekeep_core::VerifyMode::Password,
        work_code: None,
        sub_status: None,
        employee_name: None,
        device_label: None,
        raw_data: Some(format!("manual_correction: pin={} status={:?}", body.user_pin, status)),
    };
    punch.id = punch.generate_deduplication_id();

    state.storage.store_punch(&punch).await?;

    state.event_bus.publish(DomainEvent::PunchReceived { punch: punch.clone() });

    let resp = PunchCorrectedResponse::from(&punch);
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(resp))))
}

// ── Punches (Integration) ───────────────────────────────────────────

/// Query punches via integration API (API key auth).
#[utoipa::path(
    get,
    path = "/api/v1/punches",
    tag = "Integration",
    security(("api_key" = [])),
    params(PunchListQuery),
    responses(
        (status = 200, description = "Paginated punch records", body = PunchIntegrationListResponse),
        (status = 401, description = "Invalid or missing API key"),
        (status = 403, description = "API key lacks required permissions"),
    )
)]
pub(crate) async fn query_punches_integration(
    State(state): State<AppState>,
    Query(q): Query<PunchListQuery>,
) -> Result<Json<ApiEnvelope<PunchIntegrationListResponse>>, AppError> {
    let (filter, is_cursor) = build_punch_filter(&q);
    let punches = state.storage.query_punches(&filter).await?;

    let items: Vec<PunchIntegrationResponse> =
        punches.iter().map(PunchIntegrationResponse::from).collect();
    let has_more = items.len() >= q.params.limit as usize;

    let meta = if has_more {
        if let Some(last) = punches.last() {
            let next_cursor = encode_cursor(last.timestamp.as_second(), &last.id);
            PageMeta::has_more(next_cursor)
        } else {
            PageMeta::single()
        }
    } else if is_cursor {
        PageMeta { has_more: false, next_cursor: None, total: None }
    } else {
        PageMeta::single()
    };

    Ok(Json(ApiEnvelope::paginated(PunchIntegrationListResponse { items }, meta)))
}

// ── Device User Management ──────────────────────────────────────────

/// Set a user on a device (enroll via API).
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/users",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    request_body = SetUserRequest,
    responses(
        (status = 200, description = "User enrollment requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn set_user_on_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Json(body): Json<SetUserRequest>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::UserSetRequested {
        device_sn: sn,
        user: timekeep_core::model::User {
            internal_sn: body.internal_sn,
            pin: body.pin,
            name: body.name,
            privilege: body.privilege,
            card_number: body.card_number,
            has_password: body.has_password,
            fingerprint_count: 0,
            has_face: false,
        },
    });
    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Delete a user from a device.
#[utoipa::path(
    delete,
    path = "/api/devices/{sn}/users/{user_sn}",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
        ("user_sn" = String, Path, description = "User serial number on the device"),
    ),
    responses(
        (status = 200, description = "User deletion requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
        (status = 422, description = "Invalid user_sn format"),
    )
)]
pub(crate) async fn delete_user_from_device(
    State(state): State<AppState>,
    Path((sn, user_sn)): Path<(String, String)>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let usn: u16 = user_sn
        .parse()
        .map_err(|_| AppError::validation(format!("user_sn must be a u16, got '{user_sn}'")))?;

    state.event_bus.publish(DomainEvent::UserDeleteRequested { device_sn: sn, user_sn: usn });
    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Enqueue a command for a device (via ADMS push).
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/commands",
    tag = "Commands",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    request_body = EnqueueCommandRequest,
    responses(
        (status = 200, description = "Command enqueued", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn enqueue_device_command(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Json(body): Json<EnqueueCommandRequest>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
        device_sn: sn,
        command: body.command,
    });
    Ok(Json(ApiEnvelope::success(StatusResponse::enqueued())))
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
        async fn store_punch(&self, p: &AttendancePunch) -> Result<(), Error> {
            self.punches.lock().unwrap().push(p.clone());
            Ok(())
        }
        async fn store_punches(&self, p: &[AttendancePunch]) -> Result<u64, Error> {
            let mut g = self.punches.lock().unwrap();
            g.extend_from_slice(p);
            Ok(p.len() as u64)
        }
        async fn query_punches(
            &self,
            _: &timekeep_core::traits::storage::PunchFilter,
        ) -> Result<Vec<AttendancePunch>, Error> {
            Ok(self.punches.lock().unwrap().clone())
        }
        async fn upsert_device(&self, _: &timekeep_core::model::Device) -> Result<(), Error> {
            Ok(())
        }
        async fn upsert_device_config(&self, c: &timekeep_core::DeviceConfig) -> Result<(), Error> {
            let mut d = self.devices.lock().unwrap();
            if let Some(e) = d.iter_mut().find(|x| x.serial_number == c.serial_number) {
                *e = c.clone();
            } else {
                d.push(c.clone());
            }
            Ok(())
        }
        async fn list_device_configs(&self) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
            Ok(self.devices.lock().unwrap().clone())
        }
        async fn delete_device_config(&self, sn: &str) -> Result<(), Error> {
            self.devices.lock().unwrap().retain(|d| d.serial_number != sn);
            Ok(())
        }
        async fn latest_punch_for_device(&self, _: &str) -> Result<Option<jiff::Timestamp>, Error> {
            Ok(None)
        }
        async fn punch_exists(&self, _: &str) -> Result<bool, Error> {
            Ok(false)
        }
        async fn create_api_key(&self, key: &timekeep_core::ApiKey) -> Result<(), Error> {
            self.api_keys.lock().unwrap().push(key.clone());
            Ok(())
        }
        async fn find_api_key_by_hash(
            &self,
            key_hash: &str,
        ) -> Result<Option<timekeep_core::ApiKey>, Error> {
            Ok(self.api_keys.lock().unwrap().iter().find(|k| k.key_hash == key_hash).cloned())
        }
        async fn find_dashboard_user_by_username(
            &self,
            username: &str,
        ) -> Result<Option<timekeep_core::DashboardUser>, Error> {
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
            .route("/api/devices", get(list_devices).post(add_device))
            .route("/api/devices/{sn}", get(get_device).put(update_device).delete(remove_device))
            .route("/api/dashboard/today", get(today_summary))
            .route("/api/punches", get(query_punches_mgmt))
            .route("/api/punches/filters", get(punch_filters))
            .route("/api/punches/correct", post(correct_punch))
            .route("/api/devices/{sn}/users", post(set_user_on_device))
            .route("/api/devices/{sn}/users/{user_sn}", delete(delete_user_from_device))
            .route("/api/devices/{sn}/commands", post(enqueue_device_command))
            .layer(middleware::from_fn_with_state(state.clone(), auth::require_jwt));
        Router::new()
            .route("/api/auth/login", post(login))
            .route("/api/health", get(health_check))
            .route("/api/metrics", get(|| async move { mh.render() }))
            .merge(protected)
            .layer(pl)
            .with_state(state)
    }

    fn admin_token() -> String {
        create_token("admin", timekeep_core::Role::Admin, "test-jwt").unwrap()
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
        let _state = AppState {
            event_bus: EventBus::default(),
            storage: Arc::new(FakeStorage::new()),
            employees: None,
            jwt_secret: String::new(),
            admin_user: String::new(),
            admin_password: String::new(),
            api_key: String::new(),
            device_state: DeviceConnectionState::default(),
            provider_registry: Arc::new(timekeep_core::ProviderRegistry::new()),
            engine_health: EngineHealth::default(),
        };

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
            storage,
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
            .route("/api/v1/health", get(health_check))
            .route("/api/v1/metrics", get(|| async move { mh.render() }))
            .route("/api/v1/punches", get(query_punches_integration))
            .layer(middleware::from_fn_with_state(state.clone(), integration::require_api_key))
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
