//! Employee — the domain aggregate representing a person tracked by the system.
//!
//! Employees are created when an ERP system (or admin) registers them.
//! The `pin` field maps to the device user identifier. Punches with
//! matching `user_pin` are attributed to this employee.

use jiff::Timestamp;
use uuid::Uuid;

/// Strongly-typed employee identifier (UUID v7).
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct EmployeeId(pub String);

impl EmployeeId {
    /// Generate a new unique employee ID.
    pub fn new() -> Self {
        Self(Uuid::now_v7().to_string())
    }
}

impl Default for EmployeeId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for EmployeeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for EmployeeId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for EmployeeId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

/// An employee tracked by the attendance system.
///
/// # Invariants
///
/// - `pin` is the identifier used on biometric devices.
/// - `external_id` links to an ERP system (SAP, Odoo) — optional.
/// - `active = false` means the employee is no longer tracked.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Employee {
    /// Universally unique identifier (UUID v7).
    pub id: EmployeeId,

    /// Device PIN / user identifier on the scanner.
    pub pin: String,

    /// Display name (e.g. "Ahmed Al-Sabah").
    pub name: String,

    /// Department UUID reference for cross-entity navigation.
    ///
    /// When set, the frontend can navigate from employee detail → department detail.
    /// Resolved from the `department_id` at create/update time if a matching
    /// department exists.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department_id: Option<String>,

    /// Cached department display name for list views (no JOIN needed).
    ///
    /// This is the human-readable name (e.g. "Engineering"). Always resolved
    /// from `department_id` by the API layer — never accepted directly from
    /// user input.
    ///
    /// Consumers that need guaranteed freshness should resolve via
    /// `department_id` — this field is a best-effort cache.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,

    /// External reference from an ERP system (Odoo employee ID, SAP personnel number).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_id: Option<String>,

    /// Whether this employee is currently active (tracked).
    pub active: bool,

    /// When this employee was first registered.
    pub created_at: Timestamp,

    /// When this employee record was last modified.
    pub updated_at: Timestamp,
}

impl Employee {
    /// Create a new active employee.
    pub fn new(
        pin: impl Into<String>,
        name: impl Into<String>,
        department: Option<String>,
        external_id: Option<String>,
    ) -> Self {
        let now = Timestamp::now();
        Self {
            id: EmployeeId::new(),
            pin: pin.into(),
            name: name.into(),
            department_id: None,
            department,
            external_id,
            active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Assign or clear the department for this employee.
    ///
    /// `department_id` is the UUID FK reference. `department` is the
    /// cached display name resolved by the API layer.
    pub fn set_department(
        &mut self,
        department_id: Option<String>,
        department_name: Option<String>,
    ) {
        self.department_id = department_id;
        self.department = department_name;
        self.updated_at = Timestamp::now();
    }

    /// Mark this employee as inactive (soft delete).
    pub fn deactivate(&mut self) {
        self.active = false;
        self.updated_at = Timestamp::now();
    }

    /// Update the employee's display name.
    pub fn rename(&mut self, name: impl Into<String>) {
        self.name = name.into();
        self.updated_at = Timestamp::now();
    }

    /// Validate internal consistency.
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.pin.is_empty() {
            return Err("employee pin must not be empty");
        }
        if self.name.is_empty() {
            return Err("employee name must not be empty");
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_employee_is_active() {
        let emp = Employee::new("145", "Ahmed", None, None);
        assert!(emp.active);
        assert!(!emp.pin.is_empty());
        assert!(emp.validate().is_ok());
    }

    #[test]
    fn deactivate_sets_inactive() {
        let mut emp = Employee::new("145", "Ahmed", None, None);
        emp.deactivate();
        assert!(!emp.active);
    }

    #[test]
    fn rename_updates_name() {
        let mut emp = Employee::new("145", "Ahmed", None, None);
        emp.rename("Ahmed Al-Sabah");
        assert_eq!(emp.name, "Ahmed Al-Sabah");
    }

    #[test]
    fn validate_rejects_empty_pin() {
        let emp = Employee {
            id: EmployeeId::new(),
            pin: String::new(),
            name: "Test".into(),
            department_id: None,
            department: None,
            external_id: None,
            active: true,
            created_at: Timestamp::now(),
            updated_at: Timestamp::now(),
        };
        assert!(emp.validate().is_err());
    }

    #[test]
    fn validate_rejects_empty_name() {
        let emp = Employee {
            id: EmployeeId::new(),
            pin: "145".into(),
            name: String::new(),
            department_id: None,
            department: None,
            external_id: None,
            active: true,
            created_at: Timestamp::now(),
            updated_at: Timestamp::now(),
        };
        assert!(emp.validate().is_err());
    }

    #[test]
    fn employee_id_display() {
        let id = EmployeeId::new();
        assert!(!id.to_string().is_empty());
    }

    #[test]
    fn employee_id_from_string() {
        let id = EmployeeId::from("test-id-123");
        assert_eq!(id.0, "test-id-123");
    }

    #[test]
    fn employee_with_external_id() {
        let emp = Employee::new("145", "Ahmed", Some("Engineering".into()), Some("ODOO-42".into()));
        assert_eq!(emp.external_id.as_deref(), Some("ODOO-42"));
        assert_eq!(emp.department.as_deref(), Some("Engineering"));
        assert!(emp.department_id.is_none()); // Not resolved during construction
    }

    #[test]
    fn employee_with_department_id() {
        let mut emp = Employee::new("145", "Ahmed", Some("Engineering".into()), None);
        emp.department_id = Some("dept-uuid-123".into());
        assert_eq!(emp.department_id.as_deref(), Some("dept-uuid-123"));
        assert_eq!(emp.department.as_deref(), Some("Engineering"));
    }
}
