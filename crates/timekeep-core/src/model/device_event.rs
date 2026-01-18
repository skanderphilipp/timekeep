//! Device lifecycle events persisted for the activity timeline.
//!
//! Unlike `DomainEvent` (ephemeral on the event bus), these events are
//! stored in the database via `Storage::record_device_event()` and can
//! be queried to build device activity timelines in the dashboard.

use jiff::Timestamp;
use serde::{Deserialize, Serialize};
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
    SyncFailed { error: String, records_synced: u32 },
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
    /// Create a new device event with a generated UUID.
    pub fn new(
        device_sn: impl Into<String>,
        timestamp: Timestamp,
        event_type: DeviceEventType,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            device_sn: device_sn.into(),
            timestamp,
            event_type,
            metadata: HashMap::new(),
        }
    }

    /// Create a new device event with metadata.
    pub fn with_metadata(
        device_sn: impl Into<String>,
        timestamp: Timestamp,
        event_type: DeviceEventType,
        metadata: HashMap<String, String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            device_sn: device_sn.into(),
            timestamp,
            event_type,
            metadata,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_type_labels_are_unique() {
        let types = [
            DeviceEventType::CameOnline,
            DeviceEventType::WentOffline { reason: "timeout".into() },
            DeviceEventType::SyncStarted,
            DeviceEventType::SyncCompleted { records_synced: 10, duration_ms: 100 },
            DeviceEventType::SyncFailed { error: "err".into(), records_synced: 0 },
            DeviceEventType::StorageWarning {
                records_used: 80,
                records_capacity: 100,
                percentage: 80.0,
            },
            DeviceEventType::ConfigChanged {
                field: "host".into(),
                old_value: None,
                new_value: Some("10.0.0.1".into()),
            },
            DeviceEventType::ProvisioningStarted,
            DeviceEventType::ProvisioningCompleted,
            DeviceEventType::Decommissioned,
            DeviceEventType::FirmwareUpdated {
                old_version: "1.0".into(),
                new_version: "2.0".into(),
            },
        ];
        for t in &types {
            let label = t.label();
            assert!(!label.is_empty(), "all event types must have non-empty labels");
        }
        let mut keys = std::collections::HashSet::new();
        for t in &types {
            let key = t.key();
            assert!(keys.insert(key.to_string()), "duplicate event type key: {key}");
        }
    }

    #[test]
    fn test_is_problem() {
        assert!(DeviceEventType::WentOffline { reason: "timeout".into() }.is_problem());
        assert!(
            DeviceEventType::SyncFailed { error: "err".into(), records_synced: 0 }.is_problem()
        );
        assert!(
            DeviceEventType::StorageWarning {
                records_used: 90,
                records_capacity: 100,
                percentage: 90.0,
            }
            .is_problem()
        );
        assert!(!DeviceEventType::CameOnline.is_problem());
        assert!(!DeviceEventType::ProvisioningCompleted.is_problem());
    }

    #[test]
    fn test_device_event_new_generates_id() {
        let event = DeviceEvent::new("SN001", Timestamp::now(), DeviceEventType::CameOnline);
        assert!(!event.id.is_empty());
        assert_eq!(event.device_sn, "SN001");
    }
}
