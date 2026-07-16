//! Device group management endpoints.
//!
//! Device groups organize biometric scanners for department-scoped
//! sync operations. Each group can contain multiple devices and be
//! targeted for batch sync with optional department filtering.
//!
//! ## Endpoints
//!
//! | Method | Path | Auth | Description |
//! |--------|------|------|-------------|
//! | GET | /api/device-groups | Viewer | List all groups |
//! | GET | /api/device-groups/{id} | Viewer | Get single group |
//! | POST | /api/device-groups | Admin | Create group |
//! | PUT | /api/device-groups/{id} | Admin | Update group |
//! | DELETE | /api/device-groups/{id} | Admin | Delete group |
//! | GET | /api/device-groups/{id}/devices | Viewer | List devices in group |
//! | PUT | /api/devices/{sn}/group | Admin | Set device group membership |

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};

use crate::AppState;
use crate::dto::{DeviceGroupResponse, DeviceResponse, StatusResponse};
use crate::request::{CreateDeviceGroupRequest, SetDeviceGroupRequest, UpdateDeviceGroupRequest};
use crate::response::{ApiEnvelope, AppError, PageMeta};

// ─── CRUD Endpoints ────────────────────────────────────────────────────

/// List all device groups.
#[utoipa::path(
    get,
    path = "/api/device-groups",
    tag = "Device Groups",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Device group list", body = Vec<DeviceGroupResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_groups(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<axum::response::Response, AppError> {
    let groups = state.storage.list_device_groups().await?;
    let responses: Vec<DeviceGroupResponse> =
        groups.iter().map(|g| DeviceGroupResponse::from_group(g, None)).collect();
    crate::response::build_sparse_envelope(responses, PageMeta::single(), &params.fields)
}

/// Get a single device group by ID.
#[utoipa::path(
    get,
    path = "/api/device-groups/{id}",
    tag = "Device Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Device group ID"),
    ),
    responses(
        (status = 200, description = "Device group details", body = DeviceGroupResponse),
        (status = 404, description = "Device group not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn get_group(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<DeviceGroupResponse>>, AppError> {
    let group = state
        .storage
        .get_device_group(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("device group '{id}'")))?;

    // Count devices in this group
    let devices = state.storage.list_devices_in_group(&id).await?;
    let device_count = if devices.is_empty() { None } else { Some(devices.len() as u64) };

    Ok(Json(ApiEnvelope::success(DeviceGroupResponse::from_group(&group, device_count))))
}

/// Create a new device group.
#[utoipa::path(
    post,
    path = "/api/device-groups",
    tag = "Device Groups",
    security(("bearer_auth" = [])),
    request_body = CreateDeviceGroupRequest,
    responses(
        (status = 201, description = "Device group created", body = DeviceGroupResponse),
        (status = 409, description = "Device group name already exists"),
        (status = 422, description = "Validation error"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn create_group(
    State(state): State<AppState>,
    Json(body): Json<CreateDeviceGroupRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DeviceGroupResponse>>), AppError> {
    let name = body.name.trim();
    if name.is_empty() {
        return Err(AppError::validation("group name must not be empty"));
    }

    // Check for duplicate name
    if state.storage.get_device_group_by_name(name).await?.is_some() {
        return Err(AppError::duplicate(format!("device group '{name}' already exists")));
    }

    let mut group = timekeep_core::DeviceGroup::new(name, body.description);
    if !body.department_ids.is_empty() {
        group.set_departments(body.department_ids);
    }
    state.storage.create_device_group(&group).await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiEnvelope::success(DeviceGroupResponse::from_group(&group, None))),
    ))
}

/// Update an existing device group.
#[utoipa::path(
    put,
    path = "/api/device-groups/{id}",
    tag = "Device Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Device group ID"),
    ),
    request_body = UpdateDeviceGroupRequest,
    responses(
        (status = 200, description = "Device group updated", body = DeviceGroupResponse),
        (status = 404, description = "Device group not found"),
        (status = 409, description = "Device group name already exists"),
        (status = 422, description = "Validation error"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn update_group(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDeviceGroupRequest>,
) -> Result<Json<ApiEnvelope<DeviceGroupResponse>>, AppError> {
    let mut group = state
        .storage
        .get_device_group(&id)
        .await?
        .ok_or_else(|| AppError::not_found(format!("device group '{id}'")))?;

    if let Some(ref new_name) = body.name {
        let name = new_name.trim();
        if name.is_empty() {
            return Err(AppError::validation("group name must not be empty"));
        }
        if name != group.name
            && let Some(existing) = state.storage.get_device_group_by_name(name).await?
            && existing.id.0 != group.id.0
        {
            return Err(AppError::duplicate(format!("device group '{name}' already exists")));
        }
        group.rename(name);
    }

    if body.description.is_some() {
        group.set_description(body.description);
    }

    if let Some(ref dept_ids) = body.department_ids {
        group.set_departments(dept_ids.clone());
    }

    state.storage.update_device_group(&group).await?;

    Ok(Json(ApiEnvelope::success(DeviceGroupResponse::from_group(&group, None))))
}

/// Delete a device group by ID.
#[utoipa::path(
    delete,
    path = "/api/device-groups/{id}",
    tag = "Device Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Device group ID"),
    ),
    responses(
        (status = 200, description = "Device group deleted"),
        (status = 404, description = "Device group not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn delete_group(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    if state.storage.get_device_group(&id).await?.is_none() {
        return Err(AppError::not_found(format!("device group '{id}'")));
    }

    state.storage.delete_device_group(&id).await?;

    Ok(Json(ApiEnvelope::success(StatusResponse::deleted())))
}

/// List all devices in a group.
#[utoipa::path(
    get,
    path = "/api/device-groups/{id}/devices",
    tag = "Device Groups",
    security(("bearer_auth" = [])),
    params(
        ("id" = String, Path, description = "Device group ID"),
    ),
    responses(
        (status = 200, description = "Devices in group", body = Vec<DeviceResponse>),
        (status = 404, description = "Device group not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_devices_in_group(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<axum::response::Response, AppError> {
    // Verify group exists
    if state.storage.get_device_group(&id).await?.is_none() {
        return Err(AppError::not_found(format!("device group '{id}'")));
    }

    let devices = state.storage.list_devices_in_group(&id).await?;
    let responses: Vec<DeviceResponse> = devices.iter().map(DeviceResponse::from).collect();

    crate::response::build_sparse_envelope(responses, PageMeta::single(), &params.fields)
}

/// Set a device's group membership.
#[utoipa::path(
    put,
    path = "/api/devices/{sn}/group",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    request_body = SetDeviceGroupRequest,
    responses(
        (status = 200, description = "Device group membership updated"),
        (status = 404, description = "Device or group not found"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn set_device_group(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Json(body): Json<SetDeviceGroupRequest>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    // If group_id is provided, verify the group exists
    if let Some(ref group_id) = body.group_id
        && state.storage.get_device_group(group_id).await?.is_none()
    {
        return Err(AppError::not_found(format!("device group '{group_id}'")));
    }

    state.storage.set_device_group_membership(&sn, body.group_id.as_deref()).await?;

    Ok(Json(ApiEnvelope::success(StatusResponse::updated())))
}
