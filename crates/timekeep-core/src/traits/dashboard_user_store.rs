//! Persistence for dashboard user accounts.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Dashboard users authenticate to the management UI. They are distinct from
//! device users (scanner PINs) and employees (HR records).

use async_trait::async_trait;

use crate::Error;
use crate::model::DashboardUser;
use crate::query::{ListParams, ListResult};

/// Persists and queries dashboard user accounts.
#[async_trait]
pub trait DashboardUserStore: Send + Sync {
    /// Create a new dashboard user. Returns an error if the username already exists.
    async fn create_dashboard_user(&self, _user: &DashboardUser) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }

    /// Find a dashboard user by username. Returns None if not found or inactive.
    async fn find_dashboard_user_by_username(
        &self,
        _username: &str,
    ) -> Result<Option<DashboardUser>, Error> {
        Ok(None)
    }

    /// List all dashboard users with optional search, sort, and pagination.
    async fn list_dashboard_users(
        &self,
        _params: &ListParams,
    ) -> Result<ListResult<DashboardUser>, Error> {
        Ok(ListResult::single_page(vec![]))
    }

    /// Update a dashboard user's role, display name, or active status.
    /// Returns an error if the user doesn't exist.
    async fn update_dashboard_user(&self, _user: &DashboardUser) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }

    /// Delete a dashboard user by ID. Returns an error if not found.
    async fn delete_dashboard_user(&self, _id: &str) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }

    /// Update a dashboard user's password (hash + salt).
    async fn update_dashboard_user_password(
        &self,
        _id: &str,
        _password_hash: &str,
        _salt: &str,
    ) -> Result<(), Error> {
        Err(Error::storage("dashboard user storage not implemented for this backend"))
    }
}
