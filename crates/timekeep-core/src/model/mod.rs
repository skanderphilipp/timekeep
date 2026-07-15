pub mod anomaly;
pub mod attendance_analytics;
pub mod audit;
pub mod dashboard_user;
pub mod device;
pub mod device_event;
pub mod employee;
pub mod enrollment;
pub mod iam;
pub mod oplog;
pub mod pending_delivery;
pub mod provider;
pub mod punch;
pub mod settings;
pub mod user;
pub mod user_sync;
pub mod work_day;
pub mod work_period;
pub mod work_policy;

// Re-export types so they're accessible as `crate::model::Device`, etc.
pub use anomaly::Anomaly;
pub use attendance_analytics::{
    CalendarDay, CheckedInEmployee, DailyHours, EmployeeKpi, MonthlyTrendPoint, StatusDistribution,
    TodaySnapshot, WeeklyHours,
};
pub use audit::{AuditEvent, AuditFilter};
pub use dashboard_user::DashboardUser;
pub use device::{Device, DeviceStatus, DeviceVendor};
pub use device_event::{DeviceEvent, DeviceEventType};
pub use employee::{Employee, EmployeeId};
pub use enrollment::{BiometricType, DeviceEnrollment, FingerprintTemplate};
pub use iam::{ApiKey, PermissionSet, Role};
pub use oplog::{OperationLog, OperationType};
pub use pending_delivery::{
    BACKOFF_SECONDS, DeadLetterDelivery, MAX_DELIVERY_ATTEMPTS, PendingDelivery,
};
pub use provider::{DeviceProbe, ProviderCapabilities, ProviderInfo};
pub use punch::{AttendancePunch, PunchStatus, VerifyMode};
pub use settings::{IntegrationEndpoint, IntegrationKind, SystemSettings};
pub use user::User;
pub use user_sync::{DeviceUsers, SyncResult, UserDiff};
pub use work_day::{DayStatus, WorkDay};
pub use work_period::{PeriodKind, WorkPeriod};
pub use work_policy::WorkPolicy;

/// Common configuration for a device managed by timekeep.
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct DeviceConfig {
    /// Human-readable label (e.g. "Office Entrance")
    pub label: String,
    /// Device serial number
    pub serial_number: String,
    /// IP address or hostname
    pub host: String,
    /// Port (typically 4370 for ZKTeco SDK)
    pub port: u16,
    /// Communication key / password
    pub comm_key: u32,
    /// Timezone for interpreting device timestamps
    pub timezone: Option<String>,
    /// Whether to use ADMS push (true) or SDK pull (false)
    pub push_enabled: bool,
    /// Vendor key for provider routing (e.g. "zkteco", "suprema").
    /// Defaults to "zkteco" for backward compatibility.
    #[serde(default = "default_vendor")]
    pub vendor: String,
    /// Physical location of the device (e.g. "HQ Floor 1").
    pub location: Option<String>,
    /// Per-device poll interval override in seconds.
    /// If None, the system-wide `poll_interval_secs` setting is used.
    pub poll_interval_secs: Option<u32>,
}

fn default_vendor() -> String {
    "zkteco".into()
}

impl DeviceConfig {
    /// Create a minimal device config for discovery/provisioning.
    pub fn minimal(serial_number: impl Into<String>, host: impl Into<String>) -> Self {
        Self {
            label: String::new(),
            serial_number: serial_number.into(),
            host: host.into(),
            port: 4370,
            comm_key: 0,
            timezone: None,
            push_enabled: true,
            vendor: "zkteco".into(),
            location: None,
            poll_interval_secs: None,
        }
    }
}
