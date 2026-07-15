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
    /// Create from the raw device string (e.g., "0000001111").
    pub fn from_bits(s: &str) -> Self {
        let val = u16::from_str_radix(s.trim(), 2).unwrap_or(0b0000001111);
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
        // Enable all push types: ATTLOG, OPERLOG, ATTPHOTO, and FP enroll
        Self(0b0000001111)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_enables_attendance_and_oplog() {
        let flag = TransFlag::default();
        assert!(flag.push_attendance(), "TransFlag default must enable ATTLOG push (bit 0 = 1)");
        assert!(
            flag.push_operation_log(),
            "TransFlag default must enable OPERLOG push (bit 1 = 1)"
        );
    }

    #[test]
    fn default_enables_fingerprint_enroll() {
        let flag = TransFlag::default();
        assert!(
            flag.push_fingerprint_enroll(),
            "TransFlag default must enable fingerprint enrollment push (bit 3 = 1)"
        );
    }

    #[test]
    fn from_bits_parses_correctly() {
        // All bits 0-3 enabled
        let flag = TransFlag::from_bits("0000001111");
        assert!(flag.push_attendance());
        assert!(flag.push_operation_log());
        assert!(flag.push_attendance_photos());
        assert!(flag.push_fingerprint_enroll());
    }

    #[test]
    fn from_bits_all_disabled() {
        let flag = TransFlag::from_bits("0000000000");
        assert!(!flag.push_attendance());
        assert!(!flag.push_operation_log());
        assert!(!flag.push_attendance_photos());
        assert!(!flag.push_fingerprint_enroll());
    }

    #[test]
    fn from_bits_invalid_string_uses_sensible_default() {
        // Garbage input should not panic
        let flag = TransFlag::from_bits("not-a-number");
        // The fallback should be a reasonable configuration
        assert!(flag.push_attendance(), "fallback should enable ATTLOG");
        assert!(flag.push_operation_log(), "fallback should enable OPERLOG");
    }

    #[test]
    fn individual_bits_are_independent() {
        // Only ATTLOG
        let flag = TransFlag::from_bits("0000000001");
        assert!(flag.push_attendance());
        assert!(!flag.push_operation_log());
        assert!(!flag.push_attendance_photos());
        assert!(!flag.push_fingerprint_enroll());

        // Only OPERLOG
        let flag = TransFlag::from_bits("0000000010");
        assert!(!flag.push_attendance());
        assert!(flag.push_operation_log());
        assert!(!flag.push_attendance_photos());
        assert!(!flag.push_fingerprint_enroll());
    }

    #[test]
    fn push_attendance_photos_checks_bit_2() {
        let with = TransFlag::from_bits("0000000100");
        assert!(with.push_attendance_photos());

        let without = TransFlag::from_bits("1111111011");
        assert!(!without.push_attendance_photos());
    }
}
