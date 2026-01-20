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

    /// RF card number, if enrolled
    pub card_number: Option<String>,

    /// Whether the user has a password set
    pub has_password: bool,

    /// Number of fingerprint templates enrolled
    pub fingerprint_count: u8,

    /// Whether the user has a face template enrolled
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
