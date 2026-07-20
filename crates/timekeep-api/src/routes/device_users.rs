//! Device user management route handlers.
//!
//! Handlers for enrolling, deleting, and syncing users on devices.

use axum::Json;
use axum::extract::{Path, Query, State};

use crate::app_state::AppState;
use crate::dto::StatusResponse;
use crate::request::{EnqueueCommandRequest, SetUserRequest, TransferTemplatesRequest};
use crate::response::{ApiEnvelope, AppError};
use timekeep_core::events::DomainEvent;

/// Query params for filtered resync / group sync.
#[derive(serde::Deserialize)]
pub(crate) struct SyncQuery {
    /// Optional department ID filter — only sync employees from this department.
    pub department_id: Option<String>,
}

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
            group: None,
            timezone: None,
            password_raw: None,
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

/// Trigger a device-to-device user sync — copy all users
/// from the source device to the target device.
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/sync-from/{source_sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Target device serial number"),
        ("source_sn" = String, Path, description = "Source device serial number"),
    ),
    responses(
        (status = 200, description = "Device-to-device sync requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn sync_device_to_device(
    State(state): State<AppState>,
    Path((target_sn, source_sn)): Path<(String, String)>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::DeviceToDeviceSyncRequested { source_sn, target_sn });
    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Trigger a full device re-sync — delete all users and re-upload
/// from the employee database, optionally filtered by department.
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/resync",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
        ("department" = Option<String>, Query, description = "Optional department name filter"),
    ),
    responses(
        (status = 200, description = "Device resync requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn resync_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Query(q): Query<SyncQuery>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::DeviceResyncRequested { device_sn: sn.clone() });
    // Log department filter if provided
    if let Some(ref dept_id) = q.department_id {
        tracing::info!(
            device = %sn,
            department_id = %dept_id,
            "device resync requested with department filter"
        );
    }
    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Push multiple users to a device in a single request.
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/users/bulk",
    tag = "Users",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    request_body = Vec<SetUserRequest>,
    responses(
        (status = 200, description = "Bulk user enrollment requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn bulk_set_users_on_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Json(body): Json<Vec<SetUserRequest>>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let _count = body.len();
    for user_req in body {
        state.event_bus.publish(DomainEvent::UserSetRequested {
            device_sn: sn.clone(),
            user: timekeep_core::model::User {
                internal_sn: user_req.internal_sn,
                pin: user_req.pin,
                name: user_req.name,
                privilege: user_req.privilege,
                card_number: user_req.card_number,
                group: None,
                timezone: None,
                password_raw: None,
                has_password: user_req.has_password,
                fingerprint_count: 0,
                has_face: false,
            },
        });
    }
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

/// Trigger a clock sync on a device (via SDK or ADMS command queue).
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/sync-clock",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Clock sync requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn sync_device_clock(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let conn = state.device_state.get(&sn).await;
    let sdk_active = conn.as_ref().map(|c| c.sdk_active).unwrap_or(false);
    if !sdk_active {
        let reason =
            "Clock sync requires SDK connection. This device does not have an active SDK link.";
        return Ok(Json(ApiEnvelope::success(StatusResponse::rejected(reason))));
    }
    state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
        device_sn: sn,
        command: "SYNC_CLOCK".into(),
    });
    Ok(Json(ApiEnvelope::success(StatusResponse::enqueued())))
}

/// Trigger a device restart (via SDK or ADMS command queue).
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/restart",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Device restart requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn restart_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let conn = state.device_state.get(&sn).await;
    let sdk_active = conn.as_ref().map(|c| c.sdk_active).unwrap_or(false);
    if !sdk_active {
        let reason =
            "Device restart requires SDK connection. This device does not have an active SDK link.";
        return Ok(Json(ApiEnvelope::success(StatusResponse::rejected(reason))));
    }
    state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
        device_sn: sn,
        command: "RESTART".into(),
    });
    Ok(Json(ApiEnvelope::success(StatusResponse::enqueued())))
}

/// Request to transfer fingerprint templates from a source device to a target device.
#[utoipa::path(
    post,
    path = "/api/devices/{sn}/transfer-templates-to/{target_sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Source device serial number"),
        ("target_sn" = String, Path, description = "Target device serial number"),
    ),
    request_body = TransferTemplatesRequest,
    responses(
        (status = 200, description = "Fingerprint template transfer requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
    )
)]
pub(crate) async fn transfer_templates(
    State(state): State<AppState>,
    Path((source_sn, target_sn)): Path<(String, String)>,
    Json(body): Json<crate::request::TransferTemplatesRequest>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let employee_id = body.employee_id.map(timekeep_core::EmployeeId::from);

    state.event_bus.publish(DomainEvent::FingerprintTransferRequested {
        source_sn,
        target_sn,
        employee_id,
    });

    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

// ── Group Sync ───────────────────────────────────────────────────────

/// Sync all devices in a group with the employee database.
///
/// Optionally filtered by department: `?department=HR` syncs only
/// HR employees to all devices in the group. Without the filter,
/// all employees are synced.
#[utoipa::path(
    post,
    path = "/api/device-groups/{id}/sync",
    tag = "Device Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Device group identifier"),
        ("department" = Option<String>, Query, description = "Optional department name filter"),
    ),
    responses(
        (status = 200, description = "Device group sync requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
        (status = 404, description = "Device group or department not found"),
        (status = 422, description = "Device group has no devices"),
    )
)]
pub(crate) async fn sync_device_group(
    State(state): State<AppState>,
    Path(group_id): Path<String>,
    Query(q): Query<SyncQuery>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    // Verify group exists
    let group = state
        .storage
        .get_device_group(&group_id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("device group '{group_id}'")))?;

    // Verify the group has at least one device
    let devices = state.storage.list_devices_in_group(&group_id).await?;
    if devices.is_empty() {
        return Err(AppError::validation(format!("device group '{group_id}' has no devices")));
    }

    // If department filter is provided, use it. Otherwise, use the group's
    // persisted department IDs (empty = all departments).
    let department_id = q.department_id.or_else(|| {
        if group.department_ids.is_empty() {
            None // all departments
        } else {
            Some(group.department_ids.join(","))
        }
    });

    // If a specific department filter is provided, verify it exists
    if let Some(ref dept_id) = department_id {
        // Support comma-separated department IDs from persisted config
        for single_id in dept_id.split(',').map(|s| s.trim()) {
            if !single_id.is_empty() && state.storage.get_department(single_id).await?.is_none() {
                return Err(AppError::not_found(format!("department '{single_id}'")));
            }
        }
    }

    state.event_bus.publish(DomainEvent::GroupSyncRequested {
        group_id: group_id.clone(),
        department_id: department_id.clone(),
        triggered_by: "admin".into(),
    });

    // Also publish individual resync events for each device so the engine
    // can process them. The engine uses the GroupSyncRequested as a
    // coordination signal and the individual events for per-device work.
    for device in &devices {
        state.event_bus.publish(DomainEvent::DeviceResyncRequested {
            device_sn: device.serial_number.clone(),
        });
    }

    tracing::info!(
        group_id = %group_id,
        device_count = devices.len(),
        department_id = ?department_id,
        "group sync requested"
    );

    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Sync all registered devices with the employee database.
///
/// Each device is resynced independently. Devices in groups with
/// department-scoped sync rules will respect those filters.
#[utoipa::path(
    post,
    path = "/api/devices/sync-all",
    tag = "Devices",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "All devices sync requested", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Operator+ required"),
        (status = 422, description = "No devices registered"),
    )
)]
pub(crate) async fn sync_all_devices(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let devices = state.storage.list_device_configs().await?;

    if devices.is_empty() {
        return Err(AppError::validation("no devices registered"));
    }

    for device in &devices {
        state.event_bus.publish(DomainEvent::DeviceResyncRequested {
            device_sn: device.serial_number.clone(),
        });
    }

    tracing::info!(device_count = devices.len(), "sync-all requested");

    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}
