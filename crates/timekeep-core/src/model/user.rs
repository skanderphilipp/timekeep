use serde::{Deserialize, Serialize};

/// A user/enrollee on a biometric device.
///
/// Note: The `pin` is the unique identifier each user has *on the device*.
/// It is NOT the same as an employee ID in an HR system. Mapping between
/// device pins and HR employee IDs is a concern of the integration layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    /// Internal device serial number (assigned by device, not globally unique).
    /// Used for linking attendance records to users at the binary protocol level.
    pub internal_sn: u16,

    /// User PIN / employee number stored on the device.
    /// This is what HR systems use for matching.
    pub pin: String,

    /// Display name (max 24 characters on most ZKTeco devices).
    pub name: String,

    /// Privilege level:
    /// - 0 = Normal user
    /// - 14 = Admin (can access device menu)
    pub privilege: u8,

    /// RF card number, if enrolled.
    /// Populated from the device's binary protocol (u32 LE → decimal string).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card_number: Option<String>,

    /// Device access control group (1–99).
    /// Used by the device for time schedules and door unlock rules.
    /// Maps to organizational department via admin configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<u8>,

    /// Per-user timezone offset (device-specific encoding).
    /// 0 = use device/group default timezone.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<u16>,

    /// Raw password string, if one is set on the device.
    /// Preserved for exact user restoration during device-to-device sync.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_raw: Option<String>,

    /// Whether the user has a password set.
    /// Derived from `password_raw.is_some()` on parse.
    pub has_password: bool,

    /// Number of fingerprint templates enrolled.
    pub fingerprint_count: u8,

    /// Whether the user has a face template enrolled.
    pub has_face: bool,
}

impl User {
    /// Whether this user is a device administrator.
    pub fn is_admin(&self) -> bool {
        self.privilege >= 14
    }

    /// Whether the user has at least one biometric credential enrolled.
    pub fn has_biometric(&self) -> bool {
        self.fingerprint_count > 0 || self.has_face
    }

    /// The card number as a u32, for the binary protocol encoder.
    /// Returns 0 if no card is assigned.
    pub fn card_number_u32(&self) -> u32 {
        self.card_number.as_deref().and_then(|c| c.parse::<u32>().ok()).unwrap_or(0)
    }

    /// The password string for protocol encoding.
    /// Returns the raw password if available, or "*" if password exists
    /// but content is unknown (legacy data). Returns "" if no password.
    pub fn password_for_encode(&self) -> &str {
        match (&self.password_raw, self.has_password) {
            (Some(pwd), _) => pwd.as_str(),
            (None, true) => "*",
            (None, false) => "",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_user(privilege: u8, fingerprint_count: u8, has_face: bool) -> User {
        User {
            internal_sn: 1,
            pin: "145".into(),
            name: "Test User".into(),
            privilege,
            card_number: None,
            group: None,
            timezone: None,
            password_raw: None,
            has_password: false,
            fingerprint_count,
            has_face,
        }
    }

    #[test]
    fn test_is_admin() {
        let admin = make_user(14, 1, false);
        assert!(admin.is_admin(), "privilege >= 14 must be admin");
    }

    #[test]
    fn test_normal_user_not_admin() {
        let user = make_user(0, 1, false);
        assert!(!user.is_admin(), "privilege < 14 must not be admin");
    }

    #[test]
    fn test_has_biometric() {
        let fp_user = make_user(0, 1, false);
        assert!(fp_user.has_biometric(), "user with fingerprint must have biometric");

        let face_user = make_user(0, 0, true);
        assert!(face_user.has_biometric(), "user with face must have biometric");

        let both_user = make_user(0, 2, true);
        assert!(both_user.has_biometric(), "user with both must have biometric");
    }

    #[test]
    fn test_no_biometric() {
        let user = make_user(0, 0, false);
        assert!(!user.has_biometric(), "user with no biometrics must return false");
    }
}
