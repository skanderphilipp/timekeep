//! Work policy template management endpoints.
//!
//! Work policy templates are named, reusable shift configurations.
//! Departments reference them via `work_policy_id` FK.
//!
//! ## Endpoints
//!
//! | Method | Path | Auth | Description |
//! |--------|------|------|-------------|
//! | GET | /api/work-policies | Viewer | List all templates |
//! | GET | /api/work-policies/{id} | Viewer | Get single template |
//! | POST | /api/work-policies | Admin | Create template |
//! | PUT | /api/work-policies/{id} | Admin | Update template |
//! | DELETE | /api/work-policies/{id} | Admin | Delete template |
//! | GET | /api/work-policies/schema | Viewer | Column metadata |
//! | GET | /api/work-policies/filters | Viewer | Faceted filter metadata |

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};

use crate::AppState;
use crate::dto::WorkPolicyTemplateResponse;
use crate::request::{CreateWorkPolicyTemplateRequest, UpdateWorkPolicyTemplateRequest};
use crate::response::{ApiEnvelope, AppError};

/// Parse an "HH:MM" string into a `jiff::civil::Time`.
fn parse_time(s: &str) -> Result<jiff::civil::Time, AppError> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::validation(format!("invalid time format '{s}', expected HH:MM")));
    }
    let hour: i8 =
        parts[0].parse().map_err(|_| AppError::validation(format!("invalid hour in '{s}'")))?;
    let minute: i8 =
        parts[1].parse().map_err(|_| AppError::validation(format!("invalid minute in '{s}'")))?;
    if !(0..=23).contains(&hour) || !(0..=59).contains(&minute) {
        return Err(AppError::validation(format!("time '{s}' out of range (00:00-23:59)")));
    }
    jiff::civil::Time::new(hour, minute, 0, 0)
        .map_err(|e| AppError::validation(format!("invalid time '{s}': {e}")))
}

// ─── CRUD Endpoints ──────────────────────────────────────────────────────

/// List all work policy templates.
#[utoipa::path(
    get,
    path = "/api/work-policies",
    tag = "Work Policies",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Work policy template list", body = Vec<WorkPolicyTemplateResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_templates(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<WorkPolicyTemplateResponse>>>, AppError> {
    let templates = state.storage.list_work_policy_templates().await?;
    let responses: Vec<WorkPolicyTemplateResponse> =
        templates.iter().map(WorkPolicyTemplateResponse::from).collect();
    Ok(Json(ApiEnvelope::success(responses)))
}

/// Get a single work policy template by ID.
#[utoipa::path(
    get,
    path = "/api/work-policies/{id}",
    tag = "Work Policies",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Template UUID"),
    ),
    responses(
        (status = 200, description = "Work policy template", body = WorkPolicyTemplateResponse),
        (status = 404, description = "Template not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<WorkPolicyTemplateResponse>>, AppError> {
    let tpl = state
        .storage
        .get_work_policy_template(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("work policy template '{id}'")))?;

    Ok(Json(ApiEnvelope::success(WorkPolicyTemplateResponse::from(&tpl))))
}

/// Create a new work policy template.
#[utoipa::path(
    post,
    path = "/api/work-policies",
    tag = "Work Policies",
    security(("bearer_auth" = [])),
    request_body = CreateWorkPolicyTemplateRequest,
    responses(
        (status = 201, description = "Template created", body = WorkPolicyTemplateResponse),
        (status = 409, description = "Template title already exists"),
        (status = 422, description = "Validation error"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn create_template(
    State(state): State<AppState>,
    Json(body): Json<CreateWorkPolicyTemplateRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<WorkPolicyTemplateResponse>>), AppError> {
    let title = body.title.trim();
    if title.is_empty() {
        return Err(AppError::validation("title must not be empty"));
    }
    if body.working_days.iter().all(|d| !d) {
        return Err(AppError::validation("at least one working day must be selected"));
    }

    // Check for duplicate title
    if state.storage.get_work_policy_template_by_title(title).await?.is_some() {
        return Err(AppError::duplicate(format!("work policy template '{title}' already exists")));
    }

    let work_start = parse_time(&body.work_start)?;
    let work_end = parse_time(&body.work_end)?;
    if work_start == work_end {
        return Err(AppError::validation("work_start and work_end must be different"));
    }

    let policy = timekeep_core::model::WorkPolicy {
        work_start,
        work_end,
        late_threshold_secs: (body.late_threshold_minutes as i64) * 60,
        min_seconds_for_present: (body.min_hours_for_full_day * 3600.0) as i64,
        daily_overtime_after_secs: (body.daily_overtime_after_hours * 3600.0) as i64,
        working_days: body.working_days,
    };

    let tpl = timekeep_core::model::WorkPolicyTemplate::new(title, body.description, &policy);

    state.storage.create_work_policy_template(&tpl).await?;

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(WorkPolicyTemplateResponse::from(&tpl)))))
}

/// Update an existing work policy template.
#[utoipa::path(
    put,
    path = "/api/work-policies/{id}",
    tag = "Work Policies",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Template UUID"),
    ),
    request_body = UpdateWorkPolicyTemplateRequest,
    responses(
        (status = 200, description = "Template updated", body = WorkPolicyTemplateResponse),
        (status = 404, description = "Template not found"),
        (status = 409, description = "Template title already exists"),
        (status = 422, description = "Validation error"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateWorkPolicyTemplateRequest>,
) -> Result<Json<ApiEnvelope<WorkPolicyTemplateResponse>>, AppError> {
    let mut tpl = state
        .storage
        .get_work_policy_template(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("work policy template '{id}'")))?;

    // Update title
    if let Some(ref new_title) = body.title {
        let title = new_title.trim();
        if title.is_empty() {
            return Err(AppError::validation("title must not be empty"));
        }
        if title != tpl.title
            && state.storage.get_work_policy_template_by_title(title).await?.is_some()
        {
            return Err(AppError::duplicate(format!(
                "work policy template '{title}' already exists"
            )));
        }
        tpl.rename(title);
    }

    // Update description
    if let Some(ref desc_opt) = body.description {
        tpl.set_description(desc_opt.clone());
    }

    // Build updated config from provided fields + existing values
    let work_start = match &body.work_start {
        Some(s) => parse_time(s)?,
        None => tpl.work_start,
    };
    let work_end = match &body.work_end {
        Some(s) => parse_time(s)?,
        None => tpl.work_end,
    };
    if work_start == work_end {
        return Err(AppError::validation("work_start and work_end must be different"));
    }

    let working_days = body.working_days.unwrap_or(tpl.working_days);
    if working_days.iter().all(|d| !d) {
        return Err(AppError::validation("at least one working day must be selected"));
    }

    let updated_config = timekeep_core::model::WorkPolicy {
        work_start,
        work_end,
        late_threshold_secs: body
            .late_threshold_minutes
            .map(|m| (m as i64) * 60)
            .unwrap_or(tpl.late_threshold_secs),
        min_seconds_for_present: body
            .min_hours_for_full_day
            .map(|h| (h * 3600.0) as i64)
            .unwrap_or(tpl.min_seconds_for_present),
        daily_overtime_after_secs: body
            .daily_overtime_after_hours
            .map(|h| (h * 3600.0) as i64)
            .unwrap_or(tpl.daily_overtime_after_secs),
        working_days,
    };

    tpl.update_config(&updated_config);

    state.storage.update_work_policy_template(&tpl).await?;

    Ok(Json(ApiEnvelope::success(WorkPolicyTemplateResponse::from(&tpl))))
}

/// Delete a work policy template.
#[utoipa::path(
    delete,
    path = "/api/work-policies/{id}",
    tag = "Work Policies",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Template UUID"),
    ),
    responses(
        (status = 200, description = "Template deleted"),
        (status = 404, description = "Template not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<crate::dto::StatusResponse>>, AppError> {
    if state.storage.get_work_policy_template(&id).await?.is_none() {
        return Err(AppError::not_found(format!("work policy template '{id}'")));
    }

    state.storage.delete_work_policy_template(&id).await?;

    Ok(Json(ApiEnvelope::success(crate::dto::StatusResponse::deleted())))
}

// ─── Schema & Filters ────────────────────────────────────────────────────

/// Return the entity schema for work policy templates.
#[utoipa::path(
    get,
    path = "/api/work-policies/schema",
    tag = "Work Policies",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Work policy template schema metadata", body = timekeep_core::EntitySchema),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn template_schema() -> Json<ApiEnvelope<timekeep_core::EntitySchema>> {
    Json(ApiEnvelope::success(timekeep_core::WORK_POLICY_TEMPLATE_SCHEMA.clone()))
}

/// Return faceted filter metadata for work policy templates.
#[utoipa::path(
    get,
    path = "/api/work-policies/filters",
    tag = "Work Policies",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Work policy template facet metadata"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn template_filters()
-> Result<Json<ApiEnvelope<Vec<timekeep_core::FacetGroup>>>, AppError> {
    // Work policy templates currently have no facet dimensions beyond the
    // default schema-driven filters. Return an empty group so the frontend
    // doesn't error.
    Ok(Json(ApiEnvelope::success(vec![])))
}
