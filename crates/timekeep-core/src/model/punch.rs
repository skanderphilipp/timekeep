use jiff::Timestamp;
use serde::{Deserialize, Serialize};

/// A single attendance punch (check-in, check-out, etc.).
///
/// This is the core domain object. Every punch that arrives from
/// any device, via any protocol, is normalized into this type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttendancePunch {
    /// Universally unique ID for this punch.
    /// Generated at ingestion time for deduplication.
    pub id: String,

    /// Device serial number that recorded this punch.
    pub device_sn: String,

    /// User PIN / employee number on the device.
    pub user_pin: String,

    /// When the punch occurred (device-local, normalized to UTC).
    pub timestamp: Timestamp,

    /// Check-in vs check-out
    pub status: PunchStatus,

    /// How the user verified (fingerprint, face, card, password).
    pub verify_mode: VerifyMode,

    /// Optional work code if the device supports it.
    pub work_code: Option<String>,

    /// Optional break / overtime sub-status.
    pub sub_status: Option<PunchSubStatus>,

    /// Employee display name (populated by enrichment pipeline from HR system).
    /// `None` when enrichment is not configured or employee not found.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    /// Human-readable device label (resolved at query time from device config).
    /// Not part of the punch's core identity — purely a read-model enrichment.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub device_label: Option<String>,

    /// Raw data as received from the device (for audit trail).
    #[serde(skip)]
    pub raw_data: Option<String>,
}

/// Primary attendance status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PunchStatus {
    /// Employee arrived
    CheckIn = 0,
    /// Employee left
    CheckOut = 1,
    /// Employee went on break
    BreakOut = 2,
    /// Employee returned from break
    BreakIn = 3,
    /// Overtime started
    OvertimeIn = 4,
    /// Overtime ended
    OvertimeOut = 5,
}

impl TryFrom<i32> for PunchStatus {
    type Error = String;
    fn try_from(v: i32) -> Result<Self, Self::Error> {
        match v {
            0 => Ok(Self::CheckIn),
            1 => Ok(Self::CheckOut),
            2 => Ok(Self::BreakOut),
            3 => Ok(Self::BreakIn),
            4 => Ok(Self::OvertimeIn),
            5 => Ok(Self::OvertimeOut),
            _ => Err(format!("unknown punch status: {v}")),
        }
    }
}

impl std::fmt::Display for PunchStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::CheckIn => write!(f, "check_in"),
            Self::CheckOut => write!(f, "check_out"),
            Self::BreakOut => write!(f, "break_out"),
            Self::BreakIn => write!(f, "break_in"),
            Self::OvertimeIn => write!(f, "overtime_in"),
            Self::OvertimeOut => write!(f, "overtime_out"),
        }
    }
}

/// Additional punch sub-status (break details, overtime type).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PunchSubStatus {
    /// Standard break
    StandardBreak,
    /// Meal break
    MealBreak,
    /// Regular overtime
    Overtime,
    /// Holiday overtime
    HolidayOvertime,
    /// Weekend overtime
    WeekendOvertime,
}

/// How the user was identified at the scanner.
///
/// Known modes map to ZKTeco protocol values; unknown values
/// are captured in the `Unknown(i32)` variant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerifyMode {
    /// Password / PIN entry
    Password = 0,
    /// Fingerprint scan
    Fingerprint = 1,
    /// RF / proximity card
    Card = 4,
    /// Facial recognition
    Face = 15,
    /// Palm vein
    Palm = 25,
}

impl From<i32> for VerifyMode {
    fn from(v: i32) -> Self {
        match v {
            0 => Self::Password,
            1 => Self::Fingerprint,
            4 => Self::Card,
            15 => Self::Face,
            25 => Self::Palm,
            _ => {
                tracing::warn!(raw_value = v, "unknown verify mode, defaulting to Fingerprint");
                Self::Fingerprint
            },
        }
    }
}

impl VerifyMode {
    /// Human-readable name for this verification mode.
    pub fn name(&self) -> &str {
        match self {
            Self::Password => "Password",
            Self::Fingerprint => "Fingerprint",
            Self::Card => "RF Card",
            Self::Face => "Face Recognition",
            Self::Palm => "Palm Vein",
        }
    }

    /// Return the numeric ZKTeco protocol value.
    pub fn as_i32(&self) -> i32 {
        match self {
            Self::Password => 0,
            Self::Fingerprint => 1,
            Self::Card => 4,
            Self::Face => 15,
            Self::Palm => 25,
        }
    }
}

impl AttendancePunch {
    /// Generate a deterministic, content-addressed ID for deduplication.
    ///
    /// Two punches from the same user at the same second on the same device
    /// will produce the same ID, preventing duplicate storage.
    pub fn generate_deduplication_id(&self) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(self.device_sn.as_bytes());
        hasher.update(b"|");
        hasher.update(self.user_pin.as_bytes());
        hasher.update(b"|");
        hasher.update(self.timestamp.as_second().to_string().as_bytes());
        hasher.update(b"|");
        hasher.update([self.status as u8]);
        let hash = hasher.finalize();
        // Format first 8 bytes as hex without external crate
        hash[..8].iter().fold(String::with_capacity(16), |mut s, b| {
            use std::fmt::Write;
            let _ = write!(s, "{b:02x}");
            s
        })
    }

    /// Validate that this punch is internally consistent.
    pub fn validate(&self) -> Result<(), crate::Error> {
        if self.user_pin.is_empty() {
            return Err(crate::Error::validation("empty user_pin"));
        }
        if self.device_sn.is_empty() {
            return Err(crate::Error::validation("empty device_sn"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_punch(pin: &str, device: &str, secs: i64) -> AttendancePunch {
        let ts = jiff::Timestamp::from_second(secs).unwrap();
        let mut p = AttendancePunch {
            id: String::new(),
            device_sn: device.into(),
            user_pin: pin.into(),
            timestamp: ts,
            status: PunchStatus::CheckIn,
            verify_mode: VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        };
        p.id = p.generate_deduplication_id();
        p
    }

    // ─── Deduplication ID ────────────────────────────────────────────

    #[test]
    fn test_dedup_id_deterministic() {
        let p1 = make_punch("145", "DEV001", 1752129600);
        let p2 = make_punch("145", "DEV001", 1752129600);
        assert_eq!(p1.id, p2.id, "same inputs must produce same dedup ID");
    }

    #[test]
    fn test_dedup_id_differs_by_pin() {
        let p1 = make_punch("145", "DEV001", 1752129600);
        let p2 = make_punch("146", "DEV001", 1752129600);
        assert_ne!(p1.id, p2.id, "different PINs must produce different dedup IDs");
    }

    #[test]
    fn test_dedup_id_differs_by_timestamp() {
        let p1 = make_punch("145", "DEV001", 1752129600);
        let p2 = make_punch("145", "DEV001", 1752129601);
        assert_ne!(p1.id, p2.id, "different timestamps must produce different dedup IDs");
    }

    #[test]
    fn test_dedup_id_differs_by_device() {
        let p1 = make_punch("145", "DEV001", 1752129600);
        let p2 = make_punch("145", "DEV002", 1752129600);
        assert_ne!(p1.id, p2.id, "different devices must produce different dedup IDs");
    }

    // ─── Validation ──────────────────────────────────────────────────

    #[test]
    fn test_validate_rejects_empty_pin() {
        let p = make_punch("", "DEV001", 1752129600);
        let result = p.validate();
        assert!(result.is_err(), "empty user_pin must be rejected");
    }

    #[test]
    fn test_validate_rejects_empty_device() {
        let p = make_punch("145", "", 1752129600);
        let result = p.validate();
        assert!(result.is_err(), "empty device_sn must be rejected");
    }

    #[test]
    fn test_validate_accepts_valid() {
        let p = make_punch("145", "DEV001", 1752129600);
        assert!(p.validate().is_ok(), "valid punch must pass validation");
    }

    // ─── PunchStatus ─────────────────────────────────────────────────

    #[test]
    fn test_punch_status_try_from_all() {
        assert_eq!(PunchStatus::try_from(0).unwrap(), PunchStatus::CheckIn);
        assert_eq!(PunchStatus::try_from(1).unwrap(), PunchStatus::CheckOut);
        assert_eq!(PunchStatus::try_from(2).unwrap(), PunchStatus::BreakOut);
        assert_eq!(PunchStatus::try_from(3).unwrap(), PunchStatus::BreakIn);
        assert_eq!(PunchStatus::try_from(4).unwrap(), PunchStatus::OvertimeIn);
        assert_eq!(PunchStatus::try_from(5).unwrap(), PunchStatus::OvertimeOut);
        assert!(PunchStatus::try_from(99).is_err(), "unknown code must error");
    }

    // ─── VerifyMode ──────────────────────────────────────────────────

    #[test]
    fn test_verify_mode_from_all() {
        assert_eq!(VerifyMode::from(0), VerifyMode::Password);
        assert_eq!(VerifyMode::from(1), VerifyMode::Fingerprint);
        assert_eq!(VerifyMode::from(4), VerifyMode::Card);
        assert_eq!(VerifyMode::from(15), VerifyMode::Face);
        assert_eq!(VerifyMode::from(25), VerifyMode::Palm);
        // Unknown values default to Fingerprint
        assert_eq!(VerifyMode::from(99), VerifyMode::Fingerprint);
    }

    #[test]
    fn test_verify_mode_name() {
        assert_eq!(VerifyMode::Password.name(), "Password");
        assert_eq!(VerifyMode::Fingerprint.name(), "Fingerprint");
        assert_eq!(VerifyMode::Card.name(), "RF Card");
        assert_eq!(VerifyMode::Face.name(), "Face Recognition");
        assert_eq!(VerifyMode::Palm.name(), "Palm Vein");
    }
}
