//! SDK binary protocol parsers.
//!
//! Pure functions that parse raw bytes from the ZKTeco binary protocol
//! into domain model types. These are extracted from `connection.rs`
//! to make them independently testable.
//!
//! All functions take `&[u8]` and return `Option<T>` or `Result<T>` —
//! no network I/O, no async, no side effects.

use timekeep_core::model::{
    AttendancePunch, OperationLog, OperationType, PunchStatus, User, VerifyMode,
};

use super::connection::{DeviceSizes, FingerprintTemplate};
use crate::protocol::encoding;

/// Parse a 40-byte binary attendance record.
///
/// Layout (standard ZKTeco format):
/// ```text
/// offset  size  description
/// 0       2     user_sn (u16 LE)
/// 2       9     user_id (ASCII string, null-padded)
/// 11      15    reserved (zeros)
/// 26      1     verify_type (1=fingerprint, 2=face, 3=card, 4=password, 15=other)
/// 27      4     timestamp (u32 LE, ZKTeco time encoding)
/// 31      1     status (0=check-in, 1=check-out, etc.)
/// 32      8     reserved (zeros)
/// ```
pub fn parse_attendance_record(data: &[u8], device_sn: &str) -> Option<AttendancePunch> {
    if data.len() < 40 {
        return None;
    }

    let user_sn = u16::from_le_bytes([data[0], data[1]]);
    let user_id = encoding::parse_user_id(&data[2..11]);
    let verify_type = data[26];
    let raw_time = u32::from_le_bytes([data[27], data[28], data[29], data[30]]);
    let status_byte = data[31];

    let timestamp = encoding::decode_zk_time(raw_time).unwrap_or_else(|_| jiff::Timestamp::now());

    let status = PunchStatus::try_from(status_byte as i32).unwrap_or(PunchStatus::CheckIn);
    let verify_mode = VerifyMode::from(verify_type as i32);

    let pin = if user_id.is_empty() { user_sn.to_string() } else { user_id };

    let mut punch = AttendancePunch {
        id: String::new(),
        device_sn: device_sn.to_string(),
        user_pin: pin,
        timestamp,
        local_time: None,
        time_offset_secs: None,
        timezone_name: None,
        status,
        verify_mode,
        work_code: None,
        sub_status: None,
        employee_name: None,
        device_label: None,
        is_anomaly: false,
        anomaly_type: None,
        raw_data: Some(format!("{data:02X?}")),
    };

    punch.id = punch.generate_deduplication_id();
    Some(punch)
}

/// Parse a 72-byte ZK8 user record.
///
/// Layout (matching the encoder in `protocol/encoding.rs`):
/// ```text
/// offset  size  description
/// 0       2     user_sn (u16 LE)
/// 2       1     permission token
/// 3       8     password (ASCII, null-padded)
/// 11      24    name (ASCII, null-padded)
/// 35      4     card_number (u32 LE)
/// 39      1     group number (1-99)
/// 40      2     user TZ flag (0 = use group timezones)
/// 42      2     TZ1
/// 44      2     TZ2
/// 46      2     TZ3
/// 48      9     user_id / PIN (ASCII, null-padded)
/// 57      15    padding (zeros)
/// ```
pub fn parse_user_record_72(data: &[u8]) -> Option<User> {
    if data.len() < 72 {
        return None;
    }

    let uid = u16::from_le_bytes([data[0], data[1]]);
    let privilege = data[2];
    let password_raw = encoding::parse_name(&data[3..11]);
    let name = encoding::parse_name(&data[11..35]);
    let card_u32 = u32::from_le_bytes([data[35], data[36], data[37], data[38]]);
    let group = data[39];
    // TZ fields at offsets 40-47 are captured as a single u16 (the user TZ flag)
    // Individual TZ1/TZ2/TZ3 are device-level timezone registers, not per-user.
    let timezone_flag = u16::from_le_bytes([data[40], data[41]]);
    let user_id = encoding::parse_user_id(&data[48..57]);

    let card_number = if card_u32 > 0 { Some(card_u32.to_string()) } else { None };
    let group = if group > 0 { Some(group) } else { None };
    let password = if password_raw.is_empty() { None } else { Some(password_raw) };
    let timezone = if timezone_flag > 0 { Some(timezone_flag) } else { None };

    Some(User {
        internal_sn: uid,
        pin: user_id,
        name,
        privilege,
        card_number,
        group,
        timezone,
        password_raw: password.clone(),
        has_password: password.is_some(),
        fingerprint_count: 0,
        has_face: false,
    })
}

/// Parse a 28-byte legacy (ZK6) user record.
///
/// Layout:
/// ```text
/// offset  size  description
/// 0       2     user_sn (u16 LE)
/// 2       1     privilege
/// 3       5     password (ASCII, null-padded)
/// 8       8     name (ASCII, null-padded)
/// 16      4     card_number (u32 LE)
/// 20      1     group
/// 21      2     timezone (u16 LE)
/// 23      1     reserved
/// 24      4     user_id (u32 LE) — numeric PIN
/// ```
pub fn parse_user_record_28(data: &[u8]) -> Option<User> {
    if data.len() < 28 {
        return None;
    }

    let uid = u16::from_le_bytes([data[0], data[1]]);
    let privilege = data[2];
    let password_raw = encoding::parse_name(&data[3..8]);
    let name = encoding::parse_name(&data[8..16]);
    let card_u32 = u32::from_le_bytes([data[16], data[17], data[18], data[19]]);
    let group = data[20];
    let tz = u16::from_le_bytes([data[21], data[22]]);
    let user_id_raw = u32::from_le_bytes([data[24], data[25], data[26], data[27]]);

    let card_number = if card_u32 > 0 { Some(card_u32.to_string()) } else { None };
    let group = if group > 0 { Some(group) } else { None };
    let password = if password_raw.is_empty() { None } else { Some(password_raw) };
    let timezone = if tz > 0 { Some(tz) } else { None };

    Some(User {
        internal_sn: uid,
        pin: user_id_raw.to_string(),
        name,
        privilege,
        card_number,
        group,
        timezone,
        password_raw: password.clone(),
        has_password: password.is_some(),
        fingerprint_count: 0,
        has_face: false,
    })
}

/// Parse a 16-byte binary operation log record.
///
/// Layout:
/// ```text
/// offset  size  description
/// 0       2     reserved / padding
/// 2       1     operation code
/// 3       1     unknown / reserved
/// 4       4     timestamp (u32 LE, ZKTeco time encoding)
/// 8       2     param1 (u16 LE)
/// 10      2     param2 (u16 LE)
/// 12      2     param3 (u16 LE)
/// 14      2     param4 (u16 LE)
/// ```
pub fn parse_oplog_record(data: &[u8], device_sn: &str) -> Option<OperationLog> {
    if data.len() < 16 {
        return None;
    }

    let op_code = data[2];
    let raw_time = u32::from_le_bytes([data[4], data[5], data[6], data[7]]);
    let param1 = u16::from_le_bytes([data[8], data[9]]);
    let param2 = u16::from_le_bytes([data[10], data[11]]);
    let param3 = u16::from_le_bytes([data[12], data[13]]);
    let param4 = u16::from_le_bytes([data[14], data[15]]);

    let operation = OperationType::from(op_code);
    let timestamp = encoding::decode_zk_time(raw_time).unwrap_or_else(|_| jiff::Timestamp::now());

    let mut params = Vec::new();
    for p in [param1, param2, param3, param4] {
        if p != 0 {
            params.push(p);
        }
    }

    Some(OperationLog {
        device_sn: device_sn.to_string(),
        admin_pin: String::new(),
        timestamp,
        operation,
        params,
    })
}

/// Parse a 92-byte device sizes response from CMD_GET_FREE_SIZES.
///
/// Known field offsets (from pyzatt defs.py STAUS mapping):
/// ```text
/// offset  field
/// 16      user_count
/// 24      fp_count
/// 32      record_count (attlog_count)
/// 40      oplog_count
/// 48      admin_count
/// 52      pwd_count
/// 56      fp_capacity
/// 60      user_capacity
/// 64      record_capacity
/// 68      remaining_fp
/// 72      remaining_user
/// 76      remaining_record
/// 80      face_count
/// 88      face_capacity
/// ```
pub fn parse_device_sizes(data: &[u8]) -> Option<DeviceSizes> {
    if data.len() < 92 {
        return None;
    }

    let read_u32 = |offset: usize| -> u32 {
        if offset + 4 <= data.len() {
            u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
        } else {
            0
        }
    };

    Some(DeviceSizes {
        user_count: read_u32(16),
        fp_count: read_u32(24),
        record_count: read_u32(32),
        oplog_count: read_u32(40),
        admin_count: read_u32(48),
        pwd_count: read_u32(52),
        fp_capacity: read_u32(56),
        user_capacity: read_u32(60),
        record_capacity: read_u32(64),
        remaining_fp: read_u32(68),
        remaining_user: read_u32(72),
        remaining_record: read_u32(76),
        face_count: read_u32(80),
        face_capacity: read_u32(88),
    })
}

/// Parse fingerprint templates from a buffer protocol response.
///
/// The data starts with a 4-byte total_size header, followed by
/// concatenated template entries:
/// ```text
/// [user_sn:2 LE][finger_index:1][template_size:2 LE][template_data:N]...
/// ```
pub fn parse_fingerprint_templates(data: &[u8]) -> Result<Vec<FingerprintTemplate>, String> {
    if data.len() <= 4 {
        return Err("empty template data".to_string());
    }

    let tpl_data = &data[4..];
    let mut templates = Vec::new();
    let mut offset = 0usize;

    while offset + 5 <= tpl_data.len() {
        let user_sn = u16::from_le_bytes([tpl_data[offset], tpl_data[offset + 1]]);
        let finger_index = tpl_data[offset + 2];
        let tpl_size = u16::from_le_bytes([tpl_data[offset + 3], tpl_data[offset + 4]]) as usize;

        let data_start = offset + 5;
        let data_end = data_start + tpl_size;

        if data_end > tpl_data.len() {
            return Err(format!(
                "template data truncated: user_sn={user_sn}, finger={finger_index}, size={tpl_size}"
            ));
        }

        templates.push(FingerprintTemplate {
            user_sn,
            finger_index,
            data: tpl_data[data_start..data_end].to_vec(),
        });

        offset = data_end;
    }

    Ok(templates)
}

/// Parse the 4-byte total_size header from a buffer protocol response.
///
/// The first 4 bytes of a buffer response contain the total dataset size
/// (u32 LE). The actual data follows at offset 4.
pub fn parse_buffer_size(data: &[u8]) -> Option<u32> {
    if data.len() < 4 {
        return None;
    }
    Some(u32::from_le_bytes([data[0], data[1], data[2], data[3]]))
}

/// Parse the total_size from a CMD_DATA_WRRQ ACK_OK response.
///
/// The response data contains: [unknown:1][total_size:4 LE]
pub fn parse_wrrq_size(data: &[u8]) -> Option<u32> {
    if data.len() < 5 {
        return None;
    }
    Some(u32::from_le_bytes([data[1], data[2], data[3], data[4]]))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── Attendance Record (40-byte) Tests ───────────────────────────

    /// Build a valid 40-byte attendance record with given fields.
    fn make_att_record(
        user_sn: u16,
        user_pin: &str,
        timestamp: u32,
        status: u8,
        verify: u8,
    ) -> Vec<u8> {
        let mut buf = vec![0u8; 40];
        // user_sn at offset 0-1
        buf[0..2].copy_from_slice(&user_sn.to_le_bytes());
        // user_id at offset 2-10 (9 bytes ASCII)
        let pin_bytes = user_pin.as_bytes();
        let copy_len = pin_bytes.len().min(9);
        buf[2..2 + copy_len].copy_from_slice(&pin_bytes[..copy_len]);
        // verify_type at offset 26
        buf[26] = verify;
        // timestamp at offset 27-30
        buf[27..31].copy_from_slice(&timestamp.to_le_bytes());
        // status at offset 31
        buf[31] = status;
        buf
    }

    #[test]
    fn test_parse_attendance_check_in_fingerprint() {
        let ts = 1593580800u32; // 2020-07-01 08:00:00
        let record = make_att_record(13, "145", ts, 0, 1);
        let punch = parse_attendance_record(&record, "DEV001").expect("should parse");

        assert_eq!(punch.user_pin, "145");
        assert_eq!(punch.status, PunchStatus::CheckIn);
        assert_eq!(punch.verify_mode, VerifyMode::Fingerprint);
        assert_eq!(punch.device_sn, "DEV001");
        assert!(!punch.id.is_empty(), "dedup ID should be generated");
    }

    #[test]
    fn test_parse_attendance_check_out() {
        let ts = 1593628800u32; // 2020-07-01 17:00:00
        let record = make_att_record(1, "42", ts, 1, 1);
        let punch = parse_attendance_record(&record, "DEV001").expect("should parse");

        assert_eq!(punch.status, PunchStatus::CheckOut);
        assert_eq!(punch.user_pin, "42");
    }

    #[test]
    fn test_parse_attendance_falls_back_to_user_sn() {
        // Empty user_id → should use user_sn
        let record = make_att_record(99, "", 1593580800, 0, 0);
        let punch = parse_attendance_record(&record, "DEV001").expect("should parse");

        assert_eq!(punch.user_pin, "99");
    }

    #[test]
    fn test_parse_attendance_all_verify_modes() {
        let ts = 1593580800;
        let cases = [
            (0u8, VerifyMode::Password),
            (1u8, VerifyMode::Fingerprint),
            (4u8, VerifyMode::Card),
            (15u8, VerifyMode::Face),
            (25u8, VerifyMode::Palm),
        ];
        for (byte, expected) in cases {
            let record = make_att_record(1, "145", ts, 0, byte);
            let punch = parse_attendance_record(&record, "DEV001").expect("should parse");
            assert_eq!(
                punch.verify_mode, expected,
                "verify byte {byte} should map to {expected:?}"
            );
        }
    }

    #[test]
    fn test_parse_attendance_bad_timestamp_graceful() {
        // 0xFFFFFFFF timestamp should fall back to now()
        let record = make_att_record(1, "145", 0xFFFFFFFF, 0, 1);
        let punch =
            parse_attendance_record(&record, "DEV001").expect("should not crash on bad timestamp");

        assert_eq!(punch.user_pin, "145");
        // Timestamp will be "now" — just verify it was set
        assert!(punch.timestamp.as_second() > 0);
    }

    #[test]
    fn test_parse_attendance_too_short() {
        assert!(parse_attendance_record(&[0u8; 20], "DEV001").is_none());
        assert!(parse_attendance_record(&[], "DEV001").is_none());
    }

    #[test]
    fn test_parse_attendance_different_statuses() {
        let ts = 1593580800;
        // status 4 = OvertimeIn, 5 = OvertimeOut
        let cases = [
            (0u8, PunchStatus::CheckIn),
            (1u8, PunchStatus::CheckOut),
            (4u8, PunchStatus::OvertimeIn),
            (5u8, PunchStatus::OvertimeOut),
        ];
        for (byte, expected) in cases {
            let record = make_att_record(1, "145", ts, byte, 1);
            let punch = parse_attendance_record(&record, "DEV001").expect("should parse");
            assert_eq!(punch.status, expected, "status byte {byte}");
        }
    }

    // ─── User Record (72-byte ZK8) Tests ─────────────────────────────

    fn make_user_record_72(sn: u16, pin: &str, name: &str, privilege: u8) -> Vec<u8> {
        let mut buf = vec![0u8; 72];
        // SN at offset 0-1
        buf[0..2].copy_from_slice(&sn.to_le_bytes());
        // privilege at offset 2
        buf[2] = privilege;
        // name at offset 11-34 (24 bytes)
        let name_bytes = name.as_bytes();
        let copy_len = name_bytes.len().min(24);
        buf[11..11 + copy_len].copy_from_slice(&name_bytes[..copy_len]);
        // group at offset 39 (1 = default)
        buf[39] = 1;
        // PIN at offset 48-56 (9 bytes)
        let pin_bytes = pin.as_bytes();
        let copy_len = pin_bytes.len().min(9);
        buf[48..48 + copy_len].copy_from_slice(&pin_bytes[..copy_len]);
        buf
    }

    #[test]
    fn test_parse_user_record_72_basic() {
        let record = make_user_record_72(13, "145", "Ali Zuhair", 0);
        let user = parse_user_record_72(&record).expect("should parse");

        assert_eq!(user.internal_sn, 13);
        assert_eq!(user.pin, "145");
        assert_eq!(user.name, "Ali Zuhair");
        assert_eq!(user.privilege, 0);
        assert!(!user.has_password);
        assert_eq!(user.group, Some(1), "default group should be captured");
        assert!(user.card_number.is_none(), "no card set");
    }

    #[test]
    fn test_parse_user_record_72_admin() {
        let record = make_user_record_72(1, "1", "Admin", 14);
        let user = parse_user_record_72(&record).expect("should parse");

        assert_eq!(user.pin, "1");
        assert_eq!(user.privilege, 14);
        assert_eq!(user.name, "Admin");
    }

    #[test]
    fn test_parse_user_record_72_long_name_truncated() {
        // Name field is 24 bytes — longer names get truncated by the device
        let record = make_user_record_72(1, "123", "ABCDEFGHIJKLMNOPQRSTUVWXYZ123", 0);
        let user = parse_user_record_72(&record).expect("should parse");

        // parse_name trims null bytes, so length may vary
        assert!(user.name.len() <= 24);
        assert!(user.name.starts_with("ABCDEFGHIJKLMNOPQRSTUVWX"));
    }

    #[test]
    fn test_parse_user_record_72_with_password() {
        let mut record = make_user_record_72(5, "500", "User With Pwd", 0);
        // Set password at offset 3-10 (8 bytes)
        let pwd = b"secret1";
        record[3..3 + pwd.len()].copy_from_slice(pwd);

        let user = parse_user_record_72(&record).expect("should parse");
        assert!(user.has_password);
        assert_eq!(
            user.password_raw.as_deref(),
            Some("secret1"),
            "password content should be preserved"
        );
    }

    #[test]
    fn test_parse_user_record_72_too_short() {
        assert!(parse_user_record_72(&[0u8; 50]).is_none());
    }

    // ─── User Record (28-byte legacy) Tests ─────────────────────────

    fn make_user_record_28(sn: u16, pin: u32, name: &str, privilege: u8) -> Vec<u8> {
        let mut buf = vec![0u8; 28];
        buf[0..2].copy_from_slice(&sn.to_le_bytes());
        buf[2] = privilege;
        let name_bytes = name.as_bytes();
        let copy_len = name_bytes.len().min(8);
        buf[8..8 + copy_len].copy_from_slice(&name_bytes[..copy_len]);
        buf[24..28].copy_from_slice(&pin.to_le_bytes());
        buf
    }

    #[test]
    fn test_parse_user_record_28_basic() {
        let record = make_user_record_28(7, 145, "Ali", 0);
        let user = parse_user_record_28(&record).expect("should parse");

        assert_eq!(user.internal_sn, 7);
        assert_eq!(user.pin, "145");
        assert_eq!(user.name, "Ali");
        assert_eq!(user.privilege, 0);
        assert!(user.card_number.is_none(), "no card set");
        assert!(user.group.is_none(), "no group set");
        assert!(!user.has_password);
    }

    #[test]
    fn test_parse_user_record_28_with_card_and_group() {
        let mut record = make_user_record_28(7, 145, "Ali", 0);
        // Card number at offset 16-19 (u32 LE = 12345678)
        let card: u32 = 12345678;
        record[16..20].copy_from_slice(&card.to_le_bytes());
        // Group at offset 20
        record[20] = 3;

        let user = parse_user_record_28(&record).expect("should parse");
        assert_eq!(user.card_number.as_deref(), Some("12345678"));
        assert_eq!(user.group, Some(3));
    }

    #[test]
    fn test_parse_user_record_28_with_privilege() {
        let record = make_user_record_28(1, 1, "Admin", 14);
        let user = parse_user_record_28(&record).expect("should parse");

        assert_eq!(user.privilege, 14);
    }

    #[test]
    fn test_parse_user_record_28_too_short() {
        assert!(parse_user_record_28(&[0u8; 20]).is_none());
    }

    // ─── Operation Log (16-byte) Tests ──────────────────────────────

    fn make_oplog_record(op_code: u8, timestamp: u32, params: &[u16; 4]) -> Vec<u8> {
        let mut buf = vec![0u8; 16];
        buf[2] = op_code;
        buf[4..8].copy_from_slice(&timestamp.to_le_bytes());
        for (i, &p) in params.iter().enumerate() {
            let offset = 8 + i * 2;
            buf[offset..offset + 2].copy_from_slice(&p.to_le_bytes());
        }
        buf
    }

    #[test]
    fn test_parse_oplog_enroll_user() {
        let ts = 1593580800u32;
        let record = make_oplog_record(0, ts, &[13, 1, 0, 0]);
        let log = parse_oplog_record(&record, "DEV001").expect("should parse");

        assert_eq!(log.operation, OperationType::EnrollUser);
        assert_eq!(log.params, vec![13, 1]);
        assert_eq!(log.device_sn, "DEV001");
    }

    #[test]
    fn test_parse_oplog_delete_user() {
        let record = make_oplog_record(1, 1593580800, &[5, 0, 0, 0]);
        let log = parse_oplog_record(&record, "DEV001").expect("should parse");

        assert_eq!(log.operation, OperationType::DeleteUser);
        assert_eq!(log.params, vec![5]);
    }

    #[test]
    fn test_parse_oplog_startup() {
        let record = make_oplog_record(6, 1593580800, &[0, 0, 0, 0]);
        let log = parse_oplog_record(&record, "DEV001").expect("should parse");

        assert_eq!(log.operation, OperationType::Startup);
        assert!(log.params.is_empty());
    }

    #[test]
    fn test_parse_oplog_all_known_codes() {
        // Operation codes according to pyzatt defs:
        let cases = [
            (0u8, "Enroll User"),
            (1u8, "Delete User"),
            (2u8, "Set User Info"),
            (6u8, "Device Startup / Reboot"),
            (8u8, "Admin Verification"),
            (30u8, "Clear Attendance by Time"),
        ];
        for (code, expected_name) in cases {
            let record = make_oplog_record(code, 1593580800, &[0, 0, 0, 0]);
            let log = parse_oplog_record(&record, "DEV001").expect("should parse");
            assert_eq!(
                log.operation.name(),
                expected_name,
                "op code {code} should be {expected_name}"
            );
        }
    }

    #[test]
    fn test_parse_oplog_unknown_code() {
        let record = make_oplog_record(99, 1593580800, &[0, 0, 0, 0]);
        let log = parse_oplog_record(&record, "DEV001").expect("should parse");

        assert_eq!(log.operation, OperationType::Unknown(99));
    }

    #[test]
    fn test_parse_oplog_too_short() {
        assert!(parse_oplog_record(&[0u8; 10], "DEV001").is_none());
    }

    #[test]
    fn test_parse_oplog_bad_timestamp_graceful() {
        let record = make_oplog_record(0, 0xFFFFFFFF, &[0; 4]);
        let log = parse_oplog_record(&record, "DEV001").expect("should parse");

        assert_eq!(log.operation, OperationType::EnrollUser);
        assert!(log.timestamp.as_second() > 0);
    }

    // ─── Device Sizes (92-byte) Tests ───────────────────────────────

    fn make_sizes_data(
        user_count: u32,
        fp_count: u32,
        record_count: u32,
        oplog_count: u32,
    ) -> Vec<u8> {
        let mut data = vec![0u8; 92];
        data[16..20].copy_from_slice(&user_count.to_le_bytes());
        data[24..28].copy_from_slice(&fp_count.to_le_bytes());
        data[32..36].copy_from_slice(&record_count.to_le_bytes());
        data[40..44].copy_from_slice(&oplog_count.to_le_bytes());
        data[48..52].copy_from_slice(&5u32.to_le_bytes()); // admin_count
        data[52..56].copy_from_slice(&10u32.to_le_bytes()); // pwd_count
        data[56..60].copy_from_slice(&3000u32.to_le_bytes()); // fp_capacity
        data[60..64].copy_from_slice(&5000u32.to_le_bytes()); // user_capacity
        data[64..68].copy_from_slice(&100000u32.to_le_bytes()); // record_capacity
        data[68..72].copy_from_slice(&2500u32.to_le_bytes()); // remaining_fp
        data[72..76].copy_from_slice(&4800u32.to_le_bytes()); // remaining_user
        data[76..80].copy_from_slice(&85000u32.to_le_bytes()); // remaining_record
        data[80..84].copy_from_slice(&50u32.to_le_bytes()); // face_count
        data[88..92].copy_from_slice(&200u32.to_le_bytes()); // face_capacity
        data
    }

    #[test]
    fn test_parse_device_sizes_full() {
        let data = make_sizes_data(116, 402, 11489, 234);
        let sizes = parse_device_sizes(&data).expect("should parse");

        assert_eq!(sizes.user_count, 116);
        assert_eq!(sizes.fp_count, 402);
        assert_eq!(sizes.record_count, 11489);
        assert_eq!(sizes.oplog_count, 234);
        assert_eq!(sizes.admin_count, 5);
        assert_eq!(sizes.pwd_count, 10);
        assert_eq!(sizes.fp_capacity, 3000);
        assert_eq!(sizes.user_capacity, 5000);
        assert_eq!(sizes.record_capacity, 100000);
        assert_eq!(sizes.remaining_fp, 2500);
        assert_eq!(sizes.remaining_user, 4800);
        assert_eq!(sizes.remaining_record, 85000);
        assert_eq!(sizes.face_count, 50);
        assert_eq!(sizes.face_capacity, 200);
    }

    #[test]
    fn test_parse_device_sizes_empty_device() {
        let data = make_sizes_data(0, 0, 0, 0);
        let sizes = parse_device_sizes(&data).expect("should parse");

        assert_eq!(sizes.user_count, 0);
        assert_eq!(sizes.fp_count, 0);
        assert_eq!(sizes.record_count, 0);
    }

    #[test]
    fn test_parse_device_sizes_too_short() {
        assert!(parse_device_sizes(&[0u8; 50]).is_none());
    }

    // ─── Fingerprint Template Tests ─────────────────────────────────

    #[test]
    fn test_parse_fingerprint_templates_single() {
        // Header: 4-byte total_size
        let mut data = vec![0u8; 4];
        // Template: [user_sn:2][finger:1][tpl_size:2][data:5]
        let tpl_data = vec![0xAA, 0xBB, 0xCC, 0xDD, 0xEE];
        let tpl_size = tpl_data.len() as u16;
        let user_sn: u16 = 13;
        let finger: u8 = 1;

        let mut template = Vec::new();
        template.extend_from_slice(&user_sn.to_le_bytes());
        template.push(finger);
        template.extend_from_slice(&tpl_size.to_le_bytes());
        template.extend_from_slice(&tpl_data);

        // Set total_size
        let total_size = template.len() as u32;
        data[0..4].copy_from_slice(&total_size.to_le_bytes());
        data.extend_from_slice(&template);

        let templates = parse_fingerprint_templates(&data).expect("should parse");

        assert_eq!(templates.len(), 1);
        assert_eq!(templates[0].user_sn, 13);
        assert_eq!(templates[0].finger_index, 1);
        assert_eq!(templates[0].data, tpl_data);
    }

    #[test]
    fn test_parse_fingerprint_templates_multiple() {
        let mut data = vec![0u8; 4];

        // Template 1: user_sn=1, finger=0, data=[0x11, 0x22]
        let mut t1 = Vec::new();
        t1.extend_from_slice(&1u16.to_le_bytes());
        t1.push(0u8);
        t1.extend_from_slice(&2u16.to_le_bytes());
        t1.extend_from_slice(&[0x11, 0x22]);

        // Template 2: user_sn=2, finger=1, data=[0x33, 0x44, 0x55]
        let mut t2 = Vec::new();
        t2.extend_from_slice(&2u16.to_le_bytes());
        t2.push(1u8);
        t2.extend_from_slice(&3u16.to_le_bytes());
        t2.extend_from_slice(&[0x33, 0x44, 0x55]);

        let all = [t1.as_slice(), t2.as_slice()].concat();
        let total = all.len() as u32;
        data[0..4].copy_from_slice(&total.to_le_bytes());
        data.extend_from_slice(&all);

        let templates = parse_fingerprint_templates(&data).expect("should parse");

        assert_eq!(templates.len(), 2);
        assert_eq!(templates[0].user_sn, 1);
        assert_eq!(templates[0].finger_index, 0);
        assert_eq!(templates[0].data, vec![0x11, 0x22]);
        assert_eq!(templates[1].user_sn, 2);
        assert_eq!(templates[1].finger_index, 1);
        assert_eq!(templates[1].data, vec![0x33, 0x44, 0x55]);
    }

    #[test]
    fn test_parse_fingerprint_templates_empty() {
        assert!(parse_fingerprint_templates(&[0u8; 4]).is_err());
        assert!(parse_fingerprint_templates(&[]).is_err());
    }

    // ─── Buffer / WRRQ Size Tests ───────────────────────────────────

    #[test]
    fn test_parse_buffer_size() {
        let data = [0x40, 0xE2, 0x01, 0x00]; // 123456 in LE
        let size = parse_buffer_size(&data).expect("should parse");
        assert_eq!(size, 123456);
    }

    #[test]
    fn test_parse_buffer_size_zero() {
        let data = [0x00, 0x00, 0x00, 0x00];
        let size = parse_buffer_size(&data).expect("should parse");
        assert_eq!(size, 0);
    }

    #[test]
    fn test_parse_buffer_size_too_short() {
        assert!(parse_buffer_size(&[0u8; 2]).is_none());
    }

    #[test]
    fn test_parse_wrrq_size() {
        // DATA_WRRQ ACK_OK response: [unknown:1][total_size:4 LE]
        let data = [0x00, 0x40, 0xE2, 0x01, 0x00]; // size = 123456
        let size = parse_wrrq_size(&data).expect("should parse");
        assert_eq!(size, 123456);
    }

    #[test]
    fn test_parse_wrrq_size_too_short() {
        assert!(parse_wrrq_size(&[0u8; 3]).is_none());
    }
}
