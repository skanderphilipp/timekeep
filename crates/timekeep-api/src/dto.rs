//! Typed response DTOs with `From` impls from domain types.
//!
//! Every handler returns one of these structs wrapped in `ApiEnvelope<T>`.
//! The `From` impls centralize field mapping — add a field to the domain
//! type and the API response picks it up automatically.

use serde::Serialize;
use timekeep_core::model::{
    AttendancePunch, Device, DeviceConfig, DeviceEvent, DeviceEventType, DeviceProbe,
    ProviderCapabilities, ProviderInfo, PunchStatus,
};
use utoipa::ToSchema;

use crate::response::WorkPolicyResponse;

// ─── Auth ───────────────────────────────────────────────────────────

/// Response returned by `POST /api/auth/login`.
///
/// Includes the JWT token AND the user's profile (role + permissions)
/// so the frontend can populate `currentUserAtom` immediately — no
/// second round-trip to `/api/auth/me` is needed after login.
///
/// On subsequent page loads, the frontend calls `/api/auth/me` to
/// re-hydrate the user state from the stored JWT.
#[derive(Debug, Serialize, ToSchema)]
pub struct LoginResponse {
    /// JWT Bearer token for subsequent API requests.
    pub token: String,
    /// Token lifetime in seconds.
    pub expires_in: u64,
    /// Always "Bearer".
    pub token_type: &'static str,

    // ── User profile (avoids extra /me round-trip after login) ──
    /// Logged-in username.
    pub username: String,
    /// Role: "admin", "operator", or "viewer".
    pub role: String,
    /// Space-separated permission tokens.
    pub permissions: String,
}

impl LoginResponse {
    pub fn new(
        token: String,
        expires_in_secs: u64,
        username: String,
        role: timekeep_core::Role,
        permissions: timekeep_core::PermissionSet,
    ) -> Self {
        Self {
            token,
            expires_in: expires_in_secs,
            token_type: "Bearer",
            username,
            role: role.to_string(),
            permissions: permissions.to_space_separated(),
        }
    }
}

// ─── Devices ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceResponse {
    pub serial_number: String,
    pub label: String,
    pub host: String,
    pub port: u16,
    pub comm_key: u32,
    pub push_enabled: bool,
    pub timezone: Option<String>,
    pub vendor: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub poll_interval_secs: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    /// Human-readable device group name.
    /// Populated when `?include=group` is requested.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_name: Option<String>,
}

impl DeviceResponse {
    pub fn from_config(c: &DeviceConfig, group_name: Option<String>) -> Self {
        Self {
            serial_number: c.serial_number.clone(),
            label: c.label.clone(),
            host: c.host.clone(),
            port: c.port,
            comm_key: c.comm_key,
            push_enabled: c.push_enabled,
            timezone: c.timezone.clone(),
            vendor: c.vendor.clone(),
            location: c.location.clone(),
            poll_interval_secs: c.poll_interval_secs,
            group_id: c.group_id.clone(),
            group_name,
        }
    }
}

impl From<&DeviceConfig> for DeviceResponse {
    fn from(c: &DeviceConfig) -> Self {
        Self::from_config(c, None)
    }
}

/// A user synced from a device and stored in the local database.
/// Used by the "Users on Device" tab in the dashboard.
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncedUserResponse {
    /// Device PIN / employee number.
    pub pin: String,
    /// Display name from the device.
    pub name: String,
    /// Privilege level (0 = normal, 14 = admin).
    pub privilege: i32,
}

/// Minimal device summary for list endpoints.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceSummary {
    pub serial_number: String,
    pub label: String,
    pub host: String,
    pub port: u16,
    pub push_enabled: bool,
    pub vendor: String,

    /// Real connection state: "connected", "disconnected", "error"
    pub connection_status: String,

    /// Whether ADMS push (real-time events) is active
    pub adms_active: bool,

    /// Whether the SDK poll loop is running for this device
    pub sdk_poll_active: bool,

    /// Last time the SDK poller successfully reached the device (Unix seconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_last_poll: Option<i64>,

    /// Last time the device was seen (Unix seconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<i64>,

    /// Physical location
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,

    /// Whether this device was auto-registered via ADMS discovery
    /// (as opposed to being manually configured). When true, the device
    /// came online through the ZKTeco provider's ADMS push without any
    /// manual SDK polling configuration.
    #[serde(default, skip_serializing_if = "is_false")]
    pub auto_registered: bool,
}

fn is_false(b: &bool) -> bool {
    !*b
}

impl From<&DeviceConfig> for DeviceSummary {
    fn from(c: &DeviceConfig) -> Self {
        Self {
            serial_number: c.serial_number.clone(),
            label: c.label.clone(),
            host: c.host.clone(),
            port: c.port,
            push_enabled: c.push_enabled,
            vendor: c.vendor.clone(),
            connection_status: "unknown".into(),
            adms_active: false,
            sdk_poll_active: false,
            sdk_last_poll: None,
            last_seen_at: None,
            location: c.location.clone(),
            auto_registered: false,
        }
    }
}

impl From<&Device> for DeviceSummary {
    fn from(d: &Device) -> Self {
        Self {
            serial_number: d.serial_number.clone(),
            label: d.label.clone().unwrap_or_else(|| d.model.clone()),
            host: d.ip_address.clone(),
            port: 0,
            push_enabled: true,
            vendor: d.vendor.key(),
            connection_status: format!("{:?}", d.status).to_lowercase(),
            adms_active: false,
            sdk_poll_active: false,
            sdk_last_poll: None,
            last_seen_at: d.last_seen.map(|t| t.as_second()),
            location: d.location.clone(),
            auto_registered: false,
        }
    }
}

/// Full device detail — identity, health, capacity, sync status.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceDetailResponse {
    #[serde(flatten)]
    pub config: DeviceResponse,

    // ── Identity ──
    pub vendor: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub firmware_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,

    // ── Health ──
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_seen_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_seconds: Option<u64>,

    // ── Connection ──
    pub adms_active: bool,
    pub sdk_poll_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_last_poll: Option<i64>,

    // ── Capabilities (derived from connection mode) ──
    /// Device connection mode: "sdk", "adms", "both", or "offline".
    pub mode: String,
    /// Whether SDK-dependent operations are available.
    pub can_pull_attendance: bool,
    pub can_sync_users: bool,
    pub can_restart: bool,
    pub can_sync_clock: bool,
    pub can_enroll_finger: bool,

    // ── Capacity ──
    pub user_count: u32,
    pub user_capacity: u32,
    pub record_count: u32,
    pub record_capacity: u32,
    /// Record storage usage as a percentage (0.0–100.0).
    pub record_usage_pct: f64,
    pub fingerprint_count: u32,
    pub fingerprint_capacity: u32,
    pub face_count: u32,
    pub face_capacity: u32,

    // ── Sync ──
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_cursor: Option<i64>,
}

impl DeviceDetailResponse {
    /// Build from DeviceConfig + optional enriched Device info + connection state.
    ///
    /// `synced_user_count` and `synced_record_count` come from the local database
    /// (synced from devices at startup). They take precedence over the live Device
    /// struct values when provided (non-zero). This ensures the dashboard shows real
    /// numbers even when the device is offline.
    #[allow(clippy::too_many_arguments)]
    pub fn from_parts(
        config: &DeviceConfig,
        device: Option<&Device>,
        adms_active: bool,
        sdk_active: bool,
        last_seen: Option<i64>,
        sdk_last_poll: Option<i64>,
        synced_user_count: u32,
        synced_record_count: u32,
    ) -> Self {
        let d = device;
        // Derive status from live connection state, not stored Device struct.
        // The stored Device.status was set at connect time and never updated.
        let status = if adms_active || sdk_active {
            "connected"
        } else if last_seen.is_some() {
            "disconnected"
        } else {
            "offline"
        };

        // Device mode and capabilities derived from live connection state.
        let mode = match (adms_active, sdk_active) {
            (true, true) => "both",
            (false, true) => "sdk",
            (true, false) => "adms",
            (false, false) => "offline",
        };
        let has_sdk = sdk_active;

        // Use DB-synced counts as primary source; fall back to live device info
        let user_count = if synced_user_count > 0 {
            synced_user_count
        } else {
            d.map(|d| d.user_count).unwrap_or(0)
        };
        let record_count = if synced_record_count > 0 {
            synced_record_count
        } else {
            d.map(|d| d.record_count).unwrap_or(0)
        };

        Self {
            config: DeviceResponse::from(config),
            vendor: d.map(|d| d.vendor.key()).unwrap_or_else(|| config.vendor.clone()),
            model: d.and_then(|d| if d.model.is_empty() { None } else { Some(d.model.clone()) }),
            firmware_version: d.and_then(|d| {
                if d.firmware_version.is_empty() { None } else { Some(d.firmware_version.clone()) }
            }),
            platform: d
                .and_then(|d| if d.platform.is_empty() { None } else { Some(d.platform.clone()) }),
            mac_address: d.and_then(|d| {
                if d.mac_address.is_empty() { None } else { Some(d.mac_address.clone()) }
            }),
            status: status.to_string(),
            last_seen_at: d.and_then(|d| d.last_seen).map(|t| t.as_second()).or(last_seen),
            first_seen_at: d.and_then(|d| d.first_seen).map(|t| t.as_second()),
            uptime_seconds: d.and_then(|d| d.uptime_seconds),
            adms_active,
            sdk_poll_active: sdk_active,
            sdk_last_poll,
            mode: mode.to_string(),
            can_pull_attendance: has_sdk,
            can_sync_users: has_sdk,
            can_restart: has_sdk,
            can_sync_clock: has_sdk,
            can_enroll_finger: has_sdk,
            user_count,
            user_capacity: d.map(|d| d.user_capacity).unwrap_or(0),
            record_count,
            record_capacity: d.map(|d| d.record_capacity).unwrap_or(0),
            record_usage_pct: d.map(|d| d.record_usage_pct()).unwrap_or(0.0),
            fingerprint_count: d.map(|d| d.fingerprint_count).unwrap_or(0),
            fingerprint_capacity: d.map(|d| d.fingerprint_capacity).unwrap_or(0),
            face_count: d.map(|d| d.face_count).unwrap_or(0),
            face_capacity: d.map(|d| d.face_capacity).unwrap_or(0),
            last_sync_at: d.and_then(|d| d.last_sync_at).map(|t| t.as_second()),
            last_sync_cursor: d.and_then(|d| d.last_sync_cursor).map(|t| t.as_second()),
        }
    }

    /// Legacy: build from config only (no device info available).
    pub fn from_config(config: &DeviceConfig, device: Option<&Device>) -> Self {
        Self::from_parts(config, device, false, false, None, None, 0, 0)
    }

    /// Build a "not found" placeholder.
    pub fn not_found(sn: &str) -> Self {
        Self {
            config: DeviceResponse {
                serial_number: sn.to_string(),
                label: sn.to_string(),
                host: String::new(),
                port: 0,
                comm_key: 0,
                push_enabled: false,
                timezone: None,
                vendor: String::new(),
                location: None,
                poll_interval_secs: None,
                group_id: None,
                group_name: None,
            },
            vendor: String::new(),
            model: None,
            firmware_version: None,
            platform: None,
            mac_address: None,
            status: "not_found".into(),
            last_seen_at: None,
            first_seen_at: None,
            uptime_seconds: None,
            adms_active: false,
            sdk_poll_active: false,
            sdk_last_poll: None,
            mode: "offline".into(),
            can_pull_attendance: false,
            can_sync_users: false,
            can_restart: false,
            can_sync_clock: false,
            can_enroll_finger: false,
            user_count: 0,
            user_capacity: 0,
            record_count: 0,
            record_capacity: 0,
            record_usage_pct: 0.0,
            fingerprint_count: 0,
            fingerprint_capacity: 0,
            face_count: 0,
            face_capacity: 0,
            last_sync_at: None,
            last_sync_cursor: None,
        }
    }
}

// ─── Device Events (activity timeline) ─────────────────────────────

/// A single device lifecycle event for the activity timeline.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceEventResponse {
    pub id: String,
    pub device_sn: String,
    /// Unix timestamp (seconds).
    pub timestamp: i64,
    /// Event type key (e.g. "came_online", "sync_completed").
    pub event_type: String,
    /// Human-readable label (e.g. "Came online", "Sync completed (+27 records, 1.2s)").
    pub label: String,
    /// Whether this event represents a problem (for visual alerting).
    pub is_problem: bool,
}

impl From<&DeviceEvent> for DeviceEventResponse {
    fn from(e: &DeviceEvent) -> Self {
        Self {
            id: e.id.clone(),
            device_sn: e.device_sn.clone(),
            timestamp: e.timestamp.as_second(),
            event_type: e.event_type.key().to_string(),
            label: device_event_label(e),
            is_problem: e.event_type.is_problem(),
        }
    }
}

/// Build a human-readable label from a device event.
pub(crate) fn device_event_label(e: &DeviceEvent) -> String {
    match &e.event_type {
        DeviceEventType::CameOnline => "Came online".into(),
        DeviceEventType::WentOffline { reason } => format!("Went offline ({reason})"),
        DeviceEventType::SyncStarted => "Sync started".into(),
        DeviceEventType::SyncCompleted { records_synced, duration_ms } => {
            let secs = *duration_ms as f64 / 1000.0;
            format!("Sync completed (+{records_synced} records, {secs:.1}s)")
        },
        DeviceEventType::SyncFailed { error, records_synced, duration_ms } => {
            let secs = *duration_ms as f64 / 1000.0;
            format!("Sync failed (+{records_synced} records, error: {error}, {secs:.1}s)")
        },
        DeviceEventType::StorageWarning { percentage, records_used, records_capacity } => {
            format!("Storage warning: {percentage:.0}% used ({records_used}/{records_capacity})")
        },
        DeviceEventType::ConfigChanged { field, old_value, new_value } => {
            let old = old_value.as_deref().unwrap_or("(none)");
            let new = new_value.as_deref().unwrap_or("(none)");
            format!("Config changed: {field} ({old} → {new})")
        },
        DeviceEventType::ProvisioningStarted => "Provisioning started".into(),
        DeviceEventType::ProvisioningCompleted => "Provisioning completed".into(),
        DeviceEventType::Decommissioned => "Decommissioned".into(),
        DeviceEventType::FirmwareUpdated { old_version, new_version } => {
            format!("Firmware updated: {old_version} → {new_version}")
        },
        DeviceEventType::OperationLog { op_type, admin_pin, .. } => {
            format!("Device operation: {op_type} (admin: {admin_pin})")
        },
        DeviceEventType::UserSynced { action, pin, name } => {
            let name_str = name.as_deref().unwrap_or("unknown");
            format!("User {action}: {pin} ({name_str})")
        },
        DeviceEventType::DeviceCommandExecuted { command } => {
            format!("Device command: {command}")
        },
    }
}

// ─── Device Discovery & Provisioning ───────────────────────────────

/// Response from probing a device (discovery step).
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceDiscoverResponse {
    /// Whether the device responded to the probe.
    pub reachable: bool,
    /// The IP address or hostname that was probed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    /// Detected vendor key (e.g. "zkteco").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    /// Device serial number.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    /// Device model name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Firmware version.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub firmware_version: Option<String>,
    /// Hardware platform.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    /// MAC address.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,
    /// Currently enrolled users.
    pub user_count: u32,
    /// Current attendance records stored.
    pub record_count: u32,
}

impl DeviceDiscoverResponse {
    pub fn from_probe(probe: &DeviceProbe) -> Self {
        Self {
            reachable: true,
            ip_address: None, // populated by caller when known
            vendor: Some(probe.vendor.clone()),
            serial_number: Some(probe.serial_number.clone()),
            model: if probe.model.is_empty() { None } else { Some(probe.model.clone()) },
            firmware_version: if probe.firmware_version.is_empty() {
                None
            } else {
                Some(probe.firmware_version.clone())
            },
            platform: if probe.platform.is_empty() { None } else { Some(probe.platform.clone()) },
            mac_address: if probe.mac_address.is_empty() {
                None
            } else {
                Some(probe.mac_address.clone())
            },
            user_count: probe.user_count,
            record_count: probe.record_count,
        }
    }

    /// Build from probe with the known IP address.
    pub fn from_probe_with_ip(probe: &DeviceProbe, ip: &str) -> Self {
        let mut resp = Self::from_probe(probe);
        if !ip.is_empty() {
            resp.ip_address = Some(ip.to_string());
        }
        resp
    }

    pub fn unreachable() -> Self {
        Self {
            reachable: false,
            ip_address: None,
            vendor: None,
            serial_number: None,
            model: None,
            firmware_version: None,
            platform: None,
            mac_address: None,
            user_count: 0,
            record_count: 0,
        }
    }
}

// ─── Device Health Summary ──────────────────────────────────────────

/// Aggregate health summary for all devices.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceHealthSummaryResponse {
    pub total: usize,
    pub online: usize,
    pub offline: usize,
    pub syncing: usize,
    pub errors: usize,
    /// Per-device health entries.
    pub devices: Vec<DeviceHealthEntry>,
}

/// Single device health entry.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceHealthEntry {
    pub serial_number: String,
    pub label: String,
    pub status: String,
    pub record_usage_pct: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<i64>,
}

// ─── Providers ──────────────────────────────────────────────────────

/// Response for a single provider (vendor).
#[derive(Debug, Serialize, ToSchema)]
pub struct ProviderResponse {
    pub key: String,
    pub display_name: String,
    pub default_port: u16,
    pub supports_adms: bool,
    pub supports_sdk: bool,
    pub capabilities: ProviderCapabilitiesResponse,
    pub enabled: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProviderCapabilitiesResponse {
    pub attendance_read: bool,
    pub attendance_clear: bool,
    pub user_read: bool,
    pub user_write: bool,
    pub user_delete: bool,
    pub device_config_read: bool,
    pub device_config_write: bool,
    pub real_time_events: bool,
    pub fingerprint_enroll: bool,
    pub face_enroll: bool,
    pub palm_enroll: bool,
    pub time_sync: bool,
    pub restart: bool,
}

impl From<&ProviderCapabilities> for ProviderCapabilitiesResponse {
    fn from(c: &ProviderCapabilities) -> Self {
        Self {
            attendance_read: c.attendance_read,
            attendance_clear: c.attendance_clear,
            user_read: c.user_read,
            user_write: c.user_write,
            user_delete: c.user_delete,
            device_config_read: c.device_config_read,
            device_config_write: c.device_config_write,
            real_time_events: c.real_time_events,
            fingerprint_enroll: c.fingerprint_enroll,
            face_enroll: c.face_enroll,
            palm_enroll: c.palm_enroll,
            time_sync: c.time_sync,
            restart: c.restart,
        }
    }
}

impl From<&ProviderInfo> for ProviderResponse {
    fn from(p: &ProviderInfo) -> Self {
        Self {
            key: p.key.clone(),
            display_name: p.display_name.clone(),
            default_port: p.default_port,
            supports_adms: p.supports_adms,
            supports_sdk: p.supports_sdk,
            capabilities: ProviderCapabilitiesResponse::from(&p.capabilities),
            enabled: p.enabled,
        }
    }
}

/// Response from a network scan — list of discovered devices.
#[derive(Debug, Serialize, ToSchema)]
pub struct NetworkScanResponse {
    /// Subnet that was scanned.
    pub subnet: String,
    /// Number of hosts scanned.
    pub hosts_scanned: usize,
    /// Number of devices discovered.
    pub devices_found: usize,
    /// Discovered devices.
    pub devices: Vec<DeviceDiscoverResponse>,
}

// ─── Punches ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct PunchResponse {
    pub id: String,
    pub user_pin: String,
    pub timestamp: i64,
    pub status: String,
    pub verify_mode: String,
    pub device_sn: String,
    /// Human-readable device label (from configured devices).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_label: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_code: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    /// Whether this punch is flagged as anomalous.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    #[serde(default)]
    pub is_anomaly: bool,
    /// Human-readable anomaly description (only present if is_anomaly).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anomaly_type: Option<String>,
}

impl From<&AttendancePunch> for PunchResponse {
    fn from(p: &AttendancePunch) -> Self {
        Self {
            id: p.id.clone(),
            user_pin: p.user_pin.clone(),
            timestamp: p.timestamp.as_second(),
            status: punch_status_name(&p.status),
            verify_mode: p.verify_mode.name().to_string(),
            device_sn: p.device_sn.clone(),
            device_label: p.device_label.clone(),
            work_code: p.work_code.clone(),
            employee_name: p.employee_name.clone(),
            is_anomaly: p.is_anomaly,
            anomaly_type: p.anomaly_type.clone(),
        }
    }
}

/// Minimal punch representation for integration (machine-to-machine) endpoints.
#[derive(Debug, Serialize, ToSchema)]
pub struct PunchIntegrationResponse {
    pub user_pin: String,
    pub timestamp: i64,
    pub status: i32,
    pub device_sn: String,
}

impl From<&AttendancePunch> for PunchIntegrationResponse {
    fn from(p: &AttendancePunch) -> Self {
        Self {
            user_pin: p.user_pin.clone(),
            timestamp: p.timestamp.as_second(),
            status: p.status as i32,
            device_sn: p.device_sn.clone(),
        }
    }
}

/// List of punches with pagination.
#[derive(Debug, Serialize, ToSchema)]
pub struct PunchListResponse {
    pub punches: Vec<PunchResponse>,
}

/// List of punches for integration endpoints.
#[derive(Debug, Serialize, ToSchema)]
pub struct PunchIntegrationListResponse {
    pub items: Vec<PunchIntegrationResponse>,
}

pub(crate) fn punch_status_name(s: &PunchStatus) -> String {
    s.to_string()
}

/// Response for punch correction.
#[derive(Debug, Serialize, ToSchema)]
pub struct PunchCorrectedResponse {
    pub id: String,
    pub user_pin: String,
    pub timestamp: i64,
    pub status: String,
}

impl From<&AttendancePunch> for PunchCorrectedResponse {
    fn from(p: &AttendancePunch) -> Self {
        Self {
            id: p.id.clone(),
            user_pin: p.user_pin.clone(),
            timestamp: p.timestamp.as_second(),
            status: punch_status_name(&p.status),
        }
    }
}

// ─── Dashboard ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct TodaySummaryResponse {
    pub date: i64,
    pub present: usize,
    pub absent: usize,
    pub late: usize,
    pub on_time: usize,
    pub total_employees: usize,
    pub total_punches: usize,
    pub check_ins: usize,
    pub check_outs: usize,
    pub last_punch_at: Option<i64>,

    /// Employees currently inside — checked in today but not yet checked out.
    pub currently_checked_in: Vec<CurrentlyCheckedIn>,

    /// Last 20 punches for the activity feed.
    pub recent_events: Vec<DashboardRecentEvent>,

    /// Per-device connection health.
    pub device_health: Vec<DashboardDeviceHealth>,

    /// Punch counts grouped by hour (0-23).
    pub hourly_breakdown: Vec<DashboardHourlyBreakdown>,
}

/// An employee currently checked in (arrived, hasn't left yet).
#[derive(Debug, Serialize, ToSchema)]
pub struct CurrentlyCheckedIn {
    pub user_pin: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,
    /// Unix timestamp of the check-in.
    pub check_in_time: i64,
    pub device_sn: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_label: Option<String>,
    /// Seconds elapsed since check-in.
    pub elapsed_seconds: i64,
}

/// Per-device health information for the dashboard overview.
#[derive(Debug, Serialize, ToSchema)]
pub struct DashboardDeviceHealth {
    pub serial_number: String,
    pub label: String,
    pub online: bool,
    pub adms_active: bool,
    pub sdk_poll_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<i64>,
    /// Current record count on the device.
    pub record_count: u32,
}

/// Hourly punch distribution for today's chart.
#[derive(Debug, Serialize, ToSchema)]
pub struct DashboardHourlyBreakdown {
    /// Hour of the day (0-23).
    pub hour: u8,
    /// Number of punches in this hour.
    pub count: u32,
}

/// A recent attendance event for the dashboard activity feed.
#[derive(Debug, Serialize, ToSchema)]
pub struct DashboardRecentEvent {
    pub user_pin: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,
    /// Unix timestamp (seconds).
    pub timestamp: i64,
    /// Human-readable status: "check_in", "check_out", etc.
    pub status: String,
    pub device_sn: String,
}

// ─── Status-only responses ──────────────────────────────────────────

/// Used for endpoints that return a status message (create, update, delete confirmations).
#[derive(Debug, Serialize, ToSchema)]
pub struct StatusResponse {
    pub status: String,
    /// Human-readable explanation, set for rejected or failed states.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl StatusResponse {
    pub fn created() -> Self {
        Self { status: "created".into(), reason: None }
    }
    pub fn updated() -> Self {
        Self { status: "updated".into(), reason: None }
    }
    pub fn deleted() -> Self {
        Self { status: "deleted".into(), reason: None }
    }
    pub fn requested() -> Self {
        Self { status: "requested".into(), reason: None }
    }
    pub fn enqueued() -> Self {
        Self { status: "enqueued".into(), reason: None }
    }
    pub fn rejected(reason: impl Into<String>) -> Self {
        Self { status: "rejected".into(), reason: Some(reason.into()) }
    }
}

/// Batch action result.
#[derive(Debug, Serialize, ToSchema)]
pub struct BatchActionResponse {
    pub action: String,
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
}

// ─── API Keys ───────────────────────────────────────────────────────

/// API key metadata for list endpoints (no raw key or hash exposed).
#[derive(Debug, Serialize, ToSchema)]
pub struct ApiKeyResponse {
    pub id: String,
    pub name: String,
    /// First 16 characters of the key (for display identification).
    pub prefix: String,
    /// Scoped permissions granted to this key.
    pub permissions: Vec<String>,
    /// Who created this key.
    pub created_by: String,
    /// Unix timestamp of creation.
    pub created_at: i64,
    /// Unix timestamp of last use (None = never used).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<i64>,
    /// Unix timestamp of expiration (None = never expires).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
    /// Whether this key has been revoked.
    pub revoked: bool,
}

impl From<&timekeep_core::ApiKey> for ApiKeyResponse {
    fn from(key: &timekeep_core::ApiKey) -> Self {
        Self {
            id: key.id.clone(),
            name: key.name.clone(),
            prefix: key.prefix.clone(),
            permissions: key
                .permissions
                .to_space_separated()
                .split_whitespace()
                .map(|s| s.to_string())
                .collect(),
            created_by: key.created_by.clone(),
            created_at: key.created_at.as_second(),
            last_used_at: key.last_used_at.map(|t| t.as_second()),
            expires_at: key.expires_at.map(|t| t.as_second()),
            revoked: key.revoked,
        }
    }
}

/// Response returned ONCE when an API key is created.
///
/// The `api_key` field contains the raw key — it is never stored
/// in plaintext and cannot be retrieved again.
#[derive(Debug, Serialize, ToSchema)]
pub struct ApiKeyCreatedResponse {
    #[serde(flatten)]
    pub key: ApiKeyResponse,

    /// The full API key. Store it securely — it will not be shown again.
    pub api_key: String,
}

// ─── Health ──────────────────────────────────────────────────────────

/// Health check response with component status.
#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    /// Overall status: "healthy" | "degraded" | "unhealthy"
    pub status: String,
    pub version: String,
    pub db: String,
    pub uptime_seconds: u64,
    /// Engine pipeline stats.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<EngineHealthStats>,
    /// Per-distributor health.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distributors: Option<Vec<DistributorHealthEntry>>,
    /// Per-device connection status.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub devices: Option<Vec<DeviceHealthInfo>>,
}

/// Engine pipeline metrics.
#[derive(Debug, Serialize, ToSchema)]
pub struct EngineHealthStats {
    pub events_processed: u64,
    pub events_dropped: u64,
    pub events_distributed: u64,
    pub events_failed: u64,
}

/// Per-distributor health entry.
#[derive(Debug, Serialize, ToSchema)]
pub struct DistributorHealthEntry {
    pub name: String,
    pub delivered: u64,
    pub dead: u64,
    pub queued: u64,
}

/// Per-device connection health for the health endpoint.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceHealthInfo {
    pub serial_number: String,
    pub adms_active: bool,
    pub sdk_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_secs_ago: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_poll_secs_ago: Option<u64>,
}

impl HealthResponse {
    /// Build a minimal healthy response (used when engine_health is unavailable).
    pub fn healthy(db_status: &str) -> Self {
        Self {
            status: "healthy".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            db: db_status.into(),
            uptime_seconds: 0,
            engine: None,
            distributors: None,
            devices: None,
        }
    }

    /// Build a rich health response with engine stats, distributor info, and device status.
    pub fn rich(
        db_status: &str,
        uptime_seconds: u64,
        engine: EngineHealthStats,
        distributors: Vec<DistributorHealthEntry>,
        devices: Vec<DeviceHealthInfo>,
    ) -> Self {
        let overall = if db_status != "connected"
            || distributors.iter().any(|d| d.dead > 0 && d.queued > 10)
        {
            "degraded"
        } else {
            "healthy"
        };

        Self {
            status: overall.into(),
            version: env!("CARGO_PKG_VERSION").into(),
            db: db_status.into(),
            uptime_seconds,
            engine: Some(engine),
            distributors: if distributors.is_empty() { None } else { Some(distributors) },
            devices: if devices.is_empty() { None } else { Some(devices) },
        }
    }

    /// Build a degraded response with rich info.
    pub fn degraded(db_status: &str) -> Self {
        Self {
            status: "degraded".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            db: db_status.into(),
            uptime_seconds: 0,
            engine: None,
            distributors: None,
            devices: None,
        }
    }
}

// ─── Setup (First-Run Onboarding) ──────────────────────────────────

/// Tells the frontend whether the system needs initial setup.
#[derive(Debug, Serialize, ToSchema)]
pub struct SetupStatusResponse {
    /// `true` when no dashboard users exist — frontend should show the setup page.
    pub setup_needed: bool,
}

/// Returned after the first admin user is created via the setup endpoint.
#[derive(Debug, Serialize, ToSchema)]
pub struct SetupCompletedResponse {
    /// JWT token for the newly created admin — auto-login after setup.
    pub token: String,
    /// Token lifetime in seconds.
    pub expires_in: u64,
    /// Created username.
    pub username: String,
    /// Assigned role (always "admin").
    pub role: String,
}

// ─── Dashboard User Management ─────────────────────────────────────

/// Response DTO for a dashboard user (never includes password hash).
#[derive(Debug, Serialize, ToSchema)]
pub struct DashboardUserResponse {
    pub id: String,
    pub username: String,
    pub role: String,
    /// Space-separated permission tokens (e.g. "read:punches write:devices").
    pub permissions: String,
    pub display_name: String,
    pub active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<&timekeep_core::DashboardUser> for DashboardUserResponse {
    fn from(u: &timekeep_core::DashboardUser) -> Self {
        Self {
            id: u.id.clone(),
            username: u.username.clone(),
            role: u.role.to_string(),
            permissions: u.permissions.to_space_separated(),
            display_name: u.display_name.clone(),
            active: u.active,
            created_at: u.created_at,
            updated_at: u.updated_at,
        }
    }
}

// ─── Work Day Responses ───────────────────────────────────────────────

/// A single work period in a work day.
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkPeriodResponse {
    pub check_in: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub check_out: Option<i64>,
    pub duration_secs: i64,
    pub kind: String,
}

impl From<&timekeep_core::WorkPeriod> for WorkPeriodResponse {
    fn from(p: &timekeep_core::WorkPeriod) -> Self {
        Self {
            check_in: p.check_in.as_second(),
            check_out: p.check_out.map(|t| t.as_second()),
            duration_secs: p.total_seconds(),
            kind: format!("{:?}", p.kind).to_lowercase(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct WorkDayResponse {
    pub date: String,
    pub user_pin: String,
    pub total_regular_seconds: i64,
    pub total_break_seconds: i64,
    pub total_overtime_seconds: i64,
    pub net_work_seconds: i64,
    pub status: String,
    pub is_present_now: bool,
    pub anomaly_count: usize,
    pub periods: Vec<WorkPeriodResponse>,
}

impl From<&timekeep_core::WorkDay> for WorkDayResponse {
    fn from(day: &timekeep_core::WorkDay) -> Self {
        Self {
            date: day.date.to_string(),
            user_pin: day.user_pin.clone(),
            total_regular_seconds: day.total_regular_seconds,
            total_break_seconds: day.total_break_seconds,
            total_overtime_seconds: day.total_overtime_seconds,
            net_work_seconds: day.net_work_seconds(),
            status: day.status.to_string(),
            is_present_now: day.is_present_now(),
            anomaly_count: day.anomalies.len(),
            periods: day.periods.iter().map(WorkPeriodResponse::from).collect(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EmployeeWorkDaysResponse {
    pub user_pin: String,
    pub work_days: Vec<WorkDayResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EmployeeSummaryResponse {
    pub user_pin: String,
    pub total_days: usize,
    pub present_days: usize,
    pub late_days: usize,
    pub half_days: usize,
    pub absent_days: usize,
    pub total_regular_seconds: i64,
    pub total_overtime_seconds: i64,
    pub avg_hours_per_day: f64,
    pub work_days: Vec<WorkDayResponse>,
}

// ─── Employee Responses ───────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct EmployeeResponse {
    pub id: String,
    pub pin: String,
    pub name: String,
    /// Department UUID for cross-entity navigation.
    ///
    /// When set, the frontend can construct a department detail link.
    /// Resolved from the department_id at create/update time.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department_id: Option<String>,
    /// Human-readable department name for list display.
    ///
    /// Resolved from `department_id` at create/update time.
    /// This is a display-only cache — use `department_id` for navigation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_id: Option<String>,
    /// Employment start date (Unix timestamp, seconds).
    /// `None` means the joining date was not provided.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub joined_at: Option<i64>,
    pub active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<&timekeep_core::Employee> for EmployeeResponse {
    fn from(e: &timekeep_core::Employee) -> Self {
        Self {
            id: e.id.to_string(),
            pin: e.pin.clone(),
            name: e.name.clone(),
            department_id: e.department_id.clone(),
            department: e.department.clone(),
            external_id: e.external_id.clone(),
            joined_at: e.joined_at.map(|t| t.as_second()),
            active: e.active,
            created_at: e.created_at.as_second(),
            updated_at: e.updated_at.as_second(),
        }
    }
}

// ─── Department Responses ───────────────────────────────────────────────

/// Response body for a single department.
#[derive(Debug, Serialize, ToSchema)]
pub struct DepartmentResponse {
    pub id: String,
    pub name: String,
    /// FK to work policy template. When set, `work_policy_title` is resolved.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_policy_id: Option<String>,
    /// Resolved title of the work policy template (when `work_policy_id` is set).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_policy_title: Option<String>,
    /// Legacy: inline work policy (only populated when no template FK is set).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_policy: Option<WorkPolicyResponse>,
    /// Number of employees assigned to this department.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_count: Option<u64>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl DepartmentResponse {
    pub fn from_department(
        dept: &timekeep_core::Department,
        employee_count: Option<u64>,
        policy_title: Option<String>,
        resolved_policy: Option<WorkPolicyResponse>,
    ) -> Self {
        // Prefer resolved policy (from `?include=work_policy` template resolution)
        // over legacy inline JSON.
        let work_policy =
            resolved_policy.or_else(|| dept.work_policy.as_ref().map(WorkPolicyResponse::from));
        Self {
            id: dept.id.to_string(),
            name: dept.name.clone(),
            work_policy_id: dept.work_policy_id.clone(),
            work_policy_title: policy_title,
            work_policy,
            employee_count,
            created_at: dept.created_at.as_second(),
            updated_at: dept.updated_at.as_second(),
        }
    }
}

/// A named, reusable work policy template.
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkPolicyTemplateResponse {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub work_start: String,
    pub work_end: String,
    pub late_threshold_minutes: i64,
    pub min_hours_for_full_day: f64,
    pub daily_overtime_after_hours: f64,
    pub working_days: [bool; 7],
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<&timekeep_core::model::WorkPolicyTemplate> for WorkPolicyTemplateResponse {
    fn from(t: &timekeep_core::model::WorkPolicyTemplate) -> Self {
        Self {
            id: t.id.clone(),
            title: t.title.clone(),
            description: t.description.clone(),
            work_start: format!("{:02}:{:02}", t.work_start.hour(), t.work_start.minute()),
            work_end: format!("{:02}:{:02}", t.work_end.hour(), t.work_end.minute()),
            late_threshold_minutes: t.late_threshold_secs / 60,
            min_hours_for_full_day: t.min_seconds_for_present as f64 / 3600.0,
            daily_overtime_after_hours: t.daily_overtime_after_secs as f64 / 3600.0,
            working_days: t.working_days,
            created_at: t.created_at.as_second(),
            updated_at: t.updated_at.as_second(),
        }
    }
}

/// A device group for organizational device grouping.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceGroupResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub device_count: Option<u64>,
    /// Department IDs assigned to this group. Empty = all departments.
    pub department_ids: Vec<String>,
    /// Human-readable department names, resolved from `department_ids`.
    /// Populated when `?include=departments` is requested.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub department_names: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl DeviceGroupResponse {
    pub fn from_group(
        group: &timekeep_core::DeviceGroup,
        device_count: Option<u64>,
        department_names: Vec<String>,
    ) -> Self {
        Self {
            id: group.id.0.clone(),
            name: group.name.clone(),
            description: group.description.clone(),
            device_count,
            department_ids: group.department_ids.clone(),
            department_names,
            created_at: group.created_at.as_second(),
            updated_at: group.updated_at.as_second(),
        }
    }
}

// ─── Dashboard Quick Stats ────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct QuickStatsResponse {
    pub unique_users: usize,
    pub total_punches: usize,
    pub check_ins: usize,
    pub check_outs: usize,
    pub currently_present: usize,
    pub late_arrivals: usize,
    pub anomalies_detected: usize,
    pub work_days: Vec<WorkDayResponse>,
}

// ─── Monthly Trend ────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct MonthlyTrendResponse {
    pub year: i16,
    pub month: i8,
    pub attendance_pct: f64,
}

impl From<&timekeep_core::MonthlyTrendPoint> for MonthlyTrendResponse {
    fn from(tp: &timekeep_core::MonthlyTrendPoint) -> Self {
        Self { year: tp.year, month: tp.month, attendance_pct: tp.attendance_pct }
    }
}

// ─── Calendar ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct CalendarDayResponse {
    pub date: String,
    pub status_code: u8,
    pub hours: Option<f64>,
    pub is_working_day: bool,
}

impl From<&timekeep_core::CalendarDay> for CalendarDayResponse {
    fn from(cd: &timekeep_core::CalendarDay) -> Self {
        Self {
            date: cd.date.to_string(),
            status_code: cd.status_code,
            hours: cd.hours,
            is_working_day: cd.is_working_day,
        }
    }
}

// ─── About / Support ───────────────────────────────────────────────────

/// Public endpoint response — no auth required.
/// Surfaced in the dashboard footer and error pages
/// to show users where to get help.
#[derive(Debug, Serialize, ToSchema)]
pub struct AboutResponse {
    /// Application name.
    pub name: String,
    /// Current version.
    pub version: String,
    /// Support email (empty string if not configured).
    pub support_email: String,
    /// Workspace/company name (empty string if not configured).
    pub workspace_name: String,
}

/// Client bootstrap config — returned by `GET /api/client-config`.
///
/// Single public endpoint that aggregates everything the frontend needs
/// before authentication: workspace branding, version, setup status.
///
/// This replaces the need for separate `/api/about` and `/api/status`
/// calls on the login/setup pages. Extensible with `features` for
/// future feature-flag driven UI toggles.
#[derive(Debug, Serialize, ToSchema)]
pub struct ClientConfigResponse {
    /// Application name.
    pub name: String,
    /// Current version.
    pub version: String,
    /// Workspace/company name (empty string if not configured).
    pub workspace_name: String,
    /// Support email (empty string if not configured).
    pub support_email: String,
    /// Whether initial setup (first admin creation) is needed.
    pub setup_needed: bool,
}

/// A single entry in the per-device activity feed, merging
/// device-originated events (online, sync, op_log) with server-side
/// events (audit log entries).
#[derive(Debug, Serialize, ToSchema)]
pub struct DeviceActivityEntry {
    /// Unique event identifier.
    pub id: String,
    /// ISO-8601 timestamp string.
    pub timestamp: String,
    /// Unix timestamp (seconds) for sorting.
    #[serde(skip)]
    pub ts_secs: i64,
    /// Human-readable label for display.
    pub label: String,
    /// Event type key: "came_online", "user_synced", "device.created", etc.
    pub event_type: String,
    /// Who performed the action (username or "device").
    pub actor: String,
    /// "device" or "server".
    pub source: String,
    /// Whether this event indicates a problem (for alerting).
    pub is_problem: bool,
}

impl DeviceActivityEntry {
    /// Create from a DeviceEvent.
    pub fn from_device_event(e: &DeviceEvent, label_fn: fn(&DeviceEvent) -> String) -> Self {
        Self {
            id: e.id.clone(),
            timestamp: e.timestamp.to_string(),
            ts_secs: e.timestamp.as_second(),
            label: label_fn(e),
            event_type: e.event_type.key().to_string(),
            actor: "device".into(),
            source: "device".into(),
            is_problem: e.event_type.is_problem(),
        }
    }

    /// Create from an AuditEvent.
    pub fn from_audit_event(e: &timekeep_core::AuditEvent) -> Self {
        let label = Self::audit_label(&e.action, &e.resource);
        Self {
            id: e.id.clone(),
            timestamp: jiff::Timestamp::from_second(e.timestamp)
                .map(|t| t.to_string())
                .unwrap_or_default(),
            ts_secs: e.timestamp,
            label,
            event_type: e.action.clone(),
            actor: e.actor.clone(),
            source: "server".into(),
            is_problem: e.status == "error",
        }
    }

    fn audit_label(action: &str, resource: &str) -> String {
        match action {
            "device.created" => format!("Device added: {resource}"),
            "device.updated" => format!("Device updated: {resource}"),
            "device.deleted" => format!("Device removed: {resource}"),
            "settings.updated" => "Settings changed".into(),
            "user.created" => "Dashboard user created".into(),
            "user.updated" => "Dashboard user updated".into(),
            "user.deleted" => "Dashboard user deleted".into(),
            "login" => "Admin logged in".into(),
            _ => format!("{action}: {resource}"),
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// Onboarding Wizard Response DTOs
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Serialize, ToSchema)]
pub struct OnboardingSessionCreatedResponse {
    pub session_id: String,
    pub session_type: String,
    pub current_step: String,
    pub step_index: usize,
    pub total_steps: usize,
    pub status: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OnboardingSessionResponse {
    pub session_id: String,
    pub session_type: String,
    pub current_step: String,
    pub step_index: usize,
    pub total_steps: usize,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<OnboardingStepLogResponse>>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OnboardingStepLogResponse {
    pub step_name: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OnboardingAdvanceResponse {
    pub session_id: String,
    pub current_step: String,
    pub step_index: usize,
    pub total_steps: usize,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_step: Option<NextStepInfo>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct NextStepInfo {
    pub name: String,
    pub description: String,
    pub requires_interaction: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OnboardingSessionSummary {
    pub session_id: String,
    pub session_type: String,
    pub current_step: String,
    pub step_index: usize,
    pub total_steps: usize,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ── Report response types ────────────────────────────────────────────

/// A detected attendance anomaly.
#[derive(Debug, Clone, serde::Serialize, utoipa::ToSchema)]
pub struct AnomalyResponse {
    /// The employee PIN affected.
    pub user_pin: String,
    /// The date of the anomaly (ISO-8601).
    pub date: String,
    /// The anomaly type: "orphaned_check_out", "duplicate_check_in", etc.
    pub kind: String,
    /// Human-readable description.
    pub description: String,
    /// Unix timestamp (seconds) of the relevant punch.
    pub timestamp: i64,
}

impl AnomalyResponse {
    /// Build a response from a core anomaly and contextual info.
    pub fn from_anomaly(anomaly: &timekeep_core::Anomaly, user_pin: &str, date: &str) -> Self {
        let (kind, description, timestamp) = match anomaly {
            timekeep_core::Anomaly::OrphanedCheckOut { timestamp: ts } => (
                "orphaned_check_out",
                "Check-out without a preceding check-in".into(),
                ts.as_second(),
            ),
            timekeep_core::Anomaly::DuplicateCheckIn { first: _, second } => (
                "duplicate_check_in",
                "Two check-ins in a row without a check-out between them".into(),
                second.as_second(),
            ),
            timekeep_core::Anomaly::MissingCheckOut { check_in } => (
                "missing_check_out",
                "Check-in was never followed by a check-out".into(),
                check_in.as_second(),
            ),
            timekeep_core::Anomaly::UnusualHours { total_seconds: _, reason } => {
                ("unusual_hours", reason.clone(), 0)
            },
            timekeep_core::Anomaly::BuddyPunchCandidate {
                first_device: _,
                second_device: _,
                within_seconds: _,
            } => ("buddy_punch", "Possible buddy-punch detected".into(), 0),
        };
        Self {
            user_pin: user_pin.to_string(),
            date: date.to_string(),
            kind: kind.into(),
            description,
            timestamp,
        }
    }
}

/// Per-department attendance summary.
#[derive(Debug, Clone, serde::Serialize, utoipa::ToSchema)]
pub struct DepartmentAttendanceResponse {
    /// Department ID.
    pub department_id: String,
    /// Department name.
    pub department_name: String,
    /// Number of unique employees with punches in the period.
    pub present: u64,
    /// Number of days classified as late.
    pub late: u64,
    /// Total regular work seconds.
    pub total_regular_seconds: i64,
    /// Total overtime seconds.
    pub total_overtime_seconds: i64,
    /// Attendance rate (0.0—100.0).
    pub attendance_pct: f64,
}

// ─── Attendance Calendar & Timeline Responses ──────────────────────────

/// One employee's status on a single calendar day.
#[derive(Debug, Serialize, ToSchema)]
pub struct CalendarEmployeeDay {
    pub pin: String,
    pub name: String,
    /// Day status: "present", "late", "half", "absent", "weekend".
    pub status: String,
    /// Total work hours (regular periods).
    pub hours: f64,
    /// Overtime hours.
    pub overtime_hours: f64,
    /// Break minutes.
    pub break_minutes: u32,
    /// Number of anomalous punches.
    pub anomaly_count: u32,
    /// Whether the first check-in was late.
    pub is_late: bool,
}

impl CalendarEmployeeDay {
    pub fn from_work_day(wd: &timekeep_core::model::WorkDay) -> Self {
        let present_seconds = wd.net_work_seconds();
        Self {
            pin: wd.user_pin.clone(),
            name: String::new(),
            status: wd.status.to_string(),
            hours: present_seconds as f64 / 3600.0,
            overtime_hours: wd.total_overtime_seconds as f64 / 3600.0,
            break_minutes: (wd.total_break_seconds / 60) as u32,
            anomaly_count: wd.anomalies.len() as u32,
            is_late: wd.status == timekeep_core::model::DayStatus::Late,
        }
    }
}

/// Calendar month response.
#[derive(Debug, Serialize, ToSchema)]
pub struct CalendarMonthResponse {
    pub year: i16,
    pub month: i8,
    /// Map of "YYYY-MM-DD" → employee summaries.
    pub days: std::collections::HashMap<String, Vec<CalendarEmployeeDay>>,
}

/// Single timeline block (bar segment) for one employee.
#[derive(Debug, Serialize, ToSchema)]
pub struct TimelineBlock {
    /// Left position as % of 24h.
    pub left: f64,
    /// Width as % of 24h.
    pub width: f64,
    /// Color key: "present", "warning", "overtime", "default".
    pub color: String,
    /// Tooltip title: "Check In: 08:00 - 17:00".
    pub title: String,
}

/// Raw attendance event (punch row) for the summary sidebar.
#[derive(Debug, Serialize, ToSchema)]
pub struct AttendanceEvent {
    /// Unix timestamp (seconds).
    pub timestamp: i64,
    /// HH:MM formatted time.
    pub time: String,
    /// Punch status string.
    pub status: String,
    /// Whether the punch is flagged as anomalous.
    pub is_anomaly: bool,
}

/// One employee's timeline data for a single day.
#[derive(Debug, Serialize, ToSchema)]
pub struct TimelineEmployeeBlocks {
    pub pin: String,
    pub name: String,
    /// Timeline blocks for rendering as bars.
    pub blocks: Vec<TimelineBlock>,
    /// Pre-computed summary for the sidebar.
    #[serde(flatten)]
    pub summary: CalendarEmployeeDay,
}

/// Single-day timeline response.
#[derive(Debug, Serialize, ToSchema)]
pub struct TimelineDayResponse {
    /// The date requested (YYYY-MM-DD).
    pub date: String,
    /// One entry per employee who punched that day.
    pub employees: Vec<TimelineEmployeeBlocks>,
}
