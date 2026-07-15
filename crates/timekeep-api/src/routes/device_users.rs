//! Device user management route handlers.
//!
//! Handlers for enrolling, deleting, and syncing users on devices.

use axum::Json;
use axum::extract::{Path, State};

use crate::app_state::AppState;
use crate::dto::StatusResponse;
use crate::request::{EnqueueCommandRequest, SetUserRequest};
use crate::response::{ApiEnvelope, AppError};
use timekeep_core::events::DomainEvent;

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
pub(crate) async fn sync_device_to_device(
    State(state): State<AppState>,
    Path((target_sn, source_sn)): Path<(String, String)>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::DeviceToDeviceSyncRequested { source_sn, target_sn });
    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Trigger a full device re-sync — delete all users and re-upload
/// from the employee database.
pub(crate) async fn resync_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::DeviceResyncRequested { device_sn: sn });
    Ok(Json(ApiEnvelope::success(StatusResponse::requested())))
}

/// Push multiple users to a device in a single request.
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
pub(crate) async fn sync_device_clock(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
        device_sn: sn,
        command: "SYNC_CLOCK".into(),
    });
    Ok(Json(ApiEnvelope::success(StatusResponse::enqueued())))
}

/// Trigger a device restart (via SDK or ADMS command queue).
pub(crate) async fn restart_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
        device_sn: sn,
        command: "RESTART".into(),
    });
    Ok(Json(ApiEnvelope::success(StatusResponse::enqueued())))
}

/// Request to transfer fingerprint templates from a source device to a target device.
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
