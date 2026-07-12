use crate::model::{AttendancePunch, Device, DeviceProbe, OperationLog, User};

/// A domain event emitted by the engine when something significant happens.
///
/// Each event carries enough context for subscribers to react without
/// querying back into the system. Events are immutable — subscribers
/// receive an `Arc<DomainEvent>`.
#[derive(Debug, Clone)]
#[allow(clippy::large_enum_variant)]
pub enum DomainEvent {
    /// A new attendance punch was received from a device.
    PunchReceived { punch: AttendancePunch },

    /// Multiple punches were received in a batch.
    PunchesBatchReceived { device_sn: String, count: usize },

    /// A device has come online (first heartbeat after being offline).
    DeviceOnline { device_sn: String, device_info: Device },

    /// A device has not been heard from within the configured threshold.
    DeviceOffline { device_sn: String, last_seen: jiff::Timestamp },

    /// A device's storage is nearly full (over a configurable threshold).
    DeviceStorageWarning {
        device_sn: String,
        records_used: u32,
        records_capacity: u32,
        percentage: f64,
    },

    /// The engine has started.
    EngineStarted { device_count: usize },

    /// The engine is shutting down.
    EngineStopping,

    /// A new device was added to the configuration.
    DeviceRegistered { device_sn: String },

    /// A device was removed from the configuration.
    DeviceRemoved { device_sn: String },

    /// A request to create or update a user on a specific device.
    UserSetRequested { device_sn: String, user: User },

    /// A request to delete a user from a specific device.
    UserDeleteRequested { device_sn: String, user_sn: u16 },

    /// An operation log entry was received from a device.
    OperationLogReceived { log: OperationLog },

    /// A request to send a command to a device via ADMS command queue.
    DeviceCommandEnqueueRequested { device_sn: String, command: String },

    // ── NEW: Device lifecycle events ──────────────────────────
    /// A device was probed and identified (step 1 of provisioning).
    DeviceDiscovered { probe: DeviceProbe },

    /// A device completed provisioning and is now active.
    DeviceProvisioned { device_sn: String, provider: String },

    /// A device completed a successful sync cycle.
    DeviceSyncCompleted { device_sn: String, records_synced: u32, duration_ms: u64 },

    /// A device sync failed.
    DeviceSyncFailed { device_sn: String, error: String, records_synced: u32 },

    /// Device configuration was changed via the API.
    DeviceConfigChanged { device_sn: String, changed_fields: Vec<String> },

    /// Device firmware was updated (reported by the device).
    DeviceFirmwareUpdated { device_sn: String, old_version: String, new_version: String },

    // ── Employee lifecycle events ─────────────────────────────
    /// A new employee was registered in the system.
    EmployeeCreated { pin: String, name: String },
    /// An employee was deactivated (soft-delete).
    EmployeeDeactivated { pin: String },
    /// An employee was enrolled on a specific device.
    EmployeeEnrolled { pin: String, device_sn: String },

    // ── Dashboard user events ─────────────────────────────────
    /// A dashboard user was created (by admin or during setup).
    DashboardUserCreated { username: String, role: String },
    /// A dashboard user was deleted.
    DashboardUserDeleted { username: String },

    // ── System lifecycle events ───────────────────────────────
    /// Initial setup was completed (first admin created).
    SetupCompleted { admin_username: String },
    /// System settings were changed.
    SettingsChanged { changed_fields: Vec<String> },
}

impl DomainEvent {
    /// A short label for this event type (for logging/metrics).
    pub fn event_type(&self) -> &'static str {
        match self {
            Self::PunchReceived { .. } => "punch_received",
            Self::PunchesBatchReceived { .. } => "punches_batch_received",
            Self::DeviceOnline { .. } => "device_online",
            Self::DeviceOffline { .. } => "device_offline",
            Self::DeviceStorageWarning { .. } => "device_storage_warning",
            Self::EngineStarted { .. } => "engine_started",
            Self::EngineStopping => "engine_stopping",
            Self::DeviceRegistered { .. } => "device_registered",
            Self::DeviceRemoved { .. } => "device_removed",
            Self::UserSetRequested { .. } => "user_set_requested",
            Self::UserDeleteRequested { .. } => "user_delete_requested",
            Self::OperationLogReceived { .. } => "operation_log_received",
            Self::DeviceCommandEnqueueRequested { .. } => "device_command_enqueue_requested",
            Self::DeviceDiscovered { .. } => "device_discovered",
            Self::DeviceProvisioned { .. } => "device_provisioned",
            Self::DeviceSyncCompleted { .. } => "device_sync_completed",
            Self::DeviceSyncFailed { .. } => "device_sync_failed",
            Self::DeviceConfigChanged { .. } => "device_config_changed",
            Self::DeviceFirmwareUpdated { .. } => "device_firmware_updated",
            Self::EmployeeCreated { .. } => "employee_created",
            Self::EmployeeDeactivated { .. } => "employee_deactivated",
            Self::EmployeeEnrolled { .. } => "employee_enrolled",
            Self::DashboardUserCreated { .. } => "dashboard_user_created",
            Self::DashboardUserDeleted { .. } => "dashboard_user_deleted",
            Self::SetupCompleted { .. } => "setup_completed",
            Self::SettingsChanged { .. } => "settings_changed",
        }
    }

    /// The device serial number associated with this event, if any.
    pub fn device_sn(&self) -> Option<&str> {
        match self {
            Self::PunchReceived { punch } => Some(&punch.device_sn),
            Self::PunchesBatchReceived { device_sn, .. }
            | Self::DeviceOnline { device_sn, .. }
            | Self::DeviceOffline { device_sn, .. }
            | Self::DeviceStorageWarning { device_sn, .. }
            | Self::DeviceRegistered { device_sn }
            | Self::DeviceRemoved { device_sn }
            | Self::UserSetRequested { device_sn, .. }
            | Self::UserDeleteRequested { device_sn, .. }
            | Self::OperationLogReceived { log: OperationLog { device_sn, .. } }
            | Self::DeviceCommandEnqueueRequested { device_sn, .. }
            | Self::DeviceProvisioned { device_sn, .. }
            | Self::DeviceSyncCompleted { device_sn, .. }
            | Self::DeviceSyncFailed { device_sn, .. }
            | Self::DeviceConfigChanged { device_sn, .. }
            | Self::DeviceFirmwareUpdated { device_sn, .. } => Some(device_sn),
            Self::DeviceDiscovered { probe } => Some(&probe.serial_number),
            Self::EmployeeEnrolled { device_sn, .. } => Some(device_sn),
            Self::EngineStarted { .. }
            | Self::EngineStopping
            | Self::EmployeeCreated { .. }
            | Self::EmployeeDeactivated { .. }
            | Self::DashboardUserCreated { .. }
            | Self::DashboardUserDeleted { .. }
            | Self::SetupCompleted { .. }
            | Self::SettingsChanged { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{
        AttendancePunch, DeviceProbe, OperationLog, OperationType, PunchStatus, User, VerifyMode,
    };

    /// All event types must have unique, non-empty names.
    #[test]
    fn test_event_type_names() {
        let mut names = std::collections::HashSet::new();

        let events = [
            DomainEvent::PunchReceived {
                punch: AttendancePunch {
                    id: "id".into(),
                    device_sn: "SN001".into(),
                    user_pin: "145".into(),
                    timestamp: jiff::Timestamp::from_second(1752129600).unwrap(),
                    status: PunchStatus::CheckIn,
                    verify_mode: VerifyMode::Fingerprint,
                    work_code: None,
                    sub_status: None,
                    employee_name: None,
                    device_label: None,
                    raw_data: None,
                },
            },
            DomainEvent::PunchesBatchReceived { device_sn: "SN001".into(), count: 5 },
            DomainEvent::DeviceOnline {
                device_sn: "SN001".into(),
                device_info: Device::new("SN001"),
            },
            DomainEvent::DeviceOffline {
                device_sn: "SN001".into(),
                last_seen: jiff::Timestamp::from_second(1752129600).unwrap(),
            },
            DomainEvent::DeviceStorageWarning {
                device_sn: "SN001".into(),
                records_used: 90000,
                records_capacity: 100000,
                percentage: 90.0,
            },
            DomainEvent::EngineStarted { device_count: 3 },
            DomainEvent::EngineStopping,
            DomainEvent::DeviceRegistered { device_sn: "SN002".into() },
            DomainEvent::DeviceRemoved { device_sn: "SN002".into() },
            DomainEvent::UserSetRequested {
                device_sn: "SN001".into(),
                user: User {
                    internal_sn: 1,
                    pin: "145".into(),
                    name: "Test".into(),
                    privilege: 0,
                    card_number: None,
                    has_password: false,
                    fingerprint_count: 1,
                    has_face: false,
                },
            },
            DomainEvent::UserDeleteRequested { device_sn: "SN001".into(), user_sn: 1 },
            DomainEvent::OperationLogReceived {
                log: OperationLog {
                    device_sn: "SN001".into(),
                    admin_pin: "".into(),
                    timestamp: jiff::Timestamp::from_second(1752129600).unwrap(),
                    operation: OperationType::Startup,
                    params: vec![],
                },
            },
            DomainEvent::DeviceCommandEnqueueRequested {
                device_sn: "SN001".into(),
                command: "reboot".into(),
            },
            DomainEvent::DeviceDiscovered { probe: DeviceProbe::minimal("SN003") },
            DomainEvent::DeviceProvisioned { device_sn: "SN003".into(), provider: "zkteco".into() },
            DomainEvent::DeviceSyncCompleted {
                device_sn: "SN001".into(),
                records_synced: 27,
                duration_ms: 1200,
            },
            DomainEvent::DeviceSyncFailed {
                device_sn: "SN001".into(),
                error: "timeout".into(),
                records_synced: 5,
            },
            DomainEvent::DeviceConfigChanged {
                device_sn: "SN001".into(),
                changed_fields: vec!["host".into(), "port".into()],
            },
            DomainEvent::DeviceFirmwareUpdated {
                device_sn: "SN001".into(),
                old_version: "6.60".into(),
                new_version: "6.61".into(),
            },
            DomainEvent::EmployeeCreated { pin: "145".into(), name: "Ahmed".into() },
            DomainEvent::EmployeeDeactivated { pin: "145".into() },
            DomainEvent::EmployeeEnrolled { pin: "145".into(), device_sn: "SN001".into() },
            DomainEvent::DashboardUserCreated { username: "admin".into(), role: "admin".into() },
            DomainEvent::DashboardUserDeleted { username: "viewer1".into() },
            DomainEvent::SetupCompleted { admin_username: "admin".into() },
            DomainEvent::SettingsChanged { changed_fields: vec!["work_policy".into()] },
        ];

        for event in &events {
            let name = event.event_type();
            assert!(!name.is_empty(), "event type name must not be empty");
            assert!(names.insert(name.to_string()), "event type '{name}' is not unique");
        }
    }

    /// Verify device_sn() extracts the correct serial number for events that carry one.
    #[test]
    fn test_device_sn_extraction() {
        let punch = AttendancePunch {
            id: "id".into(),
            device_sn: "SN001".into(),
            user_pin: "145".into(),
            timestamp: jiff::Timestamp::from_second(1752129600).unwrap(),
            status: PunchStatus::CheckIn,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        };

        assert_eq!(DomainEvent::PunchReceived { punch }.device_sn(), Some("SN001"));
        assert_eq!(
            DomainEvent::PunchesBatchReceived { device_sn: "SN002".into(), count: 1 }.device_sn(),
            Some("SN002")
        );
        assert_eq!(DomainEvent::EngineStarted { device_count: 0 }.device_sn(), None);
        assert_eq!(DomainEvent::EngineStopping.device_sn(), None);

        // New events
        assert_eq!(
            DomainEvent::DeviceDiscovered { probe: DeviceProbe::minimal("SN003") }.device_sn(),
            Some("SN003")
        );
        assert_eq!(
            DomainEvent::DeviceProvisioned { device_sn: "SN003".into(), provider: "zkteco".into() }
                .device_sn(),
            Some("SN003")
        );
        assert_eq!(
            DomainEvent::DeviceSyncCompleted {
                device_sn: "SN001".into(),
                records_synced: 10,
                duration_ms: 100,
            }
            .device_sn(),
            Some("SN001")
        );

        assert_eq!(
            DomainEvent::EmployeeEnrolled { pin: "145".into(), device_sn: "SN001".into() }
                .device_sn(),
            Some("SN001")
        );
        assert_eq!(
            DomainEvent::EmployeeCreated { pin: "145".into(), name: "Ahmed".into() }.device_sn(),
            None
        );
        assert_eq!(DomainEvent::EmployeeDeactivated { pin: "145".into() }.device_sn(), None);
        assert_eq!(
            DomainEvent::SetupCompleted { admin_username: "admin".into() }.device_sn(),
            None
        );
    }

    /// PunchReceived specifically carries the punch's device_sn.
    #[test]
    fn test_punch_received_has_device_sn() {
        let punch = AttendancePunch {
            id: "id".into(),
            device_sn: "SN001".into(),
            user_pin: "145".into(),
            timestamp: jiff::Timestamp::from_second(1752129600).unwrap(),
            status: PunchStatus::CheckIn,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        };
        let event = DomainEvent::PunchReceived { punch };
        assert_eq!(event.device_sn(), Some("SN001"));
        assert_eq!(event.event_type(), "punch_received");
    }
}
