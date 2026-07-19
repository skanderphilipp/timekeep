//! Onboarding session — persistent workflow state machine.
//!
//! Onboarding sessions track the progress of multi-step wizards (employee
//! onboarding and device onboarding). Each session is a persistent state
//! machine with an audit trail, compensating actions for rollback, and
//! support for recovery after browser disconnection.
//!
//! # Design
//!
//! See [ADR `22-onboarding-wizards-plan.md`] for the full architecture.
//! The session is a Process Manager — not a distributed saga — implemented
//! as a stateful coordinator with a persistent `onboarding_sessions` table.
//!
//! [ADR `22-onboarding-wizards-plan.md`]: ../../../../../.notes/architecture/22-onboarding-wizards-plan.md

use jiff::Timestamp;
use serde::{Deserialize, Serialize};

/// The type of onboarding workflow.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OnboardingType {
    /// Employee onboarding: create → enroll → fingerprint → backup → complete
    Employee,
    /// Device onboarding: discover → test → config → clock → pull → push → enable
    Device,
}

impl OnboardingType {
    /// Human-readable label for this session type.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Employee => "Employee Onboarding",
            Self::Device => "Device Onboarding",
        }
    }

    /// Total number of steps for the UI progress bar.
    pub fn total_steps(&self) -> usize {
        match self {
            Self::Employee => 6,
            Self::Device => 7,
        }
    }
}

impl std::fmt::Display for OnboardingType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Employee => f.write_str("employee"),
            Self::Device => f.write_str("device"),
        }
    }
}

/// The lifecycle status of an onboarding session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OnboardingStatus {
    /// Session is actively progressing through steps.
    InProgress,
    /// All steps completed successfully.
    Completed,
    /// One or more steps failed — user must retry or cancel.
    Failed,
    /// User explicitly cancelled; compensating actions ran.
    Cancelled,
    /// Session timed out (e.g., fingerprint capture timeout).
    TimedOut,
}

impl OnboardingStatus {
    /// Whether the session is in a terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Cancelled)
    }

    /// Whether the session can be resumed.
    pub fn is_resumable(&self) -> bool {
        matches!(self, Self::InProgress | Self::Failed | Self::TimedOut)
    }
}

impl std::fmt::Display for OnboardingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InProgress => f.write_str("in_progress"),
            Self::Completed => f.write_str("completed"),
            Self::Failed => f.write_str("failed"),
            Self::Cancelled => f.write_str("cancelled"),
            Self::TimedOut => f.write_str("timed_out"),
        }
    }
}

/// Employee-specific step data stored as JSON in `step_data`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmployeeStepData {
    /// Device PIN for the employee (e.g., "145").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_pin: Option<String>,
    /// Display name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,
    /// Department UUID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department_id: Option<String>,
    /// Department display name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department_name: Option<String>,
    /// Work policy template ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_policy_id: Option<String>,
    /// External ERP reference.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_id: Option<String>,
    /// Target device serial numbers for enrollment.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_devices: Option<Vec<String>>,
    /// Biometric types to enroll.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub biometric_types: Option<Vec<String>>,
    /// Which finger to enroll (0–9).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finger_index: Option<u8>,
    /// Per-device fingerprint enrollment status.
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub finger_enrolled_on: std::collections::HashMap<String, DeviceFingerStatus>,
    /// UUID of the created employee (populated after step 1).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_employee_id: Option<String>,
}

/// Per-device fingerprint enrollment progress.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFingerStatus {
    /// Enrollment status on this device.
    pub status: FingerEnrollStatus,
    /// Template size in bytes (if enrolled).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_size: Option<u32>,
}

/// Fingerprint enrollment status per device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FingerEnrollStatus {
    /// Not yet attempted.
    Pending,
    /// Enrollment in progress.
    InProgress,
    /// Successfully enrolled.
    Completed,
    /// Enrollment failed.
    Failed,
}

/// Device-specific step data stored as JSON in `step_data`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeviceStepData {
    /// IP address or hostname.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    /// SDK port (usually 4370).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    /// Device serial number.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    /// Human-readable label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Physical location.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    /// Device group ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
    /// Communication key.
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub comm_key: u32,
    /// Timezone.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    /// Device vendor.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    /// Whether push (ADMS) is enabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub push_enabled: Option<bool>,
    /// Device model (populated after connection test).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Firmware version (populated after connection test).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub firmware_version: Option<String>,
    /// Existing user count on device (populated after users_pulled).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_count: Option<u32>,
    /// Existing record count on device.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub record_count: Option<u32>,
    /// Number of users pulled from device.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pulled_user_count: Option<u32>,
    /// Number of employees pushed to device.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pushed_employee_count: Option<u32>,
}

fn is_zero_u32(v: &u32) -> bool {
    *v == 0
}

/// An onboarding session — the core persistent state machine entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnboardingSession {
    /// UUID v4 session ID.
    pub id: String,
    /// Type of workflow.
    pub session_type: OnboardingType,
    /// Current step name (state machine state).
    pub current_step: String,
    /// Ordinal step index (0-based) for UI progress.
    pub step_index: usize,
    /// Lifecycle status.
    pub status: OnboardingStatus,
    /// Entity ID this session is about (employee_id or device_sn).
    pub entity_id: Option<String>,
    /// Per-step JSON payload (step_data blob).
    pub step_data: serde_json::Value,
    /// Last error message, if any.
    pub error_message: Option<String>,
    /// JSON array of completed step names for compensation ordering.
    pub compensating: Vec<String>,
    /// When the session was created.
    pub created_at: Timestamp,
    /// When the session was last modified.
    pub updated_at: Timestamp,
}

impl OnboardingSession {
    /// Create a new onboarding session in the `created` state.
    pub fn new(
        id: String,
        session_type: OnboardingType,
        entity_id: Option<String>,
        step_data: serde_json::Value,
    ) -> Self {
        let now = Timestamp::now();
        Self {
            id,
            session_type,
            current_step: "created".into(),
            step_index: 0,
            status: OnboardingStatus::InProgress,
            entity_id,
            step_data,
            error_message: None,
            compensating: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }
}

/// An audit log entry recording each step transition within a session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnboardingSessionLog {
    /// UUID v4 log entry ID.
    pub id: String,
    /// Parent session ID.
    pub session_id: String,
    /// The step this log entry refers to.
    pub step_name: String,
    /// The action that occurred on this step.
    pub action: OnboardingStepAction,
    /// Optional JSON detail payload.
    pub detail_json: Option<serde_json::Value>,
    /// Duration of this action in milliseconds.
    pub duration_ms: Option<u64>,
    /// When this log entry was created.
    pub created_at: Timestamp,
}

/// The action that occurred on a step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OnboardingStepAction {
    /// Step execution started.
    Started,
    /// Step execution completed successfully.
    Completed,
    /// Step execution failed.
    Failed,
    /// Step was compensated (rolled back).
    Compensated,
}

impl std::fmt::Display for OnboardingStepAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Started => f.write_str("started"),
            Self::Completed => f.write_str("completed"),
            Self::Failed => f.write_str("failed"),
            Self::Compensated => f.write_str("compensated"),
        }
    }
}

// ── Step name constants ───────────────────────────────────────────

/// Employee onboarding step names (matching the state machine in the ADR).
pub mod employee_steps {
    /// Initial state after session creation.
    pub const CREATED: &str = "created";
    /// Employee record created in the database.
    pub const EMPLOYEE_REGISTERED: &str = "employee_registered";
    /// Employee enrolled on target devices.
    pub const DEVICE_ENROLLMENT: &str = "device_enrollment";
    /// Fingerprint capture triggered on device.
    pub const FINGERPRINT_TRIGGER: &str = "fingerprint_trigger";
    /// Fingerprint samples collected successfully.
    pub const FINGER_COLLECTED: &str = "finger_collected";
    /// Fingerprint template backed up centrally.
    pub const TEMPLATE_BACKED_UP: &str = "template_backed_up";
    /// All steps completed.
    pub const COMPLETED: &str = "completed";
}

/// Device onboarding step names (matching the state machine in the ADR).
pub mod device_steps {
    /// Initial state after session creation.
    pub const CREATED: &str = "created";
    /// Device connection tested successfully.
    pub const CONNECTION_TESTED: &str = "connection_tested";
    /// Device configuration applied.
    pub const CONFIGURED: &str = "configured";
    /// Device clock synchronized.
    pub const CLOCK_SYNCED: &str = "clock_synced";
    /// Existing users pulled from device.
    pub const USERS_PULLED: &str = "users_pulled";
    /// Employees pushed to device.
    pub const EMPLOYEES_PUSHED: &str = "employees_pushed";
    /// Realtime monitoring enabled.
    pub const REALTIME_ENABLED: &str = "realtime_enabled";
    /// All steps completed.
    pub const COMPLETED: &str = "completed";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn onboarding_session_new_defaults() {
        let session = OnboardingSession::new(
            "test-id".into(),
            OnboardingType::Employee,
            None,
            serde_json::json!({}),
        );
        assert_eq!(session.current_step, "created");
        assert_eq!(session.step_index, 0);
        assert_eq!(session.status, OnboardingStatus::InProgress);
        assert!(session.compensating.is_empty());
    }

    #[test]
    fn session_type_total_steps() {
        assert_eq!(OnboardingType::Employee.total_steps(), 6);
        assert_eq!(OnboardingType::Device.total_steps(), 7);
    }

    #[test]
    fn status_is_terminal() {
        assert!(OnboardingStatus::Completed.is_terminal());
        assert!(OnboardingStatus::Cancelled.is_terminal());
        assert!(!OnboardingStatus::InProgress.is_terminal());
        assert!(!OnboardingStatus::Failed.is_terminal());
        assert!(!OnboardingStatus::TimedOut.is_terminal());
    }

    #[test]
    fn status_is_resumable() {
        assert!(OnboardingStatus::InProgress.is_resumable());
        assert!(OnboardingStatus::Failed.is_resumable());
        assert!(OnboardingStatus::TimedOut.is_resumable());
        assert!(!OnboardingStatus::Completed.is_resumable());
        assert!(!OnboardingStatus::Cancelled.is_resumable());
    }
}
