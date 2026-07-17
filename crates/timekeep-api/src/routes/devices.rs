//! Device management route handlers.
//!
//! Covers all device CRUD, discovery, health, events, activity,
//! batch actions, and providers.

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;

use crate::app_state::AppState;
use crate::dto::{
    BatchActionResponse, DeviceActivityEntry, DeviceDetailResponse, DeviceDiscoverResponse,
    DeviceEventResponse, DeviceHealthEntry, DeviceHealthSummaryResponse, DeviceResponse,
    DeviceSummary, NetworkScanResponse, ProviderResponse, StatusResponse, SyncedUserResponse,
};
use crate::request::{
    AddDeviceRequest, BatchActionRequest, DeviceEventListQuery, DeviceSearchQuery,
    DiscoverDeviceRequest, ProvisionDeviceRequest, ScanNetworkRequest, UpdateDeviceRequest,
};
use crate::response::{ApiEnvelope, AppError, PageMeta};
use timekeep_core::events::DomainEvent;
use timekeep_core::{DeviceEventFilter, DeviceEventType};

/// List devices with search, sort, and pagination.
#[utoipa::path(
    get,
    path = "/api/devices",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(timekeep_core::ListParams),
    responses(
        (status = 200, description = "Device list with pagination", body = Vec<DeviceSummary>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_devices(
    State(state): State<AppState>,
    Query(params): Query<timekeep_core::ListParams>,
) -> Result<axum::response::Response, AppError> {
    use timekeep_core::DeviceFilter;

    let __fields = params.fields.clone();
    let filter = DeviceFilter { params };
    let result = state.storage.list_device_configs_filtered(&filter).await?;

    let mut items: Vec<DeviceSummary> = Vec::with_capacity(result.items.len());
    for config in &result.items {
        let conn = state.device_state.get(&config.serial_number).await;
        let (status, adms, sdk, last_seen, sdk_last_poll) = match conn {
            Some(info) => {
                let s =
                    if info.adms_active || info.sdk_active { "connected" } else { "disconnected" };
                (
                    s.to_string(),
                    info.adms_active,
                    info.sdk_active,
                    Some(info.last_seen),
                    info.last_poll,
                )
            },
            None => ("disconnected".to_string(), false, false, None, None),
        };
        items.push(DeviceSummary {
            serial_number: config.serial_number.clone(),
            label: config.label.clone(),
            host: config.host.clone(),
            port: config.port,
            push_enabled: config.push_enabled,
            vendor: config.vendor.clone(),
            connection_status: status,
            adms_active: adms,
            sdk_poll_active: sdk,
            sdk_last_poll,
            last_seen_at: last_seen,
            location: config.location.clone(),
            auto_registered: adms,
        });
    }

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    crate::response::build_sparse_envelope(items, meta, &__fields)
}

/// Get a single device by serial number.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Device details", body = DeviceDetailResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Device not found"),
    )
)]
pub(crate) async fn get_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<DeviceDetailResponse>>, AppError> {
    let configs = state.storage.list_device_configs().await?;
    let config = configs
        .iter()
        .find(|d| d.serial_number == sn)
        .ok_or_else(|| AppError::not_found(format!("device '{sn}' not found")))?;

    // Get enriched device info from storage (populated by get_device_info())
    let device_info = state.storage.get_device_info(&sn).await.ok().flatten();

    // Get synced user and record counts from the local database.
    // These are populated at startup by sync_users_to_storage() and the
    // punch ingestion pipeline. They're always available regardless of
    // whether the device is currently online.
    let synced_user_count = state.storage.count_device_users(&sn).await.unwrap_or(0);
    let synced_record_count = state.storage.count_device_records(&sn).await.unwrap_or(0);

    // Get real-time connection state
    let conn = state.device_state.get(&sn).await;
    let (adms, sdk, last_seen, sdk_last_poll) = match conn {
        Some(info) => (info.adms_active, info.sdk_active, Some(info.last_seen), info.last_poll),
        None => (false, false, None, None),
    };

    let detail = DeviceDetailResponse::from_parts(
        config,
        device_info.as_ref(),
        adms,
        sdk,
        last_seen,
        sdk_last_poll,
        synced_user_count,
        synced_record_count,
    );
    Ok(Json(ApiEnvelope::success(detail)))
}

/// List users synced from a specific device (from the local database).
///
/// Returns the list of (pin, name, privilege) tuples stored in the local
/// `users` table, populated by `sync_users_to_storage()` at startup.
/// This is read-only data available even when the device is offline.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}/synced-users",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Synced users for this device", body = Vec<SyncedUserResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_synced_device_users(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<Vec<SyncedUserResponse>>>, AppError> {
    let users = state
        .storage
        .list_device_users(&sn)
        .await
        .map_err(|e| AppError::Internal(format!("failed to list device users: {e}")))?;

    let response: Vec<SyncedUserResponse> = users
        .into_iter()
        .map(|(pin, name, privilege)| SyncedUserResponse {
            pin,
            name,
            privilege: privilege.unwrap_or(0),
        })
        .collect();

    Ok(Json(ApiEnvelope::success(response)))
}

/// Register a new biometric device.
#[utoipa::path(
    post,
    path = "/api/devices",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = AddDeviceRequest,
    responses(
        (status = 201, description = "Device registered", body = DeviceResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn add_device(
    State(state): State<AppState>,
    Json(body): Json<AddDeviceRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DeviceResponse>>), AppError> {
    if body.serial_number.is_empty() || body.host.is_empty() {
        return Err(AppError::validation("serial_number and host are required"));
    }

    let config = timekeep_core::DeviceConfig {
        label: body.label.unwrap_or_else(|| body.serial_number.clone()),
        serial_number: body.serial_number.clone(),
        host: body.host,
        port: body.port,
        comm_key: body.comm_key,
        push_enabled: body.push_enabled,
        timezone: body.timezone,
        vendor: body.vendor.clone().unwrap_or_else(|| "zkteco".into()),
        location: body.location.clone(),
        poll_interval_secs: body.poll_interval_secs,
        group_id: body.group_id.clone(),
    };

    state.storage.upsert_device_config(&config).await?;

    state.event_bus.publish(DomainEvent::DeviceRegistered { device_sn: body.serial_number });

    let resp = DeviceResponse::from(&config);
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(resp))))
}

/// Update an existing device configuration.
#[utoipa::path(
    put,
    path = "/api/devices/{sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    request_body = UpdateDeviceRequest,
    responses(
        (status = 200, description = "Device updated", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 404, description = "Device not found"),
    )
)]
pub(crate) async fn update_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Json(body): Json<UpdateDeviceRequest>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    let configs = state.storage.list_device_configs().await?;
    let existing = configs
        .into_iter()
        .find(|d| d.serial_number == sn)
        .ok_or_else(|| AppError::not_found(format!("device '{sn}' not found")))?;

    let config = timekeep_core::DeviceConfig {
        label: body.label.unwrap_or(existing.label),
        serial_number: sn,
        host: body.host.unwrap_or(existing.host),
        port: body.port.unwrap_or(existing.port),
        comm_key: body.comm_key.unwrap_or(existing.comm_key),
        push_enabled: body.push_enabled.unwrap_or(existing.push_enabled),
        timezone: body.timezone.or(existing.timezone),
        vendor: body.vendor.unwrap_or(existing.vendor),
        location: body.location.or(existing.location),
        poll_interval_secs: body.poll_interval_secs.or(existing.poll_interval_secs),
        group_id: body.group_id.or(existing.group_id),
    };

    state.storage.upsert_device_config(&config).await?;
    Ok(Json(ApiEnvelope::success(StatusResponse::updated())))
}

/// Remove a device from the registry.
#[utoipa::path(
    delete,
    path = "/api/devices/{sn}",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Device removed", body = StatusResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn remove_device(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<StatusResponse>>, AppError> {
    // Verify existence first
    if state.storage.list_device_configs().await?.iter().all(|d| d.serial_number != sn) {
        return Err(AppError::not_found(format!("device '{sn}'")));
    }
    state.storage.delete_device_config(&sn).await?;
    state.event_bus.publish(DomainEvent::DeviceRemoved { device_sn: sn });
    Ok(Json(ApiEnvelope::success(StatusResponse::deleted())))
}

// ── Device Events (activity timeline) ────────────────────────────────

/// Get the activity timeline for a device.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}/events",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(
        ("sn" = String, Path, description = "Device serial number"),
        DeviceEventListQuery,
    ),
    responses(
        (status = 200, description = "Device events with pagination", body = Vec<DeviceEventResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn device_events(
    State(state): State<AppState>,
    Path(sn): Path<String>,
    Query(query): Query<DeviceEventListQuery>,
) -> Result<Json<ApiEnvelope<Vec<DeviceEventResponse>>>, AppError> {
    let event_types: Option<Vec<DeviceEventType>> = query.event_types.as_ref().and_then(|s| {
        let types: Vec<DeviceEventType> = s
            .split(',')
            .filter_map(|k| match k.trim() {
                "came_online" => Some(DeviceEventType::CameOnline),
                "went_offline" => Some(DeviceEventType::WentOffline { reason: "".into() }),
                "sync_started" => Some(DeviceEventType::SyncStarted),
                "sync_completed" => {
                    Some(DeviceEventType::SyncCompleted { records_synced: 0, duration_ms: 0 })
                },
                "sync_failed" => {
                    Some(DeviceEventType::SyncFailed { error: "".into(), records_synced: 0 })
                },
                "storage_warning" => Some(DeviceEventType::StorageWarning {
                    records_used: 0,
                    records_capacity: 0,
                    percentage: 0.0,
                }),
                "config_changed" => Some(DeviceEventType::ConfigChanged {
                    field: "".into(),
                    old_value: None,
                    new_value: None,
                }),
                "provisioning_started" => Some(DeviceEventType::ProvisioningStarted),
                "provisioning_completed" => Some(DeviceEventType::ProvisioningCompleted),
                "decommissioned" => Some(DeviceEventType::Decommissioned),
                "firmware_updated" => Some(DeviceEventType::FirmwareUpdated {
                    old_version: "".into(),
                    new_version: "".into(),
                }),
                "operation_log" => Some(DeviceEventType::OperationLog {
                    op_type: "".into(),
                    admin_pin: "".into(),
                    detail: None,
                }),
                "user_synced" => Some(DeviceEventType::UserSynced {
                    action: "".into(),
                    pin: "".into(),
                    name: None,
                }),
                "device_command_executed" => {
                    Some(DeviceEventType::DeviceCommandExecuted { command: "".into() })
                },
                _ => None,
            })
            .collect();
        if types.is_empty() { None } else { Some(types) }
    });

    let filter = DeviceEventFilter {
        params: timekeep_core::ListParams {
            sort_by: Some(query.sort_by),
            sort_order: query.sort_order,
            limit: query.limit.min(200),
            cursor: query.cursor,
            fields: None,
            include: None,
            ..Default::default()
        },
        device_sn: Some(sn),
        event_types,
        since: query.since.map(|s| jiff::Timestamp::from_second(s).unwrap()),
        until: query.until.map(|s| jiff::Timestamp::from_second(s).unwrap()),
    };

    let result = state.storage.query_device_events(&filter).await?;
    let items: Vec<DeviceEventResponse> = result.items.iter().map(|e| e.into()).collect();

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    Ok(Json(ApiEnvelope::paginated(items, meta)))
}

/// Unified activity feed for a single device.
///
/// Merges device-originated events (online, offline, sync, operation logs)
/// with server-side audit log entries (device created, user pushed, settings
/// changed) into a single chronologically-sorted timeline.
#[utoipa::path(
    get,
    path = "/api/devices/{sn}/activity",
    params(
        ("sn" = String, Path, description = "Device serial number"),
    ),
    responses(
        (status = 200, description = "Paginated activity feed entries"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Device not found"),
    ),
    tag = "Devices",
)]
pub(crate) async fn device_activity(
    State(state): State<AppState>,
    Path(sn): Path<String>,
) -> Result<Json<ApiEnvelope<Vec<DeviceActivityEntry>>>, AppError> {
    // Verify device exists
    let configs = state.storage.list_device_configs().await?;
    if !configs.iter().any(|d| d.serial_number == sn) {
        return Err(AppError::not_found(format!("device '{sn}' not found")));
    }

    // 1. Get device events (last 50)
    let device_filter = DeviceEventFilter {
        device_sn: Some(sn.clone()),
        params: timekeep_core::ListParams { limit: 50, ..Default::default() },
        ..Default::default()
    };
    let device_result = state.storage.query_device_events(&device_filter).await?;
    let mut entries: Vec<DeviceActivityEntry> = device_result
        .items
        .iter()
        .map(|e| DeviceActivityEntry::from_device_event(e, crate::dto::device_event_label))
        .collect();

    // 2. Get audit logs related to this device (last 20)
    let audit_result = state.storage.query_device_audit_logs(&sn, 20, 0).await?;
    for a in &audit_result.items {
        entries.push(DeviceActivityEntry::from_audit_event(a));
    }

    // 3. Sort by timestamp descending and dedup by ID
    entries.sort_by(|a, b| b.ts_secs.cmp(&a.ts_secs).then_with(|| b.id.cmp(&a.id)));
    let mut seen = std::collections::HashSet::new();
    entries.retain(|e| seen.insert(e.id.clone()));

    // 4. Limit to 50 entries
    entries.truncate(50);

    Ok(Json(ApiEnvelope::success(entries)))
}

// ── Device Search ────────────────────────────────────────────────────

/// Search devices with rich filters.
#[utoipa::path(
    get,
    path = "/api/devices/search",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(DeviceSearchQuery),
    responses(
        (status = 200, description = "Search results with pagination", body = Vec<DeviceSummary>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn search_devices(
    State(state): State<AppState>,
    Query(query): Query<DeviceSearchQuery>,
) -> Result<axum::response::Response, AppError> {
    use timekeep_core::DeviceFilter;

    let filter = DeviceFilter {
        params: timekeep_core::ListParams {
            search: query.q,
            sort_by: Some(query.sort_by),
            sort_order: query.sort_order,
            limit: query.limit.min(200),
            cursor: query.cursor,
            fields: query.fields.clone(),
            include: query.include.clone(),
        },
    };

    let result = state.storage.list_device_configs_filtered(&filter).await?;

    let mut items: Vec<DeviceSummary> = Vec::with_capacity(result.items.len());
    for config in &result.items {
        // Apply in-memory filters for vendor, status, location
        if let Some(v) = &query.vendor
            && config.vendor != *v
        {
            continue;
        }
        if let Some(loc) = &query.location
            && config.location.as_deref() != Some(loc.as_str())
        {
            continue;
        }

        let conn = state.device_state.get(&config.serial_number).await;
        let (status, adms, sdk, last_seen, sdk_last_poll) = match conn {
            Some(info) => {
                let s =
                    if info.adms_active || info.sdk_active { "connected" } else { "disconnected" };
                (
                    s.to_string(),
                    info.adms_active,
                    info.sdk_active,
                    Some(info.last_seen),
                    info.last_poll,
                )
            },
            None => ("disconnected".to_string(), false, false, None, None),
        };

        if let Some(st) = &query.status
            && status != *st
        {
            continue;
        }

        items.push(DeviceSummary {
            serial_number: config.serial_number.clone(),
            label: config.label.clone(),
            host: config.host.clone(),
            port: config.port,
            push_enabled: config.push_enabled,
            vendor: config.vendor.clone(),
            connection_status: status,
            adms_active: adms,
            sdk_poll_active: sdk,
            sdk_last_poll,
            last_seen_at: last_seen,
            location: config.location.clone(),
            auto_registered: adms,
        });
    }

    let meta = PageMeta {
        has_more: result.has_more,
        next_cursor: result.next_cursor,
        total: result.total,
    };

    crate::response::build_sparse_envelope(items, meta, &query.fields)
}

// ── Device Health ────────────────────────────────────────────────────

/// Get aggregate health summary for all devices.
#[utoipa::path(
    get,
    path = "/api/devices/health",
    tag = "Devices",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Device health summary", body = DeviceHealthSummaryResponse),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn devices_health(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<DeviceHealthSummaryResponse>>, AppError> {
    let configs = state.storage.list_device_configs().await?;
    let mut entries = Vec::with_capacity(configs.len());
    let mut online = 0usize;
    let mut offline = 0usize;
    let mut syncing = 0usize;
    let mut errors = 0usize;

    for config in &configs {
        let conn = state.device_state.get(&config.serial_number).await;
        let (status, last_seen) = match conn {
            Some(info) => {
                let s = if info.adms_active || info.sdk_active { "online" } else { "offline" };
                (s.to_string(), Some(info.last_seen))
            },
            None => ("offline".to_string(), None),
        };

        // Get device info for record usage
        let record_usage = state
            .storage
            .get_device_info(&config.serial_number)
            .await
            .ok()
            .flatten()
            .map(|d| d.record_usage_pct())
            .unwrap_or(0.0);

        match status.as_str() {
            "online" => online += 1,
            "offline" => offline += 1,
            "syncing" => syncing += 1,
            "error" => errors += 1,
            _ => offline += 1,
        }

        entries.push(DeviceHealthEntry {
            serial_number: config.serial_number.clone(),
            label: config.label.clone(),
            status: status.clone(),
            record_usage_pct: record_usage,
            last_seen_at: last_seen,
        });
    }

    let summary = DeviceHealthSummaryResponse {
        total: configs.len(),
        online,
        offline,
        syncing,
        errors,
        devices: entries,
    };

    Ok(Json(ApiEnvelope::success(summary)))
}

// ── Device Discovery ─────────────────────────────────────────────────

/// Probe a device to auto-detect vendor and extract identity.
#[utoipa::path(
    post,
    path = "/api/devices/discover",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = DiscoverDeviceRequest,
    responses(
        (status = 200, description = "Discovery result", body = DeviceDiscoverResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn discover_device(
    State(state): State<AppState>,
    Json(body): Json<DiscoverDeviceRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DeviceDiscoverResponse>>), AppError> {
    if body.host.is_empty() {
        return Err(AppError::validation("host is required"));
    }

    match state.provider_registry.probe_all(&body.host, body.port).await {
        Ok(probe) => {
            state.event_bus.publish(DomainEvent::DeviceDiscovered { probe: probe.clone() });
            let resp = DeviceDiscoverResponse::from_probe_with_ip(&probe, &body.host);
            Ok((StatusCode::OK, Json(ApiEnvelope::success(resp))))
        },
        Err(_) => {
            let mut resp = DeviceDiscoverResponse::unreachable();
            resp.ip_address = Some(body.host.clone());
            Ok((StatusCode::OK, Json(ApiEnvelope::success(resp))))
        },
    }
}

// ── Network Scan ────────────────────────────────────────────────────

/// Scan the local network for biometric devices.
#[utoipa::path(
    post,
    path = "/api/devices/scan",
    tag = "Discovery",
    security(("bearer_auth" = [])),
    request_body = ScanNetworkRequest,
    responses(
        (status = 200, description = "Scan completed — list of discovered devices", body = NetworkScanResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
    )
)]
pub(crate) async fn scan_network(
    State(state): State<AppState>,
    Json(body): Json<ScanNetworkRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<NetworkScanResponse>>), AppError> {
    // Auto-detect subnet if not provided
    let subnet = body.subnet.unwrap_or_else(|| {
        timekeep_core::network_scanner::detect_local_subnets()
            .into_iter()
            .next()
            .unwrap_or_else(|| "192.168.1".to_string())
    });
    let port = body.port;

    let probes = state
        .provider_registry
        .scan_subnet(&subnet, port)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let devices: Vec<DeviceDiscoverResponse> =
        probes.iter().map(DeviceDiscoverResponse::from_probe).collect();

    let resp =
        NetworkScanResponse { subnet, hosts_scanned: 254, devices_found: devices.len(), devices };

    Ok((StatusCode::OK, Json(ApiEnvelope::success(resp))))
}

// ── Device Provisioning ──────────────────────────────────────────────

/// Finalize device provisioning after discovery.
#[utoipa::path(
    post,
    path = "/api/devices/provision",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = ProvisionDeviceRequest,
    responses(
        (status = 201, description = "Device provisioned", body = DeviceResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn provision_device(
    State(state): State<AppState>,
    Json(body): Json<ProvisionDeviceRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<DeviceResponse>>), AppError> {
    if body.serial_number.is_empty() || body.host.is_empty() || body.label.is_empty() {
        return Err(AppError::validation("serial_number, host, and label are required"));
    }

    let config = timekeep_core::DeviceConfig {
        label: body.label.clone(),
        serial_number: body.serial_number.clone(),
        host: body.host,
        port: body.port,
        comm_key: body.comm_key,
        timezone: body.timezone,
        push_enabled: body.push_enabled,
        vendor: body.vendor,
        location: body.location,
        poll_interval_secs: body.poll_interval_secs,
        group_id: None,
    };

    state.storage.upsert_device_config(&config).await?;

    state.event_bus.publish(DomainEvent::DeviceProvisioned {
        device_sn: body.serial_number.clone(),
        provider: config.vendor.clone(),
    });

    let resp = DeviceResponse::from(&config);
    Ok((StatusCode::CREATED, Json(ApiEnvelope::success(resp))))
}

// ── Providers ────────────────────────────────────────────────────────

/// List all registered device providers (vendors).
#[utoipa::path(
    get,
    path = "/api/providers",
    tag = "Providers",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Provider list", body = Vec<ProviderResponse>),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn list_providers(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<ProviderResponse>>>, AppError> {
    let providers: Vec<ProviderResponse> =
        state.provider_registry.list().iter().map(|p| p.into()).collect();
    Ok(Json(ApiEnvelope::success(providers)))
}

// ── Batch Actions ────────────────────────────────────────────────────

/// Execute a batch action on multiple devices.
#[utoipa::path(
    post,
    path = "/api/devices/batch",
    tag = "Devices",
    security(("bearer_auth" = [])),
    request_body = BatchActionRequest,
    responses(
        (status = 200, description = "Batch action result", body = BatchActionResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — Admin only"),
        (status = 422, description = "Validation error"),
    )
)]
pub(crate) async fn batch_action(
    State(state): State<AppState>,
    Json(body): Json<BatchActionRequest>,
) -> Result<Json<ApiEnvelope<BatchActionResponse>>, AppError> {
    if body.device_sns.is_empty() {
        return Err(AppError::validation("device_sns must not be empty"));
    }

    let total = body.device_sns.len();
    let mut succeeded = 0usize;
    let mut failed = 0usize;
    let mut errors = Vec::new();

    for sn in &body.device_sns {
        match body.action.as_str() {
            "sync_now" => {
                state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
                    device_sn: sn.clone(),
                    command: "SYNC".into(),
                });
                succeeded += 1;
            },
            "enable" | "disable" | "restart" | "sync_clock" => {
                let cmd = if body.action == "sync_clock" {
                    "SYNC_CLOCK".to_string()
                } else {
                    body.action.to_uppercase()
                };
                state.event_bus.publish(DomainEvent::DeviceCommandEnqueueRequested {
                    device_sn: sn.clone(),
                    command: cmd,
                });
                succeeded += 1;
            },
            other => {
                failed += 1;
                errors.push(format!("{sn}: unknown action '{other}'"));
            },
        }
    }

    let resp = BatchActionResponse {
        action: body.action,
        total,
        succeeded,
        failed,
        errors: if errors.is_empty() { None } else { Some(errors) },
    };

    Ok(Json(ApiEnvelope::success(resp)))
}

/// Return the entity schema for devices.
#[utoipa::path(
    get,
    path = "/api/devices/schema",
    tag = "Devices",
    security(("bearer_auth" = [])),
    responses(
        (status = 200, description = "Device entity schema metadata", body = timekeep_core::EntitySchema),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn device_schema() -> Json<ApiEnvelope<timekeep_core::EntitySchema>> {
    Json(ApiEnvelope::success(timekeep_core::DEVICE_SCHEMA.clone()))
}

/// Return faceted filter metadata for devices.
#[utoipa::path(
    get,
    path = "/api/devices/filters",
    tag = "Devices",
    security(("bearer_auth" = [])),
    params(crate::request::GenericFacetParams),
    responses(
        (status = 200, description = "Device facet metadata"),
        (status = 401, description = "Unauthorized"),
    )
)]
pub(crate) async fn device_filters(
    State(state): State<AppState>,
    Query(q): Query<crate::request::GenericFacetParams>,
) -> Result<Json<ApiEnvelope<Vec<timekeep_core::FacetGroup>>>, AppError> {
    use std::collections::HashMap;
    use timekeep_core::{FacetContext, FacetQuery};

    let mut filters = HashMap::new();
    if let Some(ref v) = q.vendor {
        filters.insert("vendor".to_string(), vec![v.clone()]);
    }
    if let Some(ref v) = q.status {
        filters.insert("status".to_string(), vec![v.clone()]);
    }
    if let Some(ref v) = q.push_enabled {
        filters.insert("push_enabled".to_string(), vec![v.clone()]);
    }

    let query = FacetQuery {
        dimension: q.dimension.clone(),
        search: q.search.clone(),
        limit: q.limit.clamp(1, 100),
        context: FacetContext { filters, ..FacetContext::default() },
    };

    let groups = state.storage.device_facets(&query).await?;
    Ok(Json(ApiEnvelope::success(groups)))
}
