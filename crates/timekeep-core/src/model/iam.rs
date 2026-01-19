//! Role-based access control domain model.
//!
//! Roles and permissions are compile-time verified — no database table needed
//! for role definitions. This follows the same pattern as Reaktly's guard system
//! where roles are TypeScript enums, not database rows.
//!
//! ## Design
//!
//! ```text
//! Role (enum) → PermissionSet (bitflags) — compile-time mapping
//!   Admin    → ALL 12 permissions
//!   Operator → 6 permissions (punches, devices, device users, device commands)
//!   Viewer   → 2 permissions (read punches, read devices)
//! ```
//!
//! Dashboard users can also carry custom permission sets independent of role,
//! allowing admins to create fine-grained operator accounts.
//!
//! API keys (for integration partners) are stored in the `api_keys` table
//! and carry a subset of permissions, scoped per integration.

use bitflags::bitflags;

/// Predefined user roles with compile-time permission mappings.
///
/// Stored in JWT claims as a string (e.g., `"admin"`, `"operator"`).
/// The `FromStr`/`Display` impls enable round-trip serialization.
///
/// Roles are **presets** — a dashboard user can have a custom `PermissionSet`
/// that doesn't exactly match any single role's defaults.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    /// Full system access. All 12 permissions.
    Admin,
    /// Operational access. 6 permissions: punches, devices, device users/commands.
    Operator,
    /// Read-only access. 2 permissions: read punches, read devices.
    Viewer,
}

impl Role {
    /// Human-readable role name for JWT claims and logging.
    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Admin => "admin",
            Role::Operator => "operator",
            Role::Viewer => "viewer",
        }
    }

    /// Parse from a string (case-insensitive).
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "admin" => Some(Role::Admin),
            "operator" => Some(Role::Operator),
            "viewer" => Some(Role::Viewer),
            _ => None,
        }
    }

    /// The set of permissions granted to this role.
    pub fn permissions(&self) -> PermissionSet {
        match self {
            Role::Admin => PermissionSet::all(),
            Role::Operator => {
                PermissionSet::READ_PUNCHES
                    | PermissionSet::WRITE_PUNCHES
                    | PermissionSet::READ_DEVICES
                    | PermissionSet::MANAGE_DEVICE_USERS
                    | PermissionSet::MANAGE_DEVICE_COMMANDS
                    | PermissionSet::EXPORT_DATA
            },
            Role::Viewer => PermissionSet::READ_PUNCHES | PermissionSet::READ_DEVICES,
        }
    }

    /// Returns `true` if this role has at least the given role's privileges.
    /// Admin ≥ Operator ≥ Viewer.
    pub fn is_at_least(&self, minimum: Role) -> bool {
        matches!(
            (self, minimum),
            (Role::Admin, _)
                | (Role::Operator, Role::Operator | Role::Viewer)
                | (Role::Viewer, Role::Viewer)
        )
    }
}

impl std::fmt::Display for Role {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

// ─── Permissions (bitflags) ──────────────────────────────────────────
// The bitflags constants are Rust's internal representation.
// String ↔ bit mappings are derived from `shared/permissions.json`
// below in the `impl PermissionSet` block — that JSON is the single
// source of truth shared with the dashboard frontend.

bitflags! {
    /// Fine-grained permissions for API access control.
    ///
    /// Used in:
    /// - JWT claims (role → permissions mapping)
    /// - API key scoping (integration partners get subset of permissions)
    /// - Dashboard user permissions (custom per-user)
    ///
    /// Serialized as a space-separated string in JWT claims and
    /// as a JSON array in API key records.
    ///
    /// ## Permission taxonomy
    ///
    /// | Scope | Permission | Controls |
    /// |-------|-----------|----------|
    /// | Punches | `read:punches` | View attendance records, dashboard |
    /// | Punches | `write:punches` | Create or correct punch records |
    /// | Devices | `read:devices` | View device config and status |
    /// | Devices | `write:devices` | Add/update/remove devices |
    /// | Devices | `manage:device_users` | Enroll/delete users on scanners |
    /// | Devices | `manage:device_commands` | Reboot, clear, disable scanners |
    /// | Admin | `manage:dashboard_users` | CRUD dashboard operators |
    /// | Admin | `manage:api_keys` | Create/revoke integration API keys |
    /// | Admin | `manage:endpoints` | Create/edit/delete integration endpoints |
    /// | Admin | `manage:settings` | Modify system-wide settings |
    /// | Data | `export:data` | Download CSV/XLSX punch exports |
    /// | Data | `view:audit` | Read audit log entries |
    ///
    /// **Bit positions** are fixed and correspond to the 0-indexed order
    /// of entries in `shared/permissions.json`. Do NOT reorder entries
    /// in that file after production deployment — append only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    pub struct PermissionSet: u16 {
        // ── Punches ──
        /// View attendance punch records and dashboard summaries.
        const READ_PUNCHES   = 1 << 0;
        /// Create or correct punch records (manual override).
        const WRITE_PUNCHES  = 1 << 1;

        // ── Devices ──
        /// View device configuration and status.
        const READ_DEVICES   = 1 << 2;
        /// Add, update, or remove devices from the registry.
        const WRITE_DEVICES  = 1 << 3;
        /// Enroll or delete users on biometric devices.
        const MANAGE_DEVICE_USERS   = 1 << 4;
        /// Enqueue commands on devices (reboot, clear attendance, etc.).
        const MANAGE_DEVICE_COMMANDS = 1 << 5;

        // ── Dashboard Administration ──
        /// Create, update, or delete dashboard users (operators who log in).
        const MANAGE_DASHBOARD_USERS = 1 << 6;
        /// Create or revoke API keys for integration partners.
        const MANAGE_API_KEYS        = 1 << 7;
        /// Create, update, or delete integration endpoints.
        const MANAGE_ENDPOINTS       = 1 << 8;
        /// Modify system-wide settings (poll interval, auto-discover).
        const MANAGE_SETTINGS        = 1 << 9;

        // ── Data ──
        /// Download punch data as CSV or XLSX.
        const EXPORT_DATA            = 1 << 10;
        /// View the audit log.
        const VIEW_AUDIT             = 1 << 11;
    }
}

// ─── Static permission catalog derived from shared/permissions.json ──────

/// A single permission definition, deserialized from the shared JSON canon.
#[derive(serde::Deserialize)]
struct PermissionDef {
    value: String,
    label: String,
    description: String,
    #[serde(default)]
    #[allow(dead_code)]
    scope: String,
}

/// Parsed permission catalog. Leaked to provide `&'static` references.
/// Entry order matches bit positions: index 0 = bit 0, index 1 = bit 1, etc.
/// **Do NOT reorder entries in `shared/permissions.json`** — append only.
static PERMISSION_DEFS: std::sync::LazyLock<&'static [PermissionDef]> =
    std::sync::LazyLock::new(|| {
        let json = include_str!("../../../../generated/permissions.json");
        let defs: Vec<PermissionDef> =
            serde_json::from_str(json).expect("Failed to parse shared/permissions.json");
        Box::leak(defs.into_boxed_slice())
    });

/// Maps permission value string → bitflag (built once on first access).
static PERMISSION_VALUE_MAP: std::sync::LazyLock<
    std::collections::HashMap<&'static str, PermissionSet>,
> = std::sync::LazyLock::new(|| {
    PERMISSION_DEFS
        .iter()
        .enumerate()
        .map(|(i, def)| (def.value.as_str(), PermissionSet::from_bits_truncate(1 << (i as u16))))
        .collect()
});

/// Pre-built static slice of permission names (for `all_names()`).
static PERMISSION_NAMES: std::sync::LazyLock<&'static [&'static str]> =
    std::sync::LazyLock::new(|| {
        let names: Vec<&str> = PERMISSION_DEFS.iter().map(|d| d.value.as_str()).collect();
        Box::leak(names.into_boxed_slice())
    });

/// Pre-built static slice of (value, label, description) tuples (for `catalog()`).
static PERMISSION_CATALOG: std::sync::LazyLock<
    &'static [(&'static str, &'static str, &'static str)],
> = std::sync::LazyLock::new(|| {
    let catalog: Vec<(&str, &str, &str)> = PERMISSION_DEFS
        .iter()
        .map(|d| (d.value.as_str(), d.label.as_str(), d.description.as_str()))
        .collect();
    Box::leak(catalog.into_boxed_slice())
});

impl PermissionSet {
    /// Parse from a space-separated string (used in JWT claims).
    ///
    /// Unknown tokens are silently ignored (forward-compatible with
    /// permissions added to the JSON that older binaries don't know about).
    pub fn from_space_separated(s: &str) -> Self {
        let mut set = PermissionSet::empty();
        for token in s.split_whitespace() {
            if let Some(perm) = PERMISSION_VALUE_MAP.get(token) {
                set |= *perm;
            }
        }
        set
    }

    /// Serialize to a space-separated string (for JWT claims).
    ///
    /// Always emits canonical names from `shared/permissions.json`.
    pub fn to_space_separated(&self) -> String {
        let mut parts: Vec<&str> = Vec::with_capacity(PERMISSION_DEFS.len());
        for (i, def) in PERMISSION_DEFS.iter().enumerate() {
            let bit = PermissionSet::from_bits_truncate(1 << (i as u16));
            if self.contains(bit) {
                parts.push(&def.value);
            }
        }
        parts.join(" ")
    }

    /// Parse from a JSON array of permission strings (for API key storage).
    pub fn from_json_array(json: &str) -> Result<Self, serde_json::Error> {
        let strings: Vec<String> = serde_json::from_str(json)?;
        let joined = strings.join(" ");
        Ok(Self::from_space_separated(&joined))
    }

    /// Serialize to a JSON array of permission strings.
    pub fn to_json_array(&self) -> String {
        let s = self.to_space_separated();
        let parts: Vec<&str> = s.split_whitespace().collect();
        serde_json::to_string(&parts).unwrap_or_else(|_| "[]".to_string())
    }

    /// Returns all permission names as a static array (for OpenAPI docs).
    ///
    /// Derived from `shared/permissions.json`.
    pub fn all_names() -> &'static [&'static str] {
        *PERMISSION_NAMES
    }

    /// Returns all permissions with labels and descriptions (for UI rendering).
    ///
    /// Derived from `shared/permissions.json` — the single source of truth
    /// shared with `dashboard/src/lib/permissions.ts`.
    pub fn catalog() -> &'static [(&'static str, &'static str, &'static str)] {
        *PERMISSION_CATALOG
    }
}

// ─── API Key entity ──────────────────────────────────────────────────

/// An API key for integration partners (Odoo, Zapier, SAP, etc.).
///
/// Stored in the `api_keys` database table. Each key carries a scoped
/// set of permissions — an Odoo integration key might only have
/// `read:punches | write:punches`, while a read-only Zapier key
/// might only have `read:punches`.
#[derive(Debug, Clone)]
pub struct ApiKey {
    /// Unique identifier (UUID v7).
    pub id: String,
    /// Human-readable name (e.g., "Odoo Production Integration").
    pub name: String,
    /// SHA-256 hash of the actual API key (prefix stored for display).
    pub key_hash: String,
    /// First 12 characters of the key for display (e.g., "ak_prod_a1b2c3d4").
    pub prefix: String,
    /// Scoped permissions for this key.
    pub permissions: PermissionSet,
    /// Who created this key.
    pub created_by: String,
    /// When this key was created.
    pub created_at: jiff::Timestamp,
    /// Last time this key was used (updated on each authenticated request).
    pub last_used_at: Option<jiff::Timestamp>,
    /// When this key expires (None = never).
    pub expires_at: Option<jiff::Timestamp>,
    /// Whether this key has been revoked.
    pub revoked: bool,
}

impl ApiKey {
    /// Generate a new API key string (prefix + random suffix).
    /// Format: `ak_{env}_{random}` where `env` is "prod" or "dev".
    pub fn generate_key_string(env: &str) -> String {
        let random_part = uuid::Uuid::new_v4().to_string().replace('-', "");
        format!("ak_{env}_{random_part}")
    }

    /// Extract the display prefix from a key string (first 16 chars).
    pub fn prefix_from_key(key: &str) -> String {
        key.chars().take(16).collect()
    }

    /// Hash a key string for secure storage.
    pub fn hash_key(key: &str) -> String {
        use sha2::Digest;
        let mut hasher = sha2::Sha256::new();
        hasher.update(key.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Returns `true` if this key has all the required permissions.
    pub fn has_permission(&self, required: PermissionSet) -> bool {
        self.permissions.contains(required)
    }

    /// Returns `true` if the key is active (not revoked, not expired).
    pub fn is_active(&self) -> bool {
        if self.revoked {
            return false;
        }
        if let Some(expires) = self.expires_at {
            let now = jiff::Timestamp::now();
            if now > expires {
                return false;
            }
        }
        true
    }
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_permissions() {
        assert_eq!(Role::Admin.permissions(), PermissionSet::all());
        assert!(Role::Operator.permissions().contains(PermissionSet::READ_PUNCHES));
        assert!(!Role::Viewer.permissions().contains(PermissionSet::WRITE_PUNCHES));
    }

    #[test]
    fn test_role_hierarchy() {
        assert!(Role::Admin.is_at_least(Role::Operator));
        assert!(Role::Admin.is_at_least(Role::Viewer));
        assert!(Role::Operator.is_at_least(Role::Viewer));
        assert!(!Role::Viewer.is_at_least(Role::Operator));
        assert!(!Role::Operator.is_at_least(Role::Admin));
    }

    #[test]
    fn test_role_display_roundtrip() {
        for role in [Role::Admin, Role::Operator, Role::Viewer] {
            let s = role.to_string();
            let parsed = Role::from_str(&s).unwrap();
            assert_eq!(role, parsed);
        }
    }

    #[test]
    fn test_permission_set_roundtrip_new_names() {
        let perms = PermissionSet::READ_PUNCHES | PermissionSet::MANAGE_DEVICE_USERS;
        let s = perms.to_space_separated();
        let parsed = PermissionSet::from_space_separated(&s);
        assert_eq!(perms, parsed);
        // Verify new name is used on output
        assert!(s.contains("manage:device_users"));
        assert!(!s.contains("manage:users"));
    }

    #[test]
    fn test_permission_json_roundtrip() {
        let perms = PermissionSet::READ_PUNCHES | PermissionSet::MANAGE_DASHBOARD_USERS;
        let json = perms.to_json_array();
        let parsed = PermissionSet::from_json_array(&json).unwrap();
        assert_eq!(perms, parsed);
    }

    #[test]
    fn test_all_names_count() {
        assert_eq!(PermissionSet::all_names().len(), 12);
    }

    #[test]
    fn test_catalog_count() {
        assert_eq!(PermissionSet::catalog().len(), 12);
    }

    #[test]
    fn test_all_admin_permissions() {
        let admin_perms = Role::Admin.permissions();
        let all = PermissionSet::all();
        assert_eq!(admin_perms, all);
    }

    #[test]
    fn test_api_key_hashing() {
        let key = "ak_prod_a1b2c3d4e5f6g7h8";
        let hash = ApiKey::hash_key(key);
        assert_eq!(hash.len(), 64); // SHA-256 hex
        assert_ne!(hash, key);
        assert_eq!(ApiKey::hash_key(key), hash); // deterministic
    }

    #[test]
    fn test_api_key_active() {
        let key = ApiKey {
            id: "test".into(),
            name: "test".into(),
            key_hash: "hash".into(),
            prefix: "ak_test_1234".into(),
            permissions: PermissionSet::READ_PUNCHES,
            created_by: "admin".into(),
            created_at: jiff::Timestamp::now(),
            last_used_at: None,
            expires_at: None,
            revoked: false,
        };
        assert!(key.is_active());

        let mut revoked = key.clone();
        revoked.revoked = true;
        assert!(!revoked.is_active());
    }
}
