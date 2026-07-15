//! Device operation logs (audit trail).
//!
//! ZKTeco devices record administrative actions — enrollments, deletions,
//! configuration changes, reboots — as operation log entries. These provide
//! an audit trail for security and compliance.

use serde::{Deserialize, Serialize};

/// A single operation log entry from a biometric device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    /// Device that recorded this operation.
    pub device_sn: String,
    /// PIN of the admin who performed the operation (empty for system events).
    pub admin_pin: String,
    /// When the operation occurred.
    pub timestamp: jiff::Timestamp,
    /// The type of operation performed.
    pub operation: OperationType,
    /// Additional context parameters (meaning depends on operation type).
    pub params: Vec<u16>,
}

/// Known ZKTeco operation types.
///
/// Codes are from the zk-protocol specification and pyzk reference.
/// Unknown codes are captured as `OperationType::Unknown(u8)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    /// A new user was enrolled on the device.
    EnrollUser,
    /// A user was deleted from the device.
    DeleteUser,
    /// User information was modified (name, privilege, password, card).
    SetUserInfo,
    /// An individual attendance record was deleted.
    DeleteAttendance,
    /// All attendance records were cleared.
    ClearAttendance,
    /// Device clock was set.
    SetTime,
    /// Device was powered on or rebooted.
    Startup,
    /// Device was powered off.
    PowerOff,
    /// An administrator verified their identity (fingerprint/card/password).
    AdminVerify,
    /// Door was opened (local button or schedule).
    DoorOpen,
    /// Door was opened remotely.
    RemoteOpenDoor,
    /// Alarm was triggered.
    Alarm,
    /// Operation logs were cleared.
    ClearOperationLogs,
    /// An HID/proximity card was assigned to a user.
    SetHidCard,
    /// An HID/proximity card was removed from a user.
    DeleteHidCard,
    /// A fingerprint template was deleted.
    DeleteFingerprint,
    /// Device entered management/settings mode.
    EnterManagement,
    /// Attendance records were cleared by time range.
    ClearAttendanceByTime,
    /// A server-issued command was executed on the device (sync clock, restart, etc.).
    CommandExecuted,
    /// An unknown operation code (preserved for forward compatibility).
    Unknown(u8),
}

impl From<u8> for OperationType {
    fn from(code: u8) -> Self {
        match code {
            0 => Self::EnrollUser,
            1 => Self::DeleteUser,
            2 => Self::SetUserInfo,
            3 => Self::DeleteAttendance,
            4 => Self::ClearAttendance,
            5 => Self::SetTime,
            6 => Self::Startup,
            7 => Self::PowerOff,
            8 => Self::AdminVerify,
            9 => Self::DoorOpen,
            10 => Self::RemoteOpenDoor,
            11 => Self::Alarm,
            12 => Self::ClearOperationLogs,
            13 => Self::SetHidCard,
            14 => Self::DeleteHidCard,
            15 => Self::DeleteFingerprint,
            16 => Self::EnterManagement,
            30 => Self::ClearAttendanceByTime,
            other => {
                tracing::debug!(code = other, "unknown operation type");
                Self::Unknown(other)
            },
        }
    }
}

impl OperationType {
    /// Human-readable name for this operation type.
    pub fn name(&self) -> &str {
        match self {
            Self::EnrollUser => "Enroll User",
            Self::DeleteUser => "Delete User",
            Self::SetUserInfo => "Set User Info",
            Self::DeleteAttendance => "Delete Attendance Record",
            Self::ClearAttendance => "Clear All Attendance",
            Self::SetTime => "Set Device Time",
            Self::Startup => "Device Startup / Reboot",
            Self::PowerOff => "Power Off",
            Self::AdminVerify => "Admin Verification",
            Self::DoorOpen => "Door Open",
            Self::RemoteOpenDoor => "Remote Door Open",
            Self::Alarm => "Alarm Triggered",
            Self::ClearOperationLogs => "Clear Operation Logs",
            Self::SetHidCard => "Set HID Card",
            Self::DeleteHidCard => "Delete HID Card",
            Self::DeleteFingerprint => "Delete Fingerprint",
            Self::EnterManagement => "Enter Management Mode",
            Self::ClearAttendanceByTime => "Clear Attendance by Time",
            Self::CommandExecuted => "Command Executed",
            Self::Unknown(_) => "Unknown Operation",
        }
    }
}
