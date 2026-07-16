//! Device group — organizational grouping of biometric devices.
//!
//! Device groups enable department-scoped sync operations. A group like
//! "onboarding" or "staff" contains devices that should receive the same
//! set of employees. When syncing, the group determines which employees
//! (filtered by department) get pushed to which devices.
//!
//! This is an organizational concept in our domain — distinct from:
//! - ZKTeco's user-level `group` (access control schedule, 1-99)
//! - ZKTeco's device-level `~Branch` option (free-text org identifier)
//!
//! # Invariants
//!
//! - `name` is unique across the organization.
//! - A device belongs to at most one group (`group_id` on `DeviceConfig`).

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Strongly-typed device group identifier (UUID v7).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DeviceGroupId(pub String);

impl DeviceGroupId {
    /// Generate a new unique device group ID.
    pub fn new() -> Self {
        Self(Uuid::now_v7().to_string())
    }
}

impl Default for DeviceGroupId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for DeviceGroupId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A named group of biometric devices.
///
/// Each group can be configured with one or more departments.
/// When syncing, only employees from those departments are pushed
/// to the devices in this group. This enables department-scoped
/// access control at the device level.
///
/// # Example
///
/// ```text
/// DeviceGroup { name: "office", department_ids: ["hr", "mgmt"], ... }
///   → Office devices only get HR + Management employees
/// DeviceGroup { name: "staff", department_ids: ["staff"], ... }
///   → Staff floor devices only get Staff employees
/// DeviceGroup { name: "onboarding", department_ids: [], ... }
///   → Enrollment device gets all employees (empty = all departments)
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceGroup {
    /// Universally unique identifier (UUID v7).
    pub id: DeviceGroupId,

    /// Unique group name (e.g. "office", "staff", "onboarding").
    pub name: String,

    /// Optional human-readable description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Department IDs that this group should sync.
    /// Empty vec means "all departments" (syncs every employee).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub department_ids: Vec<String>,

    /// When this group was created.
    pub created_at: jiff::Timestamp,

    /// When this group was last modified.
    pub updated_at: jiff::Timestamp,
}

impl DeviceGroup {
    /// Create a new device group.
    pub fn new(name: impl Into<String>, description: Option<String>) -> Self {
        let now = jiff::Timestamp::now();
        Self {
            id: DeviceGroupId::new(),
            name: name.into(),
            description,
            department_ids: Vec::new(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Update the group name.
    pub fn rename(&mut self, name: impl Into<String>) {
        self.name = name.into();
        self.updated_at = jiff::Timestamp::now();
    }

    /// Update the group description.
    pub fn set_description(&mut self, description: Option<String>) {
        self.description = description;
        self.updated_at = jiff::Timestamp::now();
    }

    /// Set the departments for this group.
    /// Empty vec means "all departments".
    pub fn set_departments(&mut self, department_ids: Vec<String>) {
        self.department_ids = department_ids;
        self.updated_at = jiff::Timestamp::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_group_defaults() {
        let group = DeviceGroup::new("onboarding", None);
        assert_eq!(group.name, "onboarding");
        assert!(group.description.is_none());
        assert!(!group.id.0.is_empty());
    }

    #[test]
    fn group_with_description() {
        let group = DeviceGroup::new("staff", Some("Staff punching terminals".into()));
        assert_eq!(group.name, "staff");
        assert_eq!(group.description.as_deref(), Some("Staff punching terminals"));
    }

    #[test]
    fn rename_updates_name_and_timestamp() {
        let mut group = DeviceGroup::new("old-name", None);
        let original_ts = group.updated_at;
        group.rename("new-name");
        assert_eq!(group.name, "new-name");
        assert!(group.updated_at >= original_ts);
    }
}
