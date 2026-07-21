//! Employee enrollment endpoints.
//!
//! - `GET /api/employees/{id}/enrollments` — per-employee device enrollment detail
//! - `GET /api/employees/enrollment-summary` — batch summary for list view

use axum::{
    Json,
    extract::{Path, State},
};
use serde::Serialize;
use utoipa::ToSchema;

use crate::app_state::AppState;
use crate::employees::employees;
use crate::response::{ApiEnvelope, AppError};

/// Maximum employee count for batch enrollment summary.
/// Pagination boundary: fine for small tenants, the N+1 TODO below
/// should add server-side pagination before this becomes the bottleneck.
const ENROLLMENT_SUMMARY_MAX_EMPLOYEES: u32 = 10_000;

// ─── Per-Employee Detail ─────────────────────────────────────────────

/// Device enrollment status for a single employee.
#[derive(Debug, Serialize, ToSchema)]
pub(crate) struct EnrollmentStatusResponse {
    pub device_sn: String,
    pub device_label: Option<String>,
    pub group_name: Option<String>,
    pub group_id: Option<String>,
    pub fingerprint_count: u32,
    pub face_enrolled: bool,
    pub card_number: Option<String>,
    pub biometric_types: Vec<String>,
    pub enrolled_at: i64,
}

/// List the devices an employee is enrolled on, with device group info.
#[utoipa::path(
    get,
    path = "/api/employees/{id}/enrollments",
    tag = "Employees",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Employee ID or PIN"),
    ),
    responses(
        (status = 200, description = "Employee enrollment status", body = Vec<EnrollmentStatusResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Employee not found"),
    )
)]
pub(crate) async fn list_employee_enrollments(
    State(state): State<AppState>,
    Path(id_or_pin): Path<String>,
) -> Result<Json<ApiEnvelope<Vec<EnrollmentStatusResponse>>>, AppError> {
    let repo = employees(&state)?;

    let emp_id = timekeep_core::EmployeeId::from(id_or_pin.as_str());
    let employee = match repo.find_employee(&emp_id).await? {
        Some(e) => e,
        None => repo
            .find_employee_by_pin(&id_or_pin)
            .await?
            .ok_or_else(|| AppError::not_found(format!("employee '{id_or_pin}' not found")))?,
    };

    let enrollments = repo.list_enrollments_for_employee(&employee.id).await?;
    // Preload all device configs + groups to avoid N+1
    let device_configs = state.storage.list_device_configs().await.unwrap_or_default();
    let mut responses = Vec::new();

    for enrollment in &enrollments {
        let config = device_configs.iter().find(|c| c.serial_number == enrollment.device_sn);
        let device_label =
            config.and_then(|c| if c.label.is_empty() { None } else { Some(c.label.clone()) });
        // TODO(ENTERPRISE): Batch device group lookups.
        // Phase: Performance optimisation.
        // Impact: One get_device_group() call per enrollment. Fine for few devices.
        // Fix: Preload all groups into a HashMap before the loop.
        let (group_name, group_id) = match config.and_then(|c| c.group_id.as_deref()) {
            Some(gid) => match state.storage.get_device_group(gid).await {
                Ok(Some(group)) => (Some(group.name), Some(group.id.to_string())),
                _ => (None, None),
            },
            None => (None, None),
        };

        let biometric_types: Vec<String> =
            enrollment.biometric_types.iter().map(|bt| format!("{bt:?}").to_lowercase()).collect();

        responses.push(EnrollmentStatusResponse {
            device_sn: enrollment.device_sn.clone(),
            device_label,
            group_name,
            group_id,
            fingerprint_count: enrollment.fingerprint_count,
            face_enrolled: enrollment.face_enrolled,
            card_number: enrollment.card_number.clone(),
            biometric_types,
            enrolled_at: enrollment.enrolled_at.as_second(),
        });
    }

    Ok(Json(ApiEnvelope::success(responses)))
}

// ─── Batch Summary ───────────────────────────────────────────────────

/// Enrollment summary for a single employee.
#[derive(Debug, Serialize, ToSchema)]
pub(crate) struct EnrollmentSummaryEntry {
    pub employee_id: String,
    pub pin: String,
    pub device_count: u32,
    pub has_fingerprint: bool,
}

/// Get enrollment summary for all employees.
///
/// Returns one entry per employee with device count and fingerprint status.
/// Employees with zero enrollments are included (device_count: 0).
#[utoipa::path(
    get,
    path = "/api/employees/enrollment-summary",
    tag = "Employees",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Enrollment summary", body = Vec<EnrollmentSummaryEntry>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn enrollment_summary(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<EnrollmentSummaryEntry>>>, AppError> {
    let repo = employees(&state)?;

    let all = repo
        .list_employees(&timekeep_core::query::ListParams {
            limit: ENROLLMENT_SUMMARY_MAX_EMPLOYEES,
            ..Default::default()
        })
        .await?;

    // TODO(ENTERPRISE): Replace N+1 loop with batch query.
    // Phase: Performance optimisation.
    // Impact: N individual DB queries for N employees. Fine for <200, problematic at scale.
    // Fix: Add batch_count_enrollments() to EmployeeStore trait with GROUP BY.
    let mut entries = Vec::with_capacity(all.items.len());

    for emp in &all.items {
        let enrollments = repo.list_enrollments_for_employee(&emp.id).await.unwrap_or_default();

        entries.push(EnrollmentSummaryEntry {
            employee_id: emp.id.to_string(),
            pin: emp.pin.clone(),
            device_count: enrollments.len() as u32,
            has_fingerprint: enrollments.iter().any(|e| e.fingerprint_count > 0),
        });
    }

    Ok(Json(ApiEnvelope::success(entries)))
}
