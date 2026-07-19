//! Normalization stage.
//!
//! Converts device-specific timestamp formats to UTC and normalizes
//! user PIN formats. Ensures all punches across all devices are
//! stored in a consistent format regardless of device timezone
//! or PIN encoding differences.

use jiff::tz::TimeZone;
use timekeep_core::model::AttendancePunch;

/// Normalize a punch — ensure timestamp is UTC, PIN is clean, and timezone
/// context is recorded.
///
/// # Normalization Rules
///
/// 1. **Timestamp**: The punch's `timestamp` field is assumed to already be
///    UTC (ADMS pushes typically use UTC, SDK pulls are converted at the source).
///
/// 2. **Timezone context**: If a device timezone name is provided (IANA format,
///    e.g. "Asia/Dubai"), we compute the wall-clock `local_time`, the UTC
///    `time_offset_secs`, and record the `timezone_name`. These fields enable
///    shift compliance checks ("was this late?") and DST-safe reporting.
///
/// 3. **User PIN**: Trim whitespace, convert to uppercase, strip
///    leading zeros that some devices add. "0145" → "145".
pub fn normalize_punch(punch: &mut AttendancePunch, device_timezone: Option<&str>) {
    // Normalize user PIN: strip leading zeros, trim, uppercase
    let trimmed = punch.user_pin.trim().to_uppercase();
    let stripped = trimmed.trim_start_matches('0');
    punch.user_pin = if stripped.is_empty() { "0" } else { stripped }.to_string();

    // Populate timezone context from device configuration
    if let Some(tz_name) = device_timezone {
        match TimeZone::get(tz_name) {
            Ok(tz) => {
                let zoned = punch.timestamp.to_zoned(tz);
                punch.timezone_name = Some(tz_name.to_string());
                punch.time_offset_secs = Some(zoned.offset().seconds());
                // local_time = UTC + offset, stored as a Timestamp for uniform handling
                let local_secs = punch.timestamp.as_second() + zoned.offset().seconds() as i64;
                punch.local_time = jiff::Timestamp::from_second(local_secs).ok();
            },
            Err(_) => {
                tracing::warn!(
                    tz = tz_name,
                    device = %punch.device_sn,
                    "unknown IANA timezone name, timezone fields will be None"
                );
            },
        }
    }
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
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status: timekeep_core::PunchStatus::CheckIn,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
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

    #[test]
    fn test_normalize_populates_timezone_fields() {
        let mut punch = make_test_punch("145");
        normalize_punch(&mut punch, Some("Asia/Dubai"));
        assert_eq!(punch.timezone_name.as_deref(), Some("Asia/Dubai"));
        // Dubai is UTC+4
        assert_eq!(punch.time_offset_secs, Some(14400));
        assert!(punch.local_time.is_some());
        // local_time should be 4 hours ahead of UTC
        let local_secs = punch.local_time.unwrap().as_second();
        assert_eq!(local_secs, punch.timestamp.as_second() + 14400);
    }

    #[test]
    fn test_normalize_unknown_timezone_graceful() {
        let mut punch = make_test_punch("145");
        // This should not panic — unknown zone → no fields populated
        normalize_punch(&mut punch, Some("Not/ARealZone"));
        assert!(punch.timezone_name.is_none());
        assert!(punch.time_offset_secs.is_none());
        assert!(punch.local_time.is_none());
    }
}
