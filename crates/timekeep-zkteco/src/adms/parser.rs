//! ADMS data parsers.
//!
//! Parses the raw text payloads received from ZKTeco devices via the
//! ADMS push protocol. Handles tab-separated attendance records and
//! key=value device/user info.

use timekeep_core::{
    Error,
    model::{AttendancePunch, OperationLog, OperationType, PunchStatus, User, VerifyMode},
};

/// Parse ATTLOG (attendance log) data from the device.
///
/// Expected format (tab-separated, one record per line):
/// ```text
/// PIN=145\t2026-07-10 07:16:11\t0\t1\t0
/// ```
///
/// Note: The device may send `\\t` (double-escaped tabs) instead of
/// literal `\t` characters. We handle both.
pub fn parse_attendance(body: &str, device_sn: &str) -> Vec<AttendancePunch> {
    let mut records = Vec::new();

    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Normalize: replace double-escaped tabs with actual tabs
        let line = line.replace("\\t", "\t");
        let parts: Vec<&str> = line.split('\t').collect();

        if parts.len() < 2 {
            tracing::warn!(device = %device_sn, line = %line, "malformed ATTLOG line");
            continue;
        }

        let user_pin = parts[0].trim().to_string();
        let timestamp = parse_timestamp(parts[1].trim()).unwrap_or_else(|_| {
            tracing::warn!(
                device = %device_sn,
                ts = parts[1],
                "unparseable timestamp, using now",
            );
            jiff::Timestamp::now()
        });

        let status = parts
            .get(2)
            .and_then(|s| s.trim().parse::<i32>().ok())
            .and_then(|v| PunchStatus::try_from(v).ok())
            .unwrap_or(PunchStatus::CheckIn);

        let verify_mode = parts
            .get(3)
            .and_then(|s| s.trim().parse::<i32>().ok())
            .map(VerifyMode::from)
            .unwrap_or(VerifyMode::Fingerprint);

        let work_code = parts.get(4).map(|s| s.trim().to_string());

        let mut punch = AttendancePunch {
            id: uuid::Uuid::new_v4().to_string(),
            device_sn: device_sn.to_string(),
            user_pin,
            timestamp,
            local_time: None,
            time_offset_secs: None,
            timezone_name: None,
            status,
            verify_mode,
            work_code,
            sub_status: None,
            employee_name: None,
            device_label: None,
            is_anomaly: false,
            anomaly_type: None,
            raw_data: Some(line.to_string()),
        };

        // Generate deduplication ID
        punch.id = punch.generate_deduplication_id();

        records.push(punch);
    }

    records
}

/// Parse USERINFO data from the device.
///
/// Expected format (key=value, tab-separated, one user per line):
/// ```text
/// PIN=145\tName=ALI ZUHAIR\tPrivilege=0\tCard=\tPassword=
/// ```
pub fn parse_users(body: &str, _device_sn: &str) -> Vec<User> {
    let mut users = Vec::new();

    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let mut pin = String::new();
        let mut name = String::new();
        let mut privilege = 0u8;
        let mut card_number: Option<String> = None;
        let mut group: Option<u8> = None;
        let mut password_raw: Option<String> = None;
        let mut timezone: Option<u16> = None;

        // Parse key=value pairs separated by tab
        for part in line.split('\t') {
            if let Some((key, value)) = part.split_once('=') {
                let v = value.trim();
                match key.trim() {
                    "PIN" => pin = v.to_string(),
                    "Name" => name = v.to_string(),
                    "Privilege" | "Pri" => {
                        privilege = v.parse().unwrap_or(0);
                    },
                    "Card" => {
                        if !v.is_empty() {
                            card_number = Some(v.to_string());
                        }
                    },
                    "Grp" | "Group" => {
                        if let Ok(g) = v.parse::<u8>() {
                            group = if g > 0 { Some(g) } else { None };
                        }
                    },
                    "Password" | "Passwd" => {
                        if !v.is_empty() {
                            password_raw = Some(v.to_string());
                        }
                    },
                    "TZ" | "TimeZone" => {
                        if let Ok(t) = v.parse::<u16>() {
                            timezone = if t > 0 { Some(t) } else { None };
                        }
                    },
                    _ => {},
                }
            }
        }

        if !pin.is_empty() {
            let has_password = password_raw.is_some();
            users.push(User {
                internal_sn: 0, // Not available via ADMS text protocol
                pin,
                name,
                privilege,
                card_number,
                group,
                timezone,
                password_raw: password_raw.clone(),
                has_password,
                fingerprint_count: 0,
                has_face: false,
            });
        }
    }

    users
}

/// Parse OPERLOG (operation log / audit trail) data from the device.
///
/// Expected format (tab-separated, one record per line):
///
///
/// Fields:
/// 1. Admin PIN (may be prefixed with "PIN=")
/// 2. Timestamp (device-local)
/// 3. Operation code (integer)
///    4-6. Parameters (meaning depends on operation code)
pub fn parse_operation_logs(body: &str, device_sn: &str) -> Vec<OperationLog> {
    let mut logs = Vec::new();
    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let line = line.replace("\\t", "\t");
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 3 {
            tracing::warn!(device = %device_sn, line = %line, "malformed OPERLOG line");
            continue;
        }
        let admin_pin = parts[0].trim().strip_prefix("PIN=").unwrap_or(parts[0].trim()).to_string();
        let timestamp = parse_timestamp(parts[1].trim()).unwrap_or_else(|_| {
            tracing::warn!(device = %device_sn, ts = parts[1], "unparseable timestamp in OPERLOG");
            jiff::Timestamp::now()
        });
        let op_code: u8 = parts[2].trim().parse().unwrap_or(0);
        let operation = OperationType::from(op_code);
        let params: Vec<u16> = parts
            .iter()
            .skip(3)
            .take(4)
            .filter_map(|s| s.trim().parse::<u16>().ok())
            .filter(|&p| p != 0)
            .collect();
        logs.push(OperationLog {
            device_sn: device_sn.to_string(),
            admin_pin,
            timestamp,
            operation,
            params,
        });
    }
    logs
}

/// Parse key=value pairs (used for device info and registry data).
pub fn parse_kv_pairs(body: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();

    for part in body.split(['\n', ',']) {
        if let Some((key, value)) = part.split_once('=') {
            let key = key.trim().trim_start_matches('~').to_string();
            let value = value.trim().to_string();
            if !key.is_empty() {
                map.insert(key, value);
            }
        }
    }

    map
}

/// Parse a timestamp string from the device.
///
/// Handles two formats:
/// - `2006-01-02 15:04:05` (device-local, no timezone)
/// - Unix epoch integer
fn parse_timestamp(s: &str) -> Result<jiff::Timestamp, Error> {
    // Try the standard device format first
    if let Ok(ts) = s.parse::<jiff::civil::DateTime>() {
        // Treat device timestamps as UTC (caller should adjust for device timezone)
        return ts
            .to_zoned(jiff::tz::TimeZone::UTC)
            .map(|z| z.timestamp())
            .map_err(|e| Error::validation(format!("zoned conversion: {e}")));
    }

    // Try Unix epoch
    if let Ok(epoch) = s.parse::<i64>() {
        return jiff::Timestamp::from_second(epoch)
            .map_err(|e| Error::validation(format!("epoch conversion: {e}")));
    }

    Err(Error::validation(format!("cannot parse timestamp '{s}'")))
}

// uuid used for generating fallback IDs when no content-based ID is available

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_operation_logs_basic() {
        let body = "PIN=145\t2026-07-10 07:16:11\t6\t0\t0\t0";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].admin_pin, "145");
        assert_eq!(logs[0].operation, OperationType::Startup);
        assert!(logs[0].params.is_empty());
    }

    #[test]
    fn test_parse_operation_logs_multiple_lines() {
        let body = "PIN=145\t2026-07-10 07:16:11\t6\t0\t0\t0\nPIN=145\t2026-07-10 08:00:00\t5\t0\t0\t0\n1\t2026-07-10 08:30:00\t0\t13\t1\t0";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs.len(), 3);
        assert_eq!(logs[0].operation, OperationType::Startup);
        assert_eq!(logs[1].operation, OperationType::SetTime);
        assert_eq!(logs[2].operation, OperationType::EnrollUser);
        assert_eq!(logs[2].params, vec![13, 1]);
    }

    #[test]
    fn test_parse_operation_logs_no_pin_prefix() {
        let body = "1\t2026-07-10 08:00:00\t2\t5\t0\t0";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].admin_pin, "1");
        assert_eq!(logs[0].operation, OperationType::SetUserInfo);
    }

    #[test]
    fn test_parse_operation_logs_empty() {
        assert!(parse_operation_logs("", "X").is_empty());
        assert!(parse_operation_logs("  \n  \n  ", "X").is_empty());
    }

    #[test]
    fn test_parse_operation_logs_skips_malformed() {
        let body = "PIN=145\t2026-07-10 07:16:11\t6\t0\t0\t0\nbad_line";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs.len(), 1);
    }

    #[test]
    fn test_parse_operation_logs_with_params() {
        let body = "PIN=1\t2026-07-10 09:00:00\t0\t13\t1\t0";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs[0].operation, OperationType::EnrollUser);
        assert_eq!(logs[0].params, vec![13, 1]);
    }

    #[test]
    fn test_parse_operation_logs_delete_user() {
        let body = "PIN=145\t2026-07-10 10:00:00\t1\t5\t0\t0";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs[0].operation, OperationType::DeleteUser);
        assert_eq!(logs[0].params, vec![5]);
    }

    #[test]
    fn test_parse_operation_logs_unknown_code() {
        let body = "PIN=145\t2026-07-10 07:16:11\t99\t0\t0\t0";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs[0].operation, OperationType::Unknown(99));
    }

    #[test]
    fn test_parse_operation_logs_bad_timestamp() {
        let body = "PIN=145\tnot_a_date\t6\t0\t0\t0";
        let logs = parse_operation_logs(body, "TEST001");
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].operation, OperationType::Startup);
    }

    #[test]
    fn test_operation_type_from_all_codes() {
        let cases = [
            (0, OperationType::EnrollUser),
            (1, OperationType::DeleteUser),
            (2, OperationType::SetUserInfo),
            (6, OperationType::Startup),
            (8, OperationType::AdminVerify),
            (30, OperationType::ClearAttendanceByTime),
            (99, OperationType::Unknown(99)),
        ];
        for (code, expected) in cases {
            assert_eq!(OperationType::from(code), expected, "code {code}");
        }
    }

    #[test]
    fn test_operation_type_name() {
        assert_eq!(OperationType::EnrollUser.name(), "Enroll User");
        assert_eq!(OperationType::Startup.name(), "Device Startup / Reboot");
        assert_eq!(OperationType::Unknown(42).name(), "Unknown Operation");
    }
}
