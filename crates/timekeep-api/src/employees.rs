//! Employee and work-day query handlers.
//!
//! These handlers wire the `AttendanceCalculator` domain service to HTTP endpoints.
//! They fetch raw punches from storage, run them through the calculator, and
//! return `WorkDay`-shaped responses. No business logic lives here — it's all
//! in `timekeep-core`.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};

use std::sync::Arc;
use timekeep_core::{AttendanceCalculator, DayStatus, PunchFilter};

use crate::AppState;
use crate::dto::{
    CalendarDayResponse, EmployeeResponse, EmployeeSummaryResponse, EmployeeWorkDaysResponse,
    MonthlyTrendResponse, QuickStatsResponse, StatusResponse, WorkDayResponse,
};
use crate::request::WorkDayQuery;
use crate::response::{ApiEnvelope, AppError, PageMeta};

/// Resolve the employee repository or return an error if not configured.
pub(crate) fn employees(
    state: &AppState,
) -> Result<&Arc<dyn timekeep_core::EmployeeStore>, AppError> {
    state.employees.as_ref().ok_or_else(|| {
        AppError::Internal("Employee repository not configured for this storage backend".into())
    })
}

// ─── Work Day Queries ─────────────────────────────────────────────────

/// Get computed work days for a specific employee by PIN.
#[utoipa::path(
    get,
    path = "/api/employees/{pin}/work-days",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("pin" = String, Path, description = "Employee PIN"),
        WorkDayQuery,
    ),
    responses(
        (status = 200, description = "Employee work days", body = EmployeeWorkDaysResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn employee_work_days(
    State(state): State<AppState>,
    Path(user_pin): Path<String>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<EmployeeWorkDaysResponse>>, AppError> {
    let policy = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches(&PunchFilter {
            user_pins: Some(vec![user_pin.clone()]),
            since,
            until,
            ..Default::default()
        })
        .await?;

    let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);
    let responses: Vec<WorkDayResponse> = work_days.iter().map(WorkDayResponse::from).collect();

    Ok(Json(ApiEnvelope::success(EmployeeWorkDaysResponse { user_pin, work_days: responses })))
}

/// Get an aggregated summary for an employee over a date range.
#[utoipa::path(
    get,
    path = "/api/employees/{pin}/summary",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("pin" = String, Path, description = "Employee PIN"),
        WorkDayQuery,
    ),
    responses(
        (status = 200, description = "Employee summary", body = EmployeeSummaryResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn employee_summary(
    State(state): State<AppState>,
    Path(user_pin): Path<String>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<EmployeeSummaryResponse>>, AppError> {
    let policy = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches(&PunchFilter {
            user_pins: Some(vec![user_pin.clone()]),
            since,
            until,
            ..Default::default()
        })
        .await?;

    let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

    let total_days = work_days.len();
    let present_days = work_days.iter().filter(|d| d.status == DayStatus::Present).count();
    let late_days = work_days.iter().filter(|d| d.status == DayStatus::Late).count();
    let half_days = work_days.iter().filter(|d| d.status == DayStatus::HalfDay).count();

    let total_regular: i64 = work_days.iter().map(|d| d.net_work_seconds()).sum();
    let total_overtime: i64 = work_days.iter().map(|d| d.total_overtime_seconds).sum();
    let avg_hours =
        if total_days > 0 { total_regular as f64 / 3600.0 / total_days as f64 } else { 0.0 };

    let responses: Vec<WorkDayResponse> = work_days.iter().map(WorkDayResponse::from).collect();

    Ok(Json(ApiEnvelope::success(EmployeeSummaryResponse {
        user_pin,
        total_days,
        present_days,
        late_days,
        half_days,
        absent_days: 0,
        total_regular_seconds: total_regular,
        total_overtime_seconds: total_overtime,
        avg_hours_per_day: avg_hours,
        work_days: responses,
    })))
}

/// Get quick stats for the dashboard with work-day computation.
#[utoipa::path(
    get,
    path = "/api/dashboard/quick-stats",
    tag = "Dashboard",
    security(("bearer_auth" = [])),
    params(
        WorkDayQuery,
    ),
    responses(
        (status = 200, description = "Dashboard quick stats", body = QuickStatsResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn dashboard_quick_stats(
    State(state): State<AppState>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<QuickStatsResponse>>, AppError> {
    let policy = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches =
        state.storage.query_punches(&PunchFilter { since, until, ..Default::default() }).await?;
    let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

    let unique_users: std::collections::HashSet<&str> =
        work_days.iter().map(|d| d.user_pin.as_str()).collect();
    let check_ins =
        punches.iter().filter(|p| matches!(p.status, timekeep_core::PunchStatus::CheckIn)).count();
    let check_outs =
        punches.iter().filter(|p| matches!(p.status, timekeep_core::PunchStatus::CheckOut)).count();
    let currently_present = work_days.iter().filter(|d| d.is_present_now()).count();
    let late_arrivals = work_days.iter().filter(|d| d.status == DayStatus::Late).count();
    let anomalies = work_days.iter().map(|d| d.anomalies.len()).sum();
    let responses: Vec<WorkDayResponse> = work_days.iter().map(WorkDayResponse::from).collect();

    Ok(Json(ApiEnvelope::success(QuickStatsResponse {
        unique_users: unique_users.len(),
        total_punches: punches.len(),
        check_ins,
        check_outs,
        currently_present,
        late_arrivals,
        anomalies_detected: anomalies,
        work_days: responses,
    })))
}

// ─── Employee CRUD ────────────────────────────────────────────────────

/// Create a new tracked employee.
///
/// Accepts optional `department_id` for UUID-based department references.
/// When provided, the department name is resolved and stored as the
/// denormalized `department` display field.
#[utoipa::path(
    post,
    path = "/api/employees",
    tag = "Employees",
    security(("bearer_auth" = [])),
    request_body = crate::request::CreateEmployeeRequest,
    responses(
        (status = 201, description = "Employee created", body = EmployeeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 409, description = "Duplicate PIN"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn create_employee(
    State(state): State<AppState>,
    Json(body): Json<crate::request::CreateEmployeeRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<EmployeeResponse>>), AppError> {
    // Resolve department name from department_id for the display cache
    let (department_id, department_name) =
        resolve_department(&state, body.department_id.as_deref()).await?;

    let mut employee =
        timekeep_core::Employee::new(&body.pin, &body.name, department_name, body.external_id);
    employee.department_id = department_id;

    employees(&state)?.create_employee(&employee).await.map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            AppError::duplicate(format!("PIN '{}' already exists", body.pin))
        } else {
            AppError::from(e)
        }
    })?;

    // Publish employee domain event for audit trail + subscribers
    state.event_bus.publish(timekeep_core::DomainEvent::EmployeeCreated {
        pin: employee.pin.clone(),
        name: employee.name.clone(),
    });

    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(EmployeeResponse::from(&employee)))))
}

/// List all tracked employees with optional filtering and pagination.
#[utoipa::path(
    get,
    path = "/api/employees",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(crate::request::EmployeeListQuery),
    responses(
        (status = 200, description = "Paginated employee list"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_employees(
    State(state): State<AppState>,
    Query(q): Query<crate::request::EmployeeListQuery>,
) -> Result<axum::response::Response, AppError> {
    // ── Tantivy full-text search path ──────────────────────────────
    if q.q.as_ref().is_some_and(|s| !s.trim().is_empty()) {
        return list_employees_via_search(&state, &q).await;
    }

    // ── Legacy SQL LIKE path ───────────────────────────────────────
    let __fields = q.params.fields.clone();
    let filter = timekeep_core::EmployeeFilter {
        params: q.params,
        department_ids: q.department_ids.clone(),
        active: q.active.and_then(|a| a.parse::<bool>().ok()),
    };
    let result = employees(&state)?.list_employees_filtered(&filter).await?;
    let responses: Vec<EmployeeResponse> =
        result.items.iter().map(EmployeeResponse::from).collect();
    let meta = if result.has_more {
        PageMeta::has_more(result.next_cursor.unwrap_or_default())
    } else {
        PageMeta::single()
    };
    crate::response::build_sparse_envelope(responses, meta, &__fields)
}

/// Execute full-text search via Tantivy, then cross-reference with the DB.
async fn list_employees_via_search(
    state: &AppState,
    q: &crate::request::EmployeeListQuery,
) -> Result<axum::response::Response, AppError> {
    let search_term = q.q.as_deref().unwrap_or("");

    let search_query = timekeep_core::SearchQuery {
        q: search_term.to_string(),
        entity_type: Some("employee".to_string()),
        limit: q.params.clamped_limit(),
        offset: 0,
    };

    // If SearchStore is available, use it. Otherwise fall back to SQL LIKE.
    let results = if let Some(ref search) = state.search {
        search
            .search(&search_query)
            .await
            .map_err(|e| AppError::Internal(format!("search failed: {e}")))?
    } else {
        // No search store — fall back to SQL LIKE path
        let __fields = q.params.fields.clone();
        let filter = timekeep_core::EmployeeFilter {
            params: q.params.clone(),
            department_ids: q.department_ids.clone(),
            active: q.active.as_deref().and_then(|a| a.parse::<bool>().ok()),
        };
        let result = employees(state)?.list_employees_filtered(&filter).await?;
        let responses: Vec<EmployeeResponse> =
            result.items.iter().map(EmployeeResponse::from).collect();
        return crate::response::build_sparse_envelope(
            responses,
            PageMeta::single(),
            &q.params.fields,
        );
    };

    // Cross-reference search results with the database
    let repo = employees(state)?;
    let mut responses = Vec::with_capacity(results.hits.len());

    for hit in &results.hits {
        let emp_id = timekeep_core::EmployeeId::from(hit.entity_id.as_str());
        if let Some(emp) = repo.find_employee(&emp_id).await? {
            // Apply department/active filters (Tantivy may return extra results)
            if let Some(ref dept_ids) = q.department_ids
                && !dept_ids.is_empty()
                && !dept_ids.iter().any(|id| emp.department_id.as_deref() == Some(id.as_str()))
            {
                continue;
            }
            if let Some(active_str) = &q.active
                && let Ok(active) = active_str.parse::<bool>()
                && emp.active != active
            {
                continue;
            }
            responses.push(EmployeeResponse::from(&emp));
        }
    }

    let has_more = responses.len() as u32 >= q.params.clamped_limit();
    let meta = if has_more {
        let next_idx = q.params.clamped_limit();
        let next_cursor = timekeep_core::encode_offset_cursor(next_idx as i64);
        PageMeta::has_more(next_cursor)
    } else {
        PageMeta::single()
    };

    crate::response::build_sparse_envelope(responses, meta, &q.params.fields)
}

/// Get a single employee by ID or PIN.
#[utoipa::path(
    get,
    path = "/api/employees/{id}",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Employee ID or PIN"),
    ),
    responses(
        (status = 200, description = "Employee details", body = EmployeeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
    )
)]
pub(crate) async fn get_employee(
    State(state): State<AppState>,
    Path(id_or_pin): Path<String>,
) -> Result<Json<ApiEnvelope<EmployeeResponse>>, AppError> {
    let repo = employees(&state)?;
    let emp_id = timekeep_core::EmployeeId::from(id_or_pin.as_str());
    let mut employee = repo.find_employee(&emp_id).await?;
    if employee.is_none() {
        employee = repo.find_employee_by_pin(&id_or_pin).await?;
    }
    match employee {
        Some(emp) => Ok(Json(ApiEnvelope::success(EmployeeResponse::from(&emp)))),
        None => Err(AppError::not_found(format!("employee '{id_or_pin}'"))),
    }
}

/// Update an employee's metadata.
///
/// Resolves the department name from `department_id` when provided.
#[utoipa::path(
    put,
    path = "/api/employees/{id}",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Employee ID"),
    ),
    request_body = crate::request::UpdateEmployeeRequest,
    responses(
        (status = 200, description = "Employee updated", body = EmployeeResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 404, description = "Employee not found"),
    )
)]
pub(crate) async fn update_employee(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<crate::request::UpdateEmployeeRequest>,
) -> Result<Json<ApiEnvelope<EmployeeResponse>>, AppError> {
    let repo = employees(&state)?;
    let emp_id = timekeep_core::EmployeeId::from(id);
    let mut employee = repo
        .find_employee(&emp_id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("employee {emp_id}")))?;
    if let Some(name) = body.name {
        employee.rename(name);
    }
    // Only update department when explicitly provided in the request.
    // `None` means the key was absent — leave the existing value intact.
    // (Serde deserialises a missing optional field to `None`.)
    if let Some(ref dept_id_opt) = body.department_id {
        if dept_id_opt.is_empty() {
            // Explicit empty string → clear the department FK
            employee.set_department(None, None);
        } else {
            let (department_id, department_name) =
                resolve_department(&state, Some(dept_id_opt)).await?;
            employee.set_department(department_id, department_name);
        }
    }
    if let Some(ext_id) = body.external_id {
        employee.external_id = Some(ext_id);
    }
    repo.update_employee(&employee).await?;

    state.event_bus.publish(timekeep_core::DomainEvent::EmployeeUpdated {
        id: emp_id.to_string(),
        name: employee.name.clone(),
        pin: employee.pin.clone(),
    });

    Ok(Json(ApiEnvelope::success(EmployeeResponse::from(&employee))))
}

/// Deactivate an employee (soft delete).
#[utoipa::path(
    delete,
    path = "/api/employees/{id}",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Employee ID"),
    ),
    responses(
        (status = 200, description = "Employee deactivated", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 404, description = "Employee not found"),
    )
)]
pub(crate) async fn deactivate_employee(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let emp_id = timekeep_core::EmployeeId::from(id);
    employees(&state)?.deactivate_employee(&emp_id).await?;

    state
        .event_bus
        .publish(timekeep_core::DomainEvent::EmployeeDeactivated { pin: emp_id.to_string() });

    Ok(Json(ApiEnvelope::success(StatusResponse::deleted())))
}

// ─── Device Enrollment ────────────────────────────────────────────────

/// Enroll an employee on a specific device.
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/enrollments",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    request_body = crate::request::EnrollEmployeeRequest,
    responses(
        (status = 201, description = "Employee enrolled on device", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 404, description = "Employee or device not found"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn enroll_employee(
    State(state): State<AppState>,
    Path(device_sn): Path<String>,
    Json(body): Json<crate::request::EnrollEmployeeRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<StatusResponse>>), AppError> {
    let repo = employees(&state)?;
    let employee = repo
        .find_employee_by_pin(&body.pin)
        .await?
        .ok_or_else(|| AppError::not_found(format!("employee with PIN '{}'", body.pin)))?;
    let biometric_types: Vec<timekeep_core::BiometricType> = body
        .biometric_types
        .iter()
        .filter_map(|t| match t.as_str() {
            "fingerprint" => Some(timekeep_core::BiometricType::Fingerprint),
            "face" => Some(timekeep_core::BiometricType::Face),
            "palm" => Some(timekeep_core::BiometricType::Palm),
            "card" => Some(timekeep_core::BiometricType::Card),
            "password" => Some(timekeep_core::BiometricType::Password),
            _ => None,
        })
        .collect();
    let enrollment = timekeep_core::DeviceEnrollment::new(
        employee.id.clone(),
        &device_sn,
        &body.pin,
        biometric_types,
    );
    repo.create_enrollment(&enrollment).await?;
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(StatusResponse::created()))))
}

/// List employees enrolled on a device.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}/enrollments",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Device enrollments", body = Vec<EmployeeResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn list_device_enrollments(
    State(state): State<AppState>,
    Path(device_sn): Path<String>,
) -> Result<Json<ApiEnvelope<Vec<EmployeeResponse>>>, AppError> {
    let repo = employees(&state)?;
    let enrollments = repo.list_enrollments_for_device(&device_sn).await?;
    let mut responses = Vec::new();
    for enrollment in &enrollments {
        if let Ok(Some(emp)) = repo.find_employee(&enrollment.employee_id).await {
            responses.push(EmployeeResponse::from(&emp));
        }
    }
    Ok(Json(ApiEnvelope::success(responses)))
}

// ─── Chart Endpoints ───────────────────────────────────────────────

/// Get monthly attendance trend for an employee.
///
/// Returns one data point per month with attendance percentage.
#[utoipa::path(
    get,
    path = "/api/employees/{pin}/monthly",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("pin" = String, Path, description = "Employee PIN"),
        WorkDayQuery,
    ),
    responses(
        (status = 200, description = "Employee monthly attendance trend", body = Vec<MonthlyTrendResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn employee_monthly_trend(
    State(state): State<AppState>,
    Path(user_pin): Path<String>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<Vec<MonthlyTrendResponse>>>, AppError> {
    let policy = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches(&PunchFilter {
            user_pins: Some(vec![user_pin.clone()]),
            since,
            until,
            ..Default::default()
        })
        .await?;

    let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

    let from_date = since.map(|ts| ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().date());
    let to_date = until.map(|ts| ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().date());

    let trend = if let (Some(from), Some(to)) = (from_date, to_date) {
        AttendanceCalculator::compute_monthly_trend(&work_days, &policy, from, to)
    } else {
        Vec::new()
    };

    let responses: Vec<MonthlyTrendResponse> =
        trend.iter().map(MonthlyTrendResponse::from).collect();

    Ok(Json(ApiEnvelope::success(responses)))
}

/// Get calendar projection for an employee for a specific month.
///
/// Query params: `year` and `month` (both required).
/// Returns one CalendarDay per day of the month.
#[utoipa::path(
    get,
    path = "/api/employees/{pin}/calendar",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("pin" = String, Path, description = "Employee PIN"),
        WorkDayQuery,
    ),
    responses(
        (status = 200, description = "Employee calendar", body = Vec<CalendarDayResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn employee_calendar(
    State(state): State<AppState>,
    Path(user_pin): Path<String>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<Vec<CalendarDayResponse>>>, AppError> {
    let policy = crate::helpers::org_work_policy(&*state.storage).await;
    let (since, until) = crate::helpers::resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches(&PunchFilter {
            user_pins: Some(vec![user_pin.clone()]),
            since,
            until,
            ..Default::default()
        })
        .await?;

    let work_days = AttendanceCalculator::compute_work_days(&punches, &policy);

    // Determine the month from the query range (use the first month in range)
    let target_date = since.map(|ts| ts.to_zoned(jiff::tz::TimeZone::UTC).datetime().date());

    let calendar = if let Some(date) = target_date {
        AttendanceCalculator::project_calendar(&work_days, date.year(), date.month(), &policy)
    } else {
        Vec::new()
    };

    let responses: Vec<CalendarDayResponse> =
        calendar.iter().map(CalendarDayResponse::from).collect();

    Ok(Json(ApiEnvelope::success(responses)))
}

// ─── Helpers ──────────────────────────────────────────────────────────

/// Resolve department name from UUID.
///
/// When department_id is provided, looks up the department by UUID
/// and returns both the ID and the resolved display name.
async fn resolve_department(
    state: &AppState,
    department_id: Option<&str>,
) -> Result<(Option<String>, Option<String>), AppError> {
    match department_id {
        Some(id) => {
            let dept = state.storage.get_department(id).await?;
            match dept {
                Some(d) => Ok((Some(d.id.to_string()), Some(d.name))),
                None => Err(AppError::not_found(format!("department {id} not found"))),
            }
        },
        None => Ok((None, None)),
    }
}

// ─── Employee Sync (push to devices) ─────────────────────────────────

/// Trigger a sync of an employee to all their enrolled devices.
///
/// Publishes `EmployeeSyncRequested` which is handled by the
/// application layer to push the employee to each device via SDK.
#[utoipa::path(
    post,
    path = "/api/employees/{id}/sync-to-devices",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Employee ID or PIN"),
    ),
    responses(
        (status = 200, description = "Sync triggered", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 404, description = "Employee not found"),
    )
)]
pub(crate) async fn sync_employee_to_devices(
    State(state): State<AppState>,
    Path(id_or_pin): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    // Resolve the employee to verify they exist
    let repo = employees(&state)?;
    let emp_id = timekeep_core::EmployeeId::from(id_or_pin.as_str());
    let employee = repo.find_employee(&emp_id).await?;
    let employee = match employee {
        Some(e) => e,
        None => repo
            .find_employee_by_pin(&id_or_pin)
            .await?
            .ok_or_else(|| AppError::not_found(format!("employee '{id_or_pin}' not found")))?,
    };

    state.event_bus.publish(timekeep_core::DomainEvent::EmployeeSyncRequested {
        employee_pin: employee.pin.clone(),
    });

    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Trigger removal of an employee from all their enrolled devices.
///
/// Publishes `EmployeeRemoveRequested` which is handled by the
/// application layer to delete the employee from each device via SDK.
#[utoipa::path(
    post,
    path = "/api/employees/{id}/remove-from-devices",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Employee ID or PIN"),
    ),
    responses(
        (status = 200, description = "Employee removed from devices", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 404, description = "Employee not found"),
    )
)]
pub(crate) async fn remove_employee_from_devices(
    State(state): State<AppState>,
    Path(id_or_pin): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let repo = employees(&state)?;
    let emp_id = timekeep_core::EmployeeId::from(id_or_pin.as_str());
    let employee = repo.find_employee(&emp_id).await?;
    let employee = match employee {
        Some(e) => e,
        None => repo
            .find_employee_by_pin(&id_or_pin)
            .await?
            .ok_or_else(|| AppError::not_found(format!("employee '{id_or_pin}' not found")))?,
    };

    state.event_bus.publish(timekeep_core::DomainEvent::EmployeeRemoveRequested {
        employee_pin: employee.pin.clone(),
    });

    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Return the entity schema for employees.
#[utoipa::path(
    get,
    path = "/api/employees/schema",
    tag = "Employees",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Employee entity schema metadata", body = timekeep_core::EntitySchema),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn employee_schema() -> Json<ApiEnvelope<timekeep_core::EntitySchema>> {
    Json(ApiEnvelope::success(timekeep_core::EMPLOYEE_SCHEMA.clone()))
}

/// Return faceted filter metadata for employees.
#[utoipa::path(
    get,
    path = "/api/employees/filters",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(crate::request::GenericFacetParams),
    responses(
        (status = 200, description = "Employee facet metadata"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn employee_filters(
    State(state): State<AppState>,
    Query(q): Query<crate::request::GenericFacetParams>,
) -> Result<Json<ApiEnvelope<Vec<timekeep_core::FacetGroup>>>, AppError> {
    use std::collections::HashMap;
    use timekeep_core::{FacetContext, FacetQuery};

    let mut filters = HashMap::new();
    if let Some(ref v) = q.department {
        filters.insert("department".to_string(), vec![v.clone()]);
    }
    if let Some(ref v) = q.active {
        filters.insert("active".to_string(), vec![v.clone()]);
    }

    let query = FacetQuery {
        dimension: q.dimension.clone(),
        search: q.search.clone(),
        limit: q.limit.clamp(1, 100),
        context: FacetContext { filters, ..FacetContext::default() },
    };

    let groups = state.storage.employee_facets(&query).await?;
    Ok(Json(ApiEnvelope::success(groups)))
}
