//! Employee repository trait — persistence for the Employee aggregate.
//!
//! Separate from `Storage` (which handles punches and devices) because
//! Employee management is a distinct bounded context. In a future CQRS
//! setup, this would be a separate read/write model.

use async_trait::async_trait;

use crate::Error;
use crate::model::employee::{Employee, EmployeeId};
use crate::model::enrollment::DeviceEnrollment;
use crate::query::ListResult;

/// Persistence operations for the Employee aggregate.
#[async_trait]
pub trait EmployeeRepository: Send + Sync {
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

    /// Update an employee's name, department, or external_id.
    /// Returns an error if the employee doesn't exist.
    async fn update_employee(&self, employee: &Employee) -> Result<(), Error>;

    /// Deactivate an employee (soft delete). Punches are preserved.
    async fn deactivate_employee(&self, id: &EmployeeId) -> Result<(), Error>;

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
}
