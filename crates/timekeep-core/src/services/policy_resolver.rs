//! Policy resolver — determines the effective work policy for each employee.
//!
//! The resolution chain is:
//! 1. Get the employee's `department` field (stored as department name)
//! 2. Look up the department → if it has `work_policy: Some(...)`, use it
//! 3. Otherwise → fall back to the organization default from `SystemSettings`
//!
//! This service is stateless. It composes the existing `DepartmentStore`
//! and `EmployeeStore` traits. Callers pass the org default policy as a
//! fallback so this service doesn't need to know about `SystemSettings`.

use std::collections::HashMap;

use crate::Error;
use crate::model::employee::Employee;
use crate::model::work_policy::WorkPolicy;
use crate::traits::department_store::DepartmentStore;

/// Stateless service that resolves the effective work policy per employee.
pub struct PolicyResolver;

/// Result of batch policy resolution: groups employee PINs by their
/// effective policy so attendance calculations can be run per-policy.
pub type PolicyGroups = HashMap<String, WorkPolicy>;
// We use String as the key because WorkPolicy doesn't implement Hash/Eq
// in a way that groups identical policies efficiently. Instead we store
// the resolved policy per employee PIN and the caller groups as needed.

impl PolicyResolver {
    /// Resolve the effective work policy for a single employee.
    ///
    /// Returns the department-specific policy if the employee belongs to a
    /// department that overrides the org default, otherwise returns a clone
    /// of `org_default`.
    pub async fn resolve_for_employee(
        dept_store: &dyn DepartmentStore,
        employee: &Employee,
        org_default: &WorkPolicy,
    ) -> WorkPolicy {
        match &employee.department {
            Some(dept_name) => match dept_store.get_department_by_name(dept_name).await {
                Ok(Some(dept)) => dept.work_policy.unwrap_or_else(|| org_default.clone()),
                _ => org_default.clone(),
            },
            None => org_default.clone(),
        }
    }

    /// Batch-resolve policies for multiple employees.
    ///
    /// Returns a map of `employee_pin → effective WorkPolicy`.
    /// The caller can then group employees by their effective policy
    /// and run `AttendanceCalculator` computations per group.
    pub async fn resolve_batch(
        dept_store: &dyn DepartmentStore,
        employees: &[Employee],
        org_default: &WorkPolicy,
    ) -> Result<HashMap<String, WorkPolicy>, Error> {
        let mut map = HashMap::with_capacity(employees.len());

        for emp in employees {
            let policy = Self::resolve_for_employee(dept_store, emp, org_default).await;
            map.insert(emp.pin.clone(), policy);
        }

        Ok(map)
    }

    /// Resolve the effective policy for an employee identified by PIN.
    ///
    /// Used when only the PIN is available (e.g., in punch-based endpoints
    /// where we don't have the full Employee object loaded).
    pub async fn resolve_for_pin(
        dept_store: &dyn DepartmentStore,
        employee_store: &dyn crate::traits::employee_store::EmployeeStore,
        pin: &str,
        org_default: &WorkPolicy,
    ) -> WorkPolicy {
        match employee_store.find_employee_by_pin(pin).await {
            Ok(Some(emp)) => Self::resolve_for_employee(dept_store, &emp, org_default).await,
            _ => org_default.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Error as CoreError;
    use crate::model::department::{Department, DepartmentId};
    use crate::model::work_policy::WorkPolicy;
    use crate::traits::department_store::DepartmentStore;
    use async_trait::async_trait;
    use std::sync::Mutex;

    struct FakeDeptStore {
        depts: Mutex<Vec<Department>>,
    }

    impl FakeDeptStore {
        fn new(depts: Vec<Department>) -> Self {
            Self { depts: Mutex::new(depts) }
        }
    }

    #[async_trait]
    impl DepartmentStore for FakeDeptStore {
        async fn list_departments(&self) -> Result<Vec<Department>, CoreError> {
            Ok(self.depts.lock().unwrap().clone())
        }
        async fn get_department(&self, _id: &str) -> Result<Option<Department>, CoreError> {
            Ok(None)
        }
        async fn get_department_by_name(
            &self,
            name: &str,
        ) -> Result<Option<Department>, CoreError> {
            Ok(self.depts.lock().unwrap().iter().find(|d| d.name == name).cloned())
        }
        async fn create_department(&self, _department: &Department) -> Result<(), CoreError> {
            Ok(())
        }
        async fn update_department(&self, _department: &Department) -> Result<(), CoreError> {
            Ok(())
        }
        async fn delete_department(&self, _id: &str) -> Result<(), CoreError> {
            Ok(())
        }
    }

    fn make_employee(pin: &str, dept: Option<&str>) -> Employee {
        Employee::new(pin, format!("User {pin}"), dept.map(String::from), None)
    }

    fn make_dept(name: &str, policy: Option<WorkPolicy>) -> Department {
        Department::new(name, policy)
    }

    #[tokio::test]
    async fn resolve_falls_back_to_org_default_when_no_department() {
        let store = FakeDeptStore::new(vec![]);
        let emp = make_employee("1001", None);
        let default = WorkPolicy::standard_9to5();

        let policy = PolicyResolver::resolve_for_employee(&store, &emp, &default).await;
        assert_eq!(policy, default);
    }

    #[tokio::test]
    async fn resolve_falls_back_when_department_not_found() {
        let store = FakeDeptStore::new(vec![]);
        let emp = make_employee("1001", Some("GhostDept"));
        let default = WorkPolicy::standard_9to5();

        let policy = PolicyResolver::resolve_for_employee(&store, &emp, &default).await;
        assert_eq!(policy, default);
    }

    #[tokio::test]
    async fn resolve_uses_department_policy_when_set() {
        let custom = WorkPolicy::flexible(4);
        let store = FakeDeptStore::new(vec![make_dept("Management", Some(custom.clone()))]);
        let emp = make_employee("1001", Some("Management"));
        let default = WorkPolicy::standard_9to5();

        let policy = PolicyResolver::resolve_for_employee(&store, &emp, &default).await;
        assert_eq!(policy, custom);
    }

    #[tokio::test]
    async fn resolve_falls_back_when_dept_has_no_override() {
        let store = FakeDeptStore::new(vec![make_dept("Engineering", None)]);
        let emp = make_employee("1002", Some("Engineering"));
        let default = WorkPolicy::standard_9to5();

        let policy = PolicyResolver::resolve_for_employee(&store, &emp, &default).await;
        assert_eq!(policy, default);
    }

    #[tokio::test]
    async fn resolve_batch_mixed_policies() {
        let flexible = WorkPolicy::flexible(4);
        let early = WorkPolicy {
            work_start: jiff::civil::Time::new(6, 0, 0, 0).unwrap(),
            work_end: jiff::civil::Time::new(14, 0, 0, 0).unwrap(),
            ..WorkPolicy::standard_9to5()
        };

        let store = FakeDeptStore::new(vec![
            make_dept("Management", Some(flexible.clone())),
            make_dept("Warehouse", Some(early.clone())),
            make_dept("Engineering", None),
        ]);

        let employees = vec![
            make_employee("1001", Some("Management")),
            make_employee("1002", Some("Warehouse")),
            make_employee("1003", Some("Engineering")),
            make_employee("1004", None),
        ];

        let default = WorkPolicy::standard_9to5();
        let map = PolicyResolver::resolve_batch(&store, &employees, &default).await.unwrap();

        assert_eq!(map["1001"], flexible);
        assert_eq!(map["1002"], early);
        assert_eq!(map["1003"], default);
        assert_eq!(map["1004"], default);
    }
}
