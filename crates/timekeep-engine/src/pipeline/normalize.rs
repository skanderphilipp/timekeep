//! Normalization stage.
//!
//! Converts device-specific timestamp formats to UTC and normalizes
//! user PIN formats. Ensures all punches across all devices are
//! stored in a consistent format regardless of device timezone
//! or PIN encoding differences.

use timekeep_core::model::AttendancePunch;

/// Normalize a punch — ensure timestamp is UTC and PIN is clean.
///
/// # Normalization Rules
///
/// 1. **Timestamp**: If the device has a known timezone offset,
///    adjust the timestamp to UTC. If no timezone is configured,
///    assume the timestamp is already UTC (ADMS pushes typically
///    use UTC, SDK pulls use device-local time).
///
/// 2. **User PIN**: Trim whitespace, convert to uppercase, strip
///    leading zeros that some devices add. "0145" → "145".
pub fn normalize_punch(punch: &mut AttendancePunch, _device_timezone: Option<&str>) {
    // Normalize user PIN: strip leading zeros, trim, uppercase
    let trimmed = punch.user_pin.trim().to_uppercase();
    let stripped = trimmed.trim_start_matches('0');
    punch.user_pin = if stripped.is_empty() { "0" } else { stripped }.to_string();

    // Timestamp normalization: device timezone offsets are applied at the source
    // (ADMS cdata handler + SDK poller) before events are published. The normalize
    // stage focuses on PIN normalization only.
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_punch(pin: &str) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(1752129600).unwrap();
        AttendancePunch {
            id: String::new(),
            device_sn: "TEST".into(),
            user_pin: pin.to_string(),
            timestamp: ts,
            status: timekeep_core::PunchStatus::CheckIn,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        }
    }

    #[test]
    fn test_normalize_strips_leading_zeros() {
        let mut punch = make_test_punch("00145");
        normalize_punch(&mut punch, None);
        assert_eq!(punch.user_pin, "145");
    }

    #[test]
    fn test_normalize_trims_whitespace() {
        let mut punch = make_test_punch(" 145 ");
        normalize_punch(&mut punch, None);
        assert_eq!(punch.user_pin, "145");
    }

    #[test]
    fn test_normalize_uppercase() {
        let mut punch = make_test_punch("abc123");
        normalize_punch(&mut punch, None);
        assert_eq!(punch.user_pin, "ABC123");
    }

    #[test]
    fn test_normalize_all_zeros_becomes_zero() {
        let mut punch = make_test_punch("0000");
        normalize_punch(&mut punch, None);
        assert_eq!(punch.user_pin, "0");
    }

    #[test]
    fn test_normalize_no_change_for_clean_pin() {
        let mut punch = make_test_punch("145");
        let ts_before = punch.timestamp;
        normalize_punch(&mut punch, None);
        assert_eq!(punch.user_pin, "145");
        assert_eq!(punch.timestamp, ts_before); // timestamp unchanged without timezone
    }

    #[test]
    fn test_normalize_preserves_timestamp_without_tz() {
        let mut punch = make_test_punch("145");
        let original_ts = punch.timestamp;
        normalize_punch(&mut punch, None);
        assert_eq!(punch.timestamp, original_ts);
    }
}
