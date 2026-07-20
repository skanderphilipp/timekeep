//! Device lifecycle events persisted for the activity timeline.
//!
//! Unlike `DomainEvent` (ephemeral on the event bus), these events are
//! stored in the database via `Storage::record_device_event()` and can
//! be queried to build device activity timelines in the dashboard.

use jiff::Timestamp;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;

/// A recorded state change for a device — persisted for timeline/audit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceEvent {
    /// Unique event ID (UUID v4).
    pub id: String,
    /// Device serial number.
    pub device_sn: String,
    /// When the event occurred.
    pub timestamp: Timestamp,
    /// What happened.
    pub event_type: DeviceEventType,
    /// Extensible key-value metadata for event-specific data.
    pub metadata: HashMap<String, String>,
}

/// The type of device lifecycle event.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceEventType {
    /// Device came online (first heartbeat).
    CameOnline,
    /// Device went offline.
    WentOffline { reason: String },
    /// Sync cycle started.
    SyncStarted,
    /// Sync cycle completed successfully.
    SyncCompleted { records_synced: u32, duration_ms: u64 },
    /// Sync cycle failed.
    SyncFailed { error: String, records_synced: u32, duration_ms: u64 },
    /// Storage usage exceeded warning threshold.
    StorageWarning { records_used: u32, records_capacity: u32, percentage: f64 },
    /// Device configuration was changed via API.
    ConfigChanged { field: String, old_value: Option<String>, new_value: Option<String> },
    /// Provisioning process started.
    ProvisioningStarted,
    /// Provisioning completed — device is now active.
    ProvisioningCompleted,
    /// Device was decommissioned.
    Decommissioned,
    /// Device firmware was updated.
    FirmwareUpdated { old_version: String, new_version: String },
    /// A device-side operation log entry (from ADMS OPERLOG or SDK OpLog pull).
    /// Covers: fingerprint enroll, attendance clear, device reboot, admin verify, etc.
    OperationLog { op_type: String, admin_pin: String, detail: Option<String> },
    /// Server-initiated user write to device (set_user via SDK or ADMS command queue).
    UserSynced { action: String, pin: String, name: Option<String> },
    /// Server-initiated command sent to device (restart, unlock, refresh, etc.).
    DeviceCommandExecuted { command: String },
}

impl DeviceEventType {
    /// Human-readable label for display in the UI.
    pub fn label(&self) -> &'static str {
        match self {
            Self::CameOnline => "Came online",
            Self::WentOffline { .. } => "Went offline",
            Self::SyncStarted => "Sync started",
            Self::SyncCompleted { .. } => "Sync completed",
            Self::SyncFailed { .. } => "Sync failed",
            Self::StorageWarning { .. } => "Storage warning",
            Self::ConfigChanged { .. } => "Config changed",
            Self::ProvisioningStarted => "Provisioning started",
            Self::ProvisioningCompleted => "Provisioning completed",
            Self::Decommissioned => "Decommissioned",
            Self::FirmwareUpdated { .. } => "Firmware updated",
            Self::OperationLog { op_type, .. } => Self::oplog_label(op_type),
            Self::UserSynced { action, .. } => Self::user_sync_label(action),
            Self::DeviceCommandExecuted { .. } => "Device command executed",
        }
    }

    fn oplog_label(op_type: &str) -> &'static str {
        match op_type {
            "EnrollUser" => "Fingerprint enrolled",
            "DeleteUser" => "User deleted (on device)",
            "SetUserInfo" => "User info changed (on device)",
            "Startup" => "Device rebooted",
            "ClearAttendance" => "Attendance cleared",
            "DeleteAttendance" => "Attendance deleted",
            "AdminVerify" => "Admin verified",
            "SetTime" => "Device clock set",
            _ => "Operation logged",
        }
    }

    fn user_sync_label(action: &str) -> &'static str {
        match action {
            "set" => "User pushed to device",
            "delete" => "User removed from device",
            _ => "User synced",
        }
    }

    /// Content-based key for deduplication.
    ///
    /// Two DeviceEventTypes with the same content_key represent the same
    /// logical event and will produce the same deterministic UUID.
    pub fn content_key(&self) -> String {
        match self {
            Self::OperationLog { op_type, admin_pin, .. } => {
                format!("oplog:{op_type}:{admin_pin}")
            },
            Self::UserSynced { action, pin, .. } => {
                format!("usersync:{action}:{pin}")
            },
            Self::DeviceCommandExecuted { command } => {
                format!("cmd:{command}")
            },
            // Lifecycle events: the key alone is sufficient (timestamp handles uniqueness)
            _ => self.key().to_string(),
        }
    }

    /// Parse a storage key back into a [`DeviceEventType`].
    ///
    /// Reverse of [`key()`](Self::key). Unknown keys default to `CameOnline`.
    /// Used by storage backends when deserializing rows from the database.
    pub fn from_key(key: &str) -> Self {
        match key {
            "came_online" => Self::CameOnline,
            "went_offline" => Self::WentOffline { reason: String::new() },
            "sync_started" => Self::SyncStarted,
            "sync_completed" => Self::SyncCompleted { records_synced: 0, duration_ms: 0 },
            "sync_failed" => {
                Self::SyncFailed { error: String::new(), records_synced: 0, duration_ms: 0 }
            },
            "storage_warning" => {
                Self::StorageWarning { records_used: 0, records_capacity: 0, percentage: 0.0 }
            },
            "config_changed" => {
                Self::ConfigChanged { field: String::new(), old_value: None, new_value: None }
            },
            "provisioning_started" => Self::ProvisioningStarted,
            "provisioning_completed" => Self::ProvisioningCompleted,
            "decommissioned" => Self::Decommissioned,
            "firmware_updated" => {
                Self::FirmwareUpdated { old_version: String::new(), new_version: String::new() }
            },
            "operation_log" => Self::OperationLog {
                op_type: String::new(),
                admin_pin: String::new(),
                detail: None,
            },
            "user_synced" => {
                Self::UserSynced { action: String::new(), pin: String::new(), name: None }
            },
            "device_command_executed" => Self::DeviceCommandExecuted { command: String::new() },
            _ => Self::CameOnline,
        }
    }

    /// Short key for storage/filtering (e.g. "came_online").
    pub fn key(&self) -> &'static str {
        match self {
            Self::CameOnline => "came_online",
            Self::WentOffline { .. } => "went_offline",
            Self::SyncStarted => "sync_started",
            Self::SyncCompleted { .. } => "sync_completed",
            Self::SyncFailed { .. } => "sync_failed",
            Self::StorageWarning { .. } => "storage_warning",
            Self::ConfigChanged { .. } => "config_changed",
            Self::ProvisioningStarted => "provisioning_started",
            Self::ProvisioningCompleted => "provisioning_completed",
            Self::Decommissioned => "decommissioned",
            Self::FirmwareUpdated { .. } => "firmware_updated",
            Self::OperationLog { .. } => "operation_log",
            Self::UserSynced { .. } => "user_synced",
            Self::DeviceCommandExecuted { .. } => "device_command_executed",
        }
    }

    /// Whether this event represents a problem (for alerting).
    pub fn is_problem(&self) -> bool {
        matches!(
            self,
            Self::WentOffline { .. } | Self::SyncFailed { .. } | Self::StorageWarning { .. }
        )
    }
}

impl DeviceEvent {
    /// Create a new device event with a content-based deterministic UUID.
    ///
    /// Uses SHA-256 of (device_sn + timestamp + content_key) to generate
    /// a deterministic UUID. Same logical event → same ID → `INSERT OR IGNORE`
    /// deduplication in storage.
    pub fn new(
        device_sn: impl Into<String>,
        timestamp: Timestamp,
        event_type: DeviceEventType,
    ) -> Self {
        let sn: String = device_sn.into();
        let content = format!("{}:{}:{}", sn, timestamp.as_second(), event_type.content_key());
        let hash = sha2::Sha256::digest(content.as_bytes());
        // Use first 16 bytes of SHA-256 as UUID bytes
        let id = uuid::Uuid::from_bytes([
            hash[0], hash[1], hash[2], hash[3], hash[4], hash[5], hash[6], hash[7], hash[8],
            hash[9], hash[10], hash[11], hash[12], hash[13], hash[14], hash[15],
        ])
        .to_string();
        Self { id, device_sn: sn, timestamp, event_type, metadata: HashMap::new() }
    }

    /// Create a new device event with metadata and deterministic UUID.
    pub fn with_metadata(
        device_sn: impl Into<String>,
        timestamp: Timestamp,
        event_type: DeviceEventType,
        metadata: HashMap<String, String>,
    ) -> Self {
        let sn: String = device_sn.into();
        let content = format!("{}:{}:{}", sn, timestamp.as_second(), event_type.content_key());
        let hash = sha2::Sha256::digest(content.as_bytes());
        let id = uuid::Uuid::from_bytes([
            hash[0], hash[1], hash[2], hash[3], hash[4], hash[5], hash[6], hash[7], hash[8],
            hash[9], hash[10], hash[11], hash[12], hash[13], hash[14], hash[15],
        ])
        .to_string();
        Self { id, device_sn: sn, timestamp, event_type, metadata }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_type_labels_are_non_empty() {
        let types = [
            DeviceEventType::CameOnline,
            DeviceEventType::WentOffline { reason: "timeout".into() },
            DeviceEventType::SyncCompleted { records_synced: 10, duration_ms: 100 },
            DeviceEventType::OperationLog {
                op_type: "EnrollUser".into(),
                admin_pin: "1".into(),
                detail: None,
            },
            DeviceEventType::UserSynced {
                action: "set".into(),
                pin: "EMP001".into(),
                name: Some("Alice".into()),
            },
            DeviceEventType::DeviceCommandExecuted { command: "restart".into() },
        ];
        for t in &types {
            let label = t.label();
            assert!(!label.is_empty(), "label for {:?} should not be empty", t.key());
        }
    }

    #[test]
    fn test_event_type_keys_are_unique() {
        let mut keys = std::collections::HashSet::new();
        let types = [
            DeviceEventType::CameOnline,
            DeviceEventType::OperationLog {
                op_type: "EnrollUser".into(),
                admin_pin: "".into(),
                detail: None,
            },
            DeviceEventType::UserSynced { action: "set".into(), pin: "".into(), name: None },
            DeviceEventType::DeviceCommandExecuted { command: "restart".into() },
        ];
        for t in &types {
            assert!(keys.insert(t.key().to_string()), "duplicate key: {}", t.key());
        }
    }

    #[test]
    fn test_operation_log_labels() {
        let cases = [
            ("EnrollUser", "Fingerprint enrolled"),
            ("Startup", "Device rebooted"),
            ("ClearAttendance", "Attendance cleared"),
            ("UnknownOp", "Operation logged"),
        ];
        for (op_type, expected) in cases {
            let event = DeviceEventType::OperationLog {
                op_type: op_type.into(),
                admin_pin: "1".into(),
                detail: None,
            };
            assert_eq!(event.label(), expected, "label mismatch for {op_type}");
        }
    }

    #[test]
    fn test_user_synced_labels() {
        assert_eq!(
            DeviceEventType::UserSynced { action: "set".into(), pin: "E1".into(), name: None }
                .label(),
            "User pushed to device"
        );
        assert_eq!(
            DeviceEventType::UserSynced { action: "delete".into(), pin: "E1".into(), name: None }
                .label(),
            "User removed from device"
        );
    }
}
