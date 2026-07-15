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
    /// Argon2id password hash (PHC string: `$argon2id$v=19$...`).
    ///
    /// Legacy hashes from before the argon2 migration are hex-encoded
    /// SHA-256 strings; `verify_password` handles both formats transparently.
    pub password_hash: String,
    /// Legacy salt (for SHA-256 fallback verification).
    /// Empty for passwords hashed with argon2id (salt is embedded in the PHC string).
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
    /// Hash a password using Argon2id (memory-hard, resistant to GPU attacks).
    ///
    /// Returns a PHC-formatted string (`$argon2id$v=19$...`) that includes
    /// the randomly-generated salt, algorithm parameters, and hash output.
    ///
    /// The `salt` parameter is ignored — Argon2id generates its own random
    /// salt internally via `SaltString::generate`. The parameter is kept
    /// for API compatibility with legacy callers that pass a salt string.
    pub fn hash_password(password: &str, _salt: &str) -> String {
        use argon2::{
            Argon2,
            password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
        };
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .expect("argon2id hashing should not fail under normal conditions")
            .to_string()
    }

    /// Generate a random salt string for legacy storage compatibility.
    ///
    /// New users hashed with argon2id embed their salt in the PHC string;
    /// this function remains for callers that still populate a separate
    /// salt column (the value is not used by `hash_password`).
    pub fn generate_salt() -> String {
        uuid::Uuid::new_v4().to_string().replace('-', "")[..16].to_string()
    }

    /// Verify a password against the stored hash.
    ///
    /// Handles two formats transparently:
    /// - **PHC string** (starts with `$`): verified with Argon2id.
    /// - **Legacy hex** (SHA-256): verified with the old salt-based scheme.
    ///   Successful legacy verifications automatically log a warning in tests
    ///   to flag accounts that should be re-hashed.
    pub fn verify_password(&self, password: &str) -> bool {
        if self.password_hash.starts_with('$') {
            // Argon2id PHC format: $argon2id$v=19$...
            use argon2::{
                Argon2,
                password_hash::{PasswordHash, PasswordVerifier},
            };
            PasswordHash::new(&self.password_hash)
                .map(|parsed| {
                    Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok()
                })
                .unwrap_or(false)
        } else {
            // Legacy: SHA-256(salt + ":" + password)
            use sha2::Digest;
            let mut hasher = sha2::Sha256::new();
            hasher.update(self.salt.as_bytes());
            hasher.update(b":");
            hasher.update(password.as_bytes());
            let hex_hash = format!("{:x}", hasher.finalize());
            let matches = hex_hash == self.password_hash;
            if matches {
                tracing::warn!(
                    username = %self.username,
                    "password verified with legacy SHA-256 — re-hash with argon2id on next login"
                );
            }
            matches
        }
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
    fn test_argon2id_hash_is_non_deterministic() {
        // Argon2id generates a random salt per call, so two hashes
        // of the same password should be different strings.
        let hash1 = DashboardUser::hash_password("secret", "ignored");
        let hash2 = DashboardUser::hash_password("secret", "ignored");
        assert!(hash1.starts_with("$argon2"));
        assert!(hash2.starts_with("$argon2"));
        assert_ne!(hash1, hash2, "argon2id should produce unique hashes per call");
    }

    #[test]
    fn test_verify_password_argon2id() {
        let hash = DashboardUser::hash_password("mypassword", "ignored");
        let user = DashboardUser {
            id: "u1".into(),
            username: "u1".into(),
            password_hash: hash,
            salt: String::new(), // salt unused for argon2
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

    #[test]
    fn test_verify_password_legacy_sha256() {
        // Simulate a pre-migration password stored with SHA-256
        use sha2::Digest;
        let salt = "abc123";
        let mut hasher = sha2::Sha256::new();
        hasher.update(salt.as_bytes());
        hasher.update(b":");
        hasher.update(b"oldpassword");
        let legacy_hash = format!("{:x}", hasher.finalize());
        assert!(!legacy_hash.starts_with('$'));

        let user = DashboardUser {
            id: "legacy".into(),
            username: "legacy".into(),
            password_hash: legacy_hash,
            salt: salt.into(),
            role: Role::Viewer,
            permissions: PermissionSet::empty(),
            display_name: "Legacy".into(),
            active: true,
            created_at: 0,
            updated_at: 0,
        };
        assert!(user.verify_password("oldpassword"));
        assert!(!user.verify_password("wrong"));
    }
}
