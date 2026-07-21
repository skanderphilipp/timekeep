use crate::model::{
    AttendancePunch, Device, DeviceProbe, EmployeeId, OnboardingType, OperationLog, User,
};

/// A domain event emitted by the engine when something significant happens.
///
/// Each event carries enough context for subscribers to react without
/// querying back into the system. Events are immutable — subscribers
/// receive an `Arc<DomainEvent>`.
#[derive(Debug, Clone)]
#[allow(clippy::large_enum_variant)]
pub enum DomainEvent {
    /// A new attendance punch was received from a device.
    PunchReceived {
        punch: AttendancePunch,
    },

    /// Multiple punches were received in a batch.
    PunchesBatchReceived {
        device_sn: String,
        count: usize,
    },

    /// A device has come online (first heartbeat after being offline).
    DeviceOnline {
        device_sn: String,
        device_info: Device,
    },

    /// A device has not been heard from within the configured threshold.
    DeviceOffline {
        device_sn: String,
        last_seen: jiff::Timestamp,
    },

    /// A device's storage is nearly full (over a configurable threshold).
    DeviceStorageWarning {
        device_sn: String,
        records_used: u32,
        records_capacity: u32,
        percentage: f64,
    },

    /// The engine has started.
    EngineStarted {
        device_count: usize,
    },

    /// The engine is shutting down.
    EngineStopping,

    /// A new device was added to the configuration.
    DeviceRegistered {
        device_sn: String,
    },

    /// A device was removed from the configuration.
    DeviceRemoved {
        device_sn: String,
    },

    /// A request to create or update a user on a specific device.
    UserSetRequested {
        device_sn: String,
        user: User,
    },

    /// A request to delete a user from a specific device.
    UserDeleteRequested {
        device_sn: String,
        user_sn: u16,
    },

    /// Request to push an employee to all devices they are enrolled on.
    EmployeeSyncRequested {
        employee_pin: String,
    },

    /// Request to remove an employee from all devices.
    EmployeeRemoveRequested {
        employee_pin: String,
    },

    /// Request to copy all users from one device to another.
    DeviceToDeviceSyncRequested {
        source_sn: String,
        target_sn: String,
    },

    /// Request a full device re-sync (delete all users, re-upload from employee DB).
    DeviceResyncRequested {
        device_sn: String,
    },

    /// Request to delete all users from a device without re-uploading.
    /// Pure destructive operation — separate from `DeviceResyncRequested`
    /// which also re-uploads employees from the database.
    ClearAllUsersRequested {
        device_sn: String,
    },

    /// Bulk user sync completed for a device.
    UsersBulkSynced {
        device_sn: String,
        pushed: u32,
        deleted: u32,
        failed: u32,
        duration_ms: u64,
    },

    /// Device pushed its complete user list via ADMS (USERINFO table).
    /// The handler should upsert these into the local device-users store.
    DeviceUsersReceived {
        device_sn: String,
        users: Vec<User>,
    },

    /// A specific user sync to a device failed.
    UserSyncFailed {
        device_sn: String,
        employee_pin: String,
        error: String,
    },

    /// An operation log entry was received from a device.
    OperationLogReceived {
        log: OperationLog,
    },

    /// A request to send a command to a device via ADMS command queue.
    DeviceCommandEnqueueRequested {
        device_sn: String,
        command: String,
    },

    /// Request an immediate attendance pull for a specific device.
    /// The handler connects to the device, calls get_attendance(since),
    /// and feeds each record through the engine pipeline.
    AttendancePullRequested {
        device_sn: String,
    },

    // ── NEW: Device lifecycle events ──────────────────────────
    /// A device was probed and identified (step 1 of provisioning).
    DeviceDiscovered {
        probe: DeviceProbe,
    },

    /// A device completed provisioning and is now active.
    DeviceProvisioned {
        device_sn: String,
        provider: String,
    },

    /// A device completed a successful sync cycle.
    DeviceSyncCompleted {
        device_sn: String,
        records_synced: u32,
        duration_ms: u64,
    },

    /// A device sync failed.
    DeviceSyncFailed {
        device_sn: String,
        error: String,
        records_synced: u32,
        duration_ms: u64,
    },

    /// Device configuration was changed via the API.
    DeviceConfigChanged {
        device_sn: String,
        changed_fields: Vec<String>,
    },

    /// Device firmware was updated (reported by the device).
    DeviceFirmwareUpdated {
        device_sn: String,
        old_version: String,
        new_version: String,
    },

    /// Enriched device metadata received (platform, firmware, MAC, capacity).
    DeviceInfoUpdated {
        device: Device,
    },

    /// Request to refresh live device info via SDK (user-initiated).
    DeviceInfoRefreshRequested {
        device_sn: String,
    },

    /// Request to refresh user list from device via SDK (user-initiated).
    DeviceUsersRefreshRequested {
        device_sn: String,
    },

    // ── Employee lifecycle events ─────────────────────────────
    /// A new employee was registered in the system.
    EmployeeCreated {
        pin: String,
        name: String,
    },
    /// An existing employee was updated (name, department, external_id changed).
    EmployeeUpdated {
        id: String,
        name: String,
        pin: String,
    },
    /// An employee was deactivated (soft-delete).
    EmployeeDeactivated {
        pin: String,
    },
    /// An employee was enrolled on a specific device.
    EmployeeEnrolled {
        pin: String,
        device_sn: String,
    },

    // ── Dashboard user events ─────────────────────────────────
    /// A dashboard user was created (by admin or during setup).
    DashboardUserCreated {
        username: String,
        role: String,
    },
    /// A dashboard user was deleted.
    DashboardUserDeleted {
        username: String,
    },

    // ── System lifecycle events ───────────────────────────────
    /// Initial setup was completed (first admin created).
    SetupCompleted {
        admin_username: String,
    },
    /// System settings were changed.
    SettingsChanged {
        changed_fields: Vec<String>,
    },

    // ── Fingerprint Template Transfer events ───────────────────
    /// Request to transfer fingerprint templates between devices.
    FingerprintTransferRequested {
        source_sn: String,
        target_sn: String,
        employee_id: Option<EmployeeId>,
    },
    /// Fingerprint transfer completed.
    FingerprintTransferCompleted {
        source_sn: String,
        target_sn: String,
        transferred: u32,
        failed: u32,
        duration_ms: u64,
    },

    // ── Department lifecycle events ───────────────────────────
    /// A new department was created.
    DepartmentCreated {
        id: String,
        name: String,
    },
    /// A department was updated (name or policy changed).
    DepartmentUpdated {
        id: String,
        name: String,
    },
    /// A department was deleted.
    DepartmentDeleted {
        id: String,
    },

    // ── Device group sync events ─────────────────────────────
    /// Admin requested a group-level sync (all devices in a group).
    GroupSyncRequested {
        group_id: String,
        department_id: Option<String>,
        triggered_by: String,
    },
    /// A group sync completed with aggregate results.
    GroupSyncCompleted {
        group_id: String,
        devices_synced: u32,
        total_pushed: u32,
        total_deleted: u32,
        total_failed: u32,
        duration_ms: u64,
    },

    // ── Onboarding workflow events ────────────────────────────
    OnboardingSessionCreated {
        session_id: String,
        session_type: OnboardingType,
        entity_id: Option<String>,
    },
    OnboardingSessionStepAdvanced {
        session_id: String,
        from_step: String,
        to_step: String,
    },
    OnboardingSessionStepFailed {
        session_id: String,
        step: String,
        error: String,
    },
    OnboardingSessionCancelled {
        session_id: String,
    },
    OnboardingSessionCompleted {
        session_id: String,
        session_type: OnboardingType,
        entity_id: String,
    },

    // ── Fingerprint enrollment events ────────────────────────
    FingerprintEnrollRequested {
        device_sn: String,
        user_pin: String,
        finger_index: u8,
    },
    /// Live progress during fingerprint enrollment (SSE-streamed).
    FingerprintEnrollProgress {
        device_sn: String,
        user_pin: String,
        finger_index: u8,
        sample: u8,
        score: u8,
        status: String,
        template_size: Option<usize>,
    },
    FingerprintEnrolled {
        device_sn: String,
        user_pin: String,
        finger_index: u8,
        template_size: usize,
    },
    FingerprintEnrollFailed {
        device_sn: String,
        user_pin: String,
        finger_index: u8,
        reason: String,
    },
    FingerprintTemplateBackedUp {
        device_sn: String,
        user_pin: String,
        finger_index: u8,
        storage_location: String,
    },

    // ── Device onboarding events ─────────────────────────────
    DeviceConnectionTested {
        device_sn: String,
        host: String,
        port: u16,
        success: bool,
    },
    DeviceConfigured {
        config: crate::model::DeviceConfig,
    },
    DeviceClockSynced {
        device_sn: String,
        drift_seconds: i64,
    },
    DeviceUsersPulled {
        device_sn: String,
        user_count: u32,
    },
    DeviceEmployeesPushed {
        device_sn: String,
        pushed: u32,
        failed: u32,
    },
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
            Self::EmployeeSyncRequested { .. } => "employee_sync_requested",
            Self::EmployeeRemoveRequested { .. } => "employee_remove_requested",
            Self::DeviceToDeviceSyncRequested { .. } => "device_to_device_sync_requested",
            Self::DeviceResyncRequested { .. } => "device_resync_requested",
            Self::ClearAllUsersRequested { .. } => "clear_all_users_requested",
            Self::UsersBulkSynced { .. } => "users_bulk_synced",
            Self::DeviceUsersReceived { .. } => "device_users_received",
            Self::UserSyncFailed { .. } => "user_sync_failed",
            Self::OperationLogReceived { .. } => "operation_log_received",
            Self::DeviceCommandEnqueueRequested { .. } => "device_command_enqueue_requested",
            Self::AttendancePullRequested { .. } => "attendance_pull_requested",
            Self::DeviceDiscovered { .. } => "device_discovered",
            Self::DeviceProvisioned { .. } => "device_provisioned",
            Self::DeviceSyncCompleted { .. } => "device_sync_completed",
            Self::DeviceSyncFailed { .. } => "device_sync_failed",
            Self::DeviceConfigChanged { .. } => "device_config_changed",
            Self::DeviceFirmwareUpdated { .. } => "device_firmware_updated",
            Self::DeviceInfoUpdated { .. } => "device_info_updated",
            Self::DeviceInfoRefreshRequested { .. } => "device_info_refresh_requested",
            Self::DeviceUsersRefreshRequested { .. } => "device_users_refresh_requested",
            Self::EmployeeCreated { .. } => "employee_created",
            Self::EmployeeUpdated { .. } => "employee_updated",
            Self::EmployeeDeactivated { .. } => "employee_deactivated",
            Self::EmployeeEnrolled { .. } => "employee_enrolled",
            Self::DashboardUserCreated { .. } => "dashboard_user_created",
            Self::DashboardUserDeleted { .. } => "dashboard_user_deleted",
            Self::SetupCompleted { .. } => "setup_completed",
            Self::SettingsChanged { .. } => "settings_changed",
            Self::FingerprintTransferRequested { .. } => "fingerprint_transfer_requested",
            Self::FingerprintTransferCompleted { .. } => "fingerprint_transfer_completed",
            Self::DepartmentCreated { .. } => "department_created",
            Self::DepartmentUpdated { .. } => "department_updated",
            Self::DepartmentDeleted { .. } => "department_deleted",
            Self::GroupSyncRequested { .. } => "group_sync_requested",
            Self::GroupSyncCompleted { .. } => "group_sync_completed",
            Self::OnboardingSessionCreated { .. } => "onboarding_session_created",
            Self::OnboardingSessionStepAdvanced { .. } => "onboarding_session_step_advanced",
            Self::OnboardingSessionStepFailed { .. } => "onboarding_session_step_failed",
            Self::OnboardingSessionCancelled { .. } => "onboarding_session_cancelled",
            Self::OnboardingSessionCompleted { .. } => "onboarding_session_completed",
            Self::FingerprintEnrollRequested { .. } => "fingerprint_enroll_requested",
            Self::FingerprintEnrollProgress { .. } => "fingerprint_enroll_progress",
            Self::FingerprintEnrolled { .. } => "fingerprint_enrolled",
            Self::FingerprintEnrollFailed { .. } => "fingerprint_enroll_failed",
            Self::FingerprintTemplateBackedUp { .. } => "fingerprint_template_backed_up",
            Self::DeviceConnectionTested { .. } => "device_connection_tested",
            Self::DeviceConfigured { .. } => "device_configured",
            Self::DeviceClockSynced { .. } => "device_clock_synced",
            Self::DeviceUsersPulled { .. } => "device_users_pulled",
            Self::DeviceEmployeesPushed { .. } => "device_employees_pushed",
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
            | Self::UsersBulkSynced { device_sn, .. }
            | Self::DeviceUsersReceived { device_sn, .. }
            | Self::UserSyncFailed { device_sn, .. }
            | Self::DeviceToDeviceSyncRequested { target_sn: device_sn, .. }
            | Self::DeviceResyncRequested { device_sn, .. }
            | Self::ClearAllUsersRequested { device_sn }
            | Self::OperationLogReceived { log: OperationLog { device_sn, .. } }
            | Self::DeviceCommandEnqueueRequested { device_sn, .. }
            | Self::DeviceProvisioned { device_sn, .. }
            | Self::DeviceSyncCompleted { device_sn, .. }
            | Self::DeviceSyncFailed { device_sn, .. }
            | Self::DeviceConfigChanged { device_sn, .. }
            | Self::DeviceFirmwareUpdated { device_sn, .. }
            | Self::DeviceInfoRefreshRequested { device_sn }
            | Self::DeviceUsersRefreshRequested { device_sn } => Some(device_sn),
            Self::DeviceInfoUpdated { device } => Some(&device.serial_number),
            Self::DeviceDiscovered { probe } => Some(&probe.serial_number),
            Self::EmployeeEnrolled { device_sn, .. } => Some(device_sn),
            Self::EngineStarted { .. }
            | Self::EngineStopping
            | Self::EmployeeSyncRequested { .. }
            | Self::EmployeeRemoveRequested { .. }
            | Self::EmployeeCreated { .. }
            | Self::EmployeeUpdated { .. }
            | Self::EmployeeDeactivated { .. }
            | Self::DashboardUserCreated { .. }
            | Self::DashboardUserDeleted { .. }
            | Self::SetupCompleted { .. }
            | Self::SettingsChanged { .. }
            | Self::FingerprintTransferRequested { .. }
            | Self::FingerprintTransferCompleted { .. } => None,
            Self::DepartmentCreated { .. }
            | Self::DepartmentUpdated { .. }
            | Self::DepartmentDeleted { .. }
            | Self::GroupSyncRequested { .. }
            | Self::GroupSyncCompleted { .. } => None,
            Self::OnboardingSessionCreated { .. }
            | Self::OnboardingSessionStepAdvanced { .. }
            | Self::OnboardingSessionStepFailed { .. }
            | Self::OnboardingSessionCancelled { .. }
            | Self::OnboardingSessionCompleted { .. } => None,
            Self::FingerprintEnrollRequested { device_sn, .. }
            | Self::FingerprintEnrollProgress { device_sn, .. }
            | Self::FingerprintEnrolled { device_sn, .. }
            | Self::FingerprintEnrollFailed { device_sn, .. }
            | Self::FingerprintTemplateBackedUp { device_sn, .. }
            | Self::DeviceConnectionTested { device_sn, .. }
            | Self::DeviceClockSynced { device_sn, .. }
            | Self::DeviceUsersPulled { device_sn, .. }
            | Self::DeviceEmployeesPushed { device_sn, .. }
            | Self::AttendancePullRequested { device_sn } => Some(device_sn),
            Self::DeviceConfigured { config } => Some(&config.serial_number),
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
                    local_time: None,
                    time_offset_secs: None,
                    timezone_name: None,
                    status: PunchStatus::CheckIn,
                    verify_mode: VerifyMode::Fingerprint,
                    work_code: None,
                    sub_status: None,
                    employee_name: None,
                    device_label: None,
                    is_anomaly: false,
                    anomaly_type: None,
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
                    group: None,
                    timezone: None,
                    password_raw: None,
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
            DomainEvent::DeviceDiscovered { probe: DeviceProbe::minimal("SN003", "") },
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
                duration_ms: 3100,
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
            DomainEvent::GroupSyncRequested {
                group_id: "grp-1".into(),
                department_id: Some("HR".into()),
                triggered_by: "admin".into(),
            },
            DomainEvent::GroupSyncCompleted {
                group_id: "grp-1".into(),
                devices_synced: 2,
                total_pushed: 15,
                total_deleted: 0,
                total_failed: 0,
                duration_ms: 3200,
            },
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
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status: PunchStatus::CheckIn,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
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
            DomainEvent::DeviceDiscovered { probe: DeviceProbe::minimal("SN003", "") }.device_sn(),
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

    /// FingerprintEnrollProgress extracts device_sn and has correct event_type.
    #[test]
    fn test_fingerprint_enroll_progress() {
        let evt = DomainEvent::FingerprintEnrollProgress {
            device_sn: "SN001".into(),
            user_pin: "145".into(),
            finger_index: 0,
            sample: 2,
            score: 100,
            status: "good".into(),
            template_size: None,
        };
        assert_eq!(evt.device_sn(), Some("SN001"));
        assert_eq!(evt.event_type(), "fingerprint_enroll_progress");

        let enrolled = DomainEvent::FingerprintEnrollProgress {
            device_sn: "SN001".into(),
            user_pin: "145".into(),
            finger_index: 0,
            sample: 3,
            score: 100,
            status: "enrolled".into(),
            template_size: Some(1024),
        };
        assert_eq!(enrolled.event_type(), "fingerprint_enroll_progress");
        assert_eq!(enrolled.device_sn(), Some("SN001"));
    }

    /// PunchReceived specifically carries the punch's device_sn.
    #[test]
    fn test_punch_received_has_device_sn() {
        let punch = AttendancePunch {
            id: "id".into(),
            device_sn: "SN001".into(),
            user_pin: "145".into(),
            timestamp: jiff::Timestamp::from_second(1752129600).unwrap(),
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status: PunchStatus::CheckIn,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
            raw_data: None,
        };
        let event = DomainEvent::PunchReceived { punch };
        assert_eq!(event.device_sn(), Some("SN001"));
        assert_eq!(event.event_type(), "punch_received");
    }
}
