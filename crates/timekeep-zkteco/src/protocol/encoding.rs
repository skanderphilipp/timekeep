//! Data encoding utilities for the ZKTeco protocol.
//!
//! Includes:
//! - The comm key scramble algorithm (MakeKey from commpro.c)
//! - The custom epoch time encoding used by ZKTeco devices
//! - User record and attendance record binary layouts
//! - User record encoding for set_user operations
//!
//! Reference: `adrobinoga/zk-protocol`, `fananimi/pyzk/zk/base.py`

use timekeep_core::Error;

/// Scramble a password with the session ID for authentication.
///
/// Implements the `MakeKey` algorithm from ZKTeco's commpro.c.
/// This is the exact Rust translation of pyzk's `make_commkey` function.
///
/// # Arguments
/// * `password` - The device's communication key (0 if factory default)
/// * `session_id` - Session ID assigned by the device after CONNECT
/// * `ticks` - Ticks parameter, typically 50
pub fn scramble_comm_key(password: u32, session_id: u16, ticks: u8) -> [u8; 4] {
    let key = password as u64;
    let session_id = session_id as u64;

    // Step 1: Bit-reverse the key (reverse bits of each 32-bit word)
    let mut k: u64 = 0;
    for i in 0..32 {
        if (key & (1u64 << i)) != 0 {
            k = (k << 1) | 1;
        } else {
            k <<= 1;
        }
    }

    // Step 2: Add session_id
    k = k.wrapping_add(session_id);

    // Step 3: Pack as u32 LE, then unpack as 4 bytes
    let k_u32 = k as u32;
    let mut kb = k_u32.to_le_bytes(); // [b0, b1, b2, b3]

    // Step 4: XOR with 'Z', 'K', 'S', 'O'
    kb[0] ^= b'Z';
    kb[1] ^= b'K';
    kb[2] ^= b'S';
    kb[3] ^= b'O';

    // Step 5: Reinterpret as two u16 LE, swap them
    let k0 = u16::from_le_bytes([kb[0], kb[1]]);
    let k1 = u16::from_le_bytes([kb[2], kb[3]]);
    // Pack swapped: k1 first, then k0
    let swapped: [u8; 4] = {
        let mut buf = [0u8; 4];
        buf[..2].copy_from_slice(&k1.to_le_bytes());
        buf[2..].copy_from_slice(&k0.to_le_bytes());
        buf
    };

    // Step 6: XOR with ticks
    let b = ticks;
    [swapped[0] ^ b, swapped[1] ^ b, b, swapped[3] ^ b]
}

/// ZKTeco custom epoch formula.
///
/// Encodes a civil date/time as a 32-bit integer:
/// ```text
/// enc = ((year%100)*12*31 + (month-1)*31 + (day-1)) * 86400
///       + hour*3600 + minute*60 + second
/// ```
///
/// This is a lossy approximation — months are treated as 31 days each.
/// The formula is designed for fast lookup on resource-constrained embedded
/// devices, not calendar precision.
///
/// Reference: `adrobinoga/zk-protocol/sections/terminal.md`
/// Decode a ZKTeco-encoded timestamp (u32) into a `jiff::Timestamp`.
pub fn decode_zk_time(raw: u32) -> Result<jiff::Timestamp, Error> {
    let mut t = raw as u64;

    let second = (t % 60) as i16;
    t /= 60;

    let minute = (t % 60) as i16;
    t /= 60;

    let hour = (t % 24) as i16;
    t /= 24;

    let day = ((t % 31) + 1) as i16;
    t /= 31;

    let month = ((t % 12) + 1) as i16;
    t /= 12;

    let year = (t + 2000) as i16;

    let date = jiff::civil::Date::new(year, month as i8, day as i8)
        .map_err(|e| Error::validation(format!("invalid date {year}-{month:02}-{day:02}: {e}")))?;
    let time = jiff::civil::Time::new(hour as i8, minute as i8, second as i8, 0).map_err(|e| {
        Error::validation(format!("invalid time {hour:02}:{minute:02}:{second:02}: {e}"))
    })?;
    let dt = jiff::civil::DateTime::from_parts(date, time);

    dt.to_zoned(jiff::tz::TimeZone::UTC)
        .map(|z| z.timestamp())
        .map_err(|e| Error::validation(format!("timestamp conversion: {e}")))
}

/// Encode a `jiff::Timestamp` into ZKTeco's custom 32-bit time format.
pub fn encode_zk_time(ts: jiff::Timestamp) -> Result<u32, String> {
    let zoned = ts.to_zoned(jiff::tz::TimeZone::UTC);

    let dt = zoned.datetime();
    let year = dt.year() as u64;
    let month = dt.month() as u64;
    let day = dt.day() as u64;
    let hour = dt.hour() as u64;
    let minute = dt.minute() as u64;
    let second = dt.second() as u64;

    let encoded = ((year % 100) * 12 * 31 + (month - 1) * 31 + (day - 1)) * 86400
        + hour * 3600
        + minute * 60
        + second;

    Ok(encoded as u32)
}

/// Parse a null-terminated user ID string from binary attendance record data.
pub fn parse_user_id(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).to_string()
}

/// Parse a null-terminated name string from binary user record data.
pub fn parse_name(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_string()
}

/// Encode a user into a 72-byte binary record (ZK8 / new firmware format).
///
/// # Record Layout (72 bytes)
///
/// | Offset | Size | Field               |
/// |--------|------|---------------------|
/// | 0      | 2    | User SN (u16 LE)    |
/// | 2      | 1    | Permission token    |
/// | 3      | 8    | Password (string)   |
/// | 11     | 24   | Name (string)       |
/// | 35     | 4    | Card number (u32 LE)|
/// | 39     | 1    | Group number        |
/// | 40     | 2    | User TZ flag        |
/// | 42     | 2    | TZ1                 |
/// | 44     | 2    | TZ2                 |
/// | 46     | 2    | TZ3                 |
/// | 48     | 9    | User ID / PIN       |
/// | 57     | 15   | Padding (zeros)     |
pub fn encode_user_record_72(
    uid: u16,
    pin: &str,
    name: &str,
    password: &str,
    privilege: u8,
    card_number: u32,
    group: u8,
    timezone: u16,
) -> [u8; 72] {
    let mut record = [0u8; 72];

    // Offset 0-1: User SN (u16 LE)
    record[0..2].copy_from_slice(&uid.to_le_bytes());

    // Offset 2: Permission token
    record[2] = encode_permission_token(privilege, true);

    // Offset 3-10: Password (8 bytes, null-terminated)
    let pwd_bytes = password.as_bytes();
    let pwd_len = pwd_bytes.len().min(7);
    record[3..3 + pwd_len].copy_from_slice(&pwd_bytes[..pwd_len]);

    // Offset 11-34: Name (24 bytes, null-terminated)
    let name_bytes = name.as_bytes();
    let name_len = name_bytes.len().min(23);
    record[11..11 + name_len].copy_from_slice(&name_bytes[..name_len]);

    // Offset 35-38: Card number (u32 LE)
    record[35..39].copy_from_slice(&card_number.to_le_bytes());

    // Offset 39: Group number
    record[39] = group;

    // Offset 40-41: User TZ flag
    record[40..42].copy_from_slice(&timezone.to_le_bytes());

    // Offset 42-47: TZ1, TZ2, TZ3 (device-level, zero for now)
    // (already zero-initialized)

    // Offset 48-56: User ID / PIN (9 bytes, null-terminated)
    let pin_bytes = pin.as_bytes();
    let pin_len = pin_bytes.len().min(8);
    record[48..48 + pin_len].copy_from_slice(&pin_bytes[..pin_len]);

    // Offset 57-71: Padding (already zero)

    record
}

/// Encode a user into a 28-byte binary record (ZK6 / older firmware format).
///
/// # Record Layout (28 bytes)
///
/// | Offset | Size | Field               |
/// |--------|------|---------------------|
/// | 0      | 2    | User SN (u16 LE)    |
/// | 2      | 1    | Permission token    |
/// | 3      | 5    | Password (string)   |
/// | 8      | 8    | Name (string)       |
/// | 16     | 4    | Card number (u32 LE)|
/// | 20     | 1    | Group number        |
/// | 21     | 2    | User TZ flag (u16)  |
/// | 23     | 1    | Reserved            |
/// | 24     | 4    | User ID (u32 LE)    |
pub fn encode_user_record_28(
    uid: u16,
    pin: &str,
    name: &str,
    password: &str,
    privilege: u8,
    card_number: u32,
    group: u8,
    timezone: u16,
) -> [u8; 28] {
    let mut record = [0u8; 28];

    // Offset 0-1: User SN (u16 LE)
    record[0..2].copy_from_slice(&uid.to_le_bytes());

    // Offset 2: Permission token
    record[2] = encode_permission_token(privilege, true);

    // Offset 3-7: Password (5 bytes, null-terminated)
    let pwd_bytes = password.as_bytes();
    let pwd_len = pwd_bytes.len().min(4);
    record[3..3 + pwd_len].copy_from_slice(&pwd_bytes[..pwd_len]);

    // Offset 8-15: Name (8 bytes, null-terminated)
    let name_bytes = name.as_bytes();
    let name_len = name_bytes.len().min(7);
    record[8..8 + name_len].copy_from_slice(&name_bytes[..name_len]);

    // Offset 16-19: Card number (u32 LE)
    record[16..20].copy_from_slice(&card_number.to_le_bytes());

    // Offset 20: Group number
    record[20] = group;

    // Offset 21-22: User TZ flag
    record[21..23].copy_from_slice(&timezone.to_le_bytes());

    // Offset 24-27: User ID / PIN (u32 LE — numeric PIN only for ZK6)
    if let Ok(pin_num) = pin.parse::<u32>() {
        record[24..28].copy_from_slice(&pin_num.to_le_bytes());
    }

    record
}

/// Build the permission token byte from privilege level and enabled state.
///
/// Permission token layout:
/// - Bit 0 (E0): 0 = enabled, 1 = disabled
/// - Bits 3-1 (P2P1P0): admin level (0=common, 1=enroll, 3=admin, 7=super admin)
/// - Bits 7-4: unused
fn encode_permission_token(privilege: u8, enabled: bool) -> u8 {
    // Map privilege to admin level bits
    let level_bits = if privilege >= 14 {
        0b1110 // Super admin (bits 3-1 = 111)
    } else if privilege > 0 {
        0b0010 // Enroll user (bits 3-1 = 001)
    } else {
        0b0000 // Common user
    };

    // Set enable bit (bit 0 = 0 for enabled)
    if enabled {
        level_bits // E0 = 0
    } else {
        level_bits | 0b0001 // E0 = 1 (disabled)
    }
}

/// Decode a 72-byte user record into individual fields.
///
/// Inverse of `encode_user_record_72`. Used for testing round-trips.
#[cfg(test)]
pub fn decode_user_record_72(record: &[u8; 72]) -> (u16, String, String, String, u8, u32, u8, u16) {
    let uid = u16::from_le_bytes([record[0], record[1]]);
    let privilege = decode_privilege_from_token(record[2]);
    let password = parse_name(&record[3..11]);
    let name = parse_name(&record[11..35]);
    let card = u32::from_le_bytes([record[35], record[36], record[37], record[38]]);
    let group = record[39];
    let timezone = u16::from_le_bytes([record[40], record[41]]);
    let pin = parse_user_id(&record[48..57]);
    (uid, pin, name, password, privilege, card, group, timezone)
}

/// Decode privilege level from a permission token byte.
#[cfg(test)]
fn decode_privilege_from_token(token: u8) -> u8 {
    let level_bits = (token >> 1) & 0b0111;
    match level_bits {
        0 => 0,  // Common user
        1 => 1,  // Enroll user
        3 => 14, // Admin
        7 => 14, // Super admin
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- scramble_comm_key tests ---

    #[test]
    fn test_scramble_comm_key_zero() {
        let result = scramble_comm_key(0, 0, 50);
        assert_eq!(result.len(), 4);
    }

    #[test]
    fn test_scramble_comm_key_known_device_session() {
        // From real Biopro SA40: session_id=0xC5C0 (50624)
        let result = scramble_comm_key(0, 0xC5C0, 50);
        assert_eq!(result.len(), 4);
        // Third byte should be just ticks value (50 = 0x32)
        assert_eq!(result[2], 50);
    }

    #[test]
    fn test_scramble_comm_key_nonzero() {
        let result = scramble_comm_key(12345, 0xABCD, 50);
        assert_eq!(result.len(), 4);
    }

    #[test]
    fn test_scramble_comm_key_deterministic() {
        let r1 = scramble_comm_key(42, 0x1234, 50);
        let r2 = scramble_comm_key(42, 0x1234, 50);
        assert_eq!(r1, r2, "same inputs must produce same output");
    }

    #[test]
    fn test_scramble_differs_by_input() {
        // Use non-zero comm_key and real-world session IDs (devices use
        // seconds counter, not tiny values). Small session IDs (1, 2)
        // produce identical output when comm_key=0 because only the LSB
        // byte differs, and the XOR+swap obfuscation treats those identically.
        let r1 = scramble_comm_key(12345, 0x5678, 50);
        let r2 = scramble_comm_key(12345, 0xABCD, 50);
        assert_ne!(r1, r2, "different session ids must produce different outputs");
    }

    #[test]
    fn test_scramble_differs_by_comm_key() {
        let r1 = scramble_comm_key(0, 0xC5C0, 50);
        let r2 = scramble_comm_key(12345, 0xC5C0, 50);
        assert_ne!(r1, r2, "different passwords must produce different outputs");
    }

    // --- decode_zk_time tests ---

    #[test]
    fn test_decode_zk_time_computed() {
        // Compute the encoded value for 2026-07-09 07:16:11 (typical office punch)
        let enc = ((26u64) * 12 * 31 + (7 - 1) * 31 + (9 - 1)) * 86400 + 7 * 3600 + 16 * 60 + 11;
        let ts = decode_zk_time(enc as u32).expect("should decode");
        let zoned = ts.to_zoned(jiff::tz::TimeZone::UTC);
        assert_eq!(zoned.year(), 2026);
        assert_eq!(zoned.month(), 7);
        assert_eq!(zoned.day(), 9);
        assert_eq!(zoned.hour(), 7);
        assert_eq!(zoned.minute(), 16);
        assert_eq!(zoned.second(), 11);
    }

    #[test]
    fn test_decode_zk_time_zero() {
        let ts = decode_zk_time(0).expect("should decode");
        let zoned = ts.to_zoned(jiff::tz::TimeZone::UTC);
        assert_eq!(zoned.year(), 2000);
        assert_eq!(zoned.month(), 1);
        assert_eq!(zoned.day(), 1);
    }

    #[test]
    fn test_decode_zk_time_end_of_month() {
        let ts = decode_zk_time(30 * 86400).expect("should decode");
        let zoned = ts.to_zoned(jiff::tz::TimeZone::UTC);
        assert_eq!(zoned.day(), 31);
        assert_eq!(zoned.month(), 1);
    }

    #[test]
    fn test_decode_zk_time_feb_28() {
        // Feb 28, 2000 (31 days in Jan + 28 in Feb = 59 days from epoch)
        let ts = decode_zk_time(59 * 86400).expect("should decode");
        let zoned = ts.to_zoned(jiff::tz::TimeZone::UTC);
        // The ZKTeco format treats all months as 31 days
        // 59 days = 1*31 + 28, so month=2, day=28
        assert_eq!(zoned.month(), 2);
    }

    // --- encode_zk_time tests ---

    #[test]
    fn test_encode_zk_time_basic() {
        let date = jiff::civil::Date::new(2026, 7, 9).unwrap();
        let time = jiff::civil::Time::new(7, 16, 11, 0).unwrap();
        let dt = jiff::civil::DateTime::from_parts(date, time);
        let ts = dt.to_zoned(jiff::tz::TimeZone::UTC).unwrap().timestamp();
        let encoded = encode_zk_time(ts).expect("should encode");
        assert!(encoded > 0);
    }

    #[test]
    fn test_roundtrip_time() {
        let date = jiff::civil::Date::new(2026, 7, 9).unwrap();
        let time = jiff::civil::Time::new(13, 45, 0, 0).unwrap();
        let dt = jiff::civil::DateTime::from_parts(date, time);
        let ts = dt.to_zoned(jiff::tz::TimeZone::UTC).unwrap().timestamp();

        let encoded = encode_zk_time(ts).expect("should encode");
        let decoded = decode_zk_time(encoded).expect("should decode");
        let decoded_zoned = decoded.to_zoned(jiff::tz::TimeZone::UTC);

        assert_eq!(decoded_zoned.year(), 2026);
        assert_eq!(decoded_zoned.month(), 7);
        assert_eq!(decoded_zoned.day(), 9);
    }

    #[test]
    fn test_roundtrip_multiple() {
        let test_dates = [
            (2024, 5, 4, 8, 0, 0),      // Beginning of test data range
            (2025, 1, 1, 0, 0, 0),      // New Year
            (2026, 7, 9, 17, 30, 0),    // Afternoon punch
            (2026, 12, 31, 23, 59, 59), // Year end
        ];

        for (y, m, d, h, min, s) in test_dates {
            let date = jiff::civil::Date::new(y, m, d).unwrap();
            let time = jiff::civil::Time::new(h, min, s, 0).unwrap();
            let dt = jiff::civil::DateTime::from_parts(date, time);
            let ts = dt.to_zoned(jiff::tz::TimeZone::UTC).unwrap().timestamp();

            let encoded = encode_zk_time(ts).expect("should encode");
            let decoded = decode_zk_time(encoded).expect("should decode");
            let dz = decoded.to_zoned(jiff::tz::TimeZone::UTC);

            assert_eq!(dz.year(), y, "year mismatch for {y}-{m:02}-{d:02}");
            assert_eq!(dz.month(), m, "month mismatch for {y}-{m:02}-{d:02}");
            assert_eq!(dz.day(), d, "day mismatch for {y}-{m:02}-{d:02}");
            assert_eq!(dz.hour(), h, "hour mismatch for {y}-{m:02}-{d:02}");
            assert_eq!(dz.minute(), min, "minute mismatch for {y}-{m:02}-{d:02}");
            assert_eq!(dz.second(), s, "second mismatch for {y}-{m:02}-{d:02}");
        }
    }

    // --- parse_name / parse_user_id tests ---

    #[test]
    fn test_parse_user_id_normal() {
        let bytes = b"999111333\x00\x00\x00\x00\x00";
        assert_eq!(parse_user_id(bytes), "999111333");
    }

    #[test]
    fn test_parse_user_id_no_null() {
        let bytes = b"123456789";
        assert_eq!(parse_user_id(bytes), "123456789");
    }

    #[test]
    fn test_parse_name_with_whitespace() {
        let bytes = b"ALI ZUHAIR\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00";
        assert_eq!(parse_name(bytes), "ALI ZUHAIR");
    }

    #[test]
    fn test_parse_name_empty() {
        let bytes = [0u8; 24];
        assert_eq!(parse_name(&bytes), "");
    }

    // --- User record encoding tests ---

    #[test]
    fn test_encode_user_record_72_basic() {
        let record = encode_user_record_72(1, "12345", "Test User", "", 0, 0, 1, 0);
        assert_eq!(record.len(), 72);
        assert_eq!(u16::from_le_bytes([record[0], record[1]]), 1);
        assert_eq!(&record[48..53], b"12345");
        assert_eq!(&record[11..20], b"Test User");
        assert_eq!(record[2], 0x00); // privilege 0, enabled
        assert_eq!(record[39], 1); // default group
    }

    #[test]
    fn test_encode_user_record_72_admin() {
        let record = encode_user_record_72(5, "999", "Admin", "", 14, 0, 1, 0);
        // Super admin: bits 3-1 = 111, bit 0 = 0 -> 0x0E
        assert_eq!(record[2], 0x0E);
    }

    #[test]
    fn test_permission_token_common_enabled() {
        assert_eq!(encode_permission_token(0, true), 0x00);
    }

    #[test]
    fn test_permission_token_common_disabled() {
        assert_eq!(encode_permission_token(0, false), 0x01);
    }

    #[test]
    fn test_permission_token_admin_enabled() {
        assert_eq!(encode_permission_token(14, true), 0x0E);
    }

    #[test]
    fn test_permission_token_admin_disabled() {
        assert_eq!(encode_permission_token(14, false), 0x0F);
    }

    #[test]
    fn test_encode_user_record_72_with_password() {
        let record = encode_user_record_72(2, "555", "Ned", "444", 0, 0xDE, 1, 0);
        assert_eq!(&record[3..6], b"444");
        assert_eq!(record[6], 0);
        let card = u32::from_le_bytes([record[35], record[36], record[37], record[38]]);
        assert_eq!(card, 0xDE);
    }

    #[test]
    fn test_encode_user_record_72_long_name_truncated() {
        let long_name = "A".repeat(50);
        let record = encode_user_record_72(1, "1", &long_name, "", 0, 0, 1, 0);
        let name_from_record = parse_name(&record[11..35]);
        assert_eq!(name_from_record.len(), 23);
        assert!(long_name.starts_with(&name_from_record));
    }

    #[test]
    fn test_encode_user_record_72_long_pin_truncated() {
        let long_pin = "1234567890";
        let record = encode_user_record_72(1, long_pin, "Test", "", 0, 0, 1, 0);
        let pin_from_record = parse_user_id(&record[48..57]);
        assert_eq!(pin_from_record.len(), 8);
        assert_eq!(pin_from_record, "12345678");
    }

    #[test]
    fn test_encode_user_record_72_group_default() {
        let record = encode_user_record_72(1, "1", "User", "", 0, 0, 1, 0);
        assert_eq!(record[39], 1);
    }

    #[test]
    fn test_encode_user_record_72_group_custom() {
        let record = encode_user_record_72(1, "1", "User", "", 0, 0, 5, 0);
        assert_eq!(record[39], 5, "custom group should be written");
    }

    #[test]
    fn test_encode_user_record_72_timezone_custom() {
        let tz: u16 = 0x1234;
        let record = encode_user_record_72(1, "1", "User", "", 0, 0, 1, tz);
        let written_tz = u16::from_le_bytes([record[40], record[41]]);
        assert_eq!(written_tz, tz, "custom timezone should be written");
    }

    #[test]
    fn test_roundtrip_user_record_72() {
        let record = encode_user_record_72(0x0D, "555", "Ned", "444", 0, 0xDE, 3, 0x42);
        let (uid, pin, name, password, privilege, card, group, tz) = decode_user_record_72(&record);
        assert_eq!(uid, 0x0D);
        assert_eq!(pin, "555");
        assert_eq!(name, "Ned");
        assert_eq!(password, "444");
        assert_eq!(privilege, 0);
        assert_eq!(card, 0xDE);
        assert_eq!(group, 3);
        assert_eq!(tz, 0x42);
    }

    #[test]
    fn test_roundtrip_user_record_72_admin() {
        let record = encode_user_record_72(0x0E, "11224488", "Nuevo", "123456", 14, 6543, 1, 0);
        let (uid, pin, name, password, privilege, card, group, tz) = decode_user_record_72(&record);
        assert_eq!(uid, 0x0E);
        assert_eq!(pin, "11224488");
        assert_eq!(name, "Nuevo");
        assert_eq!(password, "123456");
        assert_eq!(privilege, 14);
        assert_eq!(card, 6543);
        assert_eq!(group, 1);
        assert_eq!(tz, 0);
    }

    // --- User record 28-byte format tests ---

    #[test]
    fn test_encode_user_record_28_basic() {
        let record = encode_user_record_28(1, "12345", "Test", "", 0, 0, 1, 0);
        assert_eq!(record.len(), 28);
        assert_eq!(u16::from_le_bytes([record[0], record[1]]), 1);
        let pin = u32::from_le_bytes([record[24], record[25], record[26], record[27]]);
        assert_eq!(pin, 12345);
        assert_eq!(record[20], 1, "default group");
    }

    #[test]
    fn test_encode_user_record_28_non_numeric_pin() {
        let record = encode_user_record_28(1, "ABC", "Test", "", 0, 0, 1, 0);
        let pin = u32::from_le_bytes([record[24], record[25], record[26], record[27]]);
        assert_eq!(pin, 0);
    }
}
