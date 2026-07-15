//! Provider registry — describes device providers (vendors) the system
//! knows how to communicate with.

use serde::{Deserialize, Serialize};

/// Describes a device provider that the system knows how to communicate with.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    /// Unique provider key (e.g. "zkteco", "suprema", "anviz").
    pub key: String,
    /// Human-readable display name.
    pub display_name: String,
    /// Default connection port for this vendor's protocol.
    pub default_port: u16,
    /// Whether this provider supports ADMS push (real-time HTTP events).
    pub supports_adms: bool,
    /// Whether this provider supports SDK pull (TCP binary protocol).
    pub supports_sdk: bool,
    /// Granular capability flags.
    pub capabilities: ProviderCapabilities,
    /// Whether this provider is enabled (can be disabled without removing).
    pub enabled: bool,
}

/// Granular capability flags for a device provider.
///
/// Each flag describes whether the provider implementation supports
/// a specific operation. The dashboard uses this to conditionally
/// show/hide UI elements (e.g. don't show "Enroll Fingerprint" if
/// the provider doesn't support it).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProviderCapabilities {
    /// Can read attendance records from the device.
    pub attendance_read: bool,
    /// Can clear attendance records on the device.
    pub attendance_clear: bool,
    /// Can read the user/enrollee list from the device.
    pub user_read: bool,
    /// Can create or update users on the device.
    pub user_write: bool,
    /// Can delete users from the device.
    pub user_delete: bool,
    /// Can read device configuration parameters.
    pub device_config_read: bool,
    /// Can write device configuration parameters.
    pub device_config_write: bool,
    /// Can receive real-time events from the device (push mode).
    pub real_time_events: bool,
    /// Can enroll fingerprint templates on the device.
    pub fingerprint_enroll: bool,
    /// Can enroll face templates on the device.
    pub face_enroll: bool,
    /// Can enroll palm vein templates on the device.
    pub palm_enroll: bool,
    /// Can set the device clock.
    pub time_sync: bool,
    /// Can restart the device.
    pub restart: bool,
}

/// Result of probing a device at a given IP:port to detect its vendor
/// and extract identity information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceProbe {
    /// Detected vendor key (e.g. "zkteco").
    pub vendor: String,
    /// Device serial number.
    pub serial_number: String,
    /// Device model name.
    pub model: String,
    /// Firmware version string.
    pub firmware_version: String,
    /// Hardware platform.
    pub platform: String,
    /// MAC address.
    pub mac_address: String,
    /// IP address or hostname of the device.
    pub host: String,
    /// Currently enrolled users.
    pub user_count: u32,
    /// Current attendance records stored.
    pub record_count: u32,
}

impl DeviceProbe {
    /// Create a minimal probe result for a reachable but unidentified device.
    ///
    /// Pass an empty string for `host` if the device IP is unknown
    /// (e.g., in tests or when the probe is created without an active connection).
    pub fn minimal(serial_number: impl Into<String>, host: impl Into<String>) -> Self {
        Self {
            vendor: "unknown".into(),
            serial_number: serial_number.into(),
            model: String::new(),
            firmware_version: String::new(),
            platform: String::new(),
            mac_address: String::new(),
            host: host.into(),
            user_count: 0,
            record_count: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_info_serialization() {
        let info = ProviderInfo {
            key: "zkteco".into(),
            display_name: "ZKTeco".into(),
            default_port: 4370,
            supports_adms: true,
            supports_sdk: true,
            capabilities: ProviderCapabilities {
                attendance_read: true,
                user_read: true,
                real_time_events: true,
                fingerprint_enroll: true,
                time_sync: true,
                restart: true,
                ..Default::default()
            },
            enabled: true,
        };

        let json = serde_json::to_string(&info).unwrap();
        let parsed: ProviderInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.key, "zkteco");
        assert_eq!(parsed.default_port, 4370);
        assert!(parsed.capabilities.fingerprint_enroll);
        assert!(!parsed.capabilities.face_enroll);
    }

    #[test]
    fn test_device_probe_minimal() {
        let probe = DeviceProbe::minimal("SN001", "192.168.1.100");
        assert_eq!(probe.serial_number, "SN001");
        assert_eq!(probe.vendor, "unknown");
        assert_eq!(probe.host, "192.168.1.100");
        assert!(probe.model.is_empty());
    }

    #[test]
    fn test_device_probe_minimal_empty_host() {
        let probe = DeviceProbe::minimal("SN002", "");
        assert_eq!(probe.serial_number, "SN002");
        assert!(probe.host.is_empty());
    }
}
