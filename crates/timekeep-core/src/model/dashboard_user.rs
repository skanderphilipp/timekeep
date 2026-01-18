/// A dashboard user (operator who logs into the management dashboard).
///
/// Each user has:
/// - A role (preset label: admin, operator, viewer) for quick categorization
/// - A custom `PermissionSet` — the actual source of truth for access control
///
/// When permissions are empty, the role's default permissions are used at login time.
/// When custom permissions are set, they override the role defaults entirely.
#[derive(Debug, Clone)]
pub struct DashboardUser {
    /// Unique identifier (UUID v7).
    pub id: String,
    /// Unique login username.
    pub username: String,
    /// SHA-256(salt + ":" + password). TODO(ENTERPRISE): Upgrade to argon2id.
    pub password_hash: String,
    /// Random salt per user.
    pub salt: String,
    /// Preset role label (for quick categorization in the UI).
    pub role: crate::model::iam::Role,
    /// Custom permission set. If empty, the role's defaults are used.
    /// When explicitly set, this overrides role-derived permissions.
    pub permissions: crate::model::iam::PermissionSet,
    /// Human-readable display name.
    pub display_name: String,
    /// Whether this account can log in.
    pub active: bool,
    /// Unix timestamp of creation (seconds).
    pub created_at: i64,
    /// Unix timestamp of last modification (seconds).
    pub updated_at: i64,
}

impl DashboardUser {
    /// Hash a password with a given salt using SHA-256.
    /// Format: hex(SHA256(salt + ":" + password))
    ///
    /// TODO(ENTERPRISE): Replace with argon2id before production deployment.
    /// Phase: Production hardening
    /// Impact: SHA-256 is fast to brute-force. Argon2id is memory-hard.
    /// Fix: Replace with argon2 crate (Argon2::default()), use SaltString.
    pub fn hash_password(password: &str, salt: &str) -> String {
        use sha2::Digest;
        let mut hasher = sha2::Sha256::new();
        hasher.update(salt.as_bytes());
        hasher.update(b":");
        hasher.update(password.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Generate a random salt (16 hex chars).
    pub fn generate_salt() -> String {
        uuid::Uuid::new_v4().to_string().replace('-', "")[..16].to_string()
    }

    /// Verify a password against the stored hash.
    pub fn verify_password(&self, password: &str) -> bool {
        Self::hash_password(password, &self.salt) == self.password_hash
    }

    /// Returns the effective permissions for this user.
    ///
    /// If custom permissions were explicitly assigned (non-empty and not equal
    /// to the role defaults), use those. Otherwise, use the role's defaults.
    pub fn effective_permissions(&self) -> crate::model::iam::PermissionSet {
        let role_defaults = self.role.permissions();
        if self.permissions.is_empty() || self.permissions == role_defaults {
            role_defaults
        } else {
            self.permissions
        }
    }

    /// Returns true if this user's permissions were explicitly customized
    /// (i.e., not just derived from the role).
    pub fn has_custom_permissions(&self) -> bool {
        !self.permissions.is_empty() && self.permissions != self.role.permissions()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::iam::{PermissionSet, Role};

    fn make_user(role: Role, permissions: PermissionSet) -> DashboardUser {
        DashboardUser {
            id: "test-id".into(),
            username: "test".into(),
            password_hash: "hash".into(),
            salt: "salt".into(),
            role,
            permissions,
            display_name: "Test User".into(),
            active: true,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn test_effective_permissions_uses_role_when_empty() {
        let user = make_user(Role::Operator, PermissionSet::empty());
        assert_eq!(user.effective_permissions(), Role::Operator.permissions());
    }

    #[test]
    fn test_effective_permissions_uses_custom_when_set() {
        let custom = PermissionSet::READ_PUNCHES | PermissionSet::VIEW_AUDIT;
        let user = make_user(Role::Viewer, custom);
        assert_eq!(user.effective_permissions(), custom);
        assert!(user.has_custom_permissions());
    }

    #[test]
    fn test_has_custom_permissions_false_for_role_defaults() {
        let user = make_user(Role::Admin, Role::Admin.permissions());
        assert!(!user.has_custom_permissions());
    }

    #[test]
    fn test_hash_password_deterministic() {
        let hash1 = DashboardUser::hash_password("secret", "abc123");
        let hash2 = DashboardUser::hash_password("secret", "abc123");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_verify_password() {
        let salt = DashboardUser::generate_salt();
        let hash = DashboardUser::hash_password("mypassword", &salt);
        let user = DashboardUser {
            id: "u1".into(),
            username: "u1".into(),
            password_hash: hash,
            salt,
            role: Role::Viewer,
            permissions: PermissionSet::empty(),
            display_name: "U1".into(),
            active: true,
            created_at: 0,
            updated_at: 0,
        };
        assert!(user.verify_password("mypassword"));
        assert!(!user.verify_password("wrong"));
    }
}
