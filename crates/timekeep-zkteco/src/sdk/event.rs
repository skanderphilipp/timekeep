//! Real-time event types and parsers.
//!
//! When CMD_REG_EVENT is enabled, the device sends unsolicited packets
//! where `reply_id == 0`. The `session_id` field carries the event code,
//! and the data payload contains event-specific information.
//!
//! Reference: `adrobinoga/zk-protocol` sections/realtime.md
//! Reference: `fananimi/pyzatt` zkmodules/realtime.py, zkmodules/defs.py

use timekeep_core::model::VerifyMode;

use crate::protocol::encoding;

/// ZKTeco real-time event codes (stored in session_id field of event packets).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u16)]
pub enum EventCode {
    /// Real-time attendance punch
    AttLog = 0x01,
    /// Finger placed on reader
    Finger = 0x02,
    /// User enrolled on device (start or complete)
    EnrollUser = 0x04,
    /// Fingerprint enrollment result
    EnrollFinger = 0x08,
    /// Button pressed
    Button = 0x10,
    /// Door unlocked
    Unlock = 0x20,
    /// User identity verified
    Verify = 0x80,
    /// Fingerprint quality score (enrollment feedback)
    FingerScore = 0x100,
    /// Alarm triggered (tamper, duress, door forced)
    Alarm = 0x200,
}

impl EventCode {
    /// Decode a raw event code from the session_id field of a real-time packet.
    pub fn from_session_id(session_id: u16) -> Option<Self> {
        match session_id {
            0x01 => Some(Self::AttLog),
            0x02 => Some(Self::Finger),
            0x04 => Some(Self::EnrollUser),
            0x08 => Some(Self::EnrollFinger),
            0x10 => Some(Self::Button),
            0x20 => Some(Self::Unlock),
            0x80 => Some(Self::Verify),
            0x100 => Some(Self::FingerScore),
            0x200 => Some(Self::Alarm),
            _ => None,
        }
    }

    /// Check if a reply_id indicates a real-time event packet.
    pub fn is_event_packet(reply_id: u16) -> bool {
        reply_id == 0
    }
}

/// Alarm types extracted from EF_ALARM events.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AlarmType {
    /// Device misoperation detected
    Misoperation,
    /// Tamper switch activated
    Tamper,
    /// Exit button pressed
    ExitButton,
    /// Door closed
    DoorClosing,
    /// Duress fingerprint used
    Duress,
    /// Anti-passback violation
    Passback,
    /// Unknown alarm type
    Unknown(u8),
}

/// A parsed real-time event from the device.
#[derive(Debug, Clone)]
pub enum RealTimeEvent {
    /// Attendance punch just occurred (EF_ATTLOG)
    AttLog {
        user_pin: String,
        verify_mode: VerifyMode,
        /// Timestamp parsed from the 6-byte real-time format
        timestamp: jiff::Timestamp,
    },
    /// Finger placed on reader — no data payload (EF_FINGER)
    Finger,
    /// User enrolled or enrollment started on device (EF_ENROLLUSER)
    EnrollUser { raw_data: Vec<u8> },
    /// Fingerprint enrollment completed (EF_ENROLLFINGER)
    EnrollFinger {
        /// Whether enrollment succeeded (error_code == 0)
        success: bool,
        /// User PIN the fingerprint was enrolled for
        user_pin: String,
        /// Finger index (0-9)
        finger_index: u8,
        /// Size of the captured template in bytes
        template_size: u16,
    },
    /// Button pressed on device (EF_BUTTON)
    Button,
    /// Door unlocked (EF_UNLOCK)
    Unlock,
    /// User identity verified (EF_VERIFY)
    Verify {
        /// User's internal serial number, or 0xFFFFFFFF if unidentified
        user_sn: u32,
    },
    /// Fingerprint quality score during enrollment (EF_FPFTR)
    FingerScore {
        /// Score: 0 = poor quality, 100 = good quality
        score: u8,
    },
    /// Alarm triggered (EF_ALARM)
    Alarm {
        alarm_type: AlarmType,
        /// User SN for duress/passback alarms
        user_sn: Option<u32>,
        /// Match type for duress alarms
        match_type: Option<u32>,
    },
}

/// Parse a real-time event packet into a typed event.
///
/// The `session_id` field of the packet contains the event code.
/// The `data` field contains the event-specific payload.
pub fn parse_event(session_id: u16, data: &[u8]) -> Option<RealTimeEvent> {
    let code = EventCode::from_session_id(session_id)?;
    Some(parse_event_payload(code, data))
}

/// Parse the payload of a known event type.
fn parse_event_payload(code: EventCode, data: &[u8]) -> RealTimeEvent {
    match code {
        EventCode::AttLog => parse_attlog_event(data),
        EventCode::Finger => RealTimeEvent::Finger,
        EventCode::EnrollUser => RealTimeEvent::EnrollUser { raw_data: data.to_vec() },
        EventCode::EnrollFinger => parse_enroll_finger_event(data),
        EventCode::Button => RealTimeEvent::Button,
        EventCode::Unlock => RealTimeEvent::Unlock,
        EventCode::Verify => parse_verify_event(data),
        EventCode::FingerScore => parse_finger_score_event(data),
        EventCode::Alarm => parse_alarm_event(data),
    }
}

// ─── Individual Event Payload Parsers ────────────────────────────────

/// Parse an EF_ATTLOG real-time attendance event (32 bytes).
///
/// Layout:
/// ```text
/// offset  size  description
/// 0       9     user_id (ASCII, null-padded)
/// 9       15    reserved (zeros)
/// 24      2     verify_type (u16 LE)
/// 26      6     timestamp: YY MM DD HH mm SS (raw byte values)
/// ```
fn parse_attlog_event(data: &[u8]) -> RealTimeEvent {
    if data.len() < 32 {
        let user_pin =
            if data.len() >= 9 { encoding::parse_user_id(&data[0..9]) } else { String::new() };
        return RealTimeEvent::AttLog {
            user_pin,
            verify_mode: VerifyMode::Fingerprint,
            timestamp: jiff::Timestamp::now(),
        };
    }

    let user_pin = encoding::parse_user_id(&data[0..9]);
    let verify_type = u16::from_le_bytes([data[24], data[25]]) as i32;
    let verify_mode = VerifyMode::from(verify_type);
    let ts = parse_realtime_timestamp(&data[26..32]);

    RealTimeEvent::AttLog { user_pin, verify_mode, timestamp: ts }
}

/// Parse the 6-byte real-time timestamp format.
///
/// Each byte is a raw integer value:
/// - byte[0]: year - 2000
/// - byte[1]: month (1-12)
/// - byte[2]: day (1-31)
/// - byte[3]: hour (0-23)
/// - byte[4]: minute (0-59)
/// - byte[5]: second (0-59)
///
/// Returns the timestamp or current time on parse failure.
fn parse_realtime_timestamp(bytes: &[u8]) -> jiff::Timestamp {
    if bytes.len() < 6 {
        return jiff::Timestamp::now();
    }

    let year = 2000 + bytes[0] as i16;
    let month = bytes[1] as i8;
    let day = bytes[2] as i8;
    let hour = bytes[3] as i8;
    let minute = bytes[4] as i8;
    let second = bytes[5] as i8;

    jiff::civil::DateTime::new(year, month, day, hour, minute, second, 0)
        .and_then(|dt| dt.to_zoned(jiff::tz::TimeZone::UTC))
        .map(|z| z.timestamp())
        .unwrap_or_else(|_| jiff::Timestamp::now())
}

/// Parse an EF_ENROLLFINGER event (14 bytes on success, 2 bytes on error).
///
/// Layout:
/// ```text
/// offset  size  description
/// 0       2     error code (u16 LE): 0 = success, non-zero = failure
/// 2       2     fp template size (u16 LE) — only present if success
/// 4       9     user_id (ASCII) — only present if success
/// 13      1     finger index — only present if success
/// ```
fn parse_enroll_finger_event(data: &[u8]) -> RealTimeEvent {
    if data.len() < 2 {
        return RealTimeEvent::EnrollFinger {
            success: false,
            user_pin: String::new(),
            finger_index: 0,
            template_size: 0,
        };
    }

    let error_code = u16::from_le_bytes([data[0], data[1]]);
    let success = error_code == 0;

    if success && data.len() >= 14 {
        let template_size = u16::from_le_bytes([data[2], data[3]]);
        let user_pin = encoding::parse_user_id(&data[4..13]);
        let finger_index = data[13];

        RealTimeEvent::EnrollFinger { success, user_pin, finger_index, template_size }
    } else {
        RealTimeEvent::EnrollFinger {
            success: false,
            user_pin: String::new(),
            finger_index: 0,
            template_size: 0,
        }
    }
}

/// Parse an EF_VERIFY event (5 bytes).
///
/// Layout:
/// ```text
/// offset  size  description
/// 0       4     user_sn (u32 LE): user serial number, 0xFFFFFFFF if unidentified
/// 4       1     fixed: 0x01
/// ```
fn parse_verify_event(data: &[u8]) -> RealTimeEvent {
    let user_sn = if data.len() >= 4 {
        u32::from_le_bytes([data[0], data[1], data[2], data[3]])
    } else {
        0xFFFF_FFFF
    };

    RealTimeEvent::Verify { user_sn }
}

/// Parse an EF_FPFTR finger score event (1 byte).
///
/// The score is 0 (poor quality) or 100 (good quality).
fn parse_finger_score_event(data: &[u8]) -> RealTimeEvent {
    let score = data.first().copied().unwrap_or(0);
    RealTimeEvent::FingerScore { score }
}

/// Parse an EF_ALARM event (4, 8, or 12 bytes depending on alarm type).
///
/// Simple alarm (4 bytes):
/// ```text
/// offset  size  description
/// 0       4     alarm_type (u32 LE): 0x3A=misop, 0x37=tamper, 0x35=exit button
/// ```
///
/// Door closing (8 bytes): first byte is 0x54
///
/// Duress/Passback (12 bytes):
/// ```text
/// offset  size  description
/// 0       4     fixed: 0xFFFFFFFF
/// 4       2     alarm_type (u16 LE): 0x20=duress, 0x22=passback
/// 6       2     user_sn (u16 LE)
/// 8       4     match_type (u32 LE)
/// ```
fn parse_alarm_event(data: &[u8]) -> RealTimeEvent {
    let (alarm_type, user_sn, match_type) = match data.len() {
        len if len >= 12 && data[0] == 0xFF && data[1] == 0xFF => {
            // Duress/Passback format (12 bytes)
            let at = u16::from_le_bytes([data[4], data[5]]);
            let sn = u32::from(u16::from_le_bytes([data[6], data[7]]));
            let mt = u32::from_le_bytes([data[8], data[9], data[10], data[11]]);
            let alarm = match at {
                0x20 => AlarmType::Duress,
                0x22 => AlarmType::Passback,
                other => AlarmType::Unknown(other as u8),
            };
            (alarm, Some(sn), Some(mt))
        },
        len if len >= 8 && data[0] == 0x54 => (AlarmType::DoorClosing, None, None),
        len if len >= 4 => {
            let at = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
            let alarm = match at {
                0x3A => AlarmType::Misoperation,
                0x37 => AlarmType::Tamper,
                0x35 => AlarmType::ExitButton,
                other => AlarmType::Unknown(other as u8),
            };
            (alarm, None, None)
        },
        _ => (AlarmType::Unknown(0), None, None),
    };

    RealTimeEvent::Alarm { alarm_type, user_sn, match_type }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── EventCode Tests ────────────────────────────────────────────

    #[test]
    fn test_event_code_from_session_id_all_known() {
        let cases = [
            (0x01u16, EventCode::AttLog),
            (0x02u16, EventCode::Finger),
            (0x04u16, EventCode::EnrollUser),
            (0x08u16, EventCode::EnrollFinger),
            (0x10u16, EventCode::Button),
            (0x20u16, EventCode::Unlock),
            (0x80u16, EventCode::Verify),
            (0x100u16, EventCode::FingerScore),
            (0x200u16, EventCode::Alarm),
        ];
        for (id, expected) in cases {
            let code = EventCode::from_session_id(id);
            assert_eq!(code, Some(expected), "session_id 0x{id:04X}");
        }
    }

    #[test]
    fn test_event_code_unknown() {
        assert_eq!(EventCode::from_session_id(0x0000), None);
        assert_eq!(EventCode::from_session_id(0xFFFF), None);
        assert_eq!(EventCode::from_session_id(0x03), None);
        assert_eq!(EventCode::from_session_id(0x40), None);
    }

    #[test]
    fn test_is_event_packet() {
        assert!(EventCode::is_event_packet(0));
        assert!(!EventCode::is_event_packet(1));
        assert!(!EventCode::is_event_packet(65534));
    }

    // ─── EF_ATTLOG Event Tests ──────────────────────────────────────

    /// Build a 32-byte EF_ATTLOG event payload from the zk-protocol spec.
    fn make_attlog_event(user_pin: &str, verify_type: u16, ts_bytes: &[u8; 6]) -> Vec<u8> {
        let mut data = vec![0u8; 32];
        let pin_bytes = user_pin.as_bytes();
        let copy_len = pin_bytes.len().min(9);
        data[0..copy_len].copy_from_slice(&pin_bytes[..copy_len]);
        data[24..26].copy_from_slice(&verify_type.to_le_bytes());
        data[26..32].copy_from_slice(ts_bytes);
        data
    }

    #[test]
    fn test_parse_attlog_event_from_spec_example() {
        // From the zk-protocol spec example:
        // User ID = "999111333", verify=fingerprint(1), time=2018/06/25 17:41:05
        // Hex bytes at offset 26-31: 12 06 19 11 29 05
        let data = make_attlog_event("999111333", 1, &[0x12, 0x06, 0x19, 0x11, 0x29, 0x05]);

        let event = parse_event(0x01, &data).expect("should parse ATTLOG event");

        match event {
            RealTimeEvent::AttLog { user_pin, verify_mode, timestamp } => {
                assert_eq!(user_pin, "999111333");
                assert_eq!(verify_mode, VerifyMode::Fingerprint);

                // 2018-06-25 17:41:05 UTC
                let expected = jiff::civil::DateTime::new(2018, 6, 25, 17, 41, 5, 0)
                    .and_then(|dt| dt.to_zoned(jiff::tz::TimeZone::UTC))
                    .map(|z| z.timestamp())
                    .unwrap();
                assert_eq!(timestamp, expected);
            },
            other => panic!("expected AttLog event, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_attlog_event_unknown_user() {
        // Empty user pin
        let data = make_attlog_event("", 0, &[0x17, 0x07, 0x0A, 0x08, 0x30, 0x00]);
        let event = parse_event(0x01, &data).expect("should parse");

        match event {
            RealTimeEvent::AttLog { user_pin, .. } => {
                assert!(user_pin.is_empty());
            },
            other => panic!("expected AttLog, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_attlog_event_truncated() {
        // Only 20 bytes instead of 32
        let event = parse_event(0x01, &[0u8; 20]).expect("should parse truncated");
        match event {
            RealTimeEvent::AttLog { .. } => {}, // graceful fallback
            other => panic!("expected AttLog, got {other:?}"),
        }
    }

    // ─── EF_FINGER Event Test ───────────────────────────────────────

    #[test]
    fn test_parse_finger_event() {
        let event = parse_event(0x02, &[]).expect("should parse FINGER");
        match event {
            RealTimeEvent::Finger => {},
            other => panic!("expected Finger, got {other:?}"),
        }
    }

    // ─── EF_ENROLLFINGER Event Tests ────────────────────────────────

    #[test]
    fn test_parse_enroll_finger_success() {
        // Success: error_code=0, template_size=512, user_pin="145", finger_index=1
        let mut data = vec![0u8; 14];
        data[0..2].copy_from_slice(&0u16.to_le_bytes()); // error_code = 0 = success
        data[2..4].copy_from_slice(&512u16.to_le_bytes()); // template_size
        let pin = b"145";
        data[4..4 + pin.len()].copy_from_slice(pin); // user_pin
        data[13] = 1; // finger_index

        let event = parse_event(0x08, &data).expect("should parse ENROLLFINGER");

        match event {
            RealTimeEvent::EnrollFinger { success, user_pin, finger_index, template_size } => {
                assert!(success);
                assert_eq!(user_pin, "145");
                assert_eq!(finger_index, 1);
                assert_eq!(template_size, 512);
            },
            other => panic!("expected EnrollFinger, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_enroll_finger_failure() {
        // Failure: error_code = 5 (non-zero), only 2 bytes of data
        let mut data = vec![0u8; 2];
        data[0..2].copy_from_slice(&5u16.to_le_bytes());

        let event = parse_event(0x08, &data).expect("should parse failed ENROLLFINGER");

        match event {
            RealTimeEvent::EnrollFinger { success, .. } => {
                assert!(!success);
            },
            other => panic!("expected EnrollFinger, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_enroll_finger_truncated() {
        let event = parse_event(0x08, &[]).expect("should parse empty ENROLLFINGER");
        match event {
            RealTimeEvent::EnrollFinger { success, .. } => {
                assert!(!success);
            },
            other => panic!("expected EnrollFinger, got {other:?}"),
        }
    }

    // ─── EF_VERIFY Event Tests ──────────────────────────────────────

    #[test]
    fn test_parse_verify_identified() {
        let mut data = vec![0u8; 5];
        data[0..4].copy_from_slice(&13u32.to_le_bytes()); // user_sn = 13
        data[4] = 0x01; // fixed byte

        let event = parse_event(0x80, &data).expect("should parse VERIFY");

        match event {
            RealTimeEvent::Verify { user_sn } => {
                assert_eq!(user_sn, 13);
            },
            other => panic!("expected Verify, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_verify_unidentified() {
        let mut data = vec![0u8; 5];
        data[0..4].copy_from_slice(&0xFFFFFFFFu32.to_le_bytes()); // unidentified
        data[4] = 0x01;

        let event = parse_event(0x80, &data).expect("should parse VERIFY unidentified");

        match event {
            RealTimeEvent::Verify { user_sn } => {
                assert_eq!(user_sn, 0xFFFFFFFF);
            },
            other => panic!("expected Verify, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_verify_truncated() {
        let event = parse_event(0x80, &[0u8; 2]).expect("should parse truncated VERIFY");
        match event {
            RealTimeEvent::Verify { user_sn } => {
                assert_eq!(user_sn, 0xFFFFFFFF);
            },
            other => panic!("expected Verify, got {other:?}"),
        }
    }

    // ─── EF_FPFTR (Finger Score) Event Tests ────────────────────────

    #[test]
    fn test_parse_finger_score_good() {
        let event = parse_event(0x100, &[100]).expect("should parse FPFTR");
        match event {
            RealTimeEvent::FingerScore { score } => assert_eq!(score, 100),
            other => panic!("expected FingerScore, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_finger_score_poor() {
        let event = parse_event(0x100, &[0]).expect("should parse poor FPFTR");
        match event {
            RealTimeEvent::FingerScore { score } => assert_eq!(score, 0),
            other => panic!("expected FingerScore, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_finger_score_empty() {
        let event = parse_event(0x100, &[]).expect("should parse empty FPFTR");
        match event {
            RealTimeEvent::FingerScore { score } => assert_eq!(score, 0),
            other => panic!("expected FingerScore, got {other:?}"),
        }
    }

    // ─── EF_ALARM Event Tests ───────────────────────────────────────

    #[test]
    fn test_parse_alarm_misoperation() {
        let mut data = vec![0u8; 4];
        data[0..4].copy_from_slice(&0x3Au32.to_le_bytes());

        let event = parse_event(0x200, &data).expect("should parse ALARM misoperation");

        match event {
            RealTimeEvent::Alarm { alarm_type, user_sn, match_type } => {
                assert_eq!(alarm_type, AlarmType::Misoperation);
                assert!(user_sn.is_none());
                assert!(match_type.is_none());
            },
            other => panic!("expected Alarm, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_alarm_tamper() {
        let mut data = vec![0u8; 4];
        data[0..4].copy_from_slice(&0x37u32.to_le_bytes());

        let event = parse_event(0x200, &data).expect("should parse ALARM tamper");

        match event {
            RealTimeEvent::Alarm { alarm_type, .. } => {
                assert_eq!(alarm_type, AlarmType::Tamper);
            },
            other => panic!("expected Alarm, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_alarm_exit_button() {
        let mut data = vec![0u8; 4];
        data[0..4].copy_from_slice(&0x35u32.to_le_bytes());

        let event = parse_event(0x200, &data).expect("should parse ALARM exit button");

        match event {
            RealTimeEvent::Alarm { alarm_type, .. } => {
                assert_eq!(alarm_type, AlarmType::ExitButton);
            },
            other => panic!("expected Alarm, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_alarm_door_closing() {
        let mut data = vec![0u8; 8];
        data[0] = 0x54;

        let event = parse_event(0x200, &data).expect("should parse ALARM door closing");

        match event {
            RealTimeEvent::Alarm { alarm_type, .. } => {
                assert_eq!(alarm_type, AlarmType::DoorClosing);
            },
            other => panic!("expected Alarm, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_alarm_duress() {
        let mut data = vec![0u8; 12];
        // fixed 0xFFFFFFFF
        data[0..4].copy_from_slice(&0xFFFFFFFFu32.to_le_bytes());
        // alarm_type = 0x20 (duress)
        data[4..6].copy_from_slice(&0x20u16.to_le_bytes());
        // user_sn = 13
        data[6..8].copy_from_slice(&13u16.to_le_bytes());
        // match_type = 1 (fingerprint)
        data[8..12].copy_from_slice(&1u32.to_le_bytes());

        let event = parse_event(0x200, &data).expect("should parse ALARM duress");

        match event {
            RealTimeEvent::Alarm { alarm_type, user_sn, match_type } => {
                assert_eq!(alarm_type, AlarmType::Duress);
                assert_eq!(user_sn, Some(13));
                assert_eq!(match_type, Some(1));
            },
            other => panic!("expected Alarm, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_alarm_passback() {
        let mut data = vec![0u8; 12];
        data[0..4].copy_from_slice(&0xFFFFFFFFu32.to_le_bytes());
        data[4..6].copy_from_slice(&0x22u16.to_le_bytes()); // passback
        data[6..8].copy_from_slice(&7u16.to_le_bytes());
        data[8..12].copy_from_slice(&2u32.to_le_bytes());

        let event = parse_event(0x200, &data).expect("should parse ALARM passback");

        match event {
            RealTimeEvent::Alarm { alarm_type, .. } => {
                assert_eq!(alarm_type, AlarmType::Passback);
            },
            other => panic!("expected Alarm, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_event_unknown_code() {
        assert!(parse_event(0x0000, &[]).is_none());
        assert!(parse_event(0xFFFF, &[]).is_none());
    }
}
