//! API key management and export handlers.
//!
//! ## Bounded Context: API Key Administration
//!
//! These handlers live in the management API (JWT auth, port 3000).
//! They follow the same pattern as device handlers: extract state,
//! delegate to storage, return `ApiEnvelope<T>`.
//!
//! ## Security
//!
//! API keys are hashed before storage. The raw key is returned ONLY once
//! at creation time. Listing keys shows metadata (prefix, permissions, dates)
//! but never the hash or raw key.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::{Extension, Json};
use timekeep_core::{ApiKey, PermissionSet};
use uuid::Uuid;

use crate::AppState;
use crate::auth::UserContext;
use crate::dto::*;
use crate::request::*;
use crate::response::*;

// ─── API Key Management ───────────────────────────────────────────────

/// List all API keys (metadata only — no raw keys or hashes exposed).
///
/// Requires: Admin or Operator role.
#[utoipa::path(
    get,
    path = "/api/api-keys",
    tag = "API Keys",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "List of API keys (metadata only)", body = Vec<ApiKeyResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn list_api_keys(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<axum::response::Response, AppError> {
    let keys = state.storage.list_api_keys().await?;
    let responses: Vec<ApiKeyResponse> = keys.iter().map(ApiKeyResponse::from).collect();
    let total = responses.len() as u64;
    crate::response::build_sparse_envelope(responses, PageMeta::with_total(total), &params.fields)
}

/// Get a single API key by ID (metadata only — no raw key or hash exposed).
///
/// Requires: Operator+ role.
#[utoipa::path(
    get,
    path = "/api/api-keys/{id}",
    tag = "API Keys",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "API key UUID"),
    ),
    responses(
        (status = 200, description = "API key metadata", body = ApiKeyResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
        (status = 404, description = "API key not found"),
    )
)]
pub(crate) async fn get_api_key(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<ApiKeyResponse>>, AppError> {
    let keys = state.storage.list_api_keys().await?;
    let key = keys
        .into_iter()
        .find(|k| k.id == id)
        .ok_or_else(|| AppError::not_found(format!("api key '{id}' not found")))?;

    Ok(Json(ApiEnvelope::success(ApiKeyResponse::from(&key))))
}

/// Create a new API key for an integration partner.
///
/// The raw key is returned ONCE in the response. It is not stored in
/// plaintext — only the SHA-256 hash is persisted.
///
/// Requires: Admin role.
#[utoipa::path(
    post,
    path = "/api/api-keys",
    tag = "API Keys",
    security(("bearer_auth" = [])),
    request_body = CreateApiKeyRequest,
    responses(
        (status = 201, description = "API key created — raw key returned ONCE", body = ApiKeyCreatedResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error (e.g., invalid permissions)"),
    )
)]
pub(crate) async fn create_api_key(
    State(state): State<AppState>,
    Extension(user): Extension<UserContext>,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<ApiKeyCreatedResponse>>), AppError> {
    // Validate
    if body.name.trim().is_empty() {
        return Err(AppError::validation("name is required"));
    }

    let permissions = PermissionSet::from_space_separated(&body.permissions);
    if permissions.is_empty() {
        return Err(AppError::validation(
            "permissions must contain at least one valid permission (e.g. 'read:punches')",
        ));
    }

    // Generate the key
    let env = std::env::var("TIMEKEEP_ENV").unwrap_or_else(|_| "dev".into());
    let raw_key = ApiKey::generate_key_string(&env);
    let prefix = ApiKey::prefix_from_key(&raw_key);
    let key_hash = ApiKey::hash_key(&raw_key);

    let now = jiff::Timestamp::now();
    let expires_at = body
        .expires_in_days
        .and_then(|days| jiff::Timestamp::from_second(now.as_second() + days as i64 * 86400).ok());

    let api_key = ApiKey {
        id: Uuid::now_v7().to_string(),
        name: body.name.clone(),
        key_hash,
        prefix,
        permissions,
        created_by: user.username.clone(),
        created_at: now,
        last_used_at: None,
        expires_at,
        revoked: false,
    };

    state.storage.create_api_key(&api_key).await?;

    tracing::info!(
        name = %body.name,
        created_by = %user.username,
        permissions = %api_key.permissions.to_space_separated(),
        "API key created"
    );

    let response = ApiKeyCreatedResponse { key: ApiKeyResponse::from(&api_key), api_key: raw_key };

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(response))))
}

/// Revoke an API key (soft delete — sets `revoked = true`).
///
/// Requires: Admin role.
#[utoipa::path(
    delete,
    path = "/api/api-keys/{id}",
    tag = "API Keys",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "API key UUID"),
    ),
    responses(
        (status = 200, description = "API key revoked", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn revoke_api_key(
    State(state): State<AppState>,
    Path(key_id): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.storage.revoke_api_key(&key_id).await?;

    tracing::info!(key_id = %key_id, "API key revoked");

    Ok(Json(ApiEnvelope::success(StatusResponse::deleted())))
}

// ─── Export ───────────────────────────────────────────────────────────

/// Export punches as CSV or XLSX.
///
/// Query parameters are the same as `GET /api/punches`:
/// `device_sn`, `user_pin`, `since`, `until`, `limit`, `sort_order`.
///
/// Format is specified via `?format=csv` (default) or `?format=xlsx`.
///
/// The response is a file download with appropriate Content-Type and
/// Content-Disposition headers — NOT wrapped in `ApiEnvelope`.
///
/// Requires: At least Viewer role.
#[utoipa::path(
    get,
    path = "/api/exports/punches",
    tag = "Export",
    security(("bearer_auth" = [])),
    params(ExportQueryParams),
    responses(
        (status = 200, description = "CSV or XLSX file download", content_type = "application/octet-stream"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn export_punches(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<ExportQueryParams>,
) -> Result<ExportResponse, AppError> {
    use timekeep_core::PunchFilter;

    let filter = PunchFilter {
        device_sns: params.device_sns.as_ref().map(|s| {
            s.split(',').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect()
        }),
        user_pins: params.user_pins.as_ref().map(|s| {
            s.split(',').map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect()
        }),
        since: params.since.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        until: params.until.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        status: None,
        statuses: None,
        verify_mode: None,
        anomalies_only: None,
        ids: None,
        cursor_after: None,
        unlimited: false,
        params: timekeep_core::ListParams {
            sort_by: Some("timestamp".into()),
            sort_order: params.sort_order.unwrap_or(timekeep_core::SortOrder::Desc),
            limit: params.limit.unwrap_or(10000).min(50000),
            ..Default::default()
        },
    };

    let punches = state.storage.query_punches(&filter).await?;

    let format = params.format.unwrap_or(ExportFormat::Csv);

    tracing::info!(
        format = ?format,
        count = punches.len(),
        "generating export"
    );

    match format {
        ExportFormat::Csv => export_as_csv(&punches),
        ExportFormat::Xlsx => export_as_xlsx(&punches),
    }
}

fn export_as_csv(punches: &[timekeep_core::AttendancePunch]) -> Result<ExportResponse, AppError> {
    let mut wtr = csv::Writer::from_writer(Vec::new());

    // Header row
    wtr.write_record([
        "id",
        "device_sn",
        "user_pin",
        "employee_name",
        "timestamp",
        "timestamp_iso",
        "status",
        "verify_mode",
        "work_code",
    ])
    .map_err(|e| AppError::Internal(e.to_string()))?;

    for punch in punches {
        let ts = punch.timestamp;
        let iso = {
            let zoned = ts.to_zoned(jiff::tz::TimeZone::UTC);
            zoned.datetime().to_string()
        };

        wtr.write_record(&[
            punch.id.clone(),
            punch.device_sn.clone(),
            punch.user_pin.clone(),
            punch.employee_name.clone().unwrap_or_default(),
            ts.as_second().to_string(),
            iso,
            punch.status.to_string(),
            punch.verify_mode.name().to_string(),
            punch.work_code.clone().unwrap_or_default(),
        ])
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    let data = wtr.into_inner().map_err(|e| AppError::Internal(e.to_string()))?;

    let now = jiff::Timestamp::now().as_second();
    let filename = format!("punches_export_{now}.csv");

    Ok(ExportResponse { data, filename, content_type: "text/csv; charset=utf-8" })
}

fn export_as_xlsx(punches: &[timekeep_core::AttendancePunch]) -> Result<ExportResponse, AppError> {
    use rust_xlsxwriter::*;

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Header style
    let header_format = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0x4A90D9))
        .set_font_color(Color::White)
        .set_border(FormatBorder::Thin);

    // Data format
    let date_format = Format::new().set_num_format("yyyy-mm-dd hh:mm:ss");

    // Write header
    let headers =
        ["ID", "Device", "User PIN", "Employee", "Timestamp", "Status", "Verify Mode", "Work Code"];

    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    // Set column widths
    worksheet.set_column_width(0, 38).map_err(|e| AppError::Internal(e.to_string()))?; // ID
    worksheet.set_column_width(1, 20).map_err(|e| AppError::Internal(e.to_string()))?; // Device
    worksheet.set_column_width(2, 12).map_err(|e| AppError::Internal(e.to_string()))?; // User PIN
    worksheet.set_column_width(3, 25).map_err(|e| AppError::Internal(e.to_string()))?; // Employee
    worksheet.set_column_width(4, 22).map_err(|e| AppError::Internal(e.to_string()))?; // Timestamp
    worksheet.set_column_width(5, 15).map_err(|e| AppError::Internal(e.to_string()))?; // Status
    worksheet.set_column_width(6, 15).map_err(|e| AppError::Internal(e.to_string()))?; // Verify
    worksheet.set_column_width(7, 12).map_err(|e| AppError::Internal(e.to_string()))?; // Work Code

    // Write data rows
    for (row_idx, punch) in punches.iter().enumerate() {
        let row = (row_idx + 1) as u32;
        let ts = punch.timestamp;

        // Convert to Excel datetime via Unix timestamp
        let excel_dt = ExcelDateTime::from_timestamp(ts.as_second())
            .map_err(|e| AppError::Internal(format!("Excel datetime: {e}")))?;

        worksheet.write_string(row, 0, &punch.id).map_err(|e| AppError::Internal(e.to_string()))?;
        worksheet
            .write_string(row, 1, &punch.device_sn)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        worksheet
            .write_string(row, 2, &punch.user_pin)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        worksheet
            .write_string(row, 3, punch.employee_name.as_deref().unwrap_or(""))
            .map_err(|e| AppError::Internal(e.to_string()))?;
        worksheet
            .write_datetime_with_format(row, 4, &excel_dt, &date_format)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        worksheet
            .write_string(row, 5, punch.status.to_string())
            .map_err(|e| AppError::Internal(e.to_string()))?;
        worksheet
            .write_string(row, 6, punch.verify_mode.name())
            .map_err(|e| AppError::Internal(e.to_string()))?;
        worksheet
            .write_string(row, 7, punch.work_code.as_deref().unwrap_or(""))
            .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    let data = workbook.save_to_buffer().map_err(|e| AppError::Internal(e.to_string()))?;

    let now = jiff::Timestamp::now().as_second();
    let filename = format!("punches_export_{now}.xlsx");

    Ok(ExportResponse {
        data,
        filename,
        content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
}

// ─── Settings (Integration Configuration) ────────────────────────────

// ── Integration Endpoints ────────────────────────────────────────────

/// List all integration endpoints with search, sort, and pagination.
///
/// Requires: At least Viewer role.
#[utoipa::path(
    get,
    path = "/api/endpoints",
    tag = "Integration Endpoints",
    security(("bearer_auth" = [])),
    params(timekeep_core::ListParams),
    responses(
        (status = 200, description = "List of integration endpoints", body = Vec<EndpointResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_endpoints(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<axum::response::Response, AppError> {
    use timekeep_core::EndpointFilter;

    let __fields = params.fields.clone();
    let filter = EndpointFilter { params };
    let result = state.storage.list_endpoints_filtered(&filter).await?;
    let responses: Vec<EndpointResponse> =
        result.items.iter().map(EndpointResponse::from).collect();

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    crate::response::build_sparse_envelope(responses, meta, &__fields)
}

/// Get a single integration endpoint by ID.
///
/// Requires: Viewer+ role.
#[utoipa::path(
    get,
    path = "/api/endpoints/{id}",
    tag = "Integration Endpoints",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Endpoint UUID"),
    ),
    responses(
        (status = 200, description = "Endpoint details", body = EndpointResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Endpoint not found"),
    )
)]
pub(crate) async fn get_endpoint(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<EndpointResponse>>, AppError> {
    let all = state.storage.list_endpoints().await?;
    let endpoint = all
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| AppError::not_found(format!("endpoint '{id}' not found")))?;

    Ok(Json(ApiEnvelope::success(EndpointResponse::from(&endpoint))))
}

/// Create a new integration endpoint.
///
/// Takes a `kind` and `name`. The endpoint starts disabled with
/// default config for its kind. Use the update endpoint to set
/// real connection details.
///
/// Requires: Admin role.
#[utoipa::path(
    post,
    path = "/api/endpoints",
    tag = "Integration Endpoints",
    security(("bearer_auth" = [])),
    request_body = CreateEndpointRequest,
    responses(
        (status = 201, description = "Endpoint created", body = EndpointResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin required"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn create_endpoint(
    State(state): State<AppState>,
    Json(body): Json<CreateEndpointRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<EndpointResponse>>), AppError> {
    if body.name.trim().is_empty() {
        return Err(AppError::validation("name is required"));
    }

    let kind = body.kind;

    let mut endpoint = timekeep_core::IntegrationEndpoint::new(body.name, kind);

    // Apply optional config overrides from the request
    if let Some(config) = body.config {
        endpoint.config = config;
    }

    state.storage.create_endpoint(&endpoint).await?;

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(EndpointResponse::from(&endpoint)))))
}

/// Update an integration endpoint (full replace).
///
/// All fields are optional — omitted fields keep their current values.
///
/// Requires: Admin role.
#[utoipa::path(
    put,
    path = "/api/endpoints/{id}",
    tag = "Integration Endpoints",
    security(("bearer_auth" = [])),
    request_body = UpdateEndpointRequest,
    responses(
        (status = 200, description = "Endpoint updated", body = EndpointResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin required"),
        (status = 404, description = "Endpoint not found"),
    )
)]
pub(crate) async fn update_endpoint(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateEndpointRequest>,
) -> Result<Json<ApiEnvelope<EndpointResponse>>, AppError> {
    // Fetch existing endpoints to find the one we're updating
    let all = state.storage.list_endpoints().await?;
    let mut endpoint = all
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| AppError::not_found(format!("endpoint '{id}' not found")))?;

    if let Some(name) = body.name {
        if name.trim().is_empty() {
            return Err(AppError::validation("name must not be empty"));
        }
        endpoint.name = name;
    }
    if let Some(enabled) = body.enabled {
        endpoint.enabled = enabled;
    }
    if let Some(config) = body.config {
        endpoint.config = config;
    }
    endpoint.updated_at = jiff::Timestamp::now().as_second();

    state.storage.update_endpoint(&endpoint).await?;

    Ok(Json(ApiEnvelope::success(EndpointResponse::from(&endpoint))))
}

/// Delete an integration endpoint.
///
/// Requires: Admin role.
#[utoipa::path(
    delete,
    path = "/api/endpoints/{id}",
    tag = "Integration Endpoints",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Endpoint deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin required"),
        (status = 404, description = "Endpoint not found"),
    )
)]
pub(crate) async fn delete_endpoint(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.storage.delete_endpoint(&id).await?;
    Ok(Json(ApiEnvelope::success(StatusResponse::deleted())))
}

// ── System Settings ──────────────────────────────────────────────────

/// Get system-wide settings (polling, auto-discover).
///
/// Requires: At least Viewer role.
#[utoipa::path(
    get,
    path = "/api/settings",
    tag = "Settings",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Current system settings", body = SystemSettingsResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<SystemSettingsResponse>>, AppError> {
    let settings = state.storage.get_system_settings().await?;
    Ok(Json(ApiEnvelope::success(SystemSettingsResponse::from(&settings))))
}

/// Update system-wide settings.
///
/// Accepts a partial update — only the fields provided are changed.
///
/// Requires: Admin role.
#[utoipa::path(
    put,
    path = "/api/settings",
    tag = "Settings",
    security(("bearer_auth" = [])),
    request_body = UpdateSystemSettingsRequest,
    responses(
        (status = 200, description = "Settings updated", body = SystemSettingsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin required"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn update_settings(
    State(state): State<AppState>,
    Json(body): Json<UpdateSystemSettingsRequest>,
) -> Result<Json<ApiEnvelope<SystemSettingsResponse>>, AppError> {
    let mut current = state.storage.get_system_settings().await?;

    // Track what changed for the domain event
    let mut changed: Vec<String> = Vec::new();
    let wp_changed = body.work_policy.is_some();

    if let Some(v) = body.poll_interval_secs {
        if v < 5 {
            return Err(AppError::validation("poll_interval_secs must be >= 5"));
        }
        current.poll_interval_secs = v;
    }
    if let Some(v) = body.auto_discover {
        current.auto_discover = v;
    }
    if let Some(wp) = body.work_policy {
        if let Some(v) = wp.work_start {
            current.work_policy.work_start = parse_time(&v)?;
        }
        if let Some(v) = wp.work_end {
            current.work_policy.work_end = parse_time(&v)?;
        }
        if let Some(v) = wp.late_threshold_minutes {
            current.work_policy.late_threshold_secs = v * 60;
        }
        if let Some(v) = wp.min_hours_for_full_day {
            current.work_policy.min_seconds_for_present = (v * 3600.0) as i64;
        }
        if let Some(v) = wp.daily_overtime_after_hours {
            current.work_policy.daily_overtime_after_secs = (v * 3600.0) as i64;
        }
        if let Some(v) = wp.working_days {
            current.work_policy.working_days = v;
        }
    }

    if let Some(email) = body.support_email {
        current.support_email = email;
        changed.push("support_email".into());
    }
    if let Some(wn) = body.workspace_name {
        current.workspace_name = wn;
        changed.push("workspace_name".into());
    }

    state.storage.upsert_system_settings(&current).await?;

    // Publish settings-changed domain event for audit trail
    if body.poll_interval_secs.is_some() {
        changed.push("poll_interval_secs".into());
    }
    if body.auto_discover.is_some() {
        changed.push("auto_discover".into());
    }
    if wp_changed {
        changed.push("work_policy".into());
    }
    if !changed.is_empty() {
        state
            .event_bus
            .publish(timekeep_core::DomainEvent::SettingsChanged { changed_fields: changed });
    }

    Ok(Json(ApiEnvelope::success(SystemSettingsResponse::from(&current))))
}

// ─── Settings helpers ────────────────────────────────────────────────

/// Parse a "HH:MM" string into a jiff::civil::Time.
fn parse_time(s: &str) -> Result<jiff::civil::Time, AppError> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::validation(format!("invalid time format '{s}', expected HH:MM")));
    }
    let hour: i8 =
        parts[0].parse().map_err(|_| AppError::validation(format!("invalid hour in '{s}'")))?;
    let minute: i8 =
        parts[1].parse().map_err(|_| AppError::validation(format!("invalid minute in '{s}'")))?;
    jiff::civil::Time::new(hour, minute, 0, 0)
        .map_err(|e| AppError::validation(format!("invalid time '{s}': {e}")))
}

// ─── Audit Log ──────────────────────────────────────────────────────

/// Query audit logs with filters and pagination.
///
/// Every authenticated write operation is automatically recorded.
/// Requires: At least Viewer role.
#[utoipa::path(
    get,
    path = "/api/audit",
    tag = "Audit",
    security(("bearer_auth" = [])),
    params(AuditListQuery),
    responses(
        (status = 200, description = "Paginated audit log entries", body = Vec<AuditEventResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn query_audit(
    State(state): State<AppState>,
    Query(params): Query<AuditListQuery>,
) -> Result<axum::response::Response, AppError> {
    use timekeep_core::AuditFilter;

    let __fields = params.fields.clone();
    let filter = AuditFilter {
        actor: params.actor,
        action: params.action,
        resource: params.resource,
        since: params.since.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        until: params.until.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        search: params.search,
        sort_by: params.sort_by,
        sort_order: params.sort_order,
        limit: params.limit.clamp(1, 200),
        cursor: params.cursor,
    };

    let result = state.storage.query_audit_logs(&filter).await?;
    let items: Vec<AuditEventResponse> =
        result.items.iter().map(AuditEventResponse::from).collect();

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    crate::response::build_sparse_envelope(items, meta, &__fields)
}

/// Get a single audit event by ID.
///
/// Requires: Viewer+ role.
#[utoipa::path(
    get,
    path = "/api/audit/{id}",
    tag = "Audit",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Audit event UUID"),
    ),
    responses(
        (status = 200, description = "Audit event details", body = AuditEventResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Audit event not found"),
    )
)]
pub(crate) async fn get_audit_event(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<AuditEventResponse>>, AppError> {
    let event = state
        .storage
        .get_audit_event(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("audit event '{id}' not found")))?;

    Ok(Json(ApiEnvelope::success(AuditEventResponse::from(&event))))
}

/// Return the entity schema for audit logs.
#[utoipa::path(
    get,
    path = "/api/audit/schema",
    tag = "Audit",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Audit entity schema metadata", body = timekeep_core::EntitySchema),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn audit_schema() -> Json<ApiEnvelope<timekeep_core::EntitySchema>> {
    Json(ApiEnvelope::success(timekeep_core::AUDIT_SCHEMA.clone()))
}

/// Return faceted filter metadata for audit logs.
#[utoipa::path(
    get,
    path = "/api/audit/filters",
    tag = "Audit",
    security(("bearer_auth" = [])),
    params(crate::request::GenericFacetParams),
    responses(
        (status = 200, description = "Audit facet metadata"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn audit_filters(
    State(state): State<AppState>,
    Query(q): Query<crate::request::GenericFacetParams>,
) -> Result<Json<ApiEnvelope<Vec<timekeep_core::FacetGroup>>>, AppError> {
    use std::collections::HashMap;
    use timekeep_core::{FacetContext, FacetQuery};

    let mut filters = HashMap::new();
    if let Some(ref v) = q.actor {
        filters.insert("actor".to_string(), vec![v.clone()]);
    }
    if let Some(ref v) = q.action {
        filters.insert("action".to_string(), vec![v.clone()]);
    }
    if let Some(ref v) = q.status {
        filters.insert("status".to_string(), vec![v.clone()]);
    }

    let query = FacetQuery {
        dimension: q.dimension.clone(),
        search: q.search.clone(),
        limit: q.limit.clamp(1, 100),
        context: FacetContext { filters, ..FacetContext::default() },
    };

    let groups = state.storage.audit_facets(&query).await?;
    Ok(Json(ApiEnvelope::success(groups)))
}
