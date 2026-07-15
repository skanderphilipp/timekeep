//! Persistence for organizational departments.
//!
//! Departments group employees and can override the organization's
//! default work policy with a department-specific schedule.

use async_trait::async_trait;

use crate::Error;
use crate::model::department::Department;

/// Persists and queries department records.
#[async_trait]
pub trait DepartmentStore: Send + Sync {
    /// List all departments.
    async fn list_departments(&self) -> Result<Vec<Department>, Error>;

    /// Get a single department by ID.
    async fn get_department(&self, id: &str) -> Result<Option<Department>, Error>;

    /// Get a department by name.
    async fn get_department_by_name(&self, name: &str) -> Result<Option<Department>, Error>;

    /// Create a new department.
    async fn create_department(&self, department: &Department) -> Result<(), Error>;

    /// Update an existing department.
    async fn update_department(&self, department: &Department) -> Result<(), Error>;

    /// Delete a department by ID.
    async fn delete_department(&self, id: &str) -> Result<(), Error>;
}
