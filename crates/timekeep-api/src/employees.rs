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
use jiff::Timestamp;
use std::sync::Arc;
use timekeep_core::{AttendanceCalculator, DayStatus, PunchFilter, WorkPolicy};

use crate::AppState;
use crate::dto::{
    EmployeeResponse, EmployeeSummaryResponse, EmployeeWorkDaysResponse, QuickStatsResponse,
    WorkDayResponse,
};
use crate::request::WorkDayQuery;
use crate::response::{ApiEnvelope, AppError};

/// Resolve the employee repository or return an error if not configured.
fn employees(state: &AppState) -> Result<&Arc<dyn timekeep_core::EmployeeRepository>, AppError> {
    state.employees.as_ref().ok_or_else(|| {
        AppError::Internal("Employee repository not configured for this storage backend".into())
    })
}

// ─── Work Day Queries ─────────────────────────────────────────────────

/// Get computed work days for a specific employee by PIN.
pub(crate) async fn employee_work_days(
    State(state): State<AppState>,
    Path(user_pin): Path<String>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<EmployeeWorkDaysResponse>>, AppError> {
    let policy = WorkPolicy::standard_9to5();
    let (since, until) = resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches(&PunchFilter {
            user_pin: Some(user_pin.clone()),
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
pub(crate) async fn employee_summary(
    State(state): State<AppState>,
    Path(user_pin): Path<String>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<EmployeeSummaryResponse>>, AppError> {
    let policy = WorkPolicy::standard_9to5();
    let (since, until) = resolve_date_range(q.from, q.to);

    let punches = state
        .storage
        .query_punches(&PunchFilter {
            user_pin: Some(user_pin.clone()),
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
pub(crate) async fn dashboard_quick_stats(
    State(state): State<AppState>,
    Query(q): Query<WorkDayQuery>,
) -> Result<Json<ApiEnvelope<QuickStatsResponse>>, AppError> {
    let policy = WorkPolicy::standard_9to5();
    let (since, until) = resolve_date_range(q.from, q.to);

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
pub(crate) async fn create_employee(
    State(state): State<AppState>,
    Json(body): Json<crate::request::CreateEmployeeRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<EmployeeResponse>>), AppError> {
    let employee =
        timekeep_core::Employee::new(&body.pin, &body.name, body.department, body.external_id);
    employees(&state)?.create_employee(&employee).await.map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            AppError::duplicate(format!("PIN '{}' already exists", body.pin))
        } else {
            AppError::from(e)
        }
    })?;
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(EmployeeResponse::from(&employee)))))
}

/// List all tracked employees.
pub(crate) async fn list_employees(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<Json<ApiEnvelope<Vec<EmployeeResponse>>>, AppError> {
    let result = employees(&state)?.list_employees(&params).await?;
    let responses: Vec<EmployeeResponse> =
        result.items.iter().map(EmployeeResponse::from).collect();
    let meta = if result.has_more {
        crate::response::PageMeta::has_more(result.next_cursor.unwrap_or_default())
    } else {
        crate::response::PageMeta::single()
    };
    Ok(Json(ApiEnvelope::paginated(responses, meta)))
}

/// Get a single employee by ID or PIN.
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
    if let Some(dept) = body.department {
        employee.department = Some(dept);
    }
    if let Some(ext_id) = body.external_id {
        employee.external_id = Some(ext_id);
    }
    repo.update_employee(&employee).await?;
    Ok(Json(ApiEnvelope::success(EmployeeResponse::from(&employee))))
}

/// Deactivate an employee (soft delete).
pub(crate) async fn deactivate_employee(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<crate::dto::StatusResponse>>, AppError> {
    let emp_id = timekeep_core::EmployeeId::from(id);
    employees(&state)?.deactivate_employee(&emp_id).await?;
    Ok(Json(ApiEnvelope::success(crate::dto::StatusResponse::deleted())))
}

// ─── Device Enrollment ────────────────────────────────────────────────

/// Enroll an employee on a specific device.
pub(crate) async fn enroll_employee(
    State(state): State<AppState>,
    Path(device_sn): Path<String>,
    Json(body): Json<crate::request::EnrollEmployeeRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<crate::dto::StatusResponse>>), AppError> {
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
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(crate::dto::StatusResponse::created()))))
}

/// List employees enrolled on a device.
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

// ─── Helpers ──────────────────────────────────────────────────────────

fn resolve_date_range(
    from: Option<i64>,
    to: Option<i64>,
) -> (Option<Timestamp>, Option<Timestamp>) {
    let now = Timestamp::now();
    let default_since =
        now.saturating_sub(jiff::Span::new().try_days(7).expect("7 days")).unwrap_or(now);
    let since = from.and_then(|ts| Timestamp::from_second(ts).ok()).unwrap_or(default_since);
    let until = to.and_then(|ts| Timestamp::from_second(ts).ok()).unwrap_or(now);
    (Some(since), Some(until))
}
