//! Auth/setup/health handlers for the management API.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;

use crate::app_state::AppState;
use crate::dto::{
    AboutResponse, ClientConfigResponse, DeviceHealthInfo, EngineHealthStats, HealthResponse,
    LoginResponse, SetupCompletedResponse, SetupStatusResponse,
};
use crate::middleware::jwt::{JWT_EXPIRY_HOURS, create_token};
use crate::request::{LoginRequest, SetupRequest};
use crate::response::{ApiEnvelope, AppError};

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

/// Public endpoint — returns app name, version, and support contact.
///
/// No authentication required. Used by the frontend footer and
/// error pages to display where users can get help.
#[utoipa::path(
    get,
    path = "/api/about",
    tag = "About",
    responses(
        (status = 200, description = "Application info + support contact", body = AboutResponse),
    )
)]
pub(crate) async fn about(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<crate::dto::AboutResponse>>, AppError> {
    let settings = state.storage.get_system_settings().await.unwrap_or_default();
    Ok(Json(ApiEnvelope::success(crate::dto::AboutResponse {
        name: "timekeep".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        support_email: settings.support_email,
        workspace_name: settings.workspace_name,
    })))
}

/// Bootstrap / client-config — single public endpoint that aggregates
/// everything the frontend needs before authentication.
///
/// Returns workspace branding, version, support contact, and whether
/// initial setup is needed. The frontend stores this in a Jotai atom
/// and uses it on the login page, setup page, and app shell (sidebar
/// workspace name) without additional round-trips.
///
/// Extensible: add `features: HashMap<String, bool>` for feature flags
/// driven by server-side configuration.
#[utoipa::path(
    get,
    path = "/api/client-config",
    tag = "Config",
    responses(
        (status = 200, description = "Client bootstrap configuration", body = ClientConfigResponse),
    )
)]
pub(crate) async fn client_config(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<ClientConfigResponse>>, AppError> {
    let settings = state.storage.get_system_settings().await.unwrap_or_default();

    let setup_needed = state
        .storage
        .list_dashboard_users(&timekeep_core::ListParams::default())
        .await
        .map(|r| r.items.is_empty())
        .unwrap_or(true);

    Ok(Json(ApiEnvelope::success(ClientConfigResponse {
        name: "timekeep".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        workspace_name: settings.workspace_name,
        support_email: settings.support_email,
        setup_needed,
    })))
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

    // Seed default system settings so the engine + attendance queries work
    // without requiring the admin to manually configure settings first.
    let mut default_settings = timekeep_core::SystemSettings::default();
    if let Some(ref wn) = body.workspace_name {
        default_settings.workspace_name = wn.clone();
    }
    match state.storage.upsert_system_settings(&default_settings).await {
        Ok(()) => {
            tracing::info!("default system settings seeded");
        },
        Err(e) => {
            // Non-critical: the system falls back to defaults at query time.
            // Log a warning so the operator knows to configure manually.
            tracing::warn!(error = %e, "failed to seed default system settings — configure via PUT /api/settings");
        },
    }

    tracing::info!(
        username = %user.username,
        "initial admin user created via setup endpoint"
    );

    // Publish setup domain event for audit trail
    state.event_bus.publish(timekeep_core::DomainEvent::SetupCompleted {
        admin_username: user.username.clone(),
    });

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
