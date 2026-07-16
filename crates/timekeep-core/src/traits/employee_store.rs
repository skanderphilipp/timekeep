//! Persistence for the Employee aggregate.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Employees are HR-managed records with identity lifecycle (create, find,
//! update, deactivate). Device enrollments (which scanner an employee is
//! registered on) are part of the employee aggregate.

use async_trait::async_trait;

use crate::Error;
use crate::model::employee::{Employee, EmployeeId};
use crate::model::enrollment::{DeviceEnrollment, FingerprintTemplate};
use crate::query::{EmployeeFilter, ListResult};

/// Persistence operations for the Employee aggregate.
#[async_trait]
pub trait EmployeeStore: Send + Sync {
    /// Create a new employee. Returns an error if the PIN already exists.
    async fn create_employee(&self, employee: &Employee) -> Result<(), Error>;

    /// Find an employee by their unique ID.
    async fn find_employee(&self, id: &EmployeeId) -> Result<Option<Employee>, Error>;

    /// Find an employee by their device PIN.
    async fn find_employee_by_pin(&self, pin: &str) -> Result<Option<Employee>, Error>;

    /// Find an employee by their external ERP reference.
    async fn find_employee_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<Employee>, Error>;

    /// List all employees with optional search and pagination.
    async fn list_employees(
        &self,
        params: &crate::query::ListParams,
    ) -> Result<ListResult<Employee>, Error>;

    /// List employees with domain-specific filters (department, active status).
    ///
    /// Default implementation falls back to `list_employees` and filters in-memory.
    /// Storage backends SHOULD override this for SQL-level filtering.
    async fn list_employees_filtered(
        &self,
        filter: &EmployeeFilter,
    ) -> Result<ListResult<Employee>, Error> {
        let mut result = self.list_employees(&filter.params).await?;
        if let Some(ref dept_id) = filter.department_id {
            result.items.retain(|e| e.department_id.as_deref() == Some(dept_id.as_str()));
        }
        if let Some(active) = filter.active {
            result.items.retain(|e| e.active == active);
        }
        Ok(result)
    }

    /// Update an employee's name, department, or external_id.
    /// Returns an error if the employee doesn't exist.
    async fn update_employee(&self, employee: &Employee) -> Result<(), Error>;

    /// Deactivate an employee (soft delete). Punches are preserved.
    async fn deactivate_employee(&self, id: &EmployeeId) -> Result<(), Error>;

    /// Count employees in a specific department.
    ///
    /// Returns the number of active employees assigned to the department.
    /// Default implementation falls back to `list_employees_filtered` and counts
    /// in memory. Storage backends SHOULD override this for SQL-level counting.
    async fn count_employees_in_department(&self, _department_id: &str) -> Result<u64, Error> {
        Ok(0)
    }

    // ── Device Enrollments ────────────────────────────────────────────

    /// Register an employee on a specific device.
    async fn create_enrollment(&self, enrollment: &DeviceEnrollment) -> Result<(), Error>;

    /// Find an enrollment by employee and device.
    async fn find_enrollment(
        &self,
        employee_id: &EmployeeId,
        device_sn: &str,
    ) -> Result<Option<DeviceEnrollment>, Error>;

    /// List all enrollments for a specific employee.
    async fn list_enrollments_for_employee(
        &self,
        employee_id: &EmployeeId,
    ) -> Result<Vec<DeviceEnrollment>, Error>;

    /// List all enrollments on a specific device.
    async fn list_enrollments_for_device(
        &self,
        device_sn: &str,
    ) -> Result<Vec<DeviceEnrollment>, Error>;

    /// Remove an employee from a device.
    async fn delete_enrollment(
        &self,
        employee_id: &EmployeeId,
        device_sn: &str,
    ) -> Result<(), Error>;

    // ── Fingerprint Templates (stored as part of enrollment) ─────────

    /// Store a fingerprint template for an employee on a specific device.
    ///
    /// Templates are stored centrally as part of the enrollment so they
    /// can be pushed to new devices during cross-device sync.
    async fn store_fingerprint_template(
        &self,
        employee_id: &EmployeeId,
        device_sn: &str,
        template: &FingerprintTemplate,
    ) -> Result<(), Error> {
        let _ = (employee_id, device_sn, template);
        Err(Error::storage("fingerprint template storage not implemented for this backend"))
    }

    /// Load all fingerprint templates for an enrollment.
    async fn load_fingerprint_templates(
        &self,
        employee_id: &EmployeeId,
        device_sn: &str,
    ) -> Result<Vec<FingerprintTemplate>, Error> {
        let _ = (employee_id, device_sn);
        Ok(vec![])
    }
}
