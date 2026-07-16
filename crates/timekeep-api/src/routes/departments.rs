//! Department management endpoints.
//!
//! Departments group employees and can override the organization's
//! default work policy with a department-specific schedule.
//!
//! ## Endpoints
//!
//! | Method | Path | Auth | Description |
//! |--------|------|------|-------------|
//! | GET | /api/departments | Viewer | List all departments |
//! | GET | /api/departments/{id} | Viewer | Get single department |
//! | POST | /api/departments | Admin | Create department |
//! | PUT | /api/departments/{id} | Admin | Update department |
//! | DELETE | /api/departments/{id} | Admin | Delete department |
//! | GET | /api/departments/schema | Viewer | Column metadata |
//! | GET | /api/departments/filters | Viewer | Faceted filter metadata |

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};

use crate::AppState;
use crate::dto::DepartmentResponse;
use crate::request::{CreateDepartmentRequest, GenericFacetParams, UpdateDepartmentRequest};
use crate::response::{ApiEnvelope, AppError, PageMeta};

/// Resolve the display title for a department's work policy template.
async fn resolve_policy_title(state: &AppState, work_policy_id: Option<&str>) -> Option<String> {
    match work_policy_id {
        Some(id) => {
            state.storage.get_work_policy_template(id).await.ok().flatten().map(|t| t.title)
        },
        None => None,
    }
}
fn parse_work_policy(
    input: &crate::request::WorkPolicyInput,
) -> Result<timekeep_core::WorkPolicy, AppError> {
    let work_start = parse_time(&input.work_start)
        .map_err(|e| AppError::validation(format!("work_start: {e}")))?;
    let work_end =
        parse_time(&input.work_end).map_err(|e| AppError::validation(format!("work_end: {e}")))?;

    if work_start == work_end {
        return Err(AppError::validation("work_start and work_end must be different"));
    }
    if input.working_days.iter().all(|d| !d) {
        return Err(AppError::validation("at least one working day must be selected"));
    }

    Ok(timekeep_core::WorkPolicy {
        work_start,
        work_end,
        late_threshold_secs: (input.late_threshold_minutes as i64) * 60,
        min_seconds_for_present: (input.min_hours_for_full_day * 3600.0) as i64,
        daily_overtime_after_secs: (input.daily_overtime_after_hours * 3600.0) as i64,
        working_days: input.working_days,
    })
}

/// Parse an "HH:MM" string into a `jiff::civil::Time`.
fn parse_time(s: &str) -> Result<jiff::civil::Time, String> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 2 {
        return Err(format!("invalid time format '{s}', expected HH:MM"));
    }
    let hour: i8 = parts[0].parse().map_err(|_| format!("invalid hour in '{s}'"))?;
    let minute: i8 = parts[1].parse().map_err(|_| format!("invalid minute in '{s}'"))?;
    if !(0..=23).contains(&hour) || !(0..=59).contains(&minute) {
        return Err(format!("time '{s}' out of range (00:00–23:59)"));
    }
    jiff::civil::Time::new(hour, minute, 0, 0).map_err(|e| format!("invalid time '{s}': {e}"))
}

/// Resolve the effective policy for a department from a request.
///
/// - `Some(policy_input)` → parse and use as the department's custom policy
/// - `None` → inherit the organization default (store as NULL)
fn resolve_policy(
    input: Option<&crate::request::WorkPolicyInput>,
) -> Result<Option<timekeep_core::WorkPolicy>, AppError> {
    match input {
        Some(p) => Ok(Some(parse_work_policy(p)?)),
        None => Ok(None),
    }
}

// ─── CRUD Endpoints ────────────────────────────────────────────────────

/// List all departments.
#[utoipa::path(
    get,
    path = "/api/departments",
    tag = "Departments",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Department list", body = Vec<DepartmentResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_departments(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<axum::response::Response, AppError> {
    let departments = state.storage.list_departments().await?;

    let employee_store = crate::employees::employees(&state)?;
    let mut responses: Vec<DepartmentResponse> = Vec::with_capacity(departments.len());
    for dept in &departments {
        let count = employee_store.count_employees_in_department(&dept.id.0).await.ok();
        let policy_title = resolve_policy_title(&state, dept.work_policy_id.as_deref()).await;
        responses.push(DepartmentResponse::from_department(dept, count, policy_title));
    }

    crate::response::build_sparse_envelope(responses, PageMeta::single(), &params.fields)
}

/// Get a single department by ID.
#[utoipa::path(
    get,
    path = "/api/departments/{id}",
    tag = "Departments",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Department UUID"),
    ),
    responses(
        (status = 200, description = "Department details", body = DepartmentResponse),
        (status = 404, description = "Department not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn get_department(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<DepartmentResponse>>, AppError> {
    let dept = state
        .storage
        .get_department(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("department '{id}'")))?;

    let employee_count =
        crate::employees::employees(&state)?.count_employees_in_department(&dept.id.0).await.ok();
    let policy_title = resolve_policy_title(&state, dept.work_policy_id.as_deref()).await;

    Ok(Json(ApiEnvelope::success(DepartmentResponse::from_department(
        &dept,
        employee_count,
        policy_title,
    ))))
}

/// Create a new department.
#[utoipa::path(
    post,
    path = "/api/departments",
    tag = "Departments",
    security(("bearer_auth" = [])),
    request_body = CreateDepartmentRequest,
    responses(
        (status = 201, description = "Department created", body = DepartmentResponse),
        (status = 409, description = "Department name already exists"),
        (status = 422, description = "Validation error"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn create_department(
    State(state): State<AppState>,
    Json(body): Json<CreateDepartmentRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DepartmentResponse>>), AppError> {
    // Validate name
    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::validation("department name must not be empty"));
    }

    // Check for duplicate name
    if state.storage.get_department_by_name(name).await?.is_some() {
        return Err(AppError::duplicate(format!("department '{name}' already exists")));
    }

    // Validate work_policy_id if provided
    if let Some(ref tpl_id) = body.work_policy_id
        && state.storage.get_work_policy_template(tpl_id).await?.is_none()
    {
        return Err(AppError::not_found(format!("work policy template '{tpl_id}' not found")));
    }

    let policy = resolve_policy(body.work_policy.as_ref())?;
    let mut dept = timekeep_core::Department::new(name, policy);
    dept.work_policy_id = body.work_policy_id.clone();

    state.storage.create_department(&dept).await?;

    state.event_bus.publish(timekeep_core::DomainEvent::DepartmentCreated {
        id: dept.id.to_string(),
        name: dept.name.clone(),
    });

    let policy_title = resolve_policy_title(&state, dept.work_policy_id.as_deref()).await;

    Ok((
        StatusCode::CREATED,
        Json(ApiEnvelope::success(DepartmentResponse::from_department(
            &dept,
            Some(0),
            policy_title,
        ))),
    ))
}

/// Update an existing department.
#[utoipa::path(
    put,
    path = "/api/departments/{id}",
    tag = "Departments",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Department UUID"),
    ),
    request_body = UpdateDepartmentRequest,
    responses(
        (status = 200, description = "Department updated", body = DepartmentResponse),
        (status = 404, description = "Department not found"),
        (status = 409, description = "Department name already exists"),
        (status = 422, description = "Validation error"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn update_department(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDepartmentRequest>,
) -> Result<Json<ApiEnvelope<DepartmentResponse>>, AppError> {
    let mut dept = state
        .storage
        .get_department(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("department '{id}'")))?;

    // Update name
    if let Some(ref new_name) = body.name {
        let name = new_name.trim();
        if name.is_empty() {
            return Err(AppError::validation("department name must not be empty"));
        }
        // Check duplicate if name changed
        if name != dept.name
            && let Some(existing) = state.storage.get_department_by_name(name).await?
            && existing.id != dept.id
        {
            return Err(AppError::duplicate(format!("department '{name}' already exists")));
        }
        dept.rename(name);
    }

    // Update work policy template FK
    if let Some(ref tpl_id_opt) = body.work_policy_id {
        match tpl_id_opt {
            Some(tpl_id) => {
                // Validate the template exists
                if state.storage.get_work_policy_template(tpl_id).await?.is_none() {
                    return Err(AppError::not_found(format!(
                        "work policy template '{tpl_id}' not found"
                    )));
                }
                dept.set_work_policy_id(Some(tpl_id.clone()));
            },
            None => {
                dept.set_work_policy_id(None);
            },
        }
    }

    // Update work policy (legacy inline JSON)
    if let Some(ref work_policy_opt) = body.work_policy {
        let policy = resolve_policy(work_policy_opt.as_ref())?;
        dept.set_work_policy(policy);
    }

    state.storage.update_department(&dept).await?;

    state.event_bus.publish(timekeep_core::DomainEvent::DepartmentUpdated {
        id: dept.id.to_string(),
        name: dept.name.clone(),
    });

    let employee_count =
        crate::employees::employees(&state)?.count_employees_in_department(&dept.id.0).await.ok();
    let policy_title = resolve_policy_title(&state, dept.work_policy_id.as_deref()).await;

    Ok(Json(ApiEnvelope::success(DepartmentResponse::from_department(
        &dept,
        employee_count,
        policy_title,
    ))))
}

/// Delete a department by ID.
#[utoipa::path(
    delete,
    path = "/api/departments/{id}",
    tag = "Departments",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Department UUID"),
    ),
    responses(
        (status = 200, description = "Department deleted"),
        (status = 404, description = "Department not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn delete_department(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<crate::dto::StatusResponse>>, AppError> {
    // Verify existence first
    if state.storage.get_department(&id).await?.is_none() {
        return Err(AppError::not_found(format!("department '{id}'")));
    }

    state.storage.delete_department(&id).await?;

    state.event_bus.publish(timekeep_core::DomainEvent::DepartmentDeleted { id: id.clone() });

    Ok(Json(ApiEnvelope::success(crate::dto::StatusResponse::deleted())))
}

// ─── Schema & Filters (Metadata System) ─────────────────────────────────

/// Return the entity schema for departments.
#[utoipa::path(
    get,
    path = "/api/departments/schema",
    tag = "Departments",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Department entity schema metadata", body = timekeep_core::EntitySchema),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn department_schema() -> Json<ApiEnvelope<timekeep_core::EntitySchema>> {
    Json(ApiEnvelope::success(timekeep_core::DEPARTMENT_SCHEMA.clone()))
}

/// Return faceted filter metadata for departments.
#[utoipa::path(
    get,
    path = "/api/departments/filters",
    tag = "Departments",
    security(("bearer_auth" = [])),
    params(GenericFacetParams),
    responses(
        (status = 200, description = "Department facet metadata"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn department_filters(
    State(state): State<AppState>,
    Query(q): Query<GenericFacetParams>,
) -> Result<Json<ApiEnvelope<Vec<timekeep_core::FacetGroup>>>, AppError> {
    use timekeep_core::facet::POLICY_VALUES;
    use timekeep_core::{FacetGroup, FacetKind, FacetOption};

    let dimension = q.dimension.as_deref();
    let mut groups: Vec<FacetGroup> = Vec::new();

    // ── has_custom_policy facet ──────────────────────────────────────
    if dimension.is_none() || dimension == Some("has_custom_policy") {
        let mut options = Vec::with_capacity(POLICY_VALUES.len());
        for (value, label) in POLICY_VALUES {
            let count = if *value == "custom" {
                state
                    .storage
                    .list_departments()
                    .await?
                    .iter()
                    .filter(|d| d.has_custom_policy())
                    .count() as u64
            } else {
                state
                    .storage
                    .list_departments()
                    .await?
                    .iter()
                    .filter(|d| !d.has_custom_policy())
                    .count() as u64
            };
            options.push(FacetOption {
                value: value.to_string(),
                label: label.to_string(),
                count: Some(count),
            });
        }
        options.sort_by_key(|a| std::cmp::Reverse(a.count.unwrap_or(0)));
        groups.push(FacetGroup {
            key: "has_custom_policy".into(),
            label: "Policy".into(),
            kind: FacetKind::Enum,
            options,
            has_more: false,
            total: None,
        });
    }

    Ok(Json(ApiEnvelope::success(groups)))
}
