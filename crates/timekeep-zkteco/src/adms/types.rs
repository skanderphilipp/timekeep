//! ADMS protocol types.
//!
//! Data structures for the ADMS push protocol handshake and
//! device information exchange.

/// Device information received during ADMS handshake or registry update.
#[derive(Debug, Clone, Default)]
pub struct DeviceInfo {
    pub serial_number: String,
    pub model: Option<String>,
    pub firmware: Option<String>,
    pub platform: Option<String>,
    pub mac_address: Option<String>,
    pub ip_address: Option<String>,
    pub user_count: Option<u32>,
    pub fingerprint_count: Option<u32>,
    pub attendance_count: Option<u32>,
    pub face_count: Option<u32>,
    pub user_capacity: Option<u32>,
    pub fingerprint_capacity: Option<u32>,
    pub attendance_capacity: Option<u32>,
    pub face_capacity: Option<u32>,
}

/// TransFlag bitmap sent during handshake.
///
/// Controls which data types the device pushes:
/// - Bit 0: ATTLOG (attendance)
/// - Bit 1: OPERLOG (operation logs)
/// - Bit 2: ATTPHOTO (attendance photos)
/// - Bit 3: Enroll FP template
/// - Bit 4: Enroll face template
/// - Bits 5-9: Reserved
pub struct TransFlag(u16);

impl TransFlag {
    /// Create from the raw device string (e.g., "1111000000").
    pub fn from_bits(s: &str) -> Self {
        let val = u16::from_str_radix(s.trim(), 2).unwrap_or(0b1111000000);
        Self(val)
    }

    pub fn push_attendance(&self) -> bool {
        self.0 & 0b0000000001 != 0
    }

    pub fn push_operation_log(&self) -> bool {
        self.0 & 0b0000000010 != 0
    }

    pub fn push_attendance_photos(&self) -> bool {
        self.0 & 0b0000000100 != 0
    }

    pub fn push_fingerprint_enroll(&self) -> bool {
        self.0 & 0b0000001000 != 0
    }
}

impl Default for TransFlag {
    fn default() -> Self {
        // Push everything except photos
        Self(0b1111000000)
    }
}
