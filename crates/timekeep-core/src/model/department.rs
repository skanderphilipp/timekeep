//! Department — organizational grouping with work policy assignment.
//!
//! Departments group employees for reporting and scheduling. Each department
//! can have its own `WorkPolicy` that overrides the organization default.
//! Employees inherit their department's policy; if none is set, the
//! organization default from `SystemSettings` applies.
//!
//! # Invariants
//!
//! - `name` is unique across the organization.
//! - `work_policy` is `None` when the department inherits the org default.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::work_policy::WorkPolicy;

/// Strongly-typed department identifier (UUID v7).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DepartmentId(pub String);

impl DepartmentId {
    /// Generate a new unique department ID.
    pub fn new() -> Self {
        Self(Uuid::now_v7().to_string())
    }
}

impl Default for DepartmentId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for DepartmentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// An organizational department.
///
/// # Example
///
/// ```text
/// Department { name: "Warehouse", work_policy: Some(NightShift) }
/// Department { name: "Engineering", work_policy: None } // inherits org default
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Department {
    /// Universally unique identifier (UUID v7).
    pub id: DepartmentId,

    /// Unique department name (e.g. "Engineering", "Warehouse").
    pub name: String,

    /// Optional department-specific work policy.
    /// `None` means the organization default from `SystemSettings` applies.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_policy: Option<WorkPolicy>,

    /// When this department was created.
    pub created_at: jiff::Timestamp,

    /// When this department was last modified.
    pub updated_at: jiff::Timestamp,
}

impl Department {
    /// Create a new department.
    pub fn new(name: impl Into<String>, work_policy: Option<WorkPolicy>) -> Self {
        let now = jiff::Timestamp::now();
        Self {
            id: DepartmentId::new(),
            name: name.into(),
            work_policy,
            created_at: now,
            updated_at: now,
        }
    }

    /// Update the department name.
    pub fn rename(&mut self, name: impl Into<String>) {
        self.name = name.into();
        self.updated_at = jiff::Timestamp::now();
    }

    /// Set or clear the department's work policy.
    pub fn set_work_policy(&mut self, policy: Option<WorkPolicy>) {
        self.work_policy = policy;
        self.updated_at = jiff::Timestamp::now();
    }

    /// Whether this department has its own work policy
    /// (rather than inheriting the organization default).
    pub fn has_custom_policy(&self) -> bool {
        self.work_policy.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::work_policy::WorkPolicy;

    #[test]
    fn new_department_defaults() {
        let dept = Department::new("Engineering", None);
        assert_eq!(dept.name, "Engineering");
        assert!(dept.work_policy.is_none());
        assert!(!dept.has_custom_policy());
    }

    #[test]
    fn department_with_policy() {
        let policy = WorkPolicy::standard_9to5();
        let dept = Department::new("Warehouse", Some(policy));
        assert!(dept.has_custom_policy());
        assert!(dept.work_policy.is_some());
    }

    #[test]
    fn rename_updates_name() {
        let mut dept = Department::new("Eng", None);
        dept.rename("Engineering");
        assert_eq!(dept.name, "Engineering");
    }

    #[test]
    fn set_work_policy_updates() {
        let mut dept = Department::new("HR", None);
        assert!(!dept.has_custom_policy());

        dept.set_work_policy(Some(WorkPolicy::standard_9to5()));
        assert!(dept.has_custom_policy());

        dept.set_work_policy(None);
        assert!(!dept.has_custom_policy());
    }
}
