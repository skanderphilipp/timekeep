//! Punch query and correction handlers for both management and integration APIs.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;

use crate::app_state::AppState;
use crate::dto::{
    PunchCorrectedResponse, PunchIntegrationListResponse, PunchIntegrationResponse,
    PunchListResponse, PunchResponse,
};
use crate::request::{CorrectPunchRequest, FacetFilterParams, PunchListQuery};
use crate::response::{ApiEnvelope, AppError, PageMeta};
use crate::routes::dashboard::resolve_policies_for_pins;
use timekeep_core::PUNCH_SCHEMA;
use timekeep_core::PunchFilter;
use timekeep_core::events::DomainEvent;
use timekeep_core::query::cursor::{Cursor, CursorValue};
use timekeep_core::services::attendance_calculator::AttendanceCalculator;

/// Get a single punch by its deduplication ID.
#[utoipa::path(
    get,
    path = "/api/punches/{id}",
    tag = "Punches",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Punch deduplication ID (hex string)"),
    ),
    responses(
        (status = 200, description = "Punch details", body = PunchResponse),
        (status = 404, description = "Punch not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn get_punch(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<PunchResponse>>, AppError> {
    let punch = state
        .storage
        .get_punch(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("punch '{id}'")))?;

    Ok(Json(ApiEnvelope::success(PunchResponse::from(&punch))))
}

/// Query punches with cursor-based pagination (management API).
///
/// Supports sparse field selection via `?fields=` and eager-loaded relationships
/// via `?include=`. When no field selector is active, returns the full
/// `PunchResponse` schema.
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
) -> Result<axum::response::Response, AppError> {
    // ── Tantivy full-text search path ────────────────────────────
    if q.q.as_ref().is_some_and(|s| !s.trim().is_empty()) {
        return query_punches_via_search(&state, &q).await;
    }

    // ── Legacy SQL path ─────────────────────────────────────────
    let anomalies_only = q.anomalies_only.as_deref() == Some("true");
    let filter = build_punch_filter(&q);
    let is_cursor = filter.cursor_after.is_some();

    // When filtering by anomalies, we cannot rely on the SQL `is_anomaly`
    // column alone because anomaly flags are computed in-memory during
    // pairing and not pre-persisted. Fetch all punches matching the other
    // criteria, then compute anomalies and filter in the app layer.
    let punches = if anomalies_only {
        // Build a filter without anomalies_only so SQL returns all candidates
        let mut broad_filter = filter.clone();
        broad_filter.anomalies_only = None;
        let mut punches = state.storage.query_punches(&broad_filter).await?;

        // Compute per-employee work days to detect anomalies
        let org_policy = crate::helpers::org_work_policy(&*state.storage).await;
        let unique_pins = crate::helpers::unique_pins(&punches);
        let policy_map = resolve_policies_for_pins(
            &*state.storage,
            state.employees.as_deref(),
            &unique_pins,
            &org_policy,
        )
        .await;
        let work_days =
            AttendanceCalculator::compute_work_days_per_pin(&punches, &policy_map, &org_policy);

        // Mark anomalous punches in-place
        AttendanceCalculator::annotate_punches_with_anomalies(&work_days, &mut punches);

        // Keep only punches flagged as anomalous
        punches.retain(|p| p.is_anomaly);
        punches
    } else {
        state.storage.query_punches(&filter).await?
    };

    let responses: Vec<PunchResponse> = punches.iter().map(PunchResponse::from).collect();
    let has_more = responses.len() >= q.params.limit as usize;

    let meta = if has_more {
        if let Some(last) = punches.last() {
            let next_cursor = build_next_punch_cursor(last, q.params.sort_by.as_deref());
            PageMeta::has_more(next_cursor)
        } else {
            PageMeta::single()
        }
    } else if is_cursor {
        PageMeta { has_more: false, next_cursor: None, total: None }
    } else {
        PageMeta::single()
    };

    crate::response::build_sparse_envelope(
        PunchListResponse { punches: responses },
        meta,
        &q.params.fields,
    )
}

/// Query punches through Tantivy full-text search.
async fn query_punches_via_search(
    state: &AppState,
    q: &PunchListQuery,
) -> Result<axum::response::Response, AppError> {
    let search_term = q.q.as_deref().unwrap_or("");

    let search_query = timekeep_core::SearchQuery {
        q: search_term.to_string(),
        entity_type: Some("punch".to_string()),
        limit: q.params.clamped_limit(),
        offset: 0,
    };

    let results = match &state.search {
        Some(search) => search
            .search(&search_query)
            .await
            .map_err(|e| AppError::Internal(format!("search failed: {e}")))?,
        None => {
            let filter = build_punch_filter(q);
            let punches = state.storage.query_punches(&filter).await?;
            let responses: Vec<PunchResponse> = punches.iter().map(PunchResponse::from).collect();
            return crate::response::build_sparse_envelope(
                PunchListResponse { punches: responses },
                PageMeta::single(),
                &q.params.fields,
            );
        },
    };

    let ids: Vec<String> = results.hits.iter().map(|h| h.entity_id.clone()).collect();

    if ids.is_empty() {
        return crate::response::build_sparse_envelope(
            PunchListResponse { punches: vec![] },
            PageMeta::single(),
            &q.params.fields,
        );
    }

    let filter = PunchFilter {
        ids: Some(ids),
        params: timekeep_core::ListParams { limit: q.params.clamped_limit(), ..Default::default() },
        ..Default::default()
    };

    let punches = state.storage.query_punches(&filter).await?;
    let responses: Vec<PunchResponse> = punches.iter().map(PunchResponse::from).collect();
    let has_more = results.has_more;
    let meta = if has_more { PageMeta::has_more(String::new()) } else { PageMeta::single() };

    crate::response::build_sparse_envelope(
        PunchListResponse { punches: responses },
        meta,
        &q.params.fields,
    )
}

/// Split a comma-separated string into a Vec, trimming whitespace.
/// Returns None for empty input.
fn split_csv(input: &Option<String>) -> Option<Vec<String>> {
    input.as_ref().map(|s| {
        s.split(',').map(|part| part.trim().to_string()).filter(|p| !p.is_empty()).collect()
    })
}

/// Build a PunchFilter from a PunchListQuery.
pub(crate) fn build_punch_filter(q: &PunchListQuery) -> PunchFilter {
    let cursor_after = q.params.cursor.as_deref().and_then(Cursor::decode);

    let since = q.since.and_then(|ts| jiff::Timestamp::from_second(ts).ok());
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

    PunchFilter {
        params: q.params.clone(),
        device_sns: split_csv(&q.device_sns),
        user_pins: split_csv(&q.user_pins),
        since,
        until,
        status,
        statuses: None,
        verify_mode,
        anomalies_only,
        ids: None,
        cursor_after,
        unlimited: false,
    }
}

fn build_next_punch_cursor(
    last: &timekeep_core::model::AttendancePunch,
    sort_by: Option<&str>,
) -> String {
    let cursor_cols = PUNCH_SCHEMA.cursor_columns(sort_by);

    let values: Vec<CursorValue> = cursor_cols
        .iter()
        .map(|(field, _sql_expr, _type)| match *field {
            "timestamp" => CursorValue::Int(last.timestamp.as_second()),
            "id" => CursorValue::Text(last.id.clone()),
            "user_pin" => CursorValue::Text(last.user_pin.clone()),
            "device_sn" => CursorValue::Text(last.device_sn.clone()),
            "status" => CursorValue::Int(last.status as i64),
            _ => {
                tracing::warn!(field, "unknown cursor column, using empty text");
                CursorValue::Text(String::new())
            },
        })
        .collect();

    Cursor::from_values(values).encode()
}

#[utoipa::path(
    get,
    path = "/api/punches/schema",
    tag = "Punches",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Entity schema metadata", body = timekeep_core::EntitySchema),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn punch_schema() -> Json<ApiEnvelope<timekeep_core::EntitySchema>> {
    Json(ApiEnvelope::success(timekeep_core::PUNCH_SCHEMA.clone()))
}

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
        device_sns: split_csv(&q.device_sns),
        since: q.since.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        until: q.until.and_then(|ts| jiff::Timestamp::from_second(ts).ok()),
        status,
        verify_mode,
        anomalies_only,
        filters: std::collections::HashMap::new(),
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
        "check_in" => timekeep_core::PunchStatus::CheckIn,
        "check_out" => timekeep_core::PunchStatus::CheckOut,
        "break_out" => timekeep_core::PunchStatus::BreakOut,
        "break_in" => timekeep_core::PunchStatus::BreakIn,
        other => {
            return Err(AppError::validation(format!(
                "invalid punch status '{other}'. Valid statuses: check_in, check_out, break_out, break_in"
            )));
        },
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
        local_time: None,
        time_offset_secs: None,
        timezone_name: None,
        status,
        verify_mode: timekeep_core::VerifyMode::Password,
        work_code: None,
        sub_status: None,
        employee_name: None,
        device_label: None,
        is_anomaly: false,
        anomaly_type: None,
        raw_data: Some(format!("manual_correction: pin={} status={:?}", body.user_pin, status)),
    };
    punch.id = punch.generate_deduplication_id();

    state.storage.store_punch(&punch).await?;

    state.event_bus.publish(DomainEvent::PunchReceived { punch: punch.clone() });

    let resp = PunchCorrectedResponse::from(&punch);
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(resp))))
}

// ── Punches (Integration) ───────────────────────────────────────────

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
    let filter = build_punch_filter(&q);
    let is_cursor = filter.cursor_after.is_some();
    let punches = state.storage.query_punches(&filter).await?;

    let items: Vec<PunchIntegrationResponse> =
        punches.iter().map(PunchIntegrationResponse::from).collect();
    let has_more = items.len() >= q.params.limit as usize;

    let meta = if has_more {
        if let Some(last) = punches.last() {
            let next_cursor = build_next_punch_cursor(last, q.params.sort_by.as_deref());
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
