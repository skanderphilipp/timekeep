use jiff::Timestamp;
use serde::{Deserialize, Serialize};

/// A physical biometric attendance device with full metadata.
///
/// Populated via `BiometricDevice::get_device_info()` and enriched
/// by the device monitor and sync engine over the device lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    // ── Identity ──────────────────────────────────────────
    /// Unique serial number assigned by manufacturer
    pub serial_number: String,
    /// Device model name (e.g. "Biopro SA40[ID]")
    pub model: String,
    /// Firmware version string
    pub firmware_version: String,
    /// Hardware platform identifier (e.g. "ZLM60_TFT")
    pub platform: String,
    /// Vendor / manufacturer
    pub vendor: DeviceVendor,
    /// MAC address
    pub mac_address: String,
    /// Local IP address on the network
    pub ip_address: String,

    // ── Health ────────────────────────────────────────────
    /// Current device status
    pub status: DeviceStatus,
    /// When last seen (any activity: ADMS push or SDK response)
    pub last_seen: Option<Timestamp>,
    /// When the device was first discovered by the system
    pub first_seen: Option<Timestamp>,
    /// Device-reported uptime in seconds (available on some firmware)
    pub uptime_seconds: Option<u64>,

    // ── Capacity ──────────────────────────────────────────
    /// Maximum user slots
    pub user_capacity: u32,
    /// Maximum attendance record slots
    pub record_capacity: u32,
    /// Maximum fingerprint templates
    pub fingerprint_capacity: u32,
    /// Maximum face templates
    pub face_capacity: u32,
    /// Maximum palm vein templates
    pub palm_capacity: u32,
    /// Currently enrolled users
    pub user_count: u32,
    /// Current attendance records stored on device
    pub record_count: u32,
    /// Current fingerprint templates
    pub fingerprint_count: u32,
    /// Current face templates
    pub face_count: u32,
    /// Current palm vein templates
    pub palm_count: u32,

    // ── Sync ──────────────────────────────────────────────
    /// Last successful attendance pull timestamp
    pub last_sync_at: Option<Timestamp>,
    /// Cursor for resumable sync (next pull starts after this)
    pub last_sync_cursor: Option<Timestamp>,

    // ── Metadata ──────────────────────────────────────────
    /// Human-readable label (e.g. "Office Entrance")
    pub label: Option<String>,
    /// Physical location (e.g. "HQ Floor 1", "Warehouse B")
    pub location: Option<String>,
    /// Organizational branch
    pub branch: Option<String>,
    /// When the device was physically installed
    pub installed_at: Option<Timestamp>,
    /// Free-form admin notes
    pub notes: Option<String>,
}

/// The vendor/manufacturer of a biometric device.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceVendor {
    ZkTeco,
    Suprema,
    Anviz,
    Hikvision,
    Other(String),
}

impl DeviceVendor {
    /// Human-readable vendor name.
    pub fn display_name(&self) -> &str {
        match self {
            Self::ZkTeco => "ZKTeco",
            Self::Suprema => "Suprema",
            Self::Anviz => "Anviz",
            Self::Hikvision => "Hikvision",
            Self::Other(name) => name.as_str(),
        }
    }

    /// Short key for storage/API (e.g. "zkteco").
    pub fn key(&self) -> String {
        match self {
            Self::ZkTeco => "zkteco".into(),
            Self::Suprema => "suprema".into(),
            Self::Anviz => "anviz".into(),
            Self::Hikvision => "hikvision".into(),
            Self::Other(name) => name.to_lowercase(),
        }
    }
}

/// The legacy `DeviceType` enum — now an alias for `DeviceVendor`.
///
/// Kept for backward compatibility. Prefer `DeviceVendor` for new code.
#[deprecated(since = "0.2.0", note = "Use `DeviceVendor` instead")]
pub type DeviceType = DeviceVendor;

/// Connection / lifecycle status of a device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceStatus {
    /// Device is connected and responsive
    Online,
    /// Device has not been seen within the configured threshold
    Offline,
    /// Device is currently being polled for data
    Syncing,
    /// Device has errors
    Error,
    /// Device is being provisioned (setup in progress)
    Provisioning,
    /// Device has been removed from active service (history preserved)
    Decommissioned,
}

impl Device {
    /// Create a new device with minimal information.
    /// Capacity fields should be populated after connecting.
    pub fn new(serial_number: impl Into<String>) -> Self {
        Self {
            serial_number: serial_number.into(),
            model: String::new(),
            firmware_version: String::new(),
            platform: String::new(),
            vendor: DeviceVendor::Other("unknown".into()),
            mac_address: String::new(),
            ip_address: String::new(),
            status: DeviceStatus::Offline,
            last_seen: None,
            first_seen: Some(Timestamp::now()),
            uptime_seconds: None,
            user_capacity: 0,
            record_capacity: 0,
            fingerprint_capacity: 0,
            face_capacity: 0,
            palm_capacity: 0,
            user_count: 0,
            record_count: 0,
            fingerprint_count: 0,
            face_count: 0,
            palm_count: 0,
            last_sync_at: None,
            last_sync_cursor: None,
            label: None,
            location: None,
            branch: None,
            installed_at: None,
            notes: None,
        }
    }

    /// Estimate remaining storage as a percentage (0.0 – 1.0).
    pub fn storage_remaining(&self) -> f64 {
        if self.record_capacity == 0 {
            return 1.0;
        }
        1.0 - (self.record_count as f64 / self.record_capacity as f64)
    }

    /// Record usage as a percentage (0.0 – 100.0).
    pub fn record_usage_pct(&self) -> f64 {
        if self.record_capacity == 0 {
            return 0.0;
        }
        (self.record_count as f64 / self.record_capacity as f64) * 100.0
    }

    /// User usage as a percentage (0.0 – 100.0).
    pub fn user_usage_pct(&self) -> f64 {
        if self.user_capacity == 0 {
            return 0.0;
        }
        (self.user_count as f64 / self.user_capacity as f64) * 100.0
    }

    /// Whether storage is above the warning threshold (default: 80%).
    pub fn storage_warning(&self, threshold_pct: f64) -> bool {
        self.record_usage_pct() >= threshold_pct
    }

    /// Whether the device is in a state that accepts new punches.
    pub fn is_operational(&self) -> bool {
        matches!(self.status, DeviceStatus::Online | DeviceStatus::Syncing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_device(record_count: u32, record_capacity: u32) -> Device {
        Device { record_count, record_capacity, ..Device::new("TEST001") }
    }

    #[test]
    fn test_record_usage_pct() {
        let d = make_device(50_000, 100_000);
        assert!((d.record_usage_pct() - 50.0).abs() < f64::EPSILON);

        let d = make_device(0, 100_000);
        assert!((d.record_usage_pct() - 0.0).abs() < f64::EPSILON);

        let d = make_device(100, 0);
        assert!((d.record_usage_pct() - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_storage_warning() {
        let d = make_device(85_000, 100_000);
        assert!(d.storage_warning(80.0));

        let d = make_device(79_000, 100_000);
        assert!(!d.storage_warning(80.0));
    }

    #[test]
    fn test_is_operational() {
        let mut d = Device::new("TEST001");
        d.status = DeviceStatus::Online;
        assert!(d.is_operational());

        d.status = DeviceStatus::Syncing;
        assert!(d.is_operational());

        d.status = DeviceStatus::Offline;
        assert!(!d.is_operational());

        d.status = DeviceStatus::Provisioning;
        assert!(!d.is_operational());

        d.status = DeviceStatus::Decommissioned;
        assert!(!d.is_operational());
    }

    #[test]
    fn test_vendor_key_and_display() {
        assert_eq!(DeviceVendor::ZkTeco.key(), "zkteco");
        assert_eq!(DeviceVendor::ZkTeco.display_name(), "ZKTeco");
        assert_eq!(DeviceVendor::Suprema.key(), "suprema");
        assert_eq!(DeviceVendor::Anviz.key(), "anviz");
        assert_eq!(DeviceVendor::Hikvision.key(), "hikvision");
        assert_eq!(DeviceVendor::Other("BioStar".into()).key(), "biostar");
    }

    #[test]
    fn test_user_usage_pct() {
        let mut d = Device::new("TEST001");
        d.user_count = 50;
        d.user_capacity = 1000;
        assert!((d.user_usage_pct() - 5.0).abs() < f64::EPSILON);

        d.user_capacity = 0;
        assert!((d.user_usage_pct() - 0.0).abs() < f64::EPSILON);
    }
}
